// Sesiones: token JWT firmado (HS256, jose) en una cookie httpOnly. Dura 8 horas.
import { SignJWT, jwtVerify } from 'jose'

export const COOKIE = 'hp_sesion'
export const HORAS = 8

function clave() {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) throw Object.assign(new Error('SESSION_SECRET no está configurada en el servidor'), { status: 500 })
  return new TextEncoder().encode(s)
}

/** datos: { tipo: 'cliente' | 'personal', id, nombre, ... } */
export function firmar(datos) {
  return new SignJWT({ ...datos })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(`${datos.tipo}:${datos.id}`)
    .setIssuedAt()
    .setExpirationTime(`${HORAS}h`)
    .sign(clave())
}

const leerCookie = (req, nombre) => {
  const c = String(req.headers?.cookie || '').split(/;\s*/).find((x) => x.startsWith(nombre + '='))
  return c ? decodeURIComponent(c.slice(nombre.length + 1)) : null
}

/** Devuelve los datos de la sesión o null si no hay cookie, está vencida o fue alterada. */
export async function leerSesion(req) {
  const token = leerCookie(req, COOKIE)
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, clave(), { algorithms: ['HS256'] })
    return payload
  } catch (e) {
    if (e?.status === 500) throw e
    return null
  }
}

const ATRIBUTOS = 'Path=/; HttpOnly; Secure; SameSite=Lax'
export const cookieSesion = (token) => `${COOKIE}=${encodeURIComponent(token)}; Max-Age=${HORAS * 3600}; ${ATRIBUTOS}`
export const cookieBorrada = () => `${COOKIE}=; Max-Age=0; ${ATRIBUTOS}`
