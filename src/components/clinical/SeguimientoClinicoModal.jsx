import React, { useState, useEffect } from "react";
import {
  Activity,
  Calendar,
  Plus,
  Send,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Check,
  X
} from "lucide-react";
import {
  EMPTY_CHECKIN,
  saveClinicalRecord
} from "../../lib/clinicalRecord";
import { dbPost } from "../../lib/supabase";
import { ConfirmModal } from "../ui/ConfirmModal";
import { useBackButton } from "../../lib/backButtonHandler";

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
    year: "numeric"
  });
};

export default function SeguimientoClinicoModal({
  isOpen,
  onClose,
  cliente,
  clinicalRec,
  onUpdated,
  setMsg
}) {
  const clienteId = cliente?.id;
  const [showNewForm, setShowNewForm] = useState(false);
  const [checkinForm, setCheckinForm] = useState({ ...EMPTY_CHECKIN });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useBackButton(isOpen && !confirmDeleteId, onClose, 30);

  const checkins = Array.isArray(clinicalRec?.checkins) ? clinicalRec.checkins : [];
  const isRequested = clinicalRec?.solicitud_activa === "checkin_seguimiento";

  // Toggle solicitar al paciente
  const toggleSolicitarPaciente = async () => {
    setSaving(true);
    try {
      const next = {
        ...clinicalRec,
        solicitud_activa: isRequested ? null : "checkin_seguimiento",
        solicitud_fecha: isRequested ? null : new Date().toISOString(),
      };
      const saved = await saveClinicalRecord(clienteId, next);
      if (onUpdated) onUpdated(saved);

      if (!isRequested && cliente?.auth_id) {
        await dbPost("notificaciones", {
          profile_id: cliente.auth_id,
          titulo: "Check-in de Seguimiento Solicitado",
          mensaje: "Tu especialista te ha solicitado registrar tu seguimiento y sensaciones de la semana.",
          tipo: "alerta",
          link_url: "perfil",
          entidad_id: clienteId,
        }).catch(() => {});
      }

      if (setMsg) {
        setMsg(
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            {isRequested ? "Solicitud cancelada" : `Seguimiento solicitado a ${cliente.nombre}`}
          </div>
        );
      }
    } catch (e) {
      if (setMsg) {
        setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {e.message}</div>);
      }
    } finally {
      setSaving(false);
    }
  };

  // Guardar nuevo check-in
  const handleSaveCheckin = async (e) => {
    if (e) e.preventDefault();
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
        autor: "nutriologo",
      };

      const next = {
        ...clinicalRec,
        checkins: [newEntry, ...checkins].slice(0, 50),
        solicitud_activa: null,
      };

      const saved = await saveClinicalRecord(clienteId, next);
      if (onUpdated) onUpdated(saved);
      setCheckinForm({ ...EMPTY_CHECKIN });
      setShowNewForm(false);

      if (setMsg) {
        setMsg(
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Check-in registrado con éxito
          </div>
        );
      }
    } catch (e) {
      if (setMsg) {
        setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> {e.message}</div>);
      }
    } finally {
      setSaving(false);
    }
  };

  // Eliminar check-in
  const handleDeleteCheckin = async () => {
    if (!confirmDeleteId) return;
    setSaving(true);
    try {
      const next = {
        ...clinicalRec,
        checkins: checkins.filter((c) => c.id !== confirmDeleteId),
      };
      const saved = await saveClinicalRecord(clienteId, next);
      if (onUpdated) onUpdated(saved);
      setConfirmDeleteId(null);
      if (setMsg) {
        setMsg(
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Registro eliminado
          </div>
        );
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0B1929]/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl border border-[#E2E8F0] flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-[#0B1929] truncate">
                  Seguimiento y Check-ins
                </h3>
                {checkins.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[var(--brand-primary)]">
                    {checkins.length} {checkins.length === 1 ? "registro" : "registros"}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6B7A8D] truncate mt-0.5">
                {cliente?.nombre ? `Paciente: ${cliente.nombre}` : "Monitoreo semanal de adherencia y sensaciones."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#6B7A8D] hover:text-[#0B1929] hover:bg-gray-100 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Acciones principales superiores */}
        <div className="px-4 sm:px-5 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSolicitarPaciente}
              disabled={saving}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                isRequested
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  : "bg-white text-[#0B1929] border-[#E2E8F0] hover:bg-gray-50 shadow-2xs"
              }`}
              title="Solicitar al paciente que responda el check-in desde su app"
            >
              {isRequested ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Solicitado al paciente</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                  <span>Solicitar al paciente</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowNewForm((prev) => !prev)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--brand-primary)] text-white hover:opacity-95 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showNewForm ? "Cerrar Formulario" : "Nuevo Check-in"}</span>
          </button>
        </div>

        {/* Contenido / Body scrollable */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Formulario para registrar nuevo Check-in */}
          {showNewForm && (
            <div className="bg-[#FAFBFD] rounded-2xl border border-blue-100 p-4 sm:p-5 shadow-xs space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider">
                  Nuevo Registro de Consulta
                </span>
                <span className="text-xs text-[#6B7A8D] font-medium">{fmtDate(new Date().toISOString())}</span>
              </div>

              {/* Escalas 1 a 5 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SCALE_ITEMS.map((sc) => (
                  <div key={sc.key} className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#0B1929]">{sc.label}</span>
                      <span className="text-xs font-extrabold text-[var(--brand-primary)]">
                        {checkinForm[sc.key]}/5
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setCheckinForm((p) => ({ ...p, [sc.key]: n }))}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                            Number(checkinForm[sc.key]) === n
                              ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]"
                              : "bg-white text-[#6B7A8D] border-[#E2E8F0] hover:bg-gray-50"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Textos de observaciones y ajustes */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#0B1929] mb-1">
                    Sensaciones y adherencia de la semana
                  </label>
                  <input
                    type="text"
                    value={checkinForm.observaciones}
                    onChange={(e) => setCheckinForm((p) => ({ ...p, observaciones: e.target.value }))}
                    placeholder="Ej. Buena energía, sin hambre, completó entrenamientos..."
                    className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0B1929] mb-1">
                    Ajustes solicitados o notas para el menú
                  </label>
                  <input
                    type="text"
                    value={checkinForm.ajustes_solicitados}
                    onChange={(e) => setCheckinForm((p) => ({ ...p, ajustes_solicitados: e.target.value }))}
                    placeholder="Ej. Variar fuentes de proteína, opciones más prácticas..."
                    className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] shadow-2xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#6B7A8D] hover:bg-gray-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveCheckin}
                  className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {saving ? "Guardando..." : "Guardar Check-in"}
                </button>
              </div>
            </div>
          )}

          {/* Bitácora de Check-ins Anteriores */}
          {checkins.length === 0 ? (
            <div className="text-center py-10 px-4 text-xs text-[#6B7A8D] border-2 border-dashed border-[#E2E8F0] rounded-2xl bg-gray-50/50 flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <p className="font-semibold text-[#0B1929] text-sm">Sin registros de seguimiento aún</p>
              <p className="text-[#6B7A8D] max-w-sm">
                Pulsa en <span className="font-semibold text-[var(--brand-primary)]">"Nuevo Check-in"</span> para registrar sensaciones de la consulta o pulsa <span className="font-semibold text-[var(--brand-primary)]">"Solicitar al paciente"</span> para que responda desde su app.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">
                Bitácora de Evaluaciones y Respuestas
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {checkins.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 text-xs flex items-start justify-between gap-3 shadow-2xs hover:border-[#CBD5E1] transition-colors"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#0B1929] flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                          {fmtDate(c.fecha)}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {c.autor === "paciente" ? "Respondido por paciente" : "Registrado en consulta"}
                        </span>
                      </div>

                      {/* Escalas en badges */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] pt-0.5">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[var(--brand-primary)] font-semibold">
                          Energía: {c.energia}/5
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold">
                          Saciedad: {c.saciedad}/5
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold">
                          Digestión: {c.digestion}/5
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold">
                          Sueño: {c.descanso}/5
                        </span>
                      </div>

                      {c.observaciones && (
                        <p className="text-[#0B1929] font-medium pt-0.5">
                          {c.observaciones}
                        </p>
                      )}

                      {c.ajustes_solicitados && (
                        <p className="text-[var(--brand-primary)] font-semibold">
                          Ajustes sugeridos: {c.ajustes_solicitados}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(c.id)}
                      className="text-[#6B7A8D] hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                      title="Eliminar este check-in"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:px-5 sm:py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-bold text-[#0B1929] hover:bg-gray-100 transition-colors cursor-pointer shadow-2xs"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Modal nativo de confirmación */}
      <ConfirmModal
        isOpen={Boolean(confirmDeleteId)}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDeleteCheckin}
        title="¿Eliminar este registro de seguimiento?"
        description="Esta acción eliminará permanentemente la entrada seleccionada de la bitácora."
        confirmText="Eliminar"
        cancelText="Cancelar"
        danger={true}
        icon="trash"
      />
    </div>
  );
}
