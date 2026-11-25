// Resumen del panel (solo administrador): indicadores leídos de la API, requiere atención y accesos directos
import { Link } from 'react-router-dom'
import { Check, Drop, ForkKnife, Receipt, Truck, Warning } from '@phosphor-icons/react'
import { Aviso, Btn, Card, Estado, Skeleton } from '../../components/admin/ui'
import { fmtPEN } from '../../data/products'
import { api, useDatos } from '../../db/data'
import useTitle from '../../useTitle'
import { SECCIONES, hoyLima, rutaDe } from './util'

function Kpi({ Icon, titulo, valor, sub, alerta, to }) {
  return (
    <Link to={to} className={`a-kpi${alerta ? ' a-kpi--alert' : ''}`}>
      <span className="a-kpi__top">{titulo}<Icon size={20} aria-hidden="true" /></span>
      <span className="a-kpi__val">{valor}</span>
      <span className="a-kpi__sub">{sub}</span>
    </Link>
  )
}

export default function Resumen() {
  useTitle('Resumen')
  const r = useDatos(async () => {
    const [pedidos, cola, insumos, lotes] = await Promise.all([api.listarPedidos(), api.colaDarkStore(), api.listarInsumos(), api.dashboardLotes()])
    // Cadena de cada lote: una verificación por lote, en paralelo
    const cadenas = await Promise.all(lotes.map((l) => api.verificarCadena(l.codigo_lote).then((v) => ({ lote: l.codigo_lote, ...v })).catch(() => ({ lote: l.codigo_lote, ok: false, error: true }))))
    return { pedidos, cola, insumos, lotes, cadenas }
  })
  if (!r.data) return r.error ? <Estado r={r} que="el resumen" /> : <><Skeleton tipo="tarjetas" n={4} /><Skeleton n={5} /></>

  const { pedidos, cola, insumos, lotes, cadenas } = r.data
  const porPreparar = pedidos.filter((p) => ['PAGADO', 'EN_PREPARACION'].includes(p.estado)).length
  const enReparto = cola.filter((c) => c.estado === 'DESPACHADO')
  const proximo = [...enReparto].sort((a, b) => a.restanteMin - b.restanteMin)[0]
  const alertasHumedad = lotes.filter((l) => l.alerta)
  const hoy = hoyLima()
  const ventasHoy = pedidos
    .filter((p) => p.moneda === 'PEN' && !['COTIZADO', 'CANCELADO'].includes(p.estado) && String(p.fecha).slice(0, 10) === hoy)
    .reduce((s, p) => s + Number(p.total), 0)
  const nVentas = pedidos.filter((p) => p.moneda === 'PEN' && !['COTIZADO', 'CANCELADO'].includes(p.estado) && String(p.fecha).slice(0, 10) === hoy).length

  const atrasados = cola.filter((c) => c.atrasado)
  const bajos = insumos.filter((i) => i.bajo)
  const rotas = cadenas.filter((c) => !c.ok)
  const atencion = [
    ...atrasados.map((c) => ({ id: `p-${c.codigo}`, t: `Pedido ${c.codigo} atrasado`, d: `Pasó el plazo de 24 h${c.distrito ? `, entrega en ${c.distrito}` : ''}.`, to: '/admin/dark-store', ir: 'Ver reparto' })),
    ...bajos.map((i) => ({ id: `i-${i.nombre}`, t: `${i.nombre} bajo el mínimo`, d: `Quedan ${Math.round(i.stock).toLocaleString('es-PE')} ${i.unidad}, el mínimo es ${Math.round(i.stock_minimo).toLocaleString('es-PE')} ${i.unidad}.`, to: '/admin/barista', ir: 'Ver almacén' })),
    ...rotas.map((c) => ({ id: `c-${c.lote}`, t: `Cadena sin verificar en ${c.lote}`, d: c.error ? 'No se pudo comprobar la cadena de este lote.' : `La firma falla en el bloque ${c.rotoEn ?? '?'}.`, to: '/admin/trazabilidad', ir: 'Verificar' })),
  ]
  const accesos = SECCIONES.filter((s) => ['barista', 'dark', 'trazabilidad', 'crm', 'bd'].includes(s.id))

  return (
    <>
      <Aviso error={r.error} />
      <div className="a-kpis">
        <Kpi Icon={ForkKnife} titulo="Pedidos por preparar" valor={porPreparar} sub={porPreparar ? 'Nuevos y en preparación' : 'Todo al día'} to="/admin/barista" />
        <Kpi
          Icon={Truck}
          titulo="Pedidos en reparto"
          valor={enReparto.length}
          alerta={proximo?.atrasado}
          sub={proximo ? (proximo.atrasado ? `Uno ya pasó las 24 h (${proximo.codigo})` : `Vence primero ${proximo.codigo}: ${Math.floor(proximo.restanteMin / 60)} h ${proximo.restanteMin % 60} min`) : 'Ninguno despachado'}
          to="/admin/dark-store"
        />
        <Kpi Icon={Drop} titulo="Alertas de humedad" valor={alertasHumedad.length} alerta={alertasHumedad.length > 0} sub={alertasHumedad.length ? alertasHumedad.map((l) => l.codigo_lote).join(', ') : 'Lotes dentro de rango'} to="/admin/lotes-iot" />
        <Kpi Icon={Receipt} titulo="Ventas del día" valor={fmtPEN(ventasHoy)} sub={`${nVentas} ${nVentas === 1 ? 'venta' : 'ventas'} en soles`} to="/admin/base-de-datos" />
      </div>

      <div className="a-grid a-grid--side-r">
        <Card flush titulo="Requiere atención" accion={<span className="muted">{atencion.length ? `${atencion.length} por revisar` : 'Sin pendientes'}</span>}>
          {atencion.length ? (
            <ul className="a-att">
              {atencion.map((a) => (
                <li key={a.id}>
                  <span className="a-att__ico"><Warning size={16} weight="fill" aria-hidden="true" /></span>
                  <div><strong>{a.t}</strong><span className="muted">{a.d}</span></div>
                  <Link className="a-btn a-btn--secondary a-btn--sm" to={a.to}>{a.ir}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="a-att">
              <li>
                <span className="a-att__ico a-att__ico--ok"><Check size={16} weight="bold" aria-hidden="true" /></span>
                <div><strong>Todo en orden</strong><span className="muted">No hay pedidos atrasados, insumos bajo el mínimo ni cadenas alteradas.</span></div>
                <span />
              </li>
            </ul>
          )}
        </Card>
        <Card titulo="Accesos directos">
          <div className="a-shortcuts">
            {accesos.map(({ id, label, Icon, ...s }) => (
              <Link key={id} to={rutaDe(s)} className="a-shortcut"><Icon size={20} aria-hidden="true" />{label}</Link>
            ))}
          </div>
          <div style={{ marginTop: 12 }}><Btn variante="ghost" size="sm" onClick={r.recargar}>Actualizar resumen</Btn></div>
        </Card>
      </div>
    </>
  )
}
