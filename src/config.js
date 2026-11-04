// URL pública donde se publica el sitio (GitHub Pages). Cámbiala aquí si el repositorio o el usuario cambian.
export const PUBLIC_BASE_URL = 'https://alpak-exe.github.io/hauspe-coffee/'

// En desarrollo los QR apuntan al servidor local para poder probarlos con el celular.
const siteBase = () => (import.meta.env.DEV ? `${window.location.origin}/` : PUBLIC_BASE_URL)

// URL del pasaporte de un lote o de un empaque (HashRouter)
export const passportUrl = (code) => `${siteBase()}#/qr/${encodeURIComponent(code)}`
