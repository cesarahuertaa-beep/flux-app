import { storageUpload } from "./supabase";

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
  if (!clienteId || !SUPA_URL) return local;
  try {
    const url = `${SUPA_URL}/storage/v1/object/public/logos/expediente_clinico_${clienteId}.json?t=${Date.now()}`;
    const r = await fetch(url);
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
      } catch {
        // ignore
      }
      return merged;
    }
  } catch {
    // Offline fallback
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
  try {
    window.dispatchEvent(
      new CustomEvent("flux:expediente-updated", {
        detail: { clienteId, record: normalized },
      })
    );
  } catch {
    // ignore
  }
  return normalized;
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
