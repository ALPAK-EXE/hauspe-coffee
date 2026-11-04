import useTitle from '../useTitle'
import { Link } from 'react-router-dom'
import { greenLots } from '../data/products'

export default function History() {
  useTitle('Nuestro origen')
  return (
    <div className="container page">
      <header className="page__head">
        <h1 className="display-xl">Nuestro origen</h1>
        <p className="lead measure">
          HausPe nace en Villa Rica, la capital cafetalera de Pasco, en la selva central del Perú. Conectamos a
          familias productoras con tostadores y con quienes toman café todos los días.
        </p>
      </header>

      <div className="prose-grid">
        <section>
          <h2 className="display-m">Qué hacemos</h2>
          <p>
            Compramos café en cereza y en pergamino a fincas de la zona, lo evaluamos con puntaje SCA y lo separamos
            por lote. Una parte se tuesta en Lima para la tienda. El resto se exporta verde, sin tostar, para que
            llegue fresco a los tostadores del exterior.
          </p>
        </section>
        <section>
          <h2 className="display-m">Por qué verde</h2>
          <p>
            El café tostado pierde aroma en pocas semanas. El grano verde se conserva meses si se almacena bien. Por
            eso el comprador lo tuesta en destino y HausPe actúa como intermediario de exportación entre la finca y
            su tostadora.
          </p>
        </section>
      </div>

      <section className="fincas">
        <h2 className="display-m">Las fincas</h2>
        <ul className="fincas__list">
          {greenLots.map((l) => (
            <li key={l.id}>
              <Link to={`/catalogo/${l.id}`}>
                <span className="fincas__name">{l.finca}</span>
                <span className="muted">
                  {l.productor}, {l.altitude.toLocaleString('en-US').replace(',', ' ')} msnm
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
