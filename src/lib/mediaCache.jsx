import React, { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";

const CACHE_NAME = "flux-media-v1";

// Cache en memoria para URLs de Blobs (evita recrear blobs si ya están en memoria)
const blobUrlMap = new Map();

/**
 * Obtiene la URL local (blob) de un recurso en caché.
 * Si no está en caché, devuelve null.
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
      return blobUrl;
    }
  } catch (e) {
    // Si la Cache API falla por storage quota o modo incógnito
  }
  return null;
};

/**
 * Descarga y guarda en la caché del teléfono una imagen o GIF.
 */
export const cacheMediaUrl = async (url) => {
  if (!url || typeof window === "undefined" || !("caches" in window)) return false;
  if (!navigator.onLine) return false;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;

  try {
    const cache = await caches.open(CACHE_NAME);
    const existing = await cache.match(url);
    if (existing) return true;

    const resp = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (resp.ok) {
      await cache.put(url, resp.clone());
      return true;
    }
  } catch (e) {
    // Silencioso: no bloquea la navegación si falla una descarga
  }
  return false;
};

/**
 * Descarga en segundo plano una lista de URLs multimedia (ej. GIFs de la rutina activa)
 * con límite de concurrencia para no saturar la red.
 */
export const precacheMediaList = async (urls = [], maxConcurrent = 3) => {
  if (!urls || !urls.length || !navigator.onLine) return;
  const uniqueUrls = Array.from(new Set(urls.filter(u => u && typeof u === "string" && u.startsWith("http"))));
  if (!uniqueUrls.length) return;

  const queue = [...uniqueUrls];
  const workers = Array.from({ length: Math.min(maxConcurrent, queue.length) }, async () => {
    while (queue.length > 0) {
      const nextUrl = queue.shift();
      if (nextUrl) {
        await cacheMediaUrl(nextUrl).catch(() => {});
      }
    }
  });

  await Promise.all(workers);
};

/**
 * Componente de imagen/GIF con soporte offline 100%.
 *  - Si está en caché, lo carga instantáneamente de la memoria del teléfono.
 *  - Si hay internet, lo muestra y lo guarda en segundo plano para el futuro.
 *  - Si no hay internet y no está en caché, muestra el fallback estilizado sin romper el layout.
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
  const [displaySrc, setDisplaySrc] = useState(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!src) {
      setDisplaySrc(null);
      setHasError(false);
      return;
    }

    setHasError(false);

    // 1. Intentar cargar desde caché local
    getCachedMediaUrl(src).then((cachedBlob) => {
      if (!isMounted) return;
      if (cachedBlob) {
        setDisplaySrc(cachedBlob);
      } else {
        // 2. Si no está en caché, usar la URL original y mandar a guardar en segundo plano
        setDisplaySrc(src);
        if (navigator.onLine) {
          cacheMediaUrl(src).catch(() => {});
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [src]);

  const handleError = () => {
    // Si falló la URL remota (ej: se fue la red a mitad de carga), intentar de nuevo con caché
    if (src && displaySrc !== null) {
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

  if (!src || hasError) {
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
