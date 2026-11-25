import useTitle from '../useTitle'
import { Link } from 'react-router-dom'
import { ArrowRight, QrCode } from '@phosphor-icons/react'
import CoffeeBag from '../components/CoffeeBag'
import HeroScene from '../components/HeroScene'
import { api, useDatos } from '../db/data'
import { retailProducts, drinks, fmtPEN } from '../data/products'

export default function Home() {
  useTitle('')
  // Cifras leídas de la base de datos (MySQL o, sin conexión, la base local); si falla, se muestran las de ejemplo
  const { data: c } = useDatos(() => api.cifrasInicio())
  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__copy">
            <p className="eyebrow">Café de Villa Rica, Pasco</p>
            <h1 className="display-xl">Una pausa con raíces</h1>
            <p className="lead">
              Café de especialidad de Villa Rica, tostado en Lima para tu taza o exportado en verde. Cada lote
              tiene su pasaporte: sabes qué finca lo cosechó y quién firmó cada etapa.
            </p>
            <div className="hero__cta">
              <Link to="/catalogo" className="btn btn--primary">
                Ver los cafés <ArrowRight size={18} />
              </Link>
              <Link to="/catalogo?tab=barra" className="btn btn--ghost">
                Ir a la cafetería
              </Link>
            </div>
          </div>
          <HeroScene />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="display-l measure">Tres cafés para tres momentos del día</h2>
          <p className="lead measure">
            Tostados en lotes pequeños. Eliges el molido y la frecuencia.{' '}
            <Link to="/catalogo" className="text-link">Ver los {retailProducts.length} cafés y las {drinks.length} bebidas</Link>
          </p>
          <ul className="trio">
            {retailProducts.slice(0, 3).map((p, i) => (
              <li key={p.id} className={`trio__item trio__item--${i + 1}`}>
                <Link to={`/catalogo/${p.id}`} className="trio__link">
                  <span className="trio__art" style={{ '--tint': p.color }}>
                    <CoffeeBag name={p.name} color={p.color} />
                  </span>
                  <span className="trio__text">
                    <span className="trio__name">{p.name}</span>
                    <span className="muted">{p.notes.join(', ')}</span>
                    <span className="trio__price">{fmtPEN(p.price)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="band">
        <div className="container band__grid">
          <div>
            <h2 className="display-l">Fincas distintas, una misma montaña</h2>
            <p className="lead">
              Trabajamos con familias cafetaleras de Villa Rica, entre 1 650 y 2 010 metros de altura. Pagamos por
              calidad y contamos de dónde viene cada lote.
            </p>
            <Link to="/historia" className="btn btn--light">
              Conocer el origen
            </Link>
          </div>
          <dl className="band__stats">
            <div>
              <dt>Fincas aliadas</dt>
              <dd>{c?.fincas ?? 6}</dd>
            </div>
            <div>
              <dt>Lotes con pasaporte</dt>
              <dd>{c?.lotes ?? 13}</dd>
            </div>
            <div>
              <dt>Etapas firmadas por inspectores</dt>
              <dd>{c?.firmas ?? 35}</dd>
            </div>
            <div>
              <dt>Mejor puntaje SCA</dt>
              <dd>{c?.sca ?? 87.5}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div className="split__col">
            <h2 className="display-m">Para tu casa o tu cafetería</h2>
            <p>
              Suscríbete y recibe tu café cada semana, cada quincena o cada mes con descuento. Si tienes un
              restaurante, hotel o cafetería (HORECA), te preparamos precios por volumen.
            </p>
            <Link to="/registro" className="btn btn--primary">
              Elegir mi cuenta
            </Link>
          </div>
          <div className="split__col split__col--offset">
            <h2 className="display-m">Para tostadores en el exterior</h2>
            <p>
              Exportamos café verde de fincas de Villa Rica. Viaja sin tostar para conservar su frescura y tú lo
              tuestas en destino. Cotiza en FOB o CIF.
            </p>
            <Link to="/catalogo?tab=b2b" className="btn btn--ghost">
              Ver lotes de exportación
            </Link>
          </div>
        </div>
      </section>

      <section className="section section--tight">
        <div className="container passport-teaser">
          <QrCode size={44} weight="light" aria-hidden="true" />
          <div>
            <h2 className="display-m">Escanea el QR de tu bolsa</h2>
            <p className="measure">
              Cada lote tiene un pasaporte digital con su finca, fechas de cosecha y tueste, y el registro del
              almacenamiento.
            </p>
          </div>
          <Link to="/qr/HP-ORI-0925" className="btn btn--ghost">
            Ver un pasaporte de ejemplo
          </Link>
        </div>
      </section>
    </>
  )
}
