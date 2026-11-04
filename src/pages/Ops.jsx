import { useState } from 'react'
import useTitle from '../useTitle'
import Field from '../components/Field'
import QrImage from '../components/QrImage'
import ReminderChat from '../components/ReminderChat'
import { passportUrl } from '../config'
import { getOrders, updateOrder } from '../context/CartContext'
import { sealChange } from '../data/chain'
import { STATUS, addHarvest, addRoast, getHarvests, getRoasts, makeAlert, nextStatus } from '../data/ops'
import { passports } from '../data/passports'
import { fmtPEN } from '../data/products'
import { REMINDER_DAYS, daysUntil, fmtDay, getAllSubs, isDue, pushChat, reminderText, subInfo, updateSub } from '../data/subs'
import { HUMIDITY_RANGE, addReadings, getReadings, outOfRange, simulateReadings } from '../data/telemetry'

const TABS = [
  { id: 'barista', label: 'Barista' },
  { id: 'dark', label: 'Dark store' },
  { id: 'cosecha', label: 'Cosecha' },
  { id: 'tueste', label: 'Tueste' },
  { id: 'telemetria', label: 'Telemetría' },
  { id: 'recordatorios', label: 'Recordatorios' },
  { id: 'qr', label: 'QR por empaque' },
]
const today = () => new Date().toISOString().slice(0, 10)
const statusLabel = (id) => STATUS.find((s) => s.id === id)?.label || id
const retailOrders = () => getOrders().filter((o) => o.doc)
const fmtDate = (iso) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
const batchOptions = passports.map((p) => (
  <option key={p.code} value={p.code}>{p.code}</option>
))

// Cola de pedidos: el barista prepara (nuevo, preparando, listo) y la dark store despacha
function Queue({ mode }) {
  const [, refresh] = useState(0)
  const [courier, setCourier] = useState('Moto propia')
  const orders = retailOrders().filter((o) => {
    const s = o.status || 'nuevo'
    return mode === 'barista' ? s === 'nuevo' || s === 'preparando' : s === 'listo' || s === 'despachado'
  })

  const advance = (o) => {
    const status = nextStatus(o.status || 'nuevo')
    updateOrder(o.id, (cur) => ({
      status,
      alerts: [...(cur.alerts || []), makeAlert(status, cur.id, status === 'despachado' ? courier : undefined)],
    }))
    refresh((n) => n + 1)
  }

  if (!orders.length) {
    return <p className="muted">{mode === 'barista' ? 'No hay pedidos por preparar. Haz una compra de prueba en la tienda.' : 'No hay pedidos listos para despachar.'}</p>
  }
  return (
    <ul className="ops__list">
      {orders.map((o) => {
        const s = o.status || 'nuevo'
        const last = s === 'despachado'
        return (
          <li key={o.id} className="ops__item">
            <div>
              <strong>Pedido {o.id}</strong>
              <span className="muted">{fmtDate(o.date)}, {o.customer.name}, {fmtPEN(o.totalPen)}</span>
              <ul className="ops__lines">
                {o.lines.filter((l) => l.currency === 'PEN').map((l, i) => (
                  <li key={`${l.name}-${i}`}>{l.qty} x {l.name}, {l.detail}</li>
                ))}
              </ul>
            </div>
            <div className="ops__act">
              <span className={`badge badge--${s}`}>{statusLabel(s)}</span>
              {!last && (
                <button type="button" className="btn btn--primary btn--sm" onClick={() => advance(o)}>
                  {mode === 'barista' ? (s === 'nuevo' ? 'Empezar a preparar' : 'Marcar listo') : 'Despachar'}
                </button>
              )}
              {mode === 'dark' && s === 'listo' && (
                <label className="ops__courier">
                  <span>Reparto</span>
                  <select value={courier} onChange={(e) => setCourier(e.target.value)}>
                    <option>Moto propia</option>
                    <option>Courier aliado</option>
                    <option>Recojo en tienda</option>
                  </select>
                </label>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// Registro de cosecha o de tueste: se asocia a un lote, se muestra en su pasaporte y se sella en un bloque nuevo
function RegisterForm({ kind }) {
  const isHarvest = kind === 'cosecha'
  const empty = isHarvest
    ? { batch: passports[0].code, date: today(), kg: '', humidity: '' }
    : { batch: passports[0].code, date: today(), profile: 'Medio', temp: '', minutes: '' }
  const [v, setV] = useState(empty)
  const [errors, setErrors] = useState({})
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [, refresh] = useState(0)
  const rows = isHarvest ? getHarvests() : getRoasts()
  const set = (k) => (e) => {
    setV((x) => ({ ...x, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
    setOk('')
  }
  const num = (x, min, max) => x !== '' && Number(x) >= min && Number(x) <= max

  const submit = async (e) => {
    e.preventDefault()
    const found = {}
    if (!v.date) found.date = 'Elige la fecha.'
    if (isHarvest) {
      if (!num(v.kg, 1, 100000)) found.kg = 'Escribe los kilos (1 a 100 000).'
      if (!num(v.humidity, 5, 30)) found.humidity = 'La humedad va entre 5% y 30%.'
    } else {
      if (!num(v.temp, 150, 260)) found.temp = 'La temperatura va entre 150 y 260 °C.'
      if (!num(v.minutes, 5, 30)) found.minutes = 'La duración va entre 5 y 30 minutos.'
    }
    setErrors(found)
    if (Object.keys(found).length || busy) return
    setBusy(true)
    const chain = await sealChange(v.batch, `${isHarvest ? 'Cosecha' : 'Tueste'} registrado`, () =>
      (isHarvest ? addHarvest : addRoast)(v),
    )
    setBusy(false)
    setV(empty)
    setOk(`${isHarvest ? 'Cosecha' : 'Tueste'} registrado para el lote ${v.batch} (bloque ${chain.length - 1} sellado).`)
    refresh((n) => n + 1)
  }

  return (
    <div className="ops__split">
      <form onSubmit={submit} noValidate className="auth__form">
        <Field label="Lote" as="select" value={v.batch} onChange={set('batch')}>{batchOptions}</Field>
        <Field label="Fecha" type="date" value={v.date} onChange={set('date')} error={errors.date} />
        {isHarvest ? (
          <>
            <Field label="Kilos de cereza" inputMode="numeric" value={v.kg} onChange={set('kg')} error={errors.kg} autoComplete="off" />
            <Field label="Humedad inicial (%)" inputMode="decimal" value={v.humidity} onChange={set('humidity')} error={errors.humidity} autoComplete="off" />
          </>
        ) : (
          <>
            <Field label="Perfil de tueste" as="select" value={v.profile} onChange={set('profile')}>
              <option>Medio claro</option><option>Medio</option><option>Medio oscuro</option>
            </Field>
            <Field label="Temperatura de descarga (°C)" inputMode="numeric" value={v.temp} onChange={set('temp')} error={errors.temp} autoComplete="off" />
            <Field label="Duración (minutos)" inputMode="decimal" value={v.minutes} onChange={set('minutes')} error={errors.minutes} autoComplete="off" />
          </>
        )}
        {ok && <p className="form-ok" role="status">{ok}</p>}
        <button type="submit" className="btn btn--primary" disabled={busy}>Registrar {kind}</button>
      </form>
      <div>
        <h3 className="display-s">Registros</h3>
        {rows.length ? (
          <ul className="ops__list">
            {rows.map((r) => (
              <li key={r.id} className="ops__item ops__item--flat">
                <strong>{r.batch}</strong>
                <span className="muted">
                  {r.date}, {isHarvest ? `${r.kg} kg, humedad ${r.humidity}%` : `${r.profile}, ${r.temp} °C, ${r.minutes} min`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Todavía no hay registros. Aparecerán en el pasaporte del lote.</p>
        )}
      </div>
    </div>
  )
}

// Telemetría IoT simulada: lecturas manuales o generadas por un sensor simulado
function Telemetry() {
  const [batch, setBatch] = useState(passports[0].code)
  const [v, setV] = useState({ humidity: '', co2: '' })
  const [errors, setErrors] = useState({})
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [, refresh] = useState(0)
  const rows = getReadings().slice(-30).reverse()
  const alerts = passports
    .map((p) => ({ code: p.code, last: getReadings(p.code).at(-1) }))
    .filter((x) => x.last && outOfRange(x.last.humidity))

  const save = async (list, text) => {
    setBusy(true)
    await sealChange(batch, 'Lecturas de sensores registradas', () => addReadings(list))
    setBusy(false)
    setOk(text)
    refresh((n) => n + 1)
  }

  const submit = (e) => {
    e.preventDefault()
    const found = {}
    if (!Number.isFinite(Number(v.humidity)) || v.humidity.trim() === '' || Number(v.humidity) < 0 || Number(v.humidity) > 40) found.humidity = 'La humedad va entre 0% y 40%.'
    if (!Number.isFinite(Number(v.co2)) || v.co2.trim() === '' || Number(v.co2) < 300 || Number(v.co2) > 5000) found.co2 = 'El CO2 va entre 300 y 5 000 ppm.'
    setErrors(found)
    if (Object.keys(found).length || busy) return
    save([{ batch, at: Date.now(), humidity: Number(v.humidity), co2: Math.round(Number(v.co2)) }], `Lectura registrada para ${batch}.`)
    setV({ humidity: '', co2: '' })
  }

  return (
    <div className="ops__split">
      <div className="auth__form">
        <Field label="Lote" as="select" value={batch} onChange={(e) => { setBatch(e.target.value); setOk('') }}>{batchOptions}</Field>
        <form onSubmit={submit} noValidate className="auth__form">
          <Field
            label="Humedad (%)"
            inputMode="decimal"
            value={v.humidity}
            onChange={(e) => { setV((x) => ({ ...x, humidity: e.target.value })); setErrors((er) => ({ ...er, humidity: undefined })); setOk('') }}
            error={errors.humidity}
            hint={`Rango recomendado: ${HUMIDITY_RANGE[0]} a ${HUMIDITY_RANGE[1]}%.`}
            autoComplete="off"
          />
          <Field
            label="CO2 (ppm)"
            inputMode="numeric"
            value={v.co2}
            onChange={(e) => { setV((x) => ({ ...x, co2: e.target.value })); setErrors((er) => ({ ...er, co2: undefined })); setOk('') }}
            error={errors.co2}
            autoComplete="off"
          />
          <button type="submit" className="btn btn--primary" disabled={busy}>Registrar lectura</button>
        </form>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy}
          onClick={() => save(simulateReadings(batch), `Sensor simulado: 6 lecturas nuevas para ${batch}.`)}
        >
          Simular sensor
        </button>
        {ok && <p className="form-ok" role="status">{ok}</p>}
      </div>
      <div>
        {alerts.map((a) => (
          <p key={a.code} className="notice notice--warn" role="alert">
            Humedad fuera de rango en {a.code}: {a.last.humidity}% (rango {HUMIDITY_RANGE[0]} a {HUMIDITY_RANGE[1]}%).
          </p>
        ))}
        <h3 className="display-s">Últimas lecturas</h3>
        {rows.length ? (
          <ul className="ops__list">
            {rows.map((r) => (
              <li key={r.id} className="ops__item ops__item--flat">
                <strong>{r.batch}</strong>
                <span className={outOfRange(r.humidity) ? 'is-error' : 'muted'}>
                  {fmtDate(new Date(r.at).toISOString())}, humedad {r.humidity}%{outOfRange(r.humidity) ? ' (fuera de rango)' : ''}, CO2 {r.co2} ppm
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Sin lecturas registradas. Se suman a los gráficos del pasaporte.</p>
        )}
      </div>
    </div>
  )
}

// Recordatorios predictivos de WhatsApp para las suscripciones activas
function Reminders() {
  const [, refresh] = useState(0)
  const subs = getAllSubs().filter((s) => s.status === 'active')
  const send = (s) => {
    pushChat(s.id, [{ from: 'bot', text: reminderText(s, daysUntil(s.nextDelivery)) }])
    updateSub(s.id, { replied: false })
    refresh((n) => n + 1)
  }
  const advance = (s) => {
    updateSub(s.id, { nextDelivery: Date.now() + (REMINDER_DAYS - 0.5) * 24 * 3600 * 1000, chat: [], replied: false })
    refresh((n) => n + 1)
  }

  if (!subs.length) return <p className="muted">No hay suscripciones activas. Compra un café con frecuencia semanal, quincenal o mensual.</p>
  return (
    <>
      <p className="muted measure">
        El aviso se calcula con la próxima entrega: cuando faltan {REMINDER_DAYS} días o menos se ofrece enviar el café.
        Mensajes simulados, no se envía nada.
      </p>
      <ul className="subs">
        {subs.map((s) => {
          const { product } = subInfo(s)
          const days = daysUntil(s.nextDelivery)
          const due = isDue(s)
          return (
            <li key={s.id} className="sub">
              <div className="sub__head">
                <div>
                  <h3 className="display-s">{s.name}</h3>
                  <p className="muted">{product.name}, {s.qty} x, entrega {fmtDay(s.nextDelivery)} (en {days} d)</p>
                </div>
                <span className={`badge ${due ? 'badge--listo' : ''}`}>{due ? 'Aviso pendiente' : 'Aún no toca'}</span>
              </div>
              <div className="sub__actions">
                <button type="button" className="btn btn--primary btn--sm" onClick={() => send(s)} disabled={!due}>
                  Enviar recordatorio
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => advance(s)}>
                  Adelantar entrega a {REMINDER_DAYS} días (demo)
                </button>
              </div>
              <ReminderChat sub={s} interactive={false} />
            </li>
          )
        })}
      </ul>
    </>
  )
}

// Códigos QR reales para cada empaque de un lote
function QrLabels() {
  const [batch, setBatch] = useState(passports[0].code)
  const [count, setCount] = useState(4)
  const n = Math.min(12, Math.max(1, Math.floor(Number(count)) || 1))
  return (
    <div>
      <div className="ops__split ops__split--narrow">
        <Field label="Lote" as="select" value={batch} onChange={(e) => setBatch(e.target.value)}>{batchOptions}</Field>
        <Field label="Cantidad de etiquetas (1 a 12)" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
      </div>
      <ul className="labels">
        {Array.from({ length: n }, (_, i) => {
          const code = `${batch}-U${String(i + 1).padStart(3, '0')}`
          return (
            <li key={code} className="label">
              <QrImage value={passportUrl(code)} label={`QR del empaque ${i + 1} del lote ${batch}`} filename={`qr-${code}`} className="label__qr" download />
              <strong>{batch}</strong>
              <span className="muted">Empaque {String(i + 1).padStart(3, '0')}</span>
              <span className="muted label__url">{passportUrl(code)}</span>
            </li>
          )
        })}
      </ul>
      <button type="button" className="btn btn--ghost" onClick={() => window.print()}>Imprimir etiquetas</button>
    </div>
  )
}

export default function Ops() {
  useTitle('Panel interno')
  const [tab, setTab] = useState('barista')
  return (
    <div className="container page ops">
      <header className="page__head">
        <h1 className="display-l">Panel interno</h1>
        <p className="lead measure">Vista interna de ejemplo para barista, dark store, cosecha, tueste, telemetría, recordatorios y etiquetas QR.</p>
      </header>
      <div className="tabs tabs--wrap" role="tablist" aria-label="Secciones del panel">
        {TABS.map((t) => (
          <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls="ops-panel" className="tabs__tab" onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div id="ops-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {(tab === 'barista' || tab === 'dark') && <Queue key={tab} mode={tab} />}
        {tab === 'cosecha' && <RegisterForm key="c" kind="cosecha" />}
        {tab === 'tueste' && <RegisterForm key="t" kind="tueste" />}
        {tab === 'telemetria' && <Telemetry />}
        {tab === 'recordatorios' && <Reminders />}
        {tab === 'qr' && <QrLabels />}
      </div>
    </div>
  )
}
