import { Link, useParams } from 'react-router-dom'
import { CheckCircle, Printer } from '@phosphor-icons/react'
import useTitle from '../useTitle'
import { useAuth } from '../context/AuthContext'
import { getOrder } from '../context/CartContext'
import { STATUS } from '../data/ops'
import { fmtPEN, fmtUSD, IGV_RATE, round2 } from '../data/products'

// Datos ficticios del emisor (prototipo académico)
const ISSUER = {
  name: 'HausPe Coffee S.A.C.',
  ruc: '20601234567',
  address: 'Av. Ejemplo 123, Lima, Perú',
}

export default function Order() {
  const { id } = useParams()
  const { user } = useAuth()
  const order = getOrder(id)
  const mine = order && user && order.customer.email === user.email
  useTitle(mine ? `Pedido ${order.id}` : 'Pedido no encontrado')

  if (!mine) {
    return (
      <div className="container page empty">
        <h1 className="display-l">No encontramos ese pedido</h1>
        <p className="muted">Los pedidos solo se pueden ver desde la cuenta que los hizo.</p>
        <Link to={user ? '/catalogo' : '/login'} state={user ? undefined : { from: `/pedido/${id}` }} className="btn btn--primary">
          {user ? 'Ver cafés' : 'Ingresar'}
        </Link>
      </div>
    )
  }

  const pen = order.lines.filter((l) => l.currency === 'PEN')
  const usd = order.lines.filter((l) => l.currency === 'USD')
  const date = new Date(order.date).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })
  // Pedidos anteriores sin base/IGV guardados: se calculan igual
  const base = order.basePen ?? round2(order.totalPen / (1 + IGV_RATE))
  const igv = order.igvPen ?? round2(order.totalPen - base)
  const customerDoc = order.doc?.customerDoc

  return (
    <div className="container page">
      <header className="page__head">
        <p className="ok"><CheckCircle size={22} weight="fill" /> {order.doc ? 'Pago recibido' : 'Cotización solicitada'}</p>
        <h1 className="display-l">Gracias, {order.customer.name.split(' ')[0]}</h1>
        <p className="lead measure">Pedido {order.id}. Te escribiremos por WhatsApp para coordinar la entrega.</p>
      </header>

      <div className="docs">
        {order.doc && (
          <article className="doc" aria-label={order.doc.type}>
            <header>
              <div>
                <strong>{ISSUER.name}</strong>
                <span>RUC {ISSUER.ruc} (ejemplo)</span>
                <span>{ISSUER.address}</span>
              </div>
              <div className="doc__num">
                <strong>{order.doc.type}</strong>
                <span>{order.doc.number}</span>
              </div>
            </header>
            <p className="doc__meta">
              <span>Fecha de emisión: {date}</span>
              <span>Cliente: {order.customer.company || order.customer.name}</span>
              {customerDoc && <span>{customerDoc.label}: {customerDoc.value}</span>}
              <span>Código de operación Yape: {order.opCode}</span>
            </p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Descripción</th><th>Cant.</th><th>P. unit.</th><th>Importe</th></tr></thead>
                <tbody>
                  {pen.map((l, i) => (
                    <tr key={`${l.name}-${i}`}>
                      <td>{l.name}<small>{l.detail}</small></td>
                      <td>{l.qty}</td>
                      <td className="money">{fmtPEN(l.unit)}</td>
                      <td className="money">{fmtPEN(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="doc__totals">
              <div><dt>Op. gravada (base imponible)</dt><dd className="money">{fmtPEN(base)}</dd></div>
              <div><dt>IGV 18%</dt><dd className="money">{fmtPEN(igv)}</dd></div>
              <div className="doc__grand"><dt>Total</dt><dd className="money">{fmtPEN(order.totalPen)}</dd></div>
            </dl>
            <p className="doc__foot">Representación impresa simulada. No tiene validez tributaria.</p>
          </article>
        )}

        {order.quote && (
          <article className="doc" aria-label="Cotización de exportación">
            <header>
              <div>
                <strong>{ISSUER.name}</strong>
                <span>RUC {ISSUER.ruc} (ejemplo)</span>
                <span>Exportación de café verde</span>
              </div>
              <div className="doc__num">
                <strong>Cotización</strong>
                <span>{order.quote.number}</span>
              </div>
            </header>
            <p className="doc__meta">
              <span>Fecha: {date}</span>
              <span>Cliente: {order.customer.company || order.customer.name}</span>
              {order.customer.taxId && <span>Tax ID: {order.customer.taxId}</span>}
              {order.customer.country && <span>País: {order.customer.country}</span>}
              <span>Validez: 15 días</span>
            </p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Lote</th><th>Sacos</th><th>Importe</th></tr></thead>
                <tbody>
                  {usd.map((l, i) => (
                    <tr key={`${l.name}-${i}`}>
                      <td>{l.name}<small>{l.detail}</small></td>
                      <td>{l.qty}</td>
                      <td className="money">{fmtUSD(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="doc__totals">
              <div className="doc__grand"><dt>Total estimado</dt><dd className="money">{fmtUSD(order.totalUsd)}</dd></div>
            </dl>
            <p className="doc__foot">
              Exportación de bienes: operación no gravada con IGV (0%). Documento de ejemplo; el precio final se
              confirma con el contrato.
            </p>
          </article>
        )}
      </div>

      {order.doc && (
        <section className="tracking" aria-label="Seguimiento del pedido">
          <h2 className="display-m">Seguimiento</h2>
          <ol className="steps">
            {STATUS.map((s, i) => {
              const cur = STATUS.findIndex((x) => x.id === (order.status || 'nuevo'))
              return (
                <li key={s.id} className={i <= cur ? 'is-done' : ''} aria-current={i === cur ? 'step' : undefined}>
                  {s.label}
                </li>
              )
            })}
          </ol>
          <h3 className="display-s">Alertas por WhatsApp</h3>
          <p className="muted">Mensajes simulados para {order.customer.whatsapp || 'tu número registrado'}.</p>
          <ul className="alerts">
            {(order.alerts || []).map((a, i) => (
              <li key={i}>
                <span className="muted">{new Date(a.at).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</span>
                {a.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="actions">
        <button type="button" className="btn btn--ghost" onClick={() => window.print()}>
          <Printer size={18} /> Imprimir
        </button>
        <Link to="/catalogo" className="btn btn--primary">Seguir comprando</Link>
      </div>
    </div>
  )
}
