import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { flushMutations, refreshStaleCache, getAuthToken, dbUpsert } from "./supabase";
import { syncQueue } from "./offlineQueue";
import { prefetchSession } from "./prefetch";

let started = false;
let running = false;

/** Envía lo pendiente y refresca datos viejos. Seguro de llamar muchas veces. */
export const runSync = async () => {
  if (running || !navigator.onLine || !getAuthToken()) return;
  running = true;
  try {
    await syncQueue(dbUpsert);   // cola heredada (versiones anteriores)
    await flushMutations();      // escrituras hechas sin internet
    await prefetchSession();     // precarga todo lo del paciente/atleta para usarlo offline
    await refreshStaleCache();   // últimos datos siempre al día
  } catch (e) {
    console.warn("[FLUX sync]", e?.message);
  } finally {
    running = false;
  }
};

/** Dispara la sincronización al volver internet, abrir la app, o cada minuto. */
export const initSyncManager = () => {
  if (started) return;
  started = true;
  window.addEventListener("online", runSync);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) runSync(); });
  if (Capacitor.isNativePlatform()) {
    CapApp.addListener("appStateChange", ({ isActive }) => { if (isActive) runSync(); });
  }
  setInterval(() => { if (!document.hidden) runSync(); }, 60000);
  setTimeout(runSync, 3000);
};
