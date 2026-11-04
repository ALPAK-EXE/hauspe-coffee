import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import useTitle from './useTitle'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Catalog from './pages/Catalog'
import ProductDetail from './pages/ProductDetail'
import Register from './pages/Register'
import Login from './pages/Login'
import History from './pages/History'
import Join from './pages/Join'
import Checkout from './pages/Checkout'
import Order from './pages/Order'
import QrPassport from './pages/QrPassport'
import Matcher from './pages/Matcher'
import Ops from './pages/Ops'
import Account from './pages/Account'

function NotFound() {
  useTitle('Página no encontrada')
  return (
    <div className="container page empty">
      <h1 className="display-l">Esta página no existe</h1>
      <p className="muted">La dirección que abriste no corresponde a ninguna sección de HausPe.</p>
      <Link to="/" className="btn btn--primary">Volver al inicio</Link>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/catalogo" element={<Catalog />} />
              <Route path="/catalogo/:id" element={<ProductDetail />} />
              <Route path="/registro" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/historia" element={<History />} />
              <Route path="/sumate" element={<Join />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/pedido/:id" element={<Order />} />
              <Route path="/qr/:codigo" element={<QrPassport />} />
              <Route path="/matcher" element={<Matcher />} />
              <Route path="/operaciones" element={<Ops />} />
              <Route path="/mi-cuenta" element={<Account />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </CartProvider>
      </AuthProvider>
    </HashRouter>
  )
}
