// Capa de datos de la app. Todas las pantallas leen y escriben a través de "api" (async).
//  - Modo remoto: fetch a la API (/api → MySQL 8 con Prisma).
//  - Modo local:  si /api/health falla, se usa la base SQLite del navegador (sql.js) como respaldo,
//    para que la demo nunca se caiga.
// El modo se decide una sola vez al abrir la app (iniciarDatos).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { pestanasDe } from '../permisos.js'

let modo = 'verificando' // 'verificando' | 'remoto' | 'local'
let health = null
let version = 0
const oyentes = new Set()
const notificar = () => oyentes.forEach((f) => f())
const suscribir = (f) => { oyentes.add(f); return () => oyentes.delete(f) }

export const getModo = () => modo
export const getHealth = () => health
/** Re-renderiza cuando cambia el modo (remoto/local) o el resultado de /api/health. */
export function useModo() {
  useSyncExternalStore(suscribir, () => modo + (health?.version ?? ''))
  return { modo, health }
}

// ---------------------------------------------------------------- HTTP
async function http(metodo, ruta, cuerpo, { timeout = 90000 } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  let r
  try {
    r = await fetch(`/api${ruta}`, {
      method: metodo,
      headers: cuerpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      signal: ctrl.signal,
    })
  } catch {
    throw Object.assign(new Error('No hay conexión con el servidor'), { red: true })
  } finally {
    clearTimeout(t)
  }
  const json = await r.json().catch(() => null)
  // 401 en una pantalla protegida = la sesión venció: avisa a AuthContext para que cierre la sesión y redirija
  if (r.status === 401 && !ruta.startsWith('/auth/') && ruta !== '/admin/login') window.dispatchEvent(new Event('hp:sesion-vencida'))
  if (!r.ok || json === null) throw Object.assign(new Error(json?.error || `Error ${r.status} del servidor`), { status: r.status, red: json === null })
  return json
}
const qs = (o) => {
  const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  return p.size ? `?${p}` : ''
}

// ---------------------------------------------------------------- sesión del modo local
const SESION_LOCAL = 'hauspe_sesion_local'
const leerLocal = () => { try { return JSON.parse(localStorage.getItem(SESION_LOCAL)) } catch { return null } }
const guardarLocal = (s) => { try { s ? localStorage.setItem(SESION_LOCAL, JSON.stringify(s)) : localStorage.removeItem(SESION_LOCAL) } catch { /* sin almacenamiento */ } }
const empleadoLocal = (e) => ({ tipo: 'personal', id: e.id_empleado, nombre: e.nombre, rol: e.rol, codigo: e.codigo, email: e.email, pestanas: pestanasDe(e.rol) })

// ---------------------------------------------------------------- respaldo local (SQLite)
let _local = null
const local = () =>
  (_local ??= (async () => {
    const [b, repo] = await Promise.all([import('./browser'), import('./repo')])
    if (!b.getDB()) await b.iniciarBD()
    return { b, repo, db: b.getDB() }
  })())

/** Decide el modo: si /api/health responde, MySQL; si no, base local. */
export async function iniciarDatos() {
  try {
    const h = await http('GET', '/health', undefined, { timeout: 8000 })
    if (!h.ok) throw new Error('health')
    health = h
    modo = 'remoto'
  } catch {
    modo = 'local'
    try { await local() } catch (e) { console.error('No se pudo iniciar la base local', e) }
  }
  notificar()
}

// op(remoto, local, mutacion): ejecuta según el modo; las mutaciones avisan a las pantallas para que recarguen.
const op = (remoto, enLocal, muta = false) => async (...a) => {
  const r = modo === 'remoto' ? await remoto(...a) : await enLocal(await local(), ...a)
  if (muta) { version++; notificar() }
  return r
}
const sinFilaNula = (e) => { if (e?.status === 401 || e?.status === 404) return null; throw e }

export const api = {
  // ---- clientes
  // Sesión: en MySQL es una cookie httpOnly con un JWT que pone el servidor; en modo local, un valor en localStorage
  login: op(
    (email, password) => http('POST', '/auth/login', { email, password }).catch(sinFilaNula),
    async ({ repo, db }, email, password) => {
      const c = await repo.login(db, email, password)
      if (c) guardarLocal({ tipo: 'cliente', id: c.id_cliente })
      return c
    },
  ),
  loginPersonal: op(
    (email, password) => http('POST', '/admin/login', { email, password }).catch(sinFilaNula),
    async ({ repo, db }, email, password) => {
      const e = await repo.loginEmpleado(db, email, password)
      if (!e) return null
      guardarLocal({ tipo: 'personal', id: e.id_empleado })
      return empleadoLocal(e)
    },
  ),
  registrar: op(
    (d) => http('POST', '/auth/registro', d),
    async ({ repo, db }, d) => {
      const c = await repo.registrarCliente(db, d)
      guardarLocal({ tipo: 'cliente', id: c.id_cliente })
      return c
    },
    true,
  ),
  /** Quién tiene la sesión abierta: { tipo: 'cliente', cliente } | { tipo: 'personal', ...empleado } | null */
  yo: op(
    () => http('GET', '/auth/yo').catch(sinFilaNula),
    ({ repo, db }) => {
      const s = leerLocal()
      if (!s) return null
      if (s.tipo === 'cliente') {
        const c = repo.getCliente(db, s.id)
        return c ? { tipo: 'cliente', cliente: c } : null
      }
      const e = db.get('SELECT id_empleado, codigo, nombre, rol, email FROM Empleado WHERE id_empleado = ?', [s.id])
      return e ? empleadoLocal(e) : null
    },
  ),
  cerrarSesion: op(() => http('POST', '/auth/logout', {}), () => { guardarLocal(null); return { ok: true } }),
  misPedidos: op(() => http('GET', '/mi/pedidos'), ({ repo, db }) => repo.listarPedidos(db, { id_cliente: leerLocal()?.id })),
  misSuscripciones: op(() => http('GET', '/mi/suscripciones'), ({ repo, db }) => repo.listarSuscripciones(db, leerLocal()?.id)),
  listarClientes: op(() => http('GET', '/clientes'), ({ db }) => db.all('SELECT id_cliente, nombre, email FROM Cliente ORDER BY nombre')),
  fichaCliente: op((id) => http('GET', `/clientes/${id}/ficha`), ({ repo, db }, id) => repo.fichaCliente(db, id)),
  agregarNota: op(
    (id, nota, emp) => http('POST', `/clientes/${id}/notas`, { nota, codigo_empleado: emp }),
    ({ repo, db }, id, nota, emp) => repo.agregarNota(db, id, nota, emp),
    true,
  ),
  listarEmpleados: op(
    (sinAdmin) => http('GET', `/empleados${qs({ sinAdmin: sinAdmin ? 1 : undefined })}`),
    ({ db }, sinAdmin) => db.all(`SELECT codigo, nombre, rol FROM Empleado ${sinAdmin ? "WHERE rol <> 'ADMIN'" : ''} ORDER BY codigo`),
  ),
  registrarLead: op((l) => http('POST', '/leads', l), ({ repo, db }, l) => repo.registrarLead(db, l), true),

  // ---- catálogo y operación
  listarVariantes: op((tipo) => http('GET', `/catalogo${qs({ tipo })}`), ({ repo, db }, tipo) => repo.listarVariantes(db, { tipo })),
  varianteDe: op(
    (sku, descripcion) => http('GET', `/catalogo/variante${qs({ sku, descripcion })}`),
    ({ repo, db }, sku, descripcion) => repo.varianteDe(db, sku, descripcion),
  ),
  recetaDe: op((id) => http('GET', `/catalogo/receta/${id}`), ({ repo, db }, id) => repo.recetaDe(db, id)),
  listarZonas: op(() => http('GET', '/zonas'), ({ repo, db }) => repo.listarZonas(db)),
  listarInsumos: op(() => http('GET', '/insumos'), ({ repo, db }) => repo.listarInsumos(db).map((i) => ({ ...i, bajo: !!i.bajo }))),
  listarInventario: op(() => http('GET', '/inventario'), ({ repo, db }) => repo.listarInventario(db)),

  // ---- pedidos
  crearPedido: op((p) => http('POST', '/pedidos', p), ({ repo, db }, p) => repo.crearPedido(db, p), true),
  listarPedidos: op(
    (f = {}) => http('GET', `/pedidos${qs({ estados: f.estados?.join(','), id_cliente: f.id_cliente, canal: f.canal })}`),
    ({ repo, db }, f) => repo.listarPedidos(db, f),
  ),
  avanzarPedido: op(
    (codigo, o = {}) => http('POST', `/pedidos/${encodeURIComponent(codigo)}/avanzar`, o),
    ({ repo, db }, codigo, o) => repo.avanzarPedido(db, codigo, o),
    true,
  ),
  colaDarkStore: op(() => http('GET', '/dark-store/cola'), ({ repo, db }) => repo.colaDarkStore(db)),

  // ---- QR, trazabilidad e IoT
  pasaporte: op(
    (codigo) => http('GET', `/pasaporte/${encodeURIComponent(codigo)}`).catch(sinFilaNula),
    ({ repo, db }, codigo) => repo.pasaporte(db, codigo),
  ),
  listarLotes: op(() => http('GET', '/lotes'), ({ db }) => db.all('SELECT codigo_lote, tipo, finca_origen FROM LoteCafe ORDER BY tipo DESC, codigo_lote')),
  dashboardLotes: op(() => http('GET', '/lotes/dashboard'), ({ repo, db }) => repo.dashboardLotes(db)),
  rutaLote: op((codigo) => http('GET', `/trazabilidad/${encodeURIComponent(codigo)}/ruta`), ({ repo, db }, codigo) => repo.rutaLote(db, codigo)),
  registrarEtapa: op((e) => http('POST', '/trazabilidad/etapas', e), ({ repo, db }, e) => repo.registrarEtapa(db, e), true),
  verificarCadena: op(
    (codigo) => http('GET', `/trazabilidad/${encodeURIComponent(codigo)}/verificar`),
    ({ repo, db }, codigo) => repo.verificarCadena(db, codigo),
  ),
  simularSensores: op(
    () => http('POST', '/telemetria/simular', {}),
    ({ repo, db }) => { db.all('SELECT codigo_lote FROM LoteCafe').forEach((l) => repo.simularSensor(db, l.codigo_lote, 1)); return { ok: true } },
    true,
  ),
  cifrasInicio: op(
    () => http('GET', '/inicio/cifras'),
    ({ db }) => db.get(`SELECT (SELECT COUNT(DISTINCT finca_origen) FROM LoteCafe) AS fincas, (SELECT COUNT(*) FROM LoteCafe) AS lotes,
      (SELECT COUNT(*) FROM FirmaEtapa) AS firmas, (SELECT MAX(puntaje_sca) FROM LoteCafe) AS sca`),
  ),

  // ---- Panel → Base de datos
  tablas: op(() => http('GET', '/admin/tablas'), ({ db }) => db.tablas()),
  columnas: op((t) => http('GET', `/admin/tablas/${encodeURIComponent(t)}/columnas`), ({ db }, t) => db.columnas(t)),
  filas: op(
    (t) => http('GET', `/admin/tablas/${encodeURIComponent(t)}/filas?limite=100`),
    ({ db }, t) => {
      const r0 = db.db.exec(`SELECT * FROM "${t}" LIMIT 100`)[0]
      return r0 ? { columns: r0.columns, rows: r0.values } : { columns: [], rows: [] }
    },
  ),
  consultaSQL: op(
    (sql) => http('POST', '/admin/sql', { sql }),
    ({ db }, sql) => {
      const t0 = performance.now()
      const out = db.exec(sql)
      return { out, ms: Math.round(performance.now() - t0), cambios: out.length ? undefined : db.db.getRowsModified() }
    },
    true,
  ),
  modelo: op(() => http('GET', '/admin/modelo'), () => null),
}

/** Fuerza que todas las pantallas vuelvan a leer sus datos. */
export function refrescar() {
  version++
  notificar()
}

/** Vuelve a consultar /api/health (botón del panel de base de datos). */
export async function comprobarSalud() {
  health = await http('GET', '/health', undefined, { timeout: 15000 })
  notificar()
  return health
}

/** Ejecuta las 25 pruebas: en MySQL dentro de una transacción con ROLLBACK, o en una copia local. */
export async function correrPruebas(onResultado) {
  if (modo === 'remoto') {
    const { resultados, rollback } = await http('POST', '/tests', {})
    const acumulado = []
    for (const r of resultados) { acumulado.push(r); onResultado?.(r, [...acumulado]) }
    return { resultados, rollback }
  }
  const [{ ejecutarPruebas }, { b }] = await Promise.all([import('./tests'), local()])
  const resultados = await ejecutarPruebas(b.nuevaBD, onResultado)
  return { resultados, rollback: false }
}

// ---------------------------------------------------------------- hook para las pantallas
/**
 * Carga datos async con estado de carga y error. Se recarga solo cuando cambian "deps"
 * o cuando cualquier pantalla modifica datos (así reemplaza a useDBVersion).
 */
export function useDatos(fn, deps = []) {
  const v = useSyncExternalStore(suscribir, () => version)
  const clave = `${v}|${JSON.stringify(deps)}`
  const [res, setRes] = useState({ clave: null, data: null, error: null })
  const ref = useRef(fn)
  useEffect(() => { ref.current = fn })
  useEffect(() => {
    let vivo = true
    Promise.resolve()
      .then(() => ref.current())
      .then((data) => vivo && setRes({ clave, data, error: null }))
      .catch((e) => vivo && setRes((s) => ({ clave, data: s.data, error: e.message || 'Error' })))
    return () => { vivo = false }
  }, [clave])
  return { data: res.data, error: res.error, cargando: res.clave !== clave, recargar: refrescar }
}
