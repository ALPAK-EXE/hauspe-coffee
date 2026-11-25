// Mide una compra B2C (se revierte al final): consultas y tiempo. Uso: node scripts/medir.mjs
import './_env.mjs'
import { PrismaClient } from '@prisma/client'
import * as repo from '../api/_lib/repo.js'
const p = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] })
let n = 0
p.$on('query', () => n++)
await p.$queryRaw`SELECT 1`
let t = Date.now(); await p.$queryRaw`SELECT 1`; console.log('RTT ms', Date.now() - t)
const lucia = await p.cliente.findUnique({ where: { email: 'cliente@hauspe.pe' } })
const v = await repo.varianteDe(p, 'casa')
n = 0; t = Date.now()
try {
  await p.$transaction(async (tx) => {
    n = 0; t = Date.now()
    const r = await repo.crearPedido(tx, { id_cliente: lucia.id_cliente, items: [{ id_variante: v.id_variante, cantidad: 1 }], distrito: 'Miraflores', referencia: '123456' })
    console.log('crearPedido', Date.now() - t, 'ms,', n, 'consultas', r.total)
    throw new Error('rollback')
  }, { timeout: 60000 })
} catch (e) { if (e.message !== 'rollback') throw e }
await p.$disconnect()
