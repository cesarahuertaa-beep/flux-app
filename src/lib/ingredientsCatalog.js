/**
 * Base de Datos Oficial de Alimentos Equivalentes SMAE (5ª Edición) para FLUX
 * Reemplaza por completo la lista obsoleta de ingredientes sueltos.
 * Todos los alimentos provienen directamente de los 16 Grupos Oficiales del SMAE
 * con su porción exacta de 1 Equivalente, gramaje neto, macronutrientes de grupo
 * y etiquetas clínicas de restricción/alérgenos.
 */

import {
  SMAE_GROUPS,
  SMAE_GROUPS_MAP,
  SMAE_FOODS_BY_GROUP,
  DIET_RESTRICTION_TAGS,
} from "./smaeData";

export const KEY_SMAE_ALIMENTOS = "flux_smae_alimentos_v2";

// Purgar llave obsoleta anterior si existía en el navegador
try {
  localStorage.removeItem("flux_biblioteca_ingredientes");
} catch {}

/**
 * Categorías oficiales basadas directamente en los 16 Grupos del SMAE (5ª Ed.)
 */
export const CATEGORIAS_INGREDIENTES = [
  { id: "todos", nombre: "Todos (SMAE)", icono: "⚖️" },
  ...SMAE_GROUPS.map((g) => ({
    id: g.id,
    nombre: g.nombre,
    corto: g.corto,
    icono: g.icono,
    color: g.color,
    kcal: g.kcal,
    proteina: g.proteina,
    carbohidratos: g.carbohidratos,
    grasas: g.grasas,
  })),
];

/**
 * Genera un badge SVG limpio e instantáneo con el icono y color oficial del grupo SMAE
 * para no depender de imágenes rotas externas, permitiendo subir foto personalizada si se desea.
 */
function buildSmaeSvgAvatar(icono = "🥗", color = "#10b981") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
    <rect width="96" height="96" rx="22" fill="${color}" fill-opacity="0.14"/>
    <rect x="2" y="2" width="92" height="92" rx="20" fill="none" stroke="${color}" stroke-opacity="0.32" stroke-width="2"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="44">${icono}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Formatea fracciones amigables para porciones de 1 equivalente
function formatPrettyAmount(num) {
  const cantStr = String(Math.round(Number(num || 1) * 100) / 100);
  const fracMap = {
    "0.25": "¼",
    "0.33": "⅓",
    "0.5": "½",
    "0.66": "⅔",
    "0.75": "¾",
    "1.25": "1¼",
    "1.33": "1⅓",
    "1.5": "1½",
    "1.66": "1⅔",
    "1.75": "1¾",
    "2.5": "2½",
  };
  return fracMap[cantStr] || cantStr;
}

function buildPorcion1EqText(food, groupId) {
  if (food.porcion1Eq) return food.porcion1Eq;
  if (groupId === "libres" || groupId === "libre") return "Libre (al gusto)";
  const u = food.unidadBase || "g";
  const g = food.gramosBase || 30;
  if (u === "g" || u === "ml") {
    return `${g} ${u}`;
  }
  const pretty = formatPrettyAmount(food.cantidadBase || 1);
  return `${pretty} ${u} (${g} g)`;
}

/**
 * Catálogo Maestro de Alimentos SMAE (construido 100% desde SMAE_FOODS_BY_GROUP)
 */
export const INGREDIENTES_CATALOGO = Object.entries(SMAE_FOODS_BY_GROUP).flatMap(
  ([groupId, foods]) => {
    const grp = SMAE_GROUPS_MAP[groupId] || {
      id: groupId,
      nombre: groupId,
      corto: groupId,
      icono: "🥗",
      color: "#10b981",
      kcal: 0,
      proteina: 0,
      carbohidratos: 0,
      grasas: 0,
    };
    const defaultAvatar = buildSmaeSvgAvatar(grp.icono, grp.color);
    return (foods || []).map((food) => ({
      id: food.id,
      nombre: food.nombre,
      categoria: groupId,
      smaeGroup: groupId,
      cantidadBase: Number(food.cantidadBase || 1),
      unidadBase: food.unidadBase || "g",
      gramosBase: Number(food.gramosBase || 30),
      porcion1Eq: buildPorcion1EqText(food, groupId),
      dietTags: Array.isArray(food.dietTags) ? food.dietTags : [],
      keywords: Array.isArray(food.keywords) ? food.keywords : [],
      foto: food.foto || defaultAvatar,
    }));
  }
);

const MASTER_BY_ID = Object.fromEntries(
  INGREDIENTES_CATALOGO.map((i) => [i.id, i])
);

// Normalizador de búsqueda insensible a acentos y mayúsculas
export function normalizar(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Devuelve la información SMAE completa de un alimento del catálogo.
 */
export function getIngredientSmaeInfo(ing) {
  if (!ing) return null;
  const master = MASTER_BY_ID[ing.id] || {};
  const merged = { ...master, ...ing };
  const rawGroup = merged.smaeGroup || merged.categoria || master.smaeGroup || "verduras";
  const smaeGroup = rawGroup === "libre" ? "libres" : rawGroup;
  const grpMeta = SMAE_GROUPS_MAP[smaeGroup] || SMAE_GROUPS_MAP.verduras;
  const defaultAvatar = buildSmaeSvgAvatar(grpMeta?.icono || "🥗", grpMeta?.color || "#10b981");

  return {
    ...merged,
    categoria: smaeGroup,
    smaeGroup,
    smaeMeta: grpMeta,
    gramosBase: Number(merged.gramosBase || master.gramosBase || 30),
    cantidadBase: Number(merged.cantidadBase || master.cantidadBase || 1),
    unidadBase: merged.unidadBase || master.unidadBase || "g",
    porcion1Eq: buildPorcion1EqText(merged, smaeGroup),
    dietTags: Array.isArray(merged.dietTags)
      ? merged.dietTags
      : Array.isArray(master.dietTags)
      ? master.dietTags
      : [],
    foto:
      merged.foto && !String(merged.foto).includes("themealdb.com")
        ? merged.foto
        : defaultAvatar,
  };
}

/**
 * Formatea un alimento con el número de equivalentes SMAE seleccionado y devuelve sus macros exactos.
 */
export function formatIngredientSmaePortion(ing, equivalents = 1) {
  const info = getIngredientSmaeInfo(ing);
  if (!info) {
    return {
      label: "",
      shortPortion: "",
      kcal: 0,
      proteina: 0,
      carbohidratos: 0,
      grasas: 0,
      smaeGroup: "libres",
      smaeCorto: "Libres",
      equivalents: 0,
    };
  }

  if (info.smaeGroup === "libres" || info.smaeGroup === "libre" || !info.smaeMeta || info.smaeMeta.kcal === 0) {
    return {
      label: `${info.nombre} (al gusto)`,
      shortPortion: "Libre",
      kcal: 0,
      proteina: 0,
      carbohidratos: 0,
      grasas: 0,
      smaeGroup: "libres",
      smaeCorto: "Libres",
      equivalents: 0,
    };
  }

  const eq = Math.max(0.5, Math.round(Number(equivalents || 1) * 2) / 2);
  const gramos = Math.round((info.gramosBase || 30) * eq);
  let portionText = "";

  if (info.unidadBase === "g" || info.unidadBase === "ml") {
    portionText = `${gramos} ${info.unidadBase} de ${info.nombre}`;
  } else {
    const rawCant = (info.cantidadBase || 1) * eq;
    const prettyCant = formatPrettyAmount(rawCant);
    portionText = `${prettyCant} ${info.unidadBase} de ${info.nombre} (${gramos} g)`;
  }

  const grp = info.smaeMeta;
  return {
    label: portionText,
    shortPortion: `${gramos} g (${eq} eq ${grp.corto})`,
    kcal: Math.round(grp.kcal * eq),
    proteina: Math.round(grp.proteina * eq),
    carbohidratos: Math.round(grp.carbohidratos * eq),
    grasas: Math.round(grp.grasas * eq),
    smaeGroup: info.smaeGroup,
    smaeCorto: grp.corto,
    equivalents: eq,
  };
}

/**
 * Evalúa si un alimento SMAE o platillo está excluido o es favorito según la Evaluación del Ciclo + Expediente.
 * Soporta tanto `dietTags` (alimentos SMAE) como `tags_restriccion` (platillos compuestos).
 */
export function evaluateIngredientForPatient(
  item,
  { aversionesText = "", preferenciasText = "", expediente = null } = {}
) {
  if (!item) {
    return {
      status: "neutral",
      reason: "",
      isExcluded: false,
      excludeReason: "",
      isFavorite: false,
    };
  }

  const itemTags = Array.isArray(item.tags_restriccion)
    ? item.tags_restriccion
    : Array.isArray(item.dietTags)
    ? item.dietTags
    : getIngredientSmaeInfo(item)?.dietTags || [];

  const normAvers = normalizar(
    `${aversionesText || ""} ${expediente?.alergias_intolerancias || ""} ${expediente?.aversiones_alimentos || ""}`
  );
  const normPref = normalizar(
    `${preferenciasText || ""} ${expediente?.preferencias_alimentos || ""}`
  );
  const normName = normalizar(`${item.nombre || ""} ${item.texto || ""}`);
  const baseWord = normalizar(item.nombre || "").split(/\s+/)[0] || "";

  // 1. Verificar etiquetas determinísticas de restricción clínica (Sin Lácteos, Sin Gluten, Sin Mariscos, etc.)
  for (const tagRule of DIET_RESTRICTION_TAGS) {
    const isTagActive = tagRule.keywords.some((kw) =>
      normAvers.includes(normalizar(kw))
    );
    if (isTagActive && itemTags.includes(tagRule.tagMatch)) {
      return {
        status: "evitar",
        reason: tagRule.shortLabel,
        isExcluded: true,
        excludeReason: tagRule.shortLabel,
        isFavorite: false,
      };
    }
  }

  // 2. Verificar coincidencia directa en aversiones o alergias
  const avWords = normAvers
    .split(/[,;.\n]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
  for (const av of avWords) {
    if (av.startsWith("sin ")) continue; // ya cubierto por tags o palabra raíz
    if (normName.includes(av)) {
      return {
        status: "evitar",
        reason: `Evitar (${av})`,
        isExcluded: true,
        excludeReason: `Evitar (${av})`,
        isFavorite: false,
      };
    }
  }

  if (normAvers && baseWord.length >= 4 && normAvers.includes(baseWord)) {
    return {
      status: "evitar",
      reason: "Evitar en consulta",
      isExcluded: true,
      excludeReason: "Evitar en consulta",
      isFavorite: false,
    };
  }

  // 3. Verificar si es favorito en la consulta
  const prefWords = normPref
    .split(/[,;.\n]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
  const isFavorite =
    (normPref && baseWord.length >= 4 && normPref.includes(baseWord)) ||
    prefWords.some((pw) => normName.includes(pw));

  return {
    status: isFavorite ? "favorito" : "neutral",
    reason: isFavorite ? "Favorito en consulta" : "",
    isExcluded: false,
    excludeReason: "",
    isFavorite: Boolean(isFavorite),
  };
}

/**
 * Devuelve el catálogo activo de Alimentos SMAE enriquecido con metadatos de grupo.
 */
export function getIngredientesCatalog() {
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
 * Busca alimentos SMAE en el catálogo filtrando por texto y grupo oficial SMAE.
 */
export function buscarIngredientes(query = "", categoria = "todos") {
  const q = normalizar(query);
  const list = getIngredientesCatalog();
  return list.filter((item) => {
    const coincideCat =
      categoria === "todos" ||
      item.smaeGroup === categoria ||
      item.categoria === categoria;
    if (!coincideCat) return false;
    if (!q) return true;
    const nombreNorm = normalizar(item.nombre);
    const idNorm = normalizar(item.id);
    const smaeNorm = normalizar(item.smaeMeta?.nombre || "");
    const kwNorm = (item.keywords || []).map((k) => normalizar(k)).join(" ");
    return (
      nombreNorm.includes(q) ||
      idNorm.includes(q) ||
      smaeNorm.includes(q) ||
      kwNorm.includes(q)
    );
  });
}
