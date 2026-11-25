import { Link, Outlet, useNavigate } from 'react-router-dom'
import { SignOut, UserCircle } from '@phosphor-icons/react'
import Logo from './Logo'
import { useAuth } from '../context/AuthContext'
import { ETIQUETA_ROL } from '../permisos.js'

// Marco del área administrativa: barra propia con nombre, rol y cierre de sesión (separada de la tienda)
export default function AdminLayout() {
  const { staff, logout } = useAuth()
  const navigate = useNavigate()
  const salir = async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }
  return (
    <>
      <header className="adminbar">
        <div className="container adminbar__inner">
          <div className="adminbar__brand">
            <Logo light />
            <span className="adminbar__tag">Área del personal</span>
          </div>
          {staff ? (
            <div className="adminbar__user">
              <span className="adminbar__who">
                <UserCircle size={22} />
                <span>
                  <strong>{staff.name}</strong>
                  <small>{ETIQUETA_ROL[staff.rol] || staff.rol} · {staff.codigo}</small>
                </span>
              </span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={salir}>
                <SignOut size={16} /> Cerrar sesión
              </button>
            </div>
          ) : (
            <Link to="/" className="text-link">Volver a la tienda</Link>
          )}
        </div>
      </header>
      <main id="contenido" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  )
}
