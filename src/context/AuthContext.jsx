/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { load, save } from './storage'
import { getDB } from '../db/browser'
import * as repo from '../db/repo'

const SESSION_KEY = 'hauspe_session'

const AuthContext = createContext(null)

// Convierte la fila de la tabla Cliente al formato que usan las pantallas
export function toSession(c) {
  if (!c) return null
  return {
    id: c.id_cliente,
    name: c.nombre,
    email: c.email,
    whatsapp: c.telefono || '',
    segment: c.tipo_segmento === 'B2B' ? 'b2b' : 'b2c',
    businessType: c.tipo_b2b === 'IMPORTADOR' ? 'Importador extranjero' : c.tipo_b2b || undefined,
    company: c.empresa || undefined,
    taxId: c.ruc_taxid || undefined,
    country: c.pais,
    plan: c.plan,
  }
}

function sesionInicial() {
  const s = load(SESSION_KEY, null)
  const db = getDB()
  if (!s || !db || typeof s.id !== 'number') return null
  return toSession(repo.getCliente(db, s.id))
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(sesionInicial)

  const iniciar = useCallback((cliente) => {
    const session = toSession(cliente)
    save(SESSION_KEY, session)
    setUser(session)
  }, [])

  // Inserta en las tablas Cliente y Membresia (contraseña cifrada con SHA-256)
  const register = useCallback(async (data) => {
    try {
      const cliente = await repo.registrarCliente(getDB(), {
        nombre: data.name,
        email: data.email,
        password: data.password,
        telefono: data.whatsapp,
        tipo_segmento: data.segment === 'b2b' ? 'B2B' : 'B2C',
        tipo_b2b: data.segment === 'b2b' ? (data.businessType === 'HORECA' ? 'HORECA' : 'IMPORTADOR') : null,
        empresa: data.company,
        ruc_taxid: data.taxId,
        pais: data.country,
      })
      iniciar(cliente)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message.includes('registrado') ? 'Ya existe una cuenta con este correo.' : e.message }
    }
  }, [iniciar])

  const login = useCallback(async (email, password) => {
    const cliente = await repo.login(getDB(), email, password)
    if (!cliente) return { ok: false, error: 'Correo o contraseña incorrectos.' }
    iniciar(cliente)
    return { ok: true }
  }, [iniciar])

  const refreshUser = useCallback(() => {
    setUser((u) => (u ? toSession(repo.getCliente(getDB(), u.id)) : u))
  }, [])

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      /* sin almacenamiento */
    }
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, register, login, logout, refreshUser }), [user, register, login, logout, refreshUser])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
