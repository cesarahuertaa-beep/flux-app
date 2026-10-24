import React, { useState, useEffect } from "react";

const CACHE_NAME = "flux-media-v1";
const REGISTRY_KEY = "flux_cached_media_registry";
const QUEUE_KEY = "flux_pending_media_queue";
const MAX_CONCURRENT = 6;

// Cache en memoria para URLs de Blobs (0 ms de latencia en re-renders y navegaciones)
const blobUrlMap = new Map();

// Registro en memoria de URLs que sabemos que están guardadas en disco
const knownCachedUrls = new Set();

// Cargar el registro previo de URLs cacheadas desde localStorage
try {
  const saved = JSON.parse(localStorage.getItem(REGISTRY_KEY) || "[]");
  if (Array.isArray(saved)) {
    saved.forEach(u => knownCachedUrls.add(u));
  }
} catch { /* ignore */ }

let saveRegistryTimer = null;
const persistRegistry = () => {
  if (saveRegistryTimer) return;
  saveRegistryTimer = setTimeout(() => {
    saveRegistryTimer = null;
    try {
      // Guardar hasta las últimas 2500 URLs cacheadas
      const arr = Array.from(knownCachedUrls).slice(-2500);
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(arr));
    } catch { /* ignore quota */ }
  }, 3000);
};

/**
 * Consulta síncrona (0 ms): ¿está este recurso registrado como descargado en el teléfono?
 */
export const isMediaCachedSync = (url) => {
  if (!url) return false;
  return blobUrlMap.has(url) || knownCachedUrls.has(url);
};

/**
 * Obtiene la URL local (blob) de un recurso en caché.
 * Si ya está en memoria, devuelve el blobUrl de inmediato.
 * Si está en disco, lee el blob, crea la URL y la almacena en memoria para futuras lecturas instantáneas.
 */
export const getCachedMediaUrl = async (url) => {
  if (!url || typeof window === "undefined" || !("caches" in window)) return null;
  if (blobUrlMap.has(url)) return blobUrlMap.get(url);

  try {
    const cache = await caches.open(CACHE_NAME);
    const match = await cache.match(url);
    if (match) {
      const blob = await match.blob();
      const blobUrl = URL.createObjectURL(blob);
      blobUrlMap.set(url, blobUrl);
      knownCachedUrls.add(url);
      persistRegistry();
      return blobUrl;
    }
  } catch (e) {
    // Silencioso ante errores de quota o modo incógnito
  }
  return null;
};

/**
 * Descarga y guarda en la caché del teléfono una imagen o GIF con timeout de seguridad (15s).
 */
export const cacheMediaUrl = async (url) => {
  if (!url || typeof window === "undefined" || !("caches" in window)) return false;
  if (!navigator.onLine) return false;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  if (knownCachedUrls.has(url) && blobUrlMap.has(url)) return true;

  try {
    const cache = await caches.open(CACHE_NAME);
    const existing = await cache.match(url);
    if (existing) {
      knownCachedUrls.add(url);
      persistRegistry();
      return true;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(url, { 
      mode: "cors", 
      cache: "force-cache",
      signal: controller.signal 
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      await cache.put(url, resp.clone());
      knownCachedUrls.add(url);
      persistRegistry();
      return true;
    }
  } catch {
    // Si falla o se aborta por timeout, la cola reintentará automáticamente
  }
  return false;
};

// ══════════════════════════════════════════════════════════════════════
// MOTOR DE DESCARGA PASIVO Y CONSTANTE EN SEGUNDO PLANO (Background Queue)
// ══════════════════════════════════════════════════════════════════════

class MediaDownloadManager {
  constructor() {
    this.queue = [];
    this.inFlight = new Set();
    this.activeWorkers = 0;
    this.loadPendingQueue();

    // Reanudar descarga pasiva en cuanto vuelva la conexión
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.resume());
    }
  }

  loadPendingQueue() {
    try {
      const pending = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
      if (Array.isArray(pending) && pending.length > 0) {
        this.enqueue(pending);
      }
    } catch { /* ignore */ }
  }

  savePendingQueue() {
    try {
      const toSave = this.queue.slice(0, 500);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(toSave));
    } catch { /* ignore */ }
  }

  enqueue(urls = []) {
    if (!Array.isArray(urls) || !urls.length) return;
    let added = false;

    for (const raw of urls) {
      if (!raw || typeof raw !== "string" || !raw.startsWith("http")) continue;
      // Si ya sabemos que está en caché o ya está en la cola, no duplicar
      if (knownCachedUrls.has(raw) || this.inFlight.has(raw) || this.queue.includes(raw)) continue;
      this.queue.push(raw);
      added = true;
    }

    if (added) {
      this.savePendingQueue();
      this.pump();
    }
  }

  resume() {
    if (navigator.onLine && this.queue.length > 0) {
      this.pump();
    }
  }

  pump() {
    if (!navigator.onLine) return;

    while (this.activeWorkers < MAX_CONCURRENT && this.queue.length > 0) {
      const url = this.queue.shift();
      if (!url) break;

      this.activeWorkers++;
      this.inFlight.add(url);
      this.savePendingQueue();

      cacheMediaUrl(url)
        .then((ok) => {
          if (!ok && navigator.onLine) {
            // Si falló pero hay internet, reinsertar al final de la cola con retraso
            setTimeout(() => {
              if (!knownCachedUrls.has(url)) {
                this.queue.push(url);
                this.pump();
              }
            }, 5000);
          }
        })
        .finally(() => {
          this.activeWorkers--;
          this.inFlight.delete(url);
          this.savePendingQueue();
          this.pump();
        });
    }
  }
}

const backgroundDownloader = new MediaDownloadManager();

/**
 * Encola una lista de URLs para descarga pasiva, paralela y constante en segundo plano.
 * Nunca bloquea la interfaz de usuario ni requiere que el usuario haga nada.
 */
export const precacheMediaList = (urls = []) => {
  backgroundDownloader.enqueue(urls);
};

/**
 * Componente de imagen/GIF con soporte offline 100% transparente.
 *  - Si está en memoria (blobUrlMap), se muestra en 0 ms sin parpadeos.
 *  - Si está en disco, se decodifica y muestra en cuanto el blob está listo.
 *  - Si no hay internet y no está en caché, muestra el fallback estilizado sin provocar errores de red.
 *  - Si hay internet y aún no se había descargado, lo muestra y lo manda a guardar pasivamente al disco.
 */
export function CachedImage({
  src,
  alt = "",
  className = "",
  fallback = null,
  loading = "eager",
  style = {},
  onClick
}) {
  const [displaySrc, setDisplaySrc] = useState(() => (src && blobUrlMap.get(src)) || null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!src) {
      setDisplaySrc(null);
      setHasError(false);
      return;
    }

    // 1. Revisar caché en memoria (instantáneo)
    if (blobUrlMap.has(src)) {
      setDisplaySrc(blobUrlMap.get(src));
      setHasError(false);
      return;
    }

    setHasError(false);

    // 2. Intentar cargar desde el almacenamiento en disco
    getCachedMediaUrl(src).then((cachedBlob) => {
      if (!isMounted) return;
      if (cachedBlob) {
        setDisplaySrc(cachedBlob);
        setHasError(false);
      } else {
        if (navigator.onLine) {
          // Si hay internet, mostrar la imagen y encolarla para descarga pasiva al disco
          setDisplaySrc(src);
          setHasError(false);
          backgroundDownloader.enqueue([src]);
        } else {
          // Si estamos offline y NO estaba en disco, marcar error para mostrar fallback sin intentar fetch
          setDisplaySrc(null);
          setHasError(true);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [src]);

  const handleError = () => {
    // Si la URL falló (ej. se cayó la red), intentar recuperar desde caché local
    if (src) {
      getCachedMediaUrl(src).then((cachedBlob) => {
        if (cachedBlob) {
          setDisplaySrc(cachedBlob);
          setHasError(false);
        } else {
          setHasError(true);
        }
      });
    } else {
      setHasError(true);
    }
  };

  // En offline, si no hay displaySrc o hubo error, mostrar fallback directamente
  if (!src || hasError || (!displaySrc && !navigator.onLine)) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <img
      src={displaySrc || src}
      alt={alt}
      className={className}
      loading={loading}
      style={style}
      onError={handleError}
      onClick={onClick}
    />
  );
}
