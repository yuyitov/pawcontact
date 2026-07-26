# Pruebas de PawContact

```bash
node worker/test/run_all.mjs
```

Corren offline: no salen a la red, no mandan correo y no tocan Tally ni KV.
Necesitan `node` y `python` (el que ya pide el generador).

| Archivo | Qué afirma |
|---|---|
| `form-field-coverage.test.mjs` | Cada pregunta de los **formularios vivos** de Tally (EN `zxo55M` · ES `0QyRRB`) llega a algún campo del payload público, o tiene su razón escrita. Además: las listas cerradas que decide el worker (estilo y botón principal), la derivación del idioma, y el **desfase entre `tally_form.yaml` y el formulario vivo**. |
| `generator-closed-lists.test.mjs` | Las tres listas cerradas que NO decide el worker sino el generador en Python (`primary_cta`, `price_display`, `business_type`): cada opción viva produce una categoría válida, y dos opciones distintas no colapsan en la misma. |

## Por qué existen

Aquí nació el bug del `PLAN_CERO_REGRESIONES_2026-07-26.md`. La primera prueba
final de Vero —una compra real de $1 con un negocio real— destapó que el worker
tiraba **11 de 17 campos en silencio**: los alias mapean por TÍTULO de pregunta,
y este formulario declara un `name:` estable en cada pregunta, así que Tally
manda el NOMBRE y no el título. Los tests seguían verdes porque ninguno
comparaba el formulario VIVO contra lo que el worker lee.

La ironía que conviene recordar: HMU se salvó porque su formulario está hecho a
mano y sin `name`. El bug pegó justo en los productos cuyo formulario se generó
BIEN.

## Las dos mitades del candado

**Cobertura** (formulario vivo → payload). Para cada pregunta viva se arma un
webhook de Tally con un valor centinela y se afirma que el centinela sale del
otro lado. Una pregunta que no llega y no está en `NO_VIAJAN` —con su razón
escrita— es un campo perdido.

**Desfase** (spec ↔ formulario vivo). `tally_form.yaml` dice qué DEBE preguntar
el formulario; el formulario de Tally dice qué pregunta. Cuando se separan hay
un cambio pendiente **en la consola de Tally**, que no se arregla editando este
repo. Cada desfase conocido va en `DESFASES_CONOCIDOS` con quién actúa; uno
nuevo es una falla.

> ⚠️ **Cómo NO medirlo.** La cobertura se mide contra el formulario **VIVO**, por
> la API de Tally — **nunca** contra `tally_form.yaml`. Ese archivo es la
> especificación, y el formulario vivo puede haberse quedado atrás (el 2026-07-26
> pasó justamente eso con varias correcciones de la Fase 2). Medir el spec y
> creerle da falsos positivos a montones: es exactamente el error que trajo el
> plan de cero regresiones. Una **diferencia** entre el spec y el vivo sí es un
> hecho, y por eso tiene su propia sección — pero no sustituye a medir el vivo.

## Listas de excepciones — cómo se usan

Cada una existe para que "no llega" y "no debe llegar" no se confundan. Una
entrada sin razón escrita no sirve de nada.

| Lista | Dónde | Qué guarda |
|---|---|---|
| `NO_VIAJAN` | cobertura | Preguntas que a propósito no salen a la página (hoy: el consentimiento de derechos de imagen). |
| `OPCIONES_ROTAS` / `ROTAS` | ambas | Opciones vivas que hoy se caen en silencio, **fichadas al motor** con el efecto que producen. |
| `COLAPSOS` | ambas | Dos opciones distintas que a propósito dan el mismo valor. |
| `COLISIONES` | cobertura | Dos preguntas vivas que alimentan el mismo campo. |
| `SIN_PREGUNTA` | cobertura | Campos que el motor construye y este formulario no pregunta. |
| `DESFASES_CONOCIDOS` | cobertura | Diferencias spec ↔ vivo pendientes de consola. |

Las pruebas también fallan **al revés**: si una entrada de esas listas deja de
aplicar (la opción ya mapea, el desfase ya se resolvió), lo dicen y piden que se
quite. Una lista de excepciones que nadie poda deja de ser un candado.

## `fixtures/tally_forms_questions.json`

Inventario de las preguntas de los **dos formularios vivos**: ids, tipos,
títulos y el texto de cada opción. Cero respuestas, cero datos de clientes.

En este formulario **todas** las preguntas declaran `name`, así que el `title`
del inventario es el nombre estable (lo que manda el webhook) y `title_editor`
es lo que el cliente LEE. Los dos importan: el primero es lo que el worker
casa, el segundo es lo que se compara contra el spec.

### Cuando cambie un formulario de Tally

Hay que volver a tomar el snapshot. Necesita `TALLY_API_KEY` en el entorno:

```bash
node worker/test/tomar_snapshot.mjs
```

Reescribe `fixtures/tally_forms_questions.json` con lo que Tally responda hoy.
Si el cambio rompió el mapeo, `form-field-coverage.test.mjs` lo dice con el
nombre exacto de la pregunta que dejó de llegar.

El snapshot mezcla dos endpoints, porque ninguno trae todo:

- `GET /forms/<id>/submissions` → `questions[]` — id, tipo y **título tal como lo
  manda el webhook**. Es la autoridad.
- `GET /forms/<id>` → `blocks[]` — el **texto de cada opción** y el título que ve
  el cliente, que el endpoint de submissions devuelve en `null`.

Se emparejan **por orden**, no por título, precisamente porque el título es el
`name`.

## Probado por mutación (2026-07-26)

Un candado que nunca se vio fallar no es un candado. Cada mutación se aplicó al
código real, se corrió la suite y se revirtió:

| # | Mutación | ¿Lo cazó? |
|---|---|---|
| M1 | El worker deja de agregar el nombre canónico a los alias — **el bug del 07-26 exacto** | Sí: 17 preguntas perdidas por formulario (servicios, whatsapp, teléfono, dirección, horarios, FAQ…) |
| M2 | Tally renombra una pregunta viva (`services_text` → `services_list`) | Sí: pregunta perdida + campo huérfano + desfase nuevo |
| M3 | Alguien agrega al formulario un estilo que no está en `VALID_BRAND_STYLES` | Sí: `midnight-ink → warm-sand (FALLBACK)` |
| M4 | El spec cambia un título y nadie lo aplica en Tally | Sí: desfase nuevo, con los dos textos |
| M5 | Se rompe la derivación del idioma (el form ES apunta a otro id) | Sí: `0QyRRB (es) → default_language="en"` |
| M6 | El generador pierde el alias `sitio_web` del botón | Sí: «Sitio web» → (nada) |
| M7 | El generador deja de entender «No mostrar precios» | **Al principio NO** — el valor caía en `show`, que es válido. Se agregó la detección de colapsos y ahora sí |
| M8 | Vuelve el bug de `sunny-paws` (el guion normal como separador) | Sí: las 4 opciones a `warm-sand (FALLBACK)` |
| M9 | Dos estilos vivos distintos dan el mismo estilo válido | Sí: «TODAS a "sunny-paws"» |

M7 es la que vale la pena recordar: un valor puede ser **válido y aun así estar
mal**. Sin la detección de colapsos, la prueba habría firmado en verde un
formulario donde elegir «No mostrar precios» publicaba los precios.
