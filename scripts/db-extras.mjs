// Aplica prisma/sql/extras.sql (CHECK, triggers y vistas) sobre MySQL.
// Interpreta DELIMITER para poder enviar cada sentencia por separado.
import './_env.mjs'
import { readFileSync } from 'node:fs'
import mysql from 'mysql2/promise'
import { raiz } from './_env.mjs'
import { join } from 'node:path'

export function dividirSQL(texto) {
  const sentencias = []
  let delim = ';'
  let acum = ''
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(/^\s*DELIMITER\s+(\S+)\s*$/i)
    if (m) { delim = m[1]; continue }
    if (/^\s*--/.test(linea) && !acum.trim()) continue // comentario suelto
    acum += linea + '\n'
    if (acum.trimEnd().endsWith(delim)) {
      const s = acum.trimEnd().slice(0, -delim.length).trim()
      if (s) sentencias.push(s)
      acum = ''
    }
  }
  if (acum.trim()) sentencias.push(acum.trim())
  return sentencias
}

export async function aplicarExtras() {
  const sentencias = dividirSQL(readFileSync(join(raiz, 'prisma/sql/extras.sql'), 'utf8'))
  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 15000 })
  let aplicadas = 0
  let yaExistian = 0
  const triggersPendientes = []
  try {
    for (const s of sentencias) {
      try {
        await conn.query(s)
        aplicadas++
      } catch (e) {
        if (e.errno === 3822) yaExistian++ // el CHECK ya existe: el script es repetible
        else if (e.errno === 1419) triggersPendientes.push(s.match(/TRIGGER\s+(\w+)/)?.[1]) // sin SUPER y con binlog activo
        else throw new Error(`${e.code}: ${e.message}\n--> ${s.slice(0, 120)}`, { cause: e })
      }
    }
  } finally {
    await conn.end()
  }
  return { aplicadas, yaExistian, triggersPendientes }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const r = await aplicarExtras()
  console.log(`extras.sql: ${r.aplicadas} sentencias aplicadas, ${r.yaExistian} CHECK ya existían`)
  if (r.triggersPendientes.length) console.warn(`AVISO: no se pudieron crear los triggers (${r.triggersPendientes.join(', ')}): el servidor tiene binlog activo y el usuario no tiene SUPER. El administrador debe ejecutar SET GLOBAL log_bin_trust_function_creators = 1; y luego repetir npm run db:extras. Mientras tanto la app aplica esas reglas en código.`)
}
