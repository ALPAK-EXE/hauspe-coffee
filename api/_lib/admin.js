// Panel interno → Base de datos: explorador de tablas, consola SQL de solo lectura y modelo Prisma.
import { Prisma } from '@prisma/client'
import { limpiar } from './core.js'
import { triggersActivos } from './repo.js'

const err = (status, mensaje) => Object.assign(new Error(mensaje), { status })

/** Tablas y vistas con su número exacto de filas. */
export async function tablas(db) {
  const objs = await db.$queryRaw`SELECT table_name AS nombre, table_type AS tipo FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_type, table_name`
  const lista = objs.map((o) => ({ name: o.nombre, type: o.tipo === 'VIEW' ? 'view' : 'table' }))
  const sql = lista.map((t) => `SELECT '${t.name}' AS t, COUNT(*) AS n FROM \`${t.name}\``).join(' UNION ALL ')
  const conteos = Object.fromEntries((await db.$queryRawUnsafe(sql)).map((r) => [r.t, Number(r.n)]))
  return lista.map((t) => ({ ...t, filas: conteos[t.name] ?? 0 }))
}

async function nombreValido(db, tabla) {
  const t = (await tablas(db)).find((x) => x.name === String(tabla))
  if (!t) throw err(404, `No existe la tabla ${tabla}`)
  return t.name
}

export async function columnas(db, tabla) {
  const t = await nombreValido(db, tabla)
  const r = await db.$queryRaw`
    SELECT c.column_name AS nombre, c.column_type AS tipo, c.is_nullable AS nulo, c.column_key AS clave,
      (SELECT CONCAT(k.referenced_table_name, '(', k.referenced_column_name, ')')
         FROM information_schema.key_column_usage k
        WHERE k.table_schema = c.table_schema AND k.table_name = c.table_name AND k.column_name = c.column_name
          AND k.referenced_table_name IS NOT NULL LIMIT 1) AS fk
    FROM information_schema.columns c
    WHERE c.table_schema = DATABASE() AND c.table_name = ${t}
    ORDER BY c.ordinal_position`
  return r.map((c) => ({ nombre: c.nombre, tipo: c.tipo, pk: c.clave === 'PRI', notNull: c.nulo === 'NO', fk: c.fk }))
}

// Los hashes de contraseña nunca salen por la API del panel
const celda = (v, k) => {
  if (k === 'password_hash') return '••••••••'
  const x = limpiar(v, k)
  return x !== null && typeof x === 'object' ? JSON.stringify(x) : x
}
const aTabla = (filas, cols) => {
  const columns = cols ?? Object.keys(filas[0] ?? {})
  return { columns, rows: filas.map((f) => columns.map((c) => celda(f[c], c))) }
}

export async function filas(db, tabla, limite = 100) {
  const t = await nombreValido(db, tabla)
  const n = Math.min(Math.max(Number(limite) || 100, 1), 500)
  const r = await db.$queryRawUnsafe(`SELECT * FROM \`${t}\` LIMIT ${n}`)
  return aTabla(r, (await columnas(db, t)).map((c) => c.nombre))
}

// ---- Consola SQL: solo lectura ----
const PERMITIDAS = ['SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN']
const PROHIBIDAS = /\b(password_hash|INTO\s+(OUT|DUMP)FILE|INTO\s+@|LOAD_FILE|FOR\s+UPDATE|LOCK\s+IN\s+SHARE|SLEEP|BENCHMARK|GET_LOCK)\b/i
const LIMITE_FILAS = 200

export async function consultaSQL(db, texto) {
  let sql = String(texto || '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)--[^\n]*/g, ' ').trim().replace(/;+\s*$/, '').trim()
  if (!sql) throw err(400, 'Escribe una consulta')
  if (sql.includes(';')) throw err(403, 'Solo se permite una sentencia por consulta')
  const primera = sql.split(/\s+/)[0].toUpperCase()
  if (!PERMITIDAS.includes(primera)) throw err(403, `Consola de solo lectura: solo se permiten ${PERMITIDAS.join(', ')} (no ${primera})`)
  if (PROHIBIDAS.test(sql)) throw err(403, 'La consulta contiene una construcción no permitida en la consola')
  if (primera === 'SELECT') {
    if (!/\blimit\s+\d+/i.test(sql)) sql += ` LIMIT ${LIMITE_FILAS + 1}`
    sql = sql.replace(/^SELECT/i, 'SELECT /*+ MAX_EXECUTION_TIME(8000) */')
  }
  const t0 = Date.now()
  const r = await db.$queryRawUnsafe(sql)
  const truncado = r.length > LIMITE_FILAS
  return { out: [{ ...aTabla(r.slice(0, LIMITE_FILAS)) }], ms: Date.now() - t0, truncado, limite: LIMITE_FILAS }
}

// ---- Modelo Prisma (desde el DMMF del cliente generado) ----
export function modelo() {
  const modelos = Prisma.dmmf.datamodel.models.map((m) => ({
    nombre: m.name,
    pk: m.primaryKey?.fields ?? m.fields.filter((f) => f.isId).map((f) => f.name),
    campos: m.fields.map((f) => ({
      nombre: f.name,
      tipo: f.type + (f.isList ? '[]' : f.isRequired ? '' : '?'),
      relacion: f.kind === 'object' ? { modelo: f.type, lista: f.isList, campos: f.relationFromFields ?? [], onDelete: f.relationOnDelete ?? null } : null,
      pk: f.isId, unico: f.isUnique,
    })),
    unicos: m.uniqueFields ?? [],
  }))
  return { prisma: Prisma.prismaVersion.client, modelos }
}

export async function salud(db) {
  const t0 = Date.now()
  const [r] = await db.$queryRaw`SELECT VERSION() AS version`
  return {
    ok: true, motor: 'MySQL', version: r.version, orm: 'Prisma ORM', prisma: Prisma.prismaVersion.client,
    triggers: await triggersActivos(db), ms: Date.now() - t0,
  }
}
