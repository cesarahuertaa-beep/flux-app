import { useState, useEffect } from "react";
import {
  X,
  ClipboardList,
  Activity,
  Send,
  Check,
  Calendar,
  Trash2,
  HeartPulse,
  Utensils,
  Clock,
} from "lucide-react";
import {
  EMPTY_ANAMNESIS,
  EMPTY_CHECKIN,
  peekClinicalRecord,
  fetchClinicalRecord,
  saveClinicalRecord,
} from "../../lib/clinicalRecord";

const SCALE_ITEMS = [
  { key: "energia", label: "Energía diaria" },
  { key: "saciedad", label: "Control de saciedad" },
  { key: "digestion", label: "Digestión" },
  { key: "descanso", label: "Calidad de sueño" },
];

const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d.includes("T") ? d : `${d}T12:00:00`);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function ExpedienteClinicoModal({
  isOpen,
  onClose,
  cliente,
  mode = "nutriologo", // 'nutriologo' | 'paciente'
  initialSection = null, // 'historia' | 'seguimiento'
  adherenciaSummary = null, // { comidasPct, aguaPromedioL }
  onSaved,
}) {
  const clienteId = cliente?.id;
  const [record, setRecord] = useState(() => peekClinicalRecord(clienteId));
  const [activeTab, setActiveTab] = useState("historia"); // 'historia' | 'seguimiento'
  const [historiaStep, setHistoriaStep] = useState("clinico"); // 'clinico' | 'habitos' | 'r24h'
  const [anamnesis, setAnamnesis] = useState(() => ({
    ...EMPTY_ANAMNESIS,
    ...peekClinicalRecord(clienteId).anamnesis,
  }));
  const [checkinForm, setCheckinForm] = useState({ ...EMPTY_CHECKIN });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !clienteId) return;
    const local = peekClinicalRecord(clienteId);
    setRecord(local);
    setAnamnesis({ ...EMPTY_ANAMNESIS, ...local.anamnesis });

    if (initialSection) {
      setActiveTab(initialSection);
    } else if (mode === "paciente") {
      setActiveTab(
        local.solicitud_activa === "checkin_seguimiento"
          ? "seguimiento"
          : "historia"
      );
    }

    fetchClinicalRecord(clienteId).then((fresh) => {
      setRecord(fresh);
      setAnamnesis({ ...EMPTY_ANAMNESIS, ...fresh.anamnesis });
      if (!initialSection && mode === "paciente") {
        setActiveTab(
          fresh.solicitud_activa === "checkin_seguimiento"
            ? "seguimiento"
            : "historia"
        );
      }
    });
  }, [isOpen, clienteId, initialSection, mode]);

  if (!isOpen || !cliente) return null;

  const updAnamnesis = (k, v) =>
    setAnamnesis((prev) => ({ ...prev, [k]: v }));

  const handleSaveAnamnesis = async () => {
    setSaving(true);
    try {
      const next = {
        ...record,
        anamnesis: {
          ...anamnesis,
          updated_at: new Date().toISOString(),
          completado_por: mode,
        },
        solicitud_activa:
          mode === "paciente" && record.solicitud_activa === "historia_inicial"
            ? null
            : record.solicitud_activa,
        ultima_respuesta_paciente:
          mode === "paciente"
            ? new Date().toISOString()
            : record.ultima_respuesta_paciente,
      };
      const saved = await saveClinicalRecord(clienteId, next);
      setRecord(saved);
      if (onSaved) onSaved(saved);
      if (mode === "paciente") onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCheckin = async () => {
    setSaving(true);
    try {
      const newEntry = {
        id: `${Date.now()}`,
        fecha: new Date().toISOString().split("T")[0],
        energia: Number(checkinForm.energia) || 4,
        saciedad: Number(checkinForm.saciedad) || 4,
        digestion: Number(checkinForm.digestion) || 4,
        descanso: Number(checkinForm.descanso) || 4,
        observaciones: (checkinForm.observaciones || "").trim(),
        ajustes_solicitados: (checkinForm.ajustes_solicitados || "").trim(),
        adherencia_comidas_pct: adherenciaSummary?.comidasPct ?? null,
        adherencia_agua_l: adherenciaSummary?.aguaPromedioL ?? null,
        autor: mode,
      };
      const next = {
        ...record,
        checkins: [newEntry, ...(record.checkins || [])].slice(0, 30),
        solicitud_activa:
          mode === "paciente" &&
          record.solicitud_activa === "checkin_seguimiento"
            ? null
            : record.solicitud_activa,
        ultima_respuesta_paciente:
          mode === "paciente"
            ? new Date().toISOString()
            : record.ultima_respuesta_paciente,
      };
      const saved = await saveClinicalRecord(clienteId, next);
      setRecord(saved);
      setCheckinForm({ ...EMPTY_CHECKIN });
      if (onSaved) onSaved(saved);
      if (mode === "paciente") onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCheckin = async (id) => {
    const next = {
      ...record,
      checkins: (record.checkins || []).filter((c) => c.id !== id),
    };
    const saved = await saveClinicalRecord(clienteId, next);
    setRecord(saved);
    if (onSaved) onSaved(saved);
  };

  const targetRequestType =
    activeTab === "historia" ? "historia_inicial" : "checkin_seguimiento";
  const isCurrentlyRequested = record.solicitud_activa === targetRequestType;

  const togglePatientRequest = async () => {
    setSaving(true);
    try {
      const next = {
        ...record,
        solicitud_activa: isCurrentlyRequested ? null : targetRequestType,
        solicitud_fecha: isCurrentlyRequested ? null : new Date().toISOString(),
      };
      const saved = await saveClinicalRecord(clienteId, next);
      setRecord(saved);
      if (onSaved) onSaved(saved);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-[#0B1929]/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl border border-[#E2E8F0] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[#0B1929] truncate">
                {mode === "paciente"
                  ? activeTab === "seguimiento"
                    ? "Check-in de Seguimiento"
                    : "Historia Clínica"
                  : `Expediente · ${cliente.nombre}`}
              </h2>
              {anamnesis.updated_at && activeTab === "historia" && (
                <p className="text-[11px] text-[#6B7A8D]">
                  Actualizado {fmtDate(anamnesis.updated_at)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mode === "nutriologo" && (
              <button
                type="button"
                onClick={togglePatientRequest}
                disabled={saving}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border ${
                  isCurrentlyRequested
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                    : "bg-[#F8FAFC] text-[#0B1929] border-[#E2E8F0] hover:bg-gray-100"
                }`}
              >
                {isCurrentlyRequested ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Solicitado al paciente
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-[var(--brand-primary)]" />{" "}
                    Solicitar al paciente
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#6B7A8D] hover:text-[#0B1929] hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Selector principal (Solo visible para nutriólogo o cuando no está bloqueado a un modo) */}
        {mode === "nutriologo" && (
          <div className="px-5 pt-3.5 pb-2 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between gap-2 flex-wrap">
            <div className="flex bg-[#E2E8F0]/60 rounded-xl p-1 gap-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveTab("historia")}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "historia"
                    ? "bg-white text-[#0B1929] shadow-sm"
                    : "text-[#6B7A8D] hover:text-[#0B1929]"
                }`}
              >
                Historia Inicial
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("seguimiento")}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === "seguimiento"
                    ? "bg-white text-[#0B1929] shadow-sm"
                    : "text-[#6B7A8D] hover:text-[#0B1929]"
                }`}
              >
                Seguimiento
                {(record.checkins || []).length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                    {record.checkins.length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === "historia" && (
              <div className="flex gap-1 w-full sm:w-auto">
                {[
                  { id: "clinico", label: "Clínico", icon: HeartPulse },
                  { id: "habitos", label: "Hábitos", icon: Clock },
                  { id: "r24h", label: "R24H", icon: Utensils },
                ].map((st) => {
                  const Icon = st.icon;
                  const active = historiaStep === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setHistoriaStep(st.id)}
                      className={`flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer border ${
                        active
                          ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]"
                          : "bg-white text-[#6B7A8D] border-[#E2E8F0] hover:text-[#0B1929]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {st.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Sub-selector de pasos cuando el paciente llena su Historia Inicial */}
        {mode === "paciente" && activeTab === "historia" && (
          <div className="px-5 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex gap-1.5">
            {[
              { id: "clinico", label: "1. Salud" },
              { id: "habitos", label: "2. Hábitos" },
              { id: "r24h", label: "3. Día habitual" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setHistoriaStep(st.id)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                  historiaStep === st.id
                    ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]"
                    : "bg-white text-[#6B7A8D] border-[#E2E8F0]"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === "historia" ? (
            <>
              {historiaStep === "clinico" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#0B1929] mb-1">
                      Condiciones médicas o patologías
                    </label>
                    <input
                      type="text"
                      value={anamnesis.patologias}
                      onChange={(e) =>
                        updAnamnesis("patologias", e.target.value)
                      }
                      placeholder="Ej. Ninguna, resistencia a la insulina, hipotiroidismo..."
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#0B1929] mb-1">
                      Medicación y suplementación actual
                    </label>
                    <input
                      type="text"
                      value={anamnesis.medicacion_suplementos}
                      onChange={(e) =>
                        updAnamnesis("medicacion_suplementos", e.target.value)
                      }
                      placeholder="Ej. Creatina 5g, Omega 3, Metformina..."
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0B1929] mb-1">
                      Alergias o intolerancias
                    </label>
                    <input
                      type="text"
                      value={anamnesis.alergias_intolerancias}
                      onChange={(e) =>
                        updAnamnesis("alergias_intolerancias", e.target.value)
                      }
                      placeholder="Ej. Lactosa, mariscos..."
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0B1929] mb-1">
                      Digestión / Síntomas GI
                    </label>
                    <input
                      type="text"
                      value={anamnesis.sintomas_gi}
                      onChange={(e) =>
                        updAnamnesis("sintomas_gi", e.target.value)
                      }
                      placeholder="Ej. Normal, inflamación, reflujo..."
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0B1929] mb-1">
                      Horas de sueño promedio
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={anamnesis.horas_sueno}
                      onChange={(e) =>
                        updAnamnesis("horas_sueno", e.target.value)
                      }
                      placeholder="Ej. 7.5"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0B1929] mb-1">
                      Nivel de estrés (1 bajo – 5 alto)
                    </label>
                    <div className="flex gap-1.5">
                      {["1", "2", "3", "4", "5"].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => updAnamnesis("nivel_estres", lvl)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                            String(anamnesis.nivel_estres) === lvl
                              ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]"
                              : "bg-[#F8FAFC] text-[#6B7A8D] border-[#E2E8F0]"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {historiaStep === "habitos" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0B1929] mb-1">
                      Ocupación y actividad diaria
                    </label>
                    <input
                      type="text"
                      value={anamnesis.ocupacion_actividad}
                      onChange={(e) =>
                        updAnamnesis("ocupacion_actividad", e.target.value)
                      }
                      placeholder="Ej. Oficina sentado 8h, entrena 6pm..."
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0B1929] mb-1">
                      Horarios habituales de comida
                    </label>
                    <input
                      type="text"
                      value={anamnesis.horarios_comida}
                      onChange={(e) =>
                        updAnamnesis("horarios_comida", e.target.value)
                      }
                      placeholder="Ej. 8:00 am, 2:30 pm, 9:00 pm"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#0B1929] mb-1">
                      Alimentos preferidos
                    </label>
                    <input
                      type="text"
                      value={anamnesis.preferencias_alimentos}
                      onChange={(e) =>
                        updAnamnesis("preferencias_alimentos", e.target.value)
                      }
                      placeholder="Ej. Pollo, huevo, avena, arroz, aguacate..."
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#0B1929] mb-1">
                      Alimentos que evita o no le gustan
                    </label>
                    <input
                      type="text"
                      value={anamnesis.aversiones_alimentos}
                      onChange={(e) =>
                        updAnamnesis("aversiones_alimentos", e.target.value)
                      }
                      placeholder="Ej. Atún, brócoli, hígado..."
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>
                </div>
              )}

              {historiaStep === "r24h" && (
                <div className="space-y-3">
                  {[
                    { key: "r24h_desayuno", label: "Desayuno habitual" },
                    { key: "r24h_colacion_m", label: "Colación matutina" },
                    { key: "r24h_comida", label: "Comida" },
                    { key: "r24h_colacion_v", label: "Colación vespertina" },
                    { key: "r24h_cena", label: "Cena" },
                  ].map((item) => (
                    <div key={item.key}>
                      <label className="block text-xs font-bold text-[#0B1929] mb-1">
                        {item.label}
                      </label>
                      <input
                        type="text"
                        value={anamnesis[item.key]}
                        onChange={(e) => updAnamnesis(item.key, e.target.value)}
                        placeholder="Alimentos y cantidades aproximadas..."
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-5">
              {/* Adherencia automática FLUX si existe */}
              {adherenciaSummary && (
                <div className="grid grid-cols-2 gap-3 bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                  <div>
                    <div className="text-[11px] font-bold text-[#6B7A8D] uppercase">
                      Adherencia Comidas
                    </div>
                    <div className="text-base font-extrabold text-[#0B1929]">
                      {adherenciaSummary.comidasPct != null
                        ? `${adherenciaSummary.comidasPct}%`
                        : "Sin registros"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-[#6B7A8D] uppercase">
                      Agua Promedio
                    </div>
                    <div className="text-base font-extrabold text-[#0B1929]">
                      {adherenciaSummary.aguaPromedioL != null
                        ? `${adherenciaSummary.aguaPromedioL} L/día`
                        : "Sin registros"}
                    </div>
                  </div>
                </div>
              )}

              {/* Escalas rápidas 1-5 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {SCALE_ITEMS.map((sc) => (
                  <div
                    key={sc.key}
                    className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#0B1929]">
                        {sc.label}
                      </span>
                      <span className="text-xs font-extrabold text-[var(--brand-primary)]">
                        {checkinForm[sc.key]}/5
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() =>
                            setCheckinForm((p) => ({ ...p, [sc.key]: n }))
                          }
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                            Number(checkinForm[sc.key]) === n
                              ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]"
                              : "bg-white text-[#6B7A8D] border-[#E2E8F0]"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#0B1929] mb-1">
                    Sensaciones de la semana
                  </label>
                  <input
                    type="text"
                    value={checkinForm.observaciones}
                    onChange={(e) =>
                      setCheckinForm((p) => ({
                        ...p,
                        observaciones: e.target.value,
                      }))
                    }
                    placeholder="Rendimiento, ansiedad, eventos..."
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0B1929] mb-1">
                    Ajustes para el siguiente menú
                  </label>
                  <input
                    type="text"
                    value={checkinForm.ajustes_solicitados}
                    onChange={(e) =>
                      setCheckinForm((p) => ({
                        ...p,
                        ajustes_solicitados: e.target.value,
                      }))
                    }
                    placeholder="Cambiar desayuno, opciones rápidas..."
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>
              </div>

              {/* Historial de Check-ins (vista nutriólogo) */}
              {mode === "nutriologo" && (record.checkins || []).length > 0 && (
                <div className="pt-2 border-t border-[#E2E8F0]">
                  <div className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-2.5">
                    Bitácora de seguimientos
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {record.checkins.map((c) => (
                      <div
                        key={c.id}
                        className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-xs flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#0B1929] flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                              {fmtDate(c.fecha)}
                            </span>
                            <span className="text-[#6B7A8D]">
                              Energía <b>{c.energia}/5</b> · Saciedad{" "}
                              <b>{c.saciedad}/5</b> · Digestión{" "}
                              <b>{c.digestion}/5</b> · Sueño{" "}
                              <b>{c.descanso}/5</b>
                            </span>
                          </div>
                          {c.observaciones && (
                            <p className="text-[#0B1929]">{c.observaciones}</p>
                          )}
                          {c.ajustes_solicitados && (
                            <p className="text-[var(--brand-primary)] font-semibold">
                              Ajustes: {c.ajustes_solicitados}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteCheckin(c.id)}
                          className="text-[#6B7A8D] hover:text-red-600 p-1 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#E2E8F0] bg-white flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#6B7A8D] hover:bg-gray-50 cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={
              activeTab === "historia" ? handleSaveAnamnesis : handleSaveCheckin
            }
            className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
          >
            {saving
              ? "Guardando..."
              : activeTab === "historia"
              ? "Guardar Historia"
              : "Registrar Check-in"}
          </button>
        </div>
      </div>
    </div>
  );
}
