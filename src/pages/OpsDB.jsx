// Secciones del Panel interno que leen y escriben en la base de datos: MySQL 8 con Prisma (API)
// o, si el servidor no responde, la base SQLite local de respaldo.
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Field from '../components/Field'
import { updateOrder } from '../context/CartContext'
import { makeAlert } from '../data/ops'
import { fmtPEN, fmtUSD } from '../data/products'
import { useAuth } from '../context/AuthContext'
import { esInspector } from '../permisos.js'
import { api, comprobarSalud, correrPruebas, refrescar, useDatos, useModo } from '../db/data'
import { PRUEBAS } from '../db/tests'
import schemaPrisma from '../../prisma/schema.prisma?raw'
import extrasSQL from '../../prisma/sql/extras.sql?raw'

const ESTADO = {
  PAGADO: 'Nuevo', EN_PREPARACION: 'En preparación', LISTO: 'Listo', DESPACHADO: 'Despachado', ENTREGADO: 'Entregado', COTIZADO: 'Cotizado',
}
const LEGACY = { EN_PREPARACION: 'preparando', LISTO: 'listo', DESPACHADO: 'despachado' }
const BOTON = { PAGADO: 'Empezar a preparar', EN_PREPARACION: 'Marcar listo', LISTO: 'Despachar', DESPACHADO: 'Confirmar entrega' }
const money = (p) => (p.moneda === 'USD' ? fmtUSD(p.total) : fmtPEN(p.total))
const hora = (s) => (s ? new Date(s.replace(' ', 'T')).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '')

function Tabla({ columns, rows }) {
  return (
    <div className="table-wrap dbt">
      <table>
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((v, j) => <td key={j}>{v === null || v === undefined ? <em className="dbt__null">NULL</em> : String(v)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Estado de carga / error de una consulta. Devuelve un elemento si todavía no hay datos que mostrar.
function Estado({ r, que = 'los datos' }) {
  if (r.error && !r.data) return <p className="notice notice--warn" role="alert">No se pudo leer {que}: {r.error}</p>
  if (!r.data) return <p className="muted" role="status">Cargando {que} desde la base de datos...</p>
  return null
}
const Aviso = ({ error }) => (error ? <p className="notice notice--warn" role="alert">{error}</p> : null)

// ------------------------------------------------------------ Barista y Dark store
async function avanzar(codigo) {
  const p = await api.avanzarPedido(codigo)
  const legacy = LEGACY[p.estado]
  if (legacy) updateOrder(codigo, (cur) => ({ status: legacy, alerts: [...(cur.alerts || []), makeAlert(legacy, codigo)] }))
  return p
}

function PerfilMini({ id_cliente }) {
  const r = useDatos(() => (id_cliente ? api.fichaCliente(id_cliente) : null), [id_cliente])
  if (!id_cliente) return <span className="muted">Venta en barra (sin cliente)</span>
  if (!r.data) return <span className="muted">{r.error ? 'No se pudo leer el perfil del cliente.' : 'Leyendo el perfil del cliente...'}</span>
  const f = r.data
  return (
    <div className="dbx__perfil">
      <span>Plan {f.cliente.plan}</span>
      {f.perfil ? (
        <span>Perfil: {f.perfil.notas_preferidas}, {f.perfil.metodo_extraccion}, molienda {f.perfil.tipo_molienda?.toLowerCase()}, intensidad {f.perfil.intensidad}/5</span>
      ) : <span>Sin perfil de sabor todavía</span>}
      {f.notas[0] && <span>Nota: {f.notas[0].nota}</span>}
    </div>
  )
}

function VentaBarra() {
  const r = useDatos(() => api.listarVariantes('BEBIDA'))
  const bebidas = r.data ?? []
  const [elegido, setElegido] = useState('')
  const id = elegido || bebidas[0]?.id_variante || ''
  const [qty, setQty] = useState(1)
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const vender = async (e) => {
    e.preventDefault()
    const n = Math.max(1, Number(qty) || 1)
    setBusy(true)
    setOk('')
    try {
      const p = await api.crearPedido({ canal: 'POS', items: [{ id_variante: Number(id), cantidad: n }], metodoPago: 'EFECTIVO' })
      const receta = await api.recetaDe(Number(id))
      const usado = receta.filter((x) => x.unidad !== 'u').map((x) => `${x.cantidad * n} ${x.unidad} de ${x.nombre.toLowerCase()}`)
      setOk(`Venta ${p.codigo} registrada: ${fmtPEN(p.total)}, ${p.numero_comprobante}. Se descontó del almacén: ${usado.join(', ')}.`)
    } catch (err) {
      setOk(/check/i.test(err.message) ? 'No alcanzan los insumos del almacén para esta venta.' : err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="dbx__pos" onSubmit={vender}>
      <h3 className="display-s">Venta en barra (punto de venta)</h3>
      <Estado r={r} que="las bebidas" />
      <div className="ops__split ops__split--narrow">
        <Field label="Producto" as="select" value={id} onChange={(e) => setElegido(e.target.value)}>
          {bebidas.map((v) => <option key={v.id_variante} value={v.id_variante}>{v.nombre} {v.descripcion} ({fmtPEN(v.precio)})</option>)}
        </Field>
        <Field label="Cantidad" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
      <button type="submit" className="btn btn--primary btn--sm" disabled={busy || !bebidas.length}>{busy ? 'Registrando venta...' : 'Cobrar en efectivo'}</button>
      {ok && <p className="form-ok" role="status">{ok}</p>}
    </form>
  )
}

export function ColaPedidos({ modo }) {
  const barista = modo === 'barista'
  const r = useDatos(async () => {
    const [pedidos, cola, inventario, insumos, zonas] = await Promise.all([
      api.listarPedidos({ estados: barista ? ['PAGADO', 'EN_PREPARACION'] : ['LISTO', 'DESPACHADO'] }),
      barista ? [] : api.colaDarkStore(),
      barista ? [] : api.listarInventario(),
      barista ? api.listarInsumos() : [],
      barista ? [] : api.listarZonas(),
    ])
    return { pedidos, cola, inventario, insumos, zonas }
  }, [modo])
  const [accion, setAccion] = useState({ codigo: null, error: '' })
  const recargarRef = useRef(r.recargar)
  useEffect(() => {
    recargarRef.current = r.recargar
  })
  useEffect(() => {
    // La cuenta regresiva de 24 h se calcula en el servidor: se vuelve a leer cada 30 s
    const t = setInterval(() => recargarRef.current(), 30000)
    return () => clearInterval(t)
  }, [])

  const mover = async (codigo) => {
    setAccion({ codigo, error: '' })
    try {
      await avanzar(codigo)
      setAccion({ codigo: null, error: '' })
    } catch (e) {
      setAccion({ codigo: null, error: e.message })
    }
  }

  if (!r.data) return <div className="dbx"><Estado r={r} que="los pedidos" /></div>
  const { cola, inventario, insumos, zonas } = r.data
  const pedidos = r.data.pedidos.filter((p) => p.canal !== 'POS' || barista)
  return (
    <div className="dbx">
      <p className="muted measure">
        {barista
          ? 'Pedidos pagados leídos de la tabla Pedido. Al preparar, el barista ve el perfil de sabor y las notas del cliente (CRM).'
          : 'Pedidos listos para reparto. Cada entrega tiene un límite de 24 horas desde el pago (tabla Entrega).'}
      </p>
      <Aviso error={r.error || accion.error} />
      {pedidos.length ? (
        <ul className="ops__list">
          {pedidos.map((p) => {
            const c = cola.find((x) => x.codigo === p.codigo)
            return (
              <li key={p.codigo} className="ops__item">
                <div>
                  <strong>Pedido {p.codigo}</strong>
                  <span className="muted">{hora(p.fecha)}, {p.cliente || 'Cliente en barra'}, {money(p)}{p.distrito ? `, ${p.distrito}` : ''}</span>
                  <ul className="ops__lines">
                    {p.items.map((it) => (
                      <li key={it.id_detalle}>
                        {it.cantidad} x {it.nombre} {it.descripcion}
                        {it.configuracion?.molienda ? `, ${it.configuracion.molienda}` : ''}
                        {it.unidades.length ? `, QR ${it.unidades.map((u) => u.codigo_qr).join(', ')}` : ''}
                      </li>
                    ))}
                  </ul>
                  {barista && <PerfilMini id_cliente={p.id_cliente} />}
                </div>
                <div className="ops__act">
                  <span className={`badge badge--${(LEGACY[p.estado] || 'nuevo')}`}>{ESTADO[p.estado]}</span>
                  {c && (
                    <span className={`dbx__timer${c.atrasado ? ' is-late' : ''}`}>
                      {c.atrasado ? `Atrasado ${Math.abs(Math.round(c.restanteMin / 60))} h` : `Quedan ${Math.floor(c.restanteMin / 60)} h ${c.restanteMin % 60} min`}
                    </span>
                  )}
                  {BOTON[p.estado] && (
                    <button type="button" className="btn btn--primary btn--sm" disabled={accion.codigo === p.codigo} onClick={() => mover(p.codigo)}>
                      {accion.codigo === p.codigo ? 'Guardando...' : BOTON[p.estado]}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="muted">{barista ? 'No hay pedidos por preparar.' : 'No hay pedidos listos para despachar.'}</p>
      )}
      {barista && <VentaBarra />}
      {barista && (
        <div>
          <h3 className="display-s">Almacén de insumos</h3>
          <Tabla columns={['Insumo', 'Stock', 'Mínimo']} rows={insumos.map((i) => [`${i.nombre}${i.bajo ? ' ⚠' : ''}`, `${Math.round(i.stock).toLocaleString('es-PE')} ${i.unidad}`, `${Math.round(i.stock_minimo).toLocaleString('es-PE')} ${i.unidad}`])} />
        </div>
      )}
      {!barista && (
        <div className="ops__split dbx__mt">
          <div>
            <h3 className="display-s">Zonas de reparto</h3>
            <Tabla columns={['Distrito', 'Costo de envío']} rows={zonas.map((z) => [z.distrito, fmtPEN(z.costo_envio)])} />
          </div>
          <div>
            <h3 className="display-s">Inventario</h3>
            <Tabla columns={['Ubicación', 'Producto', 'Cantidad']} rows={inventario.map((i) => [i.ubicacion, `${i.nombre} ${i.descripcion}`, i.cantidad])} />
          </div>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------ Trazabilidad por etapas (blockchain)
const ETAPAS = [['FINCA', 'Finca (cosecha)'], ['DARK_STORE', 'Dark store / almacén'], ['TUESTE', 'Tueste'], ['EXPORTACION', 'Exportación'], ['DELIVERY', 'Delivery']]

export function Trazabilidad() {
  const { staff } = useAuth()
  const inspector = esInspector(staff.rol)
  const rl = useDatos(async () => ({ lotes: await api.listarLotes(), empleados: await api.listarEmpleados(true) }))
  const [elegido, setElegido] = useState('')
  const lote = elegido || rl.data?.lotes[0]?.codigo_lote || ''
  const rr = useDatos(() => (lote ? api.rutaLote(lote) : []), [lote])
  // Un inspector solo firma con su propio código; el administrador elige el inspector
  const [v, setV] = useState({ tipo: 'DELIVERY', ubicacion: '', emp: inspector ? staff.codigo : 'RD1' })
  const [ver, setVer] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const firmar = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await api.registrarEtapa({ codigo_lote: lote, tipo: v.tipo, ubicacion: v.ubicacion || null, codigo_empleado: v.emp })
      setMsg(`Bloque ${r.orden} sellado por ${r.inspector}.`)
      setVer(null)
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }
  const verificar = async () => {
    setBusy(true)
    try {
      setVer(await api.verificarCadena(lote))
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!rl.data) return <Estado r={rl} que="los lotes" />
  const { lotes } = rl.data
  const empleados = inspector ? rl.data.empleados.filter((e) => e.codigo === staff.codigo) : rl.data.empleados
  const ruta = rr.data ?? []
  return (
    <div className="ops__split">
      <div className="auth__form">
        <Field label="Lote" as="select" value={lote} onChange={(e) => { setElegido(e.target.value); setVer(null); setMsg('') }}>
          {lotes.map((l) => <option key={l.codigo_lote} value={l.codigo_lote}>{l.codigo_lote} ({l.tipo === 'VERDE' ? 'café verde' : 'tostado'})</option>)}
        </Field>
        <form className="auth__form" onSubmit={firmar}>
          <Field label="Etapa" as="select" value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}>
            {ETAPAS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
          </Field>
          <Field label="Ubicación" value={v.ubicacion} onChange={(e) => setV({ ...v, ubicacion: e.target.value })} placeholder="Ej. Miraflores, Lima" />
          <Field label="Inspector que firma" as="select" value={v.emp} disabled={inspector} hint={inspector ? 'Solo puedes firmar con tu propio código.' : undefined} onChange={(e) => setV({ ...v, emp: e.target.value })}>
            {empleados.map((x) => <option key={x.codigo} value={x.codigo}>{x.codigo} · {x.nombre} ({x.rol.replace(/_/g, ' ').toLowerCase()})</option>)}
          </Field>
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Sellando...' : 'Firmar y sellar etapa'}</button>
        </form>
        <button type="button" className="btn btn--ghost" onClick={verificar} disabled={busy}>Verificar integridad de la cadena</button>
        {msg && <p className="form-ok" role="status">{msg}</p>}
        {ver && (
          <p className={ver.ok ? 'form-ok' : 'notice notice--warn'} role="status">
            {ver.ok ? `Cadena íntegra: ${ver.bloques} bloques verificados con SHA-256.` : `Cadena alterada en el bloque ${ver.rotoEn} (${ver.etapa}).`}
          </p>
        )}
        <Link className="btn btn--ghost" to={`/qr/${lote}`}>Ver pasaporte del lote</Link>
      </div>
      <div>
        <h3 className="display-s">Ruta del lote</h3>
        <Aviso error={rr.error} />
        {rr.cargando && !rr.data && <p className="muted" role="status">Leyendo la ruta firmada...</p>}
        <ol className="dbx__ruta">
          {ruta.map((r) => (
            <li key={r.orden}>
              <strong>{r.orden}. {ETAPAS.find((e) => e[0] === r.tipo)?.[1]}</strong>
              <span>{r.ubicacion || 'Sin ubicación'}</span>
              <span>Firmó {r.codigo_inspector} · {r.inspector}, {hora(r.firmado_en)}</span>
              <code title={r.hash}>hash {r.hash.slice(0, 18)}…  ←  {r.hash_anterior.slice(0, 10)}…</code>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// ------------------------------------------------------------ Dashboard IoT de lotes
export function DashboardLotes() {
  const r = useDatos(() => api.dashboardLotes())
  const primera = useRef(true)
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    // Cada vez que se abre el panel, los sensores simulados envían una lectura nueva por lote
    if (!primera.current) return
    primera.current = false
    api.simularSensores().catch((e) => setError(e.message))
  }, [])
  const leer = async () => {
    setLeyendo(true)
    setError('')
    try {
      await api.simularSensores()
    } catch (e) {
      setError(e.message)
    } finally {
      setLeyendo(false)
    }
  }
  if (!r.data) return <div className="dbx"><Estado r={r} que="los lotes" /></div>
  const lotes = r.data
  const alertas = lotes.filter((l) => l.alerta)
  return (
    <div className="dbx">
      <p className="muted measure">Una lectura nueva por lote cada vez que se abre esta pestaña (sensores Agro-IoT simulados, tabla TelemetriaIoT). Rango de humedad recomendado: 10 a 12 %.</p>
      <Aviso error={r.error || error} />
      {alertas.map((a) => (
        <p key={a.codigo_lote} className="notice notice--warn" role="alert">Alerta: humedad de {a.humedad} % en {a.codigo_lote}. Se notificó al panel y por WhatsApp al inspector.</p>
      ))}
      <Tabla
        columns={['Lote', 'Tipo', 'Finca', 'Variedad', 'SCA', 'Humedad %', 'CO2 ppm', 'Etapa actual', 'Bloques', 'QR']}
        rows={lotes.map((l) => [l.codigo_lote, l.tipo, l.finca_origen, l.variedad, l.puntaje_sca, `${l.humedad}${l.alerta ? ' ⚠' : ''}`, l.co2, l.etapa_actual, l.etapas, l.unidades])}
      />
      <button type="button" className="btn btn--ghost dbx__mt" onClick={leer} disabled={leyendo}>{leyendo ? 'Leyendo sensores...' : 'Leer sensores ahora'}</button>
    </div>
  )
}

// ------------------------------------------------------------ CRM
export function Crm() {
  const { staff } = useAuth()
  const rc = useDatos(() => api.listarClientes())
  const [elegido, setElegido] = useState('')
  const id = elegido || rc.data?.[0]?.id_cliente || ''
  const rf = useDatos(() => (id ? api.fichaCliente(Number(id)) : null), [id])
  const [nota, setNota] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!rc.data) return <Estado r={rc} que="los clientes" />
  const clientes = rc.data
  const f = rf.data
  const c = f?.cliente
  const guardar = async (e) => {
    e.preventDefault()
    if (!nota.trim()) return
    setBusy(true)
    setError('')
    try {
      await api.agregarNota(c.id_cliente, nota.trim(), staff.codigo)
      setNota('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="ops__split">
      <div className="auth__form">
        <Field label="Cliente" as="select" value={id} onChange={(e) => setElegido(e.target.value)}>
          {clientes.map((x) => <option key={x.id_cliente} value={x.id_cliente}>{x.nombre} ({x.email})</option>)}
        </Field>
        <Aviso error={rf.error || error} />
        {!c ? <p className="muted" role="status">Cargando la ficha del cliente...</p> : (
          <>
            <div className="dbx__ficha">
              <p><strong>{c.nombre}</strong>{c.empresa ? `, ${c.empresa}` : ''}</p>
              <p className="muted">{c.tipo_segmento}{c.tipo_b2b ? ` · ${c.tipo_b2b}` : ''} · Plan {c.plan} · {c.pais} · WhatsApp {c.telefono}</p>
              {f.perfil
                ? <p>Perfil de sabor: {f.perfil.notas_preferidas}; {f.perfil.metodo_extraccion}; molienda {f.perfil.tipo_molienda}; intensidad {f.perfil.intensidad}/5</p>
                : <p className="muted">Sin perfil de sabor.</p>}
            </div>
            <form className="auth__form" onSubmit={guardar}>
              <Field label="Nueva nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. prefiere leche de avena" />
              <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>{busy ? 'Guardando...' : 'Guardar nota'}</button>
            </form>
            <ul className="ops__list">
              {f.notas.map((n, i) => <li key={i} className="ops__item ops__item--flat"><span>{n.nota}</span><span className="muted">{n.empleado || 'Sistema'}, {hora(n.creada_en)}</span></li>)}
            </ul>
          </>
        )}
      </div>
      <div>
        <h3 className="display-s">Historial de pedidos</h3>
        {f && <Tabla columns={['Pedido', 'Canal', 'Estado', 'Total', 'Fecha']} rows={f.pedidos.map((p) => [p.codigo, p.canal, ESTADO[p.estado] || p.estado, money(p), hora(p.fecha)])} />}
      </div>
    </div>
  )
}

// ------------------------------------------------------------ Base de datos: explorador, consola SQL y pruebas
const EJEMPLOS_COMUNES = [
  ['Ventas por canal', 'SELECT * FROM v_ventas_por_canal;'],
  ['Ruta firmada de un lote', `SELECT * FROM v_ruta_lote WHERE codigo_lote = 'HP-ORI-0925';`],
  ['Clientes por plan', `SELECT pl.nombre AS plan, COUNT(*) AS clientes FROM Membresia m JOIN Plan pl ON pl.id_plan = m.id_plan
WHERE m.estado = 'ACTIVA' GROUP BY pl.nombre;`],
  ['Receta con gramaje', `SELECT * FROM v_receta WHERE producto IN ('Latte', 'Casa');`],
  ['Stock bajo', 'SELECT p.nombre, v.descripcion, v.stock FROM VarianteProducto v JOIN Producto p USING(id_producto) WHERE v.stock < 20;'],
]
const EJEMPLOS = {
  remoto: [
    EJEMPLOS_COMUNES[0],
    ['Pedidos con cliente y comprobante', `SELECT p.codigo, c.nombre, p.canal, p.estado, p.moneda, p.total, CONCAT(cp.serie, '-', cp.numero) AS comprobante
FROM Pedido p LEFT JOIN Cliente c ON c.id_cliente = p.id_cliente
LEFT JOIN Comprobante cp ON cp.id_pedido = p.id_pedido ORDER BY p.fecha DESC;`],
    ...EJEMPLOS_COMUNES.slice(1),
    ['Triggers y CHECK del servidor', `SELECT trigger_name, event_object_table AS tabla, action_timing, event_manipulation FROM information_schema.triggers WHERE trigger_schema = DATABASE();`],
    ['Intentar escribir (se rechaza)', `DELETE FROM Pedido;`],
  ],
  local: [
    EJEMPLOS_COMUNES[0],
    ['Pedidos con cliente y comprobante', `SELECT p.codigo, c.nombre, p.canal, p.estado, p.moneda, p.total, cp.serie || '-' || cp.numero AS comprobante
FROM Pedido p LEFT JOIN Cliente c ON c.id_cliente = p.id_cliente
LEFT JOIN Comprobante cp ON cp.id_pedido = p.id_pedido ORDER BY p.fecha DESC;`],
    ...EJEMPLOS_COMUNES.slice(1),
    ['Probar una FK inválida', `INSERT INTO Pedido (codigo, id_cliente, canal, moneda) VALUES ('X-1', 9999, 'WEB', 'PEN');`],
  ],
}

function Consola({ modo }) {
  const ejemplos = EJEMPLOS[modo]
  const motor = modo === 'remoto' ? 'MySQL' : 'SQLite'
  const [sql, setSql] = useState(ejemplos[0][1])
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const correr = async () => {
    setErr('')
    setBusy(true)
    try {
      setRes(await api.consultaSQL(sql))
    } catch (e) {
      setRes(null)
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="dbx__consola">
      <h3 className="display-s">Consola SQL</h3>
      {modo === 'remoto' && <p className="muted measure">Solo lectura: SELECT, SHOW, DESCRIBE y EXPLAIN, con un máximo de {res?.limite ?? 200} filas. Cualquier otra sentencia se rechaza en el servidor.</p>}
      <div className="chips dbx__ejemplos">
        {ejemplos.map(([t, q]) => <button key={t} type="button" className="pill" onClick={() => { setSql(q); setRes(null); setErr('') }}>{t}</button>)}
      </div>
      <label className="sr-only" htmlFor="sql">Consulta SQL</label>
      <textarea id="sql" className="dbx__sql" value={sql} onChange={(e) => setSql(e.target.value)} spellCheck={false} rows={5}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') correr() }} />
      <button type="button" className="btn btn--primary btn--sm" onClick={correr} disabled={busy}>{busy ? 'Ejecutando...' : 'Ejecutar (Ctrl + Enter)'}</button>
      {err && <p className="notice notice--warn dbx__mt" role="alert">Error de {motor}: {err}</p>}
      {res && (
        <div className="dbx__mt">
          <p className="muted">
            {res.out.length ? `${res.out.at(-1).rows.length} fila(s)${res.truncado ? ` (se muestran las primeras ${res.limite})` : ''}` : `${res.cambios ?? 0} fila(s) modificada(s)`} en {res.ms} ms
          </p>
          {res.out.map((r, i) => <Tabla key={i} columns={r.columns} rows={r.rows.slice(0, 200)} />)}
        </div>
      )}
    </div>
  )
}

function Pruebas({ modo }) {
  const [res, setRes] = useState([])
  const [corriendo, setCorriendo] = useState(false)
  const [info, setInfo] = useState(null)
  const [error, setError] = useState('')
  const correr = async () => {
    setCorriendo(true)
    setRes([])
    setError('')
    setInfo(null)
    try {
      const r = await correrPruebas((_, todos) => setRes([...todos]))
      setInfo(r)
    } catch (e) {
      setError(e.message)
    } finally {
      setCorriendo(false)
    }
  }
  const ok = res.filter((r) => r.ok).length
  return (
    <div className="dbx__pruebas">
      <h3 className="display-s">Pruebas automáticas ({PRUEBAS.length})</h3>
      <p className="muted measure">
        {modo === 'remoto'
          ? 'Corren en el servidor contra MySQL dentro de una transacción interactiva de Prisma que termina con un error controlado: se hace ROLLBACK de todo y los datos de la demo no cambian. Tardan unos 30 a 90 segundos por la latencia de la red.'
          : 'Se ejecutan sobre una copia nueva de la base, así no cambian los datos de la demo. Validan reglas de negocio, flujos QR, comprobantes y la cadena de firmas.'}
      </p>
      <button type="button" className="btn btn--primary btn--sm" onClick={correr} disabled={corriendo}>{corriendo ? 'Ejecutando en el servidor...' : 'Ejecutar pruebas'}</button>
      <Aviso error={error} />
      {res.length > 0 && (
        <>
          <p className={`dbx__score${ok === res.length && !corriendo ? ' is-ok' : ''}`}>{ok} de {res.length} pruebas superadas{info?.rollback ? ' · ROLLBACK aplicado, datos intactos' : ''}</p>
          <ul className="dbx__tests">
            {res.map((r, i) => (
              <li key={i} className={r.ok ? 'is-ok' : 'is-fail'}>
                <span aria-hidden="true">{r.ok ? '✓' : '✗'}</span>
                <div><strong>{r.modulo}:</strong> {r.nombre}<small>{r.detalle} · {r.ms} ms</small></div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// Modelo Prisma: lo lee el servidor del cliente generado (DMMF) y lo muestra con sus relaciones
function ModeloPrisma() {
  const r = useDatos(() => api.modelo())
  const [abierto, setAbierto] = useState(false)
  if (!r.data) return r.error ? <Aviso error={`No se pudo leer el modelo: ${r.error}`} /> : null
  const { modelos, prisma } = r.data
  const relaciones = modelos.reduce((s, m) => s + m.campos.filter((c) => c.relacion && !c.relacion.lista && c.relacion.campos.length).length, 0)
  return (
    <section className="dbx__modelo dbx__mt" aria-label="Modelo Prisma">
      <h3 className="display-s">Modelo de datos (schema.prisma)</h3>
      <p className="muted measure">
        Prisma {prisma} describe la base en <code>prisma/schema.prisma</code>: cada <code>model</code> es una tabla de MySQL, cada campo una columna,
        <code> @id</code> la clave primaria, <code>@unique</code> un índice único y <code>@relation</code> una clave foránea con su <code>onDelete</code>.
        Hay {modelos.length} modelos y {relaciones} relaciones. Lo que Prisma no expresa (CHECK, triggers y vistas) vive en <code>prisma/sql/extras.sql</code>.
      </p>
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
        {abierto ? 'Ocultar los modelos' : `Ver los ${modelos.length} modelos y sus relaciones`}
      </button>
      {abierto && (
        <div className="dbx__modelos">
          {modelos.map((m) => (
            <details key={m.nombre}>
              <summary><strong>{m.nombre}</strong> <small>{m.campos.filter((c) => !c.relacion).length} campos · {m.campos.filter((c) => c.relacion).length} relaciones</small></summary>
              <ul className="dbx__cols">
                {m.campos.map((c) => (
                  <li key={c.nombre}>
                    <code>{c.nombre}</code> <small>{c.tipo}</small>
                    {c.pk && <b className="dbx__k">@id</b>}
                    {c.unico && !c.pk && <b className="dbx__k">@unique</b>}
                    {c.relacion && (
                      <b className="dbx__k dbx__k--fk">
                        {c.relacion.lista ? `1:N → ${c.relacion.modelo}` : c.relacion.campos.length ? `FK ${c.relacion.campos.join(', ')} → ${c.relacion.modelo}${c.relacion.onDelete ? ` (onDelete: ${c.relacion.onDelete})` : ''}` : `1:1 → ${c.relacion.modelo}`}
                      </b>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}

function descargar(nombre, texto) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([texto], { type: 'text/plain' }))
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function BaseDeDatos() {
  const { modo, health } = useModo()
  const remoto = modo === 'remoto'
  const rt = useDatos(() => api.tablas())
  const [sel, setSel] = useState('Pedido')
  const rd = useDatos(async () => ({ cols: await api.columnas(sel), datos: await api.filas(sel) }), [sel])
  const [probando, setProbando] = useState(false)
  const [errSalud, setErrSalud] = useState('')

  const comprobar = async () => {
    setProbando(true)
    setErrSalud('')
    try {
      await comprobarSalud()
    } catch (e) {
      setErrSalud(e.message)
    } finally {
      setProbando(false)
    }
  }
  const acciones = async (que) => {
    const b = await import('../db/browser')
    if (que === 'bd') b.descargarBD()
    else if (que === 'esquema') b.descargarEsquema()
    else if (window.confirm('¿Restaurar los datos de ejemplo? Se borran los cambios hechos en este navegador.')) b.reiniciarBD()
  }

  const tablas = rt.data ?? []
  const totalFilas = tablas.reduce((s, t) => s + (t.type === 'table' ? t.filas : 0), 0)
  const detalle = rd.data
  const version = (health?.version || '').split('.').slice(0, 2).join('.') || '8.0'
  return (
    <div className="dbx">
      {remoto ? (
        <div className="dbx__estado is-ok" role="status">
          <strong>Conectado a MySQL {version} mediante Prisma ORM</strong>
          <span>
            /api/health → {JSON.stringify({ ok: health.ok, motor: health.motor, version: health.version })} · {health.orm} {health.prisma} · respuesta en {health.ms} ms ·
            {' '}{health.triggers ? 'triggers de MySQL activos' : 'reglas de negocio aplicadas desde la API (triggers pendientes en el servidor)'}
          </span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={comprobar} disabled={probando}>{probando ? 'Comprobando...' : 'Comprobar conexión'}</button>
          {errSalud && <span className="notice notice--warn" role="alert">{errSalud}</span>}
        </div>
      ) : (
        <div className="dbx__estado is-warn" role="status">
          <strong>Modo sin conexión (base local)</strong>
          <span>No hay respuesta de /api/health: la app funciona con la base SQLite que corre en este navegador. Recarga la página para volver a intentar la conexión con MySQL.</span>
        </div>
      )}
      <div className="dbx__head">
        <p className="muted measure">
          {remoto
            ? `Base de datos MySQL ${health.version} en el servidor del equipo, con el modelo entidad-relación del equipo definido en Prisma: `
            : 'Base de datos SQLite real (sql.js / WebAssembly) que corre en el navegador con el modelo entidad-relación del equipo: '}
          {tablas.filter((t) => t.type === 'table').length} tablas, {tablas.filter((t) => t.type === 'view').length} vistas y {totalFilas} registros.
          {' '}Claves primarias, foráneas, CHECK, UNIQUE y transacciones activos.
        </p>
        <div className="dbx__acciones">
          {remoto ? (
            <>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => descargar('schema.prisma', schemaPrisma)}>Descargar schema.prisma</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => descargar('extras.sql', extrasSQL)}>Descargar extras.sql</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={refrescar}>Actualizar datos</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => acciones('bd')}>Descargar .sqlite</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => acciones('esquema')}>Descargar schema.sql</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => acciones('reiniciar')}>Restaurar datos de ejemplo</button>
            </>
          )}
        </div>
      </div>
      <Aviso error={rt.error} />
      {!rt.data && !rt.error && <p className="muted" role="status">Leyendo las tablas desde la base de datos...</p>}
      <div className="dbx__explorer">
        <nav className="dbx__tablas" aria-label="Tablas">
          {tablas.map((t) => (
            <button key={t.name} type="button" aria-pressed={sel === t.name} onClick={() => setSel(t.name)}>
              <span>{t.type === 'view' ? '◇ ' : ''}{t.name}</span><small>{t.filas}</small>
            </button>
          ))}
        </nav>
        <div className="dbx__tabla">
          <h3 className="display-s">{sel}</h3>
          <Aviso error={rd.error} />
          {!detalle && !rd.error && <p className="muted" role="status">Cargando {sel}...</p>}
          {detalle && (
            <>
              <ul className="dbx__cols">
                {detalle.cols.map((c) => (
                  <li key={c.nombre}>
                    <code>{c.nombre}</code> <small>{c.tipo || 'ANY'}</small>
                    {c.pk && <b className="dbx__k">PK</b>}
                    {c.fk && <b className="dbx__k dbx__k--fk">FK → {c.fk}</b>}
                    {c.notNull && !c.pk && <small> NOT NULL</small>}
                  </li>
                ))}
              </ul>
              {detalle.datos.rows.length ? <Tabla columns={detalle.datos.columns} rows={detalle.datos.rows} /> : <p className="muted">Tabla vacía.</p>}
            </>
          )}
        </div>
      </div>
      {remoto && <ModeloPrisma />}
      <div className="ops__split dbx__mt">
        <Consola key={modo} modo={modo} />
        <Pruebas modo={modo} />
      </div>
    </div>
  )
}
