import { useState } from 'react'
import useTitle from '../useTitle'
import { useAuth } from '../context/AuthContext'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, QrCode } from '@phosphor-icons/react'
import CoffeeBag from '../components/CoffeeBag'
import Glass, { layersOf } from '../components/Glass'
import { useCart } from '../context/CartContext'
import {
  BAG_GRAMS,
  DESTINATIONS,
  LAYERS,
  bagInsumos,
  GRIND_OPTIONS,
  canBuyRetail,
  canQuoteExport,
  INCOTERMS,
  PLANS,
  PRESENTACIONES,
  precioPres,
  presOf,
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
  if (product.kind === 'drink') return <Drink key={id} drink={product} />
  return product.kind === 'b2c' ? <Retail key={id} product={product} /> : <Lot key={id} lot={product} />
}

function Back({ b2b, barra }) {
  return (
    <Link to={b2b ? '/catalogo?tab=b2b' : barra ? '/catalogo?tab=barra' : '/catalogo'} className="back">
      <ArrowLeft size={16} /> {b2b ? 'Exportación' : barra ? 'Cafetería' : 'Cafés'}
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
  const [params] = useSearchParams()
  const [pres, setPres] = useState(() => (params.get('pres') === '1kg' || user?.businessType === 'HORECA' ? '1kg' : '250g'))
  const planObj = PLANS.find((p) => p.id === plan)
  const base = precioPres(product, pres)
  const unit = round2(base * (1 - planObj.discount))

  return (
    <div className="container page">
      <Back />
      <div className="detail">
        <div className="detail__media" style={{ '--tint': product.color }}>
          <CoffeeBag name={product.name} color={product.color} weight={presOf(pres).bolsa} />
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
            <div>
              <dt>Variedad y proceso</dt>
              <dd>{product.variety}, {product.process.toLowerCase()}</dd>
            </div>
            <div>
              <dt>Puntaje SCA</dt>
              <dd>{product.sca}</dd>
            </div>
          </dl>

          <Insumos
            titulo={`Qué lleva cada bolsa de ${BAG_GRAMS} g`}
            filas={bagInsumos(product)}
            nota="Grano 100 % arábica de Villa Rica. El gramaje por finca suma el peso neto de la bolsa."
          />

          <div className="buy">
            <fieldset className="buy__plans sizes">
              <legend>Presentación</legend>
              {PRESENTACIONES.map((p) => (
                <label key={p.id} className={`plan${pres === p.id ? ' is-on' : ''}`}>
                  <input type="radio" name="pres" checked={pres === p.id} onChange={() => setPres(p.id)} />
                  <span>{p.label}</span>
                  <small>{fmtPEN(precioPres(product, p.id))}</small>
                </label>
              ))}
            </fieldset>
            {pres === '1kg' && <p className="muted">Para cafeterías, restaurantes y hoteles. Con cuenta HORECA recibes factura con tu RUC.</p>}
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
                  const res = addItem({ id: product.id, qty, grind, plan, pres })
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
                  addItem({ id: product.id, qty, grind, plan, pres }, { replace: true })
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

// Tabla de insumos con su gramaje; la barra muestra la proporción de cada finca o ingrediente
function Insumos({ titulo, filas, nota }) {
  const max = Math.max(...filas.filter((f) => f.unidad !== 'u').map((f) => f.cantidad))
  return (
    <section className="insumos" aria-label={titulo}>
      <h2 className="display-s">{titulo}</h2>
      <table>
        <thead><tr><th>Insumo</th><th>Cantidad</th></tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.nombre}>
              <td>
                {f.capa && <i className="insumos__dot" style={{ background: LAYERS[f.capa].color }} aria-hidden="true" />}
                {f.nombre}
                {f.unidad !== 'u' && <span className="insumos__bar" style={{ '--w': `${(f.cantidad / max) * 100}%` }} aria-hidden="true" />}
              </td>
              <td className="money">{f.cantidad} {f.unidad}{f.pct ? ` (${f.pct} %)` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {nota && <p className="muted">{nota}</p>}
    </section>
  )
}

function Drink({ drink }) {
  const { addItem } = useCart()
  const { user } = useAuth()
  const [sizeId, setSizeId] = useState(drink.sizes[0].id)
  const [qty, setQty] = useState(1)
  const [mixed, setMixed] = useState(null)
  const size = drink.sizes.find((z) => z.id === sizeId)
  const base = getProduct(drink.base)
  const ml = layersOf(size).reduce((s, c) => s + c.ml, 0)
  const add = (opts) => {
    const res = addItem({ id: drink.id, qty, size: sizeId }, opts)
    setMixed(res.ok ? null : res)
  }
  return (
    <div className="container page">
      <Back barra />
      <div className="detail detail--drink">
        <div className="detail__media detail__media--drink" style={{ '--tint': drink.color }}>
          <Glass key={drink.id} drink={drink} size={size} />
          <ul className="glass__legend">
            {layersOf(size).slice().reverse().map((c) => (
              <li key={c.key}><i style={{ background: LAYERS[c.key].color }} />{LAYERS[c.key].label}<span>{c.ml} ml</span></li>
            ))}
          </ul>
        </div>
        <div className="detail__info">
          <h1 className="display-l">{drink.name}</h1>
          <p className="lead">{drink.description}</p>
          <ul className="chips chips--lg" aria-label="Notas de cata">
            {drink.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
          <fieldset className="buy__plans sizes">
            <legend>Tamaño</legend>
            {drink.sizes.map((z) => (
              <label key={z.id} className={`plan${sizeId === z.id ? ' is-on' : ''}`}>
                <input type="radio" name="size" checked={sizeId === z.id} onChange={() => setSizeId(z.id)} />
                <span>{z.label}</span>
                <small>{fmtPEN(z.price)}</small>
              </label>
            ))}
          </fieldset>
          <Insumos
            titulo={`Receta de un ${drink.name.toLowerCase()} ${size.label}`}
            filas={size.insumos}
            nota={`Preparado con café ${base.name} (${base.notes.join(', ').toLowerCase()}). Volumen servido: ${ml} ml.`}
          />
          <div className="buy">
            <div className="buy__row">
              <div className="stepper" role="group" aria-label="Cantidad">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Restar" disabled={qty <= 1}>-</button>
                <output>{qty}</output>
                <button type="button" onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="Sumar">+</button>
              </div>
              <button type="button" className="btn btn--primary buy__add" disabled={!canBuyRetail(user)} onClick={() => add()}>
                Agregar, {fmtPEN(round2(size.price * qty))}
              </button>
            </div>
            {mixed && <MixedNotice current={mixed.current} onReplace={() => { add({ replace: true }); setMixed(null) }} />}
          </div>
          <Link to={`/catalogo/${base.id}`} className="text-link">Comprar el café {base.name} en bolsa</Link>
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
