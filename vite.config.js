import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-helmet-async'],
          firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth'] // À ajuster si tu utilises d'autres services comme firebase/storage
        }
      }
    }
  }
});
