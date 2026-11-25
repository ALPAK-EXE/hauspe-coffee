// PrismaClient único: en Vercel las funciones reutilizan la instancia entre invocaciones
// (Fluid Compute), así no se abren conexiones de más contra MySQL.
import { PrismaClient } from '@prisma/client'

const g = globalThis
export const prisma = g.__hausPrisma ?? (g.__hausPrisma = new PrismaClient({ log: ['error'] }))
// Abre la conexión desde ya: la primera petición no paga el handshake con MySQL
prisma.$connect().catch(() => {})
