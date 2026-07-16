/**
 * Product-config puro y sin efectos secundarios (testeable con `node --test`,
 * igual que stripe-filter.mjs de la Fase 2.1): namespacing de KV keys por
 * `PRODUCT_ID` y marca usada en los correos. Ambos leen únicamente de `env`
 * — nunca tocan KV ni red — así una vertical nueva solo necesita sus propias
 * env vars en `wrangler.toml` (ver `wrangler.toml.tpl`), sin editar código.
 */

// Todas las KV keys del worker se namespacean por PRODUCT_ID (no por dominio:
// el mismo Cloudflare account puede alojar varios Workers, cada uno con su
// propio KV namespace, pero el prefijo evita ambigüedad si dos verticales
// llegaran a compartir namespace). Sin PRODUCT_ID configurado cae a "hmu"
// (comportamiento histórico, sin romper el deploy actual de HMU Link).
export function kvKey(env, ns, ...parts) {
  const productId = (env.PRODUCT_ID || 'hmu').trim();
  return [`${productId}_${ns}`, ...parts].join(':');
}

// Marca usada en asuntos/cuerpos/footers de los correos — parametrizable por
// vertical vía env; los defaults son los de HMU Link (comportamiento actual).
export function brandName(env) {
  return (env.BRAND_NAME || 'HMU Link').trim();
}

export function brandTagline(env) {
  return (env.BRAND_TAGLINE || 'Service Menus for Small Businesses').trim();
}

export function brandDomain(env) {
  return (env.PUBLIC_BOOK_BASE_URL || 'https://www.hmulink.com').trim().replace(/^https?:\/\//, '');
}

export function emailFooterHtml(env) {
  return `${brandName(env)} — ${brandTagline(env)}`;
}

export function emailFooterText(env) {
  return `${brandName(env)} — ${brandDomain(env)}`;
}

// Origin permitido por CORS. La API es server-to-server (Stripe, Tally, GitHub
// Actions) — ningún navegador la llama — así que se acota al origin del sitio
// en vez de '*'. Se deriva de PUBLIC_BOOK_BASE_URL (el mismo dominio público de
// la vertical), sin barra final. Default = el de HMU (comportamiento actual).
export function corsOrigin(env) {
  return (env.PUBLIC_BOOK_BASE_URL || 'https://www.hmulink.com').trim().replace(/\/+$/, '');
}

// Catálogo de estilos por defecto: los 12 de HMU Link. Es el fallback cuando
// VALID_BRAND_STYLES no está configurado, así que el deploy real de HMU no
// cambia aunque no declare la var.
export const DEFAULT_BRAND_STYLES = [
  'black-gold', 'soft-blush', 'charcoal-clean', 'warm-sand',
  'aqua-clean', 'sage-calm', 'electric-slate', 'terracotta-warm',
  'sunny-paws', 'midnight-ink', 'clarity-editorial', 'horizon-teal'
];

// Estilos válidos con los que el worker acepta el intake de Tally, por vertical.
// Vienen de env.VALID_BRAND_STYLES (coma-separado; export_vertical.py lo llena
// desde styles.catalog del vertical.yaml, la fuente de verdad). Ausente o
// vacío/mal escrito → cae a los 12 de HMU (nunca a lista vacía: eso rompería
// todo el intake — el fail-safe correcto aquí es el catálogo por defecto, no
// fail-closed a cero).
export function validBrandStyles(env) {
  const raw = (env.VALID_BRAND_STYLES || '').trim();
  if (!raw) return [...DEFAULT_BRAND_STYLES];
  const parsed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return parsed.length ? parsed : [...DEFAULT_BRAND_STYLES];
}

// Estilo al que cae un intake cuyo estilo elegido no está en el catálogo.
// 'warm-sand' es el neutro histórico de HMU (y está en el catálogo de PawContact),
// así que se prefiere cuando existe — conservando el comportamiento actual;
// si una vertical no lo incluye, cae a su primer estilo (siempre válido).
export function fallbackBrandStyle(styles) {
  return styles.includes('warm-sand') ? 'warm-sand' : styles[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// PREFILL DE PROSPECTO (Cory → worker → Tally), Fase 2.4
//
// Un prospecto que Cory generó (p. ej. una demo de HMU con caducidad) compra por
// un link rastreado: Cory pone `client_reference_id=<slug>` en el checkout de
// Stripe, así que el MISMO webhook llega aquí con el slug. Con el slug, el worker
// pide a Cory un `prefill.json` PÚBLICO (los datos ya son públicos: están en la
// demo del prospecto) y prellena por URL los campos VISIBLES del formulario de
// Tally, en el idioma del comprador. El cliente ve sus datos ya cargados y puede
// dejarlos, editarlos o borrarlos — su envío es el que genera su HMU Link
// permanente. Todo es fail-open: sin base configurada, sin slug, o si el fetch
// falla, la URL del formulario queda EXACTAMENTE como hoy (order_id + email).
// ─────────────────────────────────────────────────────────────────────────────

// Base pública desde donde el worker lee el prefill del prospecto, por slug:
// `${base}/${slug}/prefill.json`. Sin la var → la función de prefill se apaga
// (comportamiento actual de HMU intacto). Sin barra final.
export function prospectPrefillBase(env) {
  return (env.PROSPECT_PREFILL_BASE_URL || '').trim().replace(/\/+$/, '');
}

// Misma forma exacta de slug que valida el tracker de Cory (stripe.js SLUG_RE):
// solo se confía en un client_reference_id con esta forma. Validarlo ANTES de
// construir la URL de fetch evita path-traversal / SSRF por un valor arbitrario.
export const PROSPECT_SLUG_RE = /^[a-z0-9-]{3,80}-[0-9a-f]{6}$/;

export function prospectSlug(session) {
  const raw = String(session?.client_reference_id || '').trim();
  return PROSPECT_SLUG_RE.test(raw) ? raw : null;
}

// Construye el fragmento de query `&name=value&...` para prellenar campos
// VISIBLES de Tally desde un objeto {name: value}. Puro y testeable:
// - salta valores vacíos / no-string (un campo que Cory no tiene no se prellena);
// - URL-encodea nombre y valor;
// - respeta `maxLen` (largo total del fragmento): agrega pares mientras quepan y
//   descarta el resto — una URL demasiado larga la truncan navegadores/proxies y
//   rompería el link, así que es mejor prellenar de más a de menos sin pasarse.
//   El orden de inserción del objeto define la prioridad (lo más útil primero).
// Nunca lanza: ante cualquier entrada rara devuelve "".
export function buildPrefillQuery(prefill, maxLen = 1500) {
  if (!prefill || typeof prefill !== 'object') return '';
  let out = '';
  for (const [name, value] of Object.entries(prefill)) {
    if (typeof value !== 'string' || value === '') continue;
    if (typeof name !== 'string' || name === '') continue;
    const pair = `&${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    if (out.length + pair.length > maxLen) continue;
    out += pair;
  }
  return out;
}
