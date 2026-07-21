# PawContact — notas para Claude

Tarjeta digital para negocios de mascotas (estéticas, veterinarias, hoteles y
pensiones, entrenadores, boutiques) en México y Estados Unidos. **Vende solo**:
Stripe → correo post-pago → formulario de Tally → worker → GitHub Actions →
página publicada en `www.pawcontact.com/links/<slug>/`.

Es una vertical **exportada de la Link Factory**
(`Negocios Digitales\Fábrica de negocios digitales\link-factory`, vertical
`pawcontact`) y es la **vertical modelo**: la primera que nació de la fábrica y
la primera que se re-sincronizó con ella.

## Qué es motor y qué es de este repo

| Motor — se corrige en la FÁBRICA | De este repo — se edita aquí |
|---|---|
| `generator/**` | `vertical.yaml` (incluye la sección `legal:`) |
| `worker/worker.js`, `worker/product-config.mjs`, `worker/stripe-filter.mjs` | `worker/wrangler.toml` (secrets, plinks, vars) |
| `worker/tally-field-aliases.json` | `tally_form.yaml`, `data/**`, `.github/**` |
| `requirements.txt` | `public/**` (tienda y páginas publicadas) |

**Nunca** corras `export_vertical.py ... --force` sobre este repo: borra el repo
entero, con `data/clients` y el `wrangler.toml`. Para traer un fix del motor:

```powershell
# desde el repo de la fábrica
python scripts/export_vertical.py pawcontact --engine-only --output "C:\Users\veron\Negocios Digitales\PawContact\pawcontact"
python scripts/export_vertical.py pawcontact --store-only  --output "C:\Users\veron\Negocios Digitales\PawContact\pawcontact"   # solo la tienda
```

Los dos hacen backup de lo que sobrescriben (`.engine-only-backup/`,
`.store-only-backup/`, ambos ignorados por git). Después: revisá el diff,
regenerá las páginas (`python generator/generate_service_menu.py`) y verificá por
HTTP antes de commitear.

## Reglas de la casa

- **Primero el worker, después el push.** Si un cambio toca lo que el sitio
  promete y lo que el sistema entrega, se despliega el worker primero. Al revés
  queda una ventana donde los Términos prometen algo que no hacemos.
- **Nada se da por hecho sin verificarlo por HTTP** — `curl` a las rutas que
  tocaste y a `https://pawcontact-worker.veronica-perezarroyo.workers.dev/health`.
- **Secretos solo en `wrangler secret put` / GitHub secrets**, jamás en archivos.
- `public/links/**` son páginas de **clientes reales**: no se editan a mano ni se
  borran. Se regeneran desde `data/clients/*.json`.
- La tienda generada (landing, legales, `/correct/`) se corrige en
  `verticals/pawcontact/store.yaml` de la fábrica, **no** en el HTML publicado:
  el siguiente `--store-only` lo vuelve a pisar.

## Estado (2026-07-21)

Funcionalmente completo y vendiendo. Al día con el motor: 2 modificaciones
gratis, reembolso a 7 días, cláusula CFDI, QR en el correo de entrega, correo
post-pago bilingüe y el aviso de servicios regulados en el pie de cada página de
cliente.

Pendientes vivos: los de su área en
`Dashboard\business-dashboard\config\pendientes.json` (`"id": "pawcontact"`).
El tablero del portafolio es
`Negocios Digitales\CENTRO_DE_CONTROL.md` — toda sesión lo lee al empezar y lo
actualiza al cerrar.
