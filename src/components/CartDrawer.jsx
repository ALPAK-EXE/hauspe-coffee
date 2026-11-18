import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { X, Minus, Plus, Trash } from '@phosphor-icons/react'
import { useCart } from '../context/CartContext'
import { DESTINATIONS, INCOTERMS, PLANS, SACK_KG, fmtPEN, fmtUSD } from '../data/products'

function Stepper({ value, min = 1, max = 99, onChange, label }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Restar" disabled={value <= min}>
        <Minus size={14} />
      </button>
      <output>{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label="Sumar" disabled={value >= max}>
        <Plus size={14} />
      </button>
    </div>
  )
}

function DrinkLine({ line, updateItem, removeItem }) {
  const { item, product, size } = line
  return (
    <li className="cart-line">
      <div className="cart-line__head">
        <div>
          <h3>{product.name}</h3>
          <p className="muted">{size.label}, bebida de la barra</p>
        </div>
        <button type="button" className="icon-btn icon-btn--sm" onClick={() => removeItem(item.key)} aria-label={`Quitar ${product.name}`}>
          <Trash size={18} />
        </button>
      </div>
      <div className="cart-line__foot">
        <Stepper value={item.qty} max={20} onChange={(qty) => updateItem(item.key, { qty })} label={`Cantidad de ${product.name}`} />
        <div className="cart-line__price"><strong>{fmtPEN(line.total)}</strong></div>
      </div>
    </li>
  )
}

function RetailLine({ line, updateItem, removeItem }) {
  const { item, product } = line
  if (product.kind === 'drink') return <DrinkLine line={line} updateItem={updateItem} removeItem={removeItem} />
  return (
    <li className="cart-line">
      <div className="cart-line__head">
        <div>
          <h3>{product.name}</h3>
          <p className="muted">
            {product.weight}, {item.grind}
          </p>
        </div>
        <button type="button" className="icon-btn icon-btn--sm" onClick={() => removeItem(item.key)} aria-label={`Quitar ${product.name}`}>
          <Trash size={18} />
        </button>
      </div>
      <label className="cart-line__select">
        <span>Frecuencia</span>
        <select value={item.plan} onChange={(e) => updateItem(item.key, { plan: e.target.value })}>
          {PLANS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.discount ? ` (-${Math.round(p.discount * 100)}%)` : ''}
            </option>
          ))}
        </select>
      </label>
      <div className="cart-line__foot">
        <Stepper value={item.qty} max={20} onChange={(qty) => updateItem(item.key, { qty })} label={`Cantidad de ${product.name}`} />
        <div className="cart-line__price">
          {line.saving > 0 && <s>{fmtPEN(product.price * item.qty)}</s>}
          <strong>{fmtPEN(line.total)}</strong>
        </div>
      </div>
    </li>
  )
}

function WholesaleLine({ line, updateItem, removeItem }) {
  const { item, product, quote } = line
  return (
    <li className="cart-line">
      <div className="cart-line__head">
        <div>
          <h3>{product.name}</h3>
          <p className="muted">
            Café verde, {product.variety}, {product.process}
          </p>
        </div>
        <button type="button" className="icon-btn icon-btn--sm" onClick={() => removeItem(item.key)} aria-label={`Quitar ${product.name}`}>
          <Trash size={18} />
        </button>
      </div>
      <div className="cart-line__grid">
        <label className="cart-line__select">
          <span>Incoterm</span>
          <select value={item.incoterm} onChange={(e) => updateItem(item.key, { incoterm: e.target.value })}>
            {INCOTERMS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </label>
        <label className="cart-line__select">
          <span>País de destino</span>
          <select value={item.dest} onChange={(e) => updateItem(item.key, { dest: e.target.value })}>
            {DESTINATIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <dl className="quote">
        <div>
          <dt>
            {quote.kg} kg x {fmtUSD(product.pricePerKg)}
          </dt>
          <dd>{fmtUSD(quote.base)}</dd>
        </div>
        {quote.discount > 0 && (
          <div>
            <dt>Descuento por volumen</dt>
            <dd>-{fmtUSD(quote.discount)}</dd>
          </div>
        )}
        {item.incoterm === 'CIF' && (
          <div>
            <dt>Flete y seguro (estimado)</dt>
            <dd>{fmtUSD(quote.freight)}</dd>
          </div>
        )}
      </dl>
      <div className="cart-line__foot">
        <div>
          <Stepper
            value={item.qty}
            min={product.minSacks}
            max={product.stockSacks}
            onChange={(qty) => updateItem(item.key, { qty })}
            label={`Sacos de ${product.name}`}
          />
          <p className="muted cart-line__hint">
            sacos de {SACK_KG} kg, mínimo {product.minSacks}
          </p>
        </div>
        <div className="cart-line__price">
          <strong>{fmtUSD(line.total)}</strong>
        </div>
      </div>
    </li>
  )
}

export default function CartDrawer() {
  const { lines, totals, open, setOpen, updateItem, removeItem } = useCart()
  const navigate = useNavigate()
  const panelRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') return setOpen(false)
      // Mantiene el foco dentro del panel mientras está abierto
      if (e.key === 'Tab' && panelRef.current) {
        const f = [...panelRef.current.querySelectorAll('a[href], button:not(:disabled), select, input')]
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [open, setOpen])

  const goCheckout = () => {
    setOpen(false)
    navigate('/checkout')
  }

  return (
    <div className={`drawer${open ? ' is-open' : ''}`} aria-hidden={!open}>
      <div className="drawer__scrim" onClick={() => setOpen(false)} />
      <aside ref={panelRef} className="drawer__panel" role="dialog" aria-modal="true" aria-label="Carrito de compras">
        <header className="drawer__head">
          <h2>Tu carrito</h2>
          <button ref={closeRef} type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar carrito">
            <X size={22} />
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="drawer__empty">
            <p className="display-s">Todavía no hay café aquí</p>
            <p className="muted">Elige un café tostado para tu casa o un lote de café verde para exportar.</p>
            <Link to="/catalogo" className="btn btn--primary" onClick={() => setOpen(false)}>
              Ver cafés
            </Link>
          </div>
        ) : (
          <>
            <ul className="drawer__lines">
              {lines.map((line) =>
                line.currency === 'PEN' ? (
                  <RetailLine key={line.item.key} line={line} updateItem={updateItem} removeItem={removeItem} />
                ) : (
                  <WholesaleLine key={line.item.key} line={line} updateItem={updateItem} removeItem={removeItem} />
                ),
              )}
            </ul>
            <footer className="drawer__foot">
              {totals.pen > 0 && (
                <p className="total-row">
                  <span>Total tienda</span>
                  <strong>{fmtPEN(totals.pen)}</strong>
                </p>
              )}
              {totals.usd > 0 && (
                <p className="total-row">
                  <span>Cotización de exportación (sin IGV)</span>
                  <strong>{fmtUSD(totals.usd)}</strong>
                </p>
              )}
              <button type="button" className="btn btn--primary btn--block" onClick={goCheckout}>
                Continuar al pago
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}
