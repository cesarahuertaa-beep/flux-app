import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { flushMutations, refreshStaleCache, getAuthToken, dbUpsert } from "./supabase";
import { syncQueue } from "./offlineQueue";
import { prefetchSession } from "./prefetch";

let started = false;
let running = false;

/** Envía lo pendiente y refresca datos viejos de forma pasiva en segundo plano. Seguro de llamar muchas veces. */
export const runSync = async () => {
  if (running || !navigator.onLine || !getAuthToken()) return;
  running = true;
  try {
    await syncQueue(dbUpsert);   // cola heredada (versiones anteriores)
    await flushMutations();      // escrituras hechas sin internet
    await prefetchSession();     // precarga pasiva de rutinas, dietas, fotos y GIFs
    await refreshStaleCache();   // últimos datos siempre al día
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

  window.addEventListener("online", runSync);
  document.addEventListener("visibilitychange", () => runSync());

  if (Capacitor.isNativePlatform()) {
    CapApp.addListener("appStateChange", () => runSync());
  }

  // Ejecución pasiva periódica continua (no se apaga al estar en background)
  setInterval(() => runSync(), 60000);
  setTimeout(runSync, 1500);
};
