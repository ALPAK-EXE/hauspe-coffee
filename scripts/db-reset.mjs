// npm run db:reset → recrea todo: tablas (prisma db push), extras.sql (CHECK, triggers, vistas) y seed.
// ¡Borra los datos de la base a la que apunta DATABASE_URL!
import './_env.mjs'
import { spawnSync } from 'node:child_process'
import mysql from 'mysql2/promise'
import { aplicarExtras } from './db-extras.mjs'

const paso = (t) => console.log(`\n== ${t}`)
const prisma = (...args) => {
  const r = spawnSync('npx', ['prisma', ...args], { stdio: 'inherit', shell: true, env: process.env })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

const u = new URL(process.env.DATABASE_URL)
console.log(`Base destino: ${u.hostname}:${u.port || 3306}/${u.pathname.slice(1)}`)

paso('1/4 Quitando vistas y triggers anteriores')
const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL })
const [vistas] = await conn.query("SELECT table_name AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'VIEW'")
for (const v of vistas) await conn.query(`DROP VIEW IF EXISTS \`${v.n}\``)
const [trg] = await conn.query('SELECT trigger_name AS n FROM information_schema.triggers WHERE trigger_schema = DATABASE()')
for (const t of trg) await conn.query(`DROP TRIGGER IF EXISTS \`${t.n}\``)
await conn.end()

paso('2/4 Tablas con Prisma (db push --force-reset)')
prisma('db', 'push', '--force-reset', '--accept-data-loss', '--skip-generate')

paso('3/4 CHECK, triggers y vistas (prisma/sql/extras.sql)')
const r = await aplicarExtras()
console.log(`${r.aplicadas} sentencias aplicadas.`)
if (r.triggersPendientes.length) {
  console.warn(`AVISO: triggers sin crear (${r.triggersPendientes.length}): el servidor exige SUPER o log_bin_trust_function_creators=1. La app aplica esas reglas en código.`)
}

paso('4/4 Datos de ejemplo (prisma db seed)')
prisma('db', 'seed')
