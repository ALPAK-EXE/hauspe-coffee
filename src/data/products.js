// Datos de ejemplo (prototipo académico)
export const GRIND_OPTIONS = [
  'Grano entero',
  'Espresso',
  'Moka',
  'Filtro (V60 / Chemex)',
  'Prensa francesa',
]

export const PROFILES = ['Achocolatado', 'Frutal', 'Dulce']
export const ROASTS = ['Medio claro', 'Medio', 'Medio oscuro']

export const retailProducts = [
  {
    id: 'casa',
    kind: 'b2c',
    name: 'Casa',
    tagline: 'El café de todos los días',
    price: 58,
    weight: '250 g',
    roast: 'Medio',
    roastLevel: 3,
    profiles: ['Achocolatado', 'Dulce'],
    notes: ['Chocolate', 'Panela', 'Nuez'],
    color: '#8A5A3C',
    origin: 'Villa Rica, Pasco',
    altitude: '1 750 msnm',
    description:
      'Cuerpo redondo y final largo de chocolate. Es el café para la taza de la mañana, en cafetera de filtro o prensa.',
    batch: 'HP-CASA-0925',
  },
  {
    id: 'origen',
    kind: 'b2c',
    name: 'Origen',
    tagline: 'Un solo lote, sin mezclas',
    price: 64,
    weight: '250 g',
    roast: 'Medio claro',
    roastLevel: 2,
    profiles: ['Frutal', 'Achocolatado'],
    notes: ['Cítricos', 'Miel', 'Cacao'],
    color: '#C98B3A',
    origin: 'Finca La Esperanza, Villa Rica',
    altitude: '1 920 msnm',
    description:
      'Acidez cítrica brillante y dulzor de miel. Tostado claro para que se note la finca y no el fuego.',
    batch: 'HP-ORI-0925',
  },
  {
    id: 'tarde',
    kind: 'b2c',
    name: 'Tarde',
    tagline: 'Dulce y suave, sin prisa',
    price: 52,
    weight: '250 g',
    roast: 'Medio oscuro',
    roastLevel: 4,
    profiles: ['Dulce', 'Frutal'],
    notes: ['Caramelo', 'Cacao', 'Fruta madura'],
    color: '#5E3B2A',
    origin: 'Villa Rica, Pasco',
    altitude: '1 650 msnm',
    description:
      'Baja acidez y mucho cuerpo. Funciona muy bien con leche o en espresso para la pausa de la tarde.',
    batch: 'HP-TAR-0925',
  },
]

export const greenLots = [
  {
    id: 'lote-esperanza',
    kind: 'b2b',
    name: 'La Esperanza',
    finca: 'Finca La Esperanza',
    productor: 'Familia Quispe Rojas',
    altitude: 1920,
    variety: 'Geisha',
    process: 'Lavado',
    sca: 87.5,
    harvest: 'Julio 2026',
    pricePerKg: 18.5,
    minSacks: 2,
    stockSacks: 12,
    notes: ['Jazmín', 'Bergamota', 'Durazno'],
    color: '#4E7A5A',
    batch: 'HP-VR-2607-A',
    story:
      'Parcela de 3 hectáreas bajo sombra de pacay. Se cosecha a mano, cereza por cereza, y se fermenta 36 horas en tanque.',
  },
  {
    id: 'lote-mirador',
    kind: 'b2b',
    name: 'El Mirador',
    finca: 'Finca El Mirador',
    productor: 'Rosa Elena Chávez',
    altitude: 1780,
    variety: 'Bourbon',
    process: 'Honey',
    sca: 85.25,
    harvest: 'Junio 2026',
    pricePerKg: 11.2,
    minSacks: 5,
    stockSacks: 40,
    notes: ['Panela', 'Naranja', 'Almendra'],
    color: '#B9783A',
    batch: 'HP-VR-2606-B',
    story:
      'Proceso honey con secado en camas africanas durante 18 días. Dulzor limpio y cuerpo cremoso.',
  },
  {
    id: 'lote-nogal',
    kind: 'b2b',
    name: 'El Nogal',
    finca: 'Finca El Nogal',
    productor: 'Asociación Cafetalera Río Paucartambo',
    altitude: 1650,
    variety: 'Caturra',
    process: 'Natural',
    sca: 84.0,
    harvest: 'Junio 2026',
    pricePerKg: 9.4,
    minSacks: 10,
    stockSacks: 85,
    notes: ['Fresa', 'Cacao', 'Vino'],
    color: '#8E4B4B',
    batch: 'HP-VR-2606-C',
    story:
      'Cereza entera secada al sol por 25 días. Lote de volumen pensado para tostadores con perfil frutal.',
  },
  {
    id: 'lote-sombra',
    kind: 'b2b',
    name: 'Bajo Sombra',
    finca: 'Finca Bajo Sombra',
    productor: 'Don Julio Huamán',
    altitude: 1700,
    variety: 'Typica',
    process: 'Lavado',
    sca: 83.5,
    harvest: 'Mayo 2026',
    pricePerKg: 8.2,
    minSacks: 10,
    stockSacks: 120,
    notes: ['Chocolate', 'Nuez', 'Caña'],
    color: '#6B6A3A',
    batch: 'HP-VR-2605-D',
    story:
      'Typica de árboles viejos bajo sombra. Taza limpia y clásica, buena para espresso y para mezclas de casa.',
  },
  {
    id: 'lote-cumbre',
    kind: 'b2b',
    name: 'La Cumbre',
    finca: 'Finca La Cumbre',
    productor: 'Marleni Soto Ccanto',
    altitude: 2010,
    variety: 'Bourbon',
    process: 'Natural',
    sca: 86.0,
    harvest: 'Julio 2026',
    pricePerKg: 13.6,
    minSacks: 3,
    stockSacks: 18,
    notes: ['Mora', 'Miel', 'Cacao'],
    color: '#7A5A8A',
    batch: 'HP-VR-2607-E',
    story:
      'La finca más alta de la zona. Maduración lenta y azúcares concentrados que dan una taza dulce y compleja.',
  },
]

export const allProducts = [...retailProducts, ...greenLots]
export const getProduct = (id) => allProducts.find((p) => p.id === id)

export const SACK_KG = 60

// Suscripciones: descuento sobre la compra única
export const PLANS = [
  { id: 'once', label: 'Compra única', discount: 0 },
  { id: 'weekly', label: 'Cada semana', discount: 0.15 },
  { id: 'biweekly', label: 'Cada 2 semanas', discount: 0.1 },
  { id: 'monthly', label: 'Cada mes', discount: 0.05 },
]

export const INCOTERMS = [
  { id: 'FOB', label: 'FOB Callao', hint: 'El comprador contrata flete y seguro.' },
  { id: 'CIF', label: 'CIF puerto de destino', hint: 'HausPe incluye flete y seguro.' },
]

// Flete + seguro estimado por kg (USD) para CIF
export const DESTINATIONS = [
  { id: 'US', label: 'Estados Unidos', cifPerKg: 0.38 },
  { id: 'DE', label: 'Alemania', cifPerKg: 0.42 },
  { id: 'NL', label: 'Países Bajos', cifPerKg: 0.41 },
  { id: 'ES', label: 'España', cifPerKg: 0.4 },
  { id: 'JP', label: 'Japón', cifPerKg: 0.55 },
  { id: 'KR', label: 'Corea del Sur', cifPerKg: 0.54 },
  { id: 'CL', label: 'Chile', cifPerKg: 0.2 },
]

export const IGV_RATE = 0.18
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

// Quién compra qué: tienda (S/, Yape, comprobante peruano) o exportación (US$, cotización sin IGV)
export const canBuyRetail = (user) => !user || user.segment === 'b2c' || user.businessType === 'HORECA'
export const canQuoteExport = (user) =>
  !user || (user.segment === 'b2b' && user.businessType === 'Importador extranjero')

export function volumeDiscount(sacks) {
  if (sacks >= 20) return 0.05
  if (sacks >= 10) return 0.03
  return 0
}

export function quoteLot(lot, sacks, incoterm, destinationId) {
  const kg = sacks * SACK_KG
  const base = round2(kg * lot.pricePerKg)
  const discount = round2(base * volumeDiscount(sacks))
  const dest = DESTINATIONS.find((d) => d.id === destinationId)
  const freight = incoterm === 'CIF' && dest ? round2(kg * dest.cifPerKg) : 0
  return { kg, base, discount, freight, total: round2(base - discount + freight) }
}

export const fmtPEN = (n) =>
  'S/ ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fmtUSD = (n) =>
  'US$ ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
