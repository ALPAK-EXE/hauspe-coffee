import useTitle from '../useTitle'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Field from '../components/Field'
import { useAuth } from '../context/AuthContext'

const COUNTRIES = ['Perú', 'Estados Unidos', 'Alemania', 'Países Bajos', 'España', 'Japón', 'Corea del Sur', 'Chile', 'Otro']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validate(values, segment) {
  const e = {}
  if (values.name.trim().length < 2) e.name = 'Escribe tu nombre completo.'
  if (!EMAIL_RE.test(values.email.trim())) e.email = 'Escribe un correo válido, por ejemplo nombre@correo.com.'
  if (values.password.length < 6) e.password = 'La contraseña debe tener al menos 6 caracteres.'
  const digits = values.whatsapp.replace(/\D/g, '')
  if (!/^\+?[\d\s-]+$/.test(values.whatsapp.trim()) || digits.length < 9 || digits.length > 15)
    e.whatsapp = 'Escribe solo números, de 9 a 15 dígitos, con código de país (51987654321).'
  if (segment === 'b2b') {
    if (values.company.trim().length < 2) e.company = 'Escribe el nombre de la empresa.'
    if (values.country === 'Perú') {
      if (!/^(10|15|17|20)\d{9}$/.test(values.taxId.trim())) e.taxId = 'El RUC tiene 11 dígitos y empieza con 10, 15, 17 o 20.'
    } else if (values.taxId.trim().length < 5) {
      e.taxId = 'Escribe el Tax ID de tu empresa (mínimo 5 caracteres).'
    }
    if (!values.country) e.country = 'Elige el país.'
    if (!values.businessType) e.businessType = 'Elige el tipo de empresa.'
    else if (values.country === 'Perú' && values.businessType !== 'HORECA')
      e.businessType = 'Una empresa en Perú se registra como HORECA.'
    else if (values.country !== 'Perú' && values.businessType !== 'Importador extranjero')
      e.businessType = 'Una empresa fuera del Perú se registra como Importador extranjero.'
  }
  return e
}

export default function Register() {
  useTitle('Crear cuenta')
  const [params] = useSearchParams()
  const [segment, setSegment] = useState(params.get('tipo') === 'b2b' ? 'b2b' : 'b2c')
  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    whatsapp: '',
    company: '',
    taxId: '',
    country: 'Perú',
    businessType: 'HORECA',
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const { register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const set = (key) => (ev) => {
    const value = ev.target.value
    setValues((v) => ({
      ...v,
      [key]: value,
      // El tipo de empresa sigue al país: Perú = HORECA, exterior = Importador extranjero
      ...(key === 'country' ? { businessType: value === 'Perú' ? 'HORECA' : 'Importador extranjero' } : {}),
    }))
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }

  const onSubmit = async (ev) => {
    ev.preventDefault()
    const found = validate(values, segment)
    setErrors(found)
    if (Object.keys(found).length) return
    const payload = {
      segment,
      name: values.name.trim(),
      email: values.email,
      password: values.password,
      whatsapp: values.whatsapp.trim(),
    }
    if (segment === 'b2b') {
      Object.assign(payload, {
        company: values.company.trim(),
        taxId: values.taxId.trim(),
        country: values.country,
        businessType: values.businessType,
      })
    }
    const res = await register(payload)
    if (!res.ok) return setFormError(res.error)
    navigate(location.state?.from || '/catalogo', { replace: true })
  }

  const exporterChoice = values.country !== 'Perú'

  return (
    <div className="container auth">
      <div className="auth__intro">
        <h1 className="display-l">Crea tu cuenta</h1>
        <p className="lead">Elige cómo vas a comprar. Puedes cambiarlo creando otra cuenta más adelante.</p>
      </div>

      <form className="auth__form" onSubmit={onSubmit} noValidate>
        <fieldset className="segment">
          <legend>Tipo de cliente</legend>
          <label className={`segment__opt${segment === 'b2c' ? ' is-on' : ''}`}>
            <input type="radio" name="segment" checked={segment === 'b2c'} onChange={() => setSegment('b2c')} />
            <strong>Suscriptor</strong>
            <span>Café tostado para mi casa</span>
          </label>
          <label className={`segment__opt${segment === 'b2b' ? ' is-on' : ''}`}>
            <input type="radio" name="segment" checked={segment === 'b2b'} onChange={() => setSegment('b2b')} />
            <strong>Empresa</strong>
            <span>HORECA o exportación de café verde</span>
          </label>
        </fieldset>

        <Field label="Nombre completo" value={values.name} onChange={set('name')} error={errors.name} autoComplete="name" />
        <Field label="Correo" type="email" value={values.email} onChange={set('email')} error={errors.email} autoComplete="email" />
        <Field
          label="Contraseña"
          type="password"
          value={values.password}
          onChange={set('password')}
          error={errors.password}
          hint="Mínimo 6 caracteres."
          autoComplete="new-password"
        />
        <Field
          label="WhatsApp"
          type="tel"
          inputMode="numeric"
          value={values.whatsapp}
          onChange={set('whatsapp')}
          error={errors.whatsapp}
          hint="Con código de país, por ejemplo 51987654321."
          autoComplete="tel"
        />

        {segment === 'b2b' && (
          <>
            <Field label="Empresa" value={values.company} onChange={set('company')} error={errors.company} autoComplete="organization" />
            <div className="auth__row">
              <Field label="País" as="select" value={values.country} onChange={set('country')} error={errors.country}>
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Field>
              <Field
                label={values.country === 'Perú' ? 'RUC' : 'Tax ID'}
                value={values.taxId}
                onChange={set('taxId')}
                error={errors.taxId}
                inputMode={values.country === 'Perú' ? 'numeric' : 'text'}
                maxLength={values.country === 'Perú' ? 11 : 30}
                autoComplete="off"
              />
            </div>
            <Field label="Tipo de empresa" as="select" value={values.businessType} onChange={set('businessType')} error={errors.businessType}>
              {exporterChoice ? (
                <option value="Importador extranjero">Importador extranjero (compra café verde)</option>
              ) : (
                <option value="HORECA">HORECA (hotel, restaurante o cafetería)</option>
              )}
            </Field>
            <p className="field__hint">
              {exporterChoice
                ? 'Podrás pedir cotizaciones FOB o CIF de café verde. La tienda en soles es solo para Perú.'
                : 'Comprarás en la tienda con Yape y recibirás factura. Para importar café verde, elige un país del exterior.'}
            </p>
          </>
        )}

        {formError && (
          <p className="form-alert" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block">
          Crear cuenta
        </button>
        <p className="auth__alt">
          ¿Ya tienes cuenta? <Link to="/login" state={location.state}>Ingresar</Link>
        </p>
      </form>
    </div>
  )
}
