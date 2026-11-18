// Repositorio: operaciones de negocio de HausPe sobre la base de datos.
import { IGV, round2, sha256, fechaLocal, soloFecha, sumarHoras, sumarDias } from './core.js'

const PLAN_POR_DEFECTO = { B2C: 'Gratuito', HORECA: 'HORECA', IMPORTADOR: 'Exportador' }
const DIAS_FRECUENCIA = { SEMANAL: 7, QUINCENAL: 15, MENSUAL: 30 }
export const DESCUENTO_FRECUENCIA = { SEMANAL: 0.15, QUINCENAL: 0.1, MENSUAL: 0.05 }

const codigoPedido = () =>
  'HP-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0')

// ------------------------------------------------------------------ CLIENTES
export async function registrarCliente(hdb, datos) {
  const email = String(datos.email || '').trim().toLowerCase()
  if (!email || !datos.password || !datos.nombre) throw new Error('Nombre, correo y contraseña son obligatorios')
  if (hdb.get('SELECT 1 FROM Cliente WHERE email = ?', [email])) throw new Error('Ese correo ya está registrado')
  const segmento = datos.tipo_segmento === 'B2B' ? 'B2B' : 'B2C'
  const tipo_b2b = segmento === 'B2B' ? datos.tipo_b2b || 'HORECA' : null
  const hash = await sha256(datos.password)
  return hdb.tx(async () => {
    const { lastId } = hdb.run(
      `INSERT INTO Cliente (nombre, email, telefono, password_hash, tipo_segmento, tipo_b2b, empresa, ruc_taxid, pais, idioma)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [datos.nombre, email, datos.telefono || null, hash, segmento, tipo_b2b, datos.empresa || null,
        datos.ruc_taxid || null, datos.pais || 'Perú', tipo_b2b === 'IMPORTADOR' ? 'en' : 'es'],
    )
    const plan = PLAN_POR_DEFECTO[tipo_b2b || 'B2C']
    hdb.run(
      `INSERT INTO Membresia (id_cliente, id_plan) VALUES (?, (SELECT id_plan FROM Plan WHERE nombre = ?))`,
      [lastId, plan],
    )
    if (datos.codigo_qr || datos.id_lead) {
      hdb.run('UPDATE Lead SET id_cliente = ? WHERE id_lead = ? OR (codigo_qr = ? AND id_cliente IS NULL AND (email = ? OR whatsapp = ?))',
        [lastId, datos.id_lead || -1, datos.codigo_qr || '', email, datos.telefono || ''])
    }
    return getCliente(hdb, lastId)
  })
}

export async function login(hdb, email, password) {
  const c = hdb.get('SELECT id_cliente, password_hash FROM Cliente WHERE email = ?', [String(email).trim().toLowerCase()])
  if (!c || c.password_hash !== (await sha256(password))) return null
  return getCliente(hdb, c.id_cliente)
}

export function getCliente(hdb, id) {
  const c = hdb.get(
    `SELECT c.id_cliente, c.nombre, c.email, c.telefono, c.tipo_segmento, c.tipo_b2b, c.empresa, c.ruc_taxid, c.pais, c.idioma, c.creado_en,
            p.nombre AS plan, p.beneficios
     FROM Cliente c
     LEFT JOIN Membresia m ON m.id_cliente = c.id_cliente AND m.estado = 'ACTIVA'
     LEFT JOIN Plan p ON p.id_plan = m.id_plan
     WHERE c.id_cliente = ?`,
    [id],
  )
  if (!c) return null
  return { ...c, beneficios: JSON.parse(c.beneficios || '[]') }
}

export function listarPlanes(hdb) {
  return hdb.all('SELECT * FROM Plan WHERE activo = 1 ORDER BY id_plan').map((p) => ({ ...p, beneficios: JSON.parse(p.beneficios) }))
}

export async function cambiarPlan(hdb, id_cliente, nombrePlan) {
  const plan = hdb.get('SELECT * FROM Plan WHERE nombre = ?', [nombrePlan])
  if (!plan) throw new Error('Plan inexistente')
  const cli = getCliente(hdb, id_cliente)
  if (plan.segmento !== cli.tipo_segmento) throw new Error(`El plan ${nombrePlan} no corresponde a un cliente ${cli.tipo_segmento}`)
  return hdb.tx(async () => {
    hdb.run(`UPDATE Membresia SET estado = 'CANCELADA', fin = date('now','localtime') WHERE id_cliente = ? AND estado = 'ACTIVA'`, [id_cliente])
    hdb.run('INSERT INTO Membresia (id_cliente, id_plan) VALUES (?, ?)', [id_cliente, plan.id_plan])
    return getCliente(hdb, id_cliente)
  })
}

export function guardarPerfilSabor(hdb, id_cliente, perfil) {
  return hdb.run(
    `INSERT INTO PerfilSabor (id_cliente, notas_preferidas, tipo_molienda, metodo_extraccion, intensidad, actualizado_en)
     VALUES (?,?,?,?,?, datetime('now','localtime'))
     ON CONFLICT(id_cliente) DO UPDATE SET notas_preferidas = excluded.notas_preferidas, tipo_molienda = excluded.tipo_molienda,
       metodo_extraccion = excluded.metodo_extraccion, intensidad = excluded.intensidad, actualizado_en = excluded.actualizado_en`,
    [id_cliente, perfil.notas_preferidas || null, perfil.tipo_molienda || null, perfil.metodo_extraccion || null, perfil.intensidad ?? null],
  )
}

export function registrarLead(hdb, { nombre, whatsapp, email, origen = 'QR', codigo_qr }) {
  if (!whatsapp && !email) throw new Error('Se necesita WhatsApp o correo')
  return hdb.run('INSERT INTO Lead (nombre, whatsapp, email, origen, codigo_qr) VALUES (?,?,?,?,?)',
    [nombre || null, whatsapp || null, email || null, origen, codigo_qr || null]).lastId
}

// CRM para el barista: perfil, historial y notas del cliente
export function fichaCliente(hdb, id_cliente) {
  return {
    cliente: getCliente(hdb, id_cliente),
    perfil: hdb.get('SELECT * FROM PerfilSabor WHERE id_cliente = ?', [id_cliente]),
    pedidos: hdb.all('SELECT codigo, canal, estado, moneda, total, fecha FROM Pedido WHERE id_cliente = ? ORDER BY fecha DESC', [id_cliente]),
    notas: hdb.all(
      `SELECT n.nota, n.creada_en, e.codigo AS empleado FROM ClienteNota n LEFT JOIN Empleado e ON e.id_empleado = n.id_empleado
       WHERE n.id_cliente = ? ORDER BY n.creada_en DESC`, [id_cliente]),
  }
}

export function agregarNota(hdb, id_cliente, nota, codigo_empleado) {
  return hdb.run(
    'INSERT INTO ClienteNota (id_cliente, id_empleado, nota) VALUES (?, (SELECT id_empleado FROM Empleado WHERE codigo = ?), ?)',
    [id_cliente, codigo_empleado || null, nota],
  )
}

// ------------------------------------------------------------------ CATÁLOGO
export function listarVariantes(hdb, { tipo } = {}) {
  return hdb.all(
    `SELECT v.*, p.sku, p.nombre, p.tipo, p.categoria FROM VarianteProducto v JOIN Producto p ON p.id_producto = v.id_producto
     WHERE p.activo = 1 ${tipo ? 'AND p.tipo = ?' : ''} ORDER BY p.id_producto, v.id_variante`,
    tipo ? [tipo] : [],
  )
}

export function varianteDe(hdb, sku, descripcion) {
  return hdb.get(
    `SELECT v.* FROM VarianteProducto v JOIN Producto p ON p.id_producto = v.id_producto
     WHERE p.sku = ? ${descripcion ? 'AND v.descripcion = ?' : ''} ORDER BY v.id_variante LIMIT 1`,
    descripcion ? [sku, descripcion] : [sku],
  )
}

// ------------------------------------------------------------------ PEDIDOS
/**
 * Crea un pedido completo en una transacción:
 * Pedido + DetallePedido + Pago + Comprobante + Entrega + unidades de empaque (QR) + recordatorio.
 * items: [{ id_variante, cantidad, precio_unitario?, configuracion? }]
 */
export async function crearPedido(hdb, {
  id_cliente = null, canal = 'WEB', items, id_direccion = null, distrito = null,
  metodoPago = 'YAPE', referencia = null, incoterm = null, pais_destino = null, flete = 0,
  frecuencia = null, descuentoVolumen = 0,
}) {
  if (!items?.length) throw new Error('El pedido no tiene productos')
  const variantes = items.map((it) => {
    const v = hdb.get(
      'SELECT v.*, p.tipo, p.nombre FROM VarianteProducto v JOIN Producto p ON p.id_producto = v.id_producto WHERE v.id_variante = ?',
      [it.id_variante],
    )
    if (!v) throw new Error('Producto inexistente')
    return { ...v, ...it, precio_unitario: round2(it.precio_unitario ?? v.precio) }
  })
  const moneda = variantes[0].moneda
  const esCotizacion = moneda === 'USD'
  if (esCotizacion && !incoterm) throw new Error('La cotización de exportación necesita Incoterm (FOB o CIF)')
  const cliente = id_cliente ? getCliente(hdb, id_cliente) : null
  if (esCotizacion && cliente?.tipo_b2b !== 'IMPORTADOR') throw new Error('Solo un importador puede cotizar café verde de exportación')

  const zona = distrito ? hdb.get('SELECT * FROM ZonaReparto WHERE distrito = ? AND activa = 1', [distrito]) : null
  if (distrito && !zona) throw new Error(`No repartimos en ${distrito}`)

  const subtotal = round2(variantes.reduce((s, v) => s + v.precio_unitario * v.cantidad, 0))
  const descuento = round2(subtotal * descuentoVolumen)
  const costo_envio = esCotizacion ? round2(incoterm === 'CIF' ? flete : 0) : zona ? zona.costo_envio : 0
  const total = round2(subtotal - descuento + costo_envio)

  return hdb.tx(async () => {
    let id_suscripcion = null
    if (frecuencia && !esCotizacion) {
      const proximo = soloFecha(sumarDias(new Date(), DIAS_FRECUENCIA[frecuencia]))
      id_suscripcion = hdb.run(
        'INSERT INTO SuscripcionCafe (id_cliente, id_variante, frecuencia, proximo_envio) VALUES (?,?,?,?)',
        [id_cliente, variantes[0].id_variante, frecuencia, proximo],
      ).lastId
    }
    const codigo = codigoPedido()
    const { lastId: id_pedido } = hdb.run(
      `INSERT INTO Pedido (codigo, id_cliente, id_direccion, id_suscripcion, canal, tipo, moneda, incoterm, pais_destino, estado,
                           subtotal, descuento, costo_envio, total)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [codigo, id_cliente, id_direccion, id_suscripcion, canal, esCotizacion ? 'COTIZACION' : 'VENTA', moneda, incoterm,
        pais_destino, esCotizacion ? 'COTIZADO' : 'PAGADO', subtotal, descuento, costo_envio, total],
    )

    for (const v of variantes) {
      const { lastId: id_detalle } = hdb.run(
        'INSERT INTO DetallePedido (id_pedido, id_variante, cantidad, precio_unitario, configuracion) VALUES (?,?,?,?,?)',
        [id_pedido, v.id_variante, v.cantidad, v.precio_unitario, v.configuracion ? JSON.stringify(v.configuracion) : null],
      )
      // Asigna unidades físicas con QR (bolsas o costales) del lote del producto
      if (v.tipo === 'CAFE' || v.tipo === 'VERDE') {
        const unidades = hdb.all(
          `SELECT u.id_unidad FROM UnidadEmpaque u JOIN LoteCafe l ON l.id_lote = u.id_lote
           WHERE l.id_producto = ? AND u.estado = 'EN_ALMACEN' ORDER BY u.id_unidad LIMIT ?`,
          [v.id_producto, v.cantidad],
        )
        for (const u of unidades) {
          hdb.run('INSERT INTO PedidoUnidad (id_detalle, id_unidad) VALUES (?,?)', [id_detalle, u.id_unidad])
          hdb.run(`UPDATE UnidadEmpaque SET estado = 'RESERVADA' WHERE id_unidad = ?`, [u.id_unidad])
        }
      }
    }

    // Comprobante: boleta (B2C), factura (B2B con RUC) o cotización de exportación sin IGV
    const tipoComp = esCotizacion ? 'COTIZACION' : cliente?.tipo_segmento === 'B2B' ? 'FACTURA' : 'BOLETA'
    const serie = { BOLETA: 'B001', FACTURA: 'F001', COTIZACION: 'COT' }[tipoComp]
    const numero = (hdb.get('SELECT MAX(numero) AS n FROM Comprobante WHERE serie = ?', [serie]).n || 0) + 1
    const base = esCotizacion ? total : round2(total / (1 + IGV))
    const igv = round2(total - base)
    hdb.run(
      'INSERT INTO Comprobante (id_pedido, tipo, serie, numero, doc_cliente, base_imponible, igv, total) VALUES (?,?,?,?,?,?,?,?)',
      [id_pedido, tipoComp, serie, numero, cliente?.ruc_taxid || null, base, igv, total],
    )

    if (!esCotizacion) {
      hdb.run('INSERT INTO Pago (id_pedido, metodo, monto, referencia) VALUES (?,?,?,?)', [id_pedido, metodoPago, total, referencia])
      if (canal !== 'POS') {
        hdb.run('INSERT INTO Entrega (id_pedido, id_zona, programada_para) VALUES (?,?,?)',
          [id_pedido, zona?.id_zona ?? null, fechaLocal(sumarHoras(new Date(), 24))])
      }
    }
    return getPedido(hdb, codigo)
  })
}

export function getPedido(hdb, codigo) {
  const p = hdb.get(
    `SELECT p.*, c.nombre AS cliente, c.email, cp.tipo AS comprobante_tipo, cp.serie, cp.numero, cp.base_imponible, cp.igv,
            e.programada_para, e.preparada_en, e.despachada_en, e.entregada_en, z.distrito
     FROM Pedido p
     LEFT JOIN Cliente c ON c.id_cliente = p.id_cliente
     LEFT JOIN Comprobante cp ON cp.id_pedido = p.id_pedido
     LEFT JOIN Entrega e ON e.id_pedido = p.id_pedido
     LEFT JOIN ZonaReparto z ON z.id_zona = e.id_zona
     WHERE p.codigo = ?`,
    [codigo],
  )
  if (!p) return null
  p.numero_comprobante = p.serie ? `${p.serie}-${String(p.numero).padStart(8, '0')}` : null
  p.items = hdb.all(
    `SELECT d.id_detalle, d.cantidad, d.precio_unitario, d.configuracion, pr.nombre, v.descripcion, pr.tipo
     FROM DetallePedido d JOIN VarianteProducto v ON v.id_variante = d.id_variante JOIN Producto pr ON pr.id_producto = v.id_producto
     WHERE d.id_pedido = ?`, [p.id_pedido],
  ).map((it) => ({
    ...it,
    configuracion: it.configuracion ? JSON.parse(it.configuracion) : null,
    unidades: hdb.all(
      `SELECT u.codigo_qr, u.tipo, l.codigo_lote FROM PedidoUnidad pu JOIN UnidadEmpaque u ON u.id_unidad = pu.id_unidad
       JOIN LoteCafe l ON l.id_lote = u.id_lote WHERE pu.id_detalle = ?`, [it.id_detalle]),
  }))
  return p
}

export function listarPedidos(hdb, { estados, id_cliente, canal } = {}) {
  const where = []
  const params = []
  if (estados?.length) { where.push(`p.estado IN (${estados.map(() => '?').join(',')})`); params.push(...estados) }
  if (id_cliente) { where.push('p.id_cliente = ?'); params.push(id_cliente) }
  if (canal) { where.push('p.canal = ?'); params.push(canal) }
  return hdb.all(
    `SELECT p.codigo FROM Pedido p ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.fecha DESC, p.id_pedido DESC`,
    params,
  ).map((r) => getPedido(hdb, r.codigo))
}

const FLUJO_ESTADOS = ['PAGADO', 'EN_PREPARACION', 'LISTO', 'DESPACHADO', 'ENTREGADO']
export function avanzarPedido(hdb, codigo, { codigo_repartidor } = {}) {
  const p = getPedido(hdb, codigo)
  if (!p) throw new Error('Pedido inexistente')
  const i = FLUJO_ESTADOS.indexOf(p.estado)
  if (i < 0 || i === FLUJO_ESTADOS.length - 1) throw new Error(`El pedido está en estado ${p.estado}`)
  const nuevo = FLUJO_ESTADOS[i + 1]
  return hdb.tx(async () => {
    hdb.run('UPDATE Pedido SET estado = ? WHERE id_pedido = ?', [nuevo, p.id_pedido])
    const ahora = fechaLocal()
    if (nuevo === 'LISTO') {
      hdb.run('UPDATE Entrega SET preparada_en = ? WHERE id_pedido = ?', [ahora, p.id_pedido])
      if (p.id_cliente) {
        hdb.run(`INSERT INTO Recordatorio (id_cliente, id_pedido, tipo, mensaje, programado_en, enviado_en, estado)
                 VALUES (?,?, 'PEDIDO_LISTO', ?, ?, ?, 'ENVIADO')`,
          [p.id_cliente, p.id_pedido, `Hola ${p.cliente}, tu pedido ${p.codigo} está listo.`, ahora, ahora])
      }
    }
    if (nuevo === 'DESPACHADO') {
      hdb.run(`UPDATE Entrega SET despachada_en = ?, id_empleado = (SELECT id_empleado FROM Empleado WHERE codigo = ?) WHERE id_pedido = ?`,
        [ahora, codigo_repartidor || 'RD1', p.id_pedido])
      hdb.run(`UPDATE UnidadEmpaque SET estado = 'DESPACHADA' WHERE id_unidad IN
               (SELECT pu.id_unidad FROM PedidoUnidad pu JOIN DetallePedido d ON d.id_detalle = pu.id_detalle WHERE d.id_pedido = ?)`, [p.id_pedido])
    }
    if (nuevo === 'ENTREGADO') {
      hdb.run('UPDATE Entrega SET entregada_en = ? WHERE id_pedido = ?', [ahora, p.id_pedido])
      hdb.run(`UPDATE UnidadEmpaque SET estado = 'ENTREGADA' WHERE id_unidad IN
               (SELECT pu.id_unidad FROM PedidoUnidad pu JOIN DetallePedido d ON d.id_detalle = pu.id_detalle WHERE d.id_pedido = ?)`, [p.id_pedido])
    }
    return getPedido(hdb, codigo)
  })
}

// Dark store: pedidos con su tiempo restante frente al límite de 24 h
export function colaDarkStore(hdb) {
  const ahora = Date.now()
  return hdb.all(
    `SELECT p.codigo, p.estado, c.nombre AS cliente, z.distrito, e.programada_para
     FROM Entrega e JOIN Pedido p ON p.id_pedido = e.id_pedido
     LEFT JOIN Cliente c ON c.id_cliente = p.id_cliente LEFT JOIN ZonaReparto z ON z.id_zona = e.id_zona
     WHERE p.estado IN ('PAGADO','EN_PREPARACION','LISTO','DESPACHADO') ORDER BY e.programada_para`,
  ).map((r) => {
    const restanteMs = new Date(r.programada_para.replace(' ', 'T')).getTime() - ahora
    return { ...r, restanteMin: Math.round(restanteMs / 60000), atrasado: restanteMs < 0 }
  })
}

export function listarZonas(hdb) {
  return hdb.all('SELECT * FROM ZonaReparto WHERE activa = 1 ORDER BY distrito')
}

export function listarInventario(hdb) {
  return hdb.all(
    `SELECT i.ubicacion, i.cantidad, p.nombre, v.descripcion, v.stock FROM Inventario i
     JOIN VarianteProducto v ON v.id_variante = i.id_variante JOIN Producto p ON p.id_producto = v.id_producto
     ORDER BY i.ubicacion, p.nombre`,
  )
}

// ------------------------------------------------------------------ TRAZABILIDAD / BLOCKCHAIN
const GENESIS = '0'.repeat(64)

function contenidoFirma(e, f, codigo_empleado) {
  return JSON.stringify([e.codigo_lote, e.orden, e.tipo, e.ubicacion, e.fecha, codigo_empleado, f.firmado_en, f.hash_anterior])
}

/** Registra una etapa (finca, dark store, tueste, exportación, delivery) y la sella con la firma del inspector. */
export async function registrarEtapa(hdb, { codigo_lote, tipo, ubicacion, codigo_empleado, fecha, detalle }) {
  const lote = hdb.get('SELECT * FROM LoteCafe WHERE codigo_lote = ?', [codigo_lote])
  if (!lote) throw new Error('Lote inexistente')
  const emp = hdb.get('SELECT * FROM Empleado WHERE codigo = ?', [codigo_empleado])
  if (!emp) throw new Error(`No existe el inspector ${codigo_empleado}`)
  const ultima = hdb.get(
    `SELECT e.orden, f.hash FROM EtapaTrazabilidad e JOIN FirmaEtapa f ON f.id_etapa = e.id_etapa
     WHERE e.id_lote = ? ORDER BY e.orden DESC LIMIT 1`, [lote.id_lote])
  const orden = (ultima?.orden || 0) + 1
  const firmado_en = fecha || fechaLocal()
  const etapa = { codigo_lote, orden, tipo, ubicacion: ubicacion || null, fecha: firmado_en }
  const firma = { firmado_en, hash_anterior: ultima?.hash || GENESIS }
  const hash = await sha256(contenidoFirma(etapa, firma, codigo_empleado))
  return hdb.tx(async () => {
    const { lastId } = hdb.run(
      'INSERT INTO EtapaTrazabilidad (id_lote, orden, tipo, ubicacion, fecha, detalle) VALUES (?,?,?,?,?,?)',
      [lote.id_lote, orden, tipo, etapa.ubicacion, firmado_en, detalle || null])
    hdb.run('INSERT INTO FirmaEtapa (id_etapa, id_empleado, firmado_en, hash, hash_anterior) VALUES (?,?,?,?,?)',
      [lastId, emp.id_empleado, firmado_en, hash, firma.hash_anterior])
    return { orden, hash, hash_anterior: firma.hash_anterior, inspector: `${emp.codigo} · ${emp.nombre}` }
  })
}

export function rutaLote(hdb, codigo_lote) {
  return hdb.all(
    `SELECT e.orden, e.tipo, e.ubicacion, e.fecha, e.detalle, f.firmado_en, f.hash, f.hash_anterior,
            em.codigo AS codigo_inspector, em.nombre AS inspector, em.rol
     FROM EtapaTrazabilidad e JOIN LoteCafe l ON l.id_lote = e.id_lote
     LEFT JOIN FirmaEtapa f ON f.id_etapa = e.id_etapa LEFT JOIN Empleado em ON em.id_empleado = f.id_empleado
     WHERE l.codigo_lote = ? ORDER BY e.orden`, [codigo_lote])
}

/** Recalcula cada hash de la cadena; si alguien alteró un dato, indica en qué etapa se rompe. */
export async function verificarCadena(hdb, codigo_lote) {
  const ruta = rutaLote(hdb, codigo_lote)
  let anterior = GENESIS
  for (const r of ruta) {
    const esperado = await sha256(contenidoFirma({ ...r, codigo_lote }, { firmado_en: r.firmado_en, hash_anterior: anterior }, r.codigo_inspector))
    if (r.hash_anterior !== anterior || r.hash !== esperado) return { ok: false, rotoEn: r.orden, etapa: r.tipo, bloques: ruta.length }
    anterior = r.hash
  }
  return { ok: true, bloques: ruta.length, ultimoHash: anterior }
}

// ------------------------------------------------------------------ IoT
export const RANGO_HUMEDAD = [10, 12]

export function registrarTelemetria(hdb, codigo_lote, { humedad, co2, desgasificacion = null, leido_en }) {
  const h = Number(humedad)
  const c = Number(co2)
  if (!Number.isFinite(h) || !Number.isFinite(c)) throw new Error('Lectura inválida')
  const lote = hdb.get('SELECT id_lote FROM LoteCafe WHERE codigo_lote = ?', [codigo_lote])
  if (!lote) throw new Error('Lote inexistente')
  hdb.run('INSERT INTO TelemetriaIoT (id_lote, nivel_humedad, nivel_co2_ppm, nivel_desgasificacion, leido_en) VALUES (?,?,?,?,?)',
    [lote.id_lote, h, c, desgasificacion, leido_en || fechaLocal()])
  return { alerta: h < RANGO_HUMEDAD[0] || h > RANGO_HUMEDAD[1] }
}

export function simularSensor(hdb, codigo_lote, n = 1) {
  const out = []
  for (let i = 0; i < n; i++) {
    const humedad = round2(10.4 + Math.random() * 1.4 + (Math.random() < 0.1 ? 1.5 : 0))
    const co2 = Math.round(380 + Math.random() * 120)
    out.push(registrarTelemetria(hdb, codigo_lote, { humedad, co2, desgasificacion: round2(Math.random() * 3) }))
  }
  return out
}

export function telemetriaLote(hdb, codigo_lote, limite = 24) {
  return hdb.all(
    `SELECT t.nivel_humedad AS humedad, t.nivel_co2_ppm AS co2, t.nivel_desgasificacion AS desgasificacion, t.leido_en
     FROM TelemetriaIoT t JOIN LoteCafe l ON l.id_lote = t.id_lote WHERE l.codigo_lote = ?
     ORDER BY t.leido_en DESC, t.id_registro DESC LIMIT ?`, [codigo_lote, limite]).reverse()
}

// Dashboard de todos los lotes con su última lectura y estado de la cadena
export function dashboardLotes(hdb) {
  return hdb.all(
    `SELECT l.codigo_lote, l.tipo, l.finca_origen, l.variedad, l.puntaje_sca,
       (SELECT nivel_humedad FROM TelemetriaIoT t WHERE t.id_lote = l.id_lote ORDER BY leido_en DESC, id_registro DESC LIMIT 1) AS humedad,
       (SELECT nivel_co2_ppm FROM TelemetriaIoT t WHERE t.id_lote = l.id_lote ORDER BY leido_en DESC, id_registro DESC LIMIT 1) AS co2,
       (SELECT COUNT(*) FROM EtapaTrazabilidad e WHERE e.id_lote = l.id_lote) AS etapas,
       (SELECT tipo FROM EtapaTrazabilidad e WHERE e.id_lote = l.id_lote ORDER BY orden DESC LIMIT 1) AS etapa_actual,
       (SELECT COUNT(*) FROM UnidadEmpaque u WHERE u.id_lote = l.id_lote) AS unidades
     FROM LoteCafe l ORDER BY l.tipo, l.codigo_lote`,
  ).map((l) => ({ ...l, alerta: l.humedad != null && (l.humedad < RANGO_HUMEDAD[0] || l.humedad > RANGO_HUMEDAD[1]) }))
}

// ------------------------------------------------------------------ QR / PASAPORTE
/** Acepta el código de un lote o de una unidad (bolsa o costal). */
export async function pasaporte(hdb, codigo) {
  const unidad = hdb.get('SELECT * FROM UnidadEmpaque WHERE codigo_qr = ?', [codigo])
  const lote = unidad
    ? hdb.get('SELECT * FROM LoteCafe WHERE id_lote = ?', [unidad.id_lote])
    : hdb.get('SELECT * FROM LoteCafe WHERE codigo_lote = ?', [codigo])
  if (!lote) return null
  const pedido = unidad
    ? hdb.get(`SELECT p.codigo, p.estado FROM PedidoUnidad pu JOIN DetallePedido d ON d.id_detalle = pu.id_detalle
               JOIN Pedido p ON p.id_pedido = d.id_pedido WHERE pu.id_unidad = ?`, [unidad.id_unidad])
    : null
  return {
    lote,
    unidad,
    pedido,
    vista: unidad?.tipo === 'COSTAL' || lote.tipo === 'VERDE' ? 'TECNICA' : 'CONSUMIDOR',
    ruta: rutaLote(hdb, lote.codigo_lote),
    telemetria: telemetriaLote(hdb, lote.codigo_lote),
    verificacion: await verificarCadena(hdb, lote.codigo_lote),
    guia: hdb.get('SELECT g.* FROM GuiaPreparacion g JOIN Producto p ON p.id_guia = g.id_guia WHERE p.id_producto = ?', [lote.id_producto]),
  }
}

export function unidadesDeLote(hdb, codigo_lote) {
  return hdb.all(
    `SELECT u.* FROM UnidadEmpaque u JOIN LoteCafe l ON l.id_lote = u.id_lote WHERE l.codigo_lote = ? ORDER BY u.id_unidad`,
    [codigo_lote])
}

// ------------------------------------------------------------------ RECORDATORIOS
export function listarRecordatorios(hdb, { estado } = {}) {
  return hdb.all(
    `SELECT r.*, c.nombre AS cliente, c.telefono FROM Recordatorio r JOIN Cliente c ON c.id_cliente = r.id_cliente
     ${estado ? 'WHERE r.estado = ?' : ''} ORDER BY r.programado_en DESC`, estado ? [estado] : [])
}

/** Genera recordatorios de reposición para suscripciones que vencen en 3 días o menos. */
export function generarRecordatoriosReposicion(hdb) {
  const subs = hdb.all(
    `SELECT s.*, c.nombre, p.nombre AS producto FROM SuscripcionCafe s JOIN Cliente c ON c.id_cliente = s.id_cliente
     JOIN VarianteProducto v ON v.id_variante = s.id_variante JOIN Producto p ON p.id_producto = v.id_producto
     WHERE s.estado = 'ACTIVA' AND julianday(s.proximo_envio) - julianday(date('now','localtime')) <= 3
       AND NOT EXISTS (SELECT 1 FROM Recordatorio r WHERE r.id_cliente = s.id_cliente AND r.tipo = 'REPOSICION'
                       AND r.programado_en >= date('now','localtime','-3 day'))`)
  subs.forEach((s) =>
    hdb.run(`INSERT INTO Recordatorio (id_cliente, tipo, mensaje, programado_en) VALUES (?, 'REPOSICION', ?, datetime('now','localtime'))`,
      [s.id_cliente, `Hola ${s.nombre}, tu café ${s.producto} se acaba pronto. ¿Lo enviamos?`]))
  return subs.length
}

export function enviarRecordatorio(hdb, id_recordatorio) {
  return hdb.run(`UPDATE Recordatorio SET estado = 'ENVIADO', enviado_en = datetime('now','localtime') WHERE id_recordatorio = ?`, [id_recordatorio])
}
