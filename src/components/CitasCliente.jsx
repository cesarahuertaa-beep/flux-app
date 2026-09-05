import { useState, useEffect, useCallback } from "react";
import { dbGet, dbPost, dbPatch } from "../lib/supabase";
import {
  CalendarDays, Clock, Video, MapPin, Check, X,
  AlertCircle, Plus, CheckCircle2, ChevronRight, Star
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────
const DIAS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const fmtFechaHora = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const dia = d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  const hora = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return { dia, hora };
};

const fmtFechaCorta = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })
    + " • " + d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
};

const ESTADOS = {
  pendiente:  { text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", icon: <Clock size={14}/>, label: "Pendiente" },
  confirmada: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: <Check size={14}/>, label: "Confirmada" },
  completada: { text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", icon: <CheckCircle2 size={14}/>, label: "Completada" },
  rechazada:  { text: "text-red-600", bg: "bg-red-50", border: "border-red-200", icon: <X size={14}/>, label: "Rechazada" },
  cancelada:  { text: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200", icon: <AlertCircle size={14}/>, label: "Cancelada" },
};

// ── Genera horarios disponibles dado un rango de disponibilidad y citas ya tomadas ──
const generarSlots = (disponibilidad, citasOcupadas, selectedDate) => {
  if (!selectedDate || !disponibilidad.length) return [];
  const date = new Date(selectedDate + "T12:00:00");
  const diaSemana = date.getDay();
  const reglas = disponibilidad.filter(d => d.dia_semana === diaSemana);
  if (!reglas.length) return [];

  const slots = [];
  for (const regla of reglas) {
    const [hIni, mIni] = regla.hora_inicio.split(":").map(Number);
    const [hFin, mFin] = regla.hora_fin.split(":").map(Number);
    let hora = hIni * 60 + mIni;
    const fin = hFin * 60 + mFin;
    while (hora + 60 <= fin) {
      const h = Math.floor(hora / 60);
      const m = hora % 60;
      const hStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      
      const [y, mo, dDay] = selectedDate.split("-").map(Number);
      const slotDate = new Date(y, mo - 1, dDay, h, m, 0);
      const isoSlot = slotDate.toISOString();

      const ocupado = citasOcupadas.some(c => {
        if (c.estado === "rechazada" || c.estado === "cancelada") return false;
        if (!c.fecha_hora) return false;
        return new Date(c.fecha_hora).getTime() === slotDate.getTime();
      });

      slots.push({ hora: hStr, iso: isoSlot, ocupado });
      hora += 60;
    }
  }
  return slots;
};

// ── Componente ───────────────────────────────────────────────────────────────
export function CitasCliente({ cliente }) {
  // Manejo de props corregido
  const clienteId = cliente?.id;
  const nutriologoId = cliente?.nutriologo_id;

  const [citas, setCitas] = useState([]);
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [ratedCitas, setRatedCitas] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Estados del Modal de Agendar
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorReq, setErrorReq] = useState("");
  const [exito, setExito] = useState(false);
  
  // Estados del Modal de Calificar
  const [ratingModal, setRatingModal] = useState({ open: false, citaId: null, puntuacion: 5, comentario: "" });
  
  // Formulario
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [modalidad, setModalidad] = useState("presencial");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, d, r] = await Promise.all([
        dbGet(`citas?cliente_id=eq.${clienteId}&order=fecha_hora.desc&select=id,fecha_hora,modalidad,estado,motivo_rechazo`),
        dbGet(`disponibilidad?nutriologo_id=eq.${nutriologoId}&order=dia_semana.asc`),
        dbGet(`citas_ratings?cliente_id=eq.${clienteId}&select=cita_id,puntuacion`)
      ]);
      
      const now = new Date();
      if (Array.isArray(c)) {
        for (const cita of c) {
          if (cita.estado === 'confirmada') {
            const citaTime = new Date(cita.fecha_hora);
            const diffHours = (now - citaTime) / (1000 * 60 * 60);
            if (diffHours >= 1) {
              cita.estado = 'completada';
              dbPatch(`citas?id=eq.${cita.id}`, { estado: 'completada' }).catch(console.error);
            }
          }
        }
      }
      
      setCitas(c);
      setDisponibilidad(d);
      
      const ratingMap = {};
      if (Array.isArray(r)) {
        r.forEach(rating => {
          ratingMap[rating.cita_id] = rating.puntuacion;
        });
      }
      setRatedCitas(ratingMap);
    } catch (e) {
      console.error("Error al cargar citas o ratings", e);
    }
    setLoading(false);
  }, [clienteId, nutriologoId]);

  useEffect(() => { if (clienteId && nutriologoId) loadData(); }, [loadData]);

  // Actualizar slots cuando cambia la fecha
  useEffect(() => {
    if (!selectedDate) { setSlots([]); setSelectedSlot(null); return; }
    const s = generarSlots(disponibilidad, citas, selectedDate);
    setSlots(s);
    setSelectedSlot(null);
  }, [selectedDate, disponibilidad, citas]);

  const submitRating = async () => {
    if (!ratingModal.citaId || !ratingModal.puntuacion) return;
    setSaving(true);
    try {
      await dbPost('citas_ratings', {
        cita_id: ratingModal.citaId,
        cliente_id: clienteId,
        nutriologo_id: nutriologoId,
        puntuacion: ratingModal.puntuacion,
        comentario: ratingModal.comentario
      });
      setRatedCitas(prev => ({ ...prev, [ratingModal.citaId]: ratingModal.puntuacion }));
      setRatingModal({ open: false, citaId: null, puntuacion: 5, comentario: "" });
    } catch (e) {
      console.error("Error al calificar cita", e);
    }
    setSaving(false);
  };

  const solicitarCita = async () => {
    if (!selectedSlot) return;
    setSaving(true);
    setErrorReq("");
    try {
      await dbPost("citas", {
        cliente_id: clienteId,
        nutriologo_id: nutriologoId,
        fecha_hora: selectedSlot.iso,
        modalidad,
        estado: "pendiente"
      });
      setExito(true);
      setShowModal(false);
      setSelectedDate(""); 
      setSelectedSlot(null);
      await loadData();
    } catch (e) {
      console.error(e);
      setErrorReq("Ocurrió un error al agendar la cita. Es posible que el horario ya se haya llenado o no tengas conexión.");
    }
    setSaving(false);
  };

  const diasDisponibles = [...new Set(disponibilidad.map(d => d.dia_semana))];

  // Calcular fecha mínima (mañana) usando la hora LOCAL, evitando el bug del UTC
  const today = new Date();
  today.setDate(today.getDate() + 1); // Mañana
  const minYear = today.getFullYear();
  const minMonth = String(today.getMonth() + 1).padStart(2, "0");
  const minDay = String(today.getDate()).padStart(2, "0");
  const minDate = `${minYear}-${minMonth}-${minDay}`;

  const citasProximas = citas.filter(c => new Date(c.fecha_hora) >= new Date() && c.estado !== "cancelada" && c.estado !== "rechazada");
  const citasPasadas  = citas.filter(c => new Date(c.fecha_hora) <  new Date() || c.estado === "cancelada" || c.estado === "rechazada");

  return (
    <div className="h-full flex flex-col">
      {/* ── Header ── */}
      <div className="px-6 md:px-8 pt-6 md:pt-8 pb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">
              Agenda
            </p>
            <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
              Mis Citas
            </h1>
            {cliente?.nombre && (
              <p className="text-sm text-[#6B7A8D] mt-1">
                Paciente: <span className="text-[var(--brand-primary)] font-medium">{cliente.nombre}</span>
              </p>
            )}
          </div>
          
          {disponibilidad.length > 0 && (
            <button
              onClick={() => { setShowModal(true); setExito(false); setErrorReq(""); }}
              className="flex items-center gap-2 bg-[var(--brand-primary)] text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
            >
              <CalendarDays size={18} />
              Solicitar cita
            </button>
          )}
        </div>
      </div>

      {/* Mensaje de Éxito Flotante */}
      {exito && (
        <div className="mx-6 md:mx-8 mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="text-emerald-500 flex-shrink-0 mt-0.5" size={24} />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-emerald-800">¡Solicitud enviada con éxito!</h4>
            <p className="text-xs text-emerald-600 mt-1">
              Tu nutriólogo revisará la solicitud y te confirmará en breve. Podrás ver el estatus en tus citas próximas.
            </p>
          </div>
          <button onClick={() => setExito(false)} className="text-emerald-400 hover:text-emerald-600 p-1">
            <X size={18} />
          </button>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="px-6 md:px-8 flex-1 overflow-y-auto pb-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#6B7A8D]">
            <div className="w-10 h-10 border-4 border-[#F0F4FA] border-t-[var(--brand-primary)] rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium">Cargando agenda...</p>
          </div>
        ) : citas.length === 0 && disponibilidad.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-[#E2E8F0] rounded-2xl shadow-sm px-6">
            <div className="w-16 h-16 bg-[#F0F4FA] rounded-full flex items-center justify-center mb-4">
              <CalendarDays size={32} className="text-[#6B7A8D]" />
            </div>
            <h3 className="text-lg font-bold text-[#0B1929] mb-2" style={{ fontFamily: "DM Sans" }}>
              Agenda no disponible
            </h3>
            <p className="text-sm text-[#6B7A8D] max-w-sm">
              Tu nutriólogo aún no ha configurado sus horarios de atención. Podrás solicitar citas cuando el sistema esté habilitado.
            </p>
          </div>
        ) : (
          <>
            {/* Próximas Citas */}
            {citasProximas.length > 0 && (
              <div className="mb-8">
                <p className="text-[10px] font-bold tracking-widest text-[#9BA5B0] uppercase mb-4">
                  Citas Próximas
                </p>
                <div className="space-y-4">
                  {citasProximas.map(cita => {
                    const estado = ESTADOS[cita.estado];
                    const { dia, hora } = fmtFechaHora(cita.fecha_hora);
                    return (
                      <div key={cita.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden flex relative">
                        {/* Status color bar */}
                        <div className={`w-1.5 flex-shrink-0 ${estado.bg} ${estado.border} border-l`} style={{ backgroundColor: "currentColor", color: `var(--brand-primary)` }} />
                        
                        <div className="p-5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${estado.bg} ${estado.border} ${estado.text}`}>
                              {estado.icon}
                              {estado.label}
                            </div>
                            
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#E2E8F0] bg-[#F7F9FC] text-[#6B7A8D] text-[11px] font-semibold">
                              {cita.modalidad === "virtual" ? <Video size={12}/> : <MapPin size={12}/>}
                              <span className="capitalize">{cita.modalidad}</span>
                            </div>
                          </div>

                          <h3 className="text-lg font-bold text-[#0B1929] capitalize tracking-tight mb-1">
                            {dia}
                          </h3>
                          <p className="text-sm font-semibold text-[var(--brand-primary)] flex items-center gap-2">
                            <Clock size={16} />
                            {hora}
                          </p>

                          {cita.motivo_rechazo && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700 flex gap-2 items-start">
                              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                              <p><strong className="font-semibold">Motivo de rechazo:</strong> {cita.motivo_rechazo}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Historial */}
            {citasPasadas.length > 0 && (
              <div>
                <p className="text-[10px] font-bold tracking-widest text-[#9BA5B0] uppercase mb-4">
                  Historial de Citas
                </p>
                <div className="space-y-3">
                    {citasPasadas.map(cita => {
                      const estado = ESTADOS[cita.estado] || ESTADOS.cancelada;
                      const yaCalificado = ratedCitas[cita.id];
                      return (
                        <div key={cita.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-[#0B1929] capitalize">
                              {fmtFechaCorta(cita.fecha_hora)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${estado.bg} ${estado.border} ${estado.text}`}>
                              {estado.label}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border border-[#E2E8F0] bg-[#F7F9FC] text-[#6B7A8D]">
                              {cita.modalidad === "virtual" ? "Virtual" : "Presencial"}
                            </span>
                            {cita.estado === "completada" && (
                              yaCalificado ? (
                                <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md ml-2 border border-amber-200"><Star size={14} className="fill-amber-500"/> {yaCalificado}.0</span>
                              ) : (
                                <button onClick={() => setRatingModal({ open: true, citaId: cita.id, puntuacion: 5, comentario: "" })} className="text-xs font-semibold text-white bg-[var(--brand-primary)] px-3 py-1.5 rounded-lg hover:opacity-90 transition-all flex items-center gap-1 shadow-sm ml-2">
                                  <Star size={12} className="fill-white"/> Calificar
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {citas.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-[#E2E8F0] rounded-2xl shadow-sm px-6">
                <div className="w-16 h-16 bg-[#F0F4FA] rounded-full flex items-center justify-center mb-4">
                  <Plus size={32} className="text-[#CBD5E1]" />
                </div>
                <h3 className="text-lg font-bold text-[#0B1929] mb-2" style={{ fontFamily: "DM Sans" }}>
                  Sin citas agendadas
                </h3>
                <p className="text-sm text-[#6B7A8D] max-w-sm">
                  Aún no tienes un historial de citas. Utiliza el botón superior para programar tu primer consulta con tu nutriólogo.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal Agendar Cita ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#0B1929]/40 backdrop-blur-sm animate-in fade-in">
          <div className="w-full sm:w-[480px] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90dvh] animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-8">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-white rounded-t-2xl sm:rounded-2xl">
              <h3 className="text-lg font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
                Agendar nueva cita
              </h3>
              <button 
                onClick={() => { setShowModal(false); setSelectedDate(""); setSelectedSlot(null); }}
                className="text-[#9BA5B0] hover:text-[#0B1929] hover:bg-[#F0F4FA] p-1.5 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Días Disponibles Info */}
              <div className="bg-[#F0F4FA] rounded-xl p-3.5 border border-[#E2E8F0] flex gap-3 items-start">
                <CalendarDays size={18} className="text-[var(--brand-primary)] mt-0.5" />
                <p className="text-xs text-[#6B7A8D] leading-relaxed">
                  Días que atiende el nutriólogo: <br />
                  <strong className="text-[#0B1929]">{diasDisponibles.map(d => DIAS_FULL[d]).join(", ")}</strong>
                </p>
              </div>

              {/* Selector de Fecha */}
              <div>
                <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-widest mb-2">
                  1. Selecciona la Fecha
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  min={minDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm font-semibold text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-shadow"
                />
              </div>

              {/* Selector de Horario */}
              {selectedDate && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-widest mb-2">
                    2. Selecciona el Horario
                  </label>
                  {slots.length === 0 ? (
                    <div className="text-sm text-[#6B7A8D] bg-white border border-[#E2E8F0] border-dashed rounded-xl p-4 text-center">
                      No hay horarios disponibles para este día. Por favor selecciona otro.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {slots.map(slot => (
                        <button
                          key={slot.iso}
                          disabled={slot.ocupado}
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2 rounded-lg text-sm font-mono font-semibold transition-all border ${
                            slot.ocupado 
                              ? "bg-[#F7F9FC] border-[#E2E8F0] text-[#CBD5E1] opacity-50 cursor-not-allowed" 
                              : selectedSlot?.iso === slot.iso
                                ? "bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white shadow-md"
                                : "bg-white border-[#E2E8F0] text-[#0B1929] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                          }`}
                        >
                          {slot.hora} {slot.ocupado && "🔒"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Selector de Modalidad */}
              <div>
                <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-widest mb-2">
                  3. Modalidad
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setModalidad("presencial")}
                    className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${
                      modalidad === "presencial"
                        ? "border-[var(--brand-primary)] bg-[#E8F1FB] text-[var(--brand-primary)]"
                        : "border-[#E2E8F0] bg-white text-[#6B7A8D] hover:bg-[#F0F4FA]"
                    }`}
                  >
                    <MapPin size={20} />
                    <span className="text-xs font-semibold">Presencial</span>
                  </button>
                  <button
                    onClick={() => setModalidad("virtual")}
                    className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${
                      modalidad === "virtual"
                        ? "border-[var(--brand-primary)] bg-[#E8F1FB] text-[var(--brand-primary)]"
                        : "border-[#E2E8F0] bg-white text-[#6B7A8D] hover:bg-[#F0F4FA]"
                    }`}
                  >
                    <Video size={20} />
                    <span className="text-xs font-semibold">Virtual</span>
                  </button>
                </div>
              </div>

              {/* Error si falló al guardar */}
              {errorReq && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
                  <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700 leading-relaxed">{errorReq}</p>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E2E8F0] bg-white rounded-b-2xl sm:rounded-b-2xl flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => { setShowModal(false); setSelectedDate(""); setSelectedSlot(null); }}
                className="w-full sm:flex-1 py-3 rounded-xl font-semibold text-sm border border-[#E2E8F0] text-[#6B7A8D] hover:bg-[#F0F4FA] transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={solicitarCita}
                disabled={!selectedSlot || saving}
                className="w-full sm:flex-1 py-3 rounded-xl font-semibold text-sm bg-[var(--brand-primary)] text-white shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {saving ? "Procesando..." : "Confirmar Cita"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Calificación */}
      {ratingModal.open && (
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <h3 className="text-xl font-bold text-[#0B1929] mb-2">Califica a tu Nutriólogo</h3>
              <p className="text-sm text-[#6B7A8D] mb-6">Tu opinión nos ayuda a mantener la mejor calidad en el servicio.</p>
              
              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => setRatingModal(prev => ({ ...prev, puntuacion: star }))} className="transition-transform hover:scale-110">
                    <Star size={32} className={`${star <= ratingModal.puntuacion ? 'fill-amber-400 text-amber-400' : 'text-[#E2E8F0]'}`} />
                  </button>
                ))}
              </div>

              <textarea
                value={ratingModal.comentario}
                onChange={(e) => setRatingModal(prev => ({ ...prev, comentario: e.target.value }))}
                placeholder="¿Qué te pareció la consulta? (Opcional)"
                className="w-full h-24 bg-[#F7F9FC] border border-[#E2E5EA] focus:border-[#1A6FD4] rounded-xl p-3 text-sm outline-none resize-none mb-6"
              />

              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => setRatingModal({ open: false, citaId: null, puntuacion: 5, comentario: "" })}
                  className="w-full sm:flex-1 py-3 rounded-xl font-semibold text-sm border border-[#E2E8F0] text-[#6B7A8D] hover:bg-[#F0F4FA] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={submitRating}
                  disabled={saving}
                  className="w-full sm:flex-1 py-3 rounded-xl font-semibold text-sm bg-amber-500 text-white shadow-sm hover:bg-amber-600 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {saving ? "Enviando..." : "Enviar Calificación"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
