import { useState } from 'react'
import useTitle from '../useTitle'
import { useAuth } from '../context/AuthContext'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, QrCode } from '@phosphor-icons/react'
import CoffeeBag from '../components/CoffeeBag'
import { useCart } from '../context/CartContext'
import {
  DESTINATIONS,
  GRIND_OPTIONS,
  canBuyRetail,
  canQuoteExport,
  INCOTERMS,
  PLANS,
  SACK_KG,
  fmtPEN,
  fmtUSD,
  getProduct,
  quoteLot,
  round2,
} from '../data/products'

export default function ProductDetail() {
  const { id } = useParams()
  const product = getProduct(id)
  useTitle(product ? (product.kind === 'b2b' ? product.finca : `Café ${product.name}`) : 'Café no encontrado')
  if (!product) {
    return (
      <div className="container page empty">
        <h1 className="display-l">No encontramos ese café</h1>
        <Link to="/catalogo" className="btn btn--primary">
          Volver al catálogo
        </Link>
      </div>
    )
  }
  return product.kind === 'b2c' ? <Retail key={id} product={product} /> : <Lot key={id} lot={product} />
}

function Back({ b2b }) {
  return (
    <Link to={b2b ? '/catalogo?tab=b2b' : '/catalogo'} className="back">
      <ArrowLeft size={16} /> {b2b ? 'Exportación' : 'Cafés'}
    </Link>
  )
}

// Aviso cuando el carrito ya tiene productos de la otra moneda
function MixedNotice({ current, onReplace }) {
  return (
    <div className="notice notice--warn" role="alert">
      <p>
        {current === 'PEN'
          ? 'Tu carrito tiene productos de la tienda (en soles). Una cotización de exportación (en dólares) va en un pedido aparte.'
          : 'Tu carrito tiene una cotización de exportación (en dólares). Los productos de la tienda (en soles) van en un pedido aparte.'}
      </p>
      <button type="button" className="btn btn--ghost btn--sm" onClick={onReplace}>
        Vaciar el carrito y agregar este
      </button>
    </div>
  )
}

function Blocked({ children, to, cta }) {
  return (
    <div className="notice notice--warn">
      <p>{children}</p>
      <Link to={to} className="btn btn--ghost btn--sm">
        {cta}
      </Link>
    </div>
  )
}

function Retail({ product }) {
  const { addItem } = useCart()
  const { user } = useAuth()
  const [mixed, setMixed] = useState(null)
  const [grind, setGrind] = useState(GRIND_OPTIONS[0])
  const [plan, setPlan] = useState('once')
  const [qty, setQty] = useState(1)
  const planObj = PLANS.find((p) => p.id === plan)
  const unit = round2(product.price * (1 - planObj.discount))

  return (
    <div className="container page">
      <Back />
      <div className="detail">
        <div className="detail__media" style={{ '--tint': product.color }}>
          <CoffeeBag name={product.name} color={product.color} />
        </div>
        <div className="detail__info">
          <h1 className="display-l">{product.name}</h1>
          <p className="lead">{product.description}</p>

          <ul className="chips chips--lg" aria-label="Notas de cata">
            {product.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>

          <dl className="facts">
            <div>
              <dt>Tueste</dt>
              <dd>{product.roast}</dd>
            </div>
            <div>
              <dt>Origen</dt>
              <dd>{product.origin}</dd>
            </div>
            <div>
              <dt>Altura</dt>
              <dd>{product.altitude}</dd>
            </div>
            <div>
              <dt>Presentación</dt>
              <dd>{product.weight}</dd>
            </div>
          </dl>

          <div className="buy">
            <label className="buy__field">
              <span>Molienda</span>
              <select value={grind} onChange={(e) => setGrind(e.target.value)}>
                {GRIND_OPTIONS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <fieldset className="buy__plans">
              <legend>Frecuencia</legend>
              {PLANS.map((p) => (
                <label key={p.id} className={`plan${plan === p.id ? ' is-on' : ''}`}>
                  <input type="radio" name="plan" checked={plan === p.id} onChange={() => setPlan(p.id)} />
                  <span>{p.label}</span>
                  {p.discount > 0 && <small>-{Math.round(p.discount * 100)}%</small>}
                </label>
              ))}
            </fieldset>
            <div className="buy__row">
              <div className="stepper" role="group" aria-label="Cantidad">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Restar" disabled={qty <= 1}>
                  -
                </button>
                <output>{qty}</output>
                <button type="button" onClick={() => setQty((q) => q + 1)} aria-label="Sumar">
                  +
                </button>
              </div>
              <button
                type="button"
                className="btn btn--primary buy__add"
                disabled={!canBuyRetail(user)}
                onClick={() => {
                  const res = addItem({ id: product.id, qty, grind, plan })
                  setMixed(res.ok ? null : res)
                }}
              >
                Agregar, {fmtPEN(round2(unit * qty))}
              </button>
            </div>
            {!canBuyRetail(user) && (
              <Blocked to="/catalogo?tab=b2b" cta="Ver lotes de exportación">
                La tienda en soles es para clientes en Perú. Tu cuenta de importador cotiza café verde.
              </Blocked>
            )}
            {mixed && (
              <MixedNotice
                current={mixed.current}
                onReplace={() => {
                  addItem({ id: product.id, qty, grind, plan }, { replace: true })
                  setMixed(null)
                }}
              />
            )}
          </div>

          <Link to={`/qr/${product.batch}`} className="text-link">
            <QrCode size={18} /> Ver pasaporte digital del lote
          </Link>
        </div>
      </div>
    </div>
  )
}

function Lot({ lot }) {
  const { addItem } = useCart()
  const { user } = useAuth()
  const [mixed, setMixed] = useState(null)
  const [sacks, setSacks] = useState(lot.minSacks)
  const [incoterm, setIncoterm] = useState('FOB')
  const [dest, setDest] = useState('US')
  const quote = quoteLot(lot, sacks, incoterm, dest)
  const invalid = sacks < lot.minSacks || sacks > lot.stockSacks

  return (
    <div className="container page">
      <Back b2b />
      <div className="detail">
        <div className="detail__media detail__media--lot" style={{ '--tint': lot.color }}>
          <CoffeeBag name={lot.name} color={lot.color} variant="sack" />
        </div>
        <div className="detail__info">
          <h1 className="display-l">{lot.finca}</h1>
          <p className="lead">{lot.story}</p>
          <p className="notice notice--soft">
            Café verde sin tostar. Viaja así para conservar su frescura y se tuesta en el país de destino.
          </p>

          <ul className="chips chips--lg" aria-label="Notas de cata">
            {lot.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>

          <dl className="facts facts--lot">
            <div>
              <dt>Productor</dt>
              <dd>{lot.productor}</dd>
            </div>
            <div>
              <dt>Altura</dt>
              <dd>{lot.altitude.toLocaleString('en-US').replace(',', ' ')} msnm</dd>
            </div>
            <div>
              <dt>Variedad</dt>
              <dd>{lot.variety}</dd>
            </div>
            <div>
              <dt>Proceso</dt>
              <dd>{lot.process}</dd>
            </div>
            <div>
              <dt>Puntaje SCA</dt>
              <dd>{lot.sca}</dd>
            </div>
            <div>
              <dt>Cosecha</dt>
              <dd>{lot.harvest}</dd>
            </div>
            <div>
              <dt>Precio</dt>
              <dd>{fmtUSD(lot.pricePerKg)} por kg</dd>
            </div>
            <div>
              <dt>Pedido mínimo</dt>
              <dd>{lot.minSacks} sacos de {SACK_KG} kg</dd>
            </div>
          </dl>

          <div className="buy">
            <div className="buy__grid">
              <label className="buy__field">
                <span>Sacos de {SACK_KG} kg</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={lot.minSacks}
                  max={lot.stockSacks}
                  value={sacks}
                  onChange={(e) => setSacks(Math.floor(Number(e.target.value)) || 0)}
                />
                <small className={invalid ? 'is-error' : ''}>
                  {invalid
                    ? `Entre ${lot.minSacks} y ${lot.stockSacks} sacos`
                    : `${lot.stockSacks} sacos disponibles`}
                </small>
              </label>
              <label className="buy__field">
                <span>Incoterm</span>
                <select value={incoterm} onChange={(e) => setIncoterm(e.target.value)}>
                  {INCOTERMS.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
                </select>
                <small>{INCOTERMS.find((i) => i.id === incoterm).hint}</small>
              </label>
              <label className="buy__field">
                <span>País de destino</span>
                <select value={dest} onChange={(e) => setDest(e.target.value)}>
                  {DESTINATIONS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <dl className="quote quote--lg">
              <div>
                <dt>{quote.kg} kg</dt>
                <dd>{fmtUSD(quote.base)}</dd>
              </div>
              {quote.discount > 0 && (
                <div>
                  <dt>Descuento por volumen</dt>
                  <dd>-{fmtUSD(quote.discount)}</dd>
                </div>
              )}
              {incoterm === 'CIF' && (
                <div>
                  <dt>Flete y seguro (estimado)</dt>
                  <dd>{fmtUSD(quote.freight)}</dd>
                </div>
              )}
              <div className="quote__total">
                <dt>Total estimado</dt>
                <dd>{fmtUSD(quote.total)}</dd>
              </div>
            </dl>

            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={invalid || !canQuoteExport(user)}
              onClick={() => {
                const res = addItem({ id: lot.id, qty: sacks, incoterm, dest })
                setMixed(res.ok ? null : res)
              }}
            >
              Agregar a la cotización
            </button>
            {!canQuoteExport(user) && (
              <Blocked to="/catalogo" cta="Ir a la tienda">
                {user.segment === 'b2c'
                  ? 'Las cotizaciones de exportación son para empresas importadoras. Tu cuenta es de suscriptor.'
                  : 'Las cotizaciones de exportación son para importadores del exterior. Tu cuenta HORECA compra en la tienda.'}
              </Blocked>
            )}
            {mixed && (
              <MixedNotice
                current={mixed.current}
                onReplace={() => {
                  addItem({ id: lot.id, qty: sacks, incoterm, dest }, { replace: true })
                  setMixed(null)
                }}
              />
            )}
            <p className="muted">Exportación de bienes: la cotización no incluye IGV.</p>
          </div>

          <Link to={`/qr/${lot.batch}`} className="text-link">
            <QrCode size={18} /> Ver pasaporte digital del lote
          </Link>
        </div>
      </div>
    </div>
  )
}
