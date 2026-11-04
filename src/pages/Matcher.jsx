import { useState } from 'react'
import { Link } from 'react-router-dom'
import useTitle from '../useTitle'
import CoffeeBag from '../components/CoffeeBag'
import { getTaste, saveTaste } from '../data/ops'
import { PROFILES, fmtPEN, getProduct, retailProducts } from '../data/products'

const METHODS = [
  { id: 'espresso', label: 'Espresso', grind: 'Espresso', level: 3 },
  { id: 'filtro', label: 'Filtro (V60, Chemex)', grind: 'Filtro (V60 / Chemex)', level: 2 },
  { id: 'prensa', label: 'Prensa francesa', grind: 'Prensa francesa', level: 3 },
  { id: 'leche', label: 'Con leche', grind: 'Espresso', level: 4 },
]
const INTENSITIES = [
  { id: 'suave', label: 'Suave', level: 2 },
  { id: 'media', label: 'Media', level: 3 },
  { id: 'intensa', label: 'Intensa', level: 4 },
]

// Puntaje de cada café según las respuestas
function recommend({ method, profile, intensity }) {
  const m = METHODS.find((x) => x.id === method)
  const n = INTENSITIES.find((x) => x.id === intensity)
  const scored = retailProducts.map((p) => {
    let score = 0
    if (p.profiles[0] === profile) score += 3
    else if (p.profiles.includes(profile)) score += 1.5
    score += Math.max(0, 2 - Math.abs(p.roastLevel - n.level))
    score += Math.max(0, 1 - Math.abs(p.roastLevel - m.level) * 0.5)
    return { p, score }
  })
  return scored.sort((a, b) => b.score - a.score)[0].p
}

function Choice({ legend, name, options, value, onChange }) {
  return (
    <fieldset className="buy__plans matcher__q">
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={o.id} className={`plan${value === o.id ? ' is-on' : ''}`}>
          <input type="radio" name={name} checked={value === o.id} onChange={() => onChange(o.id)} />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  )
}

export default function Matcher() {
  useTitle('Encuentra tu café')
  const saved = getTaste()
  const [answers, setAnswers] = useState({ method: '', profile: '', intensity: '' })
  const [result, setResult] = useState(saved)
  const [error, setError] = useState('')

  const set = (key) => (value) => {
    setAnswers((a) => ({ ...a, [key]: value }))
    setError('')
  }

  const onSubmit = (ev) => {
    ev.preventDefault()
    if (!answers.method || !answers.profile || !answers.intensity) {
      setError('Responde las tres preguntas para ver tu recomendación.')
      return
    }
    const product = recommend(answers)
    const taste = { ...answers, productId: product.id, at: Date.now() }
    saveTaste(taste)
    setResult(taste)
  }

  const product = result ? getProduct(result.productId) : null
  const method = result ? METHODS.find((m) => m.id === result.method) : null

  return (
    <div className="container page">
      <header className="page__head">
        <h1 className="display-l">Encuentra tu café</h1>
        <p className="lead measure">Tres preguntas sobre cómo lo preparas y qué sabor te gusta. Guardamos tu perfil de sabor.</p>
      </header>

      <div className="matcher">
        <form className="matcher__form" onSubmit={onSubmit} noValidate>
          <Choice legend="¿Cómo lo preparas?" name="method" options={METHODS} value={answers.method} onChange={set('method')} />
          <Choice
            legend="¿Qué sabor prefieres?"
            name="profile"
            options={PROFILES.map((p) => ({ id: p, label: p }))}
            value={answers.profile}
            onChange={set('profile')}
          />
          <Choice legend="¿Qué intensidad?" name="intensity" options={INTENSITIES} value={answers.intensity} onChange={set('intensity')} />
          {error && <p className="form-alert" role="alert">{error}</p>}
          <button type="submit" className="btn btn--primary">Ver mi café</button>
        </form>

        {product && (
          <section className="matcher__result" aria-live="polite" aria-label="Tu recomendación">
            <p className="eyebrow">TU PERFIL: {result.profile.toUpperCase()}, {result.intensity.toUpperCase()}</p>
            <div className="matcher__card" style={{ '--tint': product.color }}>
              <CoffeeBag name={product.name} color={product.color} />
            </div>
            <h2 className="display-m">{product.name}</h2>
            <p className="muted">
              {product.notes.join(', ')}. Para {method.label.toLowerCase()}, te sugerimos molienda {method.grind.toLowerCase()}.
            </p>
            <p><strong>{fmtPEN(product.price)}</strong> por {product.weight}</p>
            <Link to={`/catalogo/${product.id}`} className="btn btn--primary">Ver {product.name}</Link>
          </section>
        )}
      </div>
    </div>
  )
}
