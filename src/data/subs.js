// Suscripciones de café tostado (tienda): se crean al pagar un pedido con frecuencia semanal, quincenal o mensual
import { load, save } from '../context/storage'
import { PLANS, getProduct, round2 } from './products'

const KEY = 'hauspe_subs'
const DAY = 24 * 3600 * 1000
export const REMINDER_DAYS = 3
export const INTERVAL_DAYS = { weekly: 7, biweekly: 14, monthly: 30 }
export const SUB_PLANS = PLANS.filter((p) => p.id !== 'once')

export const getAllSubs = () => load(KEY, [])
export const getSubs = (email) => getAllSubs().filter((s) => s.email === email)
const write = (subs) => save(KEY, subs)

export function createSubs(order, user) {
  const fresh = order.lines
    .filter((l) => l.currency === 'PEN' && l.planId && l.planId !== 'once')
    .map((l) => ({
      id: crypto.randomUUID(),
      email: user.email,
      name: user.name,
      whatsapp: user.whatsapp,
      productId: l.productId,
      grind: l.grind,
      qty: l.qty,
      planId: l.planId,
      status: 'active',
      orderId: order.id,
      createdAt: Date.now(),
      nextDelivery: Date.parse(order.date) + INTERVAL_DAYS[l.planId] * DAY,
      chat: [],
    }))
  if (fresh.length) write([...getAllSubs(), ...fresh])
}

export function updateSub(id, patch) {
  write(getAllSubs().map((s) => (s.id === id ? { ...s, ...(typeof patch === 'function' ? patch(s) : patch) } : s)))
}

export const pauseSub = (id) => updateSub(id, { status: 'paused' })
export const cancelSub = (id) => updateSub(id, { status: 'cancelled' })
export const resumeSub = (id) =>
  updateSub(id, (s) => ({ status: 'active', nextDelivery: Date.now() + INTERVAL_DAYS[s.planId] * DAY }))
// Una frecuencia más corta adelanta la entrega; una más larga conserva la fecha ya programada
export const changePlan = (id, planId) =>
  updateSub(id, (s) => ({ planId, nextDelivery: Math.min(s.nextDelivery, Date.now() + INTERVAL_DAYS[planId] * DAY) }))
export const pushChat = (id, messages) =>
  updateSub(id, (s) => ({ chat: [...(s.chat || []), ...messages.map((m) => ({ ...m, at: Date.now() }))] }))

export function subInfo(sub) {
  const product = getProduct(sub.productId)
  const plan = PLANS.find((p) => p.id === sub.planId)
  const unit = round2(product.price * (1 - plan.discount))
  return { product, plan, unit, total: round2(unit * sub.qty) }
}

export const daysUntil = (ts, now = Date.now()) => Math.max(0, Math.ceil((ts - now) / DAY))
export const isDue = (sub, now = Date.now()) => sub.status === 'active' && daysUntil(sub.nextDelivery, now) <= REMINDER_DAYS

export function reminderText(sub, days = REMINDER_DAYS) {
  const { product } = subInfo(sub)
  const when = days === 0 ? 'hoy' : days === 1 ? 'en 1 día' : `en ${days} días`
  return `Hola ${sub.name.split(' ')[0]}, tu café ${product.name} (${product.weight}) se acaba ${when}. ¿Lo enviamos?`
}

export const fmtDay = (ts) => new Date(ts).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'long' })
