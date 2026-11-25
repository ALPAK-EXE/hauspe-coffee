import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: funciona en cualquier subcarpeta de GitHub Pages
  base: './',
  plugins: [react()],
  // En local, /api se reenvía a la API (scripts/dev-api.mjs). En Vercel, /api son funciones serverless.
  server: { proxy: { '/api': { target: `http://localhost:${process.env.API_PORT || 3001}`, changeOrigin: true } } },
  preview: { proxy: { '/api': { target: `http://localhost:${process.env.API_PORT || 3001}`, changeOrigin: true } } },
})
