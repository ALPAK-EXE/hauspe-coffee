import { Link } from 'react-router-dom'
import Logo from './Logo'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Logo light />
          <p>Café de especialidad de Villa Rica, Pasco, para tu taza y para el mundo.</p>
        </div>
        <nav aria-label="Pie de página" className="footer__nav">
          <Link to="/catalogo">Cafés</Link>
          <Link to="/historia">Nuestro origen</Link>
          <Link to="/sumate">Súmate</Link>
          <Link to="/matcher">Encuentra tu café</Link>
          <Link to="/registro">Crear cuenta</Link>
          <Link to="/admin/login">Acceso del personal</Link>
        </nav>
      </div>
      <div className="container footer__legal">Prototipo académico - información de ejemplo</div>
    </footer>
  )
}
