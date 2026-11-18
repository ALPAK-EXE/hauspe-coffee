import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Play, Timer, ArrowCounterClockwise } from '@phosphor-icons/react'
import useTitle from '../useTitle'

const METODOS = [
  {
    id: 'prensa',
    nombre: 'Prensa francesa',
    resumen: 'Inmersión total: cuerpo intenso y textura sedosa. Es el método más fácil para empezar.',
    cafe: 'casa',
    cafeNombre: 'Casa',
    datos: [['Café', '30 g'], ['Agua', '450 ml'], ['Proporción', '1:15'], ['Molienda', 'Gruesa'], ['Agua a', '94 °C'], ['Tiempo', '4 min']],
    segundos: 240,
    pasos: [
      'Calienta el agua hasta que hierva y déjala reposar 30 segundos (unos 94 °C).',
      'Muele 30 g de café en molienda gruesa, como sal de mar, y ponlo en la prensa.',
      'Vierte 450 ml de agua en círculos hasta mojar todo el café y remueve suave con una cuchara.',
      'Tapa sin bajar el émbolo y deja reposar 4 minutos.',
      'Baja el émbolo despacio, sirve de inmediato y no dejes el café dentro de la prensa.',
    ],
  },
  {
    id: 'italiana',
    nombre: 'Cafetera italiana',
    resumen: 'Extracción por presión de vapor: una taza corta, intensa y con mucho cuerpo.',
    cafe: 'espresso-casa',
    cafeNombre: 'Espresso',
    datos: [['Café', '18 g'], ['Agua', '180 ml'], ['Proporción', '1:10'], ['Molienda', 'Media fina'], ['Fuego', 'Medio'], ['Tiempo', '5 min']],
    segundos: 300,
    pasos: [
      'Llena la base con agua caliente hasta justo debajo de la válvula.',
      'Pon 18 g de café en molienda media fina en el filtro, nivélalo con el dedo y no lo presiones.',
      'Enrosca bien las dos partes con un paño, porque la base está caliente.',
      'Ponla a fuego medio con la tapa abierta y espera a que el café empiece a subir.',
      'Cuando suene un burbujeo y el chorro se aclare, retírala del fuego y sirve.',
    ],
  },
  {
    id: 'goteo',
    nombre: 'Gota a gota',
    resumen: 'Filtrado por goteo (V60 o Chemex): una taza limpia que resalta la acidez y las notas de la finca.',
    cafe: 'origen',
    cafeNombre: 'Origen',
    datos: [['Café', '15 g'], ['Agua', '250 ml'], ['Proporción', '1:16'], ['Molienda', 'Media'], ['Agua a', '92 °C'], ['Tiempo', '3 min']],
    segundos: 180,
    pasos: [
      'Coloca el filtro de papel y enjuágalo con agua caliente para quitarle el sabor a papel. Bota esa agua.',
      'Agrega 15 g de café en molienda media, como azúcar, y haz un hueco en el centro.',
      'Vierte 30 ml de agua para mojar todo el café y espera 30 segundos (pre-infusión).',
      'Sigue vertiendo en espiral lenta, del centro hacia afuera, hasta llegar a 250 ml.',
      'Deja que termine de filtrar, alrededor de los 3 minutos, y sirve.',
    ],
  },
]

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function Temporizador({ segundos }) {
  const [restante, setRestante] = useState(segundos)
  const [corriendo, setCorriendo] = useState(false)
  const id = useRef(null)
  useEffect(() => {
    if (!corriendo) return undefined
    id.current = setInterval(() => setRestante((r) => (r <= 1 ? 0 : r - 1)), 1000)
    return () => clearInterval(id.current)
  }, [corriendo])
  if (corriendo && restante === 0) setCorriendo(false)
  const pct = 1 - restante / segundos
  return (
    <div className="timer">
      <svg viewBox="0 0 120 120" className="timer__ring" aria-hidden="true">
        <circle cx="60" cy="60" r="52" />
        <circle cx="60" cy="60" r="52" className="timer__progress" style={{ strokeDashoffset: 327 * (1 - pct) }} />
      </svg>
      <output className="timer__time" aria-live="polite">{restante === 0 ? 'Listo' : mmss(restante)}</output>
      <div className="timer__actions">
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setCorriendo((c) => !c)} disabled={restante === 0}>
          <Timer size={16} /> {corriendo ? 'Pausar' : 'Iniciar'}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setCorriendo(false); setRestante(segundos) }}>
          <ArrowCounterClockwise size={16} /> Reiniciar
        </button>
      </div>
    </div>
  )
}

export default function Guide() {
  useTitle('Cómo preparar tu café')
  const [params, setParams] = useSearchParams()
  const actual = METODOS.find((m) => m.id === params.get('metodo')) || METODOS[0]
  return (
    <div className="container page guide">
      <header className="page__head">
        <h1 className="display-l">Cómo preparar tu café</h1>
        <p className="lead measure">
          Un buen grano mal preparado sabe mal. Elige tu método y sigue los pasos con las cantidades exactas.
        </p>
      </header>
      <div className="tabs" role="tablist" aria-label="Método de preparación">
        {METODOS.map((m) => (
          <button key={m.id} role="tab" aria-selected={actual.id === m.id} className="tabs__tab" onClick={() => setParams({ metodo: m.id }, { replace: true })}>
            {m.nombre}
          </button>
        ))}
      </div>

      <div className="guide__grid" key={actual.id}>
        <div className="guide__media">
          <div className="guide__video" role="img" aria-label={`Espacio para el video de ${actual.nombre}`}>
            <Play size={40} weight="fill" aria-hidden="true" />
            <span>Video de {actual.nombre.toLowerCase()}</span>
            <small>Próximamente, grabado por el equipo de HausPe</small>
          </div>
          <dl className="guide__datos">
            {actual.datos.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          <Temporizador key={actual.id} segundos={actual.segundos} />
        </div>
        <div className="guide__pasos">
          <h2 className="display-m">{actual.nombre}</h2>
          <p className="lead">{actual.resumen}</p>
          <ol>
            {actual.pasos.map((p, i) => <li key={i}>{p}</li>)}
          </ol>
          <p className="muted">
            Café recomendado: <Link className="text-link" to={`/catalogo/${actual.cafe}`}>{actual.cafeNombre}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
