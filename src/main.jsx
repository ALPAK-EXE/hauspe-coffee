import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/500-italic.css'
import './index.css'
import App from './App.jsx'
import { iniciarDatos } from './db/data'

const root = createRoot(document.getElementById('root'))
root.render(<p style={{ padding: 40, fontFamily: 'Inter, sans-serif' }}>Conectando con la base de datos…</p>)

// Decide si la app usa MySQL (API) o, si no responde, la base local de respaldo
iniciarDatos()
  .catch((e) => console.error('No se pudo iniciar la base de datos', e))
  .finally(() =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
