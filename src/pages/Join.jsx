import useTitle from '../useTitle'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Field from '../components/Field'
import { load, save } from '../context/storage'

export default function Join() {
  useTitle('Súmate')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const onSubmit = (ev) => {
    ev.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Escribe un correo válido, por ejemplo nombre@correo.com.')
      return
    }
    save('hauspe_newsletter', [...new Set([...load('hauspe_newsletter', []), email.trim().toLowerCase()])])
    setError('')
    setDone(true)
  }

  return (
    <div className="container page">
      <header className="page__head">
        <h1 className="display-xl">Súmate</h1>
        <p className="lead measure">Hay tres formas de ser parte de HausPe.</p>
      </header>

      <ol className="ways">
        <li>
          <h2 className="display-m">Toma café con suscripción</h2>
          <p>Recibe tu café cada semana, quincena o mes, con hasta 15% de descuento.</p>
          <Link to="/registro" className="text-link">Crear cuenta de suscriptor</Link>
        </li>
        <li>
          <h2 className="display-m">Sirve nuestro café en tu local</h2>
          <p>Para hoteles, restaurantes y cafeterías. Precios por volumen y entregas programadas.</p>
          <Link to="/registro?tipo=b2b" className="text-link">Crear cuenta HORECA</Link>
        </li>
        <li>
          <h2 className="display-m">Importa café verde</h2>
          <p>Lotes de fincas de Villa Rica con cotización FOB o CIF a tu país.</p>
          <Link to="/registro?tipo=b2b" className="text-link">Crear cuenta de importador</Link>
        </li>
      </ol>

      <section id="novedades" className="newsletter">
        <h2 className="display-m">Recibe novedades</h2>
        <p className="measure">Te avisamos cuando haya cosecha nueva o lotes de exportación disponibles.</p>
        {done ? (
          <p className="form-ok" role="status">Listo, te escribiremos a {email.trim()}.</p>
        ) : (
          <form onSubmit={onSubmit} noValidate className="newsletter__form">
            <Field label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} autoComplete="email" />
            <button type="submit" className="btn btn--primary">Recibir novedades</button>
          </form>
        )}
      </section>
    </div>
  )
}
