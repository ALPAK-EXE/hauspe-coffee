/* eslint-disable react-refresh/only-export-components */
// Código QR decorativo (no codifica nada real)
const N = 25

export function cells(seed) {
  let s = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  const out = []
  const inFinder = (x, y) =>
    (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      if (!inFinder(x, y) && s % 100 < 48) out.push([x, y])
    }
  }
  return out
}

function Finder({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="7" height="7" fill="currentColor" />
      <rect x="1" y="1" width="5" height="5" fill="#fff" />
      <rect x="2" y="2" width="3" height="3" fill="currentColor" />
    </g>
  )
}

export default function FakeQr({ seed = 'hauspe', label = 'Código QR de ejemplo', className = '' }) {
  return (
    <svg className={className} viewBox={`-1 -1 ${N + 2} ${N + 2}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect x="-1" y="-1" width={N + 2} height={N + 2} fill="#fff" />
      {cells(seed).map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
      <Finder x={0} y={0} />
      <Finder x={N - 7} y={0} />
      <Finder x={0} y={N - 7} />
    </svg>
  )
}
