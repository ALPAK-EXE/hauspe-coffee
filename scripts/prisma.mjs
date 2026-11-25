// Ejecuta la CLI de Prisma con las variables de .env.local (Prisma solo lee .env por defecto).
import './_env.mjs'
import { spawnSync } from 'node:child_process'
const r = spawnSync('npx', ['prisma', ...process.argv.slice(2)], { stdio: 'inherit', shell: true, env: process.env })
process.exit(r.status ?? 1)
