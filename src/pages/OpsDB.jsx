// Secciones del Panel interno que leen y escriben directamente en la base de datos SQLite
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Field from '../components/Field'
import { updateOrder } from '../context/CartContext'
import { makeAlert } from '../data/ops'
import { fmtPEN, fmtUSD } from '../data/products'
import { descargarBD, descargarEsquema, getDB, nuevaBD, reiniciarBD, useDBVersion } from '../db/browser'
import * as repo from '../db/repo'
import { ejecutarPruebas, PRUEBAS } from '../db/tests'

const ESTADO = {
  PAGADO: 'Nuevo', EN_PREPARACION: 'En preparación', LISTO: 'Listo', DESPACHADO: 'Despachado', ENTREGADO: 'Entregado', COTIZADO: 'Cotizado',
}
const LEGACY = { EN_PREPARACION: 'preparando', LISTO: 'listo', DESPACHADO: 'despachado' }
const BOTON = { PAGADO: 'Empezar a preparar', EN_PREPARACION: 'Marcar listo', LISTO: 'Despachar', DESPACHADO: 'Confirmar entrega' }
const money = (p) => (p.moneda === 'USD' ? fmtUSD(p.total) : fmtPEN(p.total))
const hora = (s) => (s ? new Date(s.replace(' ', 'T')).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '')
const db = () => getDB()

function Tabla({ columns, rows }) {
  return (
    <div className="table-wrap dbt">
      <table>
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((v, j) => <td key={j}>{v === null ? <em className="dbt__null">NULL</em> : String(v)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ------------------------------------------------------------ Barista y Dark store
async function avanzar(codigo) {
  const p = await repo.avanzarPedido(db(), codigo)
  const legacy = LEGACY[p.estado]
  if (legacy) updateOrder(codigo, (cur) => ({ status: legacy, alerts: [...(cur.alerts || []), makeAlert(legacy, codigo)] }))
  return p
}

function PerfilMini({ id_cliente }) {
  if (!id_cliente) return <span className="muted">Venta en barra (sin cliente)</span>
  const f = repo.fichaCliente(db(), id_cliente)
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
  const bebidas = repo.listarVariantes(db()).filter((v) => v.tipo === 'BEBIDA' || v.tipo === 'CAFE')
  const [id, setId] = useState(bebidas[0]?.id_variante)
  const [qty, setQty] = useState(1)
  const [ok, setOk] = useState('')
  const vender = async (e) => {
    e.preventDefault()
    const p = await repo.crearPedido(db(), { canal: 'POS', items: [{ id_variante: Number(id), cantidad: Math.max(1, Number(qty) || 1) }], metodoPago: 'EFECTIVO' })
    setOk(`Venta ${p.codigo} registrada: ${fmtPEN(p.total)}, ${p.numero_comprobante}.`)
  }
  return (
    <form className="dbx__pos" onSubmit={vender}>
      <h3 className="display-s">Venta en barra (punto de venta)</h3>
      <div className="ops__split ops__split--narrow">
        <Field label="Producto" as="select" value={id} onChange={(e) => setId(e.target.value)}>
          {bebidas.map((v) => <option key={v.id_variante} value={v.id_variante}>{v.nombre} {v.descripcion} ({fmtPEN(v.precio)})</option>)}
        </Field>
        <Field label="Cantidad" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
      <button type="submit" className="btn btn--primary btn--sm">Cobrar en efectivo</button>
      {ok && <p className="form-ok" role="status">{ok}</p>}
    </form>
  )
}

export function ColaPedidos({ modo }) {
  useDBVersion()
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])
  const barista = modo === 'barista'
  const pedidos = repo.listarPedidos(db(), { estados: barista ? ['PAGADO', 'EN_PREPARACION'] : ['LISTO', 'DESPACHADO'] })
    .filter((p) => p.canal !== 'POS' || barista)
  const cola = barista ? [] : repo.colaDarkStore(db())
  const inventario = barista ? [] : repo.listarInventario(db())
  return (
    <div className="dbx">
      <p className="muted measure">
        {barista
          ? 'Pedidos pagados leídos de la tabla Pedido. Al preparar, el barista ve el perfil de sabor y las notas del cliente (CRM).'
          : 'Pedidos listos para reparto. Cada entrega tiene un límite de 24 horas desde el pago (tabla Entrega).'}
      </p>
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
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => avanzar(p.codigo)}>{BOTON[p.estado]}</button>
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
      {!barista && (
        <div className="ops__split dbx__mt">
          <div>
            <h3 className="display-s">Zonas de reparto</h3>
            <Tabla columns={['Distrito', 'Costo de envío']} rows={repo.listarZonas(db()).map((z) => [z.distrito, fmtPEN(z.costo_envio)])} />
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
  useDBVersion()
  const lotes = db().all('SELECT codigo_lote, tipo, finca_origen FROM LoteCafe ORDER BY tipo DESC, codigo_lote')
  const empleados = db().all(`SELECT codigo, nombre, rol FROM Empleado WHERE rol <> 'ADMIN' ORDER BY codigo`)
  const [lote, setLote] = useState(lotes[0]?.codigo_lote)
  const [v, setV] = useState({ tipo: 'DELIVERY', ubicacion: '', emp: 'RD1' })
  const [ver, setVer] = useState(null)
  const [msg, setMsg] = useState('')
  const ruta = repo.rutaLote(db(), lote)

  const firmar = async (e) => {
    e.preventDefault()
    try {
      const r = await repo.registrarEtapa(db(), { codigo_lote: lote, tipo: v.tipo, ubicacion: v.ubicacion || null, codigo_empleado: v.emp })
      setMsg(`Bloque ${r.orden} sellado por ${r.inspector}.`)
      setVer(null)
    } catch (err) {
      setMsg(err.message)
    }
  }
  const verificar = async () => setVer(await repo.verificarCadena(db(), lote))

  return (
    <div className="ops__split">
      <div className="auth__form">
        <Field label="Lote" as="select" value={lote} onChange={(e) => { setLote(e.target.value); setVer(null); setMsg('') }}>
          {lotes.map((l) => <option key={l.codigo_lote} value={l.codigo_lote}>{l.codigo_lote} ({l.tipo === 'VERDE' ? 'café verde' : 'tostado'})</option>)}
        </Field>
        <form className="auth__form" onSubmit={firmar}>
          <Field label="Etapa" as="select" value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}>
            {ETAPAS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
          </Field>
          <Field label="Ubicación" value={v.ubicacion} onChange={(e) => setV({ ...v, ubicacion: e.target.value })} placeholder="Ej. Miraflores, Lima" />
          <Field label="Inspector que firma" as="select" value={v.emp} onChange={(e) => setV({ ...v, emp: e.target.value })}>
            {empleados.map((x) => <option key={x.codigo} value={x.codigo}>{x.codigo} · {x.nombre} ({x.rol.replace(/_/g, ' ').toLowerCase()})</option>)}
          </Field>
          <button type="submit" className="btn btn--primary">Firmar y sellar etapa</button>
        </form>
        <button type="button" className="btn btn--ghost" onClick={verificar}>Verificar integridad de la cadena</button>
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
  useDBVersion()
  const primera = useRef(true)
  useEffect(() => {
    // Cada vez que se abre el panel, los sensores simulados envían una lectura nueva por lote
    if (!primera.current) return
    primera.current = false
    db().all('SELECT codigo_lote FROM LoteCafe').forEach((l) => repo.simularSensor(db(), l.codigo_lote, 1))
  }, [])
  const lotes = repo.dashboardLotes(db())
  const alertas = lotes.filter((l) => l.alerta)
  return (
    <div className="dbx">
      <p className="muted measure">Una lectura nueva por lote cada vez que se abre esta pestaña (sensores Agro-IoT simulados, tabla TelemetriaIoT). Rango de humedad recomendado: 10 a 12 %.</p>
      {alertas.map((a) => (
        <p key={a.codigo_lote} className="notice notice--warn" role="alert">Alerta: humedad de {a.humedad} % en {a.codigo_lote}. Se notificó al panel y por WhatsApp al inspector.</p>
      ))}
      <Tabla
        columns={['Lote', 'Tipo', 'Finca', 'Variedad', 'SCA', 'Humedad %', 'CO2 ppm', 'Etapa actual', 'Bloques', 'QR']}
        rows={lotes.map((l) => [l.codigo_lote, l.tipo, l.finca_origen, l.variedad, l.puntaje_sca, `${l.humedad}${l.alerta ? ' ⚠' : ''}`, l.co2, l.etapa_actual, l.etapas, l.unidades])}
      />
      <button type="button" className="btn btn--ghost dbx__mt" onClick={() => lotes.forEach((l) => repo.simularSensor(db(), l.codigo_lote, 1))}>Leer sensores ahora</button>
    </div>
  )
}

// ------------------------------------------------------------ CRM
export function Crm() {
  useDBVersion()
  const clientes = db().all('SELECT id_cliente, nombre, email FROM Cliente ORDER BY nombre')
  const [id, setId] = useState(clientes[0]?.id_cliente)
  const [nota, setNota] = useState('')
  const f = repo.fichaCliente(db(), Number(id))
  if (!f.cliente) return null
  const c = f.cliente
  return (
    <div className="ops__split">
      <div className="auth__form">
        <Field label="Cliente" as="select" value={id} onChange={(e) => setId(e.target.value)}>
          {clientes.map((x) => <option key={x.id_cliente} value={x.id_cliente}>{x.nombre} ({x.email})</option>)}
        </Field>
        <div className="dbx__ficha">
          <p><strong>{c.nombre}</strong>{c.empresa ? `, ${c.empresa}` : ''}</p>
          <p className="muted">{c.tipo_segmento}{c.tipo_b2b ? ` · ${c.tipo_b2b}` : ''} · Plan {c.plan} · {c.pais} · WhatsApp {c.telefono}</p>
          {f.perfil
            ? <p>Perfil de sabor: {f.perfil.notas_preferidas}; {f.perfil.metodo_extraccion}; molienda {f.perfil.tipo_molienda}; intensidad {f.perfil.intensidad}/5</p>
            : <p className="muted">Sin perfil de sabor.</p>}
        </div>
        <form className="auth__form" onSubmit={(e) => { e.preventDefault(); if (nota.trim()) { repo.agregarNota(db(), c.id_cliente, nota.trim(), 'BA1'); setNota('') } }}>
          <Field label="Nueva nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. prefiere leche de avena" />
          <button type="submit" className="btn btn--primary btn--sm">Guardar nota</button>
        </form>
        <ul className="ops__list">
          {f.notas.map((n, i) => <li key={i} className="ops__item ops__item--flat"><span>{n.nota}</span><span className="muted">{n.empleado || 'Sistema'}, {hora(n.creada_en)}</span></li>)}
        </ul>
      </div>
      <div>
        <h3 className="display-s">Historial de pedidos</h3>
        <Tabla columns={['Pedido', 'Canal', 'Estado', 'Total', 'Fecha']} rows={f.pedidos.map((p) => [p.codigo, p.canal, ESTADO[p.estado] || p.estado, money(p), hora(p.fecha)])} />
      </div>
    </div>
  )
}

// ------------------------------------------------------------ Base de datos: explorador, consola SQL y pruebas
const EJEMPLOS = [
  ['Ventas por canal', 'SELECT * FROM v_ventas_por_canal;'],
  ['Pedidos con cliente y comprobante', `SELECT p.codigo, c.nombre, p.canal, p.estado, p.moneda, p.total, cp.serie || '-' || cp.numero AS comprobante
FROM Pedido p LEFT JOIN Cliente c ON c.id_cliente = p.id_cliente
LEFT JOIN Comprobante cp ON cp.id_pedido = p.id_pedido ORDER BY p.fecha DESC;`],
  ['Ruta firmada de un lote', `SELECT * FROM v_ruta_lote WHERE codigo_lote = 'HP-ORI-0925';`],
  ['Clientes por plan', `SELECT pl.nombre AS plan, COUNT(*) AS clientes FROM Membresia m JOIN Plan pl ON pl.id_plan = m.id_plan
WHERE m.estado = 'ACTIVA' GROUP BY pl.nombre;`],
  ['Stock bajo', 'SELECT p.nombre, v.descripcion, v.stock FROM VarianteProducto v JOIN Producto p USING(id_producto) WHERE v.stock < 20;'],
  ['Probar una FK inválida', `INSERT INTO Pedido (codigo, id_cliente, canal, moneda) VALUES ('X-1', 9999, 'WEB', 'PEN');`],
]

function Consola() {
  const [sql, setSql] = useState(EJEMPLOS[0][1])
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  const correr = () => {
    setErr('')
    try {
      const t0 = performance.now()
      const out = db().exec(sql)
      setRes({ out, ms: Math.round(performance.now() - t0), cambios: db().db.getRowsModified() })
    } catch (e) {
      setRes(null)
      setErr(e.message)
    }
  }
  return (
    <div className="dbx__consola">
      <h3 className="display-s">Consola SQL</h3>
      <div className="chips dbx__ejemplos">
        {EJEMPLOS.map(([t, q]) => <button key={t} type="button" className="pill" onClick={() => { setSql(q); setRes(null); setErr('') }}>{t}</button>)}
      </div>
      <label className="sr-only" htmlFor="sql">Consulta SQL</label>
      <textarea id="sql" className="dbx__sql" value={sql} onChange={(e) => setSql(e.target.value)} spellCheck={false} rows={5}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') correr() }} />
      <button type="button" className="btn btn--primary btn--sm" onClick={correr}>Ejecutar (Ctrl + Enter)</button>
      {err && <p className="notice notice--warn dbx__mt" role="alert">Error de SQLite: {err}</p>}
      {res && (
        <div className="dbx__mt">
          <p className="muted">{res.out.length ? `${res.out.at(-1).rows.length} fila(s)` : `${res.cambios} fila(s) modificada(s)`} en {res.ms} ms</p>
          {res.out.map((r, i) => <Tabla key={i} columns={r.columns} rows={r.rows.slice(0, 200)} />)}
        </div>
      )}
    </div>
  )
}

function Pruebas() {
  const [res, setRes] = useState([])
  const [corriendo, setCorriendo] = useState(false)
  const correr = async () => {
    setCorriendo(true)
    setRes([])
    await ejecutarPruebas(nuevaBD, (_, todos) => setRes([...todos]))
    setCorriendo(false)
  }
  const ok = res.filter((r) => r.ok).length
  return (
    <div className="dbx__pruebas">
      <h3 className="display-s">Pruebas automáticas ({PRUEBAS.length})</h3>
      <p className="muted measure">Se ejecutan sobre una copia nueva de la base, así no cambian los datos de la demo. Validan reglas de negocio, flujos QR, comprobantes y la cadena de firmas.</p>
      <button type="button" className="btn btn--primary btn--sm" onClick={correr} disabled={corriendo}>{corriendo ? 'Ejecutando…' : 'Ejecutar pruebas'}</button>
      {res.length > 0 && (
        <>
          <p className={`dbx__score${ok === res.length && !corriendo ? ' is-ok' : ''}`}>{ok} de {res.length} pruebas superadas</p>
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

export function BaseDeDatos() {
  useDBVersion()
  const tablas = db().tablas()
  const [sel, setSel] = useState('Pedido')
  const cols = db().columnas(sel)
  const r0 = db().db.exec(`SELECT * FROM "${sel}" LIMIT 100`)[0]
  const datos = r0 ? { columns: r0.columns, rows: r0.values } : null
  const totalFilas = tablas.reduce((s, t) => s + (t.type === 'table' ? t.filas : 0), 0)
  return (
    <div className="dbx">
      <div className="dbx__head">
        <p className="muted measure">
          Base de datos SQLite real (sql.js / WebAssembly) que corre en el navegador con el modelo entidad-relación del equipo:
          {' '}{tablas.filter((t) => t.type === 'table').length} tablas, {tablas.filter((t) => t.type === 'view').length} vistas y {totalFilas} registros.
          Claves primarias, foráneas, CHECK, UNIQUE, triggers y transacciones activos.
        </p>
        <div className="dbx__acciones">
          <button type="button" className="btn btn--ghost btn--sm" onClick={descargarBD}>Descargar .sqlite</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={descargarEsquema}>Descargar schema.sql</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => { if (window.confirm('¿Restaurar los datos de ejemplo? Se borran los cambios hechos en este navegador.')) reiniciarBD() }}>Restaurar datos de ejemplo</button>
        </div>
      </div>
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
          <ul className="dbx__cols">
            {cols.map((c) => (
              <li key={c.nombre}>
                <code>{c.nombre}</code> <small>{c.tipo || 'ANY'}</small>
                {c.pk && <b className="dbx__k">PK</b>}
                {c.fk && <b className="dbx__k dbx__k--fk">FK → {c.fk}</b>}
                {c.notNull && !c.pk && <small> NOT NULL</small>}
              </li>
            ))}
          </ul>
          {datos ? <Tabla columns={datos.columns} rows={datos.rows} /> : <p className="muted">Tabla vacía.</p>}
        </div>
      </div>
      <div className="ops__split dbx__mt">
        <Consola />
        <Pruebas />
      </div>
    </div>
  )
}
