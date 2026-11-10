import { dbGet, dbUpsert, dbDel, storageUpload } from "./supabase";
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

function mapRowToPlatillo(row) {
  if (!row) return null;
  return {
    id: row.id,
    nombre: row.nombre || "",
    categoria: row.categoria || "comida",
    texto: row.texto || "",
    foto_url: row.foto_url || "",
    smae_equivalentes:
      row.smae_equivalentes && typeof row.smae_equivalentes === "object"
        ? row.smae_equivalentes
        : {},
    tags_restriccion: Array.isArray(row.tags_restriccion) ? row.tags_restriccion : [],
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    calorias: Number(row.calorias) || 0,
    proteina: Number(row.proteina) || 0,
    carbohidratos: Number(row.carbohidratos) || 0,
    grasas: Number(row.grasas) || 0,
  };
}

function mapPlatilloToRow(p) {
  return {
    id: p.id || `platillo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    nombre: p.nombre || "Platillo",
    categoria: p.categoria || "comida",
    texto: p.texto || "",
    foto_url: p.foto_url || "",
    smae_equivalentes: p.smae_equivalentes || {},
    tags_restriccion: Array.isArray(p.tags_restriccion) ? p.tags_restriccion : [],
    keywords: Array.isArray(p.keywords) ? p.keywords : [],
    calorias: Math.round(Number(p.calorias) || 0),
    proteina: Math.round(Number(p.proteina) || 0),
    carbohidratos: Math.round(Number(p.carbohidratos) || 0),
    grasas: Math.round(Number(p.grasas) || 0),
    updated_at: new Date().toISOString(),
  };
}

function mapRowToAlimento(row) {
  if (!row) return null;
  return getIngredientSmaeInfo({
    id: row.id,
    nombre: row.nombre,
    categoria: row.grupo_smae,
    smaeGroup: row.grupo_smae,
    cantidadBase: Number(row.cantidad_base || 1),
    unidadBase: row.unidad_base || "g",
    gramosBase: Number(row.gramos_base || 30),
    porcion1Eq: row.porcion_1eq || "",
    dietTags: Array.isArray(row.tags_restriccion) ? row.tags_restriccion : [],
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    foto: row.foto || "",
  });
}

function mapAlimentoToRow(ing) {
  return {
    id: ing.id || `smae_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    nombre: ing.nombre,
    grupo_smae: ing.smaeGroup || ing.categoria || "verduras",
    cantidad_base: Number(ing.cantidadBase || 1),
    unidad_base: ing.unidadBase || "g",
    gramos_base: Number(ing.gramosBase || 30),
    porcion_1eq: ing.porcion1Eq || null,
    tags_restriccion: Array.isArray(ing.dietTags) ? ing.dietTags : [],
    keywords: Array.isArray(ing.keywords) ? ing.keywords : [],
    foto: ing.foto || "",
    updated_at: new Date().toISOString(),
  };
}

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
 * Sincroniza y descarga la base de datos de Platillos SMAE:
 * 1. Desde la tabla PostgreSQL public.biblioteca_platillos en Supabase.
 * 2. Fallback resiliente a Storage JSON o caché local.
 */
export async function fetchCustomPlatillos() {
  const local = peekCustomPlatillos();

  // 1. Intentar leer desde la tabla PostgreSQL de Supabase
  try {
    const rows = await dbGet("biblioteca_platillos?order=nombre.asc");
    if (Array.isArray(rows) && rows.length > 0) {
      const mapped = rows.map(mapRowToPlatillo).filter(Boolean);
      try {
        localStorage.setItem(KEY_PLATILLOS_SMAE, JSON.stringify(mapped));
      } catch {}
      return mapped;
    }
  } catch (e) {
    // Si la tabla no está creada aún o hay error de red, continuar a Storage
  }

  // 2. Fallback a Storage JSON
  if (SUPA_URL) {
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
      console.warn("fetchCustomPlatillos storage fallback:", e);
    }
  }

  return local;
}

/**
 * Sincroniza y descarga la base de datos de Alimentos SMAE:
 * 1. Desde la tabla PostgreSQL public.smae_alimentos en Supabase.
 * 2. Fallback resiliente a Storage JSON o catálogo base.
 */
export async function fetchCustomIngredientes() {
  const local = peekCustomIngredientes();

  // 1. Intentar leer desde la tabla PostgreSQL de Supabase
  try {
    const rows = await dbGet("smae_alimentos?order=nombre.asc");
    if (Array.isArray(rows) && rows.length > 0) {
      const mapped = rows.map(mapRowToAlimento).filter(Boolean);
      try {
        localStorage.setItem(KEY_SMAE_ALIMENTOS, JSON.stringify(mapped));
      } catch {}
      return mapped;
    }
  } catch (e) {
    // Si la tabla no está creada aún o hay error de red, continuar a Storage
  }

  // 2. Fallback a Storage JSON
  if (SUPA_URL) {
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
      console.warn("fetchCustomIngredientes storage fallback:", e);
    }
  }

  return local;
}

/**
 * Guarda y propaga la lista de platillos SMAE en Supabase Database (public.biblioteca_platillos),
 * respaldo secundario en Storage JSON y caché local.
 */
export async function saveCustomPlatillos(newList) {
  try {
    localStorage.setItem(KEY_PLATILLOS_SMAE, JSON.stringify(newList));
  } catch {}

  // 1. Persistir en la tabla PostgreSQL de Supabase
  try {
    const rows = (newList || []).map(mapPlatilloToRow);
    if (rows.length > 0) {
      await dbUpsert("biblioteca_platillos?on_conflict=id", rows);
    }
  } catch (e) {
    console.warn("saveCustomPlatillos dbUpsert:", e);
  }

  // 2. Respaldo secundario en Storage JSON
  try {
    const blob = new Blob([JSON.stringify(newList, null, 2)], {
      type: "application/json",
    });
    await storageUpload("logos", REMOTE_PLATILLOS_FILE, blob, {
      upsert: true,
    });
  } catch (e) {
    console.warn("saveCustomPlatillos storage:", e);
  }

  window.dispatchEvent(
    new CustomEvent("flux:platillos-updated", { detail: newList })
  );
  return newList;
}

/**
 * Guarda y propaga la lista de Alimentos SMAE en Supabase Database (public.smae_alimentos),
 * respaldo secundario en Storage JSON y caché local.
 */
export async function saveCustomIngredientes(newList) {
  const enriched = (newList || []).map((item) => getIngredientSmaeInfo(item));
  try {
    localStorage.setItem(KEY_SMAE_ALIMENTOS, JSON.stringify(enriched));
  } catch {}

  // 1. Persistir en la tabla PostgreSQL de Supabase
  try {
    const rows = enriched.map(mapAlimentoToRow);
    if (rows.length > 0) {
      await dbUpsert("smae_alimentos?on_conflict=id", rows);
    }
  } catch (e) {
    console.warn("saveCustomIngredientes dbUpsert:", e);
  }

  // 2. Respaldo secundario en Storage JSON
  try {
    const blob = new Blob([JSON.stringify(enriched, null, 2)], {
      type: "application/json",
    });
    await storageUpload("logos", REMOTE_INGREDIENTES_FILE, blob, {
      upsert: true,
    });
  } catch (e) {
    console.warn("saveCustomIngredientes storage:", e);
  }

  window.dispatchEvent(
    new CustomEvent("flux:ingredientes-updated", { detail: enriched })
  );
  return enriched;
}

/**
 * Elimina un platillo de Supabase Database
 */
export async function deleteCustomPlatilloFromDb(id) {
  if (!id) return;
  try {
    await dbDel(`biblioteca_platillos?id=eq.${encodeURIComponent(id)}`);
  } catch (e) {
    console.warn("deleteCustomPlatilloFromDb:", e);
  }
}

/**
 * Elimina un alimento SMAE de Supabase Database
 */
export async function deleteCustomIngredienteFromDb(id) {
  if (!id) return;
  try {
    await dbDel(`smae_alimentos?id=eq.${encodeURIComponent(id)}`);
  } catch (e) {
    console.warn("deleteCustomIngredienteFromDb:", e);
  }
}
