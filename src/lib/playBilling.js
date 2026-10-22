import { Capacitor } from "@capacitor/core";

/**
 * Identificadores de productos de suscripción en Google Play Console.
 * Cuando crees las suscripciones dentro de Google Play Console -> Monetización -> Suscripciones,
 * usa exactamente estos IDs de producto para que se enlacen automáticamente en la versión Android.
 */
export const PLAY_BILLING_PRODUCTS = {
  CIVIL_PREMIUM: "flux_civil_premium_mensual",
  NUTRI_ESTUDIANTE: "flux_nutri_estudiante_mensual",
  NUTRI_PRO_TIER1: "flux_nutri_pro_tier1_mensual",
  NUTRI_PRO_TIER2: "flux_nutri_pro_tier2_mensual",
  NUTRI_PRO_TIER3: "flux_nutri_pro_tier3_mensual",
};

/**
 * Devuelve true únicamente cuando la app corre empaquetada de forma nativa en Android/iOS (Capacitor).
 * En navegadores web (PC o móvil) devuelve false, manteniendo el flujo directo sin comisiones de tienda.
 */
export function isNativePlayApp() {
  try {
    const cap = typeof Capacitor !== "undefined" ? Capacitor : (typeof window !== "undefined" ? window.Capacitor : null);
    if (!cap) return false;
    return Boolean(cap.isNativePlatform() || (typeof cap.getPlatform === "function" && cap.getPlatform() === "android"));
  } catch {
    return false;
  }
}

/**
 * Inicia el flujo de compra nativa de Google Play Billing si el puente de facturación está activo
 * en el dispositivo y el producto ya fue dado de alta en Google Play Console.
 */
export async function startGooglePlaySubscription(productId) {
  if (!isNativePlayApp()) {
    throw new Error("Google Play Billing solo está disponible en la app nativa de Android.");
  }

  // Soporte para Digital Goods API / PaymentRequest de Google Play o plugin nativo CdvPurchase
  if (window.CdvPurchase && window.CdvPurchase.store) {
    const { store } = window.CdvPurchase;
    const product = store.get(productId);
    if (product && product.getOffer()) {
      await product.getOffer().order();
      return { status: "initiated", productId };
    }
  }

  if ("getDigitalGoodsService" in window) {
    try {
      const service = await window.getDigitalGoodsService("https://play.google.com/billing");
      if (service) {
        const details = await service.getDetails([productId]);
        if (details && details.length > 0) {
          const request = new PaymentRequest([
            {
              supportedMethods: "https://play.google.com/billing",
              data: { sku: productId },
            },
          ]);
          const response = await request.show();
          const { purchaseToken } = response.details;
          await response.complete("success");
          return { status: "purchased", productId, purchaseToken };
        }
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        return { status: "cancelled" };
      }
      console.warn("Google Play Billing Digital Goods:", err);
    }
  }

  // Si aún no está activo el producto en Google Play Console (ej. durante la revisión inicial)
  return { status: "unavailable_in_region_or_review", productId };
}
