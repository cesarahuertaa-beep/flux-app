import { useState, useEffect, useCallback } from "react";
import { dbGet, dbPost, dbPatch, dbDel, getProfileId } from "../../lib/supabase";
import {
  Clock,
  Clock3,
  CheckCircle2,
  XCircle,
  Trash2,
  Ban,
  ClipboardList,
  Monitor,
  Building,
  MessageCircle,
  Plus
} from "lucide-react";

// ── UI Components (Tailwind Light Theme) ──────────────────────────────────────
const Tag = ({ children, className = "" }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border ${className}`}>
    {children}
  </span>
);

const Btn = ({ children, onClick, disabled, small, outline, color, danger, grad }) => {
  let base = "inline-flex items-center gap-1.5 justify-center font-semibold rounded-xl transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";
  let size = small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  
  let variant = "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"; // default
  if (outline) {
    if (color === "#ef4444" || danger) {
      variant = "border border-red-200 text-red-600 hover:bg-red-50 bg-white";
    } else {
      variant = "border border-slate-200 text-slate-600 hover:bg-slate-50 bg-white";
    }
  } else if (danger) {
    variant = "bg-red-600 text-white hover:bg-red-700 shadow-sm";
  } else if (grad) {
    variant = "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm";
  }

  return (
    <button className={`${base} ${size} ${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
};

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[100] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center">
        <h3 className="font-bold text-lg text-[#0B1929]">{title}</h3>
        <button onClick={onClose} className="text-[#6B7A8D] hover:text-[#0B1929] transition-colors">
          <XCircle className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6 flex flex-col gap-4">
        {children}
      </div>
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-semibold text-[#0B1929]">{label}</label>
    {children}
  </div>
);

// ── Helpers ──────────────────────────────────────────────────────────────────
const DIAS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const HORAS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

const fmtFechaHora = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })
    + " • " + d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
};

const ESTADO_COLOR = {
  pendiente:  { bg: "bg-yellow-50",  border: "border-yellow-200",  text: "text-yellow-700", bar: "bg-yellow-400", label: "Pendiente", Icon: Clock },
  confirmada: { bg: "bg-green-50",   border: "border-green-200",   text: "text-green-700", bar: "bg-green-400", label: "Confirmada", Icon: CheckCircle2 },
  rechazada:  { bg: "bg-red-50",     border: "border-red-200",     text: "text-red-700", bar: "bg-red-400", label: "Rechazada", Icon: XCircle },
  cancelada:  { bg: "bg-slate-50",   border: "border-slate-200",   text: "text-slate-700", bar: "bg-slate-400", label: "Cancelada", Icon: Ban },
};

// ── Componente principal ─────────────────────────────────────────────────────
export function AgendaAdmin({ setMsg, profileId }) {
  const [citas, setCitas]                   = useState([]);
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [clientes, setClientes]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [subTab, setSubTab]                 = useState("citas");   // "citas" | "horarios"
  const [filtro, setFiltro]                 = useState("pendiente"); // "todos" | "pendiente" | "confirmada" | "rechazada"
  const [modalRechazo, setModalRechazo]     = useState(null);      // cita a rechazar
  const [motivoRechazo, setMotivoRechazo]   = useState("");
  const [saving, setSaving]                 = useState(false);
  const [showHorario, setShowHorario]       = useState(false);
  const [horarioForm, setHorarioForm]       = useState({ dia_semana: 1, hora_inicio: "09:00", hora_fin: "17:00" });

  const myId = profileId || getProfileId();

  // ── Carga de datos ──
  const loadCitas = useCallback(async () => {
    try {
      const rows = await dbGet(
        `citas?nutriologo_id=eq.${myId}&order=fecha_hora.asc&select=id,cliente_id,fecha_hora,modalidad,estado,motivo_rechazo,created_at`
      );
      setCitas(rows);
    } catch { }
  }, [myId]);

  const loadDisponibilidad = useCallback(async () => {
    try {
      const rows = await dbGet(`disponibilidad?nutriologo_id=eq.${myId}&order=dia_semana.asc,hora_inicio.asc`);
      setDisponibilidad(rows);
    } catch { }
  }, [myId]);

  const loadClientes = useCallback(async () => {
    try {
      const rows = await dbGet(`clientes?nutriologo_id=eq.${myId}&select=id,nombre,email,telefono&order=nombre.asc`);
      setClientes(rows);
    } catch { }
  }, [myId]);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadCitas(), loadDisponibilidad(), loadClientes()]);
    setLoading(false);
  }, [loadCitas, loadDisponibilidad, loadClientes]);

  useEffect(() => { load(); }, [load]);

  // ── Acciones ──
  const confirmar = async (cita) => {
    setSaving(true);
    try {
      await dbPatch(`citas?id=eq.${cita.id}`, { estado: "confirmada" });
      setMsg("Cita confirmada");
      loadCitas();
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const rechazar = async () => {
    if (!motivoRechazo.trim()) { setMsg("Escribe el motivo del rechazo"); return; }
    setSaving(true);
    try {
      await dbPatch(`citas?id=eq.${modalRechazo.id}`, { estado: "rechazada", motivo_rechazo: motivoRechazo });
      setMsg("Cita rechazada");
      setModalRechazo(null); setMotivoRechazo("");
      loadCitas();
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const cancelar = async (cita) => {
    setSaving(true);
    try {
      await dbPatch(`citas?id=eq.${cita.id}`, { estado: "cancelada" });
      setMsg("Cita cancelada");
      loadCitas();
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const agregarHorario = async () => {
    try {
      await dbPost("disponibilidad", { ...horarioForm, nutriologo_id: myId });
      setMsg("Horario guardado");
      setShowHorario(false);
      loadDisponibilidad();
    } catch (e) { setMsg(e.message); }
  };

  const eliminarHorario = async (id) => {
    if (!confirm("¿Eliminar este horario de disponibilidad?")) return;
    try {
      await dbDel(`disponibilidad?id=eq.${id}`);
      setMsg("Horario eliminado");
      loadDisponibilidad();
    } catch (e) { setMsg(e.message); }
  };

  // ── Helpers de render ──
  const clienteNombre = (id) => clientes.find(c => c.id === id)?.nombre || "Cliente";
  const clienteTelefono = (id) => clientes.find(c => c.id === id)?.telefono;

  const citasFiltradas = filtro === "todos"
    ? citas
    : citas.filter(c => c.estado === filtro);

  const pendientesCount = citas.filter(c => c.estado === "pendiente").length;

  // ── Render ──
  return (
    <div className="animate-in w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="font-bold text-2xl text-[#0B1929] tracking-tight">
            Agenda
          </h2>
          <div className="text-sm text-[#6B7A8D] mt-1">
            {pendientesCount > 0
              ? <span className="text-yellow-600 font-bold">{pendientesCount} cita{pendientesCount > 1 ? "s" : ""} pendiente{pendientesCount > 1 ? "s" : ""} de confirmar</span>
              : "Todo al día"}
          </div>
        </div>
        {/* Sub-tabs */}
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {[["citas", "Citas"], ["horarios", "Horarios"]].map(([k, lb]) => (
            <button key={k} onClick={() => setSubTab(k)} className={`
              px-4 py-1.5 rounded-lg text-sm font-semibold transition-all
              ${subTab === k ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-[#6B7A8D] hover:text-[#0B1929] border border-transparent"}
            `}>
              {lb}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-[#6B7A8D]">
          <div className="w-9 h-9 rounded-full border-4 border-[#E2E8F0] border-t-blue-600 animate-spin mx-auto mb-4" />
          Cargando agenda…
        </div>
      ) : subTab === "citas" ? (
        // ── Vista de Citas ──────────────────────────────────────────────────
        <div>
          {/* Filtros */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              ["pendiente", "Pendientes", Clock], 
              ["confirmada", "Confirmadas", CheckCircle2], 
              ["rechazada", "Rechazadas", XCircle], 
              ["todos", "Todas", ClipboardList]
            ].map(([k, lb, Icon]) => (
              <button key={k} onClick={() => setFiltro(k)} className={`
                inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all border
                ${filtro === k ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-slate-200 text-[#6B7A8D] hover:bg-slate-50"}
              `}>
                <Icon className="w-4 h-4" />
                {lb}
                {k === "pendiente" && pendientesCount > 0 && (
                  <span className="ml-1 bg-yellow-400 text-yellow-900 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold leading-none">
                    {pendientesCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {citasFiltradas.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-[15px] font-semibold text-[#6B7A8D]">Sin citas {filtro !== "todos" ? `en estado "${filtro}"` : ""}</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {citasFiltradas.map((cita, i) => {
                const estado = ESTADO_COLOR[cita.estado] || ESTADO_COLOR.cancelada;
                const StateIcon = estado.Icon;
                const tel = clienteTelefono(cita.cliente_id);
                return (
                  <div key={cita.id} className="animate-in bg-white rounded-xl border border-[#E2E8F0] p-4 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow" style={{ animationDelay: `${i * 0.04}s` }}>
                    {/* Barra lateral estado */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${estado.bar}`} />

                    <div className="pl-3 flex justify-between items-start flex-wrap gap-4">
                      {/* Info izquierda */}
                      <div>
                        <div className="font-bold text-[15px] text-[#0B1929] mb-1">
                          {clienteNombre(cita.cliente_id)}
                        </div>
                        <div className="text-sm text-[#6B7A8D] mb-2 flex items-center gap-1.5">
                          <Clock3 className="w-4 h-4" /> {fmtFechaHora(cita.fecha_hora)}
                        </div>
                        <div className="flex gap-2 flex-wrap items-center">
                          <Tag className={`${estado.bg} ${estado.border} ${estado.text}`}>
                            <StateIcon className="w-3.5 h-3.5" />
                            {estado.label}
                          </Tag>
                          <Tag className="bg-slate-100 border-slate-200 text-slate-700">
                            {cita.modalidad === "virtual" ? <><Monitor className="w-3.5 h-3.5" /> Virtual</> : <><Building className="w-3.5 h-3.5" /> Presencial</>}
                          </Tag>
                          {tel && (
                            <a
                              href={`https://wa.me/${tel.replace(/\D/g, "")}?text=Hola+${clienteNombre(cita.cliente_id)}%2C+sobre+tu+cita+el+${encodeURIComponent(fmtFechaHora(cita.fecha_hora))}`}
                              target="_blank" rel="noreferrer"
                              className="text-green-600 text-xs font-bold no-underline inline-flex items-center gap-1 hover:text-green-700 transition-colors bg-green-50 px-2 py-1 rounded-md border border-green-200"
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                            </a>
                          )}
                        </div>
                        {cita.motivo_rechazo && (
                          <div className="mt-3 text-xs text-red-700 bg-red-50 rounded-lg p-2.5 border border-red-100 font-medium">
                            Motivo: {cita.motivo_rechazo}
                          </div>
                        )}
                      </div>

                      {/* Acciones derecha */}
                      <div className="flex gap-2 flex-wrap">
                        {cita.estado === "pendiente" && (
                          <>
                            <Btn small grad onClick={() => confirmar(cita)} disabled={saving}>
                              <CheckCircle2 className="w-4 h-4" /> Confirmar
                            </Btn>
                            <Btn small outline danger onClick={() => { setModalRechazo(cita); setMotivoRechazo(""); }}>
                              <XCircle className="w-4 h-4" /> Rechazar
                            </Btn>
                          </>
                        )}
                        {cita.estado === "confirmada" && (
                          <Btn small outline danger onClick={() => cancelar(cita)} disabled={saving}>
                            <Ban className="w-4 h-4" /> Cancelar
                          </Btn>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        // ── Vista de Horarios ───────────────────────────────────────────────
        <div>
          <div className="flex flex-wrap justify-between items-center mb-5 gap-3">
            <div className="text-sm text-[#6B7A8D]">
              Define los días y horas en que los clientes pueden solicitar una cita.
            </div>
            <Btn small grad onClick={() => setShowHorario(true)}>
              <Plus className="w-4 h-4" /> Agregar horario
            </Btn>
          </div>

          {disponibilidad.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-[15px] font-semibold text-[#0B1929] mb-2">Sin horarios configurados</div>
              <div className="text-sm text-[#6B7A8D] mb-5">Agrega tu disponibilidad para que los clientes puedan solicitar citas</div>
              <Btn small grad onClick={() => setShowHorario(true)}>
                <Plus className="w-4 h-4" /> Agregar primer horario
              </Btn>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {disponibilidad.map(h => (
                <div key={h.id} className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-shadow">
                  <div>
                    <div className="font-bold text-sm text-[#0B1929] mb-1">
                      {DIAS_FULL[h.dia_semana]}
                    </div>
                    <div className="text-sm text-[#6B7A8D] flex items-center gap-1.5">
                      <Clock3 className="w-4 h-4" /> {h.hora_inicio?.slice(0, 5)} – {h.hora_fin?.slice(0, 5)}
                    </div>
                  </div>
                  <Btn small outline danger onClick={() => eliminarHorario(h.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Rechazar */}
      {modalRechazo && (
        <Modal title="Rechazar cita" onClose={() => setModalRechazo(null)}>
          <div className="text-sm text-[#6B7A8D] leading-relaxed">
            Rechazando la cita de <strong className="text-[#0B1929]">{clienteNombre(modalRechazo.cliente_id)}</strong> el{" "}
            <strong className="text-[#0B1929]">{fmtFechaHora(modalRechazo.fecha_hora)}</strong>.
            <br/>El cliente verá el motivo en su aplicación.
          </div>
          <Field label="Motivo del rechazo">
            <textarea
              className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-y"
              value={motivoRechazo}
              onChange={e => setMotivoRechazo(e.target.value)}
              placeholder="Ej. El horario ya fue ocupado..."
              rows={4}
            />
          </Field>
          <div className="flex gap-2 justify-end mt-2">
            <Btn outline onClick={() => setModalRechazo(null)}>Cancelar</Btn>
            <Btn danger onClick={rechazar} disabled={saving || !motivoRechazo.trim()}>
              {saving ? "Rechazando…" : "Confirmar rechazo"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Modal Agregar Horario */}
      {showHorario && (
        <Modal title="Agregar disponibilidad" onClose={() => setShowHorario(false)}>
          <Field label="Día de la semana">
            <select 
              className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={horarioForm.dia_semana} 
              onChange={e => setHorarioForm(p => ({ ...p, dia_semana: +e.target.value }))}
            >
              {DIAS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <Field label="Hora inicio">
              <select 
                className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={horarioForm.hora_inicio} 
                onChange={e => setHorarioForm(p => ({ ...p, hora_inicio: e.target.value }))}
              >
                {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </Field>
            <Field label="Hora fin">
              <select 
                className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={horarioForm.hora_fin} 
                onChange={e => setHorarioForm(p => ({ ...p, hora_fin: e.target.value }))}
              >
                {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex gap-2 justify-end mt-3">
            <Btn outline onClick={() => setShowHorario(false)}>Cancelar</Btn>
            <Btn grad onClick={agregarHorario}>Guardar horario</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
