import { readFileSync, existsSync } from 'node:fs'
import mysql from 'mysql2/promise'

// Carga .env.local sin imprimir secretos
if (existsSync('.env.local')) {
  for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}
const url = process.env.DATABASE_URL
if (!url) { console.error('Falta DATABASE_URL'); process.exit(1) }
try {
  const u = new URL(url)
  console.log(`Destino: ${u.hostname}:${u.port || 3306} bd=${u.pathname.slice(1)}`)
  const conn = await mysql.createConnection({ uri: url, connectTimeout: 10000 })
  const [rows] = await conn.query('SELECT VERSION() AS v')
  console.log('Conecta. MySQL', rows[0].v)
  await conn.end()
} catch (e) {
  console.error('NO conecta:', e.code, '-', e.message.replace(/\/\/[^@]*@/, '//***@'))
  process.exit(1)
}
