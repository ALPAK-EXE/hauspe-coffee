/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { load, save } from './storage'

const USERS_KEY = 'hauspe_users'
const SESSION_KEY = 'hauspe_session'

const AuthContext = createContext(null)

function withoutPassword(record) {
  const session = { ...record }
  delete session.password
  return session
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => load(SESSION_KEY, null))

  const register = useCallback((data) => {
    const users = load(USERS_KEY, [])
    const email = data.email.trim().toLowerCase()
    if (users.some((u) => u.email === email)) {
      return { ok: false, error: 'Ya existe una cuenta con este correo.' }
    }
    // Prototipo: la contraseña se guarda tal cual. En un sistema real iría cifrada en un servidor.
    const record = { ...data, email, id: crypto.randomUUID(), createdAt: Date.now() }
    save(USERS_KEY, [...users, record])
    const session = withoutPassword(record)
    save(SESSION_KEY, session)
    setUser(session)
    return { ok: true }
  }, [])

  const login = useCallback((emailInput, password) => {
    const email = emailInput.trim().toLowerCase()
    const found = load(USERS_KEY, []).find((u) => u.email === email)
    if (!found || found.password !== password) {
      return { ok: false, error: 'Correo o contraseña incorrectos.' }
    }
    const session = withoutPassword(found)
    save(SESSION_KEY, session)
    setUser(session)
    return { ok: true }
  }, [])

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      /* sin almacenamiento */
    }
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, register, login, logout }), [user, register, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
