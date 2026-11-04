// Pasaporte digital simulado: telemetría IoT y hash "blockchain" de ejemplo
import { allProducts } from './products'

const EXTRA = {
  casa: { tueste: '12 oct 2026', cosecha: 'Julio 2026', finca: 'Cooperativa Villa Rica' },
  origen: { tueste: '14 oct 2026', cosecha: 'Julio 2026', finca: 'Finca La Esperanza' },
  tarde: { tueste: '11 oct 2026', cosecha: 'Junio 2026', finca: 'Cooperativa Villa Rica' },
}

function hash(str) {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  let out = ''
  for (let round = 0; round < 8; round++) {
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i)
      h1 = Math.imul(h1 ^ c, 2654435761)
      h2 = Math.imul(h2 ^ c, 1597334677)
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
    out += (h2 >>> 0).toString(16).padStart(8, '0')
  }
  return '0x' + out
}

function series(seed, base, amp, n = 12) {
  let s = seed * 1000 + 17
  return Array.from({ length: n }, (_, i) => {
    s = (s * 9301 + 49297) % 233280
    return +(base + Math.sin(i / 2) * amp * 0.6 + (s / 233280 - 0.5) * amp).toFixed(1)
  })
}

export const passports = allProducts.map((p, i) => {
  const extra = EXTRA[p.id] || {}
  return {
    code: p.batch,
    productId: p.id,
    finca: p.finca || extra.finca,
    harvest: p.harvest || extra.cosecha,
    roasted: p.kind === 'b2c' ? extra.tueste : 'Sin tostar (café verde)',
    humidity: series(i + 3, 11, 0.6),
    co2: series(i + 7, 520, 60),
    hash: hash(p.batch + p.name),
    block: 4187200 + i * 37,
    verifiedAt: '28 oct 2026',
  }
})

// Código de lote (HP-ORI-0925) o de empaque individual (HP-ORI-0925-U001)
export const UNIT_RE = /^(.+)-u(\d{3})$/i
export function getPassport(code) {
  const raw = (code || '').toLowerCase()
  const batch = raw.match(UNIT_RE)?.[1]
  return passports.find((p) => p.code.toLowerCase() === raw) || passports.find((p) => p.code.toLowerCase() === batch)
}
export const unitOf = (code) => (code || '').match(UNIT_RE)?.[2] || null
