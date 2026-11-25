import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { List, SignOut, X } from '@phosphor-icons/react'
import Logo from './Logo'
import { Btn } from './admin/ui'
import { useAuth } from '../context/AuthContext'
import { ETIQUETA_ROL } from '../permisos.js'
import { useDatos, useModo } from '../db/data'
import { GRUPOS, SECCIONES, iniciales, rutaDe, seccionesDe } from '../pages/admin/util'
import '../admin.css'

// Marco del área del personal: barra lateral fija (menú en móvil), barra superior con estado y contenido.
export default function AdminLayout() {
  const { staff, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { modo, health } = useModo()
  const [abierto, setAbierto] = useState(false)
  const menuRef = useRef(null)
  const botonRef = useRef(null)
  // La hora de la última lectura de datos: cambia cada vez que la sección vuelve a leer la base
  const ultima = useDatos(() => Date.now(), [pathname]).data

  useEffect(() => {
    if (!abierto) return undefined
    const esc = (e) => {
      if (e.key !== 'Escape') return
      setAbierto(false)
      botonRef.current?.focus()
    }
    window.addEventListener('keydown', esc)
    menuRef.current?.querySelector('a')?.focus()
    return () => window.removeEventListener('keydown', esc)
  }, [abierto])

  const salir = async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  // Sin sesión (acceso del personal): marco simple, sin menú
  if (!staff) {
    return (
      <>
        <header className="adm-login-bar">
          <Logo light />
          <span>Área del personal</span>
          <Link to="/" className="text-link">Volver a la tienda</Link>
        </header>
        <main id="contenido" tabIndex={-1}>
          <Outlet />
        </main>
      </>
    )
  }

  const visibles = seccionesDe(staff)
  const actual = SECCIONES.find((s) => (s.slug ? pathname === `/admin/${s.slug}` : pathname === '/admin' || pathname === '/admin/')) || visibles[0]
  const etiquetaModo = modo === 'remoto'
    ? `MySQL ${(health?.version || '8.0').split('.').slice(0, 2).join('.')} · Prisma`
    : modo === 'local' ? 'Modo sin conexión' : 'Conectando...'

  return (
    <div className="adm">
      <button
        type="button"
        className="skip"
        onClick={() => {
          const main = document.getElementById('contenido')
          main?.focus()
          main?.scrollIntoView()
        }}
      >
        Saltar al contenido
      </button>
      <div className={`a-scrim${abierto ? ' is-open' : ''}`} onClick={() => setAbierto(false)} aria-hidden="true" />
      <aside id="a-menu" ref={menuRef} className={`a-side${abierto ? ' is-open' : ''}`} aria-label="Menú del panel">
        <div className="a-side__brand">
          <Logo light />
          <span className="a-side__tag">Área del personal</span>
        </div>
        <nav className="a-nav" aria-label="Secciones">
          {GRUPOS.map((g) => {
            const items = visibles.filter((s) => s.grupo === g)
            if (!items.length) return null
            return (
              <div key={g} className="a-nav__group">
                {g !== 'Inicio' && <span className="a-nav__title">{g}</span>}
                {items.map(({ id, label, Icon, ...s }) => (
                  <NavLink key={id} to={rutaDe(s)} end onClick={() => setAbierto(false)}>
                    <Icon size={20} aria-hidden="true" />
                    {label}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>
        <div className="a-user">
          <div className="a-user__who">
            <span className="a-user__av" aria-hidden="true">{iniciales(staff.name)}</span>
            <div>
              <strong>{staff.name}</strong>
              <small>{ETIQUETA_ROL[staff.rol] || staff.rol} · {staff.codigo}</small>
            </div>
          </div>
          <Btn variante="ghost" size="sm" onClick={salir}><SignOut size={16} aria-hidden="true" /> Cerrar sesión</Btn>
        </div>
      </aside>

      <div className="a-main">
        <header className="a-top">
          <button
            type="button"
            ref={botonRef}
            className="a-iconbtn a-top__menu"
            aria-label={abierto ? 'Cerrar el menú' : 'Abrir el menú'}
            aria-expanded={abierto}
            aria-controls="a-menu"
            onClick={() => setAbierto((a) => !a)}
          >
            {abierto ? <X size={22} /> : <List size={22} />}
          </button>
          <div className="a-top__title">
            <h1>{actual?.label || 'Panel'}</h1>
            <p>{actual?.desc}</p>
          </div>
          <div className="a-top__meta">
            <span className={`a-conn${modo === 'remoto' ? '' : ' a-conn--off'}`} role="status">{etiquetaModo}</span>
            <span className="a-top__time">
              {ultima ? `Actualizado ${new Date(ultima).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
            </span>
          </div>
        </header>
        <main id="contenido" tabIndex={-1} className="a-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
