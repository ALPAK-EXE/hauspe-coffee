// Piezas visuales compartidas del panel: botones, insignias, tablas, estados vacíos, carga y error.
import { WarningCircle } from '@phosphor-icons/react'
import { CLASE_ESTADO, ESTADO } from '../../pages/admin/util'

export function Btn({ variante = 'primary', size, block, className = '', type = 'button', children, ...props }) {
  const cls = ['a-btn', `a-btn--${variante}`, size === 'sm' && 'a-btn--sm', block && 'a-btn--block', className].filter(Boolean).join(' ')
  return <button type={type} className={cls} {...props}>{children}</button>
}

export const Badge = ({ tono = 'neutro', children }) => <span className={`a-badge a-badge--${tono}`}>{children}</span>
export const EstadoBadge = ({ estado }) => <Badge tono={CLASE_ESTADO[estado] || 'neutro'}>{ESTADO[estado] || estado}</Badge>

export function Card({ titulo, accion, flush, children, className = '', as: Tag = 'section', ...props }) {
  return (
    <Tag className={`a-card${flush ? ' a-card--flush' : ''} ${className}`} {...props}>
      {(titulo || accion) && (
        <div className="a-card__head">
          {titulo && <h2 className="a-h a-h--s">{titulo}</h2>}
          {accion}
        </div>
      )}
      {children}
    </Tag>
  )
}

export function Empty({ Icon, titulo, children, chico }) {
  return (
    <div className={`a-empty${chico ? ' a-empty--sm' : ''}`}>
      {Icon && <Icon size={chico ? 24 : 32} aria-hidden="true" />}
      <strong>{titulo}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}

/** Esqueletos con la forma del contenido final (tarjetas o filas). */
export function Skeleton({ tipo = 'filas', n = 4 }) {
  return (
    <div role="status" aria-label="Cargando" aria-busy="true">
      {tipo === 'tarjetas'
        ? <div className="a-kpis">{Array.from({ length: n }, (_, i) => <div key={i} className="a-skel a-skel--card" />)}</div>
        : Array.from({ length: n }, (_, i) => <div key={i} className="a-skel a-skel--row" />)}
    </div>
  )
}

export function Aviso({ error, tono = 'bad' }) {
  if (!error) return null
  return (
    <div className={`a-strip a-strip--${tono}`} role="alert">
      <WarningCircle size={18} weight="fill" aria-hidden="true" />
      <div>{error}</div>
    </div>
  )
}

/** Estado de una consulta: devuelve esqueleto o error mientras no haya datos que mostrar. */
export function Estado({ r, que = 'los datos', tipo = 'filas', n }) {
  if (r.error && !r.data) return <Aviso error={`No se pudo leer ${que}: ${r.error}. Revisa la conexión y vuelve a abrir la sección.`} />
  if (!r.data) return <Skeleton tipo={tipo} n={n} />
  return null
}

/**
 * Tabla compacta. columns: [{ k, t, num?, act?, full? }] y rows: arreglo de objetos con celdas (texto o nodos).
 * En móvil cada fila se apila como tarjeta (sin scroll horizontal).
 */
export function Tabla({ columns, rows, vacio, raw }) {
  if (!rows.length) return vacio ?? null
  return (
    <div className="a-tablewrap">
      <table className={`a-table a-table--stack${raw ? ' a-table--raw' : ''}`}>
        <thead>
          <tr>{columns.map((c) => <th key={c.k} className={c.num ? 'num' : undefined}>{c.t}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key ?? i}>
              {columns.map((c) => (
                <td key={c.k} data-label={c.t} className={[c.num && 'num', c.act && 'a-act', c.full && 'full'].filter(Boolean).join(' ') || undefined}>
                  {r[c.k]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Sparkline de humedad con la franja del rango recomendado. */
export function Spark({ data, rango = [10, 12], alerta, label }) {
  if (!data || data.length < 2) return <span className="muted">Sin serie</span>
  const W = 96, H = 28, pad = 3
  const lo = Math.min(...data, rango[0]) - 0.3
  const hi = Math.max(...data, rango[1]) + 0.3
  const x = (i) => pad + (i * (W - 2 * pad)) / (data.length - 1)
  const y = (v) => H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad)
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const ult = data.length - 1
  return (
    <svg className={`a-spark${alerta ? ' a-spark--alert' : ''}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label || `Humedad: de ${data[0]} a ${data[ult]} %`}>
      <rect className="band" x="0" y={y(rango[1])} width={W} height={Math.max(1, y(rango[0]) - y(rango[1]))} rx="2" />
      <polyline points={pts} />
      <circle cx={x(ult)} cy={y(data[ult])} r="2.6" />
    </svg>
  )
}
