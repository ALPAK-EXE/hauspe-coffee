// Núcleo de acceso a la base de datos SQLite (sql.js).
// No depende del navegador: se usa igual en la app y en las pruebas de Node.

export const IGV = 0.18

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

export async function sha256(text) {
  const data = new TextEncoder().encode(text)
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const pad = (n) => String(n).padStart(2, '0')
export function fechaLocal(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
export const soloFecha = (d = new Date()) => fechaLocal(d).slice(0, 10)
export const sumarHoras = (d, h) => new Date(d.getTime() + h * 3600 * 1000)
export const sumarDias = (d, n) => sumarHoras(d, n * 24)

export class HausDB {
  constructor(db) {
    this.db = db
    this.db.run('PRAGMA foreign_keys = ON;')
    this.listeners = new Set()
    this.txDepth = 0
  }

  all(sql, params = []) {
    const stmt = this.db.prepare(sql)
    try {
      stmt.bind(params)
      const rows = []
      while (stmt.step()) rows.push(stmt.getAsObject())
      return rows
    } finally {
      stmt.free()
    }
  }

  get(sql, params = []) {
    return this.all(sql, params)[0] ?? null
  }

  run(sql, params = []) {
    this.db.run(sql, params)
    const id = this.db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]
    const changes = this.db.getRowsModified()
    if (this.txDepth === 0) this.emit()
    return { lastId: id, changes }
  }

  // Ejecuta fn dentro de una transacción; si algo falla, se revierte todo.
  async tx(fn) {
    if (this.txDepth > 0) return fn()
    this.db.run('BEGIN')
    this.txDepth++
    try {
      const r = await fn()
      this.txDepth--
      this.db.run('COMMIT')
      this.emit()
      return r
    } catch (e) {
      this.txDepth--
      this.db.run('ROLLBACK')
      throw e
    }
  }

  // Consola SQL: devuelve varias tablas de resultados (como un cliente SQL)
  exec(sql) {
    const res = this.db.exec(sql)
    this.emit()
    return res.map((r) => ({ columns: r.columns, rows: r.values }))
  }

  tablas() {
    return this.all(
      "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name",
    ).map((t) => ({
      ...t,
      filas: this.get(`SELECT COUNT(*) AS n FROM "${t.name}"`).n,
    }))
  }

  columnas(tabla) {
    const cols = this.all(`PRAGMA table_info("${tabla}")`)
    const fks = this.all(`PRAGMA foreign_key_list("${tabla}")`)
    return cols.map((c) => {
      const fk = fks.find((f) => f.from === c.name)
      return {
        nombre: c.name,
        tipo: c.type,
        pk: c.pk > 0,
        notNull: !!c.notnull,
        fk: fk ? `${fk.table}(${fk.to})` : null,
      }
    })
  }

  exportar() {
    const data = this.db.export()
    // export() reabre la conexión y SQLite olvida el PRAGMA: se vuelve a activar
    this.db.run('PRAGMA foreign_keys = ON;')
    return data
  }

  subscribe(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  emit() {
    this.listeners.forEach((fn) => {
      try {
        fn()
      } catch {
        /* listener roto: se ignora */
      }
    })
  }
}

export async function crearBaseDeDatos(SQL, { schema, data, seed } = {}) {
  if (data) {
    const hdb = new HausDB(new SQL.Database(data))
    return hdb
  }
  const hdb = new HausDB(new SQL.Database())
  hdb.db.exec(schema)
  if (seed) await seed(hdb)
  return hdb
}
