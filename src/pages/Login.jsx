import useTitle from '../useTitle'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Field from '../components/Field'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  useTitle('Ingresar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const onSubmit = async (ev) => {
    ev.preventDefault()
    const found = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) found.email = 'Escribe un correo válido.'
    if (!password) found.password = 'Escribe tu contraseña.'
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length) return
    setBusy(true)
    const res = await login(email, password)
    setBusy(false)
    if (!res.ok) return setFormError(res.error)
    navigate(location.state?.from || '/catalogo', { replace: true })
  }

  return (
    <div className="container auth">
      <div className="auth__intro">
        <h1 className="display-l">Ingresar</h1>
        <p className="lead">Entra para ver tus pedidos y comprar más rápido.</p>
      </div>
      <form className="auth__form" onSubmit={onSubmit} noValidate>
        <Field label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoComplete="email" />
        <Field
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          autoComplete="current-password"
        />
        {formError && (
          <p className="form-alert" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Ingresando...' : 'Ingresar'}
        </button>
        <p className="auth__alt">
          ¿Aún no tienes cuenta? <Link to="/registro" state={location.state}>Crear cuenta</Link>
        </p>
        <div className="dbx__ficha">
          <strong>Cuentas de demostración</strong>
          <span className="muted">Contraseña: demo123. Toca una para completar el formulario.</span>
          <div className="chips dbx__ejemplos">
            {[['Suscriptor', 'cliente@hauspe.pe'], ['Premium', 'premium@hauspe.pe'], ['HORECA', 'horeca@hauspe.pe'], ['Importador', 'import@nordicroasters.de']].map(([t, m]) => (
              <button key={m} type="button" className="pill" onClick={() => { setEmail(m); setPassword('demo123'); setErrors({}) }}>{t}</button>
            ))}
          </div>
        </div>
      </form>
    </div>
  )
}
