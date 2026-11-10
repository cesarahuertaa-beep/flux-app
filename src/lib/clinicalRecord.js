import { dbGet, dbPatch, storageUpload, storageRemoveMany, broadcastTableChange, invalidateCache } from "./supabase";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;

export const EMPTY_ANAMNESIS = {
  // Antecedentes Médicos y Patológicos Atemporales
  patologias: "",
  antecedentes_heredofamiliares: "",
  medicacion_suplementos: "",
  alergias_intolerancias: "",
  sintomas_gi: "",
  cirugias_lesiones: "",
  ocupacion_actividad: "",
  consumo_alcohol_tabaco: "",
  notas_consulta: "",
  resumen_ia: null,
  updated_at: null,
  completado_por: null, // 'nutriologo' | 'paciente'
};

export const EMPTY_CHECKIN = {
  energia: 4, // 1-5
  saciedad: 4, // 1-5
  digestion: 4, // 1-5
  descanso: 4, // 1-5
  observaciones: "",
  ajustes_solicitados: "",
};

export function getDefaultClinicalRecord() {
  return {
    anamnesis: { ...EMPTY_ANAMNESIS },
    checkins: [], // [{ id, fecha, energia, saciedad, digestion, descanso, observaciones, ajustes_solicitados, adherencia_comidas_pct, adherencia_agua_pct, autor }]
    solicitud_activa: null, // null | 'historia_inicial' | 'checkin_seguimiento'
    solicitud_fecha: null,
    ultima_respuesta_paciente: null,
    servicios_activos: { nutricion: true, entrenamiento: true },
    resumenes_programacion: null,
  };
}

function getCacheKey(clienteId) {
  return `flux_expediente_${clienteId}`;
}

export function peekClinicalRecord(clienteId) {
  if (!clienteId) return getDefaultClinicalRecord();
  try {
    const raw = localStorage.getItem(getCacheKey(clienteId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...getDefaultClinicalRecord(),
        ...parsed,
        anamnesis: { ...EMPTY_ANAMNESIS, ...(parsed?.anamnesis || {}) },
        checkins: Array.isArray(parsed?.checkins) ? parsed.checkins : [],
        servicios_activos: {
          nutricion: true,
          entrenamiento: true,
          ...(parsed?.servicios_activos || {}),
        },
      };
    }
  } catch {
    // ignore
  }
  return getDefaultClinicalRecord();
}

export async function fetchClinicalRecord(clienteId) {
  const local = peekClinicalRecord(clienteId);
  if (!clienteId) return local;

  // 1. Intentar desde la tabla PostgreSQL public.clientes (columna expediente_clinico)
  try {
    const rows = await dbGet(`clientes?id=eq.${clienteId}&select=expediente_clinico`);
    if (rows && rows.length > 0 && rows[0].expediente_clinico) {
      const parsed = rows[0].expediente_clinico;
      const merged = {
        ...getDefaultClinicalRecord(),
        ...parsed,
        anamnesis: { ...EMPTY_ANAMNESIS, ...(parsed?.anamnesis || {}) },
        checkins: Array.isArray(parsed?.checkins) ? parsed.checkins : [],
        servicios_activos: {
          nutricion: true,
          entrenamiento: true,
          ...(parsed?.servicios_activos || {}),
        },
      };
      try {
        localStorage.setItem(getCacheKey(clienteId), JSON.stringify(merged));
      } catch {}
      return merged;
    }
  } catch (e) {
    // Continuar al fallback de Storage si no existe la columna aún
  }

  // 2. Fallback a Supabase Storage JSON
  if (SUPA_URL) {
    try {
      const url = `${SUPA_URL}/storage/v1/object/public/logos/expediente_clinico_${clienteId}.json?t=${Date.now()}`;
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) {
        const parsed = await r.json();
        const merged = {
          ...getDefaultClinicalRecord(),
          ...parsed,
          anamnesis: { ...EMPTY_ANAMNESIS, ...(parsed?.anamnesis || {}) },
          checkins: Array.isArray(parsed?.checkins) ? parsed.checkins : [],
          servicios_activos: {
            nutricion: true,
            entrenamiento: true,
            ...(parsed?.servicios_activos || {}),
          },
        };
        try {
          localStorage.setItem(getCacheKey(clienteId), JSON.stringify(merged));
        } catch {}
        return merged;
      }
    } catch {}
  }

  return local;
}

export async function saveClinicalRecord(clienteId, nextRecord) {
  if (!clienteId) return getDefaultClinicalRecord();
  const normalized = {
    ...getDefaultClinicalRecord(),
    ...nextRecord,
    anamnesis: { ...EMPTY_ANAMNESIS, ...(nextRecord?.anamnesis || {}) },
    checkins: Array.isArray(nextRecord?.checkins) ? nextRecord.checkins : [],
    servicios_activos: {
      nutricion: true,
      entrenamiento: true,
      ...(nextRecord?.servicios_activos || {}),
    },
  };
  try {
    localStorage.setItem(getCacheKey(clienteId), JSON.stringify(normalized));
  } catch {
    // ignore
  }

  // 1. Guardar en Supabase Database (public.clientes.expediente_clinico)
  try {
    await dbPatch(`clientes?id=eq.${clienteId}`, { expediente_clinico: normalized });
  } catch (e) {
    console.warn("Guardado de expediente en Supabase Database:", e);
  }

  // 2. Respaldo secundario en Supabase Storage
  if (SUPA_URL) {
    try {
      const blob = new Blob([JSON.stringify(normalized)], {
        type: "application/json",
      });
      await storageUpload(
        "logos",
        `expediente_clinico_${clienteId}.json`,
        blob,
        { upsert: true }
      );
    } catch (e) {
      console.warn("Guardado de expediente en caché local (sin red):", e);
    }
  }

  try {
    window.dispatchEvent(
      new CustomEvent("flux:expediente-updated", {
        detail: { clienteId, record: normalized },
      })
    );
    invalidateCache("expediente_clinico", { clienteId });
    broadcastTableChange("expediente_clinico", { clienteId });
  } catch {}
  return normalized;
}

export async function deleteClinicalRecord(clienteId) {
  if (!clienteId) return;
  try {
    localStorage.removeItem(getCacheKey(clienteId));
  } catch {
    // ignore
  }
  try {
    await storageRemoveMany("logos", [`expediente_clinico_${clienteId}.json`]);
  } catch {
    // ignore
  }
  try {
    invalidateCache("expediente_clinico", { clienteId });
  } catch {
    // ignore
  }
}

export function hasAnamnesisData(anamnesis) {
  if (!anamnesis) return false;
  const textKeys = [
    "patologias",
    "antecedentes_heredofamiliares",
    "medicacion_suplementos",
    "alergias_intolerancias",
    "sintomas_gi",
    "cirugias_lesiones",
    "ocupacion_actividad",
    "notas_consulta",
    // Backward compatibility for existing records
    "preferencias_alimentos",
    "aversiones_alimentos",
    "r24h_desayuno",
    "r24h_comida",
    "r24h_cena",
  ];
  return textKeys.some(
    (k) => typeof anamnesis[k] === "string" && anamnesis[k].trim().length > 0
  );
}
