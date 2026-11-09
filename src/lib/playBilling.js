import { Capacitor } from "@capacitor/core";

/**
 * Detector ligero de plataforma nativa (Android / iOS vía Capacitor).
 * Bajo el modelo Multi-Platform (estilo Netflix / Spotify), la app nativa
 * funciona en modo lectura de membresía y toda la contratación/facturación
 * se administra exclusivamente desde el portal web de FLUX.
 *
 * No incluye SDKs de facturación de tiendas ni llaves de terceros.
 */
export function isNativePlayApp() {
  try {
    const cap =
      typeof Capacitor !== "undefined"
        ? Capacitor
        : typeof window !== "undefined"
        ? window.Capacitor
        : null;
    if (!cap) return false;
    return Boolean(
      cap.isNativePlatform() ||
        (typeof cap.getPlatform === "function" &&
          (cap.getPlatform() === "android" || cap.getPlatform() === "ios"))
    );
  } catch {
    return false;
  }
}

export async function initPlayBilling() {
  return { supported: false, configured: false };
}
