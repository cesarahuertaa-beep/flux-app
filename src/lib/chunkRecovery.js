import { lazy } from "react";
import { Capacitor } from "@capacitor/core";
import { hasNewServerVersion } from "./versionWatcher";

const CHUNK_RETRY_AT_KEY = "flux_chunk_retry";
const CHUNK_RETRY_COUNT_KEY = "flux_chunk_retry_count";
const RETRY_WINDOW_MS = 20000;

/** Indica si el error corresponde a la carga fallida de un chunk JS/CSS dinámico. */
export function isChunkLoadError(err) {
  if (!err) return false;
  const msg = String(err?.message || err || "");
  return (
    err?.name === "ChunkLoadError" ||
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("Expected a JavaScript") ||
    msg.includes("vite:preloadError")
  );
}

/** Recarga la aplicación saltándose cachés obsoletas de HTML/SW sin tocar sesión ni caché multimedia. */
export function reloadWithCacheBust() {
  if (typeof window === "undefined") return;
  try {
    navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    if (window.caches) {
      caches.keys().then((ks) =>
        ks.forEach((k) => {
          if (k !== "flux-media-v1") caches.delete(k);
        })
      );
    }
  } catch { /* ignore */ }

  if (
    Capacitor.isNativePlatform() ||
    window.location.protocol === "file:" ||
    window.location.protocol === "app:"
  ) {
    window.location.reload();
    return;
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.set("_cb", String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

/** Autorecupera fallos de carga de chunks recargando si hay versión nueva o dentro del límite de reintentos. */
export async function tryAutoRecoverChunk(err) {
  if (!isChunkLoadError(err)) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;

  try {
    const now = Date.now();
    const last = Number(sessionStorage.getItem(CHUNK_RETRY_AT_KEY) || 0);
    const prevCount =
      now - last < RETRY_WINDOW_MS
        ? Number(sessionStorage.getItem(CHUNK_RETRY_COUNT_KEY) || 0)
        : 0;

    if (prevCount >= 2) return false;

    const serverChanged = await hasNewServerVersion().catch(() => false);
    if (prevCount === 0 || serverChanged) {
      sessionStorage.setItem(CHUNK_RETRY_AT_KEY, String(now));
      sessionStorage.setItem(CHUNK_RETRY_COUNT_KEY, String(prevCount + 1));
      reloadWithCacheBust();
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

/** Envuelve React.lazy con reintento breve de red y recarga automática ante despliegues nuevos. */
export function lazyWithRetry(importer) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (firstErr) {
      if (isChunkLoadError(firstErr) && (typeof navigator === "undefined" || navigator.onLine !== false)) {
        const serverChanged = await hasNewServerVersion().catch(() => false);
        if (!serverChanged) {
          await new Promise((r) => setTimeout(r, 350));
          try {
            return await importer();
          } catch { /* continuar a autorecuperación */ }
        }
        const recovered = await tryAutoRecoverChunk(firstErr);
        if (recovered) return new Promise(() => {});
      }
      throw firstErr;
    }
  });
}
