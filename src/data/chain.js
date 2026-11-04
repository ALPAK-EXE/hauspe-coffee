// Cadena de bloques simple por lote. Cada bloque guarda un SHA-256 (Web Crypto) que encadena
// el hash del bloque anterior con los datos del lote. Es local al navegador (prototipo).
import { load, save } from '../context/storage'
import { getHarvests, getRoasts } from './ops'
import { getPassport } from './passports'
import { seriesFor } from './telemetry'

const KEY = 'hauspe_chain'
export const ZERO_HASH = '0'.repeat(64)

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Datos que se sellan: finca, cosecha, tueste y lecturas del lote
export function lotData(code) {
  const pass = getPassport(code)
  if (!pass) return null
  const s = seriesFor(pass)
  return {
    code: pass.code,
    finca: pass.finca,
    cosecha: pass.harvest,
    tueste: pass.roasted,
    cosechas: getHarvests()
      .filter((h) => h.batch === pass.code)
      .map((h) => ({ date: h.date, kg: h.kg, humidity: h.humidity })),
    tuestes: getRoasts()
      .filter((r) => r.batch === pass.code)
      .map((r) => ({ date: r.date, profile: r.profile, temp: r.temp, minutes: r.minutes })),
    humedad: s.humidity,
    co2: s.co2,
  }
}

const readAll = () => load(KEY, {})
export const getChain = (code) => readAll()[code] || []
const blockHash = (index, prev, data) => sha256(`${index}|${prev}|${data}`)

async function makeBlock(code, previous, reason) {
  const data = JSON.stringify(lotData(code))
  const index = previous ? previous.index + 1 : 0
  const prev = previous ? previous.hash : ZERO_HASH
  return { index, prev, hash: await blockHash(index, prev, data), data, reason, at: Date.now() }
}

const inflight = new Map()

// Crea el bloque génesis la primera vez que se consulta un lote
export function ensureChain(code) {
  const existing = getChain(code)
  if (existing.length) return Promise.resolve(existing)
  if (inflight.has(code)) return inflight.get(code)
  const p = makeBlock(code, null, 'Génesis: lote registrado')
    .then((block) => {
      const all = readAll()
      if (!all[code]?.length) all[code] = [block]
      save(KEY, all)
      return all[code]
    })
    .finally(() => inflight.delete(code))
  inflight.set(code, p)
  return p
}

export async function appendBlock(code, reason) {
  const chain = await ensureChain(code)
  const block = await makeBlock(code, chain[chain.length - 1], reason)
  const all = readAll()
  all[code] = [...(all[code] || chain), block]
  save(KEY, all)
  return all[code]
}

// Ejecuta un cambio de datos del lote y lo sella en un bloque nuevo
export async function sealChange(code, reason, mutate) {
  await ensureChain(code) // el génesis debe reflejar el estado anterior al cambio
  mutate()
  return appendBlock(code, reason)
}

// Recalcula todos los hashes y compara con lo guardado y con los datos actuales
export async function verifyChain(code) {
  const chain = getChain(code)
  const problems = []
  for (let i = 0; i < chain.length; i++) {
    const b = chain[i]
    if (b.prev !== (i === 0 ? ZERO_HASH : chain[i - 1].hash)) problems.push(`Bloque ${i}: el enlace con el anterior está roto.`)
    if ((await blockHash(b.index, b.prev, b.data)) !== b.hash) problems.push(`Bloque ${i}: el hash no coincide con sus datos.`)
  }
  const last = chain[chain.length - 1]
  if (last && JSON.stringify(lotData(code)) !== last.data) {
    problems.push('Los datos actuales del lote no coinciden con el último bloque.')
  }
  return { ok: chain.length > 0 && !problems.length, blocks: chain.length, problems, at: Date.now() }
}
