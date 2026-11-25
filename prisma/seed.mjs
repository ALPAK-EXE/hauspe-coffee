// Datos de ejemplo para que la demo nunca arranque vacía (los mismos de src/db/seed.js).
// Uso: npx prisma db seed   (o  npm run db:seed)
import '../scripts/_env.mjs'
import bcrypt from 'bcryptjs'
import { prisma } from '../api/_lib/prisma.js'
import { dia, aSegundos, sumarDias, sumarHoras } from '../api/_lib/core.js'
import { registrarEtapa, crearPedido, avanzarPedido, guardarPerfilSabor, agregarNota } from '../api/_lib/repo.js'
import { retailProducts, greenLots, drinks, bagInsumos } from '../src/data/products.js'

const hace = (dias, horas = 0) => aSegundos(sumarHoras(sumarDias(new Date(), -dias), -horas))
const db = prisma

async function sembrar() {
  if ((await db.plan.count()) > 0) throw new Error('La base ya tiene datos. Usa "npm run db:reset" para recrearla.')

  // ---- Planes
  const planes = [
    ['Gratuito', 'B2C', 0, ['Compra en la tienda', 'Coffee Matcher básico', 'Pasaporte digital de tu café']],
    ['Premium', 'B2C', 19.9, ['10% extra en toda la tienda', 'Coffee Matcher avanzado', 'Academia de café completa', 'Envío prioritario', 'Promociones exclusivas']],
    ['HORECA', 'B2B', 0, ['Presentaciones de 1 kg o más', 'Precios por volumen', 'Factura electrónica', 'Reposición programada']],
    ['Exportador', 'B2B', 0, ['Café verde de Villa Rica', 'Cotización FOB / CIF', 'Pasaporte técnico por costal', 'Documentación en inglés']],
  ]
  await db.plan.createMany({ data: planes.map(([nombre, segmento, precio_mensual, beneficios]) => ({ nombre, segmento, precio_mensual, beneficios })) })

  // ---- Empleados (inspectores firmantes de la cadena). Cuatro tienen acceso al panel /admin (contraseña: admin123)
  const claveStaff = await bcrypt.hash('admin123', 10)
  const acceso = { AD1: 'admin@hauspe.pe', BA1: 'barista@hauspe.pe', RD1: 'almacen@hauspe.pe', IC1: 'inspector@hauspe.pe' }
  await db.empleado.createMany({
    data: [
      ['IC1', 'Pablo Quispe', 'INSPECTOR_COSECHA'],
      ['IC2', 'Rosa Yupanqui', 'INSPECTOR_COSECHA'],
      ['IE1', 'María Rojas', 'INSPECTOR_ENTREGA'],
      ['IP1', 'Luis Torres', 'INSPECTOR_PRODUCCION'],
      ['RD1', 'Carlos Huamán', 'REPARTIDOR'],
      ['BA1', 'Ana Flores', 'BARISTA'],
      ['AD1', 'Administrador HausPe', 'ADMIN'],
    ].map(([codigo, nombre, rol]) => ({ codigo, nombre, rol, email: acceso[codigo] ?? null, password_hash: acceso[codigo] ? claveStaff : null })),
  })

  // ---- Zonas de reparto
  await db.zonaReparto.createMany({
    data: [['Villa El Salvador', 8], ['San Juan de Miraflores', 8], ['Chorrillos', 9], ['Santiago de Surco', 10], ['Barranco', 10],
      ['Miraflores', 12], ['San Isidro', 12], ['La Molina', 14], ['San Borja', 12], ['Lince', 11]].map(([distrito, costo_envio]) => ({ distrito, costo_envio })),
  })

  // ---- Guías de preparación (Academia)
  const guias = {}
  for (const [metodo, titulo, texto, proporcion, tiempo_segundos] of [
    ['V60', 'Método V60', 'Filtrado por goteo que resalta la acidez y las notas florales. Enjuaga el filtro, pre-infusiona 30 s con el doble de agua que café y vierte en espiral hasta completar.', '1:16', 180],
    ['PRENSA', 'Prensa francesa', 'Inmersión total: cuerpo intenso y textura sedosa. Molienda gruesa, agua a 94 °C, espera 4 minutos y presiona suave.', '1:15', 240],
    ['MOKA', 'Cafetera moka', 'Extracción por presión de vapor. Llena el depósito con agua caliente hasta la válvula, molienda media-fina sin compactar y fuego medio.', '1:10', 300],
    ['ESPRESSO', 'Espresso', 'Extracción a 9 bar en 25 a 30 segundos. Molienda fina, 18 g de café para 36 g de bebida.', '1:2', 28],
    ['COLD_BREW', 'Cold brew', 'Extracción en frío de 12 a 18 horas. Molienda gruesa y agua fría; resulta dulce y de baja acidez.', '1:8', 50400],
  ]) {
    guias[metodo] = (await db.guiaPreparacion.create({ data: { metodo, titulo, texto, proporcion, tiempo_segundos } })).id_guia
  }

  // ---- Productos y variantes
  const prod = async (sku, nombre, tipo, categoria, descripcion, guia, variantes) => {
    const p = await db.producto.create({
      data: {
        sku, nombre, tipo, categoria, descripcion, id_guia: guia ? guias[guia] : null,
        variantes: { create: variantes.map(([d, moneda, precio, unidad, stock]) => ({ descripcion: d, moneda, precio, unidad, stock })) },
      },
      include: { variantes: { orderBy: { id_variante: 'asc' } } },
    })
    return { id: p.id_producto, variantes: p.variantes.map((v) => v.id_variante) }
  }
  const guiaDe = { casa: 'PRENSA', origen: 'V60', tarde: 'MOKA', geisha: 'V60', natural: 'COLD_BREW', 'espresso-casa': 'ESPRESSO', honey: 'V60', descafeinado: 'PRENSA' }
  const tostados = []
  for (const p of retailProducts) {
    tostados.push({
      ...(await prod(p.id, p.name, 'CAFE', 'Cafés de especialidad', `${p.notes.join(', ')}.`, guiaDe[p.id],
        [[p.weight, 'PEN', p.price, 'bolsa', 300], ['1 kg HORECA', 'PEN', Math.round(p.price * 3.5), 'bolsa', 80]])),
      src: p,
    })
  }
  const [casa, origen, tarde] = tostados
  const bebidas = []
  for (const d of drinks) {
    bebidas.push({
      ...(await prod(d.id, d.name, 'BEBIDA', 'Cafetería', d.description, d.id === 'bebida-coldbrew' ? 'COLD_BREW' : 'ESPRESSO',
        d.sizes.map((z) => [z.label, 'PEN', z.price, 'vaso', 9999]))),
      src: d,
    })
  }

  // Insumos y recetas con gramaje (la venta descuenta del almacén)
  const insumos = new Map()
  const insumo = async (nombre, unidad) => {
    if (!insumos.has(nombre)) {
      const stock = unidad === 'u' ? 2000 : unidad === 'g' ? 60000 : 80000
      insumos.set(nombre, (await db.insumo.create({ data: { nombre, unidad, stock, stock_minimo: stock * 0.1 } })).id_insumo)
    }
    return insumos.get(nombre)
  }
  const ALIAS = { 'Espuma de leche': 'Leche entera', 'Agua caliente': 'Agua filtrada', 'Agua fría (extracción 16 h)': 'Agua filtrada' }
  const receta = async (id_variante, filas, factor = 1) => {
    const suma = new Map()
    filas.forEach((f) => {
      const nombre = ALIAS[f.nombre] || f.nombre
      suma.set(nombre, { unidad: f.unidad, cantidad: (suma.get(nombre)?.cantidad || 0) + f.cantidad * factor })
    })
    for (const [nombre, v] of suma) {
      await db.recetaInsumo.create({ data: { id_variante, id_insumo: await insumo(nombre, v.unidad), cantidad: v.cantidad } })
    }
  }
  for (const t of tostados) { await receta(t.variantes[0], bagInsumos(t.src)); await receta(t.variantes[1], bagInsumos(t.src), 4) }
  for (const b of bebidas) for (const [i, z] of b.src.sizes.entries()) await receta(b.variantes[i], z.insumos.filter((f) => f.nombre !== 'Espresso'))

  const verdes = []
  for (const g of greenLots) {
    verdes.push({
      ...(await prod(g.id, g.name, 'VERDE', 'Exportación', `Café verde ${g.variety}, proceso ${g.process.toLowerCase()}.`, null,
        [['Saco 60 kg', 'USD', Math.round(g.pricePerKg * 60 * 100) / 100, 'saco', g.stockSacks]])),
      src: g,
    })
  }
  // Tienda estilo equipos y accesorios
  const v60 = await prod('hario-v60', 'Dripper Hario V60 02', 'ACCESORIO', 'Accesorios', 'Cerámica, incluye 40 filtros.', 'V60', [['Blanco', 'PEN', 95, 'unidad', 25]])
  await prod('prensa-francesa', 'Prensa francesa 600 ml', 'ACCESORIO', 'Cafeteras', 'Vidrio borosilicato y acero.', 'PRENSA', [['600 ml', 'PEN', 120, 'unidad', 18]])
  await prod('molino-manual', 'Molino manual de muelas cónicas', 'ACCESORIO', 'Molinos', 'Ajuste de 30 niveles.', null, [['Acero', 'PEN', 180, 'unidad', 12]])
  await prod('moka-3', 'Cafetera moka 3 tazas', 'ACCESORIO', 'Cafeteras', 'Aluminio, apta para cocina a gas.', 'MOKA', [['3 tazas', 'PEN', 79, 'unidad', 20]])
  const packV60 = await prod('pack-v60', 'Pack V60', 'KIT', 'Packs cafeteros', 'Dripper V60 + filtros + Origen 250 g.', 'V60', [['Pack', 'PEN', 149, 'kit', 15]])
  await prod('pack-premium', 'Pack Premium Villa Rica', 'KIT', 'Packs premium', 'Casa + Origen + Tarde 250 g y taza de cerámica.', null, [['Pack', 'PEN', 189, 'kit', 10]])
  await db.extra.createMany({ data: [['Shot extra', 3], ['Leche de avena', 2.5], ['Jarabe de panela', 1.5]].map(([nombre, precio]) => ({ nombre, precio })) })

  // Promociones (precio tachado) y promo exclusiva Premium
  const hoy = new Date()
  const promo = await db.promocion.create({ data: { nombre: 'Semana del V60', descuento: 0.15, inicio: dia(sumarDias(hoy, -2)), fin: dia(sumarDias(hoy, 12)) } })
  await db.promocionProducto.createMany({ data: [{ id_promocion: promo.id_promocion, id_producto: v60.id }, { id_promocion: promo.id_promocion, id_producto: packV60.id }] })
  const premium = await db.plan.findUnique({ where: { nombre: 'Premium' } })
  const promoPrem = await db.promocion.create({
    data: { nombre: 'Premium: Origen al 20%', descuento: 0.2, inicio: dia(sumarDias(hoy, -1)), fin: dia(sumarDias(hoy, 20)), id_plan: premium.id_plan },
  })
  await db.promocionProducto.create({ data: { id_promocion: promoPrem.id_promocion, id_producto: origen.id } })

  // Inventario por ubicación
  const inv = []
  ;[casa, origen, tarde].forEach((p) => {
    inv.push({ id_variante: p.variantes[0], ubicacion: 'Dark Store Surco', cantidad: 60 }, { id_variante: p.variantes[0], ubicacion: 'Tostaduría Lima', cantidad: 40 }, { id_variante: p.variantes[1], ubicacion: 'Tostaduría Lima', cantidad: 25 })
  })
  verdes.forEach((v) => inv.push({ id_variante: v.variantes[0], ubicacion: 'Almacén Villa Rica', cantidad: 20 }))
  await db.inventario.createMany({ data: inv })

  // ---- Lotes, unidades con QR y telemetría
  const lotes = []
  for (const t of tostados) {
    const l = await db.loteCafe.create({
      data: {
        codigo_lote: t.src.batch, id_producto: t.id, finca_origen: t.src.composition[0].finca, productor: t.src.producer,
        altura_msnm: parseInt(t.src.altitude.replace(/\D/g, ''), 10), variedad: t.src.variety, proceso: t.src.process,
        puntaje_sca: t.src.sca, fecha_cosecha: new Date('2026-07-10'), tipo: 'TOSTADO',
      },
    })
    lotes.push({ codigo: t.src.batch, pref: t.src.batch, tipo: 'BOLSA', peso: 0.25, id: l.id_lote, finca: l.finca_origen })
  }
  for (const v of verdes) {
    const l = await db.loteCafe.create({
      data: {
        codigo_lote: v.src.batch, id_producto: v.id, finca_origen: v.src.finca, productor: v.src.productor, altura_msnm: v.src.altitude,
        variedad: v.src.variety, proceso: v.src.process, puntaje_sca: v.src.sca, fecha_cosecha: new Date('2026-07-15'), tipo: 'VERDE',
      },
    })
    lotes.push({ codigo: v.src.batch, pref: v.src.batch, tipo: 'COSTAL', peso: 60, id: l.id_lote, finca: l.finca_origen })
  }
  for (const l of lotes) {
    const n = l.tipo === 'BOLSA' ? 12 : 6
    await db.unidadEmpaque.createMany({
      data: Array.from({ length: n }, (_, k) => ({
        id_lote: l.id, codigo_qr: `${l.pref}-${l.tipo === 'BOLSA' ? 'U' : 'S'}${String(k + 1).padStart(3, '0')}`, tipo: l.tipo, peso_kg: l.peso,
      })),
    })
    const lecturas = []
    for (let h = 11; h >= 0; h--) {
      lecturas.push({
        id_lote: l.id, nivel_humedad: Math.round((10.6 + Math.sin(h + l.id) * 0.6) * 100) / 100, nivel_co2_ppm: 400 + ((h * 37 + l.id * 11) % 90),
        nivel_desgasificacion: Math.round(Math.abs(Math.cos(h)) * 250) / 100, leido_en: hace(0, h * 2),
      })
    }
    await db.telemetriaIoT.createMany({ data: lecturas })
  }

  // ---- Cadena de trazabilidad firmada por inspectores
  for (const l of lotes) {
    await registrarEtapa(db, { codigo_lote: l.codigo, tipo: 'FINCA', ubicacion: `${l.finca}, Villa Rica (Pasco)`, codigo_empleado: l.tipo === 'BOLSA' ? 'IC1' : 'IC2', fecha: hace(20, 2), detalle: 'Cosecha seleccionada a mano' })
    await registrarEtapa(db, { codigo_lote: l.codigo, tipo: 'DARK_STORE', ubicacion: l.tipo === 'BOLSA' ? 'Dark Store Surco, Lima' : 'Almacén Villa Rica', codigo_empleado: 'IE1', fecha: hace(12, 5), detalle: 'Recepción y control de humedad' })
    if (l.tipo === 'BOLSA') {
      await registrarEtapa(db, { codigo_lote: l.codigo, tipo: 'TUESTE', ubicacion: 'Tostaduría Lima', codigo_empleado: 'IP1', fecha: hace(3, 4), detalle: 'Tueste medio, 12 min a 205 °C' })
    } else if (l.codigo === verdes[0].src.batch) {
      await registrarEtapa(db, { codigo_lote: l.codigo, tipo: 'EXPORTACION', ubicacion: 'Puerto del Callao', codigo_empleado: 'IE1', fecha: hace(2, 1), detalle: 'Contenedor con destino Hamburgo' })
    }
  }

  // ---- Clientes de demostración (contraseña: demo123, guardada con bcrypt)
  const pass = await bcrypt.hash('demo123', 10)
  const cli = async (nombre, email, telefono, tipo_segmento, tipo_b2b, empresa, ruc_taxid, pais, plan, idioma = 'es') => {
    const c = await db.cliente.create({ data: { nombre, email, telefono, password_hash: pass, tipo_segmento, tipo_b2b, empresa, ruc_taxid, pais, idioma, creado_en: hace(30) } })
    const p = await db.plan.findUnique({ where: { nombre: plan } })
    await db.membresia.create({ data: { id_cliente: c.id_cliente, id_plan: p.id_plan, inicio: dia(sumarDias(hoy, -30)) } })
    return c.id_cliente
  }
  const lucia = await cli('Lucía Mendoza', 'cliente@hauspe.pe', '987654321', 'B2C', null, null, null, 'Perú', 'Gratuito')
  const diego = await cli('Diego Paredes', 'premium@hauspe.pe', '912345678', 'B2C', null, null, null, 'Perú', 'Premium')
  const horeca = await cli('Valeria Ríos', 'horeca@hauspe.pe', '955123456', 'B2B', 'HORECA', 'Café Barranco S.A.C.', '20601234567', 'Perú', 'HORECA')
  const nordic = await cli('Lukas Becker', 'import@nordicroasters.de', '4915112345678', 'B2B', 'IMPORTADOR', 'Nordic Roasters GmbH', 'DE298765432', 'Alemania', 'Exportador', 'en')

  await guardarPerfilSabor(db, lucia, { notas_preferidas: 'Chocolate, nuez', tipo_molienda: 'Media', metodo_extraccion: 'Prensa francesa', intensidad: 4 })
  await guardarPerfilSabor(db, diego, { notas_preferidas: 'Cítricos, floral', tipo_molienda: 'Media-fina', metodo_extraccion: 'V60', intensidad: 3 })
  await agregarNota(db, diego, 'Prefiere su latte con leche de avena.', 'BA1')
  await agregarNota(db, horeca, 'Reposición quincenal, recibe por la puerta de servicio.', 'AD1')

  const dir = async (id_cliente, distrito, direccion) => {
    const z = await db.zonaReparto.findUnique({ where: { distrito } })
    return (await db.direccion.create({ data: { id_cliente, id_zona: z.id_zona, direccion, predeterminada: true } })).id_direccion
  }
  const dLucia = await dir(lucia, 'Villa El Salvador', 'Av. Micaela Bastidas 123')
  const dDiego = await dir(diego, 'Miraflores', 'Calle Berlín 456')
  await dir(horeca, 'Barranco', 'Jr. Unión 210')

  // ---- Pedidos de demostración en distintos estados
  await crearPedido(db, { id_cliente: lucia, items: [{ id_variante: casa.variantes[0], cantidad: 1 }], id_direccion: dLucia, distrito: 'Villa El Salvador', referencia: '483920' })
  const p2 = await crearPedido(db, { id_cliente: diego, items: [{ id_variante: origen.variantes[0], cantidad: 1, precio_unitario: 54.4, configuracion: { frecuencia: 'SEMANAL', molienda: 'V60' } }], frecuencia: 'SEMANAL', id_direccion: dDiego, distrito: 'Miraflores', referencia: '571204' })
  await avanzarPedido(db, p2.codigo)
  const p3 = await crearPedido(db, { id_cliente: horeca, items: [{ id_variante: tarde.variantes[1], cantidad: 3 }], distrito: 'Barranco', metodoPago: 'TRANSFERENCIA', referencia: 'OP-88213' })
  await avanzarPedido(db, p3.codigo); await avanzarPedido(db, p3.codigo); await avanzarPedido(db, p3.codigo, { codigo_repartidor: 'RD1' })
  const latte = await db.varianteProducto.findFirst({ where: { producto: { sku: 'bebida-latte' } }, orderBy: { id_variante: 'asc' } })
  await crearPedido(db, { canal: 'POS', items: [{ id_variante: latte.id_variante, cantidad: 2 }], metodoPago: 'EFECTIVO' })
  await crearPedido(db, { id_cliente: nordic, items: [{ id_variante: verdes[0].variantes[0], cantidad: 10 }], incoterm: 'CIF', pais_destino: 'Alemania', flete: 252, descuentoVolumen: 0.03 })
  // Pedido antiguo ya entregado (historial)
  const p6 = await crearPedido(db, { id_cliente: lucia, items: [{ id_variante: tarde.variantes[0], cantidad: 2 }], id_direccion: dLucia, distrito: 'Villa El Salvador', referencia: '110233' })
  for (let i = 0; i < 4; i++) await avanzarPedido(db, p6.codigo)
  await db.pedido.update({ where: { codigo: p6.codigo }, data: { fecha: hace(9) } })

  // Suscripción que vence pronto → recordatorio de reposición
  await db.suscripcionCafe.updateMany({ where: { id_cliente: diego }, data: { proximo_envio: dia(sumarDias(hoy, 2)) } })
  await db.recordatorio.createMany({
    data: [
      { id_cliente: diego, tipo: 'REPOSICION', mensaje: 'Hola Diego, tu café Origen se acaba en 2 días. ¿Lo enviamos?', programado_en: aSegundos() },
      { id_cliente: horeca, tipo: 'REPOSICION_HORECA', mensaje: 'Valeria, toca la reposición quincenal de Tarde 1 kg para Café Barranco.', programado_en: aSegundos(sumarDias(hoy, 1)) },
      { id_cliente: nordic, tipo: 'NUEVA_COSECHA', mensaje: 'Llegó la nueva cosecha de Geisha La Esperanza (SCA 87.5).', programado_en: aSegundos() },
    ],
  })

  // Leads O2O capturados desde el QR del vaso
  await db.lead.create({ data: { nombre: 'Andrea', whatsapp: '976543210', origen: 'QR', codigo_qr: 'HP-ORI-0925', creado_en: hace(1) } })
  await db.lead.create({ data: { nombre: 'Lucía Mendoza', email: 'cliente@hauspe.pe', origen: 'QR', codigo_qr: 'HP-CASA-0925', id_cliente: lucia, creado_en: hace(30) } })

  await db.valoracion.create({ data: { id_cliente: lucia, id_producto: casa.id, puntuacion: 5, comentario: 'Se siente el chocolate, perfecto en prensa.' } })
  await db.valoracion.create({ data: { id_cliente: diego, id_producto: origen.id, puntuacion: 5, comentario: 'El mejor para V60.' } })
  await db.listaDeseos.create({ data: { id_cliente: diego, id_producto: packV60.id } })
  await db.articuloBlog.create({
    data: { titulo: '¿Qué es el puntaje SCA?', slug: 'puntaje-sca', contenido: 'La Specialty Coffee Association califica el café de 0 a 100. Desde 80 puntos es café de especialidad.', publicado_en: dia() },
  })
}

const t0 = Date.now()
try {
  await sembrar()
  const [c, p, l, f] = await Promise.all([db.cliente.count(), db.pedido.count(), db.loteCafe.count(), db.firmaEtapa.count()])
  console.log(`Seed listo en ${((Date.now() - t0) / 1000).toFixed(1)} s: ${c} clientes, ${p} pedidos, ${l} lotes, ${f} firmas.`)
} catch (e) {
  console.error('Seed falló:', e.message)
  process.exitCode = 1
} finally {
  await db.$disconnect()
}
