import { storageUpload } from "./supabase";
import {
  CATALOGO_PLATILLOS_BASE,
  CATEGORIAS_PLATILLOS,
  KEY_PLATILLOS_SMAE,
} from "./foodPhotoCatalog";
import {
  INGREDIENTES_CATALOGO,
  CATEGORIAS_INGREDIENTES,
  KEY_SMAE_ALIMENTOS,
  getIngredientSmaeInfo,
} from "./ingredientsCatalog";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;

const REMOTE_PLATILLOS_FILE = "biblioteca_platillos_smae_v2.json";
const REMOTE_INGREDIENTES_FILE = "biblioteca_smae_alimentos_v2.json";

export { CATEGORIAS_PLATILLOS, CATEGORIAS_INGREDIENTES };

/**
 * Devuelve la lista en memoria/localStorage de platillos inmediatamente (zero-lag).
 */
export function peekCustomPlatillos() {
  try {
    const raw = localStorage.getItem(KEY_PLATILLOS_SMAE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return CATALOGO_PLATILLOS_BASE;
}

/**
 * Devuelve la lista en memoria/localStorage de Alimentos SMAE inmediatamente.
 */
export function peekCustomIngredientes() {
  try {
    const raw = localStorage.getItem(KEY_SMAE_ALIMENTOS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item) => getIngredientSmaeInfo(item));
      }
    }
  } catch {}
  return INGREDIENTES_CATALOGO.map((item) => getIngredientSmaeInfo(item));
}

/**
 * Sincroniza y descarga la base de datos de Platillos SMAE desde Supabase Storage.
 */
export async function fetchCustomPlatillos() {
  const local = peekCustomPlatillos();
  if (!SUPA_URL) return local;
  try {
    const url = `${SUPA_URL}/storage/v1/object/public/logos/${REMOTE_PLATILLOS_FILE}?t=${Date.now()}`;
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        try {
          localStorage.setItem(KEY_PLATILLOS_SMAE, JSON.stringify(data));
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
 * Sincroniza y descarga la base de datos de Alimentos SMAE desde Supabase Storage.
 */
export async function fetchCustomIngredientes() {
  const local = peekCustomIngredientes();
  if (!SUPA_URL) return local;
  try {
    const url = `${SUPA_URL}/storage/v1/object/public/logos/${REMOTE_INGREDIENTES_FILE}?t=${Date.now()}`;
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        const enriched = data.map((item) => getIngredientSmaeInfo(item));
        try {
          localStorage.setItem(KEY_SMAE_ALIMENTOS, JSON.stringify(enriched));
        } catch {}
        return enriched;
      }
    }
  } catch (e) {
    console.warn("fetchCustomIngredientes:", e);
  }
  return local;
}

/**
 * Guarda y propaga la lista de platillos SMAE en la nube (Supabase Storage) y caché local.
 */
export async function saveCustomPlatillos(newList) {
  try {
    localStorage.setItem(KEY_PLATILLOS_SMAE, JSON.stringify(newList));
  } catch {}
  try {
    const blob = new Blob([JSON.stringify(newList, null, 2)], {
      type: "application/json",
    });
    await storageUpload("logos", REMOTE_PLATILLOS_FILE, blob, {
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
 * Guarda y propaga la lista de Alimentos SMAE en la nube (Supabase Storage) y caché local.
 */
export async function saveCustomIngredientes(newList) {
  const enriched = (newList || []).map((item) => getIngredientSmaeInfo(item));
  try {
    localStorage.setItem(KEY_SMAE_ALIMENTOS, JSON.stringify(enriched));
  } catch {}
  try {
    const blob = new Blob([JSON.stringify(enriched, null, 2)], {
      type: "application/json",
    });
    await storageUpload("logos", REMOTE_INGREDIENTES_FILE, blob, {
      upsert: true,
    });
    window.dispatchEvent(
      new CustomEvent("flux:ingredientes-updated", { detail: enriched })
    );
  } catch (e) {
    console.error("Error guardando alimentos SMAE en nube:", e);
  }
  return enriched;
}
