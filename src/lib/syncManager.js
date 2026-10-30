import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { flushMutations, refreshStaleCache, getAuthToken, dbUpsert, initRealtimeSync } from "./supabase";
import { syncQueue } from "./offlineQueue";
import { prefetchSession } from "./prefetch";

let started = false;
let running = false;

/** Envía lo pendiente y refresca datos viejos de forma pasiva en segundo plano. Seguro de llamar muchas veces. */
export const runSync = async () => {
  if (running || !navigator.onLine || !getAuthToken()) return;
  running = true;
  try {
    initRealtimeSync();
    await syncQueue(dbUpsert);   // cola heredada (versiones anteriores)
    await flushMutations();      // escrituras hechas sin internet
    await prefetchSession();     // precarga pasiva de rutinas, dietas, fotos y GIFs
    await refreshStaleCache(15000, 35); // últimos datos siempre al día
  } catch (e) {
    console.warn("[FLUX sync]", e?.message);
  } finally {
    running = false;
  }
};

/** Dispara la sincronización continua pasiva: al volver internet, cambiar estado o periódicamente. */
export const initSyncManager = () => {
  if (started) return;
  started = true;

  initRealtimeSync();

  window.addEventListener("online", runSync);
  document.addEventListener("visibilitychange", () => {
    runSync();
    // Al volver a la pestaña/app: pedir de nuevo todos los datos activos para mostrar siempre lo último
    if (document.visibilityState === "visible") refreshStaleCache(0, 40).catch(() => {});
  });
  window.addEventListener("focus", () => {
    initRealtimeSync();
    refreshStaleCache(0, 40).catch(() => {});
  });

  if (Capacitor.isNativePlatform()) {
    CapApp.addListener("appStateChange", () => runSync());
  }

  // Pulso rápido de sincronización cuando la pestaña está activa (respaldo ante firewalls que filtren WebSockets)
  setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState === "visible" && navigator.onLine) {
      refreshStaleCache(8000, 25).catch(() => {});
    }
  }, 10000);

  // Ejecución pasiva periódica continua
  setInterval(() => runSync(), 45000);
  setTimeout(runSync, 1200);
};
