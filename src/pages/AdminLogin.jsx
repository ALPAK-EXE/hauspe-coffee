import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import useTitle from '../useTitle'
import Field from '../components/Field'
import { useAuth } from '../context/AuthContext'

const DEMO = [
  ['Administrador', 'admin@hauspe.pe'],
  ['Barista', 'barista@hauspe.pe'],
  ['Dark store', 'almacen@hauspe.pe'],
  ['Inspector', 'inspector@hauspe.pe'],
]

// Acceso del personal (tabla Empleado). Los clientes ingresan por /login.
export default function AdminLogin() {
  useTitle('Acceso del personal')
  const { staff, user, loginStaff } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  if (staff) return <Navigate to={location.state?.from || '/admin'} replace />

  const onSubmit = async (ev) => {
    ev.preventDefault()
    const found = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) found.email = 'Escribe un correo válido.'
    if (!password) found.password = 'Escribe tu contraseña.'
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length) return
    setBusy(true)
    const res = await loginStaff(email, password)
    setBusy(false)
    if (!res.ok) return setFormError(res.error)
    navigate(location.state?.from || '/admin', { replace: true })
  }

  return (
    <div className="container auth">
      <div className="auth__intro">
        <h1 className="display-l">Acceso del personal</h1>
        <p className="lead">Panel interno de HausPe: barista, dark store, trazabilidad y administración.</p>
        {user && <p className="notice notice--warn" role="status">Tienes una sesión de cliente abierta. Esta área es solo para el personal; al ingresar aquí se cerrará esa sesión.</p>}
      </div>
      <form className="auth__form" onSubmit={onSubmit} noValidate>
        <Field label="Correo del personal" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoComplete="username" />
        <Field label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} autoComplete="current-password" />
        {formError && <p className="form-alert" role="alert">{formError}</p>}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>{busy ? 'Ingresando...' : 'Ingresar al panel'}</button>
        <p className="auth__alt">¿Eres cliente? <Link to="/login">Ingresa a la tienda</Link></p>
        <div className="dbx__ficha">
          <strong>Cuentas de demostración del personal</strong>
          <span className="muted">Contraseña: admin123. Toca una para completar el formulario.</span>
          <div className="chips dbx__ejemplos">
            {DEMO.map(([t, m]) => (
              <button key={m} type="button" className="pill" onClick={() => { setEmail(m); setPassword('admin123'); setErrors({}) }}>{t}</button>
            ))}
          </div>
        </div>
      </form>
    </div>
  )
}
