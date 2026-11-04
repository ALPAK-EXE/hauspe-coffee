import { Link } from 'react-router-dom'

export default function Logo({ light = false }) {
  return (
    <Link to="/" className={`logo${light ? ' logo--light' : ''}`} aria-label="HausPe Coffee, inicio">
      <span className="logo__mark" aria-hidden="true">
        h.
      </span>
      <span className="logo__word">
        <span className="logo__name">hauspe</span>
        <span className="logo__sub">COFFEE</span>
      </span>
    </Link>
  )
}
