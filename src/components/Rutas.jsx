import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Rutas protegidas. La API vuelve a comprobar todo en el servidor: estas guardas solo evitan pantallas vacías.

/** Área de clientes (mi cuenta): exige sesión de cliente. */
export function SoloCliente({ children }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  if (!user) return <Navigate to="/login" state={{ from: pathname }} replace />
  return children
}

/** Panel /admin: exige sesión de personal. Un cliente es enviado al acceso del personal. */
export function SoloPersonal({ children }) {
  const { staff } = useAuth()
  const { pathname, search } = useLocation()
  if (!staff) return <Navigate to="/admin/login" state={{ from: pathname + search }} replace />
  return children
}

/** /operaciones era la dirección anterior del panel. */
export function RedirigirAlPanel() {
  const { search } = useLocation()
  return <Navigate to={{ pathname: '/admin', search }} replace />
}
