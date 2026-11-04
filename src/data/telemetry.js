// Telemetría IoT simulada: lecturas de humedad (%) y CO2 (ppm) por lote
import { load, save } from '../context/storage'

const KEY = 'hauspe_readings'
export const HUMIDITY_RANGE = [10, 12]

export const outOfRange = (h) => h < HUMIDITY_RANGE[0] || h > HUMIDITY_RANGE[1]

export const getReadings = (batch) =>
  load(KEY, [])
    .filter((r) => !batch || r.batch === batch)
    .sort((a, b) => a.at - b.at)

export function addReadings(list) {
  save(KEY, [...load(KEY, []), ...list.map((r) => ({ ...r, id: crypto.randomUUID() }))])
}

// Lecturas aleatorias realistas: casi siempre dentro de rango, con alguna salida ocasional
export function simulateReadings(batch, n = 6) {
  const now = Date.now()
  return Array.from({ length: n }, (_, i) => {
    let humidity = 11 + (Math.random() - 0.5) * 1.4
    if (Math.random() < 0.15) humidity += (Math.random() < 0.5 ? -1 : 1) * 1.4
    const co2 = 520 + (Math.random() - 0.5) * 160
    return { batch, at: now - (n - 1 - i) * 3600 * 1000, humidity: +humidity.toFixed(1), co2: Math.round(co2) }
  })
}

// Serie del pasaporte: histórico simulado + lecturas registradas
export function seriesFor(pass) {
  const reads = getReadings(pass.code)
  return {
    humidity: [...pass.humidity, ...reads.map((r) => r.humidity)],
    co2: [...pass.co2, ...reads.map((r) => r.co2)],
    registered: reads.length,
  }
}

// Lotes con la última humedad fuera de rango
export function humidityAlert(series) {
  const last = series.humidity[series.humidity.length - 1]
  return outOfRange(last) ? last : null
}
