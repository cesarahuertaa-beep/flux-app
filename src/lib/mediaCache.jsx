import React, { useState, useEffect } from "react";

const CACHE_NAME = "flux-media-v1";
const REGISTRY_KEY = "flux_cached_media_registry";
const QUEUE_KEY = "flux_pending_media_queue";
// Máximo 2 descargas de fondo simultáneas para nunca saturar el límite de 6 conexiones de iOS Safari
const MAX_CONCURRENT = 2;

// Cache en memoria para URLs de Blobs (0 ms de latencia en re-renders y navegaciones)
const blobUrlMap = new Map();

// Promesas de descarga en vuelo para deduplicar peticiones simultáneas a la misma URL (0 doble egress)
const inFlightFetches = new Map();

// Instancia única de CacheStorage para evitar bloqueos de I/O concurrentes en WebKit/Safari
let _cacheInstancePromise = null;
const openMediaCache = () => {
  if (typeof window === "undefined" || !("caches" in window)) return Promise.resolve(null);
  if (!_cacheInstancePromise) {
    _cacheInstancePromise = caches.open(CACHE_NAME).catch(() => {
      _cacheInstancePromise = null;
      return null;
    });
  }
  return _cacheInstancePromise;
};

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
    const cache = await openMediaCache();
    if (!cache) return null;
    const match = await cache.match(url);
    if (match) {
      const blob = await match.blob();
      const blobUrl = URL.createObjectURL(blob);
      blobUrlMap.set(url, blobUrl);
      knownCachedUrls.add(url);
      persistRegistry();
      return blobUrl;
    } else if (knownCachedUrls.has(url)) {
      // Si el navegador purgó la caché pero localStorage la recordaba, limpiar el registro falso
      knownCachedUrls.delete(url);
      persistRegistry();
    }
  } catch (e) {
    // Silencioso ante errores de quota o modo incógnito
  }
  return null;
};

/**
 * Descarga una sola vez (deduplicada), guarda en CacheStorage y devuelve el blobUrl en memoria.
 */
export const fetchAndCacheMediaUrl = async (url) => {
  if (!url || typeof window === "undefined" || !("caches" in window)) return null;
  if (blobUrlMap.has(url)) return blobUrlMap.get(url);
  if (!url.startsWith("http://") && !url.startsWith("https://")) return null;

  const existingCached = await getCachedMediaUrl(url);
  if (existingCached) return existingCached;

  if (!navigator.onLine) return null;

  if (inFlightFetches.has(url)) {
    return inFlightFetches.get(url);
  }

  const fetchPromise = (async () => {
    try {
      const cache = await openMediaCache();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const resp = await fetch(url, {
        mode: "cors",
        cache: "force-cache",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        if (cache) {
          await cache.put(url, resp.clone()).catch(() => {});
        }
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        blobUrlMap.set(url, blobUrl);
        knownCachedUrls.add(url);
        persistRegistry();
        return blobUrl;
      }
    } catch {
      // Si falla o se aborta por timeout/CORS, devolver null para usar fallback
    }
    return null;
  })().finally(() => {
    inFlightFetches.delete(url);
  });

  inFlightFetches.set(url, fetchPromise);
  return fetchPromise;
};

/**
 * Descarga y guarda en la caché del teléfono una imagen o GIF con timeout de seguridad (15s).
 */
export const cacheMediaUrl = async (url) => {
  const blobUrl = await fetchAndCacheMediaUrl(url);
  return Boolean(blobUrl);
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
  loading = "lazy",
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

    // 1. Revisar caché en memoria (instantáneo, 0 ms)
    if (blobUrlMap.has(src)) {
      setDisplaySrc(blobUrlMap.get(src));
      setHasError(false);
      return;
    }

    setDisplaySrc(null);
    setHasError(false);

    // Rutas locales relativas (ej. /flux_logo.jpeg) o data/blob URLs no requieren CacheStorage
    if (!src.startsWith("http://") && !src.startsWith("https://")) {
      setDisplaySrc(src);
      return;
    }

    // 2. Intentar cargar desde el almacenamiento en disco primero (evita pedir a Supabase lo ya guardado)
    getCachedMediaUrl(src).then((cachedBlob) => {
      if (!isMounted) return;
      if (cachedBlob) {
        setDisplaySrc(cachedBlob);
        setHasError(false);
      } else if (navigator.onLine) {
        const isVid = /\.(mp4|webm|mov)($|\?)/i.test(src);
        if (isVid) {
          setDisplaySrc(src);
          setHasError(false);
          backgroundDownloader.enqueue([src]);
        } else {
          // Descargar una sola vez (deduplicada), guardar en CacheStorage y mostrar blobUrl.
          // Si es un servidor externo sin CORS, usar la URL directa como respaldo.
          fetchAndCacheMediaUrl(src).then((blobUrl) => {
            if (!isMounted) return;
            setDisplaySrc(blobUrl || src);
            setHasError(false);
          });
        }
      } else {
        // Offline y no estaba en disco: mostrar fallback sin disparar petición de red
        setDisplaySrc(null);
        setHasError(true);
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
        if (cachedBlob && cachedBlob !== displaySrc) {
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

  // En offline sin copia local, o mienras resuelve CacheStorage/descarga, mostrar fallback sin disparar red prematura
  if (!src || hasError || !displaySrc) {
    return fallback ? <>{fallback}</> : null;
  }

  const isVideo = /\.(mp4|webm|mov)($|\?)/i.test(src);

  if (isVideo) {
    return (
      <video
        src={displaySrc}
        className={className}
        style={style}
        preload="metadata"
        autoPlay
        loop
        muted
        playsInline
        onError={handleError}
        onClick={onClick}
      />
    );
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      style={style}
      onError={handleError}
      onClick={onClick}
    />
  );
}
