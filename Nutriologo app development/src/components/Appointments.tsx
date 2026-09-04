import { useState } from "react";
import { Calendar, Clock, CheckCircle, XCircle, Bell, Smartphone, ChevronRight, AlertCircle, Send } from "lucide-react";

type ApptStatus = "confirmed" | "pending" | "modified" | "completed";
type Appointment = {
  id: number;
  date: string;
  time: string;
  type: string;
  nutritionist: string;
  location: string;
  status: ApptStatus;
  notes?: string;
};

const initialAppts: Appointment[] = [
  { id: 1, date: "2026-09-10", time: "10:00", type: "Consulta de seguimiento", nutritionist: "Dra. Andrea Torres", location: "Consultorio 3B", status: "pending", notes: "Traer resultados de análisis de sangre" },
  { id: 2, date: "2026-09-24", time: "10:00", type: "Evaluación mensual", nutritionist: "Dra. Andrea Torres", location: "Consultorio 3B", status: "pending" },
  { id: 3, date: "2026-08-13", time: "10:30", type: "Consulta inicial", nutritionist: "Dra. Andrea Torres", location: "Consultorio 3B", status: "completed" },
  { id: 4, date: "2026-07-30", time: "10:00", type: "Ajuste de plan", nutritionist: "Dra. Andrea Torres", location: "Consultorio 3B", status: "completed" },
];

const STATUS_MAP = {
  confirmed: { label: "Confirmada", color: "bg-green-50 text-green-600 border-green-100", icon: <CheckCircle size={12} /> },
  pending: { label: "Pendiente", color: "bg-amber-50 text-amber-600 border-amber-100", icon: <Clock size={12} /> },
  modified: { label: "Modificada", color: "bg-purple-50 text-purple-600 border-purple-100", icon: <AlertCircle size={12} /> },
  completed: { label: "Completada", color: "bg-[#F0F4FA] text-[#6B7A8D] border-[#E2E8F0]", icon: <CheckCircle size={12} /> },
};

const fmtDate = (d: string) => {
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

const isUpcoming = (d: string) => new Date(d) >= new Date("2026-09-03");

export default function Appointments() {
  const [appts, setAppts] = useState<Appointment[]>(initialAppts);
  const [modifyId, setModifyId] = useState<number | null>(null);
  const [modifyDate, setModifyDate] = useState("");
  const [modifyTime, setModifyTime] = useState("");
  const [modifyReason, setModifyReason] = useState("");
  const [calendarLinked, setCalendarLinked] = useState(false);
  const [notifsEnabled, setNotifsEnabled] = useState(false);
  const [sent, setSent] = useState<number | null>(null);

  const confirm = (id: number) => {
    setAppts(appts.map((a) => a.id === id ? { ...a, status: "confirmed" } : a));
    setSent(id);
    setTimeout(() => setSent(null), 2500);
  };

  const requestModify = (appt: Appointment) => {
    setModifyId(appt.id);
    setModifyDate(appt.date);
    setModifyTime(appt.time);
    setModifyReason("");
  };

  const submitModify = () => {
    if (!modifyDate || !modifyTime) return;
    setAppts(appts.map((a) =>
      a.id === modifyId ? { ...a, date: modifyDate, time: modifyTime, status: "modified", notes: modifyReason || a.notes } : a
    ));
    setModifyId(null);
  };

  const upcoming = appts.filter((a) => isUpcoming(a.date) && a.status !== "completed");
  const past = appts.filter((a) => !isUpcoming(a.date) || a.status === "completed");

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 pt-8 pb-6">
        <p className="text-xs font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">Agenda Médica</p>
        <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily: 'DM Sans' }}>Citas</h1>
        <p className="text-sm text-[#6B7A8D] mt-1">Nutrióloga: <span className="text-[#1A6FD4] font-medium">Dra. Andrea Torres</span></p>
      </div>

      <div className="px-8 flex-1 overflow-y-auto pb-8 space-y-5">
        {/* Integrations */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 space-y-3">
          <p className="text-xs font-mono tracking-widest text-[#6B7A8D] uppercase">Integración</p>
          <div className="flex gap-3">
            <button
              onClick={() => setCalendarLinked(!calendarLinked)}
              className={`flex-1 flex items-center gap-3 p-3 rounded-lg border transition-all ${calendarLinked ? "border-[#1A6FD4] bg-[#E8F1FB]" : "border-[#E2E8F0] bg-[#F7F9FC] hover:border-[#1A6FD4]"}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${calendarLinked ? "bg-[#1A6FD4]" : "bg-white border border-[#E2E8F0]"}`}>
                <Calendar size={15} className={calendarLinked ? "text-white" : "text-[#1A6FD4]"} />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-[#0B1929]">Calendario</p>
                <p className="text-[10px] text-[#6B7A8D]">{calendarLinked ? "Vinculado" : "Vincular"}</p>
              </div>
              {calendarLinked && <CheckCircle size={14} className="text-[#1A6FD4] ml-auto" />}
            </button>
            <button
              onClick={() => setNotifsEnabled(!notifsEnabled)}
              className={`flex-1 flex items-center gap-3 p-3 rounded-lg border transition-all ${notifsEnabled ? "border-[#1A6FD4] bg-[#E8F1FB]" : "border-[#E2E8F0] bg-[#F7F9FC] hover:border-[#1A6FD4]"}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${notifsEnabled ? "bg-[#1A6FD4]" : "bg-white border border-[#E2E8F0]"}`}>
                <Bell size={15} className={notifsEnabled ? "text-white" : "text-[#1A6FD4]"} />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-[#0B1929]">Recordatorios</p>
                <p className="text-[10px] text-[#6B7A8D]">{notifsEnabled ? "Activados" : "Activar"}</p>
              </div>
              {notifsEnabled && <CheckCircle size={14} className="text-[#1A6FD4] ml-auto" />}
            </button>
            <button className="flex-1 flex items-center gap-3 p-3 rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] hover:border-[#1A6FD4] transition-all">
              <div className="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center">
                <Smartphone size={15} className="text-[#1A6FD4]" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-[#0B1929]">App móvil</p>
                <p className="text-[10px] text-[#6B7A8D]">Sincronizar</p>
              </div>
            </button>
          </div>
        </div>

        {/* Upcoming */}
        <div>
          <p className="text-xs font-mono tracking-widest text-[#6B7A8D] uppercase mb-3">Próximas citas</p>
          <div className="space-y-3">
            {upcoming.map((appt) => {
              const s = STATUS_MAP[appt.status];
              return (
                <div key={appt.id} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-[#0B1929]">{appt.type}</p>
                        <p className="text-xs text-[#6B7A8D] mt-0.5">{appt.nutritionist}</p>
                      </div>
                      <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${s.color}`}>
                        {s.icon} {s.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-5 text-xs text-[#6B7A8D]">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-[#1A6FD4]" />
                        <span className="capitalize">{fmtDate(appt.date)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-[#1A6FD4]" />
                        <span>{appt.time} hrs</span>
                      </div>
                    </div>
                    {appt.notes && (
                      <div className="mt-3 bg-[#F7F9FC] rounded-lg px-3 py-2 text-xs text-[#6B7A8D] border border-[#E2E8F0]">
                        📋 {appt.notes}
                      </div>
                    )}
                    {sent === appt.id && (
                      <div className="mt-3 flex items-center gap-2 text-green-600 text-xs bg-green-50 rounded-lg px-3 py-2 border border-green-100">
                        <Send size={12} /> Notificación enviada a la nutrióloga
                      </div>
                    )}
                    {appt.status !== "completed" && (
                      <div className="flex gap-2 mt-4">
                        {appt.status !== "confirmed" && (
                          <button
                            onClick={() => confirm(appt.id)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-[#1A6FD4] text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors"
                          >
                            <CheckCircle size={13} /> Confirmar
                          </button>
                        )}
                        <button
                          onClick={() => requestModify(appt)}
                          className="flex items-center gap-1.5 px-4 py-2 border border-[#E2E8F0] text-[#6B7A8D] rounded-lg text-xs font-medium hover:border-[#1A6FD4] hover:text-[#1A6FD4] transition-colors"
                        >
                          <XCircle size={13} /> Modificar
                        </button>
                        <button
                          onClick={() => { }}
                          className="flex items-center gap-1.5 px-4 py-2 border border-[#E2E8F0] text-[#6B7A8D] rounded-lg text-xs font-medium hover:border-[#1A6FD4] hover:text-[#1A6FD4] transition-colors ml-auto"
                        >
                          <Calendar size={13} /> Agregar a Calendar <ChevronRight size={11} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Modify panel */}
                  {modifyId === appt.id && (
                    <div className="border-t border-[#F0F4FA] bg-[#F7F9FC] p-5 space-y-3">
                      <p className="text-xs font-semibold text-[#0B1929]">Solicitar cambio de fecha</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-[#6B7A8D] mb-1 block">Nueva fecha</label>
                          <input type="date" value={modifyDate} onChange={(e) => setModifyDate(e.target.value)} className="w-full h-9 rounded-lg border border-[#E2E8F0] px-3 text-sm focus:outline-none focus:border-[#1A6FD4] bg-white" />
                        </div>
                        <div>
                          <label className="text-xs text-[#6B7A8D] mb-1 block">Nuevo horario</label>
                          <input type="time" value={modifyTime} onChange={(e) => setModifyTime(e.target.value)} className="w-full h-9 rounded-lg border border-[#E2E8F0] px-3 text-sm focus:outline-none focus:border-[#1A6FD4] bg-white" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-[#6B7A8D] mb-1 block">Motivo (opcional)</label>
                        <textarea value={modifyReason} onChange={(e) => setModifyReason(e.target.value)} placeholder="Ej: Tengo compromiso de trabajo..." className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#1A6FD4] bg-white" rows={2} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={submitModify} className="flex items-center gap-1.5 px-4 py-2 bg-[#1A6FD4] text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors">
                          <Send size={12} /> Enviar solicitud
                        </button>
                        <button onClick={() => setModifyId(null)} className="px-4 py-2 border border-[#E2E8F0] text-[#6B7A8D] rounded-lg text-xs font-medium hover:border-[#1A6FD4] transition-colors">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Past */}
        <div>
          <p className="text-xs font-mono tracking-widest text-[#6B7A8D] uppercase mb-3">Historial</p>
          <div className="space-y-2">
            {past.map((appt) => (
              <div key={appt.id} className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex items-center gap-4 opacity-70">
                <div className="w-8 h-8 rounded-lg bg-[#F0F4FA] flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={15} className="text-[#6B7A8D]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#0B1929] font-medium truncate">{appt.type}</p>
                  <p className="text-xs text-[#6B7A8D] capitalize">{fmtDate(appt.date)} · {appt.time} hrs</p>
                </div>
                <span className="text-[10px] bg-[#F0F4FA] text-[#6B7A8D] px-2 py-1 rounded border border-[#E2E8F0]">Completada</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
