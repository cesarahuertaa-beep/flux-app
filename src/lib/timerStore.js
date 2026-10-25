// Global workout rest timer store (singleton)
// Persists across tab switches and syncs with the Android Native Floating Overlay Bubble (DiDi-style)

const PRESET_STORAGE_KEY = "flux_timer_quick_preset";
const STATE_STORAGE_KEY = "flux_timer_active_state";

let audioCtx = null;
let activeOsc = null;
let tickInterval = null;

const listeners = new Set();

function loadInitialPreset() {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (raw !== null && raw !== "") {
      const n = parseInt(raw, 10);
      if (!isNaN(n) && n > 0) return n;
    }
  } catch (e) {}
  return null; // null means no preset configured yet -> shows "+"
}

let state = {
  seconds: 90,
  initialSeconds: 90,
  status: "IDLE", // "IDLE" | "RUNNING" | "ALARMING"
  endTime: null,  // timestamp in ms when RUNNING
  brandColor: "#00B4D8",
  presetSeconds: loadInitialPreset(),
  isProgrammingPreset: false,
  inTrainingView: false,
};

function notify() {
  const snapshot = { ...state };
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch (e) {}
  });
}

function syncNativeBridge() {
  try {
    if (typeof window !== "undefined" && window.FluxTimerNative) {
      if (state.status === "RUNNING" && state.endTime) {
        window.FluxTimerNative.setTimerState(
          state.endTime,
          state.initialSeconds || 90,
          state.brandColor || "#00B4D8",
          true
        );
      } else {
        window.FluxTimerNative.stopTimer();
      }
    }
  } catch (e) {}
}

export function checkAndRequestOverlayPermission() {
  try {
    if (typeof window !== "undefined" && window.FluxTimerNative) {
      const hasPerm = window.FluxTimerNative.canDrawOverlays();
      if (!hasPerm) {
        // Only prompt once per install unless user explicitly triggers it
        const prompted = localStorage.getItem("flux_overlay_perm_prompted");
        if (!prompted) {
          localStorage.setItem("flux_overlay_perm_prompted", "1");
          window.FluxTimerNative.requestOverlayPermission();
        }
      }
    }
  } catch (e) {}
}

function startAlarmInternal() {
  state.status = "ALARMING";
  state.seconds = 0;
  state.endTime = null;
  notify();

  // If app is currently visible, play web alarm & vibrate
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    if (navigator.vibrate) {
      const pattern = [];
      for (let i = 0; i < 15; i++) pattern.push(450, 350);
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === "suspended") audioCtx.resume();

      if (activeOsc) {
        try {
          activeOsc.stop();
        } catch (e) {}
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);

      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      for (let i = 0; i < 15; i++) {
        gain.gain.setValueAtTime(0.9, audioCtx.currentTime + i * 0.8);
        gain.gain.setValueAtTime(0, audioCtx.currentTime + i * 0.8 + 0.4);
      }

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      activeOsc = osc;
    } catch (e) {}
  }
}

export function stopAlarmInternal() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(0);
    } catch (e) {}
  }
  if (activeOsc) {
    try {
      activeOsc.stop();
    } catch (e) {}
    activeOsc = null;
  }
}

function ensureTicker() {
  if (tickInterval) clearInterval(tickInterval);
  if (state.status !== "RUNNING") return;

  tickInterval = setInterval(() => {
    if (state.status !== "RUNNING" || !state.endTime) {
      clearInterval(tickInterval);
      tickInterval = null;
      return;
    }
    const remainingMs = state.endTime - Date.now();
    if (remainingMs <= 200) {
      clearInterval(tickInterval);
      tickInterval = null;
      startAlarmInternal();
    } else {
      const nextSec = Math.ceil(remainingMs / 1000);
      if (nextSec !== state.seconds) {
        state.seconds = nextSec;
        notify();
      }
    }
  }, 200);
}

export const timerStore = {
  getState: () => ({ ...state }),

  subscribe: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  setBrandColor: (color) => {
    if (color && color !== state.brandColor) {
      state.brandColor = color;
      if (state.status === "RUNNING") syncNativeBridge();
    }
  },

  setInTrainingView: (inView) => {
    if (state.inTrainingView !== inView) {
      state.inTrainingView = inView;
      notify();
    }
  },

  setSeconds: (newSeconds, updateInitial = true) => {
    const clamped = Math.max(0, Math.min(5999, Math.round(newSeconds)));
    state.seconds = clamped;
    if (updateInitial && !state.isProgrammingPreset) {
      state.initialSeconds = clamped;
    }
    notify();
  },

  start: () => {
    if (state.seconds <= 0) return;
    if (state.isProgrammingPreset) {
      state.isProgrammingPreset = false;
    }
    stopAlarmInternal();
    checkAndRequestOverlayPermission();
    state.initialSeconds = state.seconds;
    state.endTime = Date.now() + state.seconds * 1000;
    state.status = "RUNNING";
    syncNativeBridge();
    ensureTicker();
    notify();
  },

  stopAndReset: () => {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    stopAlarmInternal();
    state.status = "IDLE";
    state.endTime = null;
    state.seconds = state.initialSeconds;
    syncNativeBridge();
    notify();
  },

  toggleAction: () => {
    if (state.status === "IDLE") {
      if (state.seconds > 0) timerStore.start();
    } else {
      timerStore.stopAndReset();
    }
  },

  // Quick-access "+" / MIN:SEG button logic
  enterPresetProgramming: () => {
    if (state.status !== "IDLE") {
      timerStore.stopAndReset();
    }
    state.isProgrammingPreset = true;
    if (state.presetSeconds !== null && state.presetSeconds > 0) {
      state.seconds = state.presetSeconds;
    }
    notify();
  },

  savePresetFromCurrent: () => {
    const val = Math.max(5, state.seconds || 60);
    state.presetSeconds = val;
    state.isProgrammingPreset = false;
    state.seconds = val;
    state.initialSeconds = val;
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, String(val));
    } catch (e) {}
    notify();
  },

  cancelPresetProgramming: () => {
    state.isProgrammingPreset = false;
    state.seconds = state.initialSeconds;
    notify();
  },

  applyPreset: () => {
    if (state.presetSeconds === null) {
      timerStore.enterPresetProgramming();
      return;
    }
    if (state.status !== "IDLE") {
      timerStore.stopAndReset();
    }
    state.isProgrammingPreset = false;
    state.seconds = state.presetSeconds;
    state.initialSeconds = state.presetSeconds;
    notify();
  },
};

// Keep timer accurate when returning from background
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.status === "RUNNING" && state.endTime) {
      const rem = state.endTime - Date.now();
      if (rem <= 0) {
        if (tickInterval) {
          clearInterval(tickInterval);
          tickInterval = null;
        }
        startAlarmInternal();
      } else {
        state.seconds = Math.ceil(rem / 1000);
        notify();
      }
    }
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("flux:overlay-timer-stopped", () => {
    timerStore.stopAndReset();
  });
}
