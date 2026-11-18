// Pruebas automáticas de los flujos contra la base de datos.
// Se ejecutan sobre una copia nueva en memoria para no tocar los datos de la demo.
import * as repo from './repo.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}
async function rechaza(fn, texto) {
  try {
    await fn()
  } catch (e) {
    if (texto && !String(e.message).includes(texto)) throw new Error(`Falló con otro error: ${e.message}`, { cause: e })
    return e.message
  }
  throw new Error('Se esperaba un error y la operación se aceptó')
}

export const PRUEBAS = [
  ['Esquema', 'Existen las tablas del modelo y las claves foráneas están activas', async (db) => {
    const n = db.get(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).n
    assert(n >= 33, `Solo hay ${n} tablas`)
    assert(db.get('PRAGMA foreign_keys').foreign_keys === 1, 'foreign_keys está desactivado')
    return `${n} tablas, FK activas`
  }],
  ['Integridad', 'Una FK inválida se rechaza', async (db) => {
    const m = await rechaza(() => db.run('INSERT INTO Pedido (codigo, id_cliente, canal, moneda) VALUES (?,?,?,?)', ['X1', 99999, 'WEB', 'PEN']), 'FOREIGN KEY')
    return m
  }],
  ['Registro B2C', 'Crea Cliente + Membresía Gratuito y no permite correo duplicado', async (db) => {
    const c = await repo.registrarCliente(db, { nombre: 'Prueba', email: 'prueba@test.pe', password: 'abc123', telefono: '999888777' })
    assert(c.plan === 'Gratuito', 'Plan inicial incorrecto: ' + c.plan)
    await rechaza(() => repo.registrarCliente(db, { nombre: 'Otra', email: 'PRUEBA@test.pe', password: 'x' }), 'ya está registrado')
    const raw = db.get('SELECT password_hash FROM Cliente WHERE id_cliente = ?', [c.id_cliente]).password_hash
    assert(raw.length === 64 && raw !== 'abc123', 'La contraseña no está cifrada')
    return `id_cliente ${c.id_cliente}, contraseña guardada como SHA-256`
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
    const id = db.get(`SELECT id_cliente FROM Cliente WHERE email='cliente@hauspe.pe'`).id_cliente
    assert((await repo.cambiarPlan(db, id, 'Premium')).plan === 'Premium', 'No subió a Premium')
    assert((await repo.cambiarPlan(db, id, 'Gratuito')).plan === 'Gratuito', 'No bajó a Gratuito')
    await rechaza(() => repo.cambiarPlan(db, id, 'Exportador'), 'no corresponde')
    const hist = db.get('SELECT COUNT(*) AS n FROM Membresia WHERE id_cliente = ?', [id]).n
    return `${hist} membresías en el historial`
  }],
  ['Compra B2C', 'Pedido + detalle + pago + boleta con IGV + entrega en 24 h + bolsa con QR', async (db) => {
    const id = db.get(`SELECT id_cliente FROM Cliente WHERE email='cliente@hauspe.pe'`).id_cliente
    const v = repo.varianteDe(db, 'casa')
    const stockAntes = v.stock
    const p = await repo.crearPedido(db, { id_cliente: id, items: [{ id_variante: v.id_variante, cantidad: 2 }], distrito: 'Surco'.length ? 'Santiago de Surco' : null, referencia: '123456' })
    assert(p.comprobante_tipo === 'BOLETA' && p.serie === 'B001', 'Comprobante incorrecto')
    assert(Math.abs(p.base_imponible + p.igv - p.total) < 0.011, 'Base + IGV ≠ total')
    assert(p.total === 2 * 58 + 10, `Total esperado 126, obtenido ${p.total}`)
    assert(repo.varianteDe(db, 'casa').stock === stockAntes - 2, 'No se descontó stock')
    assert(p.items[0].unidades.length === 2, 'No se asignaron bolsas con QR')
    const horas = (new Date(p.programada_para.replace(' ', 'T')) - new Date(p.fecha.replace(' ', 'T'))) / 3.6e6
    assert(Math.round(horas) === 24, 'La entrega no quedó a 24 h')
    return `${p.numero_comprobante}: base ${p.base_imponible} + IGV ${p.igv} = S/ ${p.total}`
  }],
  ['Suscripción', 'Compra semanal crea SuscripcionCafe con próximo envío a 7 días', async (db) => {
    const id = db.get(`SELECT id_cliente FROM Cliente WHERE email='premium@hauspe.pe'`).id_cliente
    const v = repo.varianteDe(db, 'origen')
    const p = await repo.crearPedido(db, { id_cliente: id, items: [{ id_variante: v.id_variante, cantidad: 1, precio_unitario: v.precio * 0.85 }], frecuencia: 'SEMANAL', referencia: '654321' })
    const s = db.get('SELECT * FROM SuscripcionCafe WHERE id_suscripcion = ?', [p.id_suscripcion])
    const dias = Math.round((new Date(s.proximo_envio) - new Date(s.inicio)) / 864e5)
    assert(s.frecuencia === 'SEMANAL' && dias === 7, 'Suscripción mal creada')
    return `próximo envío ${s.proximo_envio}`
  }],
  ['Factura B2B', 'Cliente HORECA recibe factura F001 con su RUC', async (db) => {
    const id = db.get(`SELECT id_cliente FROM Cliente WHERE email='horeca@hauspe.pe'`).id_cliente
    const v = repo.varianteDe(db, 'tarde', '1 kg HORECA')
    const p = await repo.crearPedido(db, { id_cliente: id, items: [{ id_variante: v.id_variante, cantidad: 2 }], metodoPago: 'TRANSFERENCIA' })
    assert(p.comprobante_tipo === 'FACTURA' && p.serie === 'F001', 'No emitió factura')
    return `${p.numero_comprobante}, RUC ${db.get('SELECT doc_cliente FROM Comprobante WHERE id_pedido = ?', [p.id_pedido]).doc_cliente}`
  }],
  ['Exportación', 'Cotización CIF en USD sin IGV y con descuento por volumen', async (db) => {
    const id = db.get(`SELECT id_cliente FROM Cliente WHERE tipo_b2b='IMPORTADOR' LIMIT 1`).id_cliente
    const v = repo.listarVariantes(db, { tipo: 'VERDE' })[0]
    const p = await repo.crearPedido(db, { id_cliente: id, items: [{ id_variante: v.id_variante, cantidad: 10 }], incoterm: 'CIF', pais_destino: 'Alemania', flete: 252, descuentoVolumen: 0.03 })
    assert(p.tipo === 'COTIZACION' && p.moneda === 'USD' && p.igv === 0, 'Cotización mal formada')
    assert(p.total === Math.round((v.precio * 10 * 0.97 + 252) * 100) / 100, 'Total de cotización incorrecto')
    assert(p.items[0].unidades.every((u) => u.tipo === 'COSTAL'), 'No asignó costales')
    return `${p.numero_comprobante}: US$ ${p.total} (IGV 0)`
  }],
  ['Reglas', 'Un suscriptor B2C no puede cotizar café verde', async (db) => {
    const id = db.get(`SELECT id_cliente FROM Cliente WHERE email='cliente@hauspe.pe'`).id_cliente
    const v = repo.listarVariantes(db, { tipo: 'VERDE' })[0]
    return rechaza(() => repo.crearPedido(db, { id_cliente: id, items: [{ id_variante: v.id_variante, cantidad: 5 }], incoterm: 'FOB' }), 'importador')
  }],
  ['Reglas', 'No se mezclan soles y dólares en un pedido (trigger)', async (db) => {
    const id = db.get(`SELECT id_cliente FROM Cliente WHERE tipo_b2b='IMPORTADOR' LIMIT 1`).id_cliente
    const verde = repo.listarVariantes(db, { tipo: 'VERDE' })[0]
    const casa = repo.varianteDe(db, 'casa')
    return rechaza(() => repo.crearPedido(db, { id_cliente: id, items: [{ id_variante: verde.id_variante, cantidad: 3 }, { id_variante: casa.id_variante, cantidad: 1 }], incoterm: 'FOB' }), 'mezclar monedas')
  }],
  ['Transacciones', 'Si falla un paso, se revierte todo el pedido', async (db) => {
    const antes = db.get('SELECT COUNT(*) AS n FROM Pedido').n
    const v = repo.varianteDe(db, 'origen')
    await rechaza(() => repo.crearPedido(db, { items: [{ id_variante: v.id_variante, cantidad: 100000 }], canal: 'POS', metodoPago: 'EFECTIVO' }), 'CHECK')
    assert(db.get('SELECT COUNT(*) AS n FROM Pedido').n === antes, 'Quedó un pedido a medias')
    return 'Sin stock: ROLLBACK correcto'
  }],
  ['Barista / Dark store', 'El pedido avanza PAGADO → ENTREGADO y se marcan las fechas', async (db) => {
    const v = repo.varianteDe(db, 'casa')
    const id = db.get(`SELECT id_cliente FROM Cliente WHERE email='premium@hauspe.pe'`).id_cliente
    const p = await repo.crearPedido(db, { id_cliente: id, items: [{ id_variante: v.id_variante, cantidad: 1 }], distrito: 'Miraflores', referencia: '777777' })
    for (let i = 0; i < 4; i++) await repo.avanzarPedido(db, p.codigo)
    const f = repo.getPedido(db, p.codigo)
    assert(f.estado === 'ENTREGADO' && f.preparada_en && f.despachada_en && f.entregada_en, 'Faltan fechas de entrega')
    assert(db.get(`SELECT COUNT(*) AS n FROM Recordatorio WHERE id_pedido = ? AND tipo='PEDIDO_LISTO'`, [f.id_pedido]).n === 1, 'No avisó pedido listo')
    return `${f.codigo} entregado, aviso de WhatsApp registrado`
  }],
  ['Punto de venta', 'Venta presencial sin cliente (POS) no genera entrega', async (db) => {
    const v = db.get(`SELECT v.id_variante FROM VarianteProducto v JOIN Producto p USING(id_producto) WHERE p.tipo='BEBIDA' LIMIT 1`)
    const p = await repo.crearPedido(db, { canal: 'POS', items: [{ id_variante: v.id_variante, cantidad: 2 }], metodoPago: 'EFECTIVO' })
    assert(p.canal === 'POS' && !p.programada_para, 'POS mal registrado')
    return `${p.codigo}: S/ ${p.total}`
  }],
  ['Insumos', 'Vender 2 lattes de 12 oz descuenta del almacén 36 g de café y 600 ml de leche', async (db) => {
    const v = repo.varianteDe(db, 'bebida-latte', '12 oz')
    const stock = (n) => db.get('SELECT stock FROM Insumo WHERE nombre = ?', [n]).stock
    const cafe0 = stock('Café Casa molido')
    const leche0 = stock('Leche entera')
    await repo.crearPedido(db, { canal: 'POS', items: [{ id_variante: v.id_variante, cantidad: 2 }], metodoPago: 'EFECTIVO' })
    assert(cafe0 - stock('Café Casa molido') === 36, `Café descontado: ${cafe0 - stock('Café Casa molido')} g`)
    assert(leche0 - stock('Leche entera') === 600, `Leche descontada: ${leche0 - stock('Leche entera')} ml`)
    const g = repo.recetaDe(db, repo.varianteDe(db, 'casa', '250 g').id_variante).filter((x) => x.unidad === 'g').reduce((s, x) => s + x.cantidad, 0)
    assert(g === 250, `La bolsa suma ${g} g`)
    return 'Café −36 g, leche −600 ml; la bolsa de Casa suma 250 g'
  }],
  ['Insumos', 'Sin insumos suficientes, la venta se rechaza', async (db) => {
    db.run(`UPDATE Insumo SET stock = 10 WHERE nombre = 'Café Casa molido'`)
    const v = repo.varianteDe(db, 'bebida-latte', '12 oz')
    return rechaza(() => repo.crearPedido(db, { canal: 'POS', items: [{ id_variante: v.id_variante, cantidad: 1 }], metodoPago: 'EFECTIVO' }), 'CHECK')
  }],
  ['QR bolsa', 'El QR de una bolsa abre el pasaporte del consumidor y su pedido', async (db) => {
    const u = db.get(`SELECT codigo_qr FROM UnidadEmpaque WHERE tipo='BOLSA' AND estado <> 'EN_ALMACEN' LIMIT 1`)
    const pp = await repo.pasaporte(db, u.codigo_qr)
    assert(pp && pp.vista === 'CONSUMIDOR' && pp.pedido, 'Pasaporte de bolsa incorrecto')
    return `${u.codigo_qr} → lote ${pp.lote.codigo_lote}, pedido ${pp.pedido.codigo}`
  }],
  ['QR costal', 'El QR de un costal abre la vista técnica', async (db) => {
    const u = db.get(`SELECT codigo_qr FROM UnidadEmpaque WHERE tipo='COSTAL' LIMIT 1`)
    const pp = await repo.pasaporte(db, u.codigo_qr)
    assert(pp.vista === 'TECNICA' && pp.lote.tipo === 'VERDE', 'Vista de costal incorrecta')
    assert(await repo.pasaporte(db, 'NO-EXISTE') === null, 'Un código inexistente devolvió datos')
    return `${u.codigo_qr} → vista técnica, SCA ${pp.lote.puntaje_sca}`
  }],
  ['Blockchain', 'Cada etapa la firma un inspector y la cadena se verifica', async (db) => {
    const lote = db.get(`SELECT codigo_lote FROM LoteCafe WHERE tipo='TOSTADO' LIMIT 1`).codigo_lote
    const f = await repo.registrarEtapa(db, { codigo_lote: lote, tipo: 'DELIVERY', ubicacion: 'Miraflores', codigo_empleado: 'RD1' })
    const v = await repo.verificarCadena(db, lote)
    assert(v.ok && v.ultimoHash === f.hash, 'La cadena no verifica')
    await rechaza(() => repo.registrarEtapa(db, { codigo_lote: lote, tipo: 'DELIVERY', codigo_empleado: 'ZZ9' }), 'No existe el inspector')
    return `${v.bloques} bloques, firmado por ${f.inspector}`
  }],
  ['Blockchain', 'Si alguien altera un dato, la verificación lo detecta', async (db) => {
    const lote = db.get(`SELECT codigo_lote FROM LoteCafe WHERE tipo='TOSTADO' LIMIT 1`).codigo_lote
    db.run(`UPDATE EtapaTrazabilidad SET ubicacion = 'Otra finca' WHERE orden = 1 AND id_lote = (SELECT id_lote FROM LoteCafe WHERE codigo_lote = ?)`, [lote])
    const v = await repo.verificarCadena(db, lote)
    assert(!v.ok && v.rotoEn === 1, 'No detectó la alteración')
    return `Cadena rota en la etapa ${v.rotoEn} (${v.etapa})`
  }],
  ['IoT', 'Lecturas del sensor y alerta fuera del rango 10 a 12 %', async (db) => {
    const lote = db.get(`SELECT codigo_lote FROM LoteCafe WHERE tipo='VERDE' LIMIT 1`).codigo_lote
    assert(!repo.registrarTelemetria(db, lote, { humedad: 11, co2: 420 }).alerta, 'Alerta falsa')
    assert(repo.registrarTelemetria(db, lote, { humedad: 13.4, co2: 520 }).alerta, 'No alertó humedad alta')
    await rechaza(() => repo.registrarTelemetria(db, lote, { humedad: 'abc', co2: 1 }), 'inválida')
    assert(repo.dashboardLotes(db).find((l) => l.codigo_lote === lote).alerta, 'El dashboard no muestra la alerta')
    return 'Alerta en 13.4 %'
  }],
  ['O2O', 'Lead capturado desde el QR se vincula al registrarse', async (db) => {
    const id_lead = repo.registrarLead(db, { nombre: 'Rocío', whatsapp: '911222333', codigo_qr: 'HP-ORI-0925' })
    const c = await repo.registrarCliente(db, { nombre: 'Rocío', email: 'rocio@test.pe', password: 'x', telefono: '911222333', id_lead })
    assert(db.get('SELECT id_cliente FROM Lead WHERE id_lead = ?', [id_lead]).id_cliente === c.id_cliente, 'Lead no vinculado')
    return `Lead ${id_lead} → cliente ${c.id_cliente}`
  }],
  ['CRM', 'Ficha del cliente con perfil de sabor, pedidos y notas', async (db) => {
    const id = db.get(`SELECT id_cliente FROM Cliente WHERE email='premium@hauspe.pe'`).id_cliente
    repo.agregarNota(db, id, 'Cumple años el 2 de diciembre', 'BA1')
    const f = repo.fichaCliente(db, id)
    assert(f.perfil && f.pedidos.length && f.notas.length >= 2, 'Ficha incompleta')
    return `${f.pedidos.length} pedidos, ${f.notas.length} notas, método ${f.perfil.metodo_extraccion}`
  }],
  ['Recordatorios', 'Reposición automática para suscripciones que vencen', async (db) => {
    const id = db.get(`SELECT id_cliente FROM Cliente WHERE email='cliente@hauspe.pe'`).id_cliente
    const v = repo.varianteDe(db, 'tarde')
    db.run(`INSERT INTO SuscripcionCafe (id_cliente, id_variante, frecuencia, proximo_envio) VALUES (?,?,'MENSUAL', date('now','localtime','+1 day'))`, [id, v.id_variante])
    const n = repo.generarRecordatoriosReposicion(db)
    assert(n >= 1, 'No generó recordatorios')
    return `${n} recordatorio(s) programado(s)`
  }],
]

/** Ejecuta todas las pruebas sobre una base nueva creada con crearBD(). */
export async function ejecutarPruebas(crearBD, onResultado) {
  const db = await crearBD()
  const resultados = []
  for (const [modulo, nombre, fn] of PRUEBAS) {
    const t0 = performance.now()
    let r
    try {
      r = { modulo, nombre, ok: true, detalle: String((await fn(db)) ?? 'OK') }
    } catch (e) {
      r = { modulo, nombre, ok: false, detalle: e.message }
    }
    r.ms = Math.round(performance.now() - t0)
    resultados.push(r)
    onResultado?.(r, resultados)
  }
  return resultados
}
