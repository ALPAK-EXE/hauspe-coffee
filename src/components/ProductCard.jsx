import { Link } from 'react-router-dom'
import CoffeeBag from './CoffeeBag'
import Glass from './Glass'
import { fmtPEN, fmtUSD } from '../data/products'

export function RetailCard({ product }) {
  return (
    <article className="pcard">
      <Link to={`/catalogo/${product.id}`} className="pcard__media" style={{ '--tint': product.color }}>
        <CoffeeBag name={product.name} color={product.color} />
      </Link>
      <div className="pcard__body">
        <div className="pcard__title">
          <h3>
            <Link to={`/catalogo/${product.id}`}>{product.name}</Link>
          </h3>
          <span className="pcard__price">{fmtPEN(product.price)}</span>
        </div>
        <p className="muted">
          Tueste {product.roast.toLowerCase()}, {product.weight}
        </p>
        <ul className="chips" aria-label="Notas de cata">
          {product.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </article>
  )
}

export function DrinkCard({ drink }) {
  const big = drink.sizes.at(-1)
  return (
    <article className="pcard">
      <Link to={`/catalogo/${drink.id}`} className="pcard__media pcard__media--drink" style={{ '--tint': drink.color }} aria-label={drink.name}>
        <Glass drink={drink} size={big} compact />
      </Link>
      <div className="pcard__body">
        <div className="pcard__title">
          <h3><Link to={`/catalogo/${drink.id}`}>{drink.name}</Link></h3>
          <span className="pcard__price">desde {fmtPEN(drink.sizes[0].price)}</span>
        </div>
        <p className="muted">{drink.sizes.map((z) => z.label).join(' o ')}, {drink.hot ? 'caliente' : 'frío'}</p>
        <ul className="chips" aria-label="Notas de cata">
          {drink.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </div>
    </article>
  )
}

export function LotCard({ lot }) {
  return (
    <article className="pcard pcard--lot">
      <Link to={`/catalogo/${lot.id}`} className="pcard__media pcard__media--lot" style={{ '--tint': lot.color }}>
        <CoffeeBag name={lot.name} color={lot.color} variant="sack" />
      </Link>
      <div className="pcard__body">
        <div className="pcard__title">
          <h3>
            <Link to={`/catalogo/${lot.id}`}>{lot.finca}</Link>
          </h3>
          <span className="sca">SCA {lot.sca}</span>
        </div>
        <p className="muted">
          {lot.variety}, {lot.process}, {lot.altitude.toLocaleString('en-US').replace(',', ' ')} msnm
        </p>
        <dl className="lot-stats">
          <div>
            <dt>Precio</dt>
            <dd>{fmtUSD(lot.pricePerKg)} / kg</dd>
          </div>
          <div>
            <dt>Pedido mínimo</dt>
            <dd>{lot.minSacks} sacos de 60 kg</dd>
          </div>
        </dl>
      </div>
    </article>
  )
}
