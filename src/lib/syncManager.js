import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { flushMutations, refreshStaleCache, getAuthToken, dbUpsert, initRealtimeSync } from "./supabase";
import { syncQueue } from "./offlineQueue";
import { prefetchSession } from "./prefetch";

let started = false;
let running = false;
let lastFocusSync = 0;

/** Envía lo pendiente y refresca datos modificados de forma pasiva en segundo plano. */
export const runSync = async () => {
  if (running || !navigator.onLine || !getAuthToken()) return;
  running = true;
  try {
    initRealtimeSync();
    await syncQueue(dbUpsert);   // cola heredada (versiones anteriores)
    await flushMutations();      // escrituras hechas sin internet
    await prefetchSession();     // precarga pasiva inteligente (usa caché local y respeta TTL)
    await refreshStaleCache(15 * 60 * 1000, 8); // solo refresca entradas invalidadas o >15 min
  } catch (e) {
    console.warn("[FLUX sync]", e?.message);
  } finally {
    running = false;
  }
};

/** Dispara la sincronización pasiva: al volver internet, recuperar foco o cada 5 minutos. */
export const initSyncManager = () => {
  if (started) return;
  started = true;

  initRealtimeSync();

  const onResumeOrFocus = () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    initRealtimeSync();
    const now = Date.now();
    if (now - lastFocusSync < 15000) return;
    lastFocusSync = now;
    runSync();
  };

  window.addEventListener("online", runSync);
  document.addEventListener("visibilitychange", onResumeOrFocus);
  window.addEventListener("focus", onResumeOrFocus);

  if (Capacitor.isNativePlatform()) {
    CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) onResumeOrFocus();
      else flushMutations().catch(() => {});
    });
  }

  // Sincronización pasiva periódica cada 5 minutos (el tiempo real va por WebSocket con 0 consumo extra)
  const syncIntervalMs = 5 * 60 * 1000;
  setInterval(() => {
    if (typeof document === "undefined" || document.visibilityState === "visible") {
      runSync();
    }
  }, syncIntervalMs);
  setTimeout(runSync, 1500);
};
