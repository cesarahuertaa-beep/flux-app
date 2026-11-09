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
  if (window.caches) {
    caches.keys().then((ks) =>
      ks.forEach((k) => {
        if (k !== 'flux-media-v1') caches.delete(k)
      }),
    )
  }
} catch { /* ignore */ }

// Detector de despliegues nuevos (solo web/PWA): se actualiza solo cuando el usuario no está editando
initVersionWatcher()

// Prevenir desplazamiento residual del viewport en iOS Safari / PWA tras cerrar el teclado virtual
if (typeof window !== 'undefined') {
  window.addEventListener('focusout', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) {
      setTimeout(() => {
        if (window.scrollY !== 0 && !document.activeElement?.matches?.('input, textarea, select')) {
          window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
        }
      }, 100)
    }
  })
}

const boot = () =>
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

// Iniciar hidratación de IndexedDB inmediatamente; si hay sesión activa dar un breve margen (450ms)
// para lectura síncrona (dbPeek), sin bloquear el arranque en iOS Safari si IndexedDB demora.
const hydrationTask = hydrateOfflineCache().catch(() => {})
let hasActiveSession = false
try {
  hasActiveSession = Boolean(localStorage.getItem('flux_role'))
} catch { /* ignore */ }

if (hasActiveSession) {
  Promise.race([
    hydrationTask,
    new Promise((r) => setTimeout(r, 450)),
  ]).then(boot, boot)
} else {
  boot()
}
