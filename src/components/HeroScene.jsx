import { useEffect, useRef } from 'react'

// Recorrido del café: de la finca en Villa Rica, a la tostaduría, a la taza
const RUTA = 'M168 318 C 210 360, 250 380, 300 404 S 380 470, 420 500'

// Escena ilustrada de Villa Rica. Una sola secuencia al cargar: sale el sol, suben las montañas,
// se dibuja la ruta del lote y un grano la recorre hasta la taza.
export default function HeroScene() {
  const ref = useRef(null)

  // Parallax suave al bajar la página (se omite si la persona prefiere menos movimiento)
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => el.style.setProperty('--sy', String(Math.min(window.scrollY, 600))))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="scene" ref={ref}>
      <svg viewBox="0 0 600 640" role="img" aria-labelledby="scene-title">
        <title id="scene-title">Ilustración de Villa Rica: el café sale de la finca en la montaña, pasa por la tostaduría y llega a tu taza</title>
        <defs>
          <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F7F1E3" />
            <stop offset="1" stopColor="#E9E0CC" />
          </linearGradient>
          <clipPath id="marco">
            <rect width="600" height="640" rx="32" />
          </clipPath>
        </defs>
        <g clipPath="url(#marco)">
          <rect width="600" height="640" fill="url(#cielo)" />

          <g className="scene__sol">
            <circle cx="430" cy="178" r="96" fill="#EFD9A6" opacity="0.35" />
            <circle cx="430" cy="178" r="62" fill="#E5C27C" />
          </g>

          <g className="scene__niebla">
            <ellipse cx="160" cy="250" rx="140" ry="10" fill="#fff" opacity="0.55" />
            <ellipse cx="480" cy="290" rx="120" ry="8" fill="#fff" opacity="0.45" />
          </g>

          <path className="scene__capa scene__capa--1" d="M0 300 L90 210 L160 262 L250 170 L360 268 L440 214 L520 262 L600 220 V640 H0 Z" fill="#B7C9AE" />
          <path className="scene__capa scene__capa--2" d="M0 360 C80 300 140 300 200 312 C260 324 300 268 380 262 C460 256 520 300 600 290 V640 H0 Z" fill="#7FA07F" />

          {/* Cafetales en la ladera: hileras con cerezas maduras */}
          <g className="scene__capa scene__capa--2" aria-hidden="true">
            {[0, 1, 2, 3].map((fila) =>
              Array.from({ length: 11 }, (_, i) => {
                const x = 40 + i * 50 + (fila % 2) * 24
                const y = 344 + fila * 20 - Math.sin(i / 2) * 6
                return (
                  <g key={`${fila}-${i}`}>
                    <circle cx={x} cy={y} r="7" fill="#4E7A5A" />
                    <circle cx={x + 3} cy={y + 2} r="1.8" fill="#A64B2F" />
                  </g>
                )
              }),
            )}
          </g>

          {/* Finca */}
          <g className="scene__capa scene__capa--2">
            <rect x="150" y="292" width="40" height="26" fill="#FBF6EC" />
            <path d="M144 294 L170 274 L196 294 Z" fill="#A64B2F" />
            <rect x="164" y="304" width="10" height="14" fill="#2F4A3A" />
          </g>

          <path className="scene__capa scene__capa--3" d="M0 440 C120 400 220 392 320 412 C420 432 500 398 600 410 V640 H0 Z" fill="#4E7A5A" />

          {/* Tostaduría con humo */}
          <g className="scene__capa scene__capa--3">
            <rect x="284" y="384" width="44" height="30" fill="#FBF6EC" />
            <rect x="314" y="366" width="8" height="20" fill="#2F4A3A" />
            <path d="M280 386 L306 368 L332 386 Z" fill="#2F4A3A" />
            <g className="scene__humo">
              <circle cx="318" cy="352" r="6" fill="#fff" opacity="0.7" />
              <circle cx="326" cy="338" r="8" fill="#fff" opacity="0.5" />
            </g>
          </g>

          <path className="scene__capa scene__capa--4" d="M0 520 C140 486 260 500 380 520 C470 536 540 520 600 512 V640 H0 Z" fill="#2F4A3A" />

          {/* Ruta del lote */}
          <path d={RUTA} fill="none" stroke="#FBF6EC" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" opacity="0.7" />
          <path className="scene__ruta" d={RUTA} fill="none" stroke="#E5C27C" strokeWidth="3" strokeLinecap="round" pathLength="1" />
          <g className="scene__grano">
            <ellipse rx="7" ry="9.5" fill="#5E3B2A" />
            <path d="M0 -8 C -3 -3 3 3 0 8" stroke="#C98B3A" strokeWidth="1.4" fill="none" />
            <animateMotion dur="5.5s" begin="2.6s" repeatCount="indefinite" path={RUTA} rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.2 1" />
          </g>

          {/* Taza */}
          <g className="scene__taza">
            <ellipse cx="452" cy="588" rx="92" ry="14" fill="#22372B" opacity="0.6" />
            <ellipse cx="452" cy="572" rx="84" ry="16" fill="#FBF6EC" />
            <path d="M386 486 H518 L506 562 C504 574 400 574 398 562 Z" fill="#FBF6EC" />
            <path d="M516 500 C552 500 552 548 510 546" fill="none" stroke="#FBF6EC" strokeWidth="10" />
            <ellipse cx="452" cy="487" rx="66" ry="9" fill="#5E3B2A" />
            <text x="452" y="538" textAnchor="middle" fontFamily="Cormorant Garamond, Georgia, serif" fontSize="34" fill="#2F4A3A">h.</text>
            <g className="scene__vapor">
              <path d="M424 474 C414 452 436 440 424 418 C418 406 426 396 424 390" />
              <path d="M452 474 C442 450 464 438 452 412 C446 400 454 390 452 382" />
              <path d="M480 474 C470 452 492 440 480 418 C474 406 482 396 480 390" />
            </g>
          </g>

          {/* Paradas de la ruta */}
          <g className="scene__tag scene__tag--1">
            <rect x="96" y="232" width="148" height="30" rx="15" fill="#FBF6EC" />
            <text x="170" y="252" textAnchor="middle">Finca, 1 920 msnm</text>
          </g>
          <g className="scene__tag scene__tag--2">
            <rect x="216" y="430" width="132" height="30" rx="15" fill="#FBF6EC" />
            <text x="282" y="450" textAnchor="middle">Tueste en Lima</text>
          </g>
          <g className="scene__tag scene__tag--3">
            <rect x="330" y="606" width="100" height="26" rx="13" fill="#E5C27C" />
            <text x="380" y="624" textAnchor="middle">Tu taza</text>
          </g>
        </g>
      </svg>
    </div>
  )
}
