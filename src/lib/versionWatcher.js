import { Capacitor } from "@capacitor/core";
import { hasOpenOverlay } from "./backButtonHandler";
import { flushMutations } from "./supabase";

/**
 * Auto-actualización de la versión web/PWA.
 *
 * - Detecta un despliegue nuevo comparando el bundle principal que está corriendo contra el
 *   que sirve el servidor en este momento (index.html nunca se cachea).
 * - Si el usuario NO está editando, recarga de inmediato y en silencio.
 * - Si está dentro de un modal / escribiendo, espera a que lo cierre (guardar o cancelar) y
 *   entonces se actualiza. Nunca se pierde trabajo y no se muestra ningún aviso.
 * - La sesión vive en localStorage y NO se toca: el usuario sigue con su sesión iniciada.
 */

const CHECK_EVERY_MS = 45000;
const IDLE_BEFORE_RELOAD_MS = 1500; // margen para que termine un guardado en curso
const RELOAD_GUARD_KEY = "flux_version_reload_at";

let started = false;
let pendingVersion = null;
let applying = false;

const MAIN_BUNDLE_RE = /\/assets\/index-[\w-]+\.js/;

const currentBundle = () => {
  const el = [...document.querySelectorAll("script[src]")].find((s) => MAIN_BUNDLE_RE.test(s.src));
  const m = el?.src.match(MAIN_BUNDLE_RE);
  return m ? m[0] : null;
};

const fetchServerBundle = async () => {
  const r = await fetch(`/index.html?_v=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  if (!r.ok) return null;
  const html = await r.text();
  const m = html.match(MAIN_BUNDLE_RE);
  return m ? m[0] : null;
};

/** ¿El usuario está en medio de una edición? */
const isUserBusy = () => {
  if (hasOpenOverlay()) return true;
  const a = document.activeElement;
  if (a && (a.tagName === "TEXTAREA" || a.isContentEditable)) return true;
  if (a && a.tagName === "INPUT" && !["button", "checkbox", "radio", "submit", "range"].includes(a.type)) return true;
  return false;
};

const applyWhenIdle = () => {
  if (applying || !pendingVersion) return;
  applying = true;

  let idleSince = null;
  const tick = async () => {
    if (isUserBusy()) {
      idleSince = null;
      setTimeout(tick, 1000);
      return;
    }
    if (!idleSince) idleSince = Date.now();
    if (Date.now() - idleSince < IDLE_BEFORE_RELOAD_MS) {
      setTimeout(tick, 500);
      return;
    }
    // Evitar bucles si el CDN aún sirve la versión anterior
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (Date.now() - last < 20000) {
      applying = false;
      return;
    }
    // Enviar lo pendiente (escrituras hechas sin internet) antes de recargar
    try {
      await Promise.race([flushMutations(), new Promise((r) => setTimeout(r, 4000))]);
    } catch { /* ignore */ }
    if (isUserBusy()) {
      idleSince = null;
      setTimeout(tick, 1000);
      return;
    }
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    window.location.reload();
  };
  tick();
};

export const checkForNewVersion = async () => {
  if (pendingVersion || typeof navigator === "undefined" || navigator.onLine === false) return;
  const running = currentBundle();
  if (!running) return; // modo desarrollo o entorno sin bundle con hash
  try {
    const server = await fetchServerBundle();
    if (server && server !== running) {
      pendingVersion = server;
      applyWhenIdle();
    }
  } catch { /* sin red: reintentar en el siguiente ciclo */ }
};

export const initVersionWatcher = () => {
  if (started) return;
  if (typeof window === "undefined") return;
  // La app nativa (Play Store) se actualiza por Google Play; el código está empaquetado.
  if (Capacitor.isNativePlatform() || window.location.protocol === "file:") return;
  started = true;

  const onVisible = () => {
    if (document.visibilityState === "visible") checkForNewVersion();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", checkForNewVersion);
  window.addEventListener("online", checkForNewVersion);
  setInterval(checkForNewVersion, CHECK_EVERY_MS);
  setTimeout(checkForNewVersion, 3000);
};
