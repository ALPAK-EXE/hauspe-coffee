// Datos de ejemplo para que la demo nunca arranque vacía.
import { sha256, fechaLocal, soloFecha, sumarDias, sumarHoras } from './core.js'
import { retailProducts, greenLots, drinks, bagInsumos } from '../data/products'
import { registrarEtapa, crearPedido, avanzarPedido, guardarPerfilSabor, agregarNota } from './repo.js'

const hace = (dias, horas = 0) => fechaLocal(sumarHoras(sumarDias(new Date(), -dias), -horas))

export async function seed(hdb) {
  const r = (sql, p) => hdb.run(sql, p).lastId

  // ---- Planes
  const planes = [
    ['Gratuito', 'B2C', 0, ['Compra en la tienda', 'Coffee Matcher básico', 'Pasaporte digital de tu café']],
    ['Premium', 'B2C', 19.9, ['10% extra en toda la tienda', 'Coffee Matcher avanzado', 'Academia de café completa', 'Envío prioritario', 'Promociones exclusivas']],
    ['HORECA', 'B2B', 0, ['Presentaciones de 1 kg o más', 'Precios por volumen', 'Factura electrónica', 'Reposición programada']],
    ['Exportador', 'B2B', 0, ['Café verde de Villa Rica', 'Cotización FOB / CIF', 'Pasaporte técnico por costal', 'Documentación en inglés']],
  ]
  planes.forEach(([n, s, p, b]) => r('INSERT INTO Plan (nombre, segmento, precio_mensual, beneficios) VALUES (?,?,?,?)', [n, s, p, JSON.stringify(b)]))

  // ---- Empleados (inspectores firmantes de la cadena)
  const empleados = [
    ['IC1', 'Pablo Quispe', 'INSPECTOR_COSECHA'],
    ['IC2', 'Rosa Yupanqui', 'INSPECTOR_COSECHA'],
    ['IE1', 'María Rojas', 'INSPECTOR_ENTREGA'],
    ['IP1', 'Luis Torres', 'INSPECTOR_PRODUCCION'],
    ['RD1', 'Carlos Huamán', 'REPARTIDOR'],
    ['BA1', 'Ana Flores', 'BARISTA'],
    ['AD1', 'Administrador HausPe', 'ADMIN'],
  ]
  empleados.forEach((e) => r('INSERT INTO Empleado (codigo, nombre, rol) VALUES (?,?,?)', e))

  // ---- Zonas de reparto
  ;[['Villa El Salvador', 8], ['San Juan de Miraflores', 8], ['Chorrillos', 9], ['Santiago de Surco', 10], ['Barranco', 10],
    ['Miraflores', 12], ['San Isidro', 12], ['La Molina', 14], ['San Borja', 12], ['Lince', 11]]
    .forEach(([d, c]) => r('INSERT INTO ZonaReparto (distrito, costo_envio) VALUES (?,?)', [d, c]))

  // ---- Guías de preparación (Academia)
  const guias = {}
  ;[
    ['V60', 'Método V60', 'Filtrado por goteo que resalta la acidez y las notas florales. Enjuaga el filtro, pre-infusiona 30 s con el doble de agua que café y vierte en espiral hasta completar.', '1:16', 180],
    ['PRENSA', 'Prensa francesa', 'Inmersión total: cuerpo intenso y textura sedosa. Molienda gruesa, agua a 94 °C, espera 4 minutos y presiona suave.', '1:15', 240],
    ['MOKA', 'Cafetera moka', 'Extracción por presión de vapor. Llena el depósito con agua caliente hasta la válvula, molienda media-fina sin compactar y fuego medio.', '1:10', 300],
    ['ESPRESSO', 'Espresso', 'Extracción a 9 bar en 25 a 30 segundos. Molienda fina, 18 g de café para 36 g de bebida.', '1:2', 28],
    ['COLD_BREW', 'Cold brew', 'Extracción en frío de 12 a 18 horas. Molienda gruesa y agua fría; resulta dulce y de baja acidez.', '1:8', 50400],
  ].forEach(([m, t, x, p, s]) => { guias[m] = r('INSERT INTO GuiaPreparacion (metodo, titulo, texto, proporcion, tiempo_segundos) VALUES (?,?,?,?,?)', [m, t, x, p, s]) })

  // ---- Productos y variantes
  const prod = (sku, nombre, tipo, categoria, descripcion, guia, variantes) => {
    const id = r('INSERT INTO Producto (sku, nombre, tipo, categoria, descripcion, id_guia) VALUES (?,?,?,?,?,?)',
      [sku, nombre, tipo, categoria, descripcion, guia ? guias[guia] : null])
    return { id, variantes: variantes.map(([d, m, p, u, s]) => r(
      'INSERT INTO VarianteProducto (id_producto, descripcion, moneda, precio, unidad, stock) VALUES (?,?,?,?,?,?)', [id, d, m, p, u, s])) }
  }
  // Cafés tostados y lotes verdes: los mismos de src/data/products.js
  const guiaDe = { casa: 'PRENSA', origen: 'V60', tarde: 'MOKA', geisha: 'V60', natural: 'COLD_BREW', 'espresso-casa': 'ESPRESSO', honey: 'V60', descafeinado: 'PRENSA' }
  const tostados = retailProducts.map((p) => ({
    ...prod(p.id, p.name, 'CAFE', 'Cafés de especialidad', `${p.notes.join(', ')}.`, guiaDe[p.id],
      [[p.weight, 'PEN', p.price, 'bolsa', 300], ['1 kg HORECA', 'PEN', Math.round(p.price * 3.5), 'bolsa', 80]]),
    src: p,
  }))
  const [casa, origen, tarde] = tostados
  const bebidas = drinks.map((d) => ({
    ...prod(d.id, d.name, 'BEBIDA', 'Cafetería', d.description, d.id === 'bebida-coldbrew' ? 'COLD_BREW' : 'ESPRESSO',
      d.sizes.map((z) => [z.label, 'PEN', z.price, 'vaso', 9999])),
    src: d,
  }))

  // Insumos y recetas con gramaje (la venta descuenta del almacén)
  const insumos = new Map()
  const insumo = (nombre, unidad) => {
    if (!insumos.has(nombre)) {
      const stock = unidad === 'u' ? 2000 : unidad === 'g' ? 60000 : 80000
      insumos.set(nombre, r('INSERT INTO Insumo (nombre, unidad, stock, stock_minimo) VALUES (?,?,?,?)', [nombre, unidad, stock, stock * 0.1]))
    }
    return insumos.get(nombre)
  }
  const ALIAS = { 'Espuma de leche': 'Leche entera', 'Agua caliente': 'Agua filtrada', 'Agua fría (extracción 16 h)': 'Agua filtrada' }
  const receta = (id_variante, filas, factor = 1) => {
    const suma = new Map()
    filas.forEach((f) => {
      const nombre = ALIAS[f.nombre] || f.nombre
      suma.set(nombre, { unidad: f.unidad, cantidad: (suma.get(nombre)?.cantidad || 0) + f.cantidad * factor })
    })
    suma.forEach((v, nombre) => r('INSERT INTO RecetaInsumo (id_variante, id_insumo, cantidad) VALUES (?,?,?)', [id_variante, insumo(nombre, v.unidad), v.cantidad]))
  }
  tostados.forEach((t) => { receta(t.variantes[0], bagInsumos(t.src)); receta(t.variantes[1], bagInsumos(t.src), 4) })
  bebidas.forEach((b) => b.src.sizes.forEach((z, i) => receta(b.variantes[i], z.insumos.filter((f) => f.nombre !== 'Espresso'))))
  const verdes = greenLots.map((g) => ({
    ...prod(g.id, g.name, 'VERDE', 'Exportación', `Café verde ${g.variety}, proceso ${g.process.toLowerCase()}.`, null,
      [['Saco 60 kg', 'USD', Math.round(g.pricePerKg * 60 * 100) / 100, 'saco', g.stockSacks]]),
    src: g,
  }))
  // Tienda estilo equipos y accesorios
  const v60 = prod('hario-v60', 'Dripper Hario V60 02', 'ACCESORIO', 'Accesorios', 'Cerámica, incluye 40 filtros.', 'V60', [['Blanco', 'PEN', 95, 'unidad', 25]])
  prod('prensa-francesa', 'Prensa francesa 600 ml', 'ACCESORIO', 'Cafeteras', 'Vidrio borosilicato y acero.', 'PRENSA', [['600 ml', 'PEN', 120, 'unidad', 18]])
  prod('molino-manual', 'Molino manual de muelas cónicas', 'ACCESORIO', 'Molinos', 'Ajuste de 30 niveles.', null, [['Acero', 'PEN', 180, 'unidad', 12]])
  prod('moka-3', 'Cafetera moka 3 tazas', 'ACCESORIO', 'Cafeteras', 'Aluminio, apta para cocina a gas.', 'MOKA', [['3 tazas', 'PEN', 79, 'unidad', 20]])
  const packV60 = prod('pack-v60', 'Pack V60', 'KIT', 'Packs cafeteros', 'Dripper V60 + filtros + Origen 250 g.', 'V60', [['Pack', 'PEN', 149, 'kit', 15]])
  prod('pack-premium', 'Pack Premium Villa Rica', 'KIT', 'Packs premium', 'Casa + Origen + Tarde 250 g y taza de cerámica.', null, [['Pack', 'PEN', 189, 'kit', 10]])
  ;[['Shot extra', 3], ['Leche de avena', 2.5], ['Jarabe de panela', 1.5]].forEach(([n, p]) => r('INSERT INTO Extra (nombre, precio) VALUES (?,?)', [n, p]))

  // Promociones (precio tachado) y promo exclusiva Premium
  const promo = r(`INSERT INTO Promocion (nombre, descuento, inicio, fin) VALUES ('Semana del V60', 0.15, ?, ?)`, [soloFecha(sumarDias(new Date(), -2)), soloFecha(sumarDias(new Date(), 12))])
  r('INSERT INTO PromocionProducto (id_promocion, id_producto) VALUES (?,?)', [promo, v60.id])
  r('INSERT INTO PromocionProducto (id_promocion, id_producto) VALUES (?,?)', [promo, packV60.id])
  const promoPrem = r(`INSERT INTO Promocion (nombre, descuento, inicio, fin, id_plan) VALUES ('Premium: Origen al 20%', 0.2, ?, ?, (SELECT id_plan FROM Plan WHERE nombre='Premium'))`,
    [soloFecha(sumarDias(new Date(), -1)), soloFecha(sumarDias(new Date(), 20))])
  r('INSERT INTO PromocionProducto (id_promocion, id_producto) VALUES (?,?)', [promoPrem, origen.id])

  // Inventario por ubicación
  const inv = (id_variante, ubic, cant) => r('INSERT INTO Inventario (id_variante, ubicacion, cantidad) VALUES (?,?,?)', [id_variante, ubic, cant])
  ;[casa, origen, tarde].forEach((p) => { inv(p.variantes[0], 'Dark Store Surco', 60); inv(p.variantes[0], 'Tostaduría Lima', 40); inv(p.variantes[1], 'Tostaduría Lima', 25) })
  verdes.forEach((v) => inv(v.variantes[0], 'Almacén Villa Rica', 20))

  // ---- Lotes, unidades con QR y telemetría
  const lote = (codigo, id_producto, finca, productor, alt, variedad, proceso, sca, cosecha, tipo) =>
    r(`INSERT INTO LoteCafe (codigo_lote, id_producto, finca_origen, productor, altura_msnm, variedad, proceso, puntaje_sca, fecha_cosecha, tipo)
       VALUES (?,?,?,?,?,?,?,?,?,?)`, [codigo, id_producto, finca, productor, alt, variedad, proceso, sca, cosecha, tipo])
  const lotes = [
    ...tostados.map((t) => ({
      codigo: t.src.batch, pref: t.src.batch, tipo: 'BOLSA', peso: 0.25,
      id: lote(t.src.batch, t.id, t.src.composition[0].finca, t.src.producer, parseInt(t.src.altitude.replace(/\D/g, ''), 10),
        t.src.variety, t.src.process, t.src.sca, '2026-07-10', 'TOSTADO'),
    })),
    ...verdes.map((v) => ({
      codigo: v.src.batch, pref: v.src.batch, tipo: 'COSTAL', peso: 60,
      id: lote(v.src.batch, v.id, v.src.finca, v.src.productor, v.src.altitude, v.src.variety, v.src.process, v.src.sca, '2026-07-15', 'VERDE'),
    })),
  ]
  for (const l of lotes) {
    const n = l.tipo === 'BOLSA' ? 12 : 6
    for (let i = 1; i <= n; i++) {
      r('INSERT INTO UnidadEmpaque (id_lote, codigo_qr, tipo, peso_kg) VALUES (?,?,?,?)',
        [l.id, `${l.pref}-${l.tipo === 'BOLSA' ? 'U' : 'S'}${String(i).padStart(3, '0')}`, l.tipo, l.peso])
    }
    for (let h = 11; h >= 0; h--) {
      r('INSERT INTO TelemetriaIoT (id_lote, nivel_humedad, nivel_co2_ppm, nivel_desgasificacion, leido_en) VALUES (?,?,?,?,?)',
        [l.id, Math.round((10.6 + Math.sin(h + l.id) * 0.6) * 100) / 100, 400 + ((h * 37 + l.id * 11) % 90), Math.round(Math.abs(Math.cos(h)) * 250) / 100, hace(0, h * 2)])
    }
  }

  // ---- Cadena de trazabilidad firmada por inspectores
  for (const l of lotes) {
    const finca = hdb.get('SELECT finca_origen FROM LoteCafe WHERE id_lote = ?', [l.id]).finca_origen
    await registrarEtapa(hdb, { codigo_lote: l.codigo, tipo: 'FINCA', ubicacion: `${finca}, Villa Rica (Pasco)`, codigo_empleado: l.tipo === 'BOLSA' ? 'IC1' : 'IC2', fecha: hace(20, 2), detalle: 'Cosecha seleccionada a mano' })
    await registrarEtapa(hdb, { codigo_lote: l.codigo, tipo: 'DARK_STORE', ubicacion: l.tipo === 'BOLSA' ? 'Dark Store Surco, Lima' : 'Almacén Villa Rica', codigo_empleado: 'IE1', fecha: hace(12, 5), detalle: 'Recepción y control de humedad' })
    if (l.tipo === 'BOLSA') {
      await registrarEtapa(hdb, { codigo_lote: l.codigo, tipo: 'TUESTE', ubicacion: 'Tostaduría Lima', codigo_empleado: 'IP1', fecha: hace(3, 4), detalle: 'Tueste medio, 12 min a 205 °C' })
    } else if (l.codigo === verdes[0].src.batch) {
      await registrarEtapa(hdb, { codigo_lote: l.codigo, tipo: 'EXPORTACION', ubicacion: 'Puerto del Callao', codigo_empleado: 'IE1', fecha: hace(2, 1), detalle: 'Contenedor con destino Hamburgo' })
    }
  }

  // ---- Clientes de demostración (contraseña: demo123)
  const pass = await sha256('demo123')
  const cli = (nombre, email, tel, seg, tipo_b2b, empresa, ruc, pais, plan, idioma = 'es') => {
    const id = r(`INSERT INTO Cliente (nombre, email, telefono, password_hash, tipo_segmento, tipo_b2b, empresa, ruc_taxid, pais, idioma, creado_en)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [nombre, email, tel, pass, seg, tipo_b2b, empresa, ruc, pais, idioma, hace(30)])
    r('INSERT INTO Membresia (id_cliente, id_plan, inicio) VALUES (?, (SELECT id_plan FROM Plan WHERE nombre = ?), ?)', [id, plan, soloFecha(sumarDias(new Date(), -30))])
    return id
  }
  const lucia = cli('Lucía Mendoza', 'cliente@hauspe.pe', '987654321', 'B2C', null, null, null, 'Perú', 'Gratuito')
  const diego = cli('Diego Paredes', 'premium@hauspe.pe', '912345678', 'B2C', null, null, null, 'Perú', 'Premium')
  const horeca = cli('Valeria Ríos', 'horeca@hauspe.pe', '955123456', 'B2B', 'HORECA', 'Café Barranco S.A.C.', '20601234567', 'Perú', 'HORECA')
  const nordic = cli('Lukas Becker', 'import@nordicroasters.de', '4915112345678', 'B2B', 'IMPORTADOR', 'Nordic Roasters GmbH', 'DE298765432', 'Alemania', 'Exportador', 'en')

  guardarPerfilSabor(hdb, lucia, { notas_preferidas: 'Chocolate, nuez', tipo_molienda: 'Media', metodo_extraccion: 'Prensa francesa', intensidad: 4 })
  guardarPerfilSabor(hdb, diego, { notas_preferidas: 'Cítricos, floral', tipo_molienda: 'Media-fina', metodo_extraccion: 'V60', intensidad: 3 })
  agregarNota(hdb, diego, 'Prefiere su latte con leche de avena.', 'BA1')
  agregarNota(hdb, horeca, 'Reposición quincenal, recibe por la puerta de servicio.', 'AD1')

  const dir = (id, distrito, d) => r('INSERT INTO Direccion (id_cliente, id_zona, direccion, predeterminada) VALUES (?, (SELECT id_zona FROM ZonaReparto WHERE distrito = ?), ?, 1)', [id, distrito, d])
  const dLucia = dir(lucia, 'Villa El Salvador', 'Av. Micaela Bastidas 123')
  const dDiego = dir(diego, 'Miraflores', 'Calle Berlín 456')
  dir(horeca, 'Barranco', 'Jr. Unión 210')

  // ---- Pedidos de demostración en distintos estados
  const p1 = await crearPedido(hdb, { id_cliente: lucia, items: [{ id_variante: casa.variantes[0], cantidad: 1 }], id_direccion: dLucia, distrito: 'Villa El Salvador', referencia: '483920' })
  const p2 = await crearPedido(hdb, { id_cliente: diego, items: [{ id_variante: origen.variantes[0], cantidad: 1, precio_unitario: 54.4, configuracion: { frecuencia: 'SEMANAL', molienda: 'V60' } }], frecuencia: 'SEMANAL', id_direccion: dDiego, distrito: 'Miraflores', referencia: '571204' })
  await avanzarPedido(hdb, p2.codigo)
  const p3 = await crearPedido(hdb, { id_cliente: horeca, items: [{ id_variante: tarde.variantes[1], cantidad: 3 }], distrito: 'Barranco', metodoPago: 'TRANSFERENCIA', referencia: 'OP-88213' })
  await avanzarPedido(hdb, p3.codigo); await avanzarPedido(hdb, p3.codigo); await avanzarPedido(hdb, p3.codigo, { codigo_repartidor: "RD1" })
  await crearPedido(hdb, { canal: 'POS', items: [{ id_variante: hdb.get(`SELECT id_variante FROM VarianteProducto v JOIN Producto p USING(id_producto) WHERE p.sku='bebida-latte' LIMIT 1`).id_variante, cantidad: 2 }], metodoPago: 'EFECTIVO' })
  await crearPedido(hdb, { id_cliente: nordic, items: [{ id_variante: verdes[0].variantes[0], cantidad: 10 }], incoterm: 'CIF', pais_destino: 'Alemania', flete: 252, descuentoVolumen: 0.03 })
  // Pedido antiguo ya entregado (historial)
  const p6 = await crearPedido(hdb, { id_cliente: lucia, items: [{ id_variante: tarde.variantes[0], cantidad: 2 }], id_direccion: dLucia, distrito: 'Villa El Salvador', referencia: '110233' })
  for (let i = 0; i < 4; i++) await avanzarPedido(hdb, p6.codigo)
  hdb.run('UPDATE Pedido SET fecha = ? WHERE codigo = ?', [hace(9), p6.codigo])
  void p1

  // Suscripción que vence pronto → genera recordatorio de reposición
  hdb.run(`UPDATE SuscripcionCafe SET proximo_envio = ? WHERE id_cliente = ?`, [soloFecha(sumarDias(new Date(), 2)), diego])
  r(`INSERT INTO Recordatorio (id_cliente, tipo, mensaje, programado_en) VALUES (?, 'REPOSICION', 'Hola Diego, tu café Origen se acaba en 2 días. ¿Lo enviamos?', ?)`, [diego, fechaLocal()])
  r(`INSERT INTO Recordatorio (id_cliente, tipo, mensaje, programado_en) VALUES (?, 'REPOSICION_HORECA', 'Valeria, toca la reposición quincenal de Tarde 1 kg para Café Barranco.', ?)`, [horeca, fechaLocal(sumarDias(new Date(), 1))])
  r(`INSERT INTO Recordatorio (id_cliente, tipo, mensaje, programado_en) VALUES (?, 'NUEVA_COSECHA', 'Llegó la nueva cosecha de Geisha La Esperanza (SCA 87.5).', ?)`, [nordic, fechaLocal()])

  // Leads O2O capturados desde el QR del vaso
  r(`INSERT INTO Lead (nombre, whatsapp, origen, codigo_qr, creado_en) VALUES ('Andrea', '976543210', 'QR', 'HP-ORI-0925', ?)`, [hace(1)])
  r(`INSERT INTO Lead (nombre, email, origen, codigo_qr, id_cliente, creado_en) VALUES ('Lucía Mendoza', 'cliente@hauspe.pe', 'QR', 'HP-CASA-0925', ?, ?)`, [lucia, hace(30)])

  r(`INSERT INTO Valoracion (id_cliente, id_producto, puntuacion, comentario) VALUES (?,?,5,'Se siente el chocolate, perfecto en prensa.')`, [lucia, casa.id])
  r(`INSERT INTO Valoracion (id_cliente, id_producto, puntuacion, comentario) VALUES (?,?,5,'El mejor para V60.')`, [diego, origen.id])
  r(`INSERT INTO ListaDeseos (id_cliente, id_producto) VALUES (?,?)`, [diego, packV60.id])
  r(`INSERT INTO ArticuloBlog (titulo, slug, contenido) VALUES ('¿Qué es el puntaje SCA?', 'puntaje-sca', 'La Specialty Coffee Association califica el café de 0 a 100. Desde 80 puntos es café de especialidad.')`)
}
