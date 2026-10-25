import { useEffect, useRef } from "react";
import { dbGet, dbPatch, restoreProfileId } from "../../lib/supabase";

const SHOWN_STORAGE_KEY = "flux_shown_notif_ids";

function getShownIds() {
  try {
    const raw = localStorage.getItem(SHOWN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function markIdAsShownLocal(id) {
  if (!id) return;
  try {
    const list = getShownIds();
    const strId = String(id);
    if (!list.includes(strId)) {
      list.push(strId);
      const trimmed = list.length > 120 ? list.slice(list.length - 120) : list;
      localStorage.setItem(SHOWN_STORAGE_KEY, JSON.stringify(trimmed));
    }
  } catch {}
}

function isIdShownLocal(id) {
  if (!id) return false;
  const strId = String(id);
  try {
    if (
      typeof window !== "undefined" &&
      window.FluxNotificationsNative &&
      typeof window.FluxNotificationsNative.isAlreadyShown === "function"
    ) {
      if (window.FluxNotificationsNative.isAlreadyShown(strId)) return true;
    }
  } catch {}
  return getShownIds().includes(strId);
}

export function triggerSystemNotification(id, title, message, linkUrl = "") {
  const safeId = id ? String(id) : "";
  if (safeId && isIdShownLocal(safeId)) return;
  if (safeId) markIdAsShownLocal(safeId);

  // 1. Android Nativo: Barra de estado / Barra de tareas del sistema
  if (
    typeof window !== "undefined" &&
    window.FluxNotificationsNative &&
    typeof window.FluxNotificationsNative.showNotification === "function"
  ) {
    try {
      window.FluxNotificationsNative.showNotification(
        safeId,
        title || "FLUX",
        message || "",
        linkUrl || ""
      );
      return;
    } catch {}
  }

  // 2. PWA / Web Desktop: Web Notification API
  if (typeof window !== "undefined" && "Notification" in window) {
    try {
      if (window.Notification.permission === "granted") {
        const n = new window.Notification(title || "FLUX", {
          body: message || "",
          icon: "/flux_logo.jpeg",
          badge: "/flux_logo.jpeg",
        });
        n.onclick = () => {
          try {
            window.focus();
            if (linkUrl) {
              window.dispatchEvent(
                new CustomEvent("flux:notification-click", { detail: { linkUrl } })
              );
            }
            n.close();
          } catch {}
        };
      }
    } catch {}
  }
}

export default function NotificationManager({ session }) {
  const checkingRef = useRef(false);
  const profileId =
    session?.profileId ||
    session?.data?.auth_id ||
    (session?.role !== "cliente" && session?.role !== "civil" ? session?.data?.id : null) ||
    restoreProfileId();

  // Solicitar permisos de notificaciones (Android 13+ o PWA/Web tras interacción)
  useEffect(() => {
    if (!profileId) return;

    if (
      typeof window !== "undefined" &&
      window.FluxNotificationsNative &&
      typeof window.FluxNotificationsNative.hasPermission === "function"
    ) {
      try {
        if (!window.FluxNotificationsNative.hasPermission()) {
          window.FluxNotificationsNative.requestPermission();
        }
      } catch {}
      return;
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      if (window.Notification.permission === "default") {
        const requestOnGesture = () => {
          try {
            window.Notification.requestPermission();
          } catch {}
          window.removeEventListener("click", requestOnGesture);
          window.removeEventListener("touchstart", requestOnGesture);
        };
        window.addEventListener("click", requestOnGesture, { once: true });
        window.addEventListener("touchstart", requestOnGesture, { once: true });
        return () => {
          window.removeEventListener("click", requestOnGesture);
          window.removeEventListener("touchstart", requestOnGesture);
        };
      }
    }
  }, [profileId]);

  // Escuchar clics en notificaciones de la barra de tareas para navegar a la pestaña correspondiente
  useEffect(() => {
    const applyNavigation = (rawLink) => {
      if (!rawLink) return;
      const role = session?.role || localStorage.getItem("flux_role") || "";
      let targetTab = rawLink;

      if (role === "cliente") {
        if (rawLink === "agenda" || rawLink === "citas") targetTab = "citas";
        else if (rawLink === "mi_plan" || rawLink === "nutricion") targetTab = "nutricion";
        else if (rawLink === "deporte" || rawLink === "rutinas") targetTab = "deporte";
        else if (rawLink === "progreso") targetTab = "progreso";
        sessionStorage.setItem("flux_cliente_tab", targetTab);
      } else {
        if (rawLink === "citas") targetTab = "agenda";
        sessionStorage.setItem("flux_admin_tab", targetTab);
      }

      window.dispatchEvent(
        new CustomEvent("flux:navigate-tab", { detail: { tab: targetTab } })
      );
    };

    const pending = sessionStorage.getItem("flux_pending_notif_link");
    if (pending) {
      sessionStorage.removeItem("flux_pending_notif_link");
      applyNavigation(pending);
    }

    const onNotifClick = (e) => {
      const linkUrl = e?.detail?.linkUrl;
      if (linkUrl) {
        sessionStorage.removeItem("flux_pending_notif_link");
        applyNavigation(linkUrl);
      }
    };

    window.addEventListener("flux:notification-click", onNotifClick);
    return () => window.removeEventListener("flux:notification-click", onNotifClick);
  }, [session?.role]);

  // Sondeo de notificaciones no leídas (en tiempo real mientras la app está abierta o al volver a ella)
  useEffect(() => {
    if (!profileId) return;

    const checkUnread = async () => {
      if (checkingRef.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      checkingRef.current = true;
      try {
        const rows = await dbGet(
          `notificaciones?profile_id=eq.${profileId}&leida=eq.false&order=created_at.asc&limit=15`,
          { forceRefresh: true }
        );
        if (Array.isArray(rows) && rows.length > 0) {
          for (const n of rows) {
            if (!n?.id) continue;
            if (!isIdShownLocal(n.id)) {
              triggerSystemNotification(
                n.id,
                n.titulo || "Notificación FLUX",
                n.mensaje || "",
                n.link_url || ""
              );
            }
            try {
              await dbPatch(`notificaciones?id=eq.${n.id}`, { leida: true });
            } catch {}
          }
        }
      } catch {
        // Silencioso en caso de desconexión temporal
      } finally {
        checkingRef.current = false;
      }
    };

    checkUnread();
    const interval = setInterval(checkUnread, 20000);

    const onFocusOrSync = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        checkUnread();
      }
    };

    window.addEventListener("focus", onFocusOrSync);
    window.addEventListener("visibilitychange", onFocusOrSync);
    window.addEventListener("flux:synced", onFocusOrSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocusOrSync);
      window.removeEventListener("visibilitychange", onFocusOrSync);
      window.removeEventListener("flux:synced", onFocusOrSync);
    };
  }, [profileId]);

  return null;
}
