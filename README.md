# PawContact — Service Menu App

> Exportado de la Link Factory (`scripts/export_vertical.py`, vertical
> `pawcontact`). No edites `generator/`, `worker/worker.js`,
> `worker/product-config.mjs` ni `worker/stripe-filter.mjs` a mano: son el
> motor compartido — corregí en el repo de la fábrica y bajá el fix con
> `--engine-only` (**nunca** `--force`: borra este repo entero, con
> `data/clients` y `wrangler.toml`). La tienda se baja aparte con
> `--store-only`. Reglas completas del repo: `CLAUDE.md`.
> `vertical.yaml`, `data/`, `worker/wrangler.toml` y los workflows sí son
> propios de este repo (podés versionarlos con sus propios cambios, p. ej.
> el dominio real o los ids de infra de Etapa B).

## Layout

- `generator/` — motor Python (idéntico al de la fábrica; rutas aplanadas a
  este repo, sin `verticals/<id>/` ni `LINK_FACTORY_VERTICAL`).
- `vertical.yaml` — marca, dominio, estilos, strings, bloques.
- `data/demos/*.json` — payloads de demo. `data/clients/*.json` — clientes
  reales (vacío hasta el primer intake).
- `public/demos/`, `public/links/` — HTML generado (regenéralo con el
  comando de abajo; no lo edites a mano).
- `worker/` — Cloudflare Worker. `wrangler.toml` ya tiene `WORKER_NAME`,
  `PRODUCT_ID`, `BRAND_NAME`, `VALID_BRAND_STYLES` (desde `styles.catalog`) y
  `GITHUB_ACTIONS_EVENT`; el resto de los placeholders `{...}` (KV namespace,
  Payment Link de Stripe, URLs de los forms de Tally, dominio del worker, etc.)
  los llena Etapa B. `tally-field-aliases.json` es la copia editable del mapeo
  de intake de esta vertical (validala con `create_tally_forms.py
  --check-mapping` antes de crear los forms de Tally).
- `.github/workflows/generate-pawcontact-page.yml` — genera la página al
  recibir el evento `new-pawcontact-service-menu` (lo dispara el Worker
  tras un pago validado).

## Cómo regenerar

```powershell
pip install -r requirements.txt
python generator/generate_service_menu.py
```

## Antes de desplegar infra real

Este export cubre la Etapa A del runbook (local, gratis, sin aprobación).
Para pasar a producción real (repo de GitHub propio, dominio, Cloudflare
Worker + KV, Stripe, Tally, SendGrid) seguí `docs/RUNBOOK_LANZAMIENTO.md`
§ Etapa B en el repo de la fábrica — nada de eso se hizo automáticamente.
