// Carga .env.local (o .env) en process.env sin imprimir ni sobrescribir nada.
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
for (const nombre of ['.env.local', '.env']) {
  const ruta = resolve(raiz, nombre)
  if (!existsSync(ruta)) continue
  for (const l of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}
export { raiz }
