# El consentimiento de derechos de fotos — medición, dictamen y estado

> DICTAMEN 2026-07-27 (Fase 3.5, ficha `pawcontact/6`). Este documento existe
> porque el dictamen vivía como comentarios dentro de
> `worker/test/form-field-coverage.test.mjs` y dos reescrituras legítimas de
> ese archivo (el re-export del motor y el anclaje de los formularios nuevos)
> lo borraron. Lo cazó `verificar-pendientes.py --rapido` el 2026-07-28 como
> 🔴 FALSO CERRADO. **La documentación de un consentimiento no vive en
> archivos que el motor reescribe** — vive aquí.

## Lo medido (KV real, solo lectura, 2026-07-27)

- Los 3 submissions vivos de PawContact SÍ contienen la respuesta del
  consentimiento en el blob crudo. Dos bajo el name estable
  `photo_rights_confirmed`; el del 07-18 bajo la clave derivada del título
  (anterior al recableado de names). **Al buscar evidencia vieja se busca por
  TODAS las formas históricas de la clave.**
- Los blobs expiran (TTL 90 días: 16, 19 y 24 de octubre de 2026). Las
  páginas que publican las fotos son permanentes.
- Los 3 submissions son compras de prueba de la propia Vero — no hay
  consentimiento de cliente real en riesgo (hecho base `charly/30`).

## El dictamen

**La evidencia de un consentimiento no puede expirar antes que el uso que
ampara** (regla 21 del playbook). El blob de KV NO basta como prueba única.
Conservar el blob entero para siempre sería peor (trae datos privados):
**viaja el dato mínimo al registro permanente.**

## Estado: EJECUTADO

- `linkFactory/16` + `linkFactory/17`: el campo se declara en el mapa de
  alias Y en `intake.fields` — «Sí»/«Yes» → `true` en el `client.json`
  permanente; con la casilla en blanco NO llega (un default regalaría
  consentimientos que nadie dio). Probado por mutación en las dos puertas.
- La evidencia de los 3 submissions previos quedó preservada ANTES de su
  expiración en `..\consentimientos-kv\` — **fuera de git a propósito** (este
  repo es público y el archivo trae correos). Esa carpeta no se borra.
- Decisión de Vero (1a, 2026-07-27): el consentimiento será **OBLIGATORIO**
  (`require_true`) — se ejecuta en la Fase 3.9 junto con el backfill de los
  client.json de prueba. Ficha `pawcontact/7`, sellada.
