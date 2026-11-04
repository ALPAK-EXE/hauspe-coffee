import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: funciona en cualquier subcarpeta de GitHub Pages
  base: './',
  plugins: [react()],
})
