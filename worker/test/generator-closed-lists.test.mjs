/**
 * LISTAS CERRADAS QUE DECIDE EL GENERADOR (Fase 3.5) — la mitad que el worker
 * no puede ver.
 *
 * `form-field-coverage.test.mjs` prueba que cada opción viva produzca un valor
 * en el PAYLOAD del worker. Pero dos de las listas cerradas de PawContact
 * viajan al payload como texto tal cual y las decide después el generador, en
 * Python:
 *
 *   primary_cta     -> build_client_from_intake.normalize_primary_cta
 *   business_type   -> build_client_from_intake.normalize_business_type
 *
 * Una prueba que solo mire el worker las da por buenas y se equivoca: la opción
 * «Instagram» del botón principal SÍ sale del worker y muere aquí. Ese es el
 * hueco que esta prueba cierra.
 *
 * Se mide contra las opciones del FORMULARIO VIVO (el mismo inventario que la
 * otra prueba), en los DOS idiomas, y llamando a las funciones REALES del
 * generador — no a una copia. Necesita `python` en el PATH: el repo ya lo
 * necesita para generar páginas, y un "salta si no hay python" en verde sería
 * la misma firma sobre estructura que trajo este plan.
 *
 *   node worker/test/generator-closed-lists.test.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT = join(AQUI, 'fixtures', 'tally_forms_questions.json')
const PUENTE = join(AQUI, 'normalizadores_del_generador.py')

// Qué es un valor VÁLIDO para cada lista. No basta con "no vacío": el generador
// tiene categorías cerradas, y un valor fuera de ellas se comporta como si no
// se hubiera contestado.
//
// primary_cta: las que _contact_options del generador sabe pintar. `booking` y
// `website` están porque el formulario las ofrece; `instagram` también, y por
// eso se nota que hoy no llega.
//
const VALIDOS = {
  primary_cta: ['whatsapp', 'phone', 'booking', 'website', 'instagram', 'facebook', 'tiktok', 'email', 'other', 'maps'],
  business_type: ['food', 'fitness', 'tours', 'pets', 'creative', 'wellness', 'beauty', 'professional', 'retail', 'general'],
}

// Opciones vivas que HOY no producen un valor válido, cada una FICHADA con su
// razón y dónde vive el arreglo. Clave: `<lista>::<texto exacto de la opción>`.
// Una opción rota que no esté aquí es una falla.
//
// VACÍO desde el 2026-07-27. Tenía las 3 opciones del botón principal que se
// caían en silencio ("Booking link", "Reservas / agenda" e "Instagram"), y las
// tres tenían la misma causa: la tabla de alias del CTA estaba COPIADA en
// worker.js, en build_client_from_intake.py y en generate_service_menu.py, y
// las copias no decían lo mismo. Arreglar una sola dejaba la opción rota igual.
// El motor la volvió dato (`worker/primary-cta-aliases.json`, linkFactory/8 y
// /9) y las tres consumen esa. El arreglo llegó a este repo con el re-export de
// linkFactory/12 — hasta ese día seguía vivo aquí aunque en el motor estuviera
// cerrado, que es justo la deuda que esa ficha medía.
const ROTAS = new Map([])

// Dos opciones VIVAS que a propósito caen en la MISMA categoría, con su razón.
// Clave: `<lista>::<categoría resultante>`. Sin esta lista, un normalizador que
// deja de distinguir dos opciones pasa desapercibido: el valor sigue siendo
// válido, solo que ya no es el que el cliente eligió. Es la forma exacta del bug
// de 'sunny-paws' (2026-07-25), donde las 4 opciones de estilo daban la misma
// página y todas eran "válidas".
const COLAPSOS = new Map([
  ['business_type::pets',
   'A PROPÓSITO y documentado en tally_form.yaml: estética canina y veterinaria caen las dos ' +
   'en "pets". La categoría solo gatea bloques cosméticos, y para PawContact "pets" no gatea ' +
   'nada por sí misma; portfolio está apagado para toda la vertical. Distinguirlas no cambiaría ' +
   'ninguna página.'],
])

let fallos = 0
function check(nombre, ok, detalle = '') {
  console.log(`  ${ok ? 'ok  ' : 'FALLA'}  ${nombre}${ok || !detalle ? '' : `\n         ${detalle}`}`)
  if (!ok) fallos++
}

function normalizaConElGenerador(opciones) {
  const salida = execFileSync('python', [PUENTE], {
    input: JSON.stringify({ opciones }),
    encoding: 'utf8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  })
  return JSON.parse(salida)
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'))

console.log('\nLISTAS CERRADAS DEL GENERADOR (PawContact)')
console.log(`  opciones del formulario vivo, inventario del ${snapshot.snapshot_date}\n`)

const rotasVistas = new Set()
const colapsosVistos = new Set()
const sanadas = []

for (const form of snapshot.forms) {
  console.log(`─── ${form.form_name} (${form.form_id})`)

  const opciones = {}
  for (const q of form.questions) {
    if (VALIDOS[q.title] && q.options?.length) opciones[q.title] = q.options
  }

  check(`[${form.lang}] el formulario vivo trae las 2 listas cerradas del generador`,
    Object.keys(opciones).length === Object.keys(VALIDOS).length,
    `encontradas: ${Object.keys(opciones).join(', ') || '—'}`)

  const resultado = normalizaConElGenerador(opciones)

  for (const [lista, textos] of Object.entries(opciones)) {
    const malas = []
    const porValor = new Map()
    for (const texto of textos) {
      const valor = resultado[lista]?.[texto] ?? null
      const ok = valor !== null && VALIDOS[lista].includes(valor)
      const clave = `${lista}::${texto}`
      if (ok && ROTAS.has(clave)) sanadas.push(`${clave} ya mapea — quita su entrada de ROTAS`)
      if (ok) porValor.set(valor, [...(porValor.get(valor) || []), texto])
      if (ok) continue
      if (ROTAS.has(clave)) { rotasVistas.add(clave); continue }
      malas.push(`«${texto}» -> ${valor === null ? '(nada: la elección se pierde)' : valor}`)
    }

    for (const [valor, opts] of porValor) {
      if (opts.length < 2) continue
      const clave = `${lista}::${valor}`
      if (COLAPSOS.has(clave)) { colapsosVistos.add(clave); continue }
      malas.push(`${opts.join('  |  ')} -> TODAS a "${valor}": el cliente eligió y no cambió nada`)
    }
    const fichadas = textos.filter((t) => ROTAS.has(`${lista}::${t}`)).length
    check(`[${form.lang}] «${lista}»: sus ${textos.length} opciones dan una categoría válida` +
      (fichadas ? ` (${fichadas} fichada(s) al motor)` : ''),
      malas.length === 0, malas.join('\n         '))
  }
  console.log('')
}

check('ninguna opción de ROTAS ya está arreglada', sanadas.length === 0, sanadas.join('\n         '))

const colapsosMuertos = [...COLAPSOS.keys()].filter((c) => !colapsosVistos.has(c))
check('ningún colapso declarado ya dejó de ocurrir', colapsosMuertos.length === 0,
  `esas opciones ya dan categorías distintas — quita su entrada de COLAPSOS: ${colapsosMuertos.join(', ')}`)

if (rotasVistas.size) {
  console.log(`\n  ⚠ ${rotasVistas.size} OPCIÓN(ES) VIVA(S) QUE SE CAEN EN SILENCIO — fichadas al MOTOR:`)
  for (const clave of rotasVistas) console.log(`      · ${clave}\n          ${ROTAS.get(clave)}`)
}

console.log(fallos === 0 ? '\n  TODO VERDE\n' : `\n  ${fallos} FALLAS\n`)
process.exit(fallos === 0 ? 0 : 1)
