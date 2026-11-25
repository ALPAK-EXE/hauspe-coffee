// Rutas internas de /admin: cada sección vive en su propia URL (/admin/barista, /admin/dark-store, ...)
import { Navigate, useParams } from 'react-router-dom'
import { Empty } from '../../components/admin/ui'
import { useAuth } from '../../context/AuthContext'
import { ETIQUETA_ROL } from '../../permisos.js'
import BaseDeDatos from './BaseDeDatos'
import { Crm, Recordatorios } from './Clientes'
import { LotesIoT, Telemetria } from './Lotes'
import { Barista, DarkStore } from './Pedidos'
import { Cosecha, QrPorEmpaque } from './Registros'
import Resumen from './Resumen'
import Trazabilidad from './Trazabilidad'
import { SECCIONES, rutaDe, seccionesDe } from './util'
import { ShieldSlash } from '@phosphor-icons/react'

const VISTAS = {
  resumen: Resumen, barista: Barista, dark: DarkStore, trazabilidad: Trazabilidad, cosecha: Cosecha,
  lotes: LotesIoT, telemetria: Telemetria, qr: QrPorEmpaque, crm: Crm, recordatorios: Recordatorios, bd: BaseDeDatos,
}

function SinSecciones({ staff }) {
  return (
    <Empty Icon={ShieldSlash} titulo="Sin secciones asignadas">
      Tu rol ({ETIQUETA_ROL[staff.rol] || staff.rol}) no tiene secciones en el panel. Pide acceso al administrador.
    </Empty>
  )
}

/** /admin: el resumen para el administrador y, para los demás roles, su primera sección. */
export function PanelInicio() {
  const { staff } = useAuth()
  const permitidas = seccionesDe(staff)
  if (!permitidas.length) return <SinSecciones staff={staff} />
  if (permitidas[0].id === 'resumen') return <Resumen />
  return <Navigate to={rutaDe(permitidas[0])} replace />
}

/** /admin/:seccion: solo las secciones que permite el rol (la API vuelve a comprobarlo en el servidor). */
export function PanelSeccion() {
  const { seccion } = useParams()
  const { staff } = useAuth()
  const permitidas = seccionesDe(staff)
  const s = SECCIONES.find((x) => x.slug && x.slug === seccion)
  if (!s || !permitidas.some((p) => p.id === s.id)) return <Navigate to="/admin" replace />
  const Vista = VISTAS[s.id]
  return <Vista />
}
