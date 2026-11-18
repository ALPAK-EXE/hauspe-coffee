// Ilustración de bolsa de café (tostado) o saco de yute (café verde) en SVG puro
import { cells } from './FakeQr'

// QR impreso en el empaque: lleva al pasaporte digital del lote
function QrEmpaque({ x, y, size, seed }) {
  const k = size / 27
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <rect width={size} height={size} rx="2" fill="#fff" />
      <g transform={`translate(${k} ${k}) scale(${k})`} fill="#1F2A24" shapeRendering="crispEdges">
        {cells(seed).map(([cx, cy]) => <rect key={`${cx}-${cy}`} x={cx} y={cy} width="1" height="1" />)}
        {[[0, 0], [18, 0], [0, 18]].map(([fx, fy]) => (
          <g key={`${fx}-${fy}`} transform={`translate(${fx} ${fy})`}>
            <rect width="7" height="7" />
            <rect x="1" y="1" width="5" height="5" fill="#fff" />
            <rect x="2" y="2" width="3" height="3" />
          </g>
        ))}
      </g>
    </g>
  )
}

export default function CoffeeBag({ name, color = '#2F4A3A', variant = 'bag', caption, weight = '250 G', className = '' }) {
  if (variant === 'sack') {
    return (
      <svg
        className={`bag ${className}`}
        viewBox="0 0 200 250"
        role="img"
        aria-label={`Saco de café verde ${name}`}
      >
        <ellipse cx="100" cy="240" rx="68" ry="6" fill="#2F4A3A" opacity="0.12" />
        <path
          d="M52 40 C60 28 140 28 148 40 L168 70 C176 110 178 170 166 224 C150 234 50 234 34 224 C22 170 24 110 32 70 Z"
          fill="#CDB892"
        />
        <path
          d="M52 40 C60 52 140 52 148 40 L152 56 C130 66 70 66 48 56 Z"
          fill="#B89E74"
        />
        <path d="M76 36 C90 44 110 44 124 36" stroke="#8C7550" strokeWidth="3" fill="none" />
        <g stroke="#B49B72" strokeWidth="1" opacity="0.6">
          {Array.from({ length: 14 }, (_, i) => (
            <line key={i} x1={40 + i * 9.5} y1="72" x2={40 + i * 9.5} y2="226" />
          ))}
        </g>
        <rect x="58" y="96" width="84" height="94" rx="6" fill="#F4F1EA" />
        <rect x="58" y="96" width="84" height="10" rx="2" fill={color} />
        <text x="100" y="130" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontSize={name.length > 10 ? 15 : 19} fontWeight="500" fill="#2F4A3A">
          {name}
        </text>
        <text x="100" y="148" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="7" letterSpacing="1.4" fill="#5B6B5F">
          CAFÉ VERDE
        </text>
        <text x="100" y="176" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="9" fontWeight="600" fill="#2F4A3A">
          {caption || '60 kg'}
        </text>
        <QrEmpaque x={150} y={196} size={24} seed={`saco-${name}`} />
      </svg>
    )
  }
  return (
    <svg className={`bag ${className}`} viewBox="0 0 200 260" role="img" aria-label={`Bolsa de café ${name}`}>
      <ellipse cx="100" cy="250" rx="62" ry="6" fill="#2F4A3A" opacity="0.14" />
      <path d="M40 34 H160 L170 236 Q170 246 160 246 H40 Q30 246 30 236 Z" fill={color} />
      <path d="M40 34 H160 L162 52 H38 Z" fill="#000" opacity="0.14" />
      <rect x="40" y="26" width="120" height="12" rx="2" fill="#F4F1EA" opacity="0.92" />
      <path d="M30 236 Q100 226 170 236 L170 238 Q170 246 160 246 H40 Q30 246 30 238 Z" fill="#000" opacity="0.12" />
      <rect x="52" y="82" width="96" height="124" rx="4" fill="#F4F1EA" />
      <circle cx="100" cy="108" r="14" fill="#2F4A3A" />
      <text x="100" y="114" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontSize="18" fontWeight="600" fill="#F4F1EA">
        h.
      </text>
      <text x="100" y="152" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontSize={name.length > 9 ? 19 : name.length > 7 ? 22 : 26} fontWeight="500" fill="#2F4A3A">
        {name}
      </text>
      <line x1="76" y1="164" x2="124" y2="164" stroke={color} strokeWidth="1.5" />
      <text x="100" y="182" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="7" letterSpacing="1.6" fill="#5B6B5F">
        {caption || 'VILLA RICA, PASCO'}
      </text>
      <text x="100" y="196" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="7" letterSpacing="1.6" fill="#5B6B5F">
        {weight}
      </text>
      <QrEmpaque x={128} y={211} size={28} seed={`bolsa-${name}`} />
      <text x="122" y="224" textAnchor="end" fontFamily="Inter, sans-serif" fontSize="6" letterSpacing="0.6" fill="#F4F1EA" opacity="0.85">
        ESCANEA TU
      </text>
      <text x="122" y="232" textAnchor="end" fontFamily="Inter, sans-serif" fontSize="6" letterSpacing="0.6" fill="#F4F1EA" opacity="0.85">
        PASAPORTE
      </text>
    </svg>
  )
}
