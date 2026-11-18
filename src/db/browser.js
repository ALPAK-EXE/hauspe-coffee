// Base de datos SQLite (sql.js / WebAssembly) que corre dentro del navegador.
// Se guarda en localStorage como archivo .sqlite para que sobreviva a recargas.
import { useSyncExternalStore } from 'react'
import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import schema from './schema.sql?raw'
import { crearBaseDeDatos } from './core'
import { seed } from './seed'

const KEY = 'hauspe_sqlite_v1'
let SQL = null
let hdb = null
let version = 0
let timer = null

function aBase64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
function deBase64(b64) {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

function persistir() {
  try {
    localStorage.setItem(KEY, aBase64(hdb.exportar()))
  } catch {
    /* sin almacenamiento: la base vive solo en memoria */
  }
}

function alCambiar() {
  version++
  clearTimeout(timer)
  timer = setTimeout(persistir, 250)
}

export async function iniciarBD() {
  SQL = await initSqlJs({ locateFile: () => wasmUrl })
  let data = null
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) data = deBase64(raw)
  } catch {
    data = null
  }
  try {
    hdb = await crearBaseDeDatos(SQL, { schema, seed, data })
    hdb.get('SELECT COUNT(*) FROM Cliente')
  } catch {
    // Archivo guardado corrupto o de una versión anterior: se crea de nuevo
    hdb = await crearBaseDeDatos(SQL, { schema, seed })
  }
  hdb.subscribe(alCambiar)
  if (!data) persistir()
  return hdb
}

export const getDB = () => hdb

/** Base nueva en memoria (para las pruebas automáticas, no toca los datos de la demo). */
export const nuevaBD = () => crearBaseDeDatos(SQL, { schema, seed })

export function reiniciarBD() {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem('hauspe_session')
  } catch {
    /* nada */
  }
  window.location.reload()
}

export function descargarBD() {
  const blob = new Blob([hdb.exportar()], { type: 'application/vnd.sqlite3' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'hauspe.sqlite'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function descargarEsquema() {
  const blob = new Blob([schema], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'schema.sql'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export const esquemaSQL = schema

/** Re-renderiza el componente cada vez que cambia la base de datos. */
export function useDBVersion() {
  return useSyncExternalStore(
    (fn) => hdb.subscribe(fn),
    () => version,
  )
}
