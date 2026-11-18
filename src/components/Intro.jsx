import { useEffect, useState } from 'react'
import { LogoMark } from './Logo'

const KEY = 'hauspe_intro_vista'

function yaSeVio() {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

// Entrada de la página: se arma el sello (círculo, montañas, ruta, la "h" y el grano que cae como punto),
// aparece el nombre y la cortina se abre. Una sola vez por visita; se puede saltar con clic o Esc.
export default function Intro() {
  const [fase, setFase] = useState(() => {
    if (typeof window === 'undefined') return 'fin'
    if (yaSeVio() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'fin'
    return 'armando'
  })

  useEffect(() => {
    if (fase === 'fin') {
      document.documentElement.classList.remove('intro-activa')
      return undefined
    }
    document.documentElement.classList.add('intro-activa')
    try {
      sessionStorage.setItem(KEY, '1')
    } catch {
      /* sin almacenamiento: se verá en cada carga */
    }
    if (fase === 'armando') {
      const t = setTimeout(() => setFase('saliendo'), 2700)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setFase('fin'), 750)
    return () => clearTimeout(t)
  }, [fase])

  useEffect(() => {
    if (fase === 'fin') return undefined
    const onKey = (e) => e.key === 'Escape' && setFase('saliendo')
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fase])

  if (fase === 'fin') return null
  return (
    <div className={`intro intro--${fase}`} onClick={() => setFase('saliendo')} role="presentation">
      <div className="intro__centro">
        <LogoMark size={190} className="intro__sello" />
        <p className="intro__marca" aria-label="HausPe Coffee">
          <span className="intro__nombre">hauspe</span>
          <span className="intro__sub">COFFEE</span>
        </p>
        <p className="intro__lema">Café de Villa Rica, de la finca a tu taza</p>
      </div>
      <button type="button" className="intro__saltar" onClick={() => setFase('saliendo')}>Saltar</button>
    </div>
  )
}
