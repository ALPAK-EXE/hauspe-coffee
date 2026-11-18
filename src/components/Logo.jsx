import { Link } from 'react-router-dom'

// Sello de HausPe: la "h." de la Fase 1 con las montañas de Villa Rica en la base del círculo
export function LogoMark({ size = 44, light = false }) {
  const fondo = light ? '#F4F1EA' : '#2F4A3A'
  const letra = light ? '#2F4A3A' : '#F4F1EA'
  return (
    <svg className="logo__mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <clipPath id={light ? 'sello-l' : 'sello-d'}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="32" fill={fondo} />
      <g clipPath={`url(#${light ? 'sello-l' : 'sello-d'})`}>
        <path d="M0 52 L14 42 L22 47 L34 36 L46 46 L54 41 L64 48 V64 H0 Z" fill={light ? '#D9C9A8' : '#4E7A5A'} />
        <path d="M0 58 C16 52 30 54 44 57 C52 59 58 57 64 56 V64 H0 Z" fill={light ? '#C9B791' : '#3D6149'} />
      </g>
      <text x="31" y="38" textAnchor="middle" fontFamily="Cormorant Garamond, Georgia, serif" fontSize="30" fontWeight="600" fill={letra}>h.</text>
    </svg>
  )
}

export default function Logo({ light = false }) {
  return (
    <Link to="/" className={`logo${light ? ' logo--light' : ''}`} aria-label="HausPe Coffee, inicio">
      <LogoMark light={light} />
      <span className="logo__word">
        <span className="logo__name">hauspe</span>
        <span className="logo__sub">COFFEE</span>
      </span>
    </Link>
  )
}
