// Enrutador único de la API de HausPe. Lo usan la función serverless de Vercel (api/main.js)
// y el servidor local (npm run dev). Una sola función evita el límite de funciones del plan gratuito
// y comparte una única instancia de PrismaClient.
//
// Acceso de cada ruta (último argumento de ruta()):
//   (nada)       público: health, catálogo, zonas, pasaporte QR, leads, login
//   'cliente'    sesión de cliente (solo ve SUS datos)
//   'sesion'     cliente o personal; la ruta decide qué puede hacer cada uno
//   [roles...]   sesión de personal con alguno de esos roles (ver permisos.js)
import { prisma } from './prisma.js'
import * as repo from './repo.js'
import * as admin from './admin.js'
import { ejecutarPruebas, mensajeError } from './tests.js'
import { cookieBorrada, cookieSesion, firmar, leerSesion } from './auth.js'
import { ESTADOS_QUE_AVANZA, GRUPOS, esInspector, pestanasDe } from '../../src/permisos.js'

const R = [] // [método, regex, claves, manejador, acceso]
const ruta = (metodo, patron, fn, acceso) => {
  const claves = []
  const re = new RegExp('^' + patron.replace(/:(\w+)/g, (_, k) => (claves.push(k), '([^/]+)')) + '/?$')
  R.push([metodo, re, claves, fn, acceso])
}
const num = (v) => (v === undefined || v === '' ? undefined : Number(v))
const lista = (v) => (v ? String(v).split(',').filter(Boolean) : undefined)
const { barista, darkStore, pedidos, inspector, admin: soloAdmin } = GRUPOS

/** Datos de sesión que ve el frontend. */
const quienEs = (s) => ({ tipo: s.tipo, id: s.id, nombre: s.nombre, rol: s.rol, codigo: s.codigo, email: s.email })

// ---- estado (público)
ruta('GET', '/health', () => admin.salud(prisma))
ruta('GET', '/inicio/cifras', () => repo.cifrasInicio(prisma))

// ---- sesión: clientes
ruta('POST', '/auth/registro', async ({ body }, ctx) => {
  const c = await repo.registrarCliente(prisma, body)
  await ctx.iniciarSesion({ tipo: 'cliente', id: c.id_cliente, nombre: c.nombre, email: c.email })
  return c
})
ruta('POST', '/auth/login', async ({ body }, ctx) => {
  const c = await repo.login(prisma, body.email, body.password)
  if (!c) return ctx.fail(401, 'Correo o contraseña incorrectos')
  await ctx.iniciarSesion({ tipo: 'cliente', id: c.id_cliente, nombre: c.nombre, email: c.email })
  return c
})
// ---- sesión: personal (Empleado)
ruta('POST', '/admin/login', async ({ body }, ctx) => {
  const e = await repo.loginEmpleado(prisma, body.email, body.password)
  if (!e) return ctx.fail(401, 'Correo o contraseña incorrectos')
  const s = { tipo: 'personal', id: e.id_empleado, nombre: e.nombre, rol: e.rol, codigo: e.codigo, email: e.email }
  await ctx.iniciarSesion(s)
  return { ...quienEs(s), pestanas: pestanasDe(e.rol) }
})
ruta('POST', '/auth/logout', (_, ctx) => {
  ctx.cookies.push(cookieBorrada())
  return { ok: true }
})
// Quién soy: el frontend lo consulta al abrir la app
ruta('GET', '/auth/yo', async ({ sesion }, ctx) => {
  if (!sesion) return ctx.fail(401, 'Sin sesión')
  if (sesion.tipo === 'cliente') {
    const c = await repo.getCliente(prisma, sesion.id)
    return c ? { tipo: 'cliente', cliente: c } : ctx.fail(401, 'La cuenta ya no existe')
  }
  return { tipo: 'personal', ...quienEs(sesion), pestanas: pestanasDe(sesion.rol) }
})

// ---- cliente: solo SUS datos
const propio = ({ p, sesion }, ctx) => (Number(p.id) === sesion.id ? null : ctx.fail(403, 'Solo puedes ver y cambiar tus propios datos'))
ruta('POST', '/clientes/:id/plan', (c, ctx) => propio(c, ctx) ?? repo.cambiarPlan(prisma, Number(c.p.id), c.body.plan), 'cliente')
ruta('PUT', '/clientes/:id/perfil', (c, ctx) => propio(c, ctx) ?? repo.guardarPerfilSabor(prisma, Number(c.p.id), c.body), 'cliente')
ruta('GET', '/mi/pedidos', ({ sesion }) => repo.listarPedidos(prisma, { id_cliente: sesion.id }), 'cliente')
ruta('GET', '/mi/suscripciones', ({ sesion }) => repo.listarSuscripciones(prisma, sesion.id), 'cliente')

// ---- catálogo y datos públicos
ruta('GET', '/planes', () => repo.listarPlanes(prisma))
ruta('GET', '/zonas', () => repo.listarZonas(prisma))
ruta('GET', '/catalogo', ({ q }) => repo.listarVariantes(prisma, { tipo: q.tipo }))
ruta('GET', '/catalogo/variante', ({ q }) => repo.varianteDe(prisma, q.sku, q.descripcion))
ruta('POST', '/leads', async ({ body }) => ({ id_lead: await repo.registrarLead(prisma, body) }))
ruta('GET', '/pasaporte/:codigo', async ({ p }, ctx) => (await repo.pasaporte(prisma, p.codigo)) ?? ctx.fail(404, 'Código QR no encontrado'))

// ---- pedidos
// Un cliente compra siempre a su nombre (WEB); la barra (POS) la cobra el personal de barista, sin cliente.
ruta('POST', '/pedidos', ({ body, sesion }, ctx) => {
  if (sesion.tipo === 'cliente') return repo.crearPedido(prisma, { ...body, id_cliente: sesion.id, canal: 'WEB' })
  if (!barista.includes(sesion.rol)) return ctx.fail(403, 'Tu rol no puede registrar ventas')
  return repo.crearPedido(prisma, { ...body, id_cliente: null, canal: 'POS' })
}, 'sesion')
ruta('GET', '/pedidos', ({ q }) => repo.listarPedidos(prisma, { estados: lista(q.estados), id_cliente: num(q.id_cliente), canal: q.canal }), pedidos)
ruta('GET', '/pedidos/:codigo', async ({ p, sesion }, ctx) => {
  const ped = await repo.getPedido(prisma, p.codigo)
  if (!ped) return ctx.fail(404, 'Pedido inexistente')
  const esDueno = sesion.tipo === 'cliente' && ped.id_cliente === sesion.id
  const esPersonal = sesion.tipo === 'personal' && pedidos.includes(sesion.rol)
  return esDueno || esPersonal ? ped : ctx.fail(403, 'Ese pedido no es tuyo')
}, 'sesion')
ruta('POST', '/pedidos/:codigo/avanzar', ({ p, body, sesion }) => repo.avanzarPedido(prisma, p.codigo, {
  estadosPermitidos: ESTADOS_QUE_AVANZA[sesion.rol],
  codigo_repartidor: sesion.rol === 'REPARTIDOR' ? sesion.codigo : body.codigo_repartidor,
}), pedidos)

// ---- barista y CRM
ruta('GET', '/catalogo/receta/:id', ({ p }) => repo.recetaDe(prisma, Number(p.id)), barista)
ruta('GET', '/insumos', () => repo.listarInsumos(prisma), barista)
ruta('GET', '/clientes', () => repo.listarClientes(prisma), barista)
ruta('GET', '/clientes/:id/ficha', ({ p }) => repo.fichaCliente(prisma, Number(p.id)), barista)
ruta('POST', '/clientes/:id/notas', ({ p, body, sesion }) =>
  repo.agregarNota(prisma, Number(p.id), body.nota, sesion.rol === 'BARISTA' ? sesion.codigo : body.codigo_empleado || sesion.codigo), barista)

// ---- dark store y recordatorios
ruta('GET', '/dark-store/cola', () => repo.colaDarkStore(prisma), darkStore)
ruta('GET', '/inventario', () => repo.listarInventario(prisma), darkStore)
ruta('GET', '/recordatorios', ({ q }) => repo.listarRecordatorios(prisma, { estado: q.estado }), darkStore)
ruta('POST', '/recordatorios/generar', async () => ({ generados: await repo.generarRecordatoriosReposicion(prisma) }), darkStore)
ruta('POST', '/recordatorios/:id/enviar', ({ p }) => repo.enviarRecordatorio(prisma, Number(p.id)), darkStore)

// ---- trazabilidad, lotes e IoT (inspectores)
ruta('GET', '/empleados', async ({ q, sesion }) => {
  const todos = await repo.listarEmpleados(prisma, { sinAdmin: q.sinAdmin === '1' })
  // un inspector solo se ve a sí mismo: no puede elegir otro código para firmar
  return esInspector(sesion.rol) ? todos.filter((e) => e.codigo === sesion.codigo) : todos
}, inspector)
ruta('GET', '/lotes', () => repo.listarLotes(prisma), inspector)
ruta('GET', '/lotes/dashboard', () => repo.dashboardLotes(prisma), inspector)
ruta('GET', '/lotes/:codigo/unidades', ({ p }) => repo.unidadesDeLote(prisma, p.codigo), inspector)
ruta('GET', '/trazabilidad/:codigo/ruta', ({ p }) => repo.rutaLote(prisma, p.codigo), inspector)
ruta('GET', '/trazabilidad/:codigo/verificar', ({ p }) => repo.verificarCadena(prisma, p.codigo), inspector)
ruta('POST', '/trazabilidad/etapas', ({ body, sesion }, ctx) => {
  // El inspector solo firma con SU código (IC1, IE1, IP1); el administrador puede firmar por cualquiera
  if (esInspector(sesion.rol) && (body.codigo_empleado || sesion.codigo) !== sesion.codigo) {
    return ctx.fail(403, `Solo puedes firmar con tu propio código (${sesion.codigo})`)
  }
  return repo.registrarEtapa(prisma, { ...body, codigo_empleado: body.codigo_empleado || sesion.codigo })
}, inspector)
ruta('POST', '/telemetria/simular', async () => ({ lotes: await repo.simularTodos(prisma) }), inspector)
ruta('GET', '/telemetria/:codigo', ({ p, q }) => repo.telemetriaLote(prisma, p.codigo, num(q.limite) || 24), inspector)
ruta('POST', '/telemetria/:codigo', ({ p, body }) => repo.registrarTelemetria(prisma, p.codigo, body), inspector)

// ---- administración y pruebas (solo ADMIN)
ruta('GET', '/admin/tablas', () => admin.tablas(prisma), soloAdmin)
ruta('GET', '/admin/tablas/:t/columnas', ({ p }) => admin.columnas(prisma, p.t), soloAdmin)
ruta('GET', '/admin/tablas/:t/filas', ({ p, q }) => admin.filas(prisma, p.t, q.limite), soloAdmin)
ruta('POST', '/admin/sql', ({ body }) => admin.consultaSQL(prisma, body.sql), soloAdmin)
ruta('GET', '/admin/modelo', () => admin.modelo(), soloAdmin)
ruta('POST', '/tests', () => ejecutarPruebas(), soloAdmin)

// ------------------------------------------------------------------ servidor
async function leerCuerpo(req) {
  if (req.body !== undefined && req.body !== null) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body
  if (req.method === 'GET' || req.method === 'HEAD') return {}
  const partes = []
  for await (const c of req) partes.push(c)
  const txt = Buffer.concat(partes).toString('utf8')
  return txt ? JSON.parse(txt) : {}
}

const CONEXION = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024'])
const FALLO = Symbol('fallo')

/** Verifica la sesión contra el acceso de la ruta. Devuelve un error {status, error} o null si pasa. */
function autorizar(acceso, sesion) {
  if (acceso === undefined) return null
  if (!sesion) return { status: 401, error: 'Inicia sesión para continuar' }
  if (acceso === 'sesion') return null
  if (acceso === 'cliente') return sesion.tipo === 'cliente' ? null : { status: 403, error: 'Esta función es para cuentas de cliente' }
  if (sesion.tipo !== 'personal') return { status: 403, error: 'Esta función es solo para el personal de HausPe' }
  return acceso.includes(sesion.rol) ? null : { status: 403, error: 'Tu rol no tiene permiso para esta función' }
}

export async function handler(req, res) {
  const t0 = Date.now()
  const ctx = {
    cookies: [],
    fail: (status, error) => ({ [FALLO]: { status, error } }),
    iniciarSesion: async (datos) => { ctx.cookies.push(cookieSesion(await firmar(datos))) },
  }
  const enviar = (status, data) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Server-Timing', `api;dur=${Date.now() - t0}`) // tiempo en el servidor, visible en la pestaña Red
    if (ctx.cookies.length) res.setHeader('Set-Cookie', ctx.cookies)
    res.end(JSON.stringify(data))
  }
  try {
    const url = new URL(req.url, 'http://localhost')
    // En Vercel, vercel.json reescribe /api/<ruta> → /api/main?__p=<ruta>; en local llega la ruta original
    const reescrita = url.searchParams.get('__p')
    url.searchParams.delete('__p')
    const camino = reescrita !== null ? '/' + reescrita.replace(/^\/+/, '') : url.pathname.replace(/^\/api/, '') || '/'
    const metodo = req.method === 'HEAD' ? 'GET' : req.method
    let existe = false
    for (const [m, re, claves, fn, acceso] of R) {
      const hit = re.exec(camino)
      if (!hit) continue
      existe = true
      if (m !== metodo) continue
      const sesion = acceso === undefined ? null : await leerSesion(req)
      const rechazo = autorizar(acceso, sesion)
      if (rechazo) return enviar(rechazo.status, { ok: false, error: rechazo.error })
      const p = Object.fromEntries(claves.map((k, i) => [k, decodeURIComponent(hit[i + 1])]))
      const q = Object.fromEntries(url.searchParams)
      const body = metodo === 'GET' ? {} : await leerCuerpo(req)
      // /auth/yo y /auth/logout leen la cookie aunque sean "públicos"
      const s = sesion ?? (camino.startsWith('/auth/yo') ? await leerSesion(req) : null)
      const out = await fn({ p, q, body, sesion: s }, ctx)
      if (out && out[FALLO]) return enviar(out[FALLO].status, { ok: false, error: out[FALLO].error })
      return enviar(200, out ?? { ok: true })
    }
    return enviar(existe ? 405 : 404, { ok: false, error: existe ? 'Método no permitido' : `Ruta inexistente: ${camino}` })
  } catch (e) {
    const sinConexion = e?.name === 'PrismaClientInitializationError' || CONEXION.has(e?.code)
    const status = e?.status || (sinConexion ? 503 : 400)
    if (status >= 500) console.error('[api]', e)
    return enviar(status, { ok: false, error: sinConexion ? 'No hay conexión con la base de datos' : mensajeError(e) })
  }
}

export default handler
