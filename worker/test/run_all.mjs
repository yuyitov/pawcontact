/**
 * La suite de PawContact.
 *
 *   node worker/test/run_all.mjs
 *
 * Corre offline: no sale a la red, no manda correo y no toca Tally ni KV. Lo
 * único que sale a internet es `tomar_snapshot.mjs`, y se corre a mano.
 */
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))

const PRUEBAS = [
  'form-field-coverage.test.mjs',
  'generator-closed-lists.test.mjs',
]

let fallidas = 0
for (const prueba of PRUEBAS) {
  try {
    execFileSync(process.execPath, [join(AQUI, prueba)], { stdio: 'inherit' })
  } catch {
    fallidas++
  }
}

console.log(fallidas === 0
  ? `\n═══ ${PRUEBAS.length}/${PRUEBAS.length} pruebas verdes\n`
  : `\n═══ ${fallidas} de ${PRUEBAS.length} pruebas FALLARON\n`)
process.exit(fallidas === 0 ? 0 : 1)
