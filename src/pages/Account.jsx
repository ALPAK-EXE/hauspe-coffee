import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import useTitle from '../useTitle'
import ReminderChat from '../components/ReminderChat'
import { useAuth } from '../context/AuthContext'
import { getOrders } from '../context/CartContext'
import { STATUS } from '../data/ops'
import { fmtPEN, fmtUSD } from '../data/products'
import {
  SUB_PLANS,
  cancelSub,
  changePlan,
  daysUntil,
  fmtDay,
  getSubs,
  isDue,
  pauseSub,
  resumeSub,
  subInfo,
} from '../data/subs'

const STATE = {
  active: { label: 'Activa', cls: 'badge--despachado' },
  paused: { label: 'Pausada', cls: '' },
  cancelled: { label: 'Cancelada', cls: 'badge--cancelled' },
}

function SubCard({ sub, onChange }) {
  const { product, plan, total } = subInfo(sub)
  const [confirming, setConfirming] = useState(false)
  const state = STATE[sub.status]
  const days = daysUntil(sub.nextDelivery)
  const live = sub.status !== 'cancelled'
  const act = (fn) => () => {
    fn()
    setConfirming(false)
    onChange()
  }

  return (
    <li className={`sub${live ? '' : ' is-off'}`}>
      <div className="sub__head">
        <div>
          <h3 className="display-s">{product.name} {product.weight}</h3>
          <p className="muted">{sub.grind}, {sub.qty} {sub.qty === 1 ? 'bolsa' : 'bolsas'} por entrega</p>
        </div>
        <span className={`badge ${state.cls}`}>{state.label}</span>
      </div>

      <dl className="sub__facts">
        <div><dt>Plan</dt><dd>{plan.label} (-{Math.round(plan.discount * 100)}%)</dd></div>
        <div><dt>Próxima entrega</dt><dd>{sub.status === 'active' ? `${fmtDay(sub.nextDelivery)} (${days === 0 ? 'hoy' : `en ${days} d`})` : 'Sin entrega programada'}</dd></div>
        <div><dt>Importe por entrega</dt><dd className="money">{fmtPEN(total)}</dd></div>
      </dl>

      {live && (
        <div className="sub__actions">
          <label className="sub__freq">
            <span>Frecuencia</span>
            <select value={sub.planId} onChange={(e) => { changePlan(sub.id, e.target.value); onChange() }}>
              {SUB_PLANS.map((p) => (
                <option key={p.id} value={p.id}>{p.label} (-{Math.round(p.discount * 100)}%)</option>
              ))}
            </select>
          </label>
          {sub.status === 'active' ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={act(() => pauseSub(sub.id))}>Pausar</button>
          ) : (
            <button type="button" className="btn btn--primary btn--sm" onClick={act(() => resumeSub(sub.id))}>Reanudar</button>
          )}
          {confirming ? (
            <>
              <button type="button" className="btn btn--danger btn--sm" onClick={act(() => cancelSub(sub.id))}>Sí, cancelar</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(false)}>No, mantener</button>
            </>
          ) : (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(true)}>Cancelar suscripción</button>
          )}
        </div>
      )}

      {sub.status === 'active' &&
        (isDue(sub) || (sub.chat || []).length ? (
          <ReminderChat sub={sub} onChange={onChange} />
        ) : (
          <details className="sub__preview">
            <summary>Ver el recordatorio de WhatsApp</summary>
            <ReminderChat sub={sub} onChange={onChange} />
          </details>
        ))}
    </li>
  )
}

export default function Account() {
  useTitle('Mi cuenta')
  const { user } = useAuth()
  const [, setTick] = useState(0)
  const refresh = () => setTick((n) => n + 1)

  if (!user) return <Navigate to="/login" state={{ from: '/mi-cuenta' }} replace />

  const subs = getSubs(user.email)
  const orders = getOrders().filter((o) => o.customer.email === user.email)
  const dueSubs = subs.filter((s) => isDue(s))
  const isRetail = user.segment === 'b2c' || user.businessType === 'HORECA'
  const statusLabel = (id) => STATUS.find((s) => s.id === id)?.label

  return (
    <div className="container page">
      <header className="page__head">
        <h1 className="display-l">Mi cuenta</h1>
        <p className="lead measure">
          {user.name}, {user.segment === 'b2c' ? 'suscriptor' : user.businessType}. {user.email}
        </p>
      </header>

      {dueSubs.length > 0 && (
        <p className="notice notice--warn" role="status">
          Tu café se acaba pronto: {dueSubs.length === 1 ? 'tienes una entrega por confirmar.' : `tienes ${dueSubs.length} entregas por confirmar.`}
        </p>
      )}

      {isRetail && (
        <section className="acct__sec" aria-label="Suscripciones">
          <h2 className="display-m">Suscripciones</h2>
          {subs.length ? (
            <ul className="subs">
              {subs.map((s) => <SubCard key={s.id} sub={s} onChange={refresh} />)}
            </ul>
          ) : (
            <div className="empty">
              <p className="muted">Todavía no tienes suscripciones. Elige una frecuencia al agregar un café y recibe hasta 15% de descuento.</p>
              <Link to="/catalogo" className="btn btn--primary">Ver cafés</Link>
            </div>
          )}
        </section>
      )}

      <section className="acct__sec" aria-label="Historial de pedidos">
        <h2 className="display-m">Historial de pedidos</h2>
        {orders.length ? (
          <ul className="ops__list">
            {orders.map((o) => (
              <li key={o.id} className="ops__item">
                <div>
                  <strong>Pedido {o.id}</strong>
                  <span className="muted">
                    {new Date(o.date).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {o.doc ? `, ${o.doc.number}` : o.quote ? `, ${o.quote.number}` : ''}
                  </span>
                  <span className="muted">{o.lines.map((l) => `${l.qty} x ${l.name}`).join('; ')}</span>
                </div>
                <div className="ops__act">
                  <strong className="money">{o.doc ? fmtPEN(o.totalPen) : fmtUSD(o.totalUsd)}</strong>
                  {o.doc && <span className={`badge badge--${o.status || 'nuevo'}`}>{statusLabel(o.status || 'nuevo')}</span>}
                  <Link to={`/pedido/${o.id}`} className="text-link">Ver comprobante</Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Aún no hay pedidos. Cuando compres, aparecerán aquí.</p>
        )}
      </section>
    </div>
  )
}
