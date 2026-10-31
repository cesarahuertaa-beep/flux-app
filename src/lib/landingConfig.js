import { storageUpload } from "./supabase";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const KEY_LANDING_CONFIG = "flux_landing_tienda_config";

export const DEFAULT_LANDING_CONFIG = {
  // Lista de números de ventas para rotación / balanceo
  whatsapp_ventas_numeros: [
    { id: "v1", nombre: "Ventas Principal", numero: "7751016733", activo: true }
  ],
  whatsapp_ventas: "7751016733",
  whatsapp_mensaje: "¡Hola FLUX! Me interesa adquirir [producto] por $[precio].",
  tienda_activa: true,

  // Configuración de Play Store y Descargas
  playstore_url: "https://play.google.com/store/apps/details?id=com.fluxsport.app",
  playstore_activo: false, // true = publicado para todos, false = fase beta/testers
  qr_destino_url: "https://www.flux-sport.com/app",
  qr_imagen_url: "",

  // Canales de contacto y soporte
  whatsapp_soporte: "7751016733",
  email_contacto: "Flux.Sport.C@gmail.com",
  instagram_url: "",
  tiktok_url: "",
  youtube_url: "",
  facebook_url: "",
  app_screenshots: [], // array de { id, url, title }
  external_links: {} // mapa { [prodId]: url }
};

/**
 * Devuelve la configuración de Landing/Tienda en memoria/localStorage inmediatamente.
 */
export function peekLandingConfig() {
  try {
    const raw = localStorage.getItem(KEY_LANDING_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_LANDING_CONFIG, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_LANDING_CONFIG };
}

/**
 * Obtiene la configuración desde Supabase Storage (tienda_config.json) con fallback.
 */
export async function fetchLandingConfig() {
  const local = peekLandingConfig();
  if (!SUPA_URL) return local;
  try {
    const url = `${SUPA_URL}/storage/v1/object/public/logos/tienda_config.json?t=${Date.now()}`;
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) {
      const data = await r.json();
      if (data && typeof data === "object") {
        const merged = { ...DEFAULT_LANDING_CONFIG, ...data };
        // Asegurar estructura de números de WhatsApp
        if (!Array.isArray(merged.whatsapp_ventas_numeros) || merged.whatsapp_ventas_numeros.length === 0) {
          merged.whatsapp_ventas_numeros = [
            { id: "v1", nombre: "Ventas Principal", numero: merged.whatsapp_ventas || "7751016733", activo: true }
          ];
        }
        try {
          localStorage.setItem(KEY_LANDING_CONFIG, JSON.stringify(merged));
        } catch {}
        return merged;
      }
    }
  } catch (e) {
    console.warn("fetchLandingConfig:", e);
  }
  return local;
}

/**
 * Guarda la configuración en Supabase Storage y localmente, notificando a las vistas.
 */
export async function saveLandingConfig(newConfig) {
  const merged = { ...DEFAULT_LANDING_CONFIG, ...newConfig };
  try {
    localStorage.setItem(KEY_LANDING_CONFIG, JSON.stringify(merged));
  } catch {}
  try {
    const blob = new Blob([JSON.stringify(merged, null, 2)], {
      type: "application/json",
    });
    await storageUpload("logos", "tienda_config.json", blob, { upsert: true });
    window.dispatchEvent(
      new CustomEvent("flux:landing-config-updated", { detail: merged })
    );
  } catch (e) {
    console.error("Error guardando config de tienda/landing en nube:", e);
  }
  return merged;
}

/**
 * Formatea un número de WhatsApp para enlace internacional (por defecto México +52).
 */
export function formatWhatsAppUrl(number, message = "") {
  if (!number) return "#";
  const clean = String(number).replace(/\D/g, "");
  const fullNumber = clean.length === 10 ? `52${clean}` : clean;
  const encodedMsg = message ? encodeURIComponent(message) : "";
  return `https://wa.me/${fullNumber}${encodedMsg ? `?text=${encodedMsg}` : ""}`;
}

/**
 * Obtiene un número de ventas activo rotando aleatoriamente entre los asesores habilitados.
 */
export function getActiveSalesWhatsApp(config) {
  const list = Array.isArray(config?.whatsapp_ventas_numeros) ? config.whatsapp_ventas_numeros : [];
  const activeList = list.filter(item => item && item.activo !== false && String(item.numero || '').replace(/\D/g, ''));
  if (activeList.length > 0) {
    const chosen = activeList[Math.floor(Math.random() * activeList.length)];
    return chosen.numero;
  }
  return config?.whatsapp_ventas || "7751016733";
}
