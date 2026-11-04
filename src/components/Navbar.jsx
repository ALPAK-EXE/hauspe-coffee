import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { List, X, ShoppingBag, SignOut, UserCircle } from '@phosphor-icons/react'
import Logo from './Logo'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

const LINKS = [
  { to: '/catalogo', label: 'Cafés' },
  { to: '/historia', label: 'Nuestro origen' },
  { to: '/sumate', label: 'Súmate' },
]

export default function Navbar() {
  const [menu, setMenu] = useState(false)
  const { user, logout } = useAuth()
  const { totals, setOpen, clear } = useCart()
  const { pathname } = useLocation()

  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setMenu(false)
  }

  const firstName = user?.name?.split(' ')[0]

  // Esc cierra el menú móvil
  useEffect(() => {
    if (!menu) return
    const onKey = (e) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menu])

  // Al cerrar sesión se vacía el carrito para no dejarlo a la vista de otra persona en el mismo equipo
  const handleLogout = () => {
    logout()
    clear()
    setMenu(false)
  }

  return (
    <header className="nav">
      <div className="container nav__inner">
        <Logo />

        {menu && <div className="nav__scrim" onClick={() => setMenu(false)} aria-hidden="true" />}
        <nav id="menu-principal" className={`nav__links${menu ? ' is-open' : ''}`} aria-label="Principal">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className="nav__link">
              {l.label}
            </NavLink>
          ))}
          {user && (
            <NavLink to="/mi-cuenta" className="nav__link">
              Mi cuenta
            </NavLink>
          )}
          <NavLink to="/operaciones" className="nav__link nav__link--internal">
            Panel interno
          </NavLink>
          <Link to="/sumate#novedades" className="btn btn--primary btn--sm nav__cta">
            Recibe novedades
          </Link>
          <div className="nav__auth nav__auth--mobile">
            <AuthArea user={user} firstName={firstName} logout={handleLogout} />
          </div>
        </nav>

        <div className="nav__actions">
          <div className="nav__auth nav__auth--desktop">
            <AuthArea user={user} firstName={firstName} logout={handleLogout} />
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setOpen(true)}
            aria-label={`Abrir carrito, ${totals.count} productos`}
          >
            <ShoppingBag size={22} weight="regular" />
            {totals.count > 0 && <span className="icon-btn__badge">{totals.count}</span>}
          </button>
          <button
            type="button"
            className="icon-btn nav__burger"
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-controls="menu-principal"
            aria-label={menu ? 'Cerrar menú' : 'Abrir menú'}
          >
            {menu ? <X size={22} /> : <List size={22} />}
          </button>
        </div>
      </div>
    </header>
  )
}

function AuthArea({ user, firstName, logout }) {
  if (!user) {
    return (
      <Link to="/login" className="nav__link nav__user">
        <UserCircle size={20} />
        Ingresar
      </Link>
    )
  }
  return (
    <>
      <span className="nav__user" title={user.email}>
        <UserCircle size={20} />
        <span>
          Hola, {firstName}
          <small>{user.segment === 'b2c' ? 'Suscriptor' : user.businessType}</small>
        </span>
      </span>
      <button type="button" className="btn btn--ghost btn--sm" onClick={logout}>
        <SignOut size={16} />
        Cerrar sesión
      </button>
    </>
  )
}
