import { useModo } from '../db/data'

// Aviso discreto cuando la API de MySQL no responde y la app usa la base local de respaldo
export default function ModoAviso() {
  const { modo } = useModo()
  if (modo !== 'local') return null
  return (
    <p className="modo-aviso" role="status" title="No hay conexión con MySQL: la app usa la base SQLite de este navegador. Recarga para reintentar.">
      Modo sin conexión (base local)
    </p>
  )
}
