import { dbGet, dbUpsert, dbDel, storageUpload } from "./supabase.js";
import { parseMealOptions, formatMealOptionsKeepSmae } from "./mealOptions.js";
import {
  normalizeSeriesDetalle,
  computeWeeklyMuscleVolume,
} from "../utils/routineHelpers.js";
import { calculateSmaeTotals } from "./smaeData.js";

const SUPA_URL = import.meta.env?.VITE_SUPABASE_URL || "";

export function generateTemplateId(type = "tpl") {
  return `tpl_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function resolvePlantillasCreatorId(profileId = null) {
  if (typeof window !== "undefined") {
    const id = localStorage.getItem("flux_profileId") || localStorage.getItem("flux_client_id");
    if (id) return id;
  }
  return profileId || "default";
}

function getStorageKeys(type, creatorId) {
  return {
    storageKey: `flux_plantillas_${type}_${creatorId}`,
    deletedStorageKey: `flux_plantillas_del_${type}_${creatorId}`,
    cloudFileName: `plantillas_${type}_${creatorId}.json`,
  };
}

function getDeletedIds(deletedStorageKey) {
  try {
    const raw = localStorage.getItem(deletedStorageKey);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/** Normaliza un ejercicio para guardarlo dentro de una plantilla aislada. */
export function mapExerciseForTemplate(e, eIdx = 0) {
  return {
    biblioteca_id: e.biblioteca_id || null,
    nombre: e.nombre || "",
    gif_url: e.gif_url || "",
    grupo_muscular: e.grupo_muscular || "",
    tipo_movimiento: e.tipo_movimiento || "",
    num_series: Number(e.num_series) || 4,
    reps_sugeridas: Number(e.reps_sugeridas) || 10,
    peso_sugerido:
      e.peso_sugerido !== "" &&
      e.peso_sugerido !== null &&
      e.peso_sugerido !== undefined &&
      !isNaN(e.peso_sugerido)
        ? Number(e.peso_sugerido)
        : null,
    unidad: e.unidad || "kg",
    series_detalle: normalizeSeriesDetalle(e.series_detalle),
    descanso_seg:
      e.descanso_seg !== "" &&
      e.descanso_seg !== null &&
      e.descanso_seg !== undefined &&
      !isNaN(e.descanso_seg)
        ? parseInt(e.descanso_seg, 10)
        : null,
    rir_objetivo: e.rir_objetivo ? String(e.rir_objetivo).trim() : null,
    nota_tecnica: e.nota_tecnica ? String(e.nota_tecnica).trim() : null,
    bloque_grupo: e.bloque_grupo ? String(e.bloque_grupo).trim() : null,
    orden: e.orden != null ? e.orden : eIdx,
    alternativas: (e.alternativas || []).map((alt) => ({
      ...alt,
      peso_sugerido:
        alt.peso_sugerido !== "" &&
        alt.peso_sugerido !== null &&
        alt.peso_sugerido !== undefined &&
        !isNaN(alt.peso_sugerido)
          ? Number(alt.peso_sugerido)
          : null,
      series_detalle: normalizeSeriesDetalle(alt.series_detalle),
    })),
  };
}

/** Limpia pesos sugeridos de una rutina/plantilla conservando series, reps, tipos, RIR, descansos y biseries. */
export function stripWeightsFromTemplateExercise(e) {
  const cleanDet = (rows) =>
    normalizeSeriesDetalle(rows).map((row) => ({
      ...row,
      peso: null,
    }));
  return {
    ...e,
    peso_sugerido: null,
    series_detalle: cleanDet(e.series_detalle),
    alternativas: (e.alternativas || []).map((alt) => ({
      ...alt,
      peso_sugerido: null,
      series_detalle: cleanDet(alt.series_detalle),
    })),
  };
}

/** Normaliza un día nutricional (con comidas y SMAE) para plantilla. */
export function serializeDiaForTemplate(d, dIdx = 0) {
  return {
    dia: d.dia,
    orden: d.orden != null ? d.orden : dIdx,
    comidas: (d.comidas || []).map((c, cIdx) => {
      const optsList =
        Array.isArray(c.opciones) && c.opciones.length > 0
          ? c.opciones
          : parseMealOptions(c);
      const { opcion1, opcion2 } = formatMealOptionsKeepSmae(optsList, c);
      return {
        hora: c.hora || "",
        nombre: c.nombre || `Comida ${cIdx + 1}`,
        opcion1: opcion1 || c.opcion1 || "",
        opcion2: opcion2 || c.opcion2 || "",
        opciones: optsList,
        calorias: Number(c.calorias) || 0,
        proteina: Number(c.proteina) || 0,
        carbohidratos: Number(c.carbohidratos) || 0,
        grasas: Number(c.grasas) || 0,
        foto_url: c.foto_url || c.imagen_url || "",
        orden: c.orden != null ? c.orden : cIdx,
      };
    }),
  };
}

/** Normaliza una rutina semanal para plantilla. */
export function serializeRutinaForTemplate(r, rIdx = 0, fallbackWeeks = 4) {
  return {
    nombre: r.nombre,
    semanas: Number(r.semanas) || Number(fallbackWeeks) || 4,
    orden: r.orden != null ? r.orden : rIdx,
    ejercicios: (r.ejercicios || []).map((e, eIdx) =>
      mapExerciseForTemplate(e, eIdx)
    ),
  };
}

/** Crea un borrador vacío listo para editar en el constructor de plantillas. */
export function createEmptyTemplateDraft({
  type = "nutri",
  creatorId = null,
  nombre = "",
  tags = "",
  semanas = 4,
} = {}) {
  const now = new Date().toISOString();
  return {
    id: generateTemplateId(type),
    nombre: nombre || "",
    tags: tags || (type === "nutri" ? "Menú genérico" : "Rutina genérica"),
    isDefault: false,
    isCustom: true,
    creador_id: creatorId || resolvePlantillasCreatorId(),
    created_at: now,
    updated_at: now,
    ...(type === "nutri"
      ? {
          macros: { calorias: 0, proteina: 0, carbohidratos: 0, grasas: 0 },
          smaeDistribution: {},
          dias: [],
        }
      : {
          semanas: Number(semanas) || 4,
          rutinas: [],
        }),
  };
}

/** Calcula resumen compacto de una plantilla (singular/plural correcto, macros, SMAE o volumen). */
export function summarizeTemplate(tpl, type = "nutri") {
  if (type === "nutri") {
    const dias = Array.isArray(tpl?.dias) ? tpl.dias : [];
    const totalItems = dias.length;
    const unitLabel = totalItems === 1 ? "día con menú" : "días con menú";
    const m = tpl?.macros || {};
    let kcal = Number(m.calorias) || 0;
    let prot = Number(m.proteina) || 0;
    let carbs = Number(m.carbohidratos) || 0;
    let fats = Number(m.grasas) || 0;

    if (kcal === 0 && dias.length > 0) {
      let sumK = 0;
      let sumP = 0;
      let sumC = 0;
      let sumG = 0;
      dias.forEach((d) => {
        (d.comidas || []).forEach((c) => {
          sumK += Number(c.calorias) || 0;
          sumP += Number(c.proteina) || 0;
          sumC += Number(c.carbohidratos) || 0;
          sumG += Number(c.grasas) || 0;
        });
      });
      if (sumK > 0) {
        kcal = Math.round(sumK / dias.length);
        prot = Math.round(sumP / dias.length);
        carbs = Math.round(sumC / dias.length);
        fats = Math.round(sumG / dias.length);
      }
    }

    const smaeTot =
      tpl?.smaeDistribution && typeof tpl.smaeDistribution === "object"
        ? calculateSmaeTotals(tpl.smaeDistribution)
        : null;
    const smaeEquiv = smaeTot?.totalEquivalentes || 0;

    return {
      totalItems,
      unitLabel,
      kcal,
      prot,
      carbs,
      fats,
      smaeEquiv,
    };
  }

  const rutinas = Array.isArray(tpl?.rutinas) ? tpl.rutinas : [];
  const totalItems = rutinas.length;
  const unitLabel = totalItems === 1 ? "sesión" : "sesiones";
  const vol = computeWeeklyMuscleVolume(rutinas);

  return {
    totalItems,
    unitLabel,
    effectiveSets: vol.totalEffectiveSets,
    warmupSets: vol.totalWarmupSets,
    muscleList: vol.muscleList,
  };
}

/** Lee instantáneamente desde localStorage respetando aislamiento por `creatorId`. */
export function readLocalTemplates({ type = "nutri", creatorId = null, profileId = null } = {}) {
  const cId = creatorId || resolvePlantillasCreatorId(profileId);
  const { storageKey, deletedStorageKey } = getStorageKeys(type, cId);
  try {
    const deletedSet = getDeletedIds(deletedStorageKey);
    let baseList = [];
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        baseList = parsed.filter((t) => t && !deletedSet.has(t.id));
      }
    }

    if (profileId && String(profileId) !== String(cId)) {
      const altKey = `flux_plantillas_${type}_${profileId}`;
      const altRaw = localStorage.getItem(altKey);
      if (altRaw) {
        try {
          const altParsed = JSON.parse(altRaw);
          if (Array.isArray(altParsed) && altParsed.length > 0) {
            const seen = new Set(baseList.map((t) => t.id));
            altParsed.forEach((t) => {
              if (t && t.id && !seen.has(t.id) && !deletedSet.has(t.id)) {
                seen.add(t.id);
                baseList.push(t);
              }
            });
            localStorage.setItem(storageKey, JSON.stringify(baseList));
          }
        } catch {
          // Ignorar error de almacenamiento local
        }
      }
    }

    if (baseList.length > 0) return baseList;

    const userRole = typeof window !== "undefined" ? localStorage.getItem("flux_role") : null;
    if (userRole && userRole !== "civil") {
      const legacyKey = type === "nutri" ? "flux_plantillas_nutri" : "flux_plantillas_rutinas";
      const legacy = localStorage.getItem(legacyKey);
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
          localStorage.setItem(storageKey, JSON.stringify(parsedLegacy));
          localStorage.removeItem(legacyKey);
          return parsedLegacy;
        }
      }
    }
    return [];
  } catch {
    return [];
  }
}

/** Carga plantillas desde Supabase (`public.plantillas`) con fallback a Storage JSON. */
export async function fetchCloudTemplates({
  type = "nutri",
  creatorId = null,
  profileId = null,
} = {}) {
  const cId = creatorId || resolvePlantillasCreatorId(profileId);
  if (!cId || cId === "default") return readLocalTemplates({ type, creatorId: cId, profileId });

  const { storageKey, deletedStorageKey, cloudFileName } = getStorageKeys(type, cId);
  const deletedSet = getDeletedIds(deletedStorageKey);

  try {
    const dbRows = await dbGet(
      `plantillas?creador_id=eq.${encodeURIComponent(cId)}&tipo=eq.${type}&order=updated_at.desc`
    );
    if (Array.isArray(dbRows) && dbRows.length > 0) {
      const mapped = dbRows
        .map((r) => ({
          id: r.id,
          nombre: r.nombre,
          descripcion: r.descripcion,
          ...(r.datos || {}),
          created_at: r.created_at || r.datos?.created_at,
          updated_at: r.updated_at || r.datos?.updated_at,
        }))
        .filter((t) => t && !deletedSet.has(t.id));
      try {
        localStorage.setItem(storageKey, JSON.stringify(mapped));
      } catch {
        // Ignorar error de localStorage
      }
      return mapped;
    }
  } catch {
    // Fallback a Storage JSON
  }

  if (SUPA_URL) {
    try {
      const url = `${SUPA_URL}/storage/v1/object/public/logos/${cloudFileName}?t=${Date.now()}`;
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) {
        const cloudData = await r.json();
        if (Array.isArray(cloudData)) {
          const localList = readLocalTemplates({ type, creatorId: cId, profileId });
          const mergedMap = new Map();
          localList.forEach((t) => {
            if (t && t.id && !deletedSet.has(t.id)) mergedMap.set(t.id, t);
          });
          cloudData.forEach((t) => {
            if (t && t.id && !deletedSet.has(t.id) && !mergedMap.has(t.id)) {
              mergedMap.set(t.id, t);
            }
          });
          const merged = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
          );
          try {
            localStorage.setItem(storageKey, JSON.stringify(merged));
          } catch {
            // Ignorar error de localStorage
          }
          return merged;
        }
      }
    } catch {
      // Mantiene caché local
    }
  }

  return readLocalTemplates({ type, creatorId: cId, profileId });
}

function dispatchPlantillasUpdated(type) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("flux:plantillas-updated", { detail: { type } }));
  }
}

/** Persiste la lista completa en localStorage, `public.plantillas` y Storage JSON. */
export async function persistTemplatesList({
  type = "nutri",
  creatorId = null,
  list = [],
  syncRows = null,
} = {}) {
  const cId = creatorId || resolvePlantillasCreatorId();
  const { storageKey, cloudFileName } = getStorageKeys(type, cId);

  try {
    localStorage.setItem(storageKey, JSON.stringify(list));
  } catch (e) {
    console.error("Error guardando plantillas en localStorage:", e);
  }

  if (cId && cId !== "default") {
    const targetRows = (syncRows || list || []).map((t) => ({
      id: t.id,
      creador_id: cId,
      tipo: type,
      nombre: t.nombre || "Plantilla",
      descripcion: t.descripcion || t.tags || "",
      datos: t,
      updated_at: t.updated_at || new Date().toISOString(),
    }));
    if (targetRows.length > 0) {
      await dbUpsert("plantillas?on_conflict=id", targetRows).catch((err) =>
        console.warn("Error guardando plantillas en Supabase:", err)
      );
    }

    if (SUPA_URL) {
      try {
        const blob = new Blob([JSON.stringify(list)], { type: "application/json" });
        storageUpload("logos", cloudFileName, blob, { upsert: true }).catch((err) =>
          console.warn("Error respaldando plantillas en Storage:", err)
        );
      } catch {
        // Ignorar fallo de serialización Blob
      }
    }
  }

  dispatchPlantillasUpdated(type);
  return list;
}

/** Crea o actualiza una plantilla en la biblioteca del creador. */
export async function upsertUserTemplate({
  type = "nutri",
  creatorId = null,
  profileId = null,
  template,
} = {}) {
  const cId = creatorId || resolvePlantillasCreatorId(profileId);
  const currentList = readLocalTemplates({ type, creatorId: cId, profileId });
  const nowIso = new Date().toISOString();
  const finalTpl = {
    ...template,
    id: template?.id || generateTemplateId(type),
    isDefault: false,
    isCustom: true,
    created_at: template?.created_at || template?.createdAt || nowIso,
    updated_at: nowIso,
  };

  const existsIdx = currentList.findIndex((t) => t.id === finalTpl.id);
  const nextList =
    existsIdx >= 0
      ? currentList.map((t) => (t.id === finalTpl.id ? finalTpl : t))
      : [finalTpl, ...currentList];

  await persistTemplatesList({
    type,
    creatorId: cId,
    list: nextList,
    syncRows: [finalTpl],
  });

  return nextList;
}

/** Elimina una plantilla de la biblioteca (nunca afecta planes ya aplicados a pacientes). */
export async function deleteUserTemplate({
  type = "nutri",
  creatorId = null,
  profileId = null,
  id,
} = {}) {
  const cId = creatorId || resolvePlantillasCreatorId(profileId);
  const { deletedStorageKey } = getStorageKeys(type, cId);

  try {
    const delSet = getDeletedIds(deletedStorageKey);
    delSet.add(id);
    localStorage.setItem(deletedStorageKey, JSON.stringify(Array.from(delSet)));
  } catch {
    // Ignorar error de localStorage
  }

  const currentList = readLocalTemplates({ type, creatorId: cId, profileId });
  const nextList = currentList.filter((t) => t.id !== id);

  await persistTemplatesList({ type, creatorId: cId, list: nextList, syncRows: [] });

  if (cId && cId !== "default") {
    await dbDel(`plantillas?id=eq.${encodeURIComponent(id)}`).catch((err) =>
      console.warn("Error eliminando plantilla en Supabase:", err)
    );
  }

  return nextList;
}
