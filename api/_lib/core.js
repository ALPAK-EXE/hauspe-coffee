// Utilidades compartidas del servidor: dinero, hash SHA-256 y fechas.
import { createHash } from 'node:crypto'

export const IGV = 0.18
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
export const sha256 = async (texto) => createHash('sha256').update(texto).digest('hex')

// La base guarda las fechas en UTC; la app las muestra en hora de Perú (UTC-5, sin horario de verano).
const LIMA_MS = 5 * 3600 * 1000
const pad = (n) => String(n).padStart(2, '0')

/** Date → 'YYYY-MM-DD HH:MM:SS' en hora de Lima (el mismo formato que usaba la base local). */
export function fechaLima(d) {
  const x = new Date(d.getTime() - LIMA_MS)
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())} ${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}:${pad(x.getUTCSeconds())}`
}
/** Date de un día calendario (columnas DATE), según el calendario de Lima. */
export function dia(d = new Date()) {
  const x = new Date(d.getTime() - LIMA_MS)
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()))
}
/** Quita los milisegundos: DATETIME(0) no los guarda y el hash debe coincidir al verificar. */
export const aSegundos = (d = new Date()) => new Date(Math.floor(d.getTime() / 1000) * 1000)
export const sumarHoras = (d, h) => new Date(d.getTime() + h * 3600 * 1000)
export const sumarDias = (d, n) => sumarHoras(d, n * 24)

export const codigoPedido = () =>
  'HP-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0')

// Campos que son DATE (sin hora) en el modelo
const SOLO_FECHA = new Set(['inicio', 'fin', 'proximo_envio', 'fecha_cosecha', 'publicado_en'])

/** Convierte lo que devuelve Prisma (Decimal, BigInt, Date) a JSON simple, como en la base local. */
export function limpiar(v, clave) {
  if (v === null || v === undefined) return v ?? null
  if (v instanceof Date) return SOLO_FECHA.has(clave) ? v.toISOString().slice(0, 10) : fechaLima(v)
  if (typeof v === 'bigint') return Number(v)
  if (Array.isArray(v)) return v.map((x) => limpiar(x, clave))
  if (typeof v === 'object') {
    if (typeof v.toNumber === 'function' && 'd' in v) return v.toNumber() // Prisma.Decimal
    const out = {}
    for (const [k, x] of Object.entries(v)) out[k] = limpiar(x, k)
    return out
  }
  return v
}
