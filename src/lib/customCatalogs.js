import { storageUpload } from "./supabase";
import { CATALOGO_PLATILLOS_BASE, CATEGORIAS_PLATILLOS } from "./foodPhotoCatalog";
import { INGREDIENTES_CATALOGO, CATEGORIAS_INGREDIENTES } from "./ingredientsCatalog";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;

const KEY_PLATILLOS = "flux_biblioteca_platillos";
const KEY_INGREDIENTES = "flux_biblioteca_ingredientes";

export { CATEGORIAS_PLATILLOS, CATEGORIAS_INGREDIENTES };

/**
 * Devuelve la lista en memoria/localStorage de platillos inmediatamente (zero-lag).
 */
export function peekCustomPlatillos() {
  try {
    const raw = localStorage.getItem(KEY_PLATILLOS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return CATALOGO_PLATILLOS_BASE;
}

/**
 * Devuelve la lista en memoria/localStorage de ingredientes inmediatamente.
 */
export function peekCustomIngredientes() {
  try {
    const raw = localStorage.getItem(KEY_INGREDIENTES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return INGREDIENTES_CATALOGO;
}

/**
 * Sincroniza y descarga la base de datos de Platillos desde Supabase Storage.
 */
export async function fetchCustomPlatillos() {
  const local = peekCustomPlatillos();
  if (!SUPA_URL) return local;
  try {
    const url = `${SUPA_URL}/storage/v1/object/public/logos/biblioteca_platillos.json?t=${Date.now()}`;
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        try {
          localStorage.setItem(KEY_PLATILLOS, JSON.stringify(data));
        } catch {}
        return data;
      }
    }
  } catch (e) {
    console.warn("fetchCustomPlatillos:", e);
  }
  return local;
}

/**
 * Sincroniza y descarga la base de datos de Ingredientes desde Supabase Storage.
 */
export async function fetchCustomIngredientes() {
  const local = peekCustomIngredientes();
  if (!SUPA_URL) return local;
  try {
    const url = `${SUPA_URL}/storage/v1/object/public/logos/biblioteca_ingredientes.json?t=${Date.now()}`;
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        try {
          localStorage.setItem(KEY_INGREDIENTES, JSON.stringify(data));
        } catch {}
        return data;
      }
    }
  } catch (e) {
    console.warn("fetchCustomIngredientes:", e);
  }
  return local;
}

/**
 * Guarda y propaga la lista de platillos en la nube y caché local.
 */
export async function saveCustomPlatillos(newList) {
  try {
    localStorage.setItem(KEY_PLATILLOS, JSON.stringify(newList));
  } catch {}
  try {
    const blob = new Blob([JSON.stringify(newList, null, 2)], {
      type: "application/json",
    });
    await storageUpload("logos", "biblioteca_platillos.json", blob, {
      upsert: true,
    });
    window.dispatchEvent(
      new CustomEvent("flux:platillos-updated", { detail: newList })
    );
  } catch (e) {
    console.error("Error guardando platillos en nube:", e);
  }
  return newList;
}

/**
 * Guarda y propaga la lista de ingredientes en la nube y caché local.
 */
export async function saveCustomIngredientes(newList) {
  try {
    localStorage.setItem(KEY_INGREDIENTES, JSON.stringify(newList));
  } catch {}
  try {
    const blob = new Blob([JSON.stringify(newList, null, 2)], {
      type: "application/json",
    });
    await storageUpload("logos", "biblioteca_ingredientes.json", blob, {
      upsert: true,
    });
    window.dispatchEvent(
      new CustomEvent("flux:ingredientes-updated", { detail: newList })
    );
  } catch (e) {
    console.error("Error guardando ingredientes en nube:", e);
  }
  return newList;
}
