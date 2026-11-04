// Datos operativos simulados: registro de cosecha y tueste, leads, perfil de sabor y alertas de WhatsApp
import { load, save } from '../context/storage'

const HARVEST_KEY = 'hauspe_harvests'
const ROAST_KEY = 'hauspe_roasts'
const LEADS_KEY = 'hauspe_leads'
const TASTE_KEY = 'hauspe_taste'

// Estados del pedido de la tienda: barista (nuevo, preparando, listo) y dark store (despachado)
export const STATUS = [
  { id: 'nuevo', label: 'Nuevo' },
  { id: 'preparando', label: 'En preparación' },
  { id: 'listo', label: 'Listo en dark store' },
  { id: 'despachado', label: 'Despachado' },
]

const MESSAGES = {
  nuevo: (id) => `Recibimos tu pedido ${id}. Lo estamos preparando.`,
  preparando: (id) => `Tu pedido ${id} se está tostando y empacando.`,
  listo: (id) => `Tu pedido ${id} está listo en nuestra dark store.`,
  despachado: (id, extra) => `Tu pedido ${id} salió a reparto${extra ? ` con ${extra}` : ''}. Llegará hoy.`,
}

// Alerta simulada de WhatsApp (no se envía nada real)
export const makeAlert = (status, id, extra) => ({
  at: new Date().toISOString(),
  channel: 'WhatsApp',
  text: MESSAGES[status](id, extra),
})

export const nextStatus = (status) => {
  const i = STATUS.findIndex((s) => s.id === status)
  return STATUS[Math.min(i + 1, STATUS.length - 1)].id
}

export const getHarvests = () => load(HARVEST_KEY, [])
export const addHarvest = (rec) => save(HARVEST_KEY, [{ ...rec, id: crypto.randomUUID(), at: Date.now() }, ...getHarvests()])
export const getRoasts = () => load(ROAST_KEY, [])
export const addRoast = (rec) => save(ROAST_KEY, [{ ...rec, id: crypto.randomUUID(), at: Date.now() }, ...getRoasts()])

// Captura de leads desde el QR (O2O)
export const getLeads = () => load(LEADS_KEY, [])
export function addLead(lead) {
  const leads = getLeads()
  const phone = lead.whatsapp.replace(/\D/g, '')
  if (leads.some((l) => l.whatsapp.replace(/\D/g, '') === phone && l.source === lead.source)) return false
  save(LEADS_KEY, [{ ...lead, at: Date.now() }, ...leads])
  return true
}

// Perfil de sabor del Coffee Matcher
export const getTaste = () => load(TASTE_KEY, null)
export const saveTaste = (taste) => save(TASTE_KEY, taste)
