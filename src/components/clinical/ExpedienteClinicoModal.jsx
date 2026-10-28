import React, { useState, useEffect } from "react";
import {
  X,
  ClipboardList,
  HeartPulse,
  RotateCcw,
  Check,
  Send,
  Calendar,
  AlertCircle,
  CheckCircle2,
  User,
  Phone,
  Mail,
  ShieldAlert,
} from "lucide-react";
import {
  EMPTY_ANAMNESIS,
  peekClinicalRecord,
  fetchClinicalRecord,
  saveClinicalRecord,
} from "../../lib/clinicalRecord";
import { dbPatch, dbPost } from "../../lib/supabase";
import { ConfirmModal } from "../ui/ConfirmModal";
import { CustomSelect } from "../ui/CustomSelect";
import { calcEdadFromBirthdate } from "../../lib/bodyComposition";
import { generateClinicalAiSynopsis } from "../../lib/clinicalAi";

const GENERO_OPTIONS = [
  { value: "", label: "Selecciona..." },
  { value: "Femenino", label: "Femenino" },
  { value: "Masculino", label: "Masculino" }
];

const normalizeGeneroVal = (val) => {
  if (!val) return "";
  const s = String(val).trim();
  if (s === "M" || s.toLowerCase() === "masculino" || s.toLowerCase() === "hombre") return "Masculino";
  if (s === "F" || s.toLowerCase() === "femenino" || s.toLowerCase() === "mujer") return "Femenino";
  return s.toLowerCase().startsWith("f") ? "Femenino" : "Masculino";
};

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
  cliente,
  isOpen,
  onClose,
  mode = "nutriologo", // 'nutriologo' | 'paciente'
  initialSection = null,
  onSaved = null,
}) {
  const clienteId = cliente?.id;
  const [record, setRecord] = useState(() => peekClinicalRecord(clienteId));
  const [historiaStep, setHistoriaStep] = useState("perfil"); // 'perfil' | 'clinico'
  
  // Perfil del paciente editable
  const [perfil, setPerfil] = useState({
    nombre: cliente?.nombre || "",
    email: cliente?.email || "",
    telefono: cliente?.telefono || "",
    sexo: normalizeGeneroVal(cliente?.genero || cliente?.sexo || "Masculino"),
    fecha_nacimiento: cliente?.fecha_nacimiento || "",
  });

  const [anamnesis, setAnamnesis] = useState(() => {
    const local = peekClinicalRecord(clienteId);
    return {
      ...EMPTY_ANAMNESIS,
      ...(local?.anamnesis || {}),
    };
  });

  const [saving, setSaving] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  useEffect(() => {
    if (!isOpen || !clienteId) return;
    const local = peekClinicalRecord(clienteId);
    setRecord(local);
    setAnamnesis({
      ...EMPTY_ANAMNESIS,
      ...(local?.anamnesis || {}),
    });
    setPerfil({
      nombre: cliente?.nombre || "",
      email: cliente?.email || "",
      telefono: cliente?.telefono || local?.anamnesis?.telefono || "",
      fecha_nacimiento: cliente?.fecha_nacimiento || local?.anamnesis?.fecha_nacimiento || "",
      sexo: normalizeGeneroVal(cliente?.genero || cliente?.sexo || local?.anamnesis?.sexo || "Masculino"),
    });

    fetchClinicalRecord(clienteId).then((fresh) => {
      setRecord(fresh);
      setAnamnesis({
        ...EMPTY_ANAMNESIS,
        ...(fresh?.anamnesis || {}),
      });
      setPerfil((prev) => ({
        ...prev,
        nombre: cliente?.nombre || prev.nombre,
        telefono: cliente?.telefono || fresh?.anamnesis?.telefono || prev.telefono,
        fecha_nacimiento: cliente?.fecha_nacimiento || fresh?.anamnesis?.fecha_nacimiento || prev.fecha_nacimiento,
        sexo: normalizeGeneroVal(cliente?.genero || cliente?.sexo || fresh?.anamnesis?.sexo || prev.sexo),
      }));
    });
  }, [isOpen, clienteId, cliente]);

  if (!isOpen || !cliente) return null;

  const updAnamnesis = (k, v) => setAnamnesis((prev) => ({ ...prev, [k]: v }));
  const updPerfil = (k, v) => setPerfil((prev) => ({ ...prev, [k]: v }));

  const edadNum = perfil.fecha_nacimiento ? calcEdadFromBirthdate(perfil.fecha_nacimiento) : null;

  // Guardar cambios en el expediente e información del cliente
  const handleSaveExpediente = async () => {
    setSaving(true);
    try {
      // 1. Guardar cambios en la tabla clientes si cambiaron datos
      const patchData = {
        nombre: perfil.nombre || cliente.nombre,
        telefono: perfil.telefono || null,
        fecha_nacimiento: perfil.fecha_nacimiento || null,
        genero: perfil.sexo || "Masculino",
      };
      await dbPatch(`clientes?id=eq.${clienteId}`, patchData).catch(() => {});

      // 2. Guardar en expediente clínico y actualizar diagnóstico con IA
      const updatedAnamnesis = {
        ...anamnesis,
        nombre: perfil.nombre,
        telefono: perfil.telefono,
        fecha_nacimiento: perfil.fecha_nacimiento || null,
        sexo: perfil.sexo,
        updated_at: new Date().toISOString(),
        completado_por: anamnesis.completado_por || mode,
      };

      // Generación automática del análisis de IA cada vez que se guarda
      try {
        const aiDiag = await generateClinicalAiSynopsis(updatedAnamnesis, { ...cliente, ...patchData });
        if (aiDiag?.texto) {
          updatedAnamnesis.resumen_ia = {
            texto: aiDiag.texto,
            origen: aiDiag.origen,
            generado_en: aiDiag.generadoEn,
          };
        }
      } catch (e) {
        console.warn("Diagnóstico IA automático:", e);
      }

      const next = {
        ...record,
        anamnesis_completada: true,
        anamnesis: updatedAnamnesis,
        solicitud_activa: mode === "paciente" && record.solicitud_activa === "historia_inicial" ? null : record.solicitud_activa,
        ultima_respuesta_paciente: mode === "paciente" ? new Date().toISOString() : record.ultima_respuesta_paciente,
      };

      const saved = await saveClinicalRecord(clienteId, next);
      setRecord(saved);

      // Si el paciente completó la historia inicial, notificar a su especialista
      if (mode === "paciente" && cliente?.nutriologo_id) {
        dbPost("notificaciones", {
          profile_id: cliente.nutriologo_id,
          titulo: "Expediente actualizado",
          mensaje: `${cliente.nombre || "Tu paciente"} ha completado o actualizado su expediente clínico.`,
          tipo: "expediente",
          link_url: "clientes",
          entidad_id: cliente.id,
        }).catch(() => {});
      }

      if (onSaved) onSaved(saved, patchData);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // Reiniciar cuestionario (con ConfirmModal nativo)
  const executeResetAnamnesis = async () => {
    setSaving(true);
    try {
      const next = {
        ...record,
        anamnesis_completada: false,
        draft_step: null,
        draft_anamnesis: null,
        solicitud_activa: null,
        solicitud_fecha: null,
        anamnesis: { ...EMPTY_ANAMNESIS },
      };
      const saved = await saveClinicalRecord(clienteId, next);
      setRecord(saved);
      setAnamnesis({ ...EMPTY_ANAMNESIS });
      setShowConfirmReset(false);
      if (onSaved) onSaved(saved);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isCurrentlyRequested = record.solicitud_activa === "historia_inicial";

  const togglePatientRequest = async () => {
    setSaving(true);
    try {
      const next = {
        ...record,
        solicitud_activa: isCurrentlyRequested ? null : "historia_inicial",
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
    <div className="fixed inset-0 z-[110] bg-[#0B1929]/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl border border-[#E2E8F0] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[#0B1929] truncate">
                {mode === "paciente" ? "Ficha Clínica Permanente" : `Expediente · ${perfil.nombre || cliente.nombre}`}
              </h2>
              {anamnesis.updated_at && (
                <p className="text-[11px] text-[#6B7A8D]">
                  Última actualización: {fmtDate(anamnesis.updated_at)}
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
                title="Solicitar al paciente que responda o actualice desde su app"
              >
                {isCurrentlyRequested ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Solicitado</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                    <span className="hidden sm:inline">Solicitar al paciente</span>
                    <span className="sm:hidden">Solicitar</span>
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

        {/* Sub-tabs de navegación de las 2 áreas del Expediente Atemporal */}
        <div className="px-5 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1.5 w-full sm:w-auto">
            {[
              { id: "perfil", label: "1. Ficha de Identificación", icon: User },
              { id: "clinico", label: "2. Antecedentes Clínicos", icon: HeartPulse },
            ].map((st) => {
              const Icon = st.icon;
              const active = historiaStep === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setHistoriaStep(st.id)}
                  className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    active
                      ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-xs"
                      : "bg-white text-[#6B7A8D] border-[#E2E8F0] hover:text-[#0B1929]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{st.label}</span>
                </button>
              );
            })}
          </div>

          {anamnesis.completado_por && (
            <span className="text-[11px] font-semibold text-[#6B7A8D] bg-slate-100 px-2.5 py-1 rounded-lg">
              Llenado por: {anamnesis.completado_por === "paciente" ? "Paciente" : "Nutriólogo"}
            </span>
          )}
        </div>

        {/* Body del Expediente */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* SECCIÓN 1: IDENTIFICACIÓN PERMANENTE */}
          {historiaStep === "perfil" && (
            <div className="space-y-4">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 space-y-3.5">
                <span className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider">
                  Ficha de Identificación del Paciente
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Nombre */}
                  <div>
                    <label className="block text-xs font-bold text-[#0B1929] mb-1">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      value={perfil.nombre}
                      onChange={(e) => updPerfil("nombre", e.target.value)}
                      placeholder="Nombre del paciente"
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>

                  {/* Correo Electrónico */}
                  <div>
                    <label className="block text-xs font-bold text-[#0B1929] mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={perfil.email}
                      disabled
                      className="w-full bg-slate-100 border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#6B7A8D] cursor-not-allowed"
                      title="El correo es el identificador único de cuenta"
                    />
                  </div>

                  {/* Teléfono / WhatsApp */}
                  <div>
                    <label className="block text-xs font-bold text-[#0B1929] mb-1">
                      Teléfono / WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={perfil.telefono}
                      onChange={(e) => updPerfil("telefono", e.target.value)}
                      placeholder="Ej. +52 55 1234 5678"
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>

                  {/* Fecha de Nacimiento */}
                  <div>
                    <label className="block text-xs font-bold text-[#0B1929] mb-1">
                      Fecha de Nacimiento {edadNum !== null && <span className="text-[var(--brand-primary)] font-normal">({edadNum} años)</span>}
                    </label>
                    <input
                      type="date"
                      value={perfil.fecha_nacimiento}
                      onChange={(e) => updPerfil("fecha_nacimiento", e.target.value)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>

                  {/* Género Biológico */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#0B1929] mb-1">
                      Género Biológico
                    </label>
                    <CustomSelect
                      value={perfil.sexo}
                      onChange={(val) => updPerfil("sexo", val)}
                      placeholder="Selecciona..."
                      options={GENERO_OPTIONS}
                    />
                  </div>
                </div>
              </div>

              {/* Ocupación y contexto general */}
              <div>
                <label className="block text-xs font-bold text-[#0B1929] mb-1">
                  Ocupación y contexto laboral / diario
                </label>
                <input
                  type="text"
                  value={anamnesis.ocupacion_actividad || ""}
                  onChange={(e) => updAnamnesis("ocupacion_actividad", e.target.value)}
                  placeholder="Ej. Ingeniero de software sedentario 8h, estudiante, comerciante..."
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/70 text-xs text-blue-900 leading-relaxed">
                <span className="font-bold block text-blue-950 mb-0.5">Información Atemporal Permanente</span>
                Los datos de esta ficha y sus antecedentes clínicos permanecen a lo largo del tiempo. Las preferencias de comidas, recordatorio de 24 horas y hábitos de la etapa se evalúan directamente en cada plan de progreso.
              </div>
            </div>
          )}

          {/* SECCIÓN 2: ANTECEDENTES CLÍNICOS Y MÉDICOS */}
          {historiaStep === "clinico" && (
            <div className="space-y-4">
              {/* Patologías */}
              <div>
                <label className="block text-xs font-bold text-[#0B1929] mb-1">
                  Condiciones médicas o patologías crónicas
                </label>
                <input
                  type="text"
                  value={anamnesis.patologias || ""}
                  onChange={(e) => updAnamnesis("patologias", e.target.value)}
                  placeholder="Ej. Resistencia a la insulina, hipotiroidismo, hipertensión, SOP..."
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                />
              </div>

              {/* Antecedentes Heredofamiliares */}
              <div>
                <label className="block text-xs font-bold text-[#0B1929] mb-1">
                  Antecedentes Heredofamiliares
                </label>
                <input
                  type="text"
                  value={anamnesis.antecedentes_heredofamiliares || ""}
                  onChange={(e) => updAnamnesis("antecedentes_heredofamiliares", e.target.value)}
                  placeholder="Ej. Diabetes tipo 2 (padre), hipertensión arterial (madre), cardiopatías..."
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                />
              </div>

              {/* Medicación */}
              <div>
                <label className="block text-xs font-bold text-[#0B1929] mb-1">
                  Medicación y suplementación crónica actual
                </label>
                <input
                  type="text"
                  value={anamnesis.medicacion_suplementos || ""}
                  onChange={(e) => updAnamnesis("medicacion_suplementos", e.target.value)}
                  placeholder="Ej. Metformina 850mg c/12h, Levotiroxina 50mcg, Omega 3..."
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                />
              </div>

              {/* Alergias y Digestión */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#0B1929] mb-1">
                    Alergias o intolerancias alimentarias crónicas
                  </label>
                  <input
                    type="text"
                    value={anamnesis.alergias_intolerancias || ""}
                    onChange={(e) => updAnamnesis("alergias_intolerancias", e.target.value)}
                    placeholder="Ej. Lactosa, mariscos, cacahuate, celiaquía/gluten..."
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0B1929] mb-1">
                    Síntomas digestivos o gastrointestinales crónicos
                  </label>
                  <input
                    type="text"
                    value={anamnesis.sintomas_gi || ""}
                    onChange={(e) => updAnamnesis("sintomas_gi", e.target.value)}
                    placeholder="Ej. Normal, reflujo gastroesofágico frecuente, colitis, estreñimiento..."
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>
              </div>

              {/* Cirugías o lesiones */}
              <div>
                <label className="block text-xs font-bold text-[#0B1929] mb-1">
                  Cirugías previas o lesiones osteomusculares crónicas
                </label>
                <input
                  type="text"
                  value={anamnesis.cirugias_lesiones || ""}
                  onChange={(e) => updAnamnesis("cirugias_lesiones", e.target.value)}
                  placeholder="Ej. Apendicectomía (2020), lesión menisco rodilla derecha, hernia lumbar L4-L5..."
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                />
              </div>

              {/* Consumo alcohol o tabaco */}
              <div>
                <label className="block text-xs font-bold text-[#0B1929] mb-1">
                  Toxicomanías: Consumo de alcohol o tabaco
                </label>
                <input
                  type="text"
                  value={anamnesis.consumo_alcohol_tabaco || ""}
                  onChange={(e) => updAnamnesis("consumo_alcohol_tabaco", e.target.value)}
                  placeholder="Ej. Social fines de semana (cerveza) / No fumador..."
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                />
              </div>

              {/* Notas permanentes de la consulta */}
              <div>
                <label className="block text-xs font-bold text-[#0B1929] mb-1">
                  Notas y pautas clínicas permanentes (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={anamnesis.notas_consulta || ""}
                  onChange={(e) => updAnamnesis("notas_consulta", e.target.value)}
                  placeholder="Comentarios clínicos de largo plazo, consideraciones éticas, estilo de vida general..."
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer del Modal */}
        <div className="px-5 py-3.5 border-t border-[#E2E8F0] bg-white flex items-center justify-between gap-2">
          {mode === "nutriologo" ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => setShowConfirmReset(true)}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Borra la historia inicial para volver a realizar el cuestionario clínico"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reiniciar Ficha</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
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
              onClick={handleSaveExpediente}
              className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </div>
      </div>

      {/* Modal Nativo de Confirmación para Reiniciar */}
      <ConfirmModal
        isOpen={showConfirmReset}
        onClose={() => setShowConfirmReset(false)}
        onConfirm={executeResetAnamnesis}
        title="¿Reiniciar Ficha Clínica?"
        description="Se limpiará el registro de antecedentes clínicos del paciente para que puedas volver a responder el expediente o solicitárselo nuevamente."
        confirmText="Sí, reiniciar"
        cancelText="Cancelar"
        danger={false}
        icon="alert"
      />
    </div>
  );
}
