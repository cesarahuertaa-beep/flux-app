import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

// The stack of registered back handlers: { id, handler, priority, order, pushedHistory }
const actionStack = [];
let nextOrder = 0;
let isInitialized = false;
let lastBackPressTime = 0;
let isPopStateEvent = false;
let toastElement = null;
let toastTimer = null;

/**
 * Show a sleek native-looking Android toast when user is at root and presses back
 */
function showToast(message = "Presiona atrás de nuevo para salir") {
  if (typeof document === "undefined") return;

  if (!toastElement) {
    toastElement = document.createElement("div");
    toastElement.id = "flux-back-toast";
    toastElement.style.cssText = `
      position: fixed;
      bottom: 85px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      background-color: rgba(11, 25, 41, 0.92);
      color: #ffffff;
      padding: 10px 22px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.2px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
      opacity: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    document.body.appendChild(toastElement);
  }

  toastElement.innerText = message;
  toastElement.style.opacity = "1";
  toastElement.style.transform = "translateX(-50%) translateY(0px)";

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (toastElement) {
      toastElement.style.opacity = "0";
      toastElement.style.transform = "translateX(-50%) translateY(8px)";
    }
  }, 2000);
}

/**
 * Register an action to be executed when the hardware/gesture back button is pressed.
 * Returns an unregister function.
 */
export function registerBackAction(handler, priority = 10, pushBrowserHistory = false) {
  const id = `back_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const order = nextOrder++;

  const item = { id, handler, priority, order, pushedHistory: false };
  actionStack.push(item);

  // In PWA/Web: push dummy history state so mobile browser swipe/back can be intercepted
  // ONLY if explicitly requested (e.g. for full-screen modals/lightboxes)
  if (pushBrowserHistory && typeof window !== "undefined" && !Capacitor.isNativePlatform()) {
    try {
      window.history.pushState({ flux_back_id: id }, "");
      item.pushedHistory = true;
    } catch (e) {
      // Ignore potential history limits
    }
  }

  return () => {
    const idx = actionStack.findIndex((x) => x.id === id);
    if (idx !== -1) {
      const removed = actionStack.splice(idx, 1)[0];
      // If closed programmatically in PWA and we pushed a state, revert it to avoid ghost history
      if (
        removed?.pushedHistory &&
        !isPopStateEvent &&
        typeof window !== "undefined" &&
        !Capacitor.isNativePlatform()
      ) {
        if (window.history.state && window.history.state.flux_back_id === id) {
          window.history.back();
        }
      }
    }
  };
}

/** True si hay algún modal / overlay abierto (todos se registran con useBackButton). */
export function hasOpenOverlay() {
  return actionStack.length > 0;
}

/**
 * Executes the highest priority (or most recent) back handler.
 * Returns true if an action was handled, false if the stack was empty.
 */
export function executeBackAction() {
  if (actionStack.length === 0) return false;

  // Find item with highest priority; if tied, highest order (most recent)
  let bestIdx = 0;
  for (let i = 1; i < actionStack.length; i++) {
    if (actionStack[i].priority > actionStack[bestIdx].priority) {
      bestIdx = i;
    } else if (
      actionStack[i].priority === actionStack[bestIdx].priority &&
      actionStack[i].order > actionStack[bestIdx].order
    ) {
      bestIdx = i;
    }
  }

  const [target] = actionStack.splice(bestIdx, 1);
  if (target && typeof target.handler === "function") {
    try {
      target.handler();
      return true;
    } catch (err) {
      console.error("[BackButtonHandler] Error executing handler:", err);
      return true;
    }
  }
  return false;
}

/**
 * Initializes listeners for Capacitor Native and Mobile PWA back events.
 * Safe to call multiple times (idempotent).
 */
export function initBackButtonHandler() {
  if (isInitialized) return;
  if (typeof window === "undefined") return;
  isInitialized = true;

  if (Capacitor.isNativePlatform()) {
    try {
      CapApp.addListener("backButton", () => {
        const handled = executeBackAction();
        if (handled) return;

        // User is at root level: Double tap to exit
        const now = Date.now();
        if (now - lastBackPressTime < 2000) {
          CapApp.exitApp();
        } else {
          lastBackPressTime = now;
          showToast("Presiona atrás de nuevo para salir");
        }
      });
    } catch (e) {
      console.warn("[BackButtonHandler] CapApp listener error:", e);
    }
  } else {
    window.addEventListener("popstate", () => {
      if (actionStack.length > 0) {
        isPopStateEvent = true;
        const handled = executeBackAction();
        isPopStateEvent = false;
        if (handled) {
          return;
        }
      }
    });
  }
}

/**
 * React Hook: useBackButton
 * Automatically registers an onClose callback when isOpen is true.
 * Automatically cleans up on unmount or when isOpen becomes false.
 *
 * @param {boolean} isOpen Whether the modal/overlay/subview is active
 * @param {Function} onClose Callback to close the modal/overlay/subview
 * @param {number} priority Priority level (default: 10). Modals usually 10-50, subviews 5.
 * @param {boolean} pushBrowserHistory Whether to push dummy state in browser history (default: false)
 */
export function useBackButton(isOpen, onClose, priority = 10, pushBrowserHistory = false) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || typeof onClose !== "function") return;

    const unregister = registerBackAction(() => {
      if (onCloseRef.current) {
        onCloseRef.current();
      }
    }, priority, pushBrowserHistory);

    return () => {
      unregister();
    };
  }, [isOpen, priority, pushBrowserHistory]);
}

