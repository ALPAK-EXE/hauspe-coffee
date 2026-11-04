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
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const onSubmit = (ev) => {
    ev.preventDefault()
    const found = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) found.email = 'Escribe un correo válido.'
    if (!password) found.password = 'Escribe tu contraseña.'
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length) return
    const res = login(email, password)
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
        <button type="submit" className="btn btn--primary btn--block">
          Ingresar
        </button>
        <p className="auth__alt">
          ¿Aún no tienes cuenta? <Link to="/registro" state={location.state}>Crear cuenta</Link>
        </p>
      </form>
    </div>
  )
}
