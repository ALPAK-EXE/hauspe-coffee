import useTitle from '../useTitle'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RetailCard, LotCard, DrinkCard } from '../components/ProductCard'
import { retailProducts, greenLots, drinks, PROFILES, ROASTS } from '../data/products'

export default function Catalog() {
  useTitle('Cafés')
  const [params, setParams] = useSearchParams()
  const tab = ['b2b', 'barra', 'horeca'].includes(params.get('tab')) ? params.get('tab') : 'b2c'
  const profile = params.get('perfil') || 'Todos'
  const roast = params.get('tueste') || 'Todos'
  const variety = params.get('variedad') || 'Todas'
  const process = params.get('proceso') || 'Todos'

  const setParam = (key, value, all) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === all) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  const setTab = (t) => setParams(t === 'b2c' ? {} : { tab: t }, { replace: true })

  const retail = useMemo(
    () =>
      retailProducts.filter(
        (p) => (profile === 'Todos' || p.profiles.includes(profile)) && (roast === 'Todos' || p.roast === roast),
      ),
    [profile, roast],
  )
  const lots = useMemo(
    () =>
      greenLots.filter(
        (l) => (variety === 'Todas' || l.variety === variety) && (process === 'Todos' || l.process === process),
      ),
    [variety, process],
  )

  const varieties = [...new Set(greenLots.map((l) => l.variety))]
  const processes = [...new Set(greenLots.map((l) => l.process))]

  return (
    <div className="container page">
      <header className="page__head">
        <h1 className="display-l">Cafés</h1>
        <p className="lead measure">
          {tab === 'b2c'
            ? 'Café tostado para tu casa. Elige el molido y recíbelo cuando quieras.'
            : tab === 'horeca'
              ? 'Presentaciones de 1 kg para cafeterías, restaurantes y hoteles. Factura con RUC y reposición programada.'
              : tab === 'barra'
              ? 'Las bebidas de nuestra barra, con la receta y el gramaje de cada insumo.'
              : 'Café verde sin tostar de fincas de Villa Rica. HausPe exporta por ti y el grano llega fresco a tu tostadora.'}
        </p>
      </header>

      {tab === 'b2c' && (
        <p className="muted catalog__matcher">
          ¿No sabes cuál elegir? <Link to="/matcher" className="text-link">Encuentra tu café en 3 preguntas</Link>
        </p>
      )}
      <div className="tabs" role="tablist" aria-label="Tipo de catálogo">
        <button role="tab" aria-selected={tab === 'b2c'} className="tabs__tab" onClick={() => setTab('b2c')}>
          Tienda
        </button>
        <button role="tab" aria-selected={tab === 'barra'} className="tabs__tab" onClick={() => setTab('barra')}>
          Cafetería
        </button>
        <button role="tab" aria-selected={tab === 'horeca'} className="tabs__tab" onClick={() => setTab('horeca')}>
          HORECA
        </button>
        <button role="tab" aria-selected={tab === 'b2b'} className="tabs__tab" onClick={() => setTab('b2b')}>
          Exportación
        </button>
      </div>

      {tab === 'horeca' ? (
        <div className="grid grid--3">
          {retailProducts.map((p) => <RetailCard key={p.id} product={p} pres="1kg" />)}
        </div>
      ) : tab === 'barra' ? (
        <div className="grid grid--3">
          {drinks.map((d) => <DrinkCard key={d.id} drink={d} />)}
        </div>
      ) : tab === 'b2c' ? (
        <>
          <div className="filters">
            <FilterGroup label="Perfil" options={['Todos', ...PROFILES]} value={profile} onChange={(v) => setParam('perfil', v, 'Todos')} />
            <FilterGroup label="Tueste" options={['Todos', ...ROASTS]} value={roast} onChange={(v) => setParam('tueste', v, 'Todos')} />
          </div>
          {retail.length ? (
            <div className="grid grid--3">
              {retail.map((p) => (
                <RetailCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <Empty onReset={() => setParams({}, { replace: true })} />
          )}
        </>
      ) : (
        <>
          <div className="notice">
            <strong>Cómo funciona.</strong> El café viaja verde para conservar su frescura. Tú lo tuestas en tu
            país; HausPe coordina la compra con la finca, la exportación y el embarque.
          </div>
          <div className="filters">
            <FilterGroup label="Variedad" options={['Todas', ...varieties]} value={variety} onChange={(v) => setParam('variedad', v, 'Todas')} />
            <FilterGroup label="Proceso" options={['Todos', ...processes]} value={process} onChange={(v) => setParam('proceso', v, 'Todos')} />
          </div>
          {lots.length ? (
            <div className="grid grid--3">
              {lots.map((l) => (
                <LotCard key={l.id} lot={l} />
              ))}
            </div>
          ) : (
            <Empty onReset={() => setParams({ tab: 'b2b' }, { replace: true })} />
          )}
        </>
      )}
    </div>
  )
}

function FilterGroup({ label, options, value, onChange }) {
  return (
    <div className="filter" role="group" aria-label={label}>
      <span className="filter__label">{label}</span>
      <div className="filter__opts">
        {options.map((o) => (
          <button key={o} type="button" className="pill" aria-pressed={value === o} onClick={() => onChange(o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

function Empty({ onReset }) {
  return (
    <div className="empty">
      <p className="display-s">Ningún café con esa combinación</p>
      <p className="muted">Prueba con otro perfil o quita los filtros.</p>
      <button type="button" className="btn btn--ghost" onClick={onReset}>
        Quitar filtros
      </button>
    </div>
  )
}
