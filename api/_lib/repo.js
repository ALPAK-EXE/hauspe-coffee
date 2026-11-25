// Repositorio del servidor: la lógica de negocio de HausPe sobre MySQL con Prisma.
// Cada función recibe "db": el PrismaClient o un cliente de transacción (tx). Así las mismas
// funciones sirven para la API y para las pruebas, que corren dentro de una transacción con rollback.
import bcrypt from 'bcryptjs'
import {
  IGV, round2, sha256, fechaLima, dia, aSegundos, sumarHoras, sumarDias, codigoPedido, limpiar,
} from './core.js'

const PLAN_POR_DEFECTO = { B2C: 'Gratuito', HORECA: 'HORECA', IMPORTADOR: 'Exportador' }
const DIAS_FRECUENCIA = { SEMANAL: 7, QUINCENAL: 15, MENSUAL: 30 }
export const DESCUENTO_FRECUENCIA = { SEMANAL: 0.15, QUINCENAL: 0.1, MENSUAL: 0.05 }
const OPCIONES_TX = { maxWait: 15000, timeout: 120000 }

// ---------------------------------------------------------------- transacciones
/**
 * Ejecuta fn de forma atómica. Con el cliente base abre una transacción real (BEGIN/COMMIT/ROLLBACK):
 * si algo falla, MySQL deshace todo. Si ya estamos dentro de una transacción (las pruebas), participa en ella.
 * (Prisma no permite SAVEPOINT en MySQL, por eso no hay transacciones anidadas.)
 */
export async function atomico(db, fn) {
  if (typeof db.$transaction === 'function') return db.$transaction((tx) => fn(tx), OPCIONES_TX)
  return fn(db)
}

// ---------------------------------------------------------------- reglas de negocio
// Normalmente las aplican los triggers de MySQL (prisma/sql/extras.sql). Si el servidor no permite
// crearlos (binlog activo y usuario sin SUPER), la app aplica las mismas reglas en código.
let cacheTriggers = { en: 0, activos: false }
export async function triggersActivos(db) {
  if (Date.now() - cacheTriggers.en < 30000) return cacheTriggers.activos
  const [r] = await db.$queryRaw`SELECT COUNT(*) AS n FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND trigger_name LIKE 'trg%'`
  cacheTriggers = { en: Date.now(), activos: Number(r.n) >= 4 }
  return cacheTriggers.activos
}

async function reglasDeDetalle(db, { pedido, variante, cantidad }) {
  if (variante.moneda !== pedido.moneda) throw new Error('No se pueden mezclar monedas en un mismo pedido')
  if (pedido.tipo !== 'VENTA') return
  await db.varianteProducto.update({ where: { id_variante: variante.id_variante }, data: { stock: { decrement: cantidad } } })
  const receta = await db.recetaInsumo.findMany({ where: { id_variante: variante.id_variante } })
  for (const r of receta) {
    await db.insumo.update({ where: { id_insumo: r.id_insumo }, data: { stock: { decrement: cantidad * r.cantidad } } })
  }
}

// ---------------------------------------------------------------- CLIENTES
export async function registrarCliente(db, datos) {
  const email = String(datos.email || '').trim().toLowerCase()
  if (!email || !datos.password || !datos.nombre) throw new Error('Nombre, correo y contraseña son obligatorios')
  if (await db.cliente.findUnique({ where: { email } })) throw new Error('Ese correo ya está registrado')
  const segmento = datos.tipo_segmento === 'B2B' ? 'B2B' : 'B2C'
  const tipo_b2b = segmento === 'B2B' ? datos.tipo_b2b || 'HORECA' : null
  const password_hash = await bcrypt.hash(String(datos.password), 10)
  const id = await atomico(db, async (tx) => {
    const c = await tx.cliente.create({
      data: {
        nombre: datos.nombre, email, telefono: datos.telefono || null, password_hash, tipo_segmento: segmento, tipo_b2b,
        empresa: datos.empresa || null, ruc_taxid: datos.ruc_taxid || null, pais: datos.pais || 'Perú',
        idioma: tipo_b2b === 'IMPORTADOR' ? 'en' : 'es', creado_en: aSegundos(),
      },
    })
    const plan = await tx.plan.findUnique({ where: { nombre: PLAN_POR_DEFECTO[tipo_b2b || 'B2C'] } })
    await tx.membresia.create({ data: { id_cliente: c.id_cliente, id_plan: plan.id_plan, inicio: dia() } })
    if (datos.codigo_qr || datos.id_lead) {
      const o = []
      if (datos.id_lead) o.push({ id_lead: Number(datos.id_lead) })
      if (datos.codigo_qr) {
        const contacto = [{ email }]
        if (datos.telefono) contacto.push({ whatsapp: datos.telefono })
        o.push({ codigo_qr: datos.codigo_qr, id_cliente: null, OR: contacto })
      }
      await tx.lead.updateMany({ where: { OR: o }, data: { id_cliente: c.id_cliente } })
    }
    return c.id_cliente
  })
  return getCliente(db, id)
}

export async function login(db, email, password) {
  const c = await db.cliente.findUnique({ where: { email: String(email).trim().toLowerCase() } })
  if (!c || !(await bcrypt.compare(String(password), c.password_hash))) return null
  return getCliente(db, c.id_cliente)
}

/** Login del personal (tabla Empleado). Devuelve los datos públicos del empleado o null. */
export async function loginEmpleado(db, email, password) {
  const e = await db.empleado.findUnique({ where: { email: String(email).trim().toLowerCase() } })
  if (!e?.password_hash || !(await bcrypt.compare(String(password), e.password_hash))) return null
  return { id_empleado: e.id_empleado, codigo: e.codigo, nombre: e.nombre, rol: e.rol, email: e.email }
}

export async function getCliente(db, id) {
  const c = await db.cliente.findUnique({
    relationLoadStrategy: 'join', where: { id_cliente: Number(id) },
    include: { membresias: { where: { estado: 'ACTIVA' }, orderBy: { id_membresia: 'desc' }, take: 1, include: { plan: true } } },
  })
  if (!c) return null
  const { membresias, password_hash: _omitido, ...resto } = c
  void _omitido
  const plan = membresias[0]?.plan
  return limpiar({ ...resto, plan: plan?.nombre ?? null, beneficios: plan?.beneficios ?? [] })
}

export async function listarClientes(db) {
  return limpiar(await db.cliente.findMany({ select: { id_cliente: true, nombre: true, email: true }, orderBy: { nombre: 'asc' } }))
}

export async function listarPlanes(db) {
  return limpiar(await db.plan.findMany({ where: { activo: true }, orderBy: { id_plan: 'asc' } }))
}

export async function cambiarPlan(db, id_cliente, nombrePlan) {
  const plan = await db.plan.findUnique({ where: { nombre: nombrePlan } })
  if (!plan) throw new Error('Plan inexistente')
  const cli = await getCliente(db, id_cliente)
  if (!cli) throw new Error('Cliente inexistente')
  if (plan.segmento !== cli.tipo_segmento) throw new Error(`El plan ${nombrePlan} no corresponde a un cliente ${cli.tipo_segmento}`)
  await atomico(db, async (tx) => {
    await tx.membresia.updateMany({ where: { id_cliente, estado: 'ACTIVA' }, data: { estado: 'CANCELADA', fin: dia() } })
    await tx.membresia.create({ data: { id_cliente, id_plan: plan.id_plan, inicio: dia() } })
  })
  return getCliente(db, id_cliente)
}

/** Suscripciones de café de un cliente (solo las suyas). */
export async function listarSuscripciones(db, id_cliente) {
  const r = await db.suscripcionCafe.findMany({
    where: { id_cliente }, orderBy: { id_suscripcion: 'desc' }, include: { variante: { include: { producto: true } } },
  })
  return limpiar(r.map((s) => ({
    id_suscripcion: s.id_suscripcion, producto: s.variante.producto.nombre, presentacion: s.variante.descripcion,
    frecuencia: s.frecuencia, estado: s.estado, inicio: s.inicio, proximo_envio: s.proximo_envio,
  })))
}

export async function guardarPerfilSabor(db, id_cliente, perfil) {
  const data = {
    notas_preferidas: perfil.notas_preferidas || null, tipo_molienda: perfil.tipo_molienda || null,
    metodo_extraccion: perfil.metodo_extraccion || null, intensidad: perfil.intensidad ?? null, actualizado_en: aSegundos(),
  }
  await db.perfilSabor.upsert({ where: { id_cliente }, create: { id_cliente, ...data }, update: data })
  return { ok: true }
}

export async function registrarLead(db, { nombre, whatsapp, email, origen = 'QR', codigo_qr }) {
  if (!whatsapp && !email) throw new Error('Se necesita WhatsApp o correo')
  const l = await db.lead.create({
    data: { nombre: nombre || null, whatsapp: whatsapp || null, email: email || null, origen, codigo_qr: codigo_qr || null, creado_en: aSegundos() },
  })
  return l.id_lead
}

/** CRM para el barista: perfil, historial y notas del cliente. */
export async function fichaCliente(db, id_cliente) {
  const [cliente, perfil, pedidos, notas] = await Promise.all([
    getCliente(db, id_cliente),
    db.perfilSabor.findUnique({ where: { id_cliente } }),
    db.pedido.findMany({
      where: { id_cliente }, orderBy: [{ fecha: 'desc' }, { id_pedido: 'desc' }],
      select: { codigo: true, canal: true, estado: true, moneda: true, total: true, fecha: true },
    }),
    db.clienteNota.findMany({ where: { id_cliente }, orderBy: [{ creada_en: 'desc' }, { id_nota: 'desc' }], include: { empleado: { select: { codigo: true } } } }),
  ])
  return limpiar({ cliente, perfil, pedidos, notas: notas.map((n) => ({ nota: n.nota, creada_en: n.creada_en, empleado: n.empleado?.codigo ?? null })) })
}

export async function agregarNota(db, id_cliente, nota, codigo_empleado) {
  const emp = codigo_empleado ? await db.empleado.findUnique({ where: { codigo: codigo_empleado } }) : null
  await db.clienteNota.create({ data: { id_cliente, id_empleado: emp?.id_empleado ?? null, nota, creada_en: aSegundos() } })
  return { ok: true }
}

export async function listarEmpleados(db, { sinAdmin = false } = {}) {
  // nunca se devuelven correos ni hashes
  return limpiar(await db.empleado.findMany({
    where: sinAdmin ? { rol: { not: 'ADMIN' } } : {}, orderBy: { codigo: 'asc' }, select: { id_empleado: true, codigo: true, nombre: true, rol: true },
  }))
}

// ---------------------------------------------------------------- CATÁLOGO
const aplanarVariante = ({ producto, ...v }) => ({ ...v, sku: producto.sku, nombre: producto.nombre, tipo: producto.tipo, categoria: producto.categoria })

export async function listarVariantes(db, { tipo } = {}) {
  const r = await db.varianteProducto.findMany({
    where: { producto: { activo: true, ...(tipo ? { tipo } : {}) } },
    include: { producto: true },
    orderBy: [{ id_producto: 'asc' }, { id_variante: 'asc' }],
  })
  return limpiar(r.map(aplanarVariante))
}

export async function varianteDe(db, sku, descripcion) {
  const v = await db.varianteProducto.findFirst({
    where: { producto: { sku }, ...(descripcion ? { descripcion } : {}) },
    orderBy: { id_variante: 'asc' },
  })
  return limpiar(v)
}

export async function listarZonas(db) {
  return limpiar(await db.zonaReparto.findMany({ where: { activa: true }, orderBy: { distrito: 'asc' } }))
}

export async function listarInsumos(db) {
  const r = await db.insumo.findMany({ orderBy: [{ unidad: 'asc' }, { nombre: 'asc' }] })
  return r.map((i) => ({ nombre: i.nombre, unidad: i.unidad, stock: i.stock, stock_minimo: i.stock_minimo, bajo: i.stock <= i.stock_minimo }))
}

export async function recetaDe(db, id_variante) {
  const r = await db.recetaInsumo.findMany({ where: { id_variante }, include: { insumo: true } })
  return r
    .map((x) => ({ nombre: x.insumo.nombre, cantidad: x.cantidad, unidad: x.insumo.unidad }))
    .sort((a, b) => a.unidad.localeCompare(b.unidad) || a.nombre.localeCompare(b.nombre))
}

export async function listarInventario(db) {
  const r = await db.inventario.findMany({ include: { variante: { include: { producto: true } } } })
  return r
    .map((i) => ({ ubicacion: i.ubicacion, cantidad: i.cantidad, nombre: i.variante.producto.nombre, descripcion: i.variante.descripcion, stock: i.variante.stock }))
    .sort((a, b) => a.ubicacion.localeCompare(b.ubicacion) || a.nombre.localeCompare(b.nombre))
}

// ---------------------------------------------------------------- PEDIDOS
const INCLUDE_PEDIDO = {
  cliente: { select: { nombre: true, email: true } },
  comprobante: true,
  entrega: { include: { zona: true } },
  detalles: {
    orderBy: { id_detalle: 'asc' },
    include: { variante: { include: { producto: true } }, unidades: { include: { unidad: { include: { lote: true } } } } },
  },
}

function formaPedido(p) {
  const { cliente, comprobante: cp, entrega: e, detalles, ...base } = p
  return {
    ...base,
    cliente: cliente?.nombre ?? null,
    email: cliente?.email ?? null,
    comprobante_tipo: cp?.tipo ?? null,
    serie: cp?.serie ?? null,
    numero: cp?.numero ?? null,
    base_imponible: cp?.base_imponible ?? null,
    igv: cp?.igv ?? null,
    programada_para: e?.programada_para ?? null,
    preparada_en: e?.preparada_en ?? null,
    despachada_en: e?.despachada_en ?? null,
    entregada_en: e?.entregada_en ?? null,
    distrito: e?.zona?.distrito ?? null,
    numero_comprobante: cp ? `${cp.serie}-${String(cp.numero).padStart(8, '0')}` : null,
    items: detalles.map((d) => ({
      id_detalle: d.id_detalle,
      cantidad: d.cantidad,
      precio_unitario: d.precio_unitario,
      configuracion: d.configuracion ?? null,
      nombre: d.variante.producto.nombre,
      descripcion: d.variante.descripcion,
      tipo: d.variante.producto.tipo,
      unidades: d.unidades.map((u) => ({ codigo_qr: u.unidad.codigo_qr, tipo: u.unidad.tipo, codigo_lote: u.unidad.lote.codigo_lote })),
    })),
  }
}

export async function getPedido(db, codigo) {
  const p = await db.pedido.findUnique({ relationLoadStrategy: 'join', where: { codigo }, include: INCLUDE_PEDIDO })
  return p ? limpiar(formaPedido(p)) : null
}

export async function listarPedidos(db, { estados, id_cliente, canal } = {}) {
  const where = {}
  if (estados?.length) where.estado = { in: estados }
  if (id_cliente) where.id_cliente = Number(id_cliente)
  if (canal) where.canal = canal
  const r = await db.pedido.findMany({ relationLoadStrategy: 'join', where, include: INCLUDE_PEDIDO, orderBy: [{ fecha: 'desc' }, { id_pedido: 'desc' }] })
  return limpiar(r.map(formaPedido))
}

/**
 * Crea un pedido completo en una transacción:
 * Pedido + DetallePedido + Pago + Comprobante + Entrega + unidades de empaque (QR).
 * items: [{ id_variante, cantidad, precio_unitario?, configuracion? }]
 *
 * Cada consulta cuesta un viaje de red a MySQL, así que está armado para minimizarlos:
 * 1) UNA ronda de lecturas en paralelo (variantes, cliente, zona, triggers, numeración, unidades QR);
 * 2) la transacción solo escribe (BEGIN, pedido, detalle, unidades, comprobante, pago, entrega, COMMIT);
 * 3) la respuesta se arma en memoria, sin volver a leer el pedido.
 * Si dos compras simultáneas chocan (mismo número de comprobante o misma bolsa), se reintenta con datos frescos.
 */
export async function crearPedido(db, datos, intento = 0) {
  try {
    return await crearPedidoUnaVez(db, datos)
  } catch (e) {
    const choque = e?.code === 'P2002' || e?.code === 'P2034' || e?.choqueUnidades
    if (choque && intento < 2 && typeof db.$transaction === 'function') return crearPedido(db, datos, intento + 1)
    throw e
  }
}

async function crearPedidoUnaVez(db, {
  id_cliente = null, canal = 'WEB', items, id_direccion = null, distrito = null,
  metodoPago = 'YAPE', referencia = null, incoterm = null, pais_destino = null, flete = 0,
  frecuencia = null, descuentoVolumen = 0,
}) {
  if (!items?.length) throw new Error('El pedido no tiene productos')
  const [filas, cliente, zona, sinTriggers, numeracion, candidatas] = await Promise.all([
    Promise.all(items.map((it) => db.varianteProducto.findUnique({ where: { id_variante: Number(it.id_variante) }, include: { producto: true } }))),
    id_cliente ? getCliente(db, id_cliente) : null,
    distrito ? db.zonaReparto.findFirst({ where: { distrito, activa: true } }) : null,
    triggersActivos(db).then((a) => !a),
    db.comprobante.groupBy({ by: ['serie'], _max: { numero: true } }),
    Promise.all(items.map((it) => db.unidadEmpaque.findMany({
      where: { estado: 'EN_ALMACEN', lote: { producto: { variantes: { some: { id_variante: Number(it.id_variante) } } } } },
      orderBy: { id_unidad: 'asc' }, take: Number(it.cantidad) || 1, include: { lote: { select: { codigo_lote: true } } },
    }))),
  ])
  const enApp = sinTriggers
  const variantes = filas.map((v, i) => {
    if (!v) throw new Error('Producto inexistente')
    const { producto, ...vv } = v
    const it = items[i]
    return {
      ...vv, precio: Number(vv.precio), tipo: producto.tipo, nombre: producto.nombre,
      cantidad: Number(it.cantidad), configuracion: it.configuracion,
      precio_unitario: round2(it.precio_unitario ?? Number(vv.precio)),
    }
  })
  const moneda = variantes[0].moneda
  const esCotizacion = moneda === 'USD'
  if (esCotizacion && !incoterm) throw new Error('La cotización de exportación necesita Incoterm (FOB o CIF)')
  if (esCotizacion && cliente?.tipo_b2b !== 'IMPORTADOR') throw new Error('Solo un importador puede cotizar café verde de exportación')
  if (distrito && !zona) throw new Error(`No repartimos en ${distrito}`)

  const subtotal = round2(variantes.reduce((s, v) => s + v.precio_unitario * v.cantidad, 0))
  const descuento = round2(subtotal * descuentoVolumen)
  const costo_envio = esCotizacion ? round2(incoterm === 'CIF' ? flete : 0) : zona ? Number(zona.costo_envio) : 0
  const total = round2(subtotal - descuento + costo_envio)
  const codigo = codigoPedido()
  const ahora = aSegundos()

  // Bolsas o costales con QR: dos renglones del mismo producto no pueden llevarse la misma unidad
  const usadas = new Set()
  const unidadesPorItem = variantes.map((v, i) => {
    if (v.tipo !== 'CAFE' && v.tipo !== 'VERDE') return []
    const elegidas = candidatas[i].filter((u) => !usadas.has(u.id_unidad)).slice(0, v.cantidad)
    elegidas.forEach((u) => usadas.add(u.id_unidad))
    return elegidas
  })

  // Comprobante: boleta (B2C), factura (B2B con RUC) o cotización de exportación sin IGV
  const tipoComp = esCotizacion ? 'COTIZACION' : cliente?.tipo_segmento === 'B2B' ? 'FACTURA' : 'BOLETA'
  const serie = { BOLETA: 'B001', FACTURA: 'F001', COTIZACION: 'COT' }[tipoComp]
  const numero = (numeracion.find((n) => n.serie === serie)?._max.numero || 0) + 1
  const base = esCotizacion ? total : round2(total / (1 + IGV))
  const igv = round2(total - base)
  if (enApp && tipoComp === 'COTIZACION' && igv !== 0) throw new Error('La exportación de bienes no está gravada con IGV')
  const programada = sumarHoras(ahora, 24)

  const { pedido, detalles } = await atomico(db, async (tx) => {
    let id_suscripcion = null
    if (frecuencia && !esCotizacion) {
      const s = await tx.suscripcionCafe.create({
        data: {
          id_cliente, id_variante: variantes[0].id_variante, frecuencia, inicio: dia(),
          proximo_envio: dia(sumarDias(ahora, DIAS_FRECUENCIA[frecuencia])),
        },
      })
      id_suscripcion = s.id_suscripcion
    }
    const pedido = await tx.pedido.create({
      data: {
        codigo, id_cliente, id_direccion, id_suscripcion, canal, tipo: esCotizacion ? 'COTIZACION' : 'VENTA', moneda, incoterm,
        pais_destino, estado: esCotizacion ? 'COTIZADO' : 'PAGADO', fecha: ahora, subtotal, descuento, costo_envio, total,
      },
    })
    const detalles = []
    for (const [i, v] of variantes.entries()) {
      const d = await tx.detallePedido.create({
        data: {
          id_pedido: pedido.id_pedido, id_variante: v.id_variante, cantidad: v.cantidad, precio_unitario: v.precio_unitario,
          configuracion: v.configuracion ?? undefined,
        },
      })
      detalles.push(d)
      if (enApp) await reglasDeDetalle(tx, { pedido, variante: v, cantidad: v.cantidad })
      const unidades = unidadesPorItem[i]
      if (unidades.length) {
        const ids = unidades.map((u) => u.id_unidad)
        await tx.pedidoUnidad.createMany({ data: ids.map((id_unidad) => ({ id_detalle: d.id_detalle, id_unidad })) })
        // si otra compra se llevó una bolsa entre la lectura y ahora, se revierte y se reintenta con datos frescos
        const r = await tx.unidadEmpaque.updateMany({ where: { id_unidad: { in: ids }, estado: 'EN_ALMACEN' }, data: { estado: 'RESERVADA' } })
        if (r.count !== ids.length) throw Object.assign(new Error('Las unidades con QR ya no están disponibles'), { choqueUnidades: true })
      }
    }
    await tx.comprobante.create({
      data: { id_pedido: pedido.id_pedido, tipo: tipoComp, serie, numero, doc_cliente: cliente?.ruc_taxid || null, base_imponible: base, igv, total, emitido_en: ahora },
    })
    if (!esCotizacion) {
      await tx.pago.create({ data: { id_pedido: pedido.id_pedido, metodo: metodoPago, monto: total, referencia, pagado_en: ahora } })
      if (canal !== 'POS') await tx.entrega.create({ data: { id_pedido: pedido.id_pedido, id_zona: zona?.id_zona ?? null, programada_para: programada } })
    }
    return { pedido, detalles }
  })

  // Misma forma que getPedido, armada con lo que ya tenemos
  return limpiar({
    ...pedido,
    cliente: cliente?.nombre ?? null, email: cliente?.email ?? null,
    comprobante_tipo: tipoComp, serie, numero, base_imponible: base, igv,
    programada_para: !esCotizacion && canal !== 'POS' ? programada : null, preparada_en: null, despachada_en: null, entregada_en: null,
    distrito: !esCotizacion && canal !== 'POS' ? zona?.distrito ?? null : null,
    numero_comprobante: `${serie}-${String(numero).padStart(8, '0')}`,
    items: variantes.map((v, i) => ({
      id_detalle: detalles[i].id_detalle, cantidad: v.cantidad, precio_unitario: v.precio_unitario, configuracion: v.configuracion ?? null,
      nombre: v.nombre, descripcion: v.descripcion, tipo: v.tipo,
      unidades: unidadesPorItem[i].map((u) => ({ codigo_qr: u.codigo_qr, tipo: u.tipo, codigo_lote: u.lote.codigo_lote })),
    })),
  })
}

const FLUJO_ESTADOS = ['PAGADO', 'EN_PREPARACION', 'LISTO', 'DESPACHADO', 'ENTREGADO']
export async function avanzarPedido(db, codigo, { codigo_repartidor, estadosPermitidos } = {}) {
  const p = await db.pedido.findUnique({ where: { codigo }, include: { cliente: { select: { nombre: true } } } })
  if (!p) throw new Error('Pedido inexistente')
  p.cliente = p.cliente?.nombre ?? null
  if (estadosPermitidos && !estadosPermitidos.includes(p.estado)) {
    throw Object.assign(new Error(`Tu rol no puede avanzar un pedido en estado ${p.estado}`), { status: 403 })
  }
  const i = FLUJO_ESTADOS.indexOf(p.estado)
  if (i < 0 || i === FLUJO_ESTADOS.length - 1) throw new Error(`El pedido está en estado ${p.estado}`)
  const nuevo = FLUJO_ESTADOS[i + 1]
  await atomico(db, async (tx) => {
    const ahora = aSegundos()
    const deEstePedido = { pedido: { detalle: { id_pedido: p.id_pedido } } }
    await tx.pedido.update({ where: { id_pedido: p.id_pedido }, data: { estado: nuevo } })
    if (nuevo === 'LISTO') {
      await tx.entrega.updateMany({ where: { id_pedido: p.id_pedido }, data: { preparada_en: ahora } })
      if (p.id_cliente) {
        await tx.recordatorio.create({
          data: {
            id_cliente: p.id_cliente, id_pedido: p.id_pedido, tipo: 'PEDIDO_LISTO', mensaje: `Hola ${p.cliente}, tu pedido ${p.codigo} está listo.`,
            programado_en: ahora, enviado_en: ahora, estado: 'ENVIADO',
          },
        })
      }
    }
    if (nuevo === 'DESPACHADO') {
      const rep = await tx.empleado.findUnique({ where: { codigo: codigo_repartidor || 'RD1' } })
      await tx.entrega.updateMany({ where: { id_pedido: p.id_pedido }, data: { despachada_en: ahora, id_empleado: rep?.id_empleado ?? null } })
      await tx.unidadEmpaque.updateMany({ where: deEstePedido, data: { estado: 'DESPACHADA' } })
    }
    if (nuevo === 'ENTREGADO') {
      await tx.entrega.updateMany({ where: { id_pedido: p.id_pedido }, data: { entregada_en: ahora } })
      await tx.unidadEmpaque.updateMany({ where: deEstePedido, data: { estado: 'ENTREGADA' } })
    }
  })
  return { codigo, id_pedido: p.id_pedido, estado: nuevo }
}

/** Dark store: pedidos con su tiempo restante frente al límite de 24 h. */
export async function colaDarkStore(db) {
  const r = await db.entrega.findMany({
    relationLoadStrategy: 'join', where: { pedido: { estado: { in: ['PAGADO', 'EN_PREPARACION', 'LISTO', 'DESPACHADO'] } } },
    include: { pedido: { include: { cliente: { select: { nombre: true } } } }, zona: true },
    orderBy: { programada_para: 'asc' },
  })
  const ahora = Date.now()
  return r.map((e) => {
    const restanteMs = e.programada_para.getTime() - ahora
    return limpiar({
      codigo: e.pedido.codigo, estado: e.pedido.estado, cliente: e.pedido.cliente?.nombre ?? null,
      distrito: e.zona?.distrito ?? null, programada_para: e.programada_para,
      restanteMin: Math.round(restanteMs / 60000), atrasado: restanteMs < 0,
    })
  })
}

// ---------------------------------------------------------------- TRAZABILIDAD / BLOCKCHAIN
const GENESIS = '0'.repeat(64)

const contenidoFirma = (e, f, codigo_empleado) =>
  JSON.stringify([e.codigo_lote, e.orden, e.tipo, e.ubicacion, e.fecha, codigo_empleado, f.firmado_en, f.hash_anterior])

/** Registra una etapa (finca, dark store, tueste, exportación, delivery) y la sella con la firma del inspector. */
export async function registrarEtapa(db, { codigo_lote, tipo, ubicacion, codigo_empleado, fecha, detalle }) {
  const lote = await db.loteCafe.findUnique({ where: { codigo_lote } })
  if (!lote) throw new Error('Lote inexistente')
  const emp = await db.empleado.findUnique({ where: { codigo: codigo_empleado } })
  if (!emp) throw new Error(`No existe el inspector ${codigo_empleado}`)
  const ultima = await db.etapaTrazabilidad.findFirst({
    where: { id_lote: lote.id_lote, firma: { isNot: null } }, orderBy: { orden: 'desc' }, include: { firma: true },
  })
  const orden = (ultima?.orden || 0) + 1
  const instante = aSegundos(fecha ? new Date(fecha) : new Date())
  const firmado_en = fechaLima(instante)
  const hash_anterior = ultima?.firma.hash || GENESIS
  const hash = await sha256(contenidoFirma({ codigo_lote, orden, tipo, ubicacion: ubicacion || null, fecha: firmado_en }, { firmado_en, hash_anterior }, codigo_empleado))
  await atomico(db, async (tx) => {
    const etapa = await tx.etapaTrazabilidad.create({
      data: { id_lote: lote.id_lote, orden, tipo, ubicacion: ubicacion || null, fecha: instante, detalle: detalle || null },
    })
    await tx.firmaEtapa.create({ data: { id_etapa: etapa.id_etapa, id_empleado: emp.id_empleado, firmado_en: instante, hash, hash_anterior } })
  })
  return { orden, hash, hash_anterior, inspector: `${emp.codigo} · ${emp.nombre}` }
}

export async function rutaLote(db, codigo_lote) {
  const r = await db.etapaTrazabilidad.findMany({
    relationLoadStrategy: 'join', where: { lote: { codigo_lote } }, orderBy: { orden: 'asc' }, include: { firma: { include: { empleado: true } } },
  })
  return limpiar(r.map((e) => ({
    orden: e.orden, tipo: e.tipo, ubicacion: e.ubicacion, fecha: e.fecha, detalle: e.detalle,
    firmado_en: e.firma?.firmado_en ?? null, hash: e.firma?.hash ?? null, hash_anterior: e.firma?.hash_anterior ?? null,
    codigo_inspector: e.firma?.empleado.codigo ?? null, inspector: e.firma?.empleado.nombre ?? null, rol: e.firma?.empleado.rol ?? null,
  })))
}

/** Recalcula cada hash de la cadena; si alguien alteró un dato, indica en qué etapa se rompe. */
export async function verificarCadena(db, codigo_lote) {
  const ruta = await rutaLote(db, codigo_lote)
  let anterior = GENESIS
  for (const r of ruta) {
    const esperado = await sha256(contenidoFirma({ ...r, codigo_lote }, { firmado_en: r.firmado_en, hash_anterior: anterior }, r.codigo_inspector))
    if (r.hash_anterior !== anterior || r.hash !== esperado) return { ok: false, rotoEn: r.orden, etapa: r.tipo, bloques: ruta.length }
    anterior = r.hash
  }
  return { ok: true, bloques: ruta.length, ultimoHash: anterior }
}

// ---------------------------------------------------------------- IoT
export const RANGO_HUMEDAD = [10, 12]

export async function registrarTelemetria(db, codigo_lote, { humedad, co2, desgasificacion = null, leido_en }) {
  const h = Number(humedad)
  const c = Number(co2)
  if (!Number.isFinite(h) || !Number.isFinite(c)) throw new Error('Lectura inválida')
  const lote = await db.loteCafe.findUnique({ where: { codigo_lote } })
  if (!lote) throw new Error('Lote inexistente')
  await db.telemetriaIoT.create({
    data: { id_lote: lote.id_lote, nivel_humedad: h, nivel_co2_ppm: c, nivel_desgasificacion: desgasificacion, leido_en: aSegundos(leido_en ? new Date(leido_en) : new Date()) },
  })
  return { alerta: h < RANGO_HUMEDAD[0] || h > RANGO_HUMEDAD[1] }
}

export async function simularSensor(db, codigo_lote, n = 1) {
  const out = []
  for (let i = 0; i < n; i++) {
    const humedad = round2(10.4 + Math.random() * 1.4 + (Math.random() < 0.1 ? 1.5 : 0))
    const co2 = Math.round(380 + Math.random() * 120)
    out.push(await registrarTelemetria(db, codigo_lote, { humedad, co2, desgasificacion: round2(Math.random() * 3) }))
  }
  return out
}

/** Una lectura nueva por cada lote (el panel de lotes lo usa al abrirse). */
export async function simularTodos(db) {
  const lotes = await db.loteCafe.findMany({ select: { codigo_lote: true } })
  for (const l of lotes) await simularSensor(db, l.codigo_lote, 1)
  return lotes.length
}

export async function telemetriaLote(db, codigo_lote, limite = 24) {
  const r = await db.telemetriaIoT.findMany({
    where: { lote: { codigo_lote } }, orderBy: [{ leido_en: 'desc' }, { id_registro: 'desc' }], take: limite,
  })
  return limpiar(r.reverse().map((t) => ({ humedad: t.nivel_humedad, co2: t.nivel_co2_ppm, desgasificacion: t.nivel_desgasificacion, leido_en: t.leido_en })))
}

export async function listarLotes(db) {
  const r = await db.loteCafe.findMany({ select: { codigo_lote: true, tipo: true, finca_origen: true } })
  return r.sort((a, b) => b.tipo.localeCompare(a.tipo) || a.codigo_lote.localeCompare(b.codigo_lote))
}

/** Dashboard de todos los lotes con su última lectura y estado de la cadena. */
export async function dashboardLotes(db) {
  const r = await db.loteCafe.findMany({
    include: {
      _count: { select: { etapas: true, unidades: true } },
      etapas: { orderBy: { orden: 'desc' }, take: 1, select: { tipo: true } },
      telemetria: { orderBy: [{ leido_en: 'desc' }, { id_registro: 'desc' }], take: 1 },
    },
  })
  return limpiar(
    r.map((l) => {
      const t = l.telemetria[0]
      const humedad = t?.nivel_humedad ?? null
      return {
        codigo_lote: l.codigo_lote, tipo: l.tipo, finca_origen: l.finca_origen, variedad: l.variedad, puntaje_sca: l.puntaje_sca,
        humedad, co2: t?.nivel_co2_ppm ?? null, etapas: l._count.etapas, etapa_actual: l.etapas[0]?.tipo ?? null, unidades: l._count.unidades,
        alerta: humedad != null && (humedad < RANGO_HUMEDAD[0] || humedad > RANGO_HUMEDAD[1]),
      }
    }).sort((a, b) => a.tipo.localeCompare(b.tipo) || a.codigo_lote.localeCompare(b.codigo_lote)),
  )
}

// ---------------------------------------------------------------- QR / PASAPORTE
/** Acepta el código de un lote o de una unidad (bolsa o costal). */
export async function pasaporte(db, codigo) {
  const u = await db.unidadEmpaque.findUnique({
    relationLoadStrategy: 'join', where: { codigo_qr: codigo },
    include: { lote: true, pedido: { include: { detalle: { include: { pedido: { select: { codigo: true, estado: true } } } } } } },
  })
  const lote = u ? u.lote : await db.loteCafe.findUnique({ where: { codigo_lote: codigo } })
  if (!lote) return null
  const { lote: _l, pedido: pu, ...unidad } = u ?? {}
  void _l
  const pedido = pu ? pu.detalle.pedido : null
  const guia = lote.id_producto
    ? (await db.producto.findUnique({ where: { id_producto: lote.id_producto }, include: { guia: true } }))?.guia ?? null
    : null
  const [ruta, telemetria, verificacion] = await Promise.all([rutaLote(db, lote.codigo_lote), telemetriaLote(db, lote.codigo_lote), verificarCadena(db, lote.codigo_lote)])
  return limpiar({
    lote, unidad: u ? unidad : null, pedido,
    vista: u?.tipo === 'COSTAL' || lote.tipo === 'VERDE' ? 'TECNICA' : 'CONSUMIDOR',
    ruta, telemetria, verificacion, guia,
  })
}

export async function unidadesDeLote(db, codigo_lote) {
  return limpiar(await db.unidadEmpaque.findMany({ where: { lote: { codigo_lote } }, orderBy: { id_unidad: 'asc' } }))
}

// ---------------------------------------------------------------- RECORDATORIOS
export async function listarRecordatorios(db, { estado } = {}) {
  const r = await db.recordatorio.findMany({
    where: estado ? { estado } : {}, include: { cliente: { select: { nombre: true, telefono: true } } }, orderBy: { programado_en: 'desc' },
  })
  return limpiar(r.map(({ cliente, ...x }) => ({ ...x, cliente: cliente.nombre, telefono: cliente.telefono })))
}

/** Genera recordatorios de reposición para suscripciones que vencen en 3 días o menos. */
export async function generarRecordatoriosReposicion(db) {
  const ahora = aSegundos()
  const subs = await db.suscripcionCafe.findMany({
    where: { estado: 'ACTIVA', proximo_envio: { lte: dia(sumarDias(ahora, 3)) } },
    include: { cliente: true, variante: { include: { producto: true } } },
  })
  let n = 0
  for (const s of subs) {
    const reciente = await db.recordatorio.count({
      where: { id_cliente: s.id_cliente, tipo: 'REPOSICION', programado_en: { gte: sumarDias(ahora, -3) } },
    })
    if (reciente) continue
    await db.recordatorio.create({
      data: {
        id_cliente: s.id_cliente, tipo: 'REPOSICION', programado_en: ahora,
        mensaje: `Hola ${s.cliente.nombre}, tu café ${s.variante.producto.nombre} se acaba pronto. ¿Lo enviamos?`,
      },
    })
    n++
  }
  return n
}

export async function enviarRecordatorio(db, id_recordatorio) {
  await db.recordatorio.update({ where: { id_recordatorio }, data: { estado: 'ENVIADO', enviado_en: aSegundos() } })
  return { ok: true }
}

// ---------------------------------------------------------------- INICIO
/** Cifras de la portada leídas de la base de datos. */
export async function cifrasInicio(db) {
  const [fincas, lotes, firmas, sca] = await Promise.all([
    db.loteCafe.findMany({ distinct: ['finca_origen'], select: { id_lote: true } }),
    db.loteCafe.count(),
    db.firmaEtapa.count(),
    db.loteCafe.aggregate({ _max: { puntaje_sca: true } }),
  ])
  return { fincas: fincas.length, lotes, firmas, sca: sca._max.puntaje_sca }
}
