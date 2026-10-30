import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Se conserva el manifest (instalable como app) pero sin caché de código: el sw.js que se
      // publica se autodestruye y limpia cachés viejas en los usuarios que aún lo tengan instalado.
      selfDestroying: true,
      injectRegister: false,
      includeAssets: ['flux_logo.jpeg', 'flux-favicon.ico'],
      manifest: {
        name: 'FLUX - Sport Supplements',
        short_name: 'FLUX',
        description: 'Plataforma de nutrición y entrenamiento personalizado',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/?pwa=true',
        icons: [
          {
            src: 'flux_logo.jpeg',
            sizes: '192x192',
            type: 'image/jpeg',
            purpose: 'any maskable'
          },
          {
            src: 'flux_logo.jpeg',
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ]
      }
    })
  ],
})
