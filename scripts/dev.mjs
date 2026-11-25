// npm run dev → levanta la API local (scripts/dev-api.mjs) y Vite juntos.
import { spawn } from 'node:child_process'

const hijos = [
  spawn(process.execPath, ['scripts/dev-api.mjs'], { stdio: 'inherit' }),
  spawn('npx', ['vite', ...process.argv.slice(2)], { stdio: 'inherit', shell: true }),
]
const cerrar = () => hijos.forEach((h) => h.kill())
process.on('SIGINT', cerrar)
process.on('SIGTERM', cerrar)
hijos.forEach((h) => h.on('exit', (c) => { cerrar(); process.exit(c ?? 0) }))
