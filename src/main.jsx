import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.jsx'
import { hydrateOfflineCache } from './lib/supabase'

// Service Worker solo en web/PWA. En la app nativa (Play Store) todo ya está empaquetado
// localmente y el SW solo añade latencia y riesgo de archivos viejos.
if (Capacitor.isNativePlatform()) {
  try {
    navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()))
    window.caches?.keys().then((ks) => ks.forEach((k) => window.caches.delete(k)))
  } catch { /* ignore */ }
} else if (window.location.protocol !== 'file:') {
  import('virtual:pwa-register').then((m) => m.registerSW({ immediate: true })).catch(() => {})
}

const boot = () =>
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

// Cargar los últimos datos guardados (IndexedDB) antes de pintar, con tope de 1.2 s
Promise.race([
  hydrateOfflineCache().catch(() => {}),
  new Promise((r) => setTimeout(r, 1200)),
]).then(boot, boot)
