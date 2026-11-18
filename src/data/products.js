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
    variety: 'Caturra y Bourbon',
    process: 'Lavado',
    sca: 84,
    producer: 'Cooperativa Villa Rica',
    composition: [
      { finca: 'Finca Santa Rosa', pct: 60 },
      { finca: 'Finca El Mirador', pct: 40 },
    ],
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
    variety: 'Typica',
    process: 'Lavado',
    sca: 86.5,
    producer: 'Familia Quispe Rojas',
    composition: [{ finca: 'Finca La Esperanza', pct: 100 }],
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
    variety: 'Bourbon',
    process: 'Honey',
    sca: 85,
    producer: 'Cooperativa Villa Rica',
    composition: [
      { finca: 'Finca El Mirador', pct: 70 },
      { finca: 'Finca Bajo Sombra', pct: 30 },
    ],
  },
  {
    id: 'geisha',
    kind: 'b2c',
    name: 'Geisha',
    tagline: 'La reserva de la casa',
    price: 89,
    weight: '250 g',
    roast: 'Medio claro',
    roastLevel: 1,
    profiles: ['Frutal'],
    notes: ['Jazmín', 'Bergamota', 'Durazno'],
    color: '#4E7A5A',
    origin: 'Finca La Esperanza, Villa Rica',
    altitude: '1 920 msnm',
    description:
      'Floral y transparente, con final de té negro. Una microcosecha que se toma sola, en V60 o Chemex.',
    batch: 'HP-GEI-1025',
    variety: 'Geisha',
    process: 'Lavado',
    sca: 87.5,
    producer: 'Familia Quispe Rojas',
    composition: [{ finca: 'Finca La Esperanza', pct: 100 }],
  },
  {
    id: 'natural',
    kind: 'b2c',
    name: 'Natural',
    tagline: 'Secado al sol, con fruta',
    price: 69,
    weight: '250 g',
    roast: 'Medio claro',
    roastLevel: 2,
    profiles: ['Frutal', 'Dulce'],
    notes: ['Fresa', 'Vino tinto', 'Cacao'],
    color: '#8E4B4B',
    origin: 'Finca El Nogal, Villa Rica',
    altitude: '1 650 msnm',
    description:
      'La cereza entera se seca 25 días al sol y deja dulzor de fruta roja. Va bien en prensa o en cold brew.',
    batch: 'HP-NAT-1025',
    variety: 'Caturra',
    process: 'Natural',
    sca: 85.5,
    producer: 'Asociación Río Paucartambo',
    composition: [{ finca: 'Finca El Nogal', pct: 100 }],
  },
  {
    id: 'espresso-casa',
    kind: 'b2c',
    name: 'Espresso',
    tagline: 'El blend de nuestra barra',
    price: 60,
    weight: '250 g',
    roast: 'Medio oscuro',
    roastLevel: 4,
    profiles: ['Achocolatado'],
    notes: ['Cacao amargo', 'Avellana', 'Panela'],
    color: '#3E2A20',
    origin: 'Blend de Villa Rica',
    altitude: '1 700 msnm',
    description:
      'Es el mismo café que usamos en la barra. Crema espesa y cuerpo para leche, pensado para máquina o moka.',
    batch: 'HP-ESP-1025',
    variety: 'Bourbon, Typica y Caturra',
    process: 'Lavado y honey',
    sca: 84,
    producer: 'Cooperativa Villa Rica',
    composition: [
      { finca: 'Finca Bajo Sombra', pct: 50 },
      { finca: 'Finca Santa Rosa', pct: 30 },
      { finca: 'Finca El Mirador', pct: 20 },
    ],
  },
  {
    id: 'honey',
    kind: 'b2c',
    name: 'Honey',
    tagline: 'Dulce de miel, sin azúcar',
    price: 66,
    weight: '250 g',
    roast: 'Medio',
    roastLevel: 3,
    profiles: ['Dulce', 'Frutal'],
    notes: ['Miel', 'Naranja', 'Almendra'],
    color: '#B9783A',
    origin: 'Finca El Mirador, Villa Rica',
    altitude: '1 780 msnm',
    description:
      'Se seca con parte del mucílago y queda un dulzor de miel natural. Equilibrado en filtro y en espresso.',
    batch: 'HP-HON-1025',
    variety: 'Bourbon',
    process: 'Honey',
    sca: 85.25,
    producer: 'Rosa Elena Chávez',
    composition: [{ finca: 'Finca El Mirador', pct: 100 }],
  },
  {
    id: 'descafeinado',
    kind: 'b2c',
    name: 'Descafeinado',
    tagline: 'Todo el sabor, de noche',
    price: 62,
    weight: '250 g',
    roast: 'Medio',
    roastLevel: 3,
    profiles: ['Dulce', 'Achocolatado'],
    notes: ['Caramelo', 'Galleta', 'Cacao'],
    color: '#7A6A58',
    origin: 'Finca Bajo Sombra, Villa Rica',
    altitude: '1 700 msnm',
    description:
      'Descafeinado con agua de montaña, sin solventes, al 99.9 %. Suave y dulce para la última taza del día.',
    batch: 'HP-DEC-1025',
    variety: 'Typica',
    process: 'Agua de montaña',
    sca: 83.5,
    producer: 'Don Julio Huamán',
    composition: [{ finca: 'Finca Bajo Sombra', pct: 100 }],
  },
]

// Insumos de cada bolsa: el gramaje de grano por finca suma el peso neto
export const BAG_GRAMS = 250
export function bagInsumos(p) {
  return [
    ...p.composition.map((c) => ({ nombre: `Grano tostado ${c.finca}`, cantidad: Math.round((BAG_GRAMS * c.pct) / 100), unidad: 'g', pct: c.pct })),
    { nombre: 'Bolsa compostable con válvula', cantidad: 1, unidad: 'u' },
  ]
}

// Bebidas de la barra: receta por tamaño con el gramaje de cada insumo.
// capa: color del ingrediente en el vaso ilustrado (proporcional a sus ml)
export const LAYERS = {
  espresso: { color: '#3B2416', label: 'Espresso' },
  agua: { color: '#7A4E2E', label: 'Agua caliente' },
  leche: { color: '#EFE3CC', label: 'Leche' },
  espuma: { color: '#FBF6EC', label: 'Espuma' },
  chocolate: { color: '#4A2A1C', label: 'Chocolate' },
  coldbrew: { color: '#5A361F', label: 'Cold brew' },
  hielo: { color: '#DDEBEC', label: 'Hielo' },
}

const cafe = (base, g) => ({ nombre: `Café ${base} molido`, cantidad: g, unidad: 'g' })
export const drinks = [
  {
    id: 'bebida-espresso',
    kind: 'drink',
    name: 'Espresso',
    base: 'espresso-casa',
    description: 'Extracción corta a 9 bar con el blend de la barra. Crema densa y final de cacao.',
    notes: ['Cacao amargo', 'Avellana'],
    color: '#3E2A20',
    hot: true,
    sizes: [
      { id: 'simple', label: 'Simple', price: 7, insumos: [cafe('Espresso', 9), { nombre: 'Agua filtrada', cantidad: 30, unidad: 'ml', capa: 'espresso' }] },
      { id: 'doble', label: 'Doble', price: 9, insumos: [cafe('Espresso', 18), { nombre: 'Agua filtrada', cantidad: 60, unidad: 'ml', capa: 'espresso' }] },
    ],
  },
  {
    id: 'bebida-americano',
    kind: 'drink',
    name: 'Americano',
    base: 'casa',
    description: 'Doble espresso de Casa alargado con agua caliente. Limpio y fácil de tomar.',
    notes: ['Chocolate', 'Nuez'],
    color: '#8A5A3C',
    hot: true,
    sizes: [
      { id: '8oz', label: '8 oz', price: 8, insumos: [cafe('Casa', 18), { nombre: 'Espresso', cantidad: 40, unidad: 'ml', capa: 'espresso' }, { nombre: 'Agua caliente', cantidad: 160, unidad: 'ml', capa: 'agua' }] },
      { id: '12oz', label: '12 oz', price: 10, insumos: [cafe('Casa', 18), { nombre: 'Espresso', cantidad: 40, unidad: 'ml', capa: 'espresso' }, { nombre: 'Agua caliente', cantidad: 280, unidad: 'ml', capa: 'agua' }] },
    ],
  },
  {
    id: 'bebida-capuchino',
    kind: 'drink',
    name: 'Capuchino',
    base: 'espresso-casa',
    description: 'Espresso, leche y una capa generosa de espuma sedosa, en partes casi iguales.',
    notes: ['Cacao', 'Leche dulce'],
    color: '#9C7350',
    hot: true,
    sizes: [
      { id: '8oz', label: '8 oz', price: 10, insumos: [cafe('Espresso', 18), { nombre: 'Espresso', cantidad: 40, unidad: 'ml', capa: 'espresso' }, { nombre: 'Leche entera', cantidad: 120, unidad: 'ml', capa: 'leche' }, { nombre: 'Espuma de leche', cantidad: 80, unidad: 'ml', capa: 'espuma' }] },
      { id: '12oz', label: '12 oz', price: 12, insumos: [cafe('Espresso', 18), { nombre: 'Espresso', cantidad: 40, unidad: 'ml', capa: 'espresso' }, { nombre: 'Leche entera', cantidad: 200, unidad: 'ml', capa: 'leche' }, { nombre: 'Espuma de leche', cantidad: 110, unidad: 'ml', capa: 'espuma' }] },
    ],
  },
  {
    id: 'bebida-latte',
    kind: 'drink',
    name: 'Latte',
    base: 'casa',
    description: 'Espresso de Casa con mucha leche texturizada y una capa fina de espuma.',
    notes: ['Chocolate con leche', 'Panela'],
    color: '#B89170',
    hot: true,
    sizes: [
      { id: '12oz', label: '12 oz', price: 12, insumos: [cafe('Casa', 18), { nombre: 'Espresso', cantidad: 40, unidad: 'ml', capa: 'espresso' }, { nombre: 'Leche entera', cantidad: 260, unidad: 'ml', capa: 'leche' }, { nombre: 'Espuma de leche', cantidad: 40, unidad: 'ml', capa: 'espuma' }] },
      { id: '16oz', label: '16 oz', price: 14, insumos: [cafe('Casa', 27), { nombre: 'Espresso', cantidad: 60, unidad: 'ml', capa: 'espresso' }, { nombre: 'Leche entera', cantidad: 340, unidad: 'ml', capa: 'leche' }, { nombre: 'Espuma de leche', cantidad: 50, unidad: 'ml', capa: 'espuma' }] },
    ],
  },
  {
    id: 'bebida-moka',
    kind: 'drink',
    name: 'Mocaccino',
    base: 'tarde',
    description: 'Espresso de Tarde con chocolate al 70 % de cacao peruano, leche y espuma.',
    notes: ['Chocolate', 'Caramelo'],
    color: '#6B4130',
    hot: true,
    sizes: [
      { id: '12oz', label: '12 oz', price: 13, insumos: [cafe('Tarde', 18), { nombre: 'Chocolate 70 % cacao', cantidad: 25, unidad: 'g', capa: 'chocolate', ml: 30 }, { nombre: 'Espresso', cantidad: 40, unidad: 'ml', capa: 'espresso' }, { nombre: 'Leche entera', cantidad: 230, unidad: 'ml', capa: 'leche' }, { nombre: 'Espuma de leche', cantidad: 40, unidad: 'ml', capa: 'espuma' }] },
      { id: '16oz', label: '16 oz', price: 15, insumos: [cafe('Tarde', 27), { nombre: 'Chocolate 70 % cacao', cantidad: 35, unidad: 'g', capa: 'chocolate', ml: 40 }, { nombre: 'Espresso', cantidad: 60, unidad: 'ml', capa: 'espresso' }, { nombre: 'Leche entera', cantidad: 300, unidad: 'ml', capa: 'leche' }, { nombre: 'Espuma de leche', cantidad: 50, unidad: 'ml', capa: 'espuma' }] },
    ],
  },
  {
    id: 'bebida-coldbrew',
    kind: 'drink',
    name: 'Cold brew',
    base: 'natural',
    description: 'Café Natural extraído en frío durante 16 horas. Dulce, frutal y con muy poca acidez.',
    notes: ['Fresa', 'Cacao'],
    color: '#5A361F',
    hot: false,
    sizes: [
      { id: '12oz', label: '12 oz', price: 11, insumos: [cafe('Natural', 30), { nombre: 'Hielo', cantidad: 120, unidad: 'g', capa: 'hielo', ml: 120 }, { nombre: 'Agua fría (extracción 16 h)', cantidad: 240, unidad: 'ml', capa: 'coldbrew' }] },
      { id: '16oz', label: '16 oz', price: 13, insumos: [cafe('Natural', 40), { nombre: 'Hielo', cantidad: 160, unidad: 'g', capa: 'hielo', ml: 160 }, { nombre: 'Agua fría (extracción 16 h)', cantidad: 320, unidad: 'ml', capa: 'coldbrew' }] },
    ],
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

export const allProducts = [...retailProducts, ...greenLots, ...drinks]
export const traceableProducts = [...retailProducts, ...greenLots]
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
// Presentaciones de la tienda: la de 1 kg es para cafeterías, restaurantes y hoteles (HORECA)
export const PRESENTACIONES = [
  { id: '250g', label: '250 g', db: '250 g', factor: 1, bolsa: '250 G' },
  { id: '1kg', label: '1 kg (HORECA)', db: '1 kg HORECA', factor: 3.5, bolsa: '1 KG' },
]
export const presOf = (id) => PRESENTACIONES.find((p) => p.id === id) || PRESENTACIONES[0]
export const precioPres = (product, presId) => Math.round(product.price * presOf(presId).factor)

export const sizeOf = (product, sizeId) => product.sizes?.find((z) => z.id === sizeId) || product.sizes?.[0]

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
