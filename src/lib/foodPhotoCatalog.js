/**
 * foodPhotoCatalog.js
 * Catálogo Clínico de Platillos Estructurados con Equivalentes SMAE (5ª Ed.) de FLUX.
 * Cada platillo incluye receta libre, fotografía de referencia, etiquetas de alérgenos/restricciones
 * (`tags_restriccion`) y su desglose determinístico de equivalentes SMAE (`smae_equivalentes`),
 * de donde se calculan automáticamente sus calorías y macronutrientes exactos.
 */
import { dbGet, dbPost } from "./supabase";
import { calculateSmaeTotals, estimateMealSmaeMap } from "./smaeData";
import { RAW_PLATILLOS_SEED } from "./seed/platillosSeed";

export const KEY_PLATILLOS_SMAE = "flux_platillos_smae_v2";

// Purgar llave obsoleta anterior si existía en el navegador
try {
  localStorage.removeItem("flux_biblioteca_platillos");
} catch {}

export const CATEGORIAS_PLATILLOS = [
  { id: "todos", nombre: "Todos", icono: "🍽️" },
  { id: "desayuno", nombre: "Desayunos", icono: "🍳" },
  { id: "comida", nombre: "Comidas", icono: "🍲" },
  { id: "cena", nombre: "Cenas", icono: "🌙" },
  { id: "colacion", nombre: "Snacks / Colaciones", icono: "🍎" },
];

export const DISH_RESTRICTION_OPTIONS = [
  { id: "lacteos", label: "Contiene Lácteos", icono: "🥛" },
  { id: "gluten", label: "Contiene Gluten", icono: "🌾" },
  { id: "mariscos", label: "Pescado / Mariscos", icono: "🦐" },
  { id: "carne_roja", label: "Carne Roja / Cerdo", icono: "🥩" },
  { id: "nueces", label: "Frutos Secos / Cacahuate", icono: "🥜" },
  { id: "animal_meat", label: "Proteína Animal", icono: "🍗" },
];

function createStructuredDish(rawDish) {
  const smaeMap =
    rawDish.smae_equivalentes && Object.keys(rawDish.smae_equivalentes).length > 0
      ? rawDish.smae_equivalentes
      : estimateMealSmaeMap(rawDish.texto || rawDish.nombre || "");
  const totals = calculateSmaeTotals(smaeMap);
  return {
    ...rawDish,
    smae_equivalentes: smaeMap,
    tags_restriccion: Array.isArray(rawDish.tags_restriccion)
      ? rawDish.tags_restriccion
      : [],
    calorias: totals.kcal > 0 ? totals.kcal : Number(rawDish.calorias || 0),
    proteina: totals.kcal > 0 ? totals.proteina : Number(rawDish.proteina || 0),
    carbohidratos:
      totals.kcal > 0 ? totals.carbohidratos : Number(rawDish.carbohidratos || 0),
    grasas: totals.kcal > 0 ? totals.grasas : Number(rawDish.grasas || 0),
  };
}


/**
 * Respaldo de emergencia (solo se usa si Supabase no responde y no hay caché local).
 * La fuente de verdad es la tabla `biblioteca_platillos` (ver customCatalogs.js).
 */
export const CATALOGO_PLATILLOS_BASE = RAW_PLATILLOS_SEED.map(createStructuredDish);

// Limpieza y normalización de texto para matching
function normalizeText(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

/**
 * Devuelve el catálogo activo de platillos estructurados con SMAE.
 */
export function getPlatillosCatalog() {
  try {
    const raw = localStorage.getItem(KEY_PLATILLOS_SMAE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(createStructuredDish);
      }
    }
  } catch {}
  return CATALOGO_PLATILLOS_BASE;
}

/**
 * Busca platillos en el catálogo filtrando por texto y categoría.
 */
export function buscarPlatillosCatalogo(query = "", categoria = "todos") {
  const q = normalizeText(query);
  const list = getPlatillosCatalog();
  return list.filter((item) => {
    const coincideCat = categoria === "todos" || item.categoria === categoria;
    if (!coincideCat) return false;
    if (!q) return true;
    const nombreNorm = normalizeText(item.nombre);
    const kwNorm = (item.keywords || []).map((k) => normalizeText(k)).join(" ");
    const textoNorm = normalizeText(item.texto || "");
    return nombreNorm.includes(q) || kwNorm.includes(q) || textoNorm.includes(q);
  });
}

/**
 * Busca si ya existe una foto para el platillo en el catálogo de FLUX
 */
export async function searchDishPhotoInCatalog(dishText, customKeywords = []) {
  if (!dishText && customKeywords.length === 0) return null;
  const normalized = normalizeText(dishText);
  const words = new Set([
    ...normalized.split(/\s+/).filter((w) => w.length > 2),
    ...customKeywords.map((k) => normalizeText(k)),
  ]);

  let bestMatch = null;
  let maxScore = 0;

  for (const item of getPlatillosCatalog()) {
    let score = 0;
    for (const kw of item.keywords || []) {
      const normKw = normalizeText(kw);
      if (words.has(normKw) || normalized.includes(normKw)) {
        score += 1.5;
      }
    }
    if (score > maxScore && score >= 2) {
      maxScore = score;
      bestMatch = item;
    }
  }

  try {
    const remote = await dbGet("catalogo_platillos?limit=50").catch(() => []);
    if (Array.isArray(remote) && remote.length > 0) {
      for (const item of remote) {
        let score = 0;
        const itemKeywords = Array.isArray(item.palabras_clave)
          ? item.palabras_clave
          : (item.palabras_clave || "").split(",");
        for (const kw of itemKeywords) {
          const normKw = normalizeText(kw);
          if (normKw && (words.has(normKw) || normalized.includes(normKw))) {
            score += 1.8;
          }
        }
        if (score > maxScore && score >= 2) {
          maxScore = score;
          bestMatch = {
            id: item.id,
            nombre: item.nombre_normalizado || item.nombre,
            foto_url: item.foto_url,
          };
        }
      }
    }
  } catch {}

  return bestMatch ? bestMatch.foto_url : null;
}

/**
 * Guarda o registra una foto en el catálogo compartido de FLUX
 */
export async function registerDishPhotoInCatalog(dishName, keywords = [], photoUrl) {
  if (!dishName || !photoUrl) return;
  try {
    const payload = {
      nombre_normalizado: dishName.trim(),
      palabras_clave:
        keywords.length > 0
          ? keywords
          : dishName
              .toLowerCase()
              .split(/[\s,]+/)
              .filter((w) => w.length > 2),
      foto_url: photoUrl,
    };
    await dbPost("catalogo_platillos", payload).catch(() => {});
  } catch {}
}
