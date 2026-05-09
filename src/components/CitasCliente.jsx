import { useState, useEffect, useCallback } from "react";
import { C } from "../../styles/theme";
import { Btn, Modal, Field, Tag } from "../ui";
import { dbGet, dbPost } from "../../lib/supabase";

// ── Helpers ──────────────────────────────────────────────────────────────────
const DIAS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const fmtFechaHora = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })
    + " a las " + d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
};

const fmtFechaCorta = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })
    + " • " + d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
};

const ESTADO_COLOR = {
  pendiente:  { text: "#fbbf24", label: "⏳ Pendiente de confirmación" },
  confirmada: { text: "#22c55e", label: "✅ Confirmada" },
  rechazada:  { text: "#f87171", label: "❌ Rechazada" },
  cancelada:  { text: "#94a3b8", label: "🚫 Cancelada" },
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
      const hStr = `${String(Math.floor(hora / 60)).padStart(2, "0")}:${String(hora % 60).padStart(2, "0")}`;
      const isoSlot = `${selectedDate}T${hStr}:00`;
      const ocupado = citasOcupadas.some(c =>
        c.estado !== "rechazada" && c.estado !== "cancelada" &&
        c.fecha_hora?.startsWith(isoSlot.slice(0, 16))
      );
      slots.push({ hora: hStr, iso: isoSlot, ocupado });
      hora += 60;
    }
  }
  return slots;
};

// ── Componente ───────────────────────────────────────────────────────────────
export function CitasCliente({ clienteId, nutriologoId }) {
  const [citas, setCitas]               = useState([]);
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots]               = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [modalidad, setModalidad]       = useState("presencial");
  const [exito, setExito]               = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, d] = await Promise.all([
        dbGet(`citas?cliente_id=eq.${clienteId}&order=fecha_hora.desc&select=id,fecha_hora,modalidad,estado,motivo_rechazo`),
        dbGet(`disponibilidad?nutriologo_id=eq.${nutriologoId}&order=dia_semana.asc`)
      ]);
      setCitas(c);
      setDisponibilidad(d);
    } catch { }
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

  const solicitarCita = async () => {
    if (!selectedSlot) return;
    setSaving(true);
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
      setSelectedDate(""); setSelectedSlot(null);
      await loadData();
    } catch (e) {
      // el horario pudo haberse llenado
      console.error(e);
    }
    setSaving(false);
  };

  const diasDisponibles = [...new Set(disponibilidad.map(d => d.dia_semana))];

  // Calcular fecha mínima (mañana)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  const citasProximas = citas.filter(c => new Date(c.fecha_hora) >= new Date() && c.estado !== "cancelada" && c.estado !== "rechazada");
  const citasPasadas  = citas.filter(c => new Date(c.fecha_hora) <  new Date() || c.estado === "cancelada" || c.estado === "rechazada");

  return (
    <div className="animate-in">

      {/* Aviso de éxito */}
      {exito && (
        <div style={{
          background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.25)",
          borderRadius: 14, padding: "16px 20px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 12
        }}>
          <span style={{ fontSize: 24 }}>🎉</span>
          <div>
            <div style={{ fontWeight: 700, color: "#22c55e", marginBottom: 4 }}>¡Solicitud enviada!</div>
            <div style={{ fontSize: 13, color: C.muted }}>Espera la confirmación de la clínica. Te avisaremos pronto.</div>
          </div>
          <Btn small outline color={C.muted} onClick={() => setExito(false)} style={{ marginLeft: "auto" }}>✕</Btn>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 24, color: C.text }}>
            📅 Mis Citas
          </h2>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
            {citasProximas.length > 0
              ? `${citasProximas.length} cita${citasProximas.length > 1 ? "s" : ""} próxima${citasProximas.length > 1 ? "s" : ""}`
              : "Sin citas próximas"}
          </div>
        </div>
        {disponibilidad.length > 0 && (
          <Btn grad onClick={() => { setShowModal(true); setExito(false); }}>+ Solicitar cita</Btn>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${C.border}`, borderTopColor: C.accent, animation: "rotateSlow 0.8s linear infinite", margin: "0 auto 14px" }} />
          Cargando citas…
        </div>
      ) : citas.length === 0 && disponibilidad.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: C.muted, background: "rgba(7,13,24,0.4)", borderRadius: 16, border: "1px solid rgba(46,92,184,0.06)" }}>
          <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.4 }}>📅</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 8 }}>Sistema de citas próximamente</div>
          <div style={{ fontSize: 13 }}>Tu nutriólogo aún no ha configurado su horario de atención.</div>
        </div>
      ) : (
        <>
          {/* Próximas */}
          {citasProximas.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 12 }}>Próximas</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {citasProximas.map((cita, i) => {
                  const estado = ESTADO_COLOR[cita.estado];
                  return (
                    <div key={cita.id} className="animate-in" style={{
                      animationDelay: `${i * 0.05}s`,
                      background: "linear-gradient(145deg, rgba(10,20,40,0.85), rgba(7,13,24,0.95))",
                      borderRadius: 16, border: "1px solid rgba(46,92,184,0.12)",
                      padding: "16px 20px", position: "relative", overflow: "hidden"
                    }}>
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: estado.text, borderRadius: "4px 0 0 4px", boxShadow: `0 0 12px ${estado.text}55` }} />
                      <div style={{ paddingLeft: 14 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 6, fontFamily: "'Space Grotesk',sans-serif", textTransform: "capitalize" }}>
                          {fmtFechaHora(cita.fecha_hora)}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Tag size="sm" color={estado.text}>{estado.label}</Tag>
                          <Tag size="sm" color={C.accentMid}>{cita.modalidad === "virtual" ? "💻 Virtual" : "🏢 Presencial"}</Tag>
                        </div>
                        {cita.motivo_rechazo && (
                          <div style={{ marginTop: 10, fontSize: 12, color: "#f87171", background: "rgba(239,68,68,0.08)", borderRadius: 8, padding: "8px 12px", border: "1px solid rgba(239,68,68,0.15)", lineHeight: 1.6 }}>
                            <strong>Motivo:</strong> {cita.motivo_rechazo}
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
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 12 }}>Historial</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {citasPasadas.slice(0, 5).map(cita => {
                  const estado = ESTADO_COLOR[cita.estado] || ESTADO_COLOR.cancelada;
                  return (
                    <div key={cita.id} style={{
                      background: "rgba(7,13,24,0.5)", borderRadius: 12,
                      border: "1px solid rgba(46,92,184,0.06)",
                      padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap"
                    }}>
                      <div style={{ flex: 1, fontSize: 13, color: C.muted }}>{fmtFechaCorta(cita.fecha_hora)}</div>
                      <Tag size="sm" color={estado.text}>{estado.label}</Tag>
                      <Tag size="sm" color={C.accentMid}>{cita.modalidad === "virtual" ? "💻" : "🏢"}</Tag>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {citas.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
              <div style={{ fontSize: 48, marginBottom: 14, opacity: 0.3 }}>📅</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 8 }}>Sin citas aún</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Solicita tu primera cita con el botón de arriba</div>
            </div>
          )}
        </>
      )}

      {/* Modal solicitar cita */}
      {showModal && (
        <Modal title="📅 Solicitar cita" onClose={() => { setShowModal(false); setSelectedDate(""); setSelectedSlot(null); }}>
          {/* Días disponibles */}
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, background: "rgba(46,92,184,0.07)", borderRadius: 10, padding: "10px 14px", lineHeight: 1.6 }}>
            📆 Días disponibles: <strong style={{ color: C.text }}>
              {diasDisponibles.map(d => DIAS_FULL[d]).join(", ")}
            </strong>
          </div>

          <Field label="Selecciona la fecha">
            <input
              type="date"
              value={selectedDate}
              min={minDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
          </Field>

          {/* Horarios disponibles */}
          {selectedDate && (
            <Field label="Selecciona el horario">
              {slots.length === 0 ? (
                <div style={{ fontSize: 13, color: C.muted, padding: "12px 0" }}>
                  No hay horarios disponibles para este día. Selecciona otro.
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {slots.map(slot => (
                    <button
                      key={slot.iso}
                      disabled={slot.ocupado}
                      onClick={() => setSelectedSlot(slot)}
                      style={{
                        padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                        fontFamily: "'Inter',sans-serif", cursor: slot.ocupado ? "not-allowed" : "pointer",
                        opacity: slot.ocupado ? 0.35 : 1, transition: "all 0.18s",
                        background: selectedSlot?.iso === slot.iso
                          ? "rgba(46,92,184,0.35)"
                          : "rgba(46,92,184,0.08)",
                        border: `1px solid ${selectedSlot?.iso === slot.iso
                          ? "rgba(46,92,184,0.6)"
                          : "rgba(46,92,184,0.18)"}`,
                        color: selectedSlot?.iso === slot.iso ? C.accent : C.muted
                      }}
                    >
                      {slot.hora} {slot.ocupado ? "🔒" : ""}
                    </button>
                  ))}
                </div>
              )}
            </Field>
          )}

          <Field label="Modalidad">
            <div style={{ display: "flex", gap: 10 }}>
              {[["presencial", "🏢 Presencial"], ["virtual", "💻 Virtual"]].map(([v, lb]) => (
                <button key={v} onClick={() => setModalidad(v)} style={{
                  flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                  fontFamily: "'Inter',sans-serif", cursor: "pointer", transition: "all 0.18s",
                  background: modalidad === v ? "rgba(46,92,184,0.25)" : "rgba(46,92,184,0.07)",
                  border: `1px solid ${modalidad === v ? "rgba(46,92,184,0.5)" : "rgba(46,92,184,0.15)"}`,
                  color: modalidad === v ? C.accent : C.muted
                }}>{lb}</button>
              ))}
            </div>
          </Field>

          {selectedSlot && (
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.muted, marginBottom: 8, lineHeight: 1.6 }}>
              ✅ Tu solicitud será para el <strong style={{ color: C.text }}>{fmtFechaHora(selectedSlot.iso)}</strong> modalidad <strong style={{ color: C.text }}>{modalidad}</strong>.
              <br />La clínica la confirmará pronto.
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn outline color={C.muted} onClick={() => { setShowModal(false); setSelectedDate(""); setSelectedSlot(null); }}>Cancelar</Btn>
            <Btn grad onClick={solicitarCita} disabled={!selectedSlot || saving}>
              {saving ? "Enviando…" : "Solicitar cita"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
