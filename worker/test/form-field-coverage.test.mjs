/**
 * COBERTURA DEL FORMULARIO VIVO DE PAWCONTACT — el candado que faltaba (Fase 3.5).
 *
 * Aquí nació el bug. El 2026-07-26 una compra real de $1 (Puppy Patch) destapó
 * que el worker tiraba 11 de 17 campos EN SILENCIO: los alias mapean por TÍTULO
 * de pregunta, y este formulario —creado por `create_tally_forms.py`— declara un
 * `name:` estable en CADA pregunta, así que Tally manda el NOMBRE y no el
 * título. Los tests seguían verdes porque ninguno comparaba el formulario VIVO
 * contra lo que el worker lee.
 *
 * Esta prueba lo compara. Para CADA pregunta viva de los DOS formularios
 * (EN zxo55M · ES 0QyRRB) arma un webhook de Tally con un valor centinela y
 * afirma que el centinela sale del otro lado, en algún campo del payload público
 * que se despacha al generador. Una pregunta que no llega y no está en la lista
 * NO_VIAJAN (cada entrada con su razón escrita) es un campo perdido.
 *
 * ⚠️ SE MIDE CONTRA EL FORMULARIO VIVO, por la API de Tally — nunca contra
 * `tally_form.yaml`. Ese archivo es la ESPECIFICACIÓN, y el formulario vivo
 * puede haberse quedado atrás: el 2026-07-26 pasó justamente eso con varias
 * correcciones de la Fase 2. Medir el spec y creerle es el error que trajo el
 * PLAN_CERO_REGRESIONES. Pero una DIFERENCIA entre el spec y el vivo sí es un
 * hecho, y es lo que revisa la sección DESFASE al final: el spec dice qué debe
 * preguntar el formulario, el vivo dice qué pregunta, y cuando se separan hay
 * un cambio de consola pendiente. Es la otra mitad del candado.
 *
 * Cada pregunta se mide SOLA, no todas a la vez: así una pregunta que perdió su
 * alias no se esconde detrás de otra que alimenta el mismo campo.
 *
 * Corre offline: el inventario del formulario está commiteado en
 * fixtures/tally_forms_questions.json. Cuando el formulario de Tally cambie hay
 * que volver a tomarlo — ver worker/test/README.md.
 *
 *   node worker/test/form-field-coverage.test.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// El worker REAL, por sus exports reales: la prueba vale solo si corre contra el
// código que se despliega.
import { normalizeTallyPayload, buildPublicPayload } from '../worker.js'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT = join(AQUI, 'fixtures', 'tally_forms_questions.json')
const WRANGLER = join(AQUI, '..', 'wrangler.toml')
const SPEC = join(AQUI, '..', '..', 'tally_form.yaml')

// ─────────────────────────────────────────────────────────────────────────────
// Las preguntas que a propósito NO viajan al payload público, con su razón.
// Una pregunta que no llega y no está aquí es un campo perdido, no una excepción.
//
// Van por el TÍTULO QUE MANDA EL WEBHOOK, que en este formulario es el `name`
// estable — el mismo en EN y en ES. Por eso una sola entrada cubre los dos
// formularios, al revés que en HMU (formulario a mano, sin `name`, un título
// por idioma).
// ─────────────────────────────────────────────────────────────────────────────
const NO_VIAJAN = new Map([
  ['photo_rights_confirmed',
   'consentimiento legal (derechos de imagen de las fotos que sube el cliente). ' +
   'MEDIDO 2026-07-27 (pawcontact/6, KV remoto): los 3 submissions vivos SÍ traen la ' +
   'respuesta en el blob crudo ("Sí"/"Yes"; el del 07-18 bajo la clave por TÍTULO, ' +
   'anterior a los names estables), pero el blob expira a los 90 días (expirationTtl ' +
   '7776000, worker.js) y las páginas con las fotos son PERMANENTES: la única prueba de ' +
   'un consentimiento no puede expirar antes que el uso que ampara (prescripciones de ' +
   'derechos de autor/imagen se miden en años, no en días). ' +
   'DICTAMEN 2026-07-27: el blob NO basta — el campo debe declararse en el mapa para ' +
   'quedar en el client.json permanente, como ya lo hace ModaLink (OPTIONAL_INTAKE_FIELDS ' +
   'del motor ya lo extrae; solo falta la línea en verticals/pawcontact/tally-field-aliases.json ' +
   '+ re-export engine-only + deploy). FICHADO AL MOTOR en el tablero, área linkFactory ' +
   '(ficha «photo_rights_confirmed debe viajar al client.json», 2026-07-27) — no se toca ' +
   'desde este repo. Evidencia de los 3 existentes preservada ANTES de su expiración en ' +
   '..\\..\\..\\consentimientos-kv\\CONSENTIMIENTOS_2026-07-27.json (fuera de git: el repo es ' +
   'público). Cuando el motor lo declare, esta misma prueba avisa sola: ' +
   '"está en NO_VIAJAN pero SÍ llega — quita la excepción".'],
])

// ─────────────────────────────────────────────────────────────────────────────
// Listas cerradas cuya respuesta el worker TRANSFORMA: el texto de la opción no
// aparece tal cual en el payload, así que un centinela no sirve. Se prueba lo
// que de verdad importa: que CADA opción viva produzca un valor válido y no un
// fallback silencioso.
//
// No es hipotético. Hasta el 2026-07-25 el separador incluía el guion normal y
// 'sunny-paws — alegre y jugueton' se cortaba en 'sunny', que no existe: las 4
// opciones de PawContact entregaban la MISMA página. Esta es la prueba que lo
// habría cazado.
// ─────────────────────────────────────────────────────────────────────────────
const TRANSFORMADAS = new Map([
  ['pick_your_style', 'estilo'],
  ['primary_cta', 'cta'],
])

// Opciones de una lista cerrada que HOY no mapean y están FICHADAS, con su
// razón y dónde vive el arreglo. Una opción rota que no esté aquí es una falla.
// Vacío es el estado sano: significa que toda opción viva produce un valor.
//
// Clave: `<name de la pregunta>::<texto exacto de la opción viva>`.
const OPCIONES_ROTAS = new Map([
  ['primary_cta::Booking link',
   'HALLAZGO 2026-07-26 (Fase 3.5) · FICHADO AL MOTOR, no se arregla en este repo. ' +
   'normalizeKey("Booking link") = "booking_link" y la tabla de normalizePrimaryCta ' +
   '(worker.js, motor) tiene "booking" y "external_booking_link" pero NO "booking_link": ' +
   'primary_cta sale vacío. Efecto probado: el generador cae a PRIMARY_CTA_CHOICES y pinta ' +
   'WhatsApp. Una veterinaria que eligió su liga de reservas recibe la página con el botón ' +
   'de WhatsApp destacado, y nada lo avisa.'],
  ['primary_cta::Reservas / agenda',
   'HALLAZGO 2026-07-26 (Fase 3.5) · FICHADO AL MOTOR, no se arregla en este repo. ' +
   'Es el mismo hueco que "Booking link" del lado ES: "reservas_agenda" no está en la tabla ' +
   '(sí "reservas" y "reservar", pero el texto vivo de la opción lleva las dos palabras). ' +
   'Mismo efecto: el botón elegido se pierde y sale WhatsApp.'],
])

// Dos opciones VIVAS de la misma lista cerrada que a propósito producen el mismo
// valor. Clave: `<name de la pregunta>::<valor resultante>`. Vacío es el estado
// sano en las listas del worker: cuatro estilos deben dar cuatro estilos y cinco
// botones cinco botones.
const COLAPSOS = new Map([])

// ─────────────────────────────────────────────────────────────────────────────
// Dos preguntas VIVAS que alimentan el MISMO campo del payload. `answerAny` se
// queda con la primera no vacía, así que si el cliente contesta las dos, la
// segunda se pierde en silencio. Cada colisión va aquí con su razón; una
// colisión nueva es una falla.
// ─────────────────────────────────────────────────────────────────────────────
const COLISIONES = new Map([])

// ─────────────────────────────────────────────────────────────────────────────
// Campos que el worker construye y que NINGUNA pregunta viva alimenta. No es un
// error por sí mismo —el payload público es el del MOTOR y lo comparten cinco
// verticales con formularios distintos— pero se lista para que no crezca sin
// que nadie lo note, y para que se vea cuál bloque del generador nunca se pinta
// para un cliente de PawContact.
// ─────────────────────────────────────────────────────────────────────────────
const SIN_PREGUNTA = new Map([
  ['public_slug', 'derivado: nombre del negocio + submission_id'],
  ['style_unmapped', 'bandera derivada: avisa que el estilo elegido no está en el catálogo'],
  ['default_language', 'derivado: PawContact NO pregunta el idioma a propósito (lo dice tally_form.yaml). Sale del formulario que el cliente llenó — se verifica abajo, en su propio check'],
  ['other_public_link', 'campo del MOTOR de otras verticales: PawContact no lo pregunta'],
  ['location_1_notes', 'campo del MOTOR: PawContact pregunta UNA ubicación, sin notas'],
  ['location_1_name', 'campo del MOTOR: PawContact pregunta UNA ubicación, sin nombrarla'],
  ['location_2_name', 'campo del MOTOR (multi-sucursal): PawContact pregunta UNA ubicación'],
  ['location_2_address', 'campo del MOTOR (multi-sucursal): PawContact pregunta UNA ubicación'],
  ['location_2_maps_url', 'campo del MOTOR (multi-sucursal): PawContact pregunta UNA ubicación'],
  ['location_2_notes', 'campo del MOTOR (multi-sucursal): PawContact pregunta UNA ubicación'],
  ['location_3_name', 'campo del MOTOR (multi-sucursal): PawContact pregunta UNA ubicación'],
  ['location_3_address', 'campo del MOTOR (multi-sucursal): PawContact pregunta UNA ubicación'],
  ['location_3_maps_url', 'campo del MOTOR (multi-sucursal): PawContact pregunta UNA ubicación'],
  ['location_3_notes', 'campo del MOTOR (multi-sucursal): PawContact pregunta UNA ubicación'],
  ['additional_locations_text', 'campo del MOTOR (multi-sucursal): PawContact pregunta UNA ubicación'],
  ['service_area_text', 'campo del MOTOR (negocios a domicilio): PawContact no lo pregunta'],
  ['client_care_text', 'campo del MOTOR (terapeutas): PawContact no lo pregunta'],
  ['reservations_text', 'campo del MOTOR (restaurantes): PawContact no lo pregunta'],
  ['class_schedule_text', 'campo del MOTOR (talleres/clases): PawContact no lo pregunta'],
  ['tour_details_text', 'campo del MOTOR (tours): PawContact no lo pregunta'],
  ['service_categories_text', 'campo del MOTOR: PawContact no lo pregunta; el generador deriva las categorías de services_text'],
])

// ─────────────────────────────────────────────────────────────────────────────
// DESFASE spec ↔ formulario vivo, conocido y REPORTADO. `tally_form.yaml` es la
// especificación; el formulario de Tally es lo que el cliente ve. Cuando se
// separan, hay un cambio pendiente EN LA CONSOLA DE TALLY (o por su API): no es
// algo que se arregle editando este repo, y por eso no puede ser una falla roja
// permanente. Cada entrada dice qué dice el spec, qué dice el vivo, y quién
// actúa. Un desfase NUEVO —uno que no esté aquí— sí es una falla.
//
// Clave = el `name` estable de la pregunta.
// ─────────────────────────────────────────────────────────────────────────────
const DESFASES_CONOCIDOS = new Map([
  ['portfolio_link',
   'DECISIÓN DE VERO 2026-07-26 · ACCIÓN DE CONSOLA PENDIENTE. El spec reescribió el título ' +
   'para que diga QUÉ poner ("Enlace a fotos de tu trabajo (opcional)" / "Link to photos of ' +
   'your work (optional)"); el formulario vivo sigue diciendo "Enlace de portafolio" / ' +
   '"Portfolio link", que fue justo lo que Vero reportó que no dice nada. Y si la decisión ' +
   'final es QUITAR la pregunta, también se quita en Tally. Ninguna de las dos se hace desde ' +
   'este repo.'],
  ['instagram',
   'CORRECCIÓN FASE 2 #1 · ACCIÓN DE CONSOLA PENDIENTE. El spec la bajó a campo de TEXTO para ' +
   'aceptar "@puppy_patch_pv"; el vivo sigue siendo INPUT_LINK, que exige una URL y rechaza ' +
   'el usuario — que es lo que la gente comparte. El generador ya acepta el handle.'],
  ['facebook',
   'CORRECCIÓN FASE 2 #1 · ACCIÓN DE CONSOLA PENDIENTE. Igual que instagram: el spec dice ' +
   'texto, el vivo sigue siendo INPUT_LINK.'],
  ['tiktok',
   'CORRECCIÓN FASE 2 #1 · ACCIÓN DE CONSOLA PENDIENTE. Igual que instagram: el spec dice ' +
   'texto, el vivo sigue siendo INPUT_LINK.'],
  ['logo_url',
   'CORRECCIÓN FASE 2 #4 · ACCIÓN DE CONSOLA PENDIENTE. El spec dice la forma y los límites ' +
   '("cuadrado (se recorta en círculo). JPG, PNG o WebP, máx 8 MB") porque el recorte y el ' +
   'descarte son SILENCIOSOS; el vivo sigue diciendo solo "Sube tu logo".'],
  ['image_url',
   'CORRECCIÓN FASE 2 #4 · ACCIÓN DE CONSOLA PENDIENTE. El spec dice "horizontal (se recorta ' +
   'a 4:3)" y los límites de archivo; el vivo sigue diciendo solo "Sube una foto principal".'],
  ['gallery_image_urls',
   'CORRECCIÓN FASE 2 #4 · ACCIÓN DE CONSOLA PENDIENTE. El spec dice "hasta 5 — horizontales ' +
   '(se recortan a 4:3)" y los límites; el vivo sigue diciendo solo "Más fotos".'],
])

// ─────────────────────────────────────────────────────────────────────────────

let fallos = 0
function check(nombre, ok, detalle = '') {
  console.log(`  ${ok ? 'ok  ' : 'FALLA'}  ${nombre}${ok || !detalle ? '' : `\n         ${detalle}`}`)
  if (!ok) fallos++
}

// El env de PRODUCCIÓN, leído de wrangler.toml: si la prueba inventara el suyo,
// mediría un worker que no existe (el catálogo de estilos y el idioma por
// defecto salen de ahí).
function envDeWrangler() {
  const toml = readFileSync(WRANGLER, 'utf8')
  const leer = (clave) => (toml.match(new RegExp(`^${clave}\\s*=\\s*"([^"]*)"`, 'm')) || [])[1] || ''
  return {
    BRAND_NAME: leer('BRAND_NAME') || 'PawContact',
    VALID_BRAND_STYLES: leer('VALID_BRAND_STYLES'),
    TALLY_FORM_URL_EN: leer('TALLY_FORM_URL_EN'),
    TALLY_FORM_URL_ES: leer('TALLY_FORM_URL_ES'),
  }
}
const ENV = envDeWrangler()
const ESTILOS_VALIDOS = ENV.VALID_BRAND_STYLES.split(',').map((s) => s.trim()).filter(Boolean)

const CENTINELA = 'CENTINELAxyz'

function payloadDeUna(form, pregunta, valor) {
  const value = pregunta.type === 'FILE_UPLOAD'
    ? [{ url: `https://storage.tally.so/${valor}.jpg`, name: `${valor}.jpg`, mimeType: 'image/jpeg' }]
    : valor
  const webhook = {
    eventType: 'FORM_RESPONSE',
    data: {
      responseId: 'COBERTURA01',
      formId: form.form_id,
      // `label` es el TÍTULO tal como lo manda Tally, que en este formulario es
      // el `name` estable. Reproducirlo así es todo el punto de la prueba.
      fields: [{ key: `question_${pregunta.id}`, label: pregunta.title, type: pregunta.type, value }],
      hiddenFields: {},
    },
  }
  return buildPublicPayload(normalizeTallyPayload(webhook), 'pi_cobertura', ENV)
}

function hojas(obj, out = []) {
  if (typeof obj === 'string') out.push(obj)
  else if (Array.isArray(obj)) obj.forEach((v) => hojas(v, out))
  else if (obj && typeof obj === 'object') Object.values(obj).forEach((v) => hojas(v, out))
  return out
}

function campoQueRecibe(payload, marca) {
  for (const [campo, valor] of Object.entries(payload)) {
    if (hojas(valor).some((t) => t.includes(marca))) return campo
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────

const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'))

console.log('\nCOBERTURA DEL FORMULARIO VIVO DE PAWCONTACT')
console.log(`  inventario del ${snapshot.snapshot_date}\n`)

check('el inventario trae los 2 formularios vivos (EN y ES)', snapshot.forms.length === 2)
const [enForm, esForm] = snapshot.forms
check('los formularios EN y ES preguntan lo mismo',
  enForm.questions.length === esForm.questions.length,
  `EN ${enForm.questions.length} vs ES ${esForm.questions.length} preguntas`)

// Los dos formularios los generó el mismo script desde el mismo spec: si un
// `name` difiere entre idiomas, el prellenado de una modificación se rompe en
// uno de los dos y el cliente pierde lo que ya había escrito.
const namesEN = enForm.questions.map((q) => q.title)
const namesES = esForm.questions.map((q) => q.title)
check('EN y ES usan los MISMOS nombres estables, en el mismo orden',
  namesEN.join('|') === namesES.join('|'),
  `solo EN: ${namesEN.filter((n) => !namesES.includes(n)).join(', ') || '—'}\n` +
  `         solo ES: ${namesES.filter((n) => !namesEN.includes(n)).join(', ') || '—'}`)

const camposPorForm = {}
const rotasVistas = new Set()
const colapsosVistos = new Set()
const sanadas = []

for (const form of snapshot.forms) {
  console.log(`\n─── ${form.form_name} (${form.form_id}) · ${form.questions.length} preguntas vivas`)

  check(`[${form.lang}] inventario sospechosamente corto`, form.questions.length > 20,
    `${form.questions.length} preguntas`)

  const perdidas = []
  const sinRazon = []
  const destino = {}

  for (const q of form.questions) {
    const transformada = TRANSFORMADAS.get(q.title)

    if (transformada) {
      // No se busca el centinela: se afirma que TODA opción viva mapea.
      const malas = []
      const valorDe = new Map()
      for (const opcion of q.options || []) {
        const p = payloadDeUna(form, q, opcion)
        if (transformada === 'estilo') {
          valorDe.set(opcion, p.brand_style)
          if (p.style_unmapped || !ESTILOS_VALIDOS.includes(p.brand_style)) {
            malas.push(`${opcion} -> ${p.brand_style}${p.style_unmapped ? ' (FALLBACK)' : ''}`)
          } else {
            destino.brand_style = [...new Set([...(destino.brand_style || []), q.title])]
          }
        } else if (transformada === 'cta') {
          valorDe.set(opcion, p.primary_cta)
          if (!p.primary_cta) malas.push(`${opcion} -> (vacío: el botón elegido se pierde)`)
          else destino.primary_cta = [q.title]
        }
      }

      // Dos opciones distintas que producen el MISMO valor. Un valor puede ser
      // válido y aun así estar mal: el bug de 'sunny-paws' del 2026-07-25 daba
      // warm-sand —un estilo real— para las cuatro opciones, y el cliente que
      // eligió por color recibía la página de otro. Una opción que deja de
      // distinguirse de su vecina no se nota por el valor, solo por el choque.
      const porValor = new Map()
      for (const [opcion, valor] of valorDe) {
        if (!valor) continue
        porValor.set(valor, [...(porValor.get(valor) || []), opcion])
      }
      for (const [valor, opts] of porValor) {
        if (opts.length < 2) continue
        const clave = `${q.title}::${valor}`
        if (COLAPSOS.has(clave)) { colapsosVistos.add(clave); continue }
        malas.push(`${opts.join('  |  ')} -> TODAS a "${valor}": el cliente eligió y no cambió nada`)
      }
      const rotasEsperadas = (q.options || []).filter((o) => OPCIONES_ROTAS.has(`${q.title}::${o}`))
      const inesperadas = malas.filter((m) => !rotasEsperadas.some((o) => m.startsWith(`${o} ->`)))
      for (const o of rotasEsperadas) {
        if (malas.some((m) => m.startsWith(`${o} ->`))) rotasVistas.add(`${q.title}::${o}`)
        else sanadas.push(`${q.title}::${o} ya mapea — quita su entrada de OPCIONES_ROTAS`)
      }
      check(`[${form.lang}] «${q.title}»: sus ${q.options?.length || 0} opciones mapean` +
        (rotasEsperadas.length ? ` (${rotasEsperadas.length} fichada(s) al motor)` : ''),
        inesperadas.length === 0, inesperadas.join('\n         '))
      continue
    }

    const p = payloadDeUna(form, q, CENTINELA)
    const campo = campoQueRecibe(p, CENTINELA)
    if (campo) {
      destino[campo] = [...(destino[campo] || []), q.title]
      if (NO_VIAJAN.has(q.title)) {
        sinRazon.push(`«${q.title}» está en NO_VIAJAN pero SÍ llega a ${campo} — quita la excepción`)
      }
    } else if (!NO_VIAJAN.has(q.title)) {
      perdidas.push(`«${q.title}»  <${q.type}>  id=${q.id}`)
    }
  }

  check(`[${form.lang}] toda pregunta viva llega a un payload o tiene su razón escrita`,
    perdidas.length === 0,
    'preguntas cuya respuesta NO llega a ningún campo del payload — el título dejó de\n' +
    '         casar con la clave que lee el worker, o la pregunta está muerta:\n         ' +
    perdidas.join('\n         '))

  check(`[${form.lang}] ninguna excepción de NO_VIAJAN sobra`, sinRazon.length === 0,
    sinRazon.join('\n         '))

  const colisiones = Object.entries(destino).filter(([, qs]) => qs.length > 1)
  const nuevas = colisiones.filter(([campo]) => !COLISIONES.has(campo))
  check(`[${form.lang}] sin colisiones nuevas (2 preguntas al mismo campo)`, nuevas.length === 0,
    nuevas.map(([c, qs]) => `${c} <- ${qs.join('  |  ')}`).join('\n         '))

  // El idioma es la tercera lista cerrada de esta vertical, y la única que no se
  // pregunta: PawContact NO tiene pregunta de idioma (decisión escrita en
  // tally_form.yaml), así que el worker lo deriva de QUÉ formulario se llenó. Si
  // esa derivación se rompe, un cliente mexicano recibe su página en inglés y
  // nada más lo avisa.
  const sinIdioma = payloadDeUna(form, form.questions[0], CENTINELA)
  check(`[${form.lang}] sin pregunta de idioma, el worker lo deriva del formulario`,
    sinIdioma.default_language === form.lang,
    `formulario ${form.form_id} (${form.lang}) -> default_language="${sinIdioma.default_language}"`)

  camposPorForm[form.lang] = Object.keys(destino).sort()
}

// Las dos versiones del formulario tienen que alimentar EXACTAMENTE los mismos
// campos: si una divergencia se cuela, un cliente recibe menos página por haber
// llenado el formulario en su idioma.
const soloEN = camposPorForm.en.filter((c) => !camposPorForm.es.includes(c))
const soloES = camposPorForm.es.filter((c) => !camposPorForm.en.includes(c))
console.log('')
check('EN y ES alimentan los mismos campos del payload',
  soloEN.length === 0 && soloES.length === 0,
  `solo EN: ${soloEN.join(', ') || '—'}\n         solo ES: ${soloES.join(', ') || '—'}`)

// El espejo: campos que el worker construye y ninguna pregunta alimenta.
const plantilla = payloadDeUna(enForm, enForm.questions[0], CENTINELA)
const huerfanos = Object.keys(plantilla)
  .filter((c) => !camposPorForm.en.includes(c))
  .filter((c) => !SIN_PREGUNTA.has(c))
check('sin campos del payload que ninguna pregunta viva alimente', huerfanos.length === 0,
  'el worker construye estos campos y el formulario vivo ya no los pregunta:\n         ' +
  huerfanos.join(', '))

check('ninguna opción de OPCIONES_ROTAS ya está arreglada', sanadas.length === 0,
  sanadas.join('\n         '))

const colapsosMuertos = [...COLAPSOS.keys()].filter((c) => !colapsosVistos.has(c))
check('ningún colapso declarado ya dejó de ocurrir', colapsosMuertos.length === 0,
  `esas opciones ya dan valores distintos — quita su entrada de COLAPSOS: ${colapsosMuertos.join(', ')}`)

if (rotasVistas.size) {
  console.log(`\n  ⚠ ${rotasVistas.size} OPCIÓN(ES) VIVA(S) QUE SE CAEN EN SILENCIO — fichadas al MOTOR:`)
  for (const clave of rotasVistas) console.log(`      · ${clave}\n          ${OPCIONES_ROTAS.get(clave)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// DESFASE spec ↔ vivo. La otra mitad del candado: que un cambio escrito en
// tally_form.yaml y nunca aplicado en Tally deje de ser invisible.
//
// Se compara lo que se puede comparar sin interpretar: qué preguntas existen
// (por `name`) y con qué TÍTULO VISIBLE y qué TIPO. El yaml se lee con un
// parser mínimo a propósito — meter una dependencia de YAML para tres campos
// sería pagar mantenimiento por nada.
// ─────────────────────────────────────────────────────────────────────────────
function specDelYaml() {
  const txt = readFileSync(SPEC, 'utf8')
  const preguntas = []
  let actual = null
  let enTitulo = false
  const push = () => { if (actual) preguntas.push(actual) }
  for (const linea of txt.split(/\r?\n/)) {
    const m = linea.match(/^ {2}- id:\s*(\S+)/)
    if (m) { push(); actual = { id: m[1], name: '', type: '', title: {} }; enTitulo = false; continue }
    if (!actual) continue
    if (/^ {2}\S/.test(linea)) { push(); actual = null; continue }   // se acabó la lista
    const name = linea.match(/^ {4}name:\s*(\S+)/)
    if (name) { actual.name = name[1]; enTitulo = false; continue }
    const type = linea.match(/^ {4}type:\s*(\S+)/)
    if (type) { actual.type = type[1]; enTitulo = false; continue }
    // title en una línea: `title: {es: "…", en: "…"}`
    const inline = linea.match(/^ {4}title:\s*\{(.+)\}\s*$/)
    if (inline) {
      for (const par of inline[1].matchAll(/(es|en):\s*"((?:[^"\\]|\\.)*)"/g)) actual.title[par[1]] = par[2]
      enTitulo = false
      continue
    }
    if (/^ {4}title:\s*$/.test(linea)) { enTitulo = true; continue }
    if (enTitulo) {
      const par = linea.match(/^ {6}(es|en):\s*"((?:[^"\\]|\\.)*)"\s*$/)
      if (par) { actual.title[par[1]] = par[2]; continue }
      enTitulo = false
    }
    if (/^ {4}\S/.test(linea)) enTitulo = false
  }
  push()
  return preguntas.filter((q) => q.name)
}

// El tipo del spec (vocabulario del generador de formularios) y el tipo que
// reporta Tally son dos vocabularios distintos; esta tabla los empareja.
const TIPO_SPEC_A_TALLY = {
  text: 'INPUT_TEXT',
  textarea: 'TEXTAREA',
  phone: 'INPUT_PHONE_NUMBER',
  email: 'INPUT_EMAIL',
  link: 'INPUT_LINK',
  dropdown: 'DROPDOWN',
  file: 'FILE_UPLOAD',
  checkboxes: 'CHECKBOXES',
}

console.log('\n─── DESFASE spec (tally_form.yaml) ↔ formulario vivo')

const spec = specDelYaml()
check(`el spec se leyó completo (${spec.length} preguntas con \`name\`)`, spec.length > 20,
  `solo ${spec.length} — revisa el parser mínimo de specDelYaml()`)

const desfases = []
for (const form of snapshot.forms) {
  const vivoPorName = new Map(form.questions.map((q) => [q.title, q]))
  for (const s of spec) {
    const vivo = vivoPorName.get(s.name)
    if (!vivo) { desfases.push([s.name, `[${form.lang}] el spec la pide y el formulario vivo NO la tiene`]); continue }
    const tituloSpec = s.title[form.lang]
    if (tituloSpec && vivo.title_editor && tituloSpec !== vivo.title_editor) {
      desfases.push([s.name, `[${form.lang}] título · spec: «${tituloSpec}» · vivo: «${vivo.title_editor}»`])
    }
    const tipoSpec = TIPO_SPEC_A_TALLY[s.type]
    if (tipoSpec && tipoSpec !== vivo.type) {
      desfases.push([s.name, `[${form.lang}] tipo · spec: ${s.type} (${tipoSpec}) · vivo: ${vivo.type}`])
    }
  }
  const nombresSpec = new Set(spec.map((s) => s.name))
  for (const q of form.questions) {
    if (!nombresSpec.has(q.title)) {
      desfases.push([q.title, `[${form.lang}] el formulario vivo la pregunta y el spec ya NO la declara`])
    }
  }
}

const nuevos = desfases.filter(([name]) => !DESFASES_CONOCIDOS.has(name))
check('sin desfases NUEVOS entre el spec y el formulario vivo', nuevos.length === 0,
  'el spec cambió y el formulario de Tally no (o al revés). Cada uno necesita una\n' +
  '         entrada en DESFASES_CONOCIDOS con quién actúa, o aplicarse en Tally:\n         ' +
  nuevos.map(([n, d]) => `${n}: ${d}`).join('\n         '))

const conocidosVivos = new Set(desfases.filter(([n]) => DESFASES_CONOCIDOS.has(n)).map(([n]) => n))
const yaResueltos = [...DESFASES_CONOCIDOS.keys()].filter((n) => !conocidosVivos.has(n))
check('ningún desfase de la lista de conocidos ya está resuelto', yaResueltos.length === 0,
  `ya coinciden spec y vivo — quita su entrada de DESFASES_CONOCIDOS: ${yaResueltos.join(', ')}`)

if (conocidosVivos.size) {
  console.log(`\n  ⚠ ${conocidosVivos.size} DESFASES PENDIENTES DE CONSOLA (acción de Vero en Tally,`)
  console.log('    no se arreglan desde este repo):')
  for (const name of conocidosVivos) {
    console.log(`      · ${name} — ${DESFASES_CONOCIDOS.get(name)}`)
    for (const [n, d] of desfases) if (n === name) console.log(`          ${d}`)
  }
}

console.log(fallos === 0 ? '\n  TODO VERDE\n' : `\n  ${fallos} FALLAS\n`)
process.exit(fallos === 0 ? 0 : 1)
