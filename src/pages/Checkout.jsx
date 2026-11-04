import { useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import useTitle from '../useTitle'
import FakeQr from '../components/FakeQr'
import Field from '../components/Field'
import { useAuth } from '../context/AuthContext'
import { nextNumber, useCart } from '../context/CartContext'
import { makeAlert } from '../data/ops'
import { createSubs } from '../data/subs'
import { canBuyRetail, canQuoteExport, fmtPEN, fmtUSD, IGV_RATE, round2, SACK_KG } from '../data/products'



function snapshot(line) {
  const p = line.product
  if (line.currency === 'PEN') {
    return {
      currency: 'PEN',
      productId: p.id,
      grind: line.item.grind,
      planId: line.plan.id,
      name: `${p.name} ${p.weight}`,
      detail: `${line.item.grind}, ${line.plan.label.toLowerCase()}`,
      qty: line.item.qty,
      unit: line.unit,
      total: line.total,
    }
  }
  return {
    currency: 'USD',
    name: `${p.finca} (${p.variety}, ${p.process})`,
    detail: `${line.item.incoterm} ${line.item.dest}, ${line.quote.kg} kg`,
    qty: line.item.qty,
    unit: round2(p.pricePerKg * SACK_KG),
    total: line.total,
  }
}

function Blocked({ title, text, action }) {
  return (
    <div className="container page empty">
      <h1 className="display-l">{title}</h1>
      <p className="muted measure">{text}</p>
      {action}
    </div>
  )
}

export default function Checkout() {
  useTitle('Pago')
  const { user } = useAuth()
  const { lines, totals, clear, saveOrder } = useCart()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [dni, setDni] = useState('')
  const [errors, setErrors] = useState({})
  const [paying, setPaying] = useState(false)
  const submitted = useRef(false) // evita pedidos duplicados con doble clic

  if (!user) return <Navigate to="/login" state={{ from: '/checkout' }} replace />

  if (!lines.length) {
    return (
      <Blocked
        title="Tu carrito está vacío"
        text="Agrega un café tostado o un lote de café verde para continuar."
        action={<Link to="/catalogo" className="btn btn--primary">Ver cafés</Link>}
      />
    )
  }

  const hasPen = totals.pen > 0
  const hasUsd = totals.usd > 0

  if ((hasPen && !canBuyRetail(user)) || (hasUsd && !canQuoteExport(user))) {
    const text = hasPen
      ? 'La tienda en soles es para clientes en Perú. Tu cuenta de importador solicita cotizaciones de café verde.'
      : user.segment === 'b2c'
        ? 'Las cotizaciones de exportación son para empresas importadoras. Tu cuenta es de suscriptor.'
        : 'Las cotizaciones de exportación son para importadores del exterior. Tu cuenta HORECA compra en la tienda.'
    return (
      <Blocked
        title="Este carrito no corresponde a tu cuenta"
        text={text}
        action={<button type="button" className="btn btn--primary" onClick={clear}>Vaciar el carrito</button>}
      />
    )
  }

  // Empresa peruana (HORECA) con RUC: factura. Suscriptor: boleta.
  const isInvoice = user.segment === 'b2b'

  const confirm = (ev) => {
    ev.preventDefault()
    if (submitted.current) return
    const found = {}
    if (hasPen) {
      if (!/^\d{6,8}$/.test(code.trim())) found.code = 'El código de operación de Yape tiene entre 6 y 8 dígitos.'
      if (!isInvoice && dni.trim() && !/^\d{8}$/.test(dni.trim())) found.dni = 'El DNI tiene 8 dígitos.'
    }
    setErrors(found)
    if (Object.keys(found).length) return
    submitted.current = true
    setPaying(true)
    // Simula la validación del pago
    setTimeout(() => {
      const total = totals.pen
      const base = round2(total / (1 + IGV_RATE))
      const series = isInvoice ? 'F001' : 'B001'
      const order = {
        id: 'HP' + Date.now().toString(36).toUpperCase(),
        date: new Date().toISOString(),
        customer: { name: user.name, email: user.email, whatsapp: user.whatsapp, company: user.company, taxId: user.taxId, country: user.country },
        lines: lines.map(snapshot),
        totalPen: total,
        totalUsd: totals.usd,
        basePen: hasPen ? base : 0,
        igvPen: hasPen ? round2(total - base) : 0,
        opCode: hasPen ? code.trim() : null,
        doc: hasPen
          ? {
              type: isInvoice ? 'Factura electrónica' : 'Boleta de venta electrónica',
              number: nextNumber(series),
              customerDoc: isInvoice
                ? { label: 'RUC', value: user.taxId }
                : { label: 'DNI', value: dni.trim() || 'Sin DNI (consumidor final)' },
            }
          : null,
        quote: hasUsd ? { number: nextNumber('COT') } : null,
        status: hasPen ? 'nuevo' : null,
      }
      order.alerts = hasPen ? [makeAlert('nuevo', order.id)] : []
      saveOrder(order)
      createSubs(order, user)
      navigate(`/pedido/${order.id}`, { replace: true })
      clear()
    }, 900)
  }

  return (
    <div className="container page">
      <header className="page__head">
        <h1 className="display-l">Pago</h1>
      </header>
      <div className="checkout">
        <section aria-label="Resumen">
          <h2 className="display-s">Resumen</h2>
          <ul className="summary">
            {lines.map((l) => {
              const s = snapshot(l)
              return (
                <li key={l.item.key}>
                  <div>
                    <strong>{s.name}</strong>
                    <span className="muted">{s.detail}, x{s.qty}</span>
                  </div>
                  <span className="money">{l.currency === 'PEN' ? fmtPEN(s.total) : fmtUSD(s.total)}</span>
                </li>
              )
            })}
          </ul>
          {hasPen && (
            <>
              <p className="total-row"><span>Total a pagar con Yape</span><strong>{fmtPEN(totals.pen)}</strong></p>
              <p className="muted">Precios con IGV incluido (18%).</p>
            </>
          )}
          {hasUsd && (
            <>
              <p className="total-row"><span>Cotización de exportación</span><strong>{fmtUSD(totals.usd)}</strong></p>
              <p className="muted">Exportación de bienes: operación no gravada, sin IGV.</p>
            </>
          )}
        </section>

        <form className="pay" onSubmit={confirm} noValidate>
          {hasPen ? (
            <>
              <h2 className="display-s">Paga con Yape</h2>
              <div className="pay__qr">
                <FakeQr seed={'yape' + totals.pen} label="QR de Yape de ejemplo" />
              </div>
              <ol className="pay__steps">
                <li>Abre Yape y escanea el código.</li>
                <li>Paga {fmtPEN(totals.pen)} a HausPe Coffee.</li>
                <li>Escribe aquí el código de operación.</li>
              </ol>
              <Field
                label="Código de operación"
                value={code}
                onChange={(e) => { setCode(e.target.value); setErrors((er) => ({ ...er, code: undefined })) }}
                error={errors.code}
                hint="Es un pago simulado. Escribe cualquier número de 6 a 8 dígitos."
                inputMode="numeric"
                maxLength={8}
                autoComplete="off"
              />
              {isInvoice ? (
                <p className="muted">Recibirás una factura electrónica con tu RUC {user.taxId}.</p>
              ) : (
                <Field
                  label="DNI para la boleta (opcional)"
                  value={dni}
                  onChange={(e) => { setDni(e.target.value); setErrors((er) => ({ ...er, dni: undefined })) }}
                  error={errors.dni}
                  inputMode="numeric"
                  maxLength={8}
                  autoComplete="off"
                />
              )}
            </>
          ) : (
            <>
              <h2 className="display-s">Solicitar cotización</h2>
              <p className="muted">
                Recibirás una cotización formal en US$ con el Incoterm y el destino elegidos. El pago se coordina
                por transferencia internacional.
              </p>
            </>
          )}
          <button type="submit" className="btn btn--primary btn--block" disabled={paying}>
            {paying ? 'Validando pago...' : hasPen ? 'Confirmar pago' : 'Solicitar cotización'}
          </button>
        </form>
      </div>
    </div>
  )
}
