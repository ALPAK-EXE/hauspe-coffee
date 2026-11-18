/* eslint-disable react-refresh/only-export-components */
import { useId } from 'react'
import { Link } from 'react-router-dom'

// Trazos del sello (viewBox 200 x 200), compartidos con la animación de entrada
export const SELLO = {
  banda:
    'M0 162 L52 142 C70 135 82 128 96 130 C108 132 114 140 124 138 C134 136 142 120 152 117 L200 138 L200 150 L152 130 C144 134 136 150 124 151 C112 152 106 144 96 143 C84 142 68 150 52 156 L0 176 Z',
  colina:
    'M0 176 L52 156 C68 150 84 142 96 143 C106 144 112 152 124 151 C136 150 144 134 152 130 L200 150 V200 H0 Z',
  ruta: 'M14 176 C26 156 38 142 58 137 C74 133 80 124 80 112',
}

const TEMAS = {
  oscuro: { fondo: '#2F4A3A', letra: '#F4F1EA', banda: '#F4F1EA', colina: '#4E7A5A', grano: '#D9B46A', surco: '#2F4A3A' },
  claro: { fondo: '#F4F1EA', letra: '#2F4A3A', banda: '#2F4A3A', colina: '#D9C9A8', grano: '#C79A45', surco: '#F4F1EA' },
}

// Sello de HausPe: la "h" en serif sobre las montañas de Villa Rica; el punto es un grano de café
export function LogoMark({ size = 44, light = false, className = 'logo__mark' }) {
  const t = TEMAS[light ? 'claro' : 'oscuro']
  const clip = useId()
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <circle cx="100" cy="100" r="100" />
        </clipPath>
      </defs>
      <circle className="sello__fondo" cx="100" cy="100" r="100" fill={t.fondo} />
      <g clipPath={`url(#${clip})`}>
        <path className="sello__colina" d={SELLO.colina} fill={t.colina} />
        <path className="sello__banda" d={SELLO.banda} fill={t.banda} />
        <path className="sello__ruta" d={SELLO.ruta} fill="none" stroke={t.banda} strokeWidth="4" strokeLinecap="round" pathLength="1" />
      </g>
      <text className="sello__h" x="98" y="114" textAnchor="middle" fontFamily="Cormorant Garamond, Georgia, serif" fontSize="104" fontWeight="600" fill={t.letra}>h</text>
      <g className="sello__grano" transform="translate(136 98) rotate(24)">
        <ellipse rx="11" ry="14" fill={t.grano} />
        <path d="M0 -12 C -5 -4 5 4 0 12" stroke={t.surco} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
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
