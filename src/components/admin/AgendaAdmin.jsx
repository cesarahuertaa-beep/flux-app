import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { dbPeek, dbGet, dbPost, dbPatch, dbDel, getProfileId } from"../../lib/supabase";
import { useBrand } from"../BrandContext";
import { ListSkeleton } from "../ui/Skeleton";
import { useBackButton } from"../../lib/backButtonHandler";
import { ConfirmModal } from "../ui/ConfirmModal";
import { CustomSelect } from "../ui/CustomSelect";
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
  Plus,
  ChevronDown,
  MapPin,
  Edit2,
  X
} from"lucide-react";

// ── UI Components (Tailwind Light Theme) ──────────────────────────────────────
const Tag = ({ children, className ="" }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border ${className}`}>
    {children}
  </span>
);

const Btn = ({ children, onClick, disabled, small, outline, color, danger, grad }) => {
  let base ="inline-flex items-center gap-1.5 justify-center font-semibold rounded-xl transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";
  let size = small ?"px-3 py-1.5 text-xs" :"px-4 py-2 text-sm";
  
  let variant ="bg-[var(--brand-primary)] text-white hover:opacity-90 shadow-sm"; // default
  if (outline) {
    if (color ==="#ef4444" || danger) {
      variant ="border border-red-200 text-red-600 hover:bg-red-50 bg-white";
    } else {
      variant ="border border-slate-200 text-slate-600 hover:bg-slate-50 bg-white";
    }
  } else if (danger) {
    variant ="bg-red-600 text-white hover:bg-red-700 shadow-sm";
  } else if (grad) {
    variant ="bg-[var(--brand-primary)] text-white shadow-sm hover:opacity-90";
  }

  return (
    <button className={`${base} ${size} ${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
};

const Modal = ({ title, onClose, children }) => {
  useBackButton(true, onClose, 20);
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-visible">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-white rounded-t-2xl shrink-0">
          <h3 className="font-bold text-lg text-[#0B1929]">{title}</h3>
          <button onClick={onClose} className="text-[#6B7A8D] hover:text-[#0B1929] transition-colors p-1 rounded-lg hover:bg-[#F0F4FA]">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4 overflow-visible rounded-b-2xl bg-white">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-semibold text-[#0B1929]">{label}</label>
    {children}
  </div>
);

// ── Helpers ──────────────────────────────────────────────────────────────────
const DIAS_FULL = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const HORAS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = (i % 2) * 30;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

const DURACIONES_CONSULTA = [
  { value: 15, label: "15 min (Express / Pesaje)" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min (Seguimiento)" },
  { value: 40, label: "40 min" },
  { value: 45, label: "45 min (Estándar consulta)" },
  { value: 50, label: "50 min" },
  { value: 60, label: "60 min (1 hora - Completa)" },
  { value: 75, label: "75 min (1h 15m)" },
  { value: 90, label: "90 min (1 hora y media)" },
  { value: 120, label: "120 min (2 horas)" },
];

const fmtFechaHora = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { weekday:"short", day:"numeric", month:"short" })
    + " • " + d.toLocaleTimeString("es-MX", { hour:"2-digit", minute:"2-digit" });
};

const sanitizeWhatsAppPhone = (phone) => {
  if (!phone) return "";
  let clean = String(phone).replace(/\D/g, "");
  if (clean.length === 10) clean = "52" + clean;
  return clean;
};

const fmtCitaDia = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
};

const fmtCitaHora = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
};

const ESTADO_COLOR = {
  pendiente:  { bg:"bg-yellow-50",  border:"border-yellow-200",  text:"text-yellow-700", bar:"bg-yellow-400", label:"Pendiente", Icon: Clock },
  confirmada: { bg:"bg-green-50",   border:"border-green-200",   text:"text-green-700", bar:"bg-green-400", label:"Confirmada", Icon: CheckCircle2 },
  completada: { bg:"bg-slate-50",    border:"border-slate-200",    text:"text-[var(--brand-primary)]", bar:"bg-[var(--brand-primary)]", label:"Completada", Icon: CheckCircle2 },
  rechazada:  { bg:"bg-red-50",     border:"border-red-200",     text:"text-red-700", bar:"bg-red-400", label:"Rechazada", Icon: XCircle },
  cancelada:  { bg:"bg-slate-50",   border:"border-slate-200",   text:"text-slate-700", bar:"bg-slate-400", label:"Cancelada", Icon: Ban },
};

// ── Componente principal ─────────────────────────────────────────────────────
export function AgendaAdmin({ setMsg, profileId }) {
  const myId = profileId || getProfileId();
  const _peekCitas = myId ? dbPeek(`citas?nutriologo_id=eq.${myId}&order=fecha_hora.desc&select=id,cliente_id,fecha_hora,modalidad,estado,motivo_rechazo,created_at`) : null;
  const _peekDisp = myId ? dbPeek(`disponibilidad?nutriologo_id=eq.${myId}&order=dia_semana.asc,hora_inicio.asc`) : null;
  const _peekClis = myId ? (dbPeek(`clientes?nutriologo_id=eq.${myId}&select=id,auth_id,nombre,email,telefono&order=nombre.asc`) || dbPeek(`clientes?nutriologo_id=eq.${myId}&order=created_at.asc`)) : null;

  const [citas, setCitas]                   = useState(() => Array.isArray(_peekCitas) ? _peekCitas : []);
  const [disponibilidad, setDisponibilidad] = useState(() => Array.isArray(_peekDisp) ? _peekDisp : []);
  const [clientes, setClientes]             = useState(() => Array.isArray(_peekClis) ? _peekClis : []);
  const [loading, setLoading]               = useState(() => _peekCitas === null);
  const [subTab, setSubTab]                 = useState("citas");   // "citas" | "horarios"
  const [filtro, setFiltro]                 = useState("todos");   // "todos" | "pendiente" | "confirmada" | "rechazada"
  const [modalRechazo, setModalRechazo]     = useState(null);      // cita a rechazar
  const [motivoRechazo, setMotivoRechazo]   = useState("");
  const [saving, setSaving]                 = useState(false);
  const [confirmDelete, setConfirmDelete]   = useState(null);
  const brand = useBrand();
  const [showHorario, setShowHorario]       = useState(false);
  const [editingHorarioId, setEditingHorarioId] = useState(null);
  const [duracionGlobal, setDuracionGlobal] = useState(60);
  const [savingDuracion, setSavingDuracion] = useState(false);
  const [showNuevaCita, setShowNuevaCita]   = useState(false);
  const [nuevaCitaForm, setNuevaCitaForm]   = useState({
    cliente_id: "",
    fecha: "",
    hora: "10:00",
    modalidad: "presencial",
    duracion_minutos: 60,
  });
  const [horarioForm, setHorarioForm]       = useState({
    dia_semana: 1,
    hora_inicio: "09:00",
    hora_fin: "17:00",
    duracion_minutos: 60,
  });
  const [myProfile, setMyProfile]           = useState(null);
  const [selectedWaCita, setSelectedWaCita] = useState(null);

  useBackButton(!!modalRechazo, () => setModalRechazo(null), 25);
  useBackButton(showHorario, () => {
    setShowHorario(false);
    setEditingHorarioId(null);
  }, 20);
  useBackButton(showNuevaCita, () => setShowNuevaCita(false), 20);
  useBackButton(!!selectedWaCita, () => setSelectedWaCita(null), 25);

  // ── Carga de datos ──
  const loadProfile = useCallback(async () => {
    try {
      const rows = await dbGet(
        `profiles?id=eq.${myId}&select=id,nombre,nombre_marca,telefono,ubicacion_texto,mapa_url,duracion_cita`
      );
      if (rows && rows.length > 0) {
        setMyProfile(rows[0]);
        if (rows[0].duracion_cita) {
          setDuracionGlobal(Number(rows[0].duracion_cita));
        }
      }
    } catch {
      try {
        const rows = await dbGet(
          `profiles?id=eq.${myId}&select=id,nombre,nombre_marca,telefono,ubicacion_texto,mapa_url`
        );
        if (rows && rows.length > 0) setMyProfile(rows[0]);
      } catch {}
    }
  }, [myId]);

  const loadCitas = useCallback(async () => {
    try {
      const rows = await dbGet(
        `citas?nutriologo_id=eq.${myId}&order=fecha_hora.desc&select=id,cliente_id,fecha_hora,modalidad,estado,motivo_rechazo,created_at`
      );
      
      const now = new Date();
      if (Array.isArray(rows)) {
        for (const cita of rows) {
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
      const rows = await dbGet(`clientes?nutriologo_id=eq.${myId}&select=id,auth_id,nombre,email,telefono&order=nombre.asc`);
      setClientes(rows);
    } catch { }
  }, [myId]);

  const load = useCallback(async () => {
    if (citas.length === 0 && _peekCitas === null) setLoading(true);
    await Promise.all([loadCitas(), loadDisponibilidad(), loadClientes(), loadProfile()]);
    setLoading(false);
  }, [loadCitas, loadDisponibilidad, loadClientes, loadProfile]);

  useEffect(() => { load(); }, [load]);

  // ── Acciones ──
  const confirmar = async (cita) => {
    setSaving(true);
    try {
      await dbPatch(`citas?id=eq.${cita.id}`, { estado:"confirmada" });
      
      // Notify patient (non-blocking)
      const cInfo = clientes.find(c => c.id === cita.cliente_id);
      if (cInfo && cInfo.auth_id) {
        try {
          await dbPost("notificaciones", {
            profile_id: cInfo.auth_id,
            titulo:"Cita Confirmada",
            mensaje: `Tu nutriólogo ha confirmado tu cita para el ${new Date(cita.fecha_hora).toLocaleDateString('es-ES')}.`,
            tipo:"plan",
            link_url:"agenda",
            entidad_id: cita.id
          }, { headers: { Prefer: "return=minimal" } });
        } catch (notifErr) {
          console.warn("No se pudo enviar notificación de cita:", notifErr);
        }
      }

      setMsg("✓ Cita confirmada. Puedes enviar la confirmación con ubicación por WhatsApp.");
      loadCitas();
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const marcarCompletada = async (cita) => {
    setSaving(true);
    try {
      await dbPatch(`citas?id=eq.${cita.id}`, { estado:"completada" });
      setMsg("Cita marcada como completada. El paciente ahora puede calificarla.");
      loadCitas();
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const rechazar = async () => {
    if (!motivoRechazo.trim()) { setMsg("Escribe el motivo del rechazo"); return; }
    setSaving(true);
    try {
      await dbPatch(`citas?id=eq.${modalRechazo.id}`, { estado:"rechazada", motivo_rechazo: motivoRechazo });
      
      // Notify patient (non-blocking)
      const cInfo = clientes.find(c => c.id === modalRechazo.cliente_id);
      if (cInfo && cInfo.auth_id) {
        try {
          await dbPost("notificaciones", {
            profile_id: cInfo.auth_id,
            titulo:"Cita Rechazada",
            mensaje: `Tu cita ha sido rechazada: ${motivoRechazo}`,
            tipo:"alerta",
            link_url:"agenda",
            entidad_id: modalRechazo.id
          }, { headers: { Prefer: "return=minimal" } });
        } catch (notifErr) {
          console.warn("No se pudo enviar notificación de rechazo:", notifErr);
        }
      }

      setMsg("Cita rechazada");
      setModalRechazo(null); setMotivoRechazo("");
      loadCitas();
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const cancelar = async (cita) => {
    setSaving(true);
    try {
      await dbPatch(`citas?id=eq.${cita.id}`, { estado:"cancelada" });
      setMsg("Cita cancelada");
      loadCitas();
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const guardarDuracionGlobal = async (nuevaDuracion) => {
    const val = Number(nuevaDuracion);
    setDuracionGlobal(val);
    setSavingDuracion(true);
    try {
      await dbPatch(`profiles?id=eq.${myId}`, { duracion_cita: val });
      setMsg("Duración de consultas actualizada a " + val + " min");
    } catch {
      setMsg("Duración guardada");
    } finally {
      setSavingDuracion(false);
    }
  };

  const abrirNuevoHorario = () => {
    setEditingHorarioId(null);
    setHorarioForm({
      dia_semana: 1,
      hora_inicio: "09:00",
      hora_fin: "17:00",
      duracion_minutos: duracionGlobal || 60,
    });
    setShowHorario(true);
  };

  const abrirEditarHorario = (h) => {
    setEditingHorarioId(h.id);
    setHorarioForm({
      dia_semana: h.dia_semana,
      hora_inicio: h.hora_inicio?.slice(0, 5) || "09:00",
      hora_fin: h.hora_fin?.slice(0, 5) || "17:00",
      duracion_minutos: h.duracion_minutos || duracionGlobal || 60,
    });
    setShowHorario(true);
  };

  const guardarHorario = async () => {
    if (horarioForm.hora_inicio >= horarioForm.hora_fin) {
      setMsg("❌ La hora de fin debe ser posterior a la hora de inicio");
      return;
    }
    setSaving(true);
    const durMin = Number(horarioForm.duracion_minutos) || duracionGlobal || 60;
    const payload = {
      dia_semana: Number(horarioForm.dia_semana),
      hora_inicio: horarioForm.hora_inicio,
      hora_fin: horarioForm.hora_fin,
      duracion_minutos: durMin,
    };
    try {
      if (editingHorarioId) {
        await dbPatch(`disponibilidad?id=eq.${editingHorarioId}`, payload);
        setMsg("Horario actualizado");
      } else {
        await dbPost("disponibilidad", { ...payload, nutriologo_id: myId });
        setMsg("Horario guardado");
      }
      setShowHorario(false);
      setEditingHorarioId(null);
      loadDisponibilidad();
    } catch (e) {
      // Fallback si la columna duracion_minutos aún no está en Supabase
      try {
        delete payload.duracion_minutos;
        if (editingHorarioId) {
          await dbPatch(`disponibilidad?id=eq.${editingHorarioId}`, payload);
        } else {
          await dbPost("disponibilidad", { ...payload, nutriologo_id: myId });
        }
        setMsg("Horario guardado");
        setShowHorario(false);
        setEditingHorarioId(null);
        loadDisponibilidad();
      } catch (err2) {
        setMsg(err2.message || "Error al guardar horario");
      }
    }
    setSaving(false);
  };

  const crearCitaManual = async () => {
    if (!nuevaCitaForm.cliente_id || !nuevaCitaForm.fecha) {
      setMsg("Selecciona un paciente y una fecha");
      return;
    }
    setSaving(true);
    const [y, mo, dDay] = nuevaCitaForm.fecha.split("-").map(Number);
    const [h, m] = (nuevaCitaForm.hora || "10:00").split(":").map(Number);
    const fechaHora = new Date(y, mo - 1, dDay, h, m, 0).toISOString();
    const durMin = Number(nuevaCitaForm.duracion_minutos) || duracionGlobal || 60;

    const payload = {
      cliente_id: nuevaCitaForm.cliente_id,
      nutriologo_id: myId,
      fecha_hora: fechaHora,
      modalidad: nuevaCitaForm.modalidad || "presencial",
      estado: "confirmada",
      duracion_minutos: durMin,
    };

    try {
      try {
        await dbPost("citas", payload);
      } catch {
        delete payload.duracion_minutos;
        await dbPost("citas", payload);
      }

      // Notificar al paciente (non-blocking)
      const cInfo = clientes.find((c) => c.id === nuevaCitaForm.cliente_id);
      if (cInfo && cInfo.auth_id) {
        try {
          await dbPost("notificaciones", {
            profile_id: cInfo.auth_id,
            titulo: "Cita Agendada",
            mensaje: `Tu especialista ha programado una cita para el ${new Date(fechaHora).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })} a las ${nuevaCitaForm.hora}.`,
            tipo: "plan",
            link_url: "agenda",
          }, { headers: { Prefer: "return=minimal" } });
        } catch {}
      }

      setMsg("Cita agendada con éxito");
      setShowNuevaCita(false);
      setNuevaCitaForm({
        cliente_id: "",
        fecha: "",
        hora: "10:00",
        modalidad: "presencial",
        duracion_minutos: duracionGlobal || 60,
      });
      loadCitas();
    } catch (e) {
      setMsg(e.message || "Error al agendar cita");
    } finally {
      setSaving(false);
    }
  };

  const eliminarHorario = (id) => {
    setConfirmDelete({
      title: "¿Eliminar horario?",
      description: "Este bloque de disponibilidad se eliminará.",
      confirmText: "Eliminar horario",
      danger: true,
      icon: "trash",
      onConfirm: async () => {
        try {
          await dbDel(`disponibilidad?id=eq.${id}`);
          setMsg("Horario eliminado");
          setConfirmDelete(null);
          loadDisponibilidad();
        } catch (e) { setMsg(e.message); }
      }
    });
  };

  // ── Helpers de render ──
  const clienteNombre = (id) => clientes.find(c => c.id === id)?.nombre ||"Cliente";
  const clienteTelefono = (id) => clientes.find(c => c.id === id)?.telefono;

  const buildCitaWhatsAppMessage = useCallback((cita, tipo = "confirmacion") => {
    const cName = clienteNombre(cita.cliente_id);
    const primerNombre = (cName || "campeón").trim().split(" ")[0];
    const remitente = myProfile?.nombre_marca || myProfile?.nombre || "tu especialista";
    const dia = fmtCitaDia(cita.fecha_hora);
    const hora = fmtCitaHora(cita.fecha_hora);
    const isVirtual = cita.modalidad === "virtual";

    if (tipo === "confirmacion") {
      if (isVirtual) {
        return `¡Hola ${primerNombre}! 👋 Te confirmo tu cita virtual con ${remitente} para el ${dia} a las ${hora}.\n💻 La sesión será por videollamada; te compartiré el enlace previo a la consulta.\nPor favor ten a la mano tus dudas o notas. ¡Nos vemos pronto!`;
      } else {
        const ubicacion = myProfile?.ubicacion_texto || "Consultorio";
        const mapaUrl = myProfile?.mapa_url;
        return `¡Hola ${primerNombre}! 👋 Te confirmo tu cita presencial con ${remitente} para el ${dia} a las ${hora}.\n📍 Ubicación: ${ubicacion}\n${mapaUrl ? `🗺️ Ver en Google Maps: ${mapaUrl}\n` : ''}Por favor llega 5 minutos antes. Si necesitas reprogramar, avísame con anticipación. ¡Te esperamos con gusto!`;
      }
    }

    if (tipo === "recordatorio") {
      const d = new Date(cita.fecha_hora);
      const now = new Date();
      const esHoy = d.toDateString() === now.toDateString();
      const diaTexto = esHoy ? "HOY" : `el ${dia}`;
      const modTexto = isVirtual ? "Virtual" : "Presencial";
      const mapaUrl = !isVirtual ? myProfile?.mapa_url : null;

      return `¡Hola ${primerNombre}! 👋 Te recordamos tu cita de nutrición ${diaTexto} a las ${hora} (${modTexto}).\n${mapaUrl ? `📍 Ubicación: ${mapaUrl}\n` : ''}Por favor confírmanos respondiendo a este mensaje si todo sigue en pie. ¡Saludos!`;
    }

    return `¡Hola ${primerNombre}! 👋 Te saluda ${remitente}. Paso a saludarte respecto a tu cita del ${dia} a las ${hora}. Quedo atento a tus comentarios.`;
  }, [clientes, myProfile]);

  const citasFiltradas = filtro === "todos" ? citas : citas.filter(c => c.estado === filtro);

  const pendientesCount = citas.filter(c => c.estado === "pendiente").length;

  // ── Render ──
  return (
    <div className="w-full">
      {/* Top bar: status summary + Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="text-sm text-[#6B7A8D]">
          {pendientesCount > 0
            ? <span className="text-yellow-600 font-bold">{pendientesCount} cita{pendientesCount > 1 ? "s" : ""} pendiente{pendientesCount > 1 ? "s" : ""} de confirmar</span>
            : "Todo al día — sin citas pendientes por confirmar"}
        </div>
        {/* Sub-tabs */}
        <div className="flex gap-1 bg-[#F0F4FA] p-1 rounded-xl">
          {[["citas","Citas"], ["horarios","Horarios"]].map(([k, lb]) => (
            <button key={k} onClick={() => setSubTab(k)} className={`
              px-4 py-1.5 rounded-lg text-sm font-semibold transition-all
              ${subTab === k ? "bg-white text-[var(--brand-primary)] shadow-sm" : "text-[#6B7A8D] hover:text-[#0B1929]"}
            `}>
              {lb}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : subTab === "citas" ? (
        // ── Vista de Citas ──────────────────────────────────────────────────
        <div>
          {/* Barra de filtros y acción nueva cita */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap gap-2">
              {[
                ["todos", `Todas (${citas.length})`],
                ["pendiente", `Pendientes (${citas.filter(c => c.estado === "pendiente").length})`],
                ["confirmada", `Confirmadas (${citas.filter(c => c.estado === "confirmada").length})`],
                ["completada", `Completadas (${citas.filter(c => c.estado === "completada").length})`],
                ["rechazada", `Rechazadas (${citas.filter(c => c.estado === "rechazada").length})`],
              ].map(([k, lb]) => (
                <button
                  key={k}
                  onClick={() => setFiltro(k)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    filtro === k
                      ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm"
                      : "bg-white text-[#6B7A8D] border-[#E2E8F0] hover:bg-slate-50"
                  }`}
                >
                  {lb}
                </button>
              ))}
            </div>

            <Btn small grad onClick={() => setShowNuevaCita(true)}>
              <Plus className="w-4 h-4" /> Agendar cita
            </Btn>
          </div>

          {citasFiltradas.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-[15px] font-semibold text-[#6B7A8D]">No hay citas en esta categoría</div>
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
                            {cita.modalidad ==="virtual" ? <><Monitor className="w-3.5 h-3.5" /> Virtual</> : <><Building className="w-3.5 h-3.5" /> Presencial</>}
                          </Tag>
                          {tel && (
                            <div className="inline-flex items-stretch h-9 rounded-xl overflow-hidden shadow-sm" onClick={e => e.stopPropagation()}>
                              <a
                                href={`https://wa.me/${sanitizeWhatsAppPhone(tel)}?text=${encodeURIComponent(
                                  buildCitaWhatsAppMessage(cita, cita.estado === "pendiente" ? "confirmacion" : "recordatorio")
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className={`inline-flex items-center gap-1.5 text-xs font-bold text-white px-3 transition-colors ${
                                  cita.estado === "pendiente"
                                    ? "bg-[#25D366] hover:bg-[#20bd5a]"
                                    : "bg-emerald-600 hover:bg-emerald-700"
                                }`}
                                title="Enviar mensaje por WhatsApp a 1 clic"
                              >
                                <MessageCircle className="w-3.5 h-3.5 fill-white shrink-0" />
                                <span>{cita.estado === "pendiente" ? "Confirmar WhatsApp" : "Recordatorio WhatsApp"}</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => setSelectedWaCita(cita)}
                                className={`w-9 flex items-center justify-center border-l border-white/20 transition-colors text-white shrink-0 ${
                                  cita.estado === "pendiente" ? "bg-[#20bd5a] hover:bg-[#1caa50]" : "bg-emerald-700 hover:bg-emerald-800"
                                }`}
                                title="Opciones de plantilla WhatsApp"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
                        {cita.estado ==="pendiente" && (
                          <>
                            <Btn small grad onClick={() => confirmar(cita)} disabled={saving}>
                              <CheckCircle2 className="w-4 h-4" /> Confirmar
                            </Btn>
                            <Btn small outline danger onClick={() => { setModalRechazo(cita); setMotivoRechazo(""); }}>
                              <XCircle className="w-4 h-4" /> Rechazar
                            </Btn>
                          </>
                        )}
                        {cita.estado ==="confirmada" && (
                          <>
                            <button onClick={() => marcarCompletada(cita)} disabled={saving} className="text-[11px] font-bold bg-slate-50 text-[var(--brand-primary)] border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                              <CheckCircle2 size={12} /> Completada
                            </button>
                            <button onClick={() => cancelar(cita)} disabled={saving} className="text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                              <Ban size={12} /> Cancelar
                            </button>
                          </>
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
          {/* Card de Configuración de Duración Predeterminada */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#0B1929] flex items-center gap-2">
                    Duración habitual de tus consultas
                    {savingDuracion && <span className="text-[11px] font-normal text-[#6B7A8D] animate-pulse">Guardando…</span>}
                  </h4>
                  <p className="text-xs text-[#6B7A8D] mt-0.5 max-w-xl leading-relaxed">
                    Tus bloques de disponibilidad se dividirán automáticamente en citas de esta duración para que tus pacientes puedan agendar.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-56">
                  <CustomSelect
                    value={duracionGlobal}
                    onChange={guardarDuracionGlobal}
                    options={DURACIONES_CONSULTA}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-between items-center mb-5 gap-3">
            <div>
              <h4 className="font-bold text-base text-[#0B1929]">Días y Bloques de Atención</h4>
              <div className="text-xs text-[#6B7A8D]">
                Define los días y horas en que los clientes pueden solicitar una cita.
              </div>
            </div>
            <Btn small grad onClick={abrirNuevoHorario}>
              <Plus className="w-4 h-4" /> Agregar horario
            </Btn>
          </div>

          {disponibilidad.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-[15px] font-semibold text-[#0B1929] mb-2">Sin horarios configurados</div>
              <div className="text-sm text-[#6B7A8D] mb-5">Agrega tu disponibilidad para que los clientes puedan solicitar citas</div>
              <Btn small grad onClick={abrirNuevoHorario}>
                <Plus className="w-4 h-4" /> Agregar primer horario
              </Btn>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {disponibilidad.map(h => (
                <div key={h.id} className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-shadow">
                  <div>
                    <div className="font-bold text-sm text-[#0B1929] mb-1 flex items-center gap-2">
                      <span>{DIAS_FULL[h.dia_semana]}</span>
                      <span className="text-[11px] font-bold text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-2 py-0.5 rounded-full">
                        {h.duracion_minutos || duracionGlobal || 60} min / cita
                      </span>
                    </div>
                    <div className="text-sm text-[#6B7A8D] flex items-center gap-1.5">
                      <Clock3 className="w-4 h-4" /> {h.hora_inicio?.slice(0, 5)} – {h.hora_fin?.slice(0, 5)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Btn small outline onClick={() => abrirEditarHorario(h)} title="Editar horario">
                      <Edit2 className="w-3.5 h-3.5 text-[#6B7A8D]" />
                    </Btn>
                    <Btn small outline danger onClick={() => eliminarHorario(h.id)} title="Eliminar horario">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Btn>
                  </div>
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
              className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] bg-white resize-y"
              value={motivoRechazo}
              onChange={e => setMotivoRechazo(e.target.value)}
              placeholder="Ej. El horario ya fue ocupado..."
              rows={4}
            />
          </Field>
          <div className="flex gap-2 justify-end mt-2">
            <Btn outline onClick={() => setModalRechazo(null)}>Cancelar</Btn>
            <Btn danger onClick={rechazar} disabled={saving || !motivoRechazo.trim()}>
              {saving ?"Rechazando…" :"Confirmar rechazo"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Modal Agregar / Editar Horario */}
      {showHorario && (
        <Modal 
          title={editingHorarioId ? "Editar disponibilidad" : "Agregar disponibilidad"} 
          onClose={() => { setShowHorario(false); setEditingHorarioId(null); }}
        >
          <Field label="Día de la semana">
            <CustomSelect 
              value={horarioForm.dia_semana} 
              onChange={val => setHorarioForm(p => ({ ...p, dia_semana: Number(val) }))}
              options={DIAS_FULL.map((d, i) => ({ value: i, label: d }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <Field label="Hora inicio">
              <CustomSelect 
                value={horarioForm.hora_inicio} 
                onChange={val => setHorarioForm(p => ({ ...p, hora_inicio: val }))}
                options={HORAS}
              />
            </Field>
            <Field label="Hora fin">
              <CustomSelect 
                value={horarioForm.hora_fin} 
                onChange={val => setHorarioForm(p => ({ ...p, hora_fin: val }))}
                options={HORAS}
              />
            </Field>
          </div>
          <Field label="Duración por cita en este horario">
            <CustomSelect 
              value={horarioForm.duracion_minutos || duracionGlobal || 60} 
              onChange={val => setHorarioForm(p => ({ ...p, duracion_minutos: Number(val) }))}
              options={DURACIONES_CONSULTA}
            />
          </Field>
          <div className="flex gap-2 justify-end mt-3">
            <Btn outline onClick={() => { setShowHorario(false); setEditingHorarioId(null); }}>Cancelar</Btn>
            <Btn grad onClick={guardarHorario} disabled={saving}>
              {saving ? "Guardando…" : (editingHorarioId ? "Guardar cambios" : "Guardar horario")}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Modal Agendar Cita Manualmente (Nutriólogo) */}
      {showNuevaCita && (
        <Modal 
          title="Agendar Cita para Paciente" 
          onClose={() => setShowNuevaCita(false)}
        >
          <Field label="Paciente">
            <CustomSelect
              value={nuevaCitaForm.cliente_id}
              onChange={val => setNuevaCitaForm(p => ({ ...p, cliente_id: val }))}
              options={clientes.map(c => ({
                value: c.id,
                label: `${c.nombre} (${c.email || c.telefono || "Sin contacto"})`
              }))}
              placeholder="Seleccionar paciente..."
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha">
              <input
                type="date"
                value={nuevaCitaForm.fecha}
                min={new Date().toISOString().split("T")[0]}
                onChange={e => setNuevaCitaForm(p => ({ ...p, fecha: e.target.value }))}
                className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-[13px] font-medium text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
              />
            </Field>
            <Field label="Hora">
              <CustomSelect
                value={nuevaCitaForm.hora}
                onChange={val => setNuevaCitaForm(p => ({ ...p, hora: val }))}
                options={HORAS}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duración">
              <CustomSelect
                value={nuevaCitaForm.duracion_minutos || duracionGlobal || 60}
                onChange={val => setNuevaCitaForm(p => ({ ...p, duracion_minutos: Number(val) }))}
                options={DURACIONES_CONSULTA}
              />
            </Field>
            <Field label="Modalidad">
              <CustomSelect
                value={nuevaCitaForm.modalidad}
                onChange={val => setNuevaCitaForm(p => ({ ...p, modalidad: val }))}
                options={[
                  { value: "presencial", label: "Presencial" },
                  { value: "virtual", label: "Virtual" },
                ]}
              />
            </Field>
          </div>
          <div className="flex gap-2 justify-end mt-3">
            <Btn outline onClick={() => setShowNuevaCita(false)}>Cancelar</Btn>
            <Btn grad onClick={crearCitaManual} disabled={saving || !nuevaCitaForm.cliente_id || !nuevaCitaForm.fecha}>
              {saving ? "Agendando..." : "Confirmar Cita"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Modal / Action Sheet de Plantillas WhatsApp para Citas */}
      {selectedWaCita && createPortal(
        <div 
          className="fixed inset-0 bg-[#0B1929]/50 backdrop-blur-sm z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedWaCita(null)}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#F0F4FA] flex items-center justify-between bg-white shrink-0">
              <div>
                <h3 className="font-bold text-lg text-[#0B1929] flex items-center gap-2" style={{ fontFamily: "DM Sans" }}>
                  <MessageCircle className="w-5 h-5 text-[#25D366] fill-[#25D366]" />
                  Mensajes de Cita — {clienteNombre(selectedWaCita.cliente_id)?.split(" ")[0]}
                </h3>
                <p className="text-xs text-[#6B7A8D] mt-0.5">
                  {fmtFechaHora(selectedWaCita.fecha_hora)} • {selectedWaCita.modalidad === "virtual" ? "Virtual" : "Presencial"} • {clienteTelefono(selectedWaCita.cliente_id) ? `WhatsApp: ${clienteTelefono(selectedWaCita.cliente_id)}` : "Sin teléfono"}
                </p>
              </div>
              <button 
                onClick={() => setSelectedWaCita(null)} 
                className="w-8 h-8 rounded-full bg-[#F0F4FA] text-[#6B7A8D] hover:text-[#0B1929] flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body con plantillas interactivas */}
            <div className="p-5 overflow-y-auto space-y-3 bg-[#F8FAFC]">
              {/* Template 1: Confirmación Oficial */}
              {(() => {
                const tel = clienteTelefono(selectedWaCita.cliente_id);
                const isRec = selectedWaCita.estado === "pendiente";
                const msg = buildCitaWhatsAppMessage(selectedWaCita, "confirmacion");
                return (
                  <a
                    href={`https://wa.me/${sanitizeWhatsAppPhone(tel)}?text=${encodeURIComponent(msg)}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setSelectedWaCita(null)}
                    className={`block p-4 rounded-xl border transition-all text-left group bg-white ${
                      isRec 
                        ? 'border-[#25D366] ring-2 ring-[#25D366]/20 shadow-sm' 
                        : 'border-[#E2E8F0] hover:border-[#25D366] hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-[#0B1929] flex items-center gap-1.5 group-hover:text-emerald-600 transition-colors">
                        <CheckCircle2 size={16} className="text-[#25D366]" />
                        Confirmación Oficial de Cita
                      </span>
                      {isRec && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Sugerido ahora
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7A8D] leading-relaxed whitespace-pre-line">
                      "{msg}"
                    </p>
                    <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <span>Enviar por WhatsApp</span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </a>
                );
              })()}

              {/* Template 2: Recordatorio de Cita */}
              {(() => {
                const tel = clienteTelefono(selectedWaCita.cliente_id);
                const isRec = selectedWaCita.estado === "confirmada";
                const msg = buildCitaWhatsAppMessage(selectedWaCita, "recordatorio");
                return (
                  <a
                    href={`https://wa.me/${sanitizeWhatsAppPhone(tel)}?text=${encodeURIComponent(msg)}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setSelectedWaCita(null)}
                    className={`block p-4 rounded-xl border transition-all text-left group bg-white ${
                      isRec 
                        ? 'border-amber-300 ring-2 ring-amber-500/20 shadow-sm' 
                        : 'border-[#E2E8F0] hover:border-[#25D366] hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-[#0B1929] flex items-center gap-1.5 group-hover:text-amber-600 transition-colors">
                        <Clock size={16} className="text-amber-500" />
                        Recordatorio de Cita
                      </span>
                      {isRec && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Sugerido previo a cita
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7A8D] leading-relaxed whitespace-pre-line">
                      "{msg}"
                    </p>
                    <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-amber-600">
                      <span>Enviar por WhatsApp</span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </a>
                );
              })()}

              {/* Template 3: Chat Libre */}
              {(() => {
                const tel = clienteTelefono(selectedWaCita.cliente_id);
                return (
                  <a
                    href={`https://wa.me/${sanitizeWhatsAppPhone(tel)}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setSelectedWaCita(null)}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-dashed border-[#CBD5E1] hover:border-[#25D366] hover:bg-emerald-50/50 transition-colors text-slate-600 hover:text-emerald-700 font-medium text-xs bg-white"
                  >
                    <span className="flex items-center gap-2">
                      <MessageCircle size={15} />
                      Abrir conversación en blanco (sin texto previo)
                    </span>
                    <span className="font-bold">Abrir chat →</span>
                  </a>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-[#F0F4FA] flex justify-end shrink-0">
              <button
                onClick={() => setSelectedWaCita(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-[#6B7A8D] hover:bg-[#F0F4FA] transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDelete?.onConfirm}
        title={confirmDelete?.title}
        description={confirmDelete?.description}
        confirmText={confirmDelete?.confirmText || "Eliminar"}
        cancelText={confirmDelete?.cancelText || "Cancelar"}
        danger={confirmDelete?.danger ?? true}
        icon={confirmDelete?.icon || "trash"}
      />
    </div>
  );
}
