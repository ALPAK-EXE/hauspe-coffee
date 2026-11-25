// Quién puede ver y hacer qué. Lo comparten la API (para autorizar) y el panel /admin (para mostrar pestañas),
// así hay una sola fuente de verdad.

export const TODAS_LAS_PESTANAS = ['barista', 'dark', 'trazabilidad', 'lotes', 'crm', 'bd', 'cosecha', 'telemetria', 'recordatorios', 'qr']
const DE_INSPECTOR = ['trazabilidad', 'cosecha', 'telemetria', 'lotes', 'qr']

export const PESTANAS_POR_ROL = {
  ADMIN: TODAS_LAS_PESTANAS,
  BARISTA: ['barista', 'crm'],
  REPARTIDOR: ['dark', 'recordatorios'],
  INSPECTOR_COSECHA: DE_INSPECTOR,
  INSPECTOR_ENTREGA: DE_INSPECTOR,
  INSPECTOR_PRODUCCION: DE_INSPECTOR,
}

export const ETIQUETA_ROL = {
  ADMIN: 'Administrador',
  BARISTA: 'Barista',
  REPARTIDOR: 'Dark store (reparto)',
  INSPECTOR_COSECHA: 'Inspector de cosecha',
  INSPECTOR_ENTREGA: 'Inspector de entrega',
  INSPECTOR_PRODUCCION: 'Inspector de producción',
}

export const esInspector = (rol) => String(rol).startsWith('INSPECTOR')
export const pestanasDe = (rol) => PESTANAS_POR_ROL[rol] ?? []

// Grupos de roles para proteger los endpoints
const INSPECTORES = ['INSPECTOR_COSECHA', 'INSPECTOR_ENTREGA', 'INSPECTOR_PRODUCCION']
export const GRUPOS = {
  barista: ['ADMIN', 'BARISTA'],
  darkStore: ['ADMIN', 'REPARTIDOR'],
  pedidos: ['ADMIN', 'BARISTA', 'REPARTIDOR'],
  inspector: ['ADMIN', ...INSPECTORES],
  admin: ['ADMIN'],
}

// Estados de pedido que cada rol puede hacer avanzar (ADMIN: todos)
export const ESTADOS_QUE_AVANZA = {
  BARISTA: ['PAGADO', 'EN_PREPARACION'],
  REPARTIDOR: ['LISTO', 'DESPACHADO'],
}
