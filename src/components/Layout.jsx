import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import CartDrawer from './CartDrawer'
import Intro from './Intro'
import ModoAviso from './ModoAviso'

function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        el.scrollIntoView()
        return
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, hash])
  return null
}

export default function Layout() {
  return (
    <>
      <Intro />
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
      <ScrollManager />
      <Navbar />
      <main id="contenido" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <ModoAviso />
    </>
  )
}
