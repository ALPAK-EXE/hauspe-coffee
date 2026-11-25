// Constantes y ayudas compartidas por las secciones del panel (/admin)
import {
  AirplaneTilt, Bell, Coffee, Cpu, Database, Fire, Plant, QrCode, SquaresFour, ShieldCheck, Storefront, Thermometer, Truck, Users, Warehouse,
} from '@phosphor-icons/react'
import { fmtPEN, fmtUSD } from '../../data/products'

// Cada sección: id (el de permisos.js), slug (la URL), ícono, grupo y descripción de la barra superior
export const SECCIONES = [
  { id: 'resumen', slug: '', label: 'Resumen', Icon: SquaresFour, grupo: 'Inicio', solo: 'ADMIN', desc: 'Lo que pide atención hoy: pedidos, insumos, lotes y ventas.' },
  { id: 'barista', slug: 'barista', label: 'Barista', Icon: Coffee, grupo: 'Operación', desc: 'Pedidos nuevos, en preparación y listos, con el perfil de sabor de cada cliente.' },
  { id: 'dark', slug: 'dark-store', label: 'Dark store', Icon: Storefront, grupo: 'Operación', desc: 'Reparto con cuenta regresiva de 24 horas desde el pago.' },
  { id: 'trazabilidad', slug: 'trazabilidad', label: 'Trazabilidad', Icon: ShieldCheck, grupo: 'Trazabilidad', desc: 'Firma de etapas por lote y verificación de la cadena de bloques.' },
  { id: 'cosecha', slug: 'cosecha', label: 'Cosecha', Icon: Plant, grupo: 'Trazabilidad', desc: 'Registro de cosecha por lote, sellado en el pasaporte.' },
  { id: 'lotes', slug: 'lotes-iot', label: 'Lotes IoT', Icon: Cpu, grupo: 'Trazabilidad', desc: 'Estado de cada lote con la última lectura de sus sensores.' },
  { id: 'telemetria', slug: 'telemetria', label: 'Telemetría', Icon: Thermometer, grupo: 'Trazabilidad', desc: 'Lecturas de humedad y CO2 por lote, manuales o simuladas.' },
  { id: 'qr', slug: 'qr-por-empaque', label: 'QR por empaque', Icon: QrCode, grupo: 'Trazabilidad', desc: 'Etiquetas con el código QR de cada empaque de un lote.' },
  { id: 'crm', slug: 'crm', label: 'CRM', Icon: Users, grupo: 'Clientes', desc: 'Ficha de cada cliente: plan, perfil de sabor, historial y notas.' },
  { id: 'recordatorios', slug: 'recordatorios', label: 'Recordatorios', Icon: Bell, grupo: 'Clientes', desc: 'Avisos de WhatsApp para las suscripciones próximas a entregar.' },
  { id: 'bd', slug: 'base-de-datos', label: 'Base de datos', Icon: Database, grupo: 'Sistema', desc: 'Explorador de tablas, consola SQL de solo lectura y pruebas automáticas.' },
]
export const GRUPOS = ['Inicio', 'Operación', 'Trazabilidad', 'Clientes', 'Sistema']

/** Secciones que puede ver este personal, en el orden del menú. */
export const seccionesDe = (staff) =>
  SECCIONES.filter((s) => (s.solo ? staff.rol === s.solo : staff.pestanas.includes(s.id)))
export const rutaDe = (s) => (s.slug ? `/admin/${s.slug}` : '/admin')

export const ESTADO = {
  PAGADO: 'Nuevo', EN_PREPARACION: 'En preparación', LISTO: 'Listo', DESPACHADO: 'Despachado', ENTREGADO: 'Entregado', COTIZADO: 'Cotizado', CANCELADO: 'Cancelado',
}
export const CLASE_ESTADO = {
  PAGADO: 'nuevo', EN_PREPARACION: 'preparacion', LISTO: 'listo', DESPACHADO: 'despachado', ENTREGADO: 'entregado', COTIZADO: 'neutro', CANCELADO: 'alerta',
}
// Estado antiguo de la vista del cliente (localStorage) que se actualiza junto con la base
export const LEGACY = { EN_PREPARACION: 'preparando', LISTO: 'listo', DESPACHADO: 'despachado' }
export const BOTON = { PAGADO: 'Empezar a preparar', EN_PREPARACION: 'Marcar listo', LISTO: 'Despachar', DESPACHADO: 'Confirmar entrega' }

export const money = (p) => (p.moneda === 'USD' ? fmtUSD(p.total) : fmtPEN(p.total))
export const hora = (s) => (s ? new Date(s.replace(' ', 'T')).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '')
export const soloHora = (s) => (s ? new Date(s.replace(' ', 'T')).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '')
export const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
export const iniciales = (nombre = '') => nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')

/** Texto y tono de la cuenta regresiva de 24 h de una entrega (verde, dorado bajo 4 h, terracota si se pasó). */
export function cuenta(c) {
  if (!c) return null
  if (c.atrasado) {
    const m = Math.abs(c.restanteMin)
    return { tono: 'alerta', texto: `Atrasado ${Math.floor(m / 60)} h ${m % 60} min` }
  }
  const texto = `Quedan ${Math.floor(c.restanteMin / 60)} h ${c.restanteMin % 60} min`
  return { tono: c.restanteMin < 240 ? 'cuidado' : 'ok', texto }
}

// Etapas firmadas de la cadena de trazabilidad
export const ETAPAS = [
  { id: 'FINCA', label: 'Finca (cosecha)', Icon: Plant },
  { id: 'DARK_STORE', label: 'Dark store / almacén', Icon: Warehouse },
  { id: 'TUESTE', label: 'Tueste', Icon: Fire },
  { id: 'EXPORTACION', label: 'Exportación', Icon: AirplaneTilt },
  { id: 'DELIVERY', label: 'Delivery', Icon: Truck },
]
