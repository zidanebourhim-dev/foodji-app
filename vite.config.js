import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Force Vite à ne JAMAIS transformer les images en texte (Base64)
    // Cela oblige le navigateur à les charger en parallèle (beaucoup plus rapide)
    assetsInlineLimit: 0, 
  },
})