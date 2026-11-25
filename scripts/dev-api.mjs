// Servidor local de la API (mismo código que corre en Vercel). Escucha en el puerto 3001;
// el proxy de Vite envía /api → http://localhost:3001, así "npm run dev" funciona igual que en producción.
import './_env.mjs'
import { createServer } from 'node:http'

const { handler } = await import('../api/_lib/router.js')
const PUERTO = Number(process.env.API_PORT || 3001)

createServer((req, res) => handler(req, res)).listen(PUERTO, () => {
  console.log(`API HausPe en http://localhost:${PUERTO}/api  (DATABASE_URL ${process.env.DATABASE_URL ? 'cargada' : 'NO definida'})`)
})
