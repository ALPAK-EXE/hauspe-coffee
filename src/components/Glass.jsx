/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react'
import { LAYERS } from '../data/products'

// Orden de abajo hacia arriba dentro del vaso
const ORDER = ['chocolate', 'espresso', 'agua', 'coldbrew', 'leche', 'hielo', 'espuma']
const mlOf = (i) => i.ml ?? i.cantidad
export const totalMl = (size) => size.insumos.filter((i) => i.capa).reduce((s, i) => s + mlOf(i), 0)

export function layersOf(size) {
  return ORDER.flatMap((k) => size.insumos.filter((i) => i.capa === k).map((i) => ({ key: k, ml: mlOf(i), nombre: i.nombre })))
}

const CUBES = [[18, 14, 12], [52, 6, -9], [34, 46, 20], [64, 40, 6]]

// Vaso en corte: cada capa mide lo que su ingrediente aporta en ml. Al cambiar de tamaño, el vaso se vuelve a servir.
export default function Glass({ drink, size, compact = false }) {
  const capacidad = Math.max(...drink.sizes.map(totalMl)) * 1.14
  const capas = layersOf(size)
  const [servido, setServido] = useState(compact)
  useEffect(() => {
    if (compact) return undefined
    const id = requestAnimationFrame(() => setServido(true))
    return () => cancelAnimationFrame(id)
  }, [compact])

  return (
    <div className={`glass${compact ? ' glass--compact' : ''}${drink.hot ? ' glass--hot' : ''}`}>
      {drink.hot && !compact && (
        <svg className="glass__steam" viewBox="0 0 120 70" aria-hidden="true">
          <path d="M30 66 C20 50 40 40 30 24 C24 14 32 6 30 2" />
          <path d="M60 66 C50 48 72 38 60 20 C54 10 62 4 60 0" />
          <path d="M90 66 C80 50 100 40 90 24 C84 14 92 6 90 2" />
        </svg>
      )}
      <div className="glass__body" role="img" aria-label={`${drink.name} ${size.label}: ${capas.map((c) => `${c.nombre} ${c.ml} ml`).join(', ')}`}>
        {capas.map((c, i) => (
          <div
            key={c.key}
            className={`glass__layer glass__layer--${c.key}`}
            style={{
              height: servido ? `${(c.ml / capacidad) * 100}%` : 0,
              background: LAYERS[c.key].color,
              transitionDelay: compact ? '0ms' : `${i * 160}ms`,
            }}
          >
            {c.key === 'hielo' && CUBES.map(([x, y, r], j) => (
              <span key={j} className="glass__cube" style={{ left: `${x}%`, top: `${y}%`, transform: `rotate(${r}deg)` }} />
            ))}
          </div>
        ))}
      </div>
      <span className="glass__base" aria-hidden="true" />
    </div>
  )
}
