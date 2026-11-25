// Las 25 pruebas automáticas, ahora contra MySQL con Prisma.
// Corren dentro de UNA transacción interactiva que termina con un error controlado (Rollback):
// MySQL deshace todo y los datos de la demo quedan intactos.
import { prisma } from './prisma.js'
import * as repo from './repo.js'
import { dia, sumarDias } from './core.js'

class Rollback extends Error {
  constructor(resultados) {
    super('ROLLBACK controlado de las pruebas')
    this.resultados = resultados
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}
async function rechaza(fn, texto) {
  try {
    await fn()
  } catch (e) {
    const m = mensajeError(e)
    if (texto && !m.toLowerCase().includes(texto.toLowerCase())) throw new Error(`Falló con otro error: ${m}`, { cause: e })
    return m
  }
  throw new Error('Se esperaba un error y la operación se aceptó')
}

/** Mensaje legible de un error de Prisma/MySQL (la última línea, sin el ruido de la invocación). */
export function mensajeError(e) {
  let m = String(e?.meta?.message || e?.message || e).trim().split('\n').map((s) => s.trim()).filter(Boolean).pop() || 'Error'
  const raw = m.match(/Message: `(.*)`\.?$/) || m.match(/message: "([^"]*)"/)
  if (raw) m = raw[1]
  if (/check constraint/i.test(m)) m = m.replace(/check constraint/i, 'CHECK constraint')
  return m
}

const clienteDe = (db, email) => db.cliente.findUnique({ where: { email } }).then((c) => c.id_cliente)

export const PRUEBAS = [
  ['Esquema', 'Existen las tablas del modelo y las claves foráneas están activas', async (db) => {
    const [t] = await db.$queryRaw`SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`
    const [f] = await db.$queryRaw`SELECT @@foreign_key_checks AS fk`
    const n = Number(t.n)
    assert(n >= 33, `Solo hay ${n} tablas`)
    assert(Number(f.fk) === 1, 'foreign_key_checks está desactivado')
    return `${n} tablas, FK activas`
  }],
  ['Integridad', 'Una FK inválida se rechaza', async (db) =>
    rechaza(() => db.pedido.create({ data: { codigo: 'X1', id_cliente: 99999, canal: 'WEB', moneda: 'PEN' } }), 'foreign key')],
  ['Registro B2C', 'Crea Cliente + Membresía Gratuito y no permite correo duplicado', async (db) => {
    const c = await repo.registrarCliente(db, { nombre: 'Prueba', email: 'prueba@test.pe', password: 'abc123', telefono: '999888777' })
    assert(c.plan === 'Gratuito', 'Plan inicial incorrecto: ' + c.plan)
    await rechaza(() => repo.registrarCliente(db, { nombre: 'Otra', email: 'PRUEBA@test.pe', password: 'x' }), 'ya está registrado')
    const raw = (await db.cliente.findUnique({ where: { id_cliente: c.id_cliente } })).password_hash
    assert(raw.startsWith('$2') && raw !== 'abc123', 'La contraseña no está cifrada con bcrypt')
    return `id_cliente ${c.id_cliente}, contraseña guardada como bcrypt`
  }],
  ['Login', 'Valida contraseña correcta e incorrecta', async (db) => {
    assert(await repo.login(db, 'cliente@hauspe.pe', 'demo123'), 'No entra con la contraseña correcta')
    assert(!(await repo.login(db, 'cliente@hauspe.pe', 'mala')), 'Entró con contraseña incorrecta')
    return 'OK'
  }],
  ['Registro B2B', 'Importador recibe plan Exportador', async (db) => {
    const c = await repo.registrarCliente(db, { nombre: 'Anna', email: 'anna@roast.nl', password: 'x1', tipo_segmento: 'B2B', tipo_b2b: 'IMPORTADOR', empresa: 'Roast BV', ruc_taxid: 'NL123', pais: 'Países Bajos' })
    assert(c.plan === 'Exportador', c.plan)
    return `${c.empresa} → ${c.plan}`
  }],
  ['Planes', 'Upgrade a Premium y downgrade a Gratuito', async (db) => {
    const id = await clienteDe(db, 'cliente@hauspe.pe')
    assert((await repo.cambiarPlan(db, id, 'Premium')).plan === 'Premium', 'No subió a Premium')
    assert((await repo.cambiarPlan(db, id, 'Gratuito')).plan === 'Gratuito', 'No bajó a Gratuito')
    await rechaza(() => repo.cambiarPlan(db, id, 'Exportador'), 'no corresponde')
    return `${await db.membresia.count({ where: { id_cliente: id } })} membresías en el historial`
  }],
  ['Compra B2C', 'Pedido + detalle + pago + boleta con IGV + entrega en 24 h + bolsa con QR', async (db) => {
    const id = await clienteDe(db, 'cliente@hauspe.pe')
    const v = await repo.varianteDe(db, 'casa')
    const p = await repo.crearPedido(db, { id_cliente: id, items: [{ id_variante: v.id_variante, cantidad: 2 }], distrito: 'Santiago de Surco', referencia: '123456' })
    assert(p.comprobante_tipo === 'BOLETA' && p.serie === 'B001', 'Comprobante incorrecto')
    assert(Math.abs(p.base_imponible + p.igv - p.total) < 0.011, 'Base + IGV ≠ total')
    assert(p.total === 2 * 58 + 10, `Total esperado 126, obtenido ${p.total}`)
    assert((await repo.varianteDe(db, 'casa')).stock === v.stock - 2, 'No se descontó stock')
    assert(p.items[0].unidades.length === 2, 'No se asignaron bolsas con QR')
    const horas = (new Date(p.programada_para.replace(' ', 'T')) - new Date(p.fecha.replace(' ', 'T'))) / 3.6e6
    assert(Math.round(horas) === 24, 'La entrega no quedó a 24 h')
    return `${p.numero_comprobante}: base ${p.base_imponible} + IGV ${p.igv} = S/ ${p.total}`
  }],
  ['Suscripción', 'Compra semanal crea SuscripcionCafe con próximo envío a 7 días', async (db) => {
    const id = await clienteDe(db, 'premium@hauspe.pe')
    const v = await repo.varianteDe(db, 'origen')
    const p = await repo.crearPedido(db, { id_cliente: id, items: [{ id_variante: v.id_variante, cantidad: 1, precio_unitario: v.precio * 0.85 }], frecuencia: 'SEMANAL', referencia: '654321' })
    const s = await db.suscripcionCafe.findUnique({ where: { id_suscripcion: p.id_suscripcion } })
    const dias = Math.round((s.proximo_envio - s.inicio) / 864e5)
    assert(s.frecuencia === 'SEMANAL' && dias === 7, 'Suscripción mal creada')
    return `próximo envío ${s.proximo_envio.toISOString().slice(0, 10)}`
  }],
  ['Factura B2B', 'Cliente HORECA recibe factura F001 con su RUC', async (db) => {
    const id = await clienteDe(db, 'horeca@hauspe.pe')
    const v = await repo.varianteDe(db, 'tarde', '1 kg HORECA')
    const p = await repo.crearPedido(db, { id_cliente: id, items: [{ id_variante: v.id_variante, cantidad: 2 }], metodoPago: 'TRANSFERENCIA' })
    assert(p.comprobante_tipo === 'FACTURA' && p.serie === 'F001', 'No emitió factura')
    const c = await db.comprobante.findUnique({ where: { id_pedido: p.id_pedido } })
    return `${p.numero_comprobante}, RUC ${c.doc_cliente}`
  }],
  ['Exportación', 'Cotización CIF en USD sin IGV y con descuento por volumen', async (db) => {
    const imp = await db.cliente.findFirst({ where: { tipo_b2b: 'IMPORTADOR' }, orderBy: { id_cliente: 'asc' } })
    const v = (await repo.listarVariantes(db, { tipo: 'VERDE' }))[0]
    const p = await repo.crearPedido(db, { id_cliente: imp.id_cliente, items: [{ id_variante: v.id_variante, cantidad: 10 }], incoterm: 'CIF', pais_destino: 'Alemania', flete: 252, descuentoVolumen: 0.03 })
    assert(p.tipo === 'COTIZACION' && p.moneda === 'USD' && p.igv === 0, 'Cotización mal formada')
    assert(p.total === Math.round((v.precio * 10 * 0.97 + 252) * 100) / 100, 'Total de cotización incorrecto')
    assert(p.items[0].unidades.every((u) => u.tipo === 'COSTAL'), 'No asignó costales')
    return `${p.numero_comprobante}: US$ ${p.total} (IGV 0)`
  }],
  ['Reglas', 'Un suscriptor B2C no puede cotizar café verde', async (db) => {
    const id = await clienteDe(db, 'cliente@hauspe.pe')
    const v = (await repo.listarVariantes(db, { tipo: 'VERDE' }))[0]
    return rechaza(() => repo.crearPedido(db, { id_cliente: id, items: [{ id_variante: v.id_variante, cantidad: 5 }], incoterm: 'FOB' }), 'importador')
  }],
  ['Reglas', 'No se mezclan soles y dólares en un pedido (trigger)', async (db) => {
    const imp = await db.cliente.findFirst({ where: { tipo_b2b: 'IMPORTADOR' }, orderBy: { id_cliente: 'asc' } })
    const verde = (await repo.listarVariantes(db, { tipo: 'VERDE' }))[0]
    const casa = await repo.varianteDe(db, 'casa')
    return rechaza(() => repo.crearPedido(db, { id_cliente: imp.id_cliente, items: [{ id_variante: verde.id_variante, cantidad: 3 }, { id_variante: casa.id_variante, cantidad: 1 }], incoterm: 'FOB' }), 'mezclar monedas')
  }],
  // Esta prueba corre ANTES y en su propia transacción real (cliente base): el pedido falla a mitad de camino
  // y MySQL lo revierte entero. Se marca con "fuera" porque Prisma no admite SAVEPOINT dentro de otra transacción.
  ['Transacciones', 'Si falla un paso, se revierte todo el pedido', async (db) => {
    const antes = await db.pedido.count()
    const detallesAntes = await db.detallePedido.count()
    const v = await repo.varianteDe(db, 'origen')
    await rechaza(() => repo.crearPedido(db, { items: [{ id_variante: v.id_variante, cantidad: 100000 }], canal: 'POS', metodoPago: 'EFECTIVO' }), 'CHECK')
    assert((await db.pedido.count()) === antes && (await db.detallePedido.count()) === detallesAntes, 'Quedó un pedido a medias')
    return 'Sin stock: BEGIN → INSERT Pedido → falla el CHECK → ROLLBACK de todo el pedido'
  }, { fuera: true }],
  ['Barista / Dark store', 'El pedido avanza PAGADO → ENTREGADO y se marcan las fechas', async (db) => {
    const v = await repo.varianteDe(db, 'casa')
    const id = await clienteDe(db, 'premium@hauspe.pe')
    const p = await repo.crearPedido(db, { id_cliente: id, items: [{ id_variante: v.id_variante, cantidad: 1 }], distrito: 'Miraflores', referencia: '777777' })
    for (let i = 0; i < 4; i++) await repo.avanzarPedido(db, p.codigo)
    const f = await repo.getPedido(db, p.codigo)
    assert(f.estado === 'ENTREGADO' && f.preparada_en && f.despachada_en && f.entregada_en, 'Faltan fechas de entrega')
    assert((await db.recordatorio.count({ where: { id_pedido: f.id_pedido, tipo: 'PEDIDO_LISTO' } })) === 1, 'No avisó pedido listo')
    return `${f.codigo} entregado, aviso de WhatsApp registrado`
  }],
  ['Punto de venta', 'Venta presencial sin cliente (POS) no genera entrega', async (db) => {
    const v = await db.varianteProducto.findFirst({ where: { producto: { tipo: 'BEBIDA' } }, orderBy: { id_variante: 'asc' } })
    const p = await repo.crearPedido(db, { canal: 'POS', items: [{ id_variante: v.id_variante, cantidad: 2 }], metodoPago: 'EFECTIVO' })
    assert(p.canal === 'POS' && !p.programada_para, 'POS mal registrado')
    return `${p.codigo}: S/ ${p.total}`
  }],
  ['Insumos', 'Vender 2 lattes de 12 oz descuenta del almacén 36 g de café y 600 ml de leche', async (db) => {
    const v = await repo.varianteDe(db, 'bebida-latte', '12 oz')
    const stock = async (n) => (await db.insumo.findUnique({ where: { nombre: n } })).stock
    const cafe0 = await stock('Café Casa molido')
    const leche0 = await stock('Leche entera')
    await repo.crearPedido(db, { canal: 'POS', items: [{ id_variante: v.id_variante, cantidad: 2 }], metodoPago: 'EFECTIVO' })
    const cafe = cafe0 - (await stock('Café Casa molido'))
    assert(cafe === 36, `Café descontado: ${cafe} g`)
    const leche = leche0 - (await stock('Leche entera'))
    assert(leche === 600, `Leche descontada: ${leche} ml`)
    const bolsa = await repo.varianteDe(db, 'casa', '250 g')
    const g = (await repo.recetaDe(db, bolsa.id_variante)).filter((x) => x.unidad === 'g').reduce((s, x) => s + x.cantidad, 0)
    assert(g === 250, `La bolsa suma ${g} g`)
    return 'Café −36 g, leche −600 ml; la bolsa de Casa suma 250 g'
  }],
  ['Insumos', 'Sin insumos suficientes, la venta se rechaza', async (db) => {
    await db.insumo.update({ where: { nombre: 'Café Casa molido' }, data: { stock: 10 } })
    const v = await repo.varianteDe(db, 'bebida-latte', '12 oz')
    return rechaza(() => repo.crearPedido(db, { canal: 'POS', items: [{ id_variante: v.id_variante, cantidad: 1 }], metodoPago: 'EFECTIVO' }), 'CHECK')
  }],
  ['QR bolsa', 'El QR de una bolsa abre el pasaporte del consumidor y su pedido', async (db) => {
    const u = await db.unidadEmpaque.findFirst({ where: { tipo: 'BOLSA', estado: { not: 'EN_ALMACEN' } }, orderBy: { id_unidad: 'asc' } })
    assert(u, 'No hay bolsas vendidas')
    const pp = await repo.pasaporte(db, u.codigo_qr)
    assert(pp && pp.vista === 'CONSUMIDOR' && pp.pedido, 'Pasaporte de bolsa incorrecto')
    return `${u.codigo_qr} → lote ${pp.lote.codigo_lote}, pedido ${pp.pedido.codigo}`
  }],
  ['QR costal', 'El QR de un costal abre la vista técnica', async (db) => {
    const u = await db.unidadEmpaque.findFirst({ where: { tipo: 'COSTAL' }, orderBy: { id_unidad: 'asc' } })
    const pp = await repo.pasaporte(db, u.codigo_qr)
    assert(pp.vista === 'TECNICA' && pp.lote.tipo === 'VERDE', 'Vista de costal incorrecta')
    assert((await repo.pasaporte(db, 'NO-EXISTE')) === null, 'Un código inexistente devolvió datos')
    return `${u.codigo_qr} → vista técnica, SCA ${pp.lote.puntaje_sca}`
  }],
  ['Blockchain', 'Cada etapa la firma un inspector y la cadena se verifica', async (db) => {
    const lote = (await db.loteCafe.findFirst({ where: { tipo: 'TOSTADO' }, orderBy: { id_lote: 'asc' } })).codigo_lote
    const f = await repo.registrarEtapa(db, { codigo_lote: lote, tipo: 'DELIVERY', ubicacion: 'Miraflores', codigo_empleado: 'RD1' })
    const v = await repo.verificarCadena(db, lote)
    assert(v.ok && v.ultimoHash === f.hash, 'La cadena no verifica')
    await rechaza(() => repo.registrarEtapa(db, { codigo_lote: lote, tipo: 'DELIVERY', codigo_empleado: 'ZZ9' }), 'No existe el inspector')
    return `${v.bloques} bloques, firmado por ${f.inspector}`
  }],
  ['Blockchain', 'Si alguien altera un dato, la verificación lo detecta', async (db) => {
    const lote = (await db.loteCafe.findFirst({ where: { tipo: 'TOSTADO' }, orderBy: { id_lote: 'asc' } })).codigo_lote
    await db.etapaTrazabilidad.updateMany({ where: { orden: 1, lote: { codigo_lote: lote } }, data: { ubicacion: 'Otra finca' } })
    const v = await repo.verificarCadena(db, lote)
    assert(!v.ok && v.rotoEn === 1, 'No detectó la alteración')
    return `Cadena rota en la etapa ${v.rotoEn} (${v.etapa})`
  }],
  ['IoT', 'Lecturas del sensor y alerta fuera del rango 10 a 12 %', async (db) => {
    const lote = (await db.loteCafe.findFirst({ where: { tipo: 'VERDE' }, orderBy: { id_lote: 'asc' } })).codigo_lote
    assert(!(await repo.registrarTelemetria(db, lote, { humedad: 11, co2: 420 })).alerta, 'Alerta falsa')
    assert((await repo.registrarTelemetria(db, lote, { humedad: 13.4, co2: 520 })).alerta, 'No alertó humedad alta')
    await rechaza(() => repo.registrarTelemetria(db, lote, { humedad: 'abc', co2: 1 }), 'inválida')
    assert((await repo.dashboardLotes(db)).find((l) => l.codigo_lote === lote).alerta, 'El dashboard no muestra la alerta')
    return 'Alerta en 13.4 %'
  }],
  ['O2O', 'Lead capturado desde el QR se vincula al registrarse', async (db) => {
    const id_lead = await repo.registrarLead(db, { nombre: 'Rocío', whatsapp: '911222333', codigo_qr: 'HP-ORI-0925' })
    const c = await repo.registrarCliente(db, { nombre: 'Rocío', email: 'rocio@test.pe', password: 'x', telefono: '911222333', id_lead })
    assert((await db.lead.findUnique({ where: { id_lead } })).id_cliente === c.id_cliente, 'Lead no vinculado')
    return `Lead ${id_lead} → cliente ${c.id_cliente}`
  }],
  ['CRM', 'Ficha del cliente con perfil de sabor, pedidos y notas', async (db) => {
    const id = await clienteDe(db, 'premium@hauspe.pe')
    await repo.agregarNota(db, id, 'Cumple años el 2 de diciembre', 'BA1')
    const f = await repo.fichaCliente(db, id)
    assert(f.perfil && f.pedidos.length && f.notas.length >= 2, 'Ficha incompleta')
    return `${f.pedidos.length} pedidos, ${f.notas.length} notas, método ${f.perfil.metodo_extraccion}`
  }],
  ['Recordatorios', 'Reposición automática para suscripciones que vencen', async (db) => {
    const id = await clienteDe(db, 'cliente@hauspe.pe')
    const v = await repo.varianteDe(db, 'tarde')
    await db.suscripcionCafe.create({ data: { id_cliente: id, id_variante: v.id_variante, frecuencia: 'MENSUAL', inicio: dia(), proximo_envio: dia(sumarDias(new Date(), 1)) } })
    const n = await repo.generarRecordatoriosReposicion(db)
    assert(n >= 1, 'No generó recordatorios')
    return `${n} recordatorio(s) programado(s)`
  }],
]

/** Corre las 25 pruebas en una transacción y la revierte al final: la base queda como estaba. */
export async function ejecutarPruebas() {
  const resultados = new Array(PRUEBAS.length)
  const t0 = Date.now()
  const correr = async ([modulo, nombre, fn], db) => {
    const t = Date.now()
    let r
    try {
      r = { modulo, nombre, ok: true, detalle: String((await fn(db)) ?? 'OK') }
    } catch (e) {
      r = { modulo, nombre, ok: false, detalle: mensajeError(e) }
    }
    r.ms = Date.now() - t
    return r
  }
  // 1) pruebas que necesitan su propia transacción real (no dejan datos: el pedido falla y se revierte)
  for (const [i, p] of PRUEBAS.entries()) if (p[3]?.fuera) resultados[i] = await correr(p, prisma)
  // 2) el resto, dentro de UNA transacción que termina con un error controlado (Rollback)
  try {
    await prisma.$transaction(async (tx) => {
      for (const [i, p] of PRUEBAS.entries()) if (!p[3]?.fuera) resultados[i] = await correr(p, tx)
      throw new Rollback(resultados) // error controlado: Prisma hace ROLLBACK de todo
    }, { maxWait: 15000, timeout: 240000 })
  } catch (e) {
    if (!(e instanceof Rollback)) throw e
  }
  return { resultados, rollback: true, ms: Date.now() - t0 }
}
