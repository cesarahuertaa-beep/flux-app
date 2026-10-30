import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { hydrateOfflineCache } from './lib/supabase'
import { initVersionWatcher } from './lib/versionWatcher'

// Sin Service Worker de caché de código en ninguna plataforma: la web/PWA siempre carga la
// versión más reciente desde el servidor y la app nativa (Play Store) ya trae todo empaquetado.
// Se eliminan SW y cachés de código heredados. La sesión (localStorage) y los datos offline
// (IndexedDB) NO se tocan: el usuario sigue con su sesión iniciada.
try {
  navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()))
  if (window.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)))
} catch { /* ignore */ }

// Detector de despliegues nuevos (solo web/PWA): se actualiza solo cuando el usuario no está editando
initVersionWatcher()

const boot = () =>
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

// Cargar los últimos datos guardados (IndexedDB + caché nativa WorkManager) antes de pintar
Promise.race([
  hydrateOfflineCache().catch(() => {}),
  new Promise((r) => setTimeout(r, 3500)),
]).then(boot, boot)
