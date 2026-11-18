import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/500-italic.css'
import './index.css'
import App from './App.jsx'
import { iniciarBD } from './db/browser'

const root = createRoot(document.getElementById('root'))
root.render(<p style={{ padding: 40, fontFamily: 'Inter, sans-serif' }}>Cargando base de datos…</p>)

iniciarBD()
  .catch((e) => console.error('No se pudo iniciar la base de datos', e))
  .finally(() =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
