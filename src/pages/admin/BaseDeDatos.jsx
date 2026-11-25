// Base de datos: explorador de tablas, consola SQL de solo lectura, pruebas automáticas y modelo Prisma
import { useState } from 'react'
import { CheckCircle, DownloadSimple, Play, WarningCircle, XCircle } from '@phosphor-icons/react'
import { Aviso, Btn, Card, Empty, Skeleton } from '../../components/admin/ui'
import { api, comprobarSalud, correrPruebas, refrescar, useDatos, useModo } from '../../db/data'
import { PRUEBAS } from '../../db/tests'
import useTitle from '../../useTitle'
import schemaPrisma from '../../../prisma/schema.prisma?raw'
import extrasSQL from '../../../prisma/sql/extras.sql?raw'

// Tabla con columnas y filas en arreglos (resultado crudo de la base). El scroll es interno, nunca de la página.
function TablaCruda({ columns, rows }) {
  return (
    <div className="a-tablewrap">
      <table className="a-table a-table--raw">
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((v, j) => <td key={j} className={typeof v === 'number' ? 'num' : undefined}>{v === null || v === undefined ? <span className="a-null">NULL</span> : String(v)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

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
    <div className="a-stack">
      {modo === 'remoto' && <p className="a-note">Solo lectura: SELECT, SHOW, DESCRIBE y EXPLAIN, con un máximo de {res?.limite ?? 200} filas. Cualquier otra sentencia se rechaza en el servidor.</p>}
      <div className="a-examples">
        {ejemplos.map(([t, q]) => <button key={t} type="button" className="a-chip" onClick={() => { setSql(q); setRes(null); setErr('') }}>{t}</button>)}
      </div>
      <label className="sr-only" htmlFor="sql">Consulta SQL</label>
      <textarea id="sql" className="a-editor" value={sql} onChange={(e) => setSql(e.target.value)} spellCheck={false} rows={6}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') correr() }} />
      <div className="a-toolbar">
        <Btn onClick={correr} disabled={busy}><Play size={16} weight="fill" aria-hidden="true" />{busy ? 'Ejecutando...' : 'Ejecutar (Ctrl + Enter)'}</Btn>
        {res && (
          <span className="muted" role="status">
            {res.out.length ? `${res.out.at(-1).rows.length} fila(s)${res.truncado ? ` (se muestran las primeras ${res.limite})` : ''}` : `${res.cambios ?? 0} fila(s) modificada(s)`} en {res.ms} ms
          </span>
        )}
      </div>
      <Aviso error={err && `Error de ${motor}: ${err}`} />
      {res?.out.map((r, i) => <Card key={i} flush><TablaCruda columns={r.columns} rows={r.rows.slice(0, 200)} /></Card>)}
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
  const fallas = res.length - ok
  return (
    <div className="a-stack">
      <p className="a-note">
        {modo === 'remoto'
          ? 'Corren en el servidor contra MySQL dentro de una transacción de Prisma que termina con un error controlado: se hace ROLLBACK de todo y los datos de la demo no cambian. Tardan unos 30 a 90 segundos por la latencia de la red.'
          : 'Se ejecutan sobre una copia nueva de la base, así no cambian los datos de la demo. Validan reglas de negocio, flujos QR, comprobantes y la cadena de firmas.'}
      </p>
      <div className="a-toolbar">
        <Btn onClick={correr} disabled={corriendo}><Play size={16} weight="fill" aria-hidden="true" />{corriendo ? 'Ejecutando en el servidor...' : `Ejecutar pruebas (${PRUEBAS.length})`}</Btn>
      </div>
      <Aviso error={error} />
      {(res.length > 0 || corriendo) && (
        <Card>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>{ok} de {res.length} pruebas superadas{info?.rollback ? ' · ROLLBACK aplicado, datos intactos' : ''}</p>
          <div className={`a-progress${fallas ? ' a-progress--bad' : ''}`} role="progressbar" aria-label="Avance de las pruebas" aria-valuemin={0} aria-valuemax={PRUEBAS.length} aria-valuenow={res.length}>
            <i style={{ width: `${Math.min(100, (res.length / PRUEBAS.length) * 100)}%` }} />
          </div>
          <ul className="a-tests" style={{ marginTop: 12 }}>
            {res.map((r, i) => (
              <li key={i} className={r.ok ? 'is-ok' : 'is-fail'}>
                {r.ok ? <CheckCircle size={18} weight="fill" aria-label="Superada" /> : <XCircle size={18} weight="fill" aria-label="Falló" />}
                <div><strong>{r.modulo}:</strong> {r.nombre}<small>{r.detalle} · {r.ms} ms</small></div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

// Modelo Prisma: lo lee el servidor del cliente generado (DMMF) y lo muestra con sus relaciones
function ModeloPrisma() {
  const r = useDatos(() => api.modelo())
  if (!r.data) return r.error ? <Aviso error={`No se pudo leer el modelo: ${r.error}`} /> : <Skeleton n={3} />
  const { modelos, prisma } = r.data
  const relaciones = modelos.reduce((s, m) => s + m.campos.filter((c) => c.relacion && !c.relacion.lista && c.relacion.campos.length).length, 0)
  return (
    <div className="a-stack">
      <p className="a-note">
        Prisma {prisma} describe la base en <code>prisma/schema.prisma</code>: cada <code>model</code> es una tabla de MySQL, cada campo una columna,
        <code> @id</code> la clave primaria, <code>@unique</code> un índice único y <code>@relation</code> una clave foránea con su <code>onDelete</code>.
        Hay {modelos.length} modelos y {relaciones} relaciones. Lo que Prisma no expresa (CHECK, triggers y vistas) vive en <code>prisma/sql/extras.sql</code>.
      </p>
      <div className="a-models">
        {modelos.map((m) => (
          <details key={m.nombre}>
            <summary><strong>{m.nombre}</strong> <small className="muted">{m.campos.filter((c) => !c.relacion).length} campos · {m.campos.filter((c) => c.relacion).length} relaciones</small></summary>
            <ul>
              {m.campos.map((c) => (
                <li key={c.nombre}>
                  <code>{c.nombre}</code> <small className="muted">{c.tipo}</small>
                  {c.pk && <b className="a-key"> @id</b>}
                  {c.unico && !c.pk && <b className="a-key"> @unique</b>}
                  {c.relacion && (
                    <b className="a-key a-key--fk">
                      {c.relacion.lista ? `1:N a ${c.relacion.modelo}` : c.relacion.campos.length ? `FK ${c.relacion.campos.join(', ')} a ${c.relacion.modelo}${c.relacion.onDelete ? ` (onDelete: ${c.relacion.onDelete})` : ''}` : `1:1 a ${c.relacion.modelo}`}
                    </b>
                  )}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  )
}

function descargar(nombre, texto) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([texto], { type: 'text/plain' }))
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function Explorador({ tablas, cargando, error }) {
  const [sel, setSel] = useState('Pedido')
  const rd = useDatos(async () => ({ cols: await api.columnas(sel), datos: await api.filas(sel) }), [sel])
  const detalle = rd.data
  return (
    <div className="a-explorer">
      <Card flush titulo={`Tablas (${tablas.length})`}>
        <nav className="a-tables" aria-label="Tablas">
          {cargando && <Skeleton n={8} />}
          {tablas.map((t) => (
            <button key={t.name} type="button" aria-pressed={sel === t.name} onClick={() => setSel(t.name)}>
              <span>{t.name}{t.type === 'view' ? ' (vista)' : ''}</span><small>{t.filas}</small>
            </button>
          ))}
        </nav>
        <Aviso error={error} />
      </Card>
      <div className="a-stack">
        <Card titulo={sel}>
          <Aviso error={rd.error} />
          {!detalle && !rd.error && <Skeleton n={2} />}
          {detalle && (
            <div className="a-cols">
              {detalle.cols.map((c) => (
                <span key={c.nombre} className="a-col-chip">
                  <code>{c.nombre}</code> <small>{c.tipo || 'ANY'}</small>
                  {c.pk && <b className="a-key">PK</b>}
                  {c.fk && <b className="a-key a-key--fk">FK a {c.fk}</b>}
                  {c.notNull && !c.pk && <small>NOT NULL</small>}
                </span>
              ))}
            </div>
          )}
        </Card>
        {detalle && (
          <Card flush>
            {detalle.datos.rows.length ? <TablaCruda columns={detalle.datos.columns} rows={detalle.datos.rows} /> : <Empty chico Icon={WarningCircle} titulo="Tabla vacía">Esta tabla todavía no tiene registros.</Empty>}
          </Card>
        )}
      </div>
    </div>
  )
}

export default function BaseDeDatos() {
  useTitle('Base de datos')
  const { modo, health } = useModo()
  const remoto = modo === 'remoto'
  const rt = useDatos(() => api.tablas())
  const [vista, setVista] = useState('explorador')
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
    const b = await import('../../db/browser')
    if (que === 'bd') b.descargarBD()
    else if (que === 'esquema') b.descargarEsquema()
    else if (window.confirm('¿Restaurar los datos de ejemplo? Se borran los cambios hechos en este navegador.')) b.reiniciarBD()
  }

  const tablas = rt.data ?? []
  const totalFilas = tablas.reduce((s, t) => s + (t.type === 'table' ? t.filas : 0), 0)
  const version = (health?.version || '').split('.').slice(0, 2).join('.') || '8.0'
  const VISTAS = [['explorador', 'Explorador'], ['consola', 'Consola SQL'], ['pruebas', 'Pruebas'], ...(remoto ? [['modelo', 'Modelo Prisma']] : [])]

  return (
    <>
      {remoto ? (
        <div className="a-strip a-strip--ok" role="status">
          <CheckCircle size={20} weight="fill" aria-hidden="true" />
          <div>
            <strong>Conectado a MySQL {version} mediante Prisma ORM</strong>
            <span>
              {health.orm} {health.prisma}, respuesta en {health.ms} ms.{' '}
              {health.triggers ? 'Triggers de MySQL activos.' : 'Reglas de negocio aplicadas desde la API (triggers pendientes en el servidor).'}
            </span>
            {errSalud && <span role="alert">{errSalud}</span>}
          </div>
          <Btn variante="secondary" size="sm" onClick={comprobar} disabled={probando}>{probando ? 'Comprobando...' : 'Comprobar conexión'}</Btn>
        </div>
      ) : (
        <div className="a-strip a-strip--warn" role="status">
          <WarningCircle size={20} weight="fill" aria-hidden="true" />
          <div>
            <strong>Modo sin conexión (base local)</strong>
            <span>No hay respuesta de /api/health: la app funciona con la base SQLite que corre en este navegador. Recarga la página para volver a intentar la conexión con MySQL.</span>
          </div>
        </div>
      )}

      <div className="a-toolbar">
        <div className="a-seg" role="tablist" aria-label="Herramientas de la base de datos">
          {VISTAS.map(([id, t]) => (
            <button key={id} type="button" role="tab" id={`bd-tab-${id}`} aria-selected={vista === id} aria-controls="bd-panel" onClick={() => setVista(id)}>{t}</button>
          ))}
        </div>
        <span className="muted grow">
          {tablas.filter((t) => t.type === 'table').length} tablas, {tablas.filter((t) => t.type === 'view').length} vistas y {totalFilas} registros
        </span>
        {remoto ? (
          <>
            <Btn variante="secondary" size="sm" onClick={() => descargar('schema.prisma', schemaPrisma)}><DownloadSimple size={16} aria-hidden="true" /> schema.prisma</Btn>
            <Btn variante="secondary" size="sm" onClick={() => descargar('extras.sql', extrasSQL)}><DownloadSimple size={16} aria-hidden="true" /> extras.sql</Btn>
            <Btn variante="ghost" size="sm" onClick={refrescar}>Actualizar datos</Btn>
          </>
        ) : (
          <>
            <Btn variante="secondary" size="sm" onClick={() => acciones('bd')}><DownloadSimple size={16} aria-hidden="true" /> .sqlite</Btn>
            <Btn variante="secondary" size="sm" onClick={() => acciones('esquema')}><DownloadSimple size={16} aria-hidden="true" /> schema.sql</Btn>
            <Btn variante="ghost" size="sm" onClick={() => acciones('reiniciar')}>Restaurar datos de ejemplo</Btn>
          </>
        )}
      </div>

      <div id="bd-panel" role="tabpanel" aria-labelledby={`bd-tab-${vista}`} className="a-stack">
        {vista === 'explorador' && <Explorador tablas={tablas} cargando={!rt.data && !rt.error} error={rt.error} />}
        {vista === 'consola' && <Consola key={modo} modo={modo} />}
        {vista === 'pruebas' && <Pruebas modo={modo} />}
        {vista === 'modelo' && remoto && <ModeloPrisma />}
      </div>
    </>
  )
}
