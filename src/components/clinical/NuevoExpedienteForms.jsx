import React, { useState, useEffect, useMemo } from "react";
import {
  ClipboardList,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Send,
  User,
  HeartPulse,
  Utensils,
  Sparkles,
  Clock,
  Save,
  AlertCircle,
  FileText,
  Phone,
  Mail,
  Camera,
  ChevronRight,
  X
} from "lucide-react";
import {
  peekClinicalRecord,
  fetchClinicalRecord,
  saveClinicalRecord,
  EMPTY_ANAMNESIS
} from "../../lib/clinicalRecord";
import { dbPatch, dbPost, storageUpload } from "../../lib/supabase";

function calcAge(birthdate) {
  if (!birthdate) return null;
  const b = new Date(birthdate + "T12:00:00");
  if (isNaN(b.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) {
    age--;
  }
  return age >= 0 && age < 130 ? age : null;
}

export function NuevoExpedienteForms({
  cliente,
  onFinished,
  onBackToList,
  setMsg
}) {
  const clienteId = cliente?.id;
  const [record, setRecord] = useState(() => peekClinicalRecord(clienteId));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Determinar paso inicial:
  // Si ya tiene un borrador en curso, va directo a ese paso (1, 2 o 3).
  // Si tiene solicitud activa al paciente, va al estado "pending_patient".
  // Si es nuevo de todo, va a 0 (pantalla de decisión).
  const [step, setStep] = useState(() => {
    const rec = peekClinicalRecord(clienteId);
    if (rec?.draft_step && [1, 2, 3].includes(rec.draft_step)) {
      return rec.draft_step;
    }
    if (rec?.solicitud_activa === "historia_inicial") {
      return "pending_patient";
    }
    return 0; // Pregunta de bienvenida
  });

  // Estado del perfil del paciente
  const [perfil, setPerfil] = useState({
    nombre: cliente?.nombre || "",
    email: cliente?.email || "",
    telefono: cliente?.telefono || "",
    sexo: cliente?.genero || cliente?.sexo || "M",
    fecha_nacimiento: cliente?.fecha_nacimiento || "",
    foto_url: cliente?.foto_url || "",
  });

  // Estado de la anamnesis
  const [anamnesis, setAnamnesis] = useState(() => ({
    ...EMPTY_ANAMNESIS,
    ...(peekClinicalRecord(clienteId)?.anamnesis || {}),
    ...(peekClinicalRecord(clienteId)?.draft_anamnesis || {})
  }));

  // Sincronizar con almacenamiento remoto
  useEffect(() => {
    if (!clienteId) return;
    fetchClinicalRecord(clienteId).then((fresh) => {
      setRecord(fresh);
      if (fresh?.draft_step && [1, 2, 3].includes(fresh.draft_step)) {
        setStep((prev) => (prev === 0 ? fresh.draft_step : prev));
      } else if (fresh?.solicitud_activa === "historia_inicial") {
        setStep("pending_patient");
      }
      if (fresh?.anamnesis) {
        setAnamnesis((prev) => ({
          ...prev,
          ...fresh.anamnesis,
          ...(fresh.draft_anamnesis || {})
        }));
      }
    });
  }, [clienteId]);

  const edadCalc = useMemo(() => calcAge(perfil.fecha_nacimiento), [perfil.fecha_nacimiento]);

  const updPerfil = (k, v) => setPerfil((p) => ({ ...p, [k]: v }));
  const updAnam = (k, v) => setAnamnesis((p) => ({ ...p, [k]: v }));

  // Subida de foto de perfil
  const handlePhotoUpload = async (file) => {
    if (!file) return;
    setLoading(true);
    try {
      const ext = file.name.split(".").pop();
      const fname = `cliente_${clienteId}_${Date.now()}.${ext}`;
      const url = await storageUpload("logos", fname, file);
      updPerfil("foto_url", url);
      await dbPatch(`clientes?id=eq.${clienteId}`, { foto_url: url }).catch(() => {});
      if (setMsg) setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Foto actualizada</div>);
    } catch (e) {
      if (setMsg) setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {e.message}</div>);
    } finally {
      setLoading(false);
    }
  };

  // ── Opción: Solicitar al paciente previo a la cita ──
  const handleSolicitarPaciente = async () => {
    setSaving(true);
    try {
      const next = {
        ...record,
        solicitud_activa: "historia_inicial",
        solicitud_fecha: new Date().toISOString(),
      };
      const saved = await saveClinicalRecord(clienteId, next);
      setRecord(saved);

      // Notificación al paciente si tiene cuenta activa
      if (cliente.auth_id) {
        await dbPost("notificaciones", {
          profile_id: cliente.auth_id,
          titulo: "Completa tu expediente inicial",
          mensaje: "Tu especialista te ha solicitado llenar tus antecedentes y hábitos antes de tu cita.",
          tipo: "alerta",
          link_url: "perfil",
          entidad_id: cliente.id
        }).catch(() => {});
      }

      if (setMsg) {
        setMsg(
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Solicitud enviada a {cliente.nombre}
          </div>
        );
      }
      onBackToList();
    } catch (e) {
      if (setMsg) setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {e.message}</div>);
    } finally {
      setSaving(false);
    }
  };

  // ── Opción: Terminar más tarde (guarda borrador y regresa a Clientes) ──
  const handleTerminarMasTarde = async () => {
    setSaving(true);
    try {
      // 1. Guardar cambios en el perfil si cambiaron
      const clientPatch = {};
      if (perfil.nombre && perfil.nombre !== cliente.nombre) clientPatch.nombre = perfil.nombre;
      if (perfil.telefono !== cliente.telefono) clientPatch.telefono = perfil.telefono;
      if (perfil.fecha_nacimiento !== cliente.fecha_nacimiento) clientPatch.fecha_nacimiento = perfil.fecha_nacimiento || null;
      if (perfil.sexo) clientPatch.genero = perfil.sexo;
      if (Object.keys(clientPatch).length > 0) {
        await dbPatch(`clientes?id=eq.${clienteId}`, clientPatch).catch(() => {});
      }

      // 2. Guardar borrador en el expediente
      const next = {
        ...record,
        draft_step: step,
        draft_anamnesis: anamnesis,
        anamnesis: {
          ...record.anamnesis,
          ...anamnesis,
          updated_at: new Date().toISOString(),
        }
      };
      await saveClinicalRecord(clienteId, next);

      if (setMsg) {
        setMsg(
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Borrador guardado. Podrás continuar cuando desees.
          </div>
        );
      }
      onBackToList();
    } catch (e) {
      if (setMsg) setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {e.message}</div>);
    } finally {
      setSaving(false);
    }
  };

  // ── Opción: Finalizar cuestionario (completa el expediente y pasa al Asignador) ──
  const handleFinalizar = async () => {
    setSaving(true);
    try {
      // 1. Guardar cambios en el perfil del cliente en base de datos
      const clientPatch = {
        nombre: perfil.nombre || cliente.nombre,
        telefono: perfil.telefono || null,
        fecha_nacimiento: perfil.fecha_nacimiento || null,
        genero: perfil.sexo || "M",
      };
      if (perfil.foto_url) clientPatch.foto_url = perfil.foto_url;
      await dbPatch(`clientes?id=eq.${clienteId}`, clientPatch).catch(() => {});

      // 2. Guardar el expediente clínico como completado
      const finalAnamnesis = {
        ...anamnesis,
        fecha_nacimiento: perfil.fecha_nacimiento || null,
        sexo: perfil.sexo,
        telefono: perfil.telefono,
        updated_at: new Date().toISOString(),
        completado_por: "nutriologo",
      };

      const next = {
        ...record,
        draft_step: null,
        draft_anamnesis: null,
        anamnesis_completada: true,
        solicitud_activa: null,
        anamnesis: finalAnamnesis,
      };

      const saved = await saveClinicalRecord(clienteId, next);

      if (setMsg) {
        setMsg(
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Expediente inicial completado
          </div>
        );
      }

      onFinished(saved);
    } catch (e) {
      if (setMsg) setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {e.message}</div>);
    } finally {
      setSaving(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // VISTA 0: PANTALLA DE DECISIÓN INICIAL
  // ══════════════════════════════════════════════════════════════
  if (step === 0) {
    return (
      <div className="max-w-2xl mx-auto w-full py-8 md:py-12 px-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm overflow-hidden p-6 md:p-10">
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={onBackToList}
              className="p-2 -ml-2 rounded-xl text-[#6B7A8D] hover:text-[#0B1929] hover:bg-gray-100 transition-colors"
              title="Volver a la lista de pacientes"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-bold text-[var(--brand-primary)]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Paciente Nuevo</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-[#0B1929] tracking-tight mb-2">
            Expediente Inicial de {cliente.nombre}
          </h2>
          <p className="text-sm text-[#6B7A8D] mb-8 leading-relaxed">
            Antes de diseñar su primer plan, definamos su historial médico, estilo de vida y hábitos alimentarios. ¿Cómo prefieres recopilar esta información?
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* Opción 1: Llenar en consulta */}
            <button
              type="button"
              onClick={() => setStep(1)}
              className="group text-left p-6 rounded-2xl border-2 border-[#E2E8F0] hover:border-[var(--brand-primary)] hover:bg-blue-50/30 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] group-hover:bg-[var(--brand-primary)] group-hover:text-white transition-all flex items-center justify-center mb-4">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#0B1929] group-hover:text-[var(--brand-primary)] transition-colors mb-1.5">
                  Llenar en consulta ahora
                </h3>
                <p className="text-xs text-[#6B7A8D] leading-relaxed">
                  Responde las 3 páginas de la entrevista clínica tú mismo junto al paciente. Guarda borrador cuando gustes.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-[var(--brand-primary)]">
                <span>Comenzar cuestionario</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Opción 2: Solicitar al paciente */}
            <button
              type="button"
              onClick={handleSolicitarPaciente}
              disabled={saving}
              className="group text-left p-6 rounded-2xl border-2 border-[#E2E8F0] hover:border-emerald-500 hover:bg-emerald-50/30 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all flex items-center justify-center mb-4">
                  <Send className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#0B1929] group-hover:text-emerald-700 transition-colors mb-1.5">
                  Solicitar previo a cita
                </h3>
                <p className="text-xs text-[#6B7A8D] leading-relaxed">
                  Envía el cuestionario a la app de {cliente.nombre}. Te notificaremos en cuanto lo haya completado para programar.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <span>{saving ? "Enviando..." : "Enviar a su app"}</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>

          <div className="pt-4 border-t border-[#F0F4FA] flex justify-between items-center text-xs text-[#6B7A8D]">
            <span>💡 Ningún campo es obligatorio. Podrás editarlo en cualquier momento.</span>
            <button
              type="button"
              onClick={onBackToList}
              className="font-bold text-[#6B7A8D] hover:text-[#0B1929] transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // VISTA PENDING: SOLICITADO AL PACIENTE
  // ══════════════════════════════════════════════════════════════
  if (step === "pending_patient") {
    return (
      <div className="max-w-2xl mx-auto w-full py-8 md:py-12 px-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm p-6 md:p-10 text-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <Clock className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-[#0B1929] tracking-tight mb-2">
            Esperando respuesta del paciente
          </h2>
          <p className="text-sm text-[#6B7A8D] max-w-md mx-auto mb-6 leading-relaxed">
            Se ha solicitado el expediente inicial a <strong>{cliente.nombre}</strong>. En cuanto termine de responderlo en su aplicación, recibirás una notificación y podrás programar su plan de inmediato.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onBackToList}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#E2E8F0] text-sm font-bold text-[#6B7A8D] hover:bg-gray-50 transition-colors"
            >
              Volver a Clientes
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[var(--brand-primary)] text-white text-sm font-bold hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Llenar yo mismo en consulta</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // FORMULARIO DE 3 PÁGINAS (ESTILO GOOGLE FORMS CON PROGRESS BAR)
  // ══════════════════════════════════════════════════════════════
  const progressPct = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div className="max-w-3xl mx-auto w-full py-6 md:py-10 px-4 flex flex-col gap-6 animate-in fade-in duration-200">
      
      {/* ── Top Bar con Barra de Progreso ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-2xs">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand-primary)] bg-blue-50 px-2.5 py-1 rounded-lg">
              Paso {step} de 3
            </span>
            <span className="text-sm font-bold text-[#0B1929] truncate">
              {step === 1 && "Perfil y Antecedentes Clínicos"}
              {step === 2 && "Estilo de Vida y Hábitos"}
              {step === 3 && "Recordatorio de 24 Horas y Objetivos"}
            </span>
          </div>

          {/* Botón: Terminar más tarde */}
          <button
            type="button"
            onClick={handleTerminarMasTarde}
            disabled={saving}
            className="text-xs font-bold text-[#6B7A8D] hover:text-[#0B1929] hover:bg-gray-100 py-1.5 px-3 rounded-xl transition-colors shrink-0 flex items-center gap-1.5"
            title="Guarda el borrador exacto y vuelve a la lista de pacientes"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Terminar más tarde</span>
          </button>
        </div>

        {/* Barra de progreso visual */}
        <div className="w-full bg-[#F0F4FA] h-2 rounded-full overflow-hidden">
          <div
            className="bg-[var(--brand-primary)] h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Indicadores de pasos */}
        <div className="flex justify-between text-[11px] font-semibold text-[#6B7A8D] mt-2">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`hover:text-[#0B1929] transition-colors ${step === 1 ? "text-[var(--brand-primary)] font-bold" : ""}`}
          >
            1. Perfil & Clínico
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            className={`hover:text-[#0B1929] transition-colors ${step === 2 ? "text-[var(--brand-primary)] font-bold" : ""}`}
          >
            2. Hábitos
          </button>
          <button
            type="button"
            onClick={() => setStep(3)}
            className={`hover:text-[#0B1929] transition-colors ${step === 3 ? "text-[var(--brand-primary)] font-bold" : ""}`}
          >
            3. R24H & Metas
          </button>
        </div>
      </div>

      {/* ── Contenido de la Página Actual ── */}
      <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 sm:p-8 shadow-sm">
        
        {/* ═══════════════════════════════════════════════════════
            PÁGINA 1: DATOS GENERALES Y ANTECEDENTES CLÍNICOS
        ═══════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <h3 className="text-base font-bold text-[#0B1929] mb-1 flex items-center gap-2">
                <User className="w-4 h-4 text-[var(--brand-primary)]" />
                Datos Generales del Paciente
              </h3>
              <p className="text-xs text-[#6B7A8D]">
                Información de contacto y demográfica básica.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={perfil.nombre}
                  onChange={(e) => updPerfil("nombre", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  placeholder="Ej. Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                  Correo Electrónico (Inamovible)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={perfil.email}
                    disabled
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-gray-100/70 text-sm font-semibold text-[#6B7A8D] cursor-not-allowed select-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                  Teléfono / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={perfil.telefono}
                    onChange={(e) => updPerfil("telefono", e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    placeholder="Ej. +52 55 1234 5678"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                  Sexo Biológico
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[["M", "Masculino"], ["F", "Femenino"]].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => updPerfil("sexo", val)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        perfil.sexo === val
                          ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-2xs"
                          : "bg-[#F8FAFC] text-[#6B7A8D] border-[#E2E8F0] hover:bg-gray-100"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">
                    Fecha de Nacimiento
                  </label>
                  {edadCalc !== null && (
                    <span className="text-xs font-extrabold text-[var(--brand-primary)] bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                      {edadCalc} años calculados
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={perfil.fecha_nacimiento || ""}
                    onChange={(e) => updPerfil("fecha_nacimiento", e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm font-semibold text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>
              </div>
            </div>

            {/* Separador de sección */}
            <div className="pt-4 border-t border-[#F0F4FA]">
              <h3 className="text-base font-bold text-[#0B1929] mb-1 flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-red-500" />
                Antecedentes Médicos y Clínicos
              </h3>
              <p className="text-xs text-[#6B7A8D] mb-4">
                Condiciones que impactan la pauta nutricional y deportiva.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                    Patologías o Diagnósticos Médicos
                  </label>
                  <textarea
                    rows={2}
                    value={anamnesis.patologias || ""}
                    onChange={(e) => updAnam("patologias", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    placeholder="Ej. Resistencia a la insulina, hipotiroidismo, hipertensión..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                    Medicación Actual y/o Suplementos
                  </label>
                  <textarea
                    rows={2}
                    value={anamnesis.medicacion_suplementos || ""}
                    onChange={(e) => updAnam("medicacion_suplementos", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    placeholder="Ej. Metformina 850mg, Levotiroxina 50mcg, Creatina monohidrato..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                      Alergias o Intolerancias Alimentarias
                    </label>
                    <textarea
                      rows={2}
                      value={anamnesis.alergias_intolerancias || ""}
                      onChange={(e) => updAnam("alergias_intolerancias", e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                      placeholder="Ej. Lactosa, mariscos, frutos secos, gluten..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                      Síntomas Gastrointestinales Frecuentes
                    </label>
                    <textarea
                      rows={2}
                      value={anamnesis.sintomas_gi || ""}
                      onChange={(e) => updAnam("sintomas_gi", e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                      placeholder="Ej. Reflujo nocturno, distensión vespertina, estreñimiento..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                    Cirugías Previas o Lesiones Físicas
                  </label>
                  <input
                    type="text"
                    value={anamnesis.cirugias_lesiones || ""}
                    onChange={(e) => updAnam("cirugias_lesiones", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    placeholder="Ej. Hernia discal L4-L5, operación de menisco rodilla derecha..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            PÁGINA 2: ESTILO DE VIDA Y HÁBITOS
        ═══════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <h3 className="text-base font-bold text-[#0B1929] mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Estilo de Vida y Rutina Diaria
              </h3>
              <p className="text-xs text-[#6B7A8D]">
                Horarios, ocupación y descanso para adaptar los tiempos de comida.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                  Ocupación y Nivel de Actividad Laboral
                </label>
                <input
                  type="text"
                  value={anamnesis.ocupacion_actividad || ""}
                  onChange={(e) => updAnam("ocupacion_actividad", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  placeholder="Ej. Ingeniero de software (sedentario 8h) / Maestro de obras (activo)"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                  Horas de Sueño Promedio
                </label>
                <input
                  type="text"
                  value={anamnesis.horas_sueno || ""}
                  onChange={(e) => updAnam("horas_sueno", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  placeholder="Ej. 6 a 7 horas diarias (duerme a las 11pm)"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                  Consumo Estimado de Agua Natural
                </label>
                <input
                  type="text"
                  value={anamnesis.consumo_agua_estimado || ""}
                  onChange={(e) => updAnam("consumo_agua_estimado", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  placeholder="Ej. 1.5 a 2 litros al día"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                  Nivel de Estrés Percibido (1 = Bajo, 5 = Muy Alto)
                </label>
                <div className="flex gap-2">
                  {["1", "2", "3", "4", "5"].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => updAnam("nivel_estres", lvl)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        String(anamnesis.nivel_estres) === lvl
                          ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-2xs"
                          : "bg-[#F8FAFC] text-[#6B7A8D] border-[#E2E8F0] hover:bg-gray-100"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                  Consumo de Alcohol / Tabaco (Opcional)
                </label>
                <input
                  type="text"
                  value={anamnesis.consumo_alcohol_tabaco || ""}
                  onChange={(e) => updAnam("consumo_alcohol_tabaco", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  placeholder="Ej. Social fines de semana (cerveza) / No fuma"
                />
              </div>
            </div>

            {/* Separador de gustos */}
            <div className="pt-4 border-t border-[#F0F4FA]">
              <h3 className="text-base font-bold text-[#0B1929] mb-1 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-emerald-600" />
                Preferencias y Gustos Alimentarios
              </h3>
              <p className="text-xs text-[#6B7A8D] mb-4">
                Facilita la adherencia incluyendo lo que le gusta y excluyendo lo que detesta.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1.5">
                    Alimentos Predilectos (Los que le encantan)
                  </label>
                  <textarea
                    rows={2}
                    value={anamnesis.preferencias_alimentos || ""}
                    onChange={(e) => updAnam("preferencias_alimentos", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    placeholder="Ej. Huevo al desayuno, pollo a la plancha, avena, frutas cítricas, aguacate..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-red-600 uppercase tracking-wider mb-1.5">
                    Alimentos que Rechaza o Desagradan
                  </label>
                  <textarea
                    rows={2}
                    value={anamnesis.aversiones_alimentos || ""}
                    onChange={(e) => updAnam("aversiones_alimentos", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    placeholder="Ej. Pescado/mariscos, brócoli, hígado, mayonesa..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            PÁGINA 3: RECORDATORIO DE 24 HORAS (R24H) Y METAS
        ═══════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <h3 className="text-base font-bold text-[#0B1929] mb-1 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-[var(--brand-primary)]" />
                Recordatorio de 24 Horas (R24H)
              </h3>
              <p className="text-xs text-[#6B7A8D]">
                ¿Cómo comía el paciente en un día habitual antes de venir a consulta?
              </p>
            </div>

            <div className="space-y-3">
              {[
                ["r24h_desayuno", "Desayuno habitual", "Ej. 2 huevos con frijoles y café con azúcar"],
                ["r24h_colacion_m", "Colación matutina (si aplica)", "Ej. Manzana con galletas"],
                ["r24h_comida", "Comida principal", "Ej. Pechuga de pollo, arroz, ensalada y agua de sabor"],
                ["r24h_colacion_v", "Colación vespertina (si aplica)", "Ej. Yogur griego o barra de cereal"],
                ["r24h_cena", "Cena habitual", "Ej. Quesadillas con jamón o cereal con leche"],
                ["r24h_picoteos", "Bebidas o picoteos entre horas", "Ej. Refresco diario, papitas en la tarde..."]
              ].map(([key, label, placeholder]) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={anamnesis[key] || ""}
                    onChange={(e) => updAnam(key, e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>

            {/* Separador de Objetivo */}
            <div className="pt-4 border-t border-[#F0F4FA]">
              <h3 className="text-base font-bold text-[#0B1929] mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Objetivo y Expectativas
              </h3>
              <p className="text-xs text-[#6B7A8D] mb-4">
                La meta que guiará el diseño de su primer plan.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                    Objetivo Principal del Paciente
                  </label>
                  <input
                    type="text"
                    value={anamnesis.objetivo_principal || ""}
                    onChange={(e) => updAnam("objetivo_principal", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm font-semibold text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    placeholder="Ej. Pérdida de grasa corporal manteniendo masa muscular"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                    Notas y Observaciones de la Consulta (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={anamnesis.notas_consulta || ""}
                    onChange={(e) => updAnam("notas_consulta", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    placeholder="Comentarios adicionales, motivación del paciente, acuerdos especiales..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Footer de Navegación ── */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <div>
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-xs sm:text-sm font-bold text-[#6B7A8D] hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep(0)}
              className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-xs sm:text-sm font-bold text-[#6B7A8D] hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a Opciones</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Terminar más tarde en el pie */}
          <button
            type="button"
            onClick={handleTerminarMasTarde}
            disabled={saving}
            className="px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-xs sm:text-sm font-semibold text-[#6B7A8D] hover:bg-gray-50 transition-colors"
          >
            Terminar más tarde
          </button>

          {/* Siguiente o Finalizar */}
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="px-5 py-2.5 rounded-xl bg-[var(--brand-primary)] text-white text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm"
            >
              <span>Siguiente</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalizar}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-[var(--brand-primary)] text-white text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? "Guardando..." : "Finalizar y Comenzar Plan"}</span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
}

export default NuevoExpedienteForms;
