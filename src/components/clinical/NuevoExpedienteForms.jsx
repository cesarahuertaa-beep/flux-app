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
  Phone,
  Mail,
  ChevronRight,
  X,
  MessageCircle,
  HelpCircle
} from "lucide-react";
import {
  peekClinicalRecord,
  fetchClinicalRecord,
  saveClinicalRecord,
  EMPTY_ANAMNESIS
} from "../../lib/clinicalRecord";
import { dbPatch, dbPost, storageUpload } from "../../lib/supabase";
import { extractClinicalHighlights } from "../../lib/clinicalAi";

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

function sanitizeWhatsAppPhone(phone) {
  if (!phone) return "";
  let clean = String(phone).replace(/\D/g, "");
  if (clean.length === 10) clean = "52" + clean;
  return clean;
}

function fmtFechaHora(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function NuevoExpedienteForms({
  cliente,
  onFinished,
  onBackToList,
  setMsg,
  mode = "nutriologo" // "nutriologo" | "paciente"
}) {
  const clienteId = cliente?.id;
  const isPatientMode = mode === "paciente";
  const [record, setRecord] = useState(() => peekClinicalRecord(clienteId));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Determinar paso inicial:
  // - Modo paciente: empieza en 1 o en su borrador previo guardado (nunca en 0).
  // - Modo nutriólogo: si tiene borrador va a ese paso; si ya se solicitó al paciente va a "pending_patient"; sino va a 0 (decisión).
  const [step, setStep] = useState(() => {
    const rec = peekClinicalRecord(clienteId);
    if (isPatientMode) {
      if (rec?.draft_step && [1, 2, 3].includes(rec.draft_step)) {
        return rec.draft_step;
      }
      return 1;
    }
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
    objetivo: cliente?.objetivo || "",
  });

  // Estado de la anamnesis
  const [anamnesis, setAnamnesis] = useState(() => {
    const peek = peekClinicalRecord(clienteId);
    return {
      ...EMPTY_ANAMNESIS,
      ...(peek?.anamnesis || {}),
      ...(peek?.draft_anamnesis || {}),
      objetivo_principal: peek?.anamnesis?.objetivo_principal || peek?.draft_anamnesis?.objetivo_principal || cliente?.objetivo || "",
    };
  });

  // Sincronizar con almacenamiento remoto
  useEffect(() => {
    if (!clienteId) return;
    fetchClinicalRecord(clienteId).then((fresh) => {
      setRecord(fresh);
      if (isPatientMode) {
        if (fresh?.draft_step && [1, 2, 3].includes(fresh.draft_step)) {
          setStep(fresh.draft_step);
        } else {
          setStep((prev) => (typeof prev === "number" ? prev : 1));
        }
      } else {
        if (fresh?.draft_step && [1, 2, 3].includes(fresh.draft_step)) {
          setStep((prev) => (prev === 0 ? fresh.draft_step : prev));
        } else if (fresh?.solicitud_activa === "historia_inicial") {
          setStep((prev) => (prev === 0 ? "pending_patient" : prev));
        }
      }
      if (fresh?.anamnesis) {
        setAnamnesis((prev) => ({
          ...prev,
          ...fresh.anamnesis,
          ...(fresh.draft_anamnesis || {}),
          objetivo_principal:
            fresh.anamnesis.objetivo_principal ||
            fresh.draft_anamnesis?.objetivo_principal ||
            cliente?.objetivo ||
            prev.objetivo_principal ||
            "",
        }));
      }
    });
  }, [clienteId, cliente?.objetivo, isPatientMode]);

  const edadCalc = useMemo(() => calcAge(perfil.fecha_nacimiento), [perfil.fecha_nacimiento]);

  const updPerfil = (k, v) => setPerfil((p) => ({ ...p, [k]: v }));
  const updAnam = (k, v) => setAnamnesis((p) => ({ ...p, [k]: v }));

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

      setStep("solicitud_enviada");
    } catch (e) {
      if (setMsg) setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {e.message}</div>);
    } finally {
      setSaving(false);
    }
  };

  // ── Opción: Terminar más tarde (guarda borrador) ──
  const handleTerminarMasTarde = async () => {
    setSaving(true);
    try {
      // 1. Guardar cambios en el perfil si cambiaron
      const clientPatch = {};
      if (perfil.nombre && perfil.nombre !== cliente.nombre) clientPatch.nombre = perfil.nombre;
      if (perfil.telefono !== cliente.telefono) clientPatch.telefono = perfil.telefono;
      if (perfil.fecha_nacimiento !== cliente.fecha_nacimiento) clientPatch.fecha_nacimiento = perfil.fecha_nacimiento || null;
      if (perfil.sexo) clientPatch.genero = perfil.sexo;
      const targetObj = perfil.objetivo || anamnesis.objetivo_principal || "";
      if (targetObj && targetObj !== cliente.objetivo) clientPatch.objetivo = targetObj;
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

  // ── Opción: Finalizar cuestionario ──
  const handleFinalizar = async () => {
    setSaving(true);
    try {
      const targetObj = perfil.objetivo || anamnesis.objetivo_principal || cliente.objetivo || null;
      // 1. Guardar cambios en el perfil del cliente en base de datos
      const clientPatch = {
        nombre: perfil.nombre || cliente.nombre,
        telefono: perfil.telefono || null,
        fecha_nacimiento: perfil.fecha_nacimiento || null,
        genero: perfil.sexo || "M",
        objetivo: targetObj,
      };
      if (perfil.foto_url) clientPatch.foto_url = perfil.foto_url;
      await dbPatch(`clientes?id=eq.${clienteId}`, clientPatch).catch(() => {});

      // 2. Guardar el expediente clínico como completado
      const finalAnamnesis = {
        ...anamnesis,
        fecha_nacimiento: perfil.fecha_nacimiento || null,
        sexo: perfil.sexo,
        telefono: perfil.telefono,
        objetivo_principal: targetObj,
        updated_at: new Date().toISOString(),
        completado_por: isPatientMode ? "paciente" : "nutriologo",
      };

      // Generar síntesis inicial de la IA
      const highlights = extractClinicalHighlights(finalAnamnesis, { ...cliente, ...clientPatch });
      finalAnamnesis.resumen_ia = {
        texto: highlights.sintesisTexto,
        origen: "estructurado",
        generado_en: new Date().toISOString(),
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

      // Si fue completado por el paciente, notificar al nutriólogo
      if (isPatientMode && cliente.nutriologo_id) {
        await dbPost("notificaciones", {
          profile_id: cliente.nutriologo_id,
          titulo: "Expediente completado",
          mensaje: `${perfil.nombre || cliente.nombre} ha completado su expediente clínico y hábitos. Ya puedes programar su plan.`,
          tipo: "alerta",
          link_url: "programar",
          entidad_id: cliente.id
        }).catch(() => {});
      }

      if (isPatientMode) {
        setStep("patient_success");
      } else {
        if (setMsg) {
          setMsg(
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Expediente inicial completado
            </div>
          );
        }
        onFinished(saved, clientPatch);
      }
    } catch (e) {
      if (setMsg) setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {e.message}</div>);
    } finally {
      setSaving(false);
    }
  };

  // URL y mensaje para WhatsApp
  const primerNombre = (perfil.nombre || cliente?.nombre || "campeón").trim().split(" ")[0];
  const appOrigin = typeof window !== "undefined" ? window.location.origin : "https://flux-sport.com";
  const waInvitationMsg = `¡Hola ${primerNombre}! 👋 Te saluda tu especialista de FLUX. Te comparto el acceso a la app para que por favor completes tu expediente clínico y hábitos antes de nuestra consulta: ${appOrigin} ¡Nos vemos pronto!`;
  const waReminderMsg = `¡Hola ${primerNombre}! 👋 Te recuerdo llenar tu cuestionario inicial en FLUX antes de nuestra cita para tener preparado tu plan personalizado: ${appOrigin} 💪`;
  const cleanPhone = sanitizeWhatsAppPhone(perfil.telefono || cliente?.telefono);
  const waInvitationUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waInvitationMsg)}` : null;
  const waReminderUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waReminderMsg)}` : null;

  // ══════════════════════════════════════════════════════════════
  // VISTA 0: PANTALLA DE DECISIÓN INICIAL (SOLO NUTRIÓLOGO)
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
            <span>💡 Ningún campo es obligatorio salvo su email. Podrás editarlo en cualquier momento.</span>
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
  // VISTA SUCCESS: SOLICITUD ENVIADA (FEEDBACK CON BOTÓN WHATSAPP)
  // ══════════════════════════════════════════════════════════════
  if (step === "solicitud_enviada") {
    return (
      <div className="max-w-2xl mx-auto w-full py-8 md:py-12 px-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm p-6 md:p-10 text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-200 shadow-2xs">
            <Send className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-[#0B1929] tracking-tight mb-2">
            ¡Cuestionario solicitado a {cliente.nombre}!
          </h2>
          <p className="text-sm text-[#6B7A8D] max-w-md mx-auto mb-6 leading-relaxed">
            Se ha activado la solicitud en su aplicación FLUX. El paciente podrá responder sus 3 páginas de antecedentes, hábitos y alimentación desde su dispositivo.
          </p>

          {/* Tarjeta de invitación WhatsApp */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-5 mb-6 text-left">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-[#0B1929]">
              <MessageCircle className="w-4 h-4 text-[#25D366]" />
              <span>Recordatorio por WhatsApp (Recomendado)</span>
            </div>
            <p className="text-xs text-[#6B7A8D] mb-3">
              Envíale un mensaje a <strong>{cliente.nombre}</strong> con el enlace a su app para que lo conteste antes de la consulta:
            </p>
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 text-xs text-[#4A5568] italic mb-3">
              "{waInvitationMsg}"
            </div>
            {waInvitationUrl ? (
              <a
                href={waInvitationUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span>Enviar invitación por WhatsApp</span>
              </a>
            ) : (
              <div className="text-xs text-amber-600 font-medium bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                ⚠️ Este paciente no tiene número de teléfono registrado. Puedes agregarlo editando su perfil en Clientes.
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onBackToList}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#0B1929] text-white text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity shadow-sm"
            >
              Listo, volver a Pacientes
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // VISTA PENDING: SOLICITADO AL PACIENTE (ESTADO DE ESPERA)
  // ══════════════════════════════════════════════════════════════
  if (step === "pending_patient") {
    return (
      <div className="max-w-2xl mx-auto w-full py-8 md:py-12 px-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm p-6 md:p-10 text-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4 border border-amber-200 shadow-2xs">
            <Clock className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-[#0B1929] tracking-tight mb-2">
            Esperando respuesta del paciente
          </h2>
          <p className="text-sm text-[#6B7A8D] max-w-md mx-auto mb-6 leading-relaxed">
            Se ha solicitado el expediente inicial a <strong>{cliente.nombre}</strong>
            {record?.solicitud_fecha && ` el ${fmtFechaHora(record.solicitud_fecha)}`}. En cuanto termine de responderlo en su aplicación, recibirás una notificación y podrás programar su plan de inmediato.
          </p>

          {/* Recordatorio WhatsApp si tiene teléfono */}
          {waReminderUrl && (
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 mb-6 text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                    ¿Aún no lo ha contestado?
                  </p>
                  <p className="text-[11px] text-[#6B7A8D] truncate">
                    Reenvíale un recordatorio directo a su WhatsApp con el enlace.
                  </p>
                </div>
                <a
                  href={waReminderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs shrink-0 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-white" />
                  <span>Recordar</span>
                </a>
              </div>
            </div>
          )}

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
  // VISTA SUCCESS PACIENTE: ENVIADO A SU ESPECIALISTA
  // ══════════════════════════════════════════════════════════════
  if (step === "patient_success") {
    return (
      <div className="max-w-2xl mx-auto w-full py-12 px-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm p-8 md:p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-5 border border-emerald-200 shadow-2xs">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-bold text-[#0B1929] mb-2" style={{ fontFamily: "DM Sans" }}>
            ¡Expediente enviado a tu especialista!
          </h2>
          <p className="text-sm text-[#6B7A8D] max-w-md mx-auto mb-8 leading-relaxed">
            Muchas gracias, <strong>{perfil.nombre || cliente.nombre}</strong>. Tu información clínica, hábitos y preferencias se han guardado con éxito. Tu especialista revisará tus respuestas para diseñar tu plan personalizado.
          </p>
          <button
            type="button"
            onClick={() => {
              if (onFinished) onFinished(record, perfil);
              else if (onBackToList) onBackToList();
            }}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[var(--brand-primary)] text-white text-sm font-bold hover:opacity-90 transition-opacity shadow-sm"
          >
            Continuar a mi aplicación
          </button>
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
              {step === 1 && (isPatientMode ? "Tus Datos y Antecedentes de Salud" : "Perfil y Antecedentes Clínicos")}
              {step === 2 && (isPatientMode ? "Tus Hábitos y Preferencias Alimentarias" : "Estilo de Vida y Hábitos")}
              {step === 3 && (isPatientMode ? "Tu Día de Comidas (R24H) y Objetivos" : "Recordatorio de 24 Horas y Objetivos")}
            </span>
          </div>

          {/* Botón: Terminar más tarde */}
          <button
            type="button"
            onClick={handleTerminarMasTarde}
            disabled={saving}
            className="text-xs font-bold text-[#6B7A8D] hover:text-[#0B1929] hover:bg-gray-100 py-1.5 px-3 rounded-xl transition-colors shrink-0 flex items-center gap-1.5"
            title="Guarda el borrador exacto y continúa después"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Guardar borrador</span>
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
            1. {isPatientMode ? "Salud & Datos" : "Perfil & Clínico"}
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            className={`hover:text-[#0B1929] transition-colors ${step === 2 ? "text-[var(--brand-primary)] font-bold" : ""}`}
          >
            2. {isPatientMode ? "Hábitos & Gustos" : "Hábitos"}
          </button>
          <button
            type="button"
            onClick={() => setStep(3)}
            className={`hover:text-[#0B1929] transition-colors ${step === 3 ? "text-[var(--brand-primary)] font-bold" : ""}`}
          >
            3. {isPatientMode ? "Comidas & Meta" : "R24H & Metas"}
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
                {isPatientMode ? "Tus Datos de Contacto y Personales" : "Datos Generales del Paciente"}
              </h3>
              <p className="text-xs text-[#6B7A8D]">
                {isPatientMode
                  ? "Verifica tu información básica para que tu especialista pueda comunicarse contigo."
                  : "Información de contacto y demográfica básica."}
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
                    placeholder="Ej. 55 1234 5678"
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
                {isPatientMode ? "Tu Historial Médico y de Salud" : "Antecedentes Médicos y Clínicos"}
              </h3>
              <p className="text-xs text-[#6B7A8D] mb-4">
                {isPatientMode
                  ? "Esta información le permite a tu especialista cuidar tu salud y adaptar tus requerimientos."
                  : "Condiciones que impactan la pauta nutricional y deportiva."}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                    {isPatientMode ? "¿Padeces alguna enfermedad, condición o diagnóstico médico?" : "Patologías o Diagnósticos Médicos"}
                  </label>
                  <textarea
                    rows={2}
                    value={anamnesis.patologias || ""}
                    onChange={(e) => updAnam("patologias", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    placeholder={isPatientMode ? "Ej. Hipotiroidismo, resistencia a la insulina, hipertensión, ninguna..." : "Ej. Resistencia a la insulina, hipotiroidismo, hipertensión..."}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                    {isPatientMode ? "¿Tomas algún medicamento recetado o suplemento actualmente?" : "Medicación Actual y/o Suplementos"}
                  </label>
                  <textarea
                    rows={2}
                    value={anamnesis.medicacion_suplementos || ""}
                    onChange={(e) => updAnam("medicacion_suplementos", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    placeholder={isPatientMode ? "Ej. Levotiroxina 50mcg, Creatina monohidrato, ninguno..." : "Ej. Metformina 850mg, Levotiroxina 50mcg, Creatina monohidrato..."}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                      {isPatientMode ? "¿Tienes alguna alergia o intolerancia a alimentos?" : "Alergias o Intolerancias Alimentarias"}
                    </label>
                    <textarea
                      rows={2}
                      value={anamnesis.alergias_intolerancias || ""}
                      onChange={(e) => updAnam("alergias_intolerancias", e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                      placeholder={isPatientMode ? "Ej. Intolerante a la lactosa, alergia a mariscos, frutos secos, ninguna..." : "Ej. Lactosa, mariscos, frutos secos, gluten..."}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                      {isPatientMode ? "¿Sueles presentar molestias digestivas?" : "Síntomas Gastrointestinales Frecuentes"}
                    </label>
                    <textarea
                      rows={2}
                      value={anamnesis.sintomas_gi || ""}
                      onChange={(e) => updAnam("sintomas_gi", e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                      placeholder={isPatientMode ? "Ej. Inflamación por las tardes, acidez, reflujo, estreñimiento..." : "Ej. Reflujo nocturno, distensión vespertina, estreñimiento..."}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                    {isPatientMode ? "¿Has tenido cirugías previas o tienes alguna lesión física?" : "Cirugías Previas o Lesiones Físicas"}
                  </label>
                  <input
                    type="text"
                    value={anamnesis.cirugias_lesiones || ""}
                    onChange={(e) => updAnam("cirugias_lesiones", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    placeholder={isPatientMode ? "Ej. Operación de menisco en rodilla derecha, molestia en hombro, ninguna..." : "Ej. Hernia discal L4-L5, operación de menisco rodilla derecha..."}
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
                {isPatientMode ? "Tu Estilo de Vida y Rutina Diaria" : "Estilo de Vida y Rutina Diaria"}
              </h3>
              <p className="text-xs text-[#6B7A8D]">
                {isPatientMode
                  ? "Tus horarios, nivel de descanso y actividades para ajustar los tiempos de tu plan."
                  : "Horarios, ocupación y descanso para adaptar los tiempos de comida."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                  {isPatientMode ? "¿A qué te dedicas y cómo es tu actividad en el día?" : "Ocupación y Nivel de Actividad Laboral"}
                </label>
                <input
                  type="text"
                  value={anamnesis.ocupacion_actividad || ""}
                  onChange={(e) => updAnam("ocupacion_actividad", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  placeholder={isPatientMode ? "Ej. Trabajo en oficina sentado 8h / Trabajo activo de pie / Estudiante..." : "Ej. Ingeniero de software (sedentario 8h) / Maestro de obras (activo)"}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                  {isPatientMode ? "¿Cuántas horas duermes habitualmente por noche?" : "Horas de Sueño Promedio"}
                </label>
                <input
                  type="text"
                  value={anamnesis.horas_sueno || ""}
                  onChange={(e) => updAnam("horas_sueno", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  placeholder={isPatientMode ? "Ej. 7 horas (duermo a las 11pm y despierto a las 6am)" : "Ej. 6 a 7 horas diarias (duerme a las 11pm)"}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                  {isPatientMode ? "¿Cuánta agua natural tomas al día aproximadamente?" : "Consumo Estimado de Agua Natural"}
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
                  {isPatientMode ? "¿Cómo calificarías tu nivel de estrés habitualmente?" : "Nivel de Estrés Percibido (1 = Bajo, 5 = Muy Alto)"}
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
                  {isPatientMode ? "¿Consumes alcohol o tabaco en ocasiones? (Opcional)" : "Consumo de Alcohol / Tabaco (Opcional)"}
                </label>
                <input
                  type="text"
                  value={anamnesis.consumo_alcohol_tabaco || ""}
                  onChange={(e) => updAnam("consumo_alcohol_tabaco", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  placeholder={isPatientMode ? "Ej. Social fines de semana (cerveza) / No fumo" : "Ej. Social fines de semana (cerveza) / No fuma"}
                />
              </div>
            </div>

            {/* Separador de gustos */}
            <div className="pt-4 border-t border-[#F0F4FA]">
              <h3 className="text-base font-bold text-[#0B1929] mb-1 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-emerald-600" />
                {isPatientMode ? "Tus Gustos y Preferencias de Comida" : "Preferencias y Gustos Alimentarios"}
              </h3>
              <p className="text-xs text-[#6B7A8D] mb-4">
                {isPatientMode
                  ? "Para que disfrutes tu alimentación, cuéntanos qué comidas te encantan y cuáles prefieres evitar."
                  : "Facilita la adherencia incluyendo lo que le gusta y excluyendo lo que detesta."}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1.5">
                    {isPatientMode ? "Comidas o alimentos que más te gustan (Tus favoritos)" : "Alimentos Predilectos (Los que le encantan)"}
                  </label>
                  <textarea
                    rows={2}
                    value={anamnesis.preferencias_alimentos || ""}
                    onChange={(e) => updAnam("preferencias_alimentos", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    placeholder={isPatientMode ? "Ej. Huevo al desayuno, pollo a la plancha, avena con fruta, aguacate, café..." : "Ej. Huevo al desayuno, pollo a la plancha, avena, frutas cítricas, aguacate..."}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-red-600 uppercase tracking-wider mb-1.5">
                    {isPatientMode ? "Alimentos que no te gustan o prefieres no comer" : "Alimentos que Rechaza o Desagradan"}
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
                {isPatientMode ? "Tu Alimentación Habitual en un Día Común" : "Recordatorio de 24 Horas (R24H)"}
              </h3>
              <p className="text-xs text-[#6B7A8D]">
                {isPatientMode
                  ? "¿Cómo sueles comer normalmente en tu día a día? Esto nos ayuda a entender tu punto de partida."
                  : "¿Cómo comía el paciente en un día habitual antes de venir a consulta?"}
              </p>
            </div>

            <div className="space-y-3">
              {[
                ["r24h_desayuno", isPatientMode ? "¿Qué desayunas normalmente?" : "Desayuno habitual", "Ej. 2 huevos con frijoles y café con azúcar"],
                ["r24h_colacion_m", isPatientMode ? "Colación de la mañana (si acostumbras)" : "Colación matutina (si aplica)", "Ej. Manzana con galletas"],
                ["r24h_comida", isPatientMode ? "¿Qué comes en tu comida principal?" : "Comida principal", "Ej. Pechuga de pollo, arroz, ensalada y agua fresca"],
                ["r24h_colacion_v", isPatientMode ? "Colación de la tarde (si acostumbras)" : "Colación vespertina (si aplica)", "Ej. Yogur griego o fruta picada"],
                ["r24h_cena", isPatientMode ? "¿Qué sueles cenar habitualmente?" : "Cena habitual", "Ej. Quesadillas con jamón o cereal con leche"],
                ["r24h_picoteos", isPatientMode ? "¿Bebes algo azucarado o picoteas entre comidas?" : "Bebidas o picoteos entre horas", "Ej. Refresco diario, botanas en la tarde, café con galleta..."]
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
                {isPatientMode ? "Tus Objetivos y Expectativas" : "Objetivo y Expectativas"}
              </h3>
              <p className="text-xs text-[#6B7A8D] mb-4">
                {isPatientMode
                  ? "Cuéntale a tu especialista qué meta deseas alcanzar para enfocar tu plan."
                  : "La meta que guiará el diseño de su primer plan."}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                    {isPatientMode ? "¿Cuál es tu objetivo principal?" : "Objetivo Principal del Paciente"}
                  </label>
                  <input
                    type="text"
                    value={anamnesis.objetivo_principal || perfil.objetivo || ""}
                    onChange={(e) => {
                      updAnam("objetivo_principal", e.target.value);
                      updPerfil("objetivo", e.target.value);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm font-semibold text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    placeholder="Ej. Pérdida de grasa corporal manteniendo masa muscular"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                    {isPatientMode ? "¿Algún comentario o duda adicional para tu especialista? (Opcional)" : "Notas y Observaciones de la Consulta (Opcional)"}
                  </label>
                  <textarea
                    rows={2}
                    value={anamnesis.notas_consulta || ""}
                    onChange={(e) => updAnam("notas_consulta", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    placeholder={isPatientMode ? "Ej. Suelo viajar fines de semana, me cuesta trabajo cenar temprano..." : "Comentarios adicionales, motivación del paciente, acuerdos especiales..."}
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
          ) : isPatientMode ? (
            <button
              type="button"
              onClick={onBackToList}
              className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-xs sm:text-sm font-bold text-[#6B7A8D] hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <X className="w-4 h-4" />
              <span>Cerrar</span>
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
            Guardar borrador
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
              {isPatientMode ? <Send className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>
                {saving
                  ? "Enviando..."
                  : isPatientMode
                  ? "Enviar a mi Especialista"
                  : "Finalizar y Comenzar Plan"}
              </span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
}

export default NuevoExpedienteForms;
