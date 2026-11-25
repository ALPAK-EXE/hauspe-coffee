/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../db/data'

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

// Fila de la tabla Empleado (personal del panel /admin)
const toStaff = (e) => (e ? { id: e.id, name: e.nombre, email: e.email, rol: e.rol, codigo: e.codigo, pestanas: e.pestanas || [] } : null)

/**
 * Hay UNA sola sesión a la vez: de cliente (tienda) o de personal (panel /admin).
 * La sesión real vive en una cookie httpOnly que pone el servidor; aquí solo se guarda lo que se muestra en pantalla.
 */
export function AuthProvider({ children }) {
  const [estado, setEstado] = useState({ user: null, staff: null, cargando: true })

  const aplicar = useCallback((yo) => {
    if (yo?.tipo === 'cliente') setEstado({ user: toSession(yo.cliente), staff: null, cargando: false })
    else if (yo?.tipo === 'personal') setEstado({ user: null, staff: toStaff(yo), cargando: false })
    else setEstado({ user: null, staff: null, cargando: false })
  }, [])

  // Al abrir la app se pregunta al servidor quién tiene la sesión (la cookie vive 8 horas)
  useEffect(() => {
    let vivo = true
    try { localStorage.removeItem('hauspe_session') } catch { /* sesión antigua guardada en el navegador */ }
    api.yo().then((yo) => vivo && aplicar(yo)).catch(() => vivo && aplicar(null))
    return () => { vivo = false }
  }, [aplicar])

  // Cualquier respuesta 401 de la API (sesión vencida) cierra la sesión en pantalla
  useEffect(() => {
    const vencida = () => setEstado((e) => (e.user || e.staff ? { user: null, staff: null, cargando: false } : e))
    window.addEventListener('hp:sesion-vencida', vencida)
    return () => window.removeEventListener('hp:sesion-vencida', vencida)
  }, [])

  // Inserta en las tablas Cliente y Membresia (contraseña cifrada con bcrypt en el servidor)
  const register = useCallback(async (data) => {
    try {
      const cliente = await api.registrar({
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
      aplicar({ tipo: 'cliente', cliente })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message.includes('registrado') ? 'Ya existe una cuenta con este correo.' : e.message }
    }
  }, [aplicar])

  const login = useCallback(async (email, password) => {
    try {
      const cliente = await api.login(email, password)
      if (!cliente) return { ok: false, error: 'Correo o contraseña incorrectos.' }
      aplicar({ tipo: 'cliente', cliente })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }, [aplicar])

  const loginStaff = useCallback(async (email, password) => {
    try {
      const empleado = await api.loginPersonal(email, password)
      if (!empleado) return { ok: false, error: 'Correo o contraseña incorrectos.' }
      aplicar(empleado)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }, [aplicar])

  const refreshUser = useCallback(async () => {
    try { aplicar(await api.yo()) } catch { /* sin red: se conserva lo que se ve */ }
  }, [aplicar])

  // Cierra la sesión de cliente o de personal (borra la cookie en el servidor)
  const logout = useCallback(async () => {
    setEstado({ user: null, staff: null, cargando: false })
    try { await api.cerrarSesion() } catch { /* aunque falle la red, en pantalla ya se cerró */ }
  }, [])

  const { user, staff, cargando } = estado
  const value = useMemo(
    () => ({ user, staff, cargando, register, login, loginStaff, logout, refreshUser }),
    [user, staff, cargando, register, login, loginStaff, logout, refreshUser],
  )
  // Hasta saber si hay sesión no se pinta nada: así las rutas protegidas no redirigen por error
  if (cargando) return <p style={{ padding: 40, fontFamily: 'Inter, sans-serif' }}>Comprobando tu sesión…</p>
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
