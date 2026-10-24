import { Capacitor } from "@capacitor/core";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";
import { dbPost, dbPatch } from "./supabase";

/**
 * Clave pública de RevenueCat para el proyecto Android en Google Play Store.
 */
export const REVENUECAT_PUBLIC_KEY = "goog_hfnlWunhbTfrTUpuXlJNFIvRbTj";

/**
 * Identificadores oficiales de productos de suscripción en Google Play Console y RevenueCat.
 */
export const PLAY_BILLING_PRODUCTS = {
  CIVIL_PREMIUM: "flux_atleta_mensual",
  NUTRI_ESTUDIANTE: "flux_nutriologo_estudiante_mensual",
};

export const ENTITLEMENTS = {
  PREMIUM: "premium",
  NUTRI_ESTUDIANTE: "nutriologo_estudiante",
};

/**
 * Devuelve true únicamente cuando la app corre empaquetada de forma nativa en Android (Capacitor).
 * En web (PWA de escritorio o navegador móvil) devuelve false, mostrando las transferencias directas SPEI.
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
 * Inicializa RevenueCat Purchases en el cliente nativo con la API Key pública
 * y asocia opcionalmente el UID del usuario de Supabase.
 */
export async function initPlayBilling(userId = null) {
  if (!isNativePlayApp()) {
    return { supported: false, configured: false };
  }

  try {
    const configuredState = await Purchases.isConfigured();
    if (!configuredState.isConfigured) {
      try {
        await Purchases.setLogLevel({ level: LOG_LEVEL.INFO });
      } catch {}

      await Purchases.configure({
        apiKey: REVENUECAT_PUBLIC_KEY,
        appUserID: userId ? String(userId) : undefined,
      });
    } else if (userId) {
      try {
        const currentUid = await Purchases.getAppUserID();
        if (currentUid?.appUserID !== String(userId)) {
          await Purchases.logIn({ appUserID: String(userId) });
        }
      } catch (err) {
        console.warn("[RevenueCat] Error al sincronizar appUserID:", err);
      }
    }

    return { supported: true, configured: true };
  } catch (err) {
    console.error("[RevenueCat] Error al inicializar:", err);
    return { supported: true, configured: false, error: err };
  }
}

/**
 * Abre el panel de suscripciones de Google Play Store para que el usuario gestione
 * o cancele su suscripción directamente en la tienda.
 */
export function openPlayStoreSubscriptions(sku = "") {
  try {
    const url = sku
      ? `https://play.google.com/store/account/subscriptions?package=com.fluxsport.app&sku=${encodeURIComponent(sku)}`
      : "https://play.google.com/store/account/subscriptions";
    window.open(url, "_system");
  } catch {
    window.location.href = "https://play.google.com/store/account/subscriptions";
  }
}

/**
 * Registra automáticamente el recibo de compra aprobado en Supabase
 * para mantener la sincronización y vigencia interna de la app.
 */
async function recordStorePurchaseInSupabase({ role, userId, clienteId, productId, customerInfo }) {
  const targetId = clienteId || userId;
  if (!targetId) return null;

  // Calculamos la fecha de corte a 30 días a partir de hoy (o la fecha provista por Google)
  let expirationDateStr = null;
  try {
    const entitlement = customerInfo?.entitlements?.active?.[ENTITLEMENTS.PREMIUM] || customerInfo?.entitlements?.active?.[ENTITLEMENTS.NUTRI_ESTUDIANTE];
    if (entitlement?.expirationDate) {
      expirationDateStr = new Date(entitlement.expirationDate).toISOString().split("T")[0];
    }
  } catch {}

  if (!expirationDateStr) {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    expirationDateStr = d.toISOString().split("T")[0];
  }

  const transactionId = customerInfo?.originalAppUserId || Date.now();
  const comprobanteNota = `[Google Play] Pedido oficial procesado vía RevenueCat (ID: ${transactionId})`;

  if (role === "civil" || (!role && clienteId)) {
    // 1. Insertar recibo en recibos_pago_civil
    const recibo = await dbPost("recibos_pago_civil", {
      cliente_id: targetId,
      monto: 75,
      fecha_corte_mes: expirationDateStr,
      comprobante_url: comprobanteNota,
      estado: "aprobado",
    });

    // 2. Activar cliente como premium
    await dbPatch(`clientes?id=eq.${targetId}`, {
      plan_tipo: "premium",
      activo: true,
      deactivated_at: null,
    }).catch(() => {});

    return recibo;
  } else if (role === "nutriologo_estudiante" || role === "nutriologo") {
    // 1. Insertar recibo en recibos_pago
    const recibo = await dbPost("recibos_pago", {
      nutriologo_id: targetId,
      monto: 239,
      fecha_corte_mes: expirationDateStr,
      comprobante_url: comprobanteNota,
      estado: "aprobado",
    });

    // 2. Desbloquear perfil
    await dbPatch(`profiles?id=eq.${targetId}`, {
      bloqueado: false,
    }).catch(() => {});

    return recibo;
  }

  return null;
}

/**
 * Inicia el flujo de compra oficial de Google Play Billing a través del SDK de RevenueCat.
 */
export async function startGooglePlaySubscription(productId, userContext = {}) {
  if (!isNativePlayApp()) {
    throw new Error("Google Play Billing solo está disponible en la app instalada de Android.");
  }

  const resolvedUserId = userContext.clienteId || userContext.nutriologoId || localStorage.getItem("flux_client_id") || localStorage.getItem("flux_profile_id");
  const resolvedRole = userContext.role || localStorage.getItem("flux_role") || "civil";

  // Asegurar inicialización de RevenueCat
  await initPlayBilling(resolvedUserId);

  try {
    const productIdsToTry = [
      productId,
      `${productId}:mensual`,
      productId.replace(":mensual", ""),
    ];

    let foundProduct = null;
    let foundPackage = null;

    // 1. Primero intentamos por Offerings (recomendado por RevenueCat)
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current && offerings.current.availablePackages) {
        foundPackage = offerings.current.availablePackages.find((pkg) => {
          const ident = pkg.product?.identifier;
          return productIdsToTry.includes(ident) || pkg.identifier === "$rc_monthly" || pkg.identifier === "nutri_estudiante";
        });
      }
    } catch (e) {
      console.warn("[RevenueCat] No se pudieron obtener offerings, probando getProducts:", e);
    }

    if (foundPackage) {
      const purchaseResult = await Purchases.purchasePackage({ aPackage: foundPackage });
      await recordStorePurchaseInSupabase({
        role: resolvedRole,
        userId: resolvedUserId,
        clienteId: userContext.clienteId || resolvedUserId,
        productId,
        customerInfo: purchaseResult.customerInfo,
      });

      return {
        status: "purchased",
        productId,
        customerInfo: purchaseResult.customerInfo,
      };
    }

    // 2. Si no hubo paquete en offerings, intentamos consulta directa de productos
    const { products } = await Purchases.getProducts({ productIdentifiers: productIdsToTry });
    if (products && products.length > 0) {
      foundProduct = products[0];
    }

    if (!foundProduct) {
      console.warn("[RevenueCat] Producto no disponible en catálogo local:", productId);
      return { status: "unavailable_in_region_or_review", productId };
    }

    const purchaseResult = await Purchases.purchaseStoreProduct({ product: foundProduct });

    // Registrar compra aprobada en Supabase
    await recordStorePurchaseInSupabase({
      role: resolvedRole,
      userId: resolvedUserId,
      clienteId: userContext.clienteId || resolvedUserId,
      productId,
      customerInfo: purchaseResult.customerInfo,
    });

    return {
      status: "purchased",
      productId,
      customerInfo: purchaseResult.customerInfo,
    };
  } catch (err) {
    // Si el usuario simplemente canceló la ventana de compra de Google Play
    if (err?.userCancelled || err?.code === 1 || String(err?.message).includes("cancelled") || String(err?.message).includes("canceled")) {
      return { status: "cancelled", productId };
    }
    console.error("[RevenueCat] Error durante la compra:", err);
    throw new Error(err.message || "Error al comunicarse con Google Play.");
  }
}

/**
 * Restaura compras anteriores de Google Play (útil si el usuario cambió de teléfono
 * o reinstaló la aplicación).
 */
export async function restoreGooglePlayPurchases(userContext = {}) {
  if (!isNativePlayApp()) {
    throw new Error("La restauración de compras solo aplica en la app nativa de Android.");
  }

  const resolvedUserId = userContext.clienteId || userContext.nutriologoId || localStorage.getItem("flux_client_id") || localStorage.getItem("flux_profile_id");
  const resolvedRole = userContext.role || localStorage.getItem("flux_role") || "civil";

  await initPlayBilling(resolvedUserId);

  try {
    const { customerInfo } = await Purchases.restorePurchases();
    const hasPremium = Boolean(customerInfo?.entitlements?.active?.[ENTITLEMENTS.PREMIUM]);
    const hasEstudiante = Boolean(customerInfo?.entitlements?.active?.[ENTITLEMENTS.NUTRI_ESTUDIANTE]);

    if (hasPremium || hasEstudiante) {
      await recordStorePurchaseInSupabase({
        role: resolvedRole,
        userId: resolvedUserId,
        clienteId: userContext.clienteId || resolvedUserId,
        productId: hasPremium ? PLAY_BILLING_PRODUCTS.CIVIL_PREMIUM : PLAY_BILLING_PRODUCTS.NUTRI_ESTUDIANTE,
        customerInfo,
      });

      return { status: "restored", hasActiveEntitlement: true, customerInfo };
    }

    return { status: "no_active_purchases", hasActiveEntitlement: false, customerInfo };
  } catch (err) {
    console.error("[RevenueCat] Error al restaurar compras:", err);
    throw new Error(err.message || "No se pudieron restaurar las compras de Google Play.");
  }
}
