import { useState, useEffect, useCallback } from "react";
import { C } from "../../styles/theme";
import { Btn, Modal, Field, Tag } from "../ui";
import { dbGet, dbPost, dbPatch, getProfileId } from "../../lib/supabase";

// ── Helpers ──────────────────────────────────────────────────────────────────
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DIAS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const HORAS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

const fmtFechaHora = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })
    + " • " + d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
};

const ESTADO_COLOR = {
  pendiente:  { bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.35)",  text: "#fbbf24", label: "⏳ Pendiente" },
  confirmada: { bg: "rgba(34,197,94,0.10)",   border: "rgba(34,197,94,0.30)",   text: "#22c55e", label: "✅ Confirmada" },
  rechazada:  { bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.30)",   text: "#f87171", label: "❌ Rechazada" },
  cancelada:  { bg: "rgba(100,116,139,0.10)", border: "rgba(100,116,139,0.30)", text: "#94a3b8", label: "🚫 Cancelada" },
};

// ── Componente principal ─────────────────────────────────────────────────────
export function AgendaAdmin({ setMsg, profileId }) {
  const [citas, setCitas]                   = useState([]);
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [clientes, setClientes]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [subTab, setSubTab]                 = useState("citas");   // "citas" | "horarios"
  const [filtro, setFiltro]                 = useState("pendiente"); // "todos" | "pendiente" | "confirmada"
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
      setMsg("✅ Cita confirmada");
      loadCitas();
    } catch (e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const rechazar = async () => {
    if (!motivoRechazo.trim()) { setMsg("⚠️ Escribe el motivo del rechazo"); return; }
    setSaving(true);
    try {
      await dbPatch(`citas?id=eq.${modalRechazo.id}`, { estado: "rechazada", motivo_rechazo: motivoRechazo });
      setMsg("🔴 Cita rechazada");
      setModalRechazo(null); setMotivoRechazo("");
      loadCitas();
    } catch (e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const cancelar = async (cita) => {
    setSaving(true);
    try {
      await dbPatch(`citas?id=eq.${cita.id}`, { estado: "cancelada" });
      setMsg("🚫 Cita cancelada");
      loadCitas();
    } catch (e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const agregarHorario = async () => {
    try {
      await dbPost("disponibilidad", { ...horarioForm, nutriologo_id: myId });
      setMsg("✅ Horario guardado");
      setShowHorario(false);
      loadDisponibilidad();
    } catch (e) { setMsg("❌ " + e.message); }
  };

  const eliminarHorario = async (id) => {
    try {
      await dbPatch(`disponibilidad?id=eq.${id}`, {});
      // Supabase no tiene DELETE directo fácil con la lib actual — usamos un workaround
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/disponibilidad?id=eq.${id}`, {
        method: "DELETE",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        }
      });
      setMsg("🗑️ Horario eliminado");
      loadDisponibilidad();
    } catch (e) { setMsg("❌ " + e.message); }
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
    <div className="animate-in">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 24, color: C.text, letterSpacing: "0.5px" }}>
            📅 Agenda
          </h2>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
            {pendientesCount > 0
              ? <span style={{ color: "#fbbf24", fontWeight: 700 }}>⚡ {pendientesCount} cita{pendientesCount > 1 ? "s" : ""} pendiente{pendientesCount > 1 ? "s" : ""} de confirmar</span>
              : "Todo al día"}
          </div>
        </div>
        {/* Sub-tabs */}
        <div style={{ display: "flex", gap: 6 }}>
          {[["citas", "📋 Citas"], ["horarios", "🕐 Horarios"]].map(([k, lb]) => (
            <button key={k} onClick={() => setSubTab(k)} style={{
              padding: "7px 16px", borderRadius: 9, fontSize: 12, fontWeight: 700,
              fontFamily: "'Inter',sans-serif", cursor: "pointer", transition: "all 0.2s",
              background: subTab === k ? "rgba(46,92,184,0.25)" : "rgba(46,92,184,0.07)",
              border: `1px solid ${subTab === k ? "rgba(46,92,184,0.5)" : "rgba(46,92,184,0.15)"}`,
              color: subTab === k ? C.accent : C.muted
            }}>{lb}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${C.border}`, borderTopColor: C.accent, animation: "rotateSlow 0.8s linear infinite", margin: "0 auto 14px" }} />
          Cargando agenda…
        </div>
      ) : subTab === "citas" ? (
        // ── Vista de Citas ──────────────────────────────────────────────────
        <div>
          {/* Filtros */}
          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
            {[["pendiente", "⏳ Pendientes"], ["confirmada", "✅ Confirmadas"], ["rechazada", "❌ Rechazadas"], ["todos", "📋 Todas"]].map(([k, lb]) => (
              <button key={k} onClick={() => setFiltro(k)} style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                fontFamily: "'Inter',sans-serif", cursor: "pointer", transition: "all 0.2s",
                background: filtro === k ? "rgba(46,92,184,0.25)" : "rgba(46,92,184,0.06)",
                border: `1px solid ${filtro === k ? "rgba(46,92,184,0.45)" : "rgba(46,92,184,0.12)"}`,
                color: filtro === k ? C.accent : C.muted
              }}>
                {lb}
                {k === "pendiente" && pendientesCount > 0 && (
                  <span style={{ marginLeft: 6, background: "#fbbf24", color: "#000", borderRadius: "50%", padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>{pendientesCount}</span>
                )}
              </button>
            ))}
          </div>

          {citasFiltradas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: C.muted, background: "rgba(7,13,24,0.4)", borderRadius: 16, border: "1px solid rgba(46,92,184,0.06)" }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>📅</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.muted }}>Sin citas {filtro !== "todos" ? `en estado "${filtro}"` : ""}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {citasFiltradas.map((cita, i) => {
                const estado = ESTADO_COLOR[cita.estado] || ESTADO_COLOR.cancelada;
                const tel = clienteTelefono(cita.cliente_id);
                return (
                  <div key={cita.id} className="card-hover animate-in" style={{
                    animationDelay: `${i * 0.04}s`,
                    background: "linear-gradient(145deg, rgba(10,20,40,0.85), rgba(7,13,24,0.95))",
                    borderRadius: 16, border: "1px solid rgba(46,92,184,0.1)",
                    padding: "16px 20px", position: "relative", overflow: "hidden",
                    backdropFilter: "blur(12px)"
                  }}>
                    {/* Barra lateral estado */}
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
                      background: estado.text, borderRadius: "4px 0 0 4px",
                      boxShadow: `0 0 12px ${estado.text}55`
                    }} />

                    <div style={{ paddingLeft: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                      {/* Info izquierda */}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 4, fontFamily: "'Space Grotesk',sans-serif" }}>
                          {clienteNombre(cita.cliente_id)}
                        </div>
                        <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>
                          🕐 {fmtFechaHora(cita.fecha_hora)}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <Tag size="sm" color={estado.text}>{estado.label}</Tag>
                          <Tag size="sm" color={C.accentMid}>
                            {cita.modalidad === "virtual" ? "💻 Virtual" : "🏢 Presencial"}
                          </Tag>
                          {tel && (
                            <a
                              href={`https://wa.me/${tel.replace(/\D/g, "")}?text=Hola+${clienteNombre(cita.cliente_id)}%2C+sobre+tu+cita+el+${encodeURIComponent(fmtFechaHora(cita.fecha_hora))}`}
                              target="_blank" rel="noreferrer"
                              style={{ color: "#22c55e", fontSize: 12, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              💬 WhatsApp
                            </a>
                          )}
                        </div>
                        {cita.motivo_rechazo && (
                          <div style={{ marginTop: 8, fontSize: 12, color: "#f87171", background: "rgba(239,68,68,0.08)", borderRadius: 8, padding: "6px 10px", border: "1px solid rgba(239,68,68,0.15)" }}>
                            Motivo: {cita.motivo_rechazo}
                          </div>
                        )}
                      </div>

                      {/* Acciones derecha */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {cita.estado === "pendiente" && (
                          <>
                            <Btn small grad onClick={() => confirmar(cita)} disabled={saving}>✅ Confirmar</Btn>
                            <Btn small outline color="#ef4444" onClick={() => { setModalRechazo(cita); setMotivoRechazo(""); }}>❌ Rechazar</Btn>
                          </>
                        )}
                        {cita.estado === "confirmada" && (
                          <Btn small outline color="#ef4444" onClick={() => cancelar(cita)} disabled={saving}>🚫 Cancelar</Btn>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: C.muted }}>
              Define los días y horas en que los clientes pueden solicitar una cita.
            </div>
            <Btn small grad onClick={() => setShowHorario(true)}>+ Agregar horario</Btn>
          </div>

          {disponibilidad.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: C.muted, background: "rgba(7,13,24,0.4)", borderRadius: 16, border: "1px solid rgba(46,92,184,0.06)" }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>🕐</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.muted, marginBottom: 8 }}>Sin horarios configurados</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Agrega tu disponibilidad para que los clientes puedan solicitar citas</div>
              <Btn small grad onClick={() => setShowHorario(true)}>+ Agregar primer horario</Btn>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
              {disponibilidad.map(h => (
                <div key={h.id} style={{
                  background: "linear-gradient(145deg, rgba(10,20,40,0.8), rgba(7,13,24,0.9))",
                  borderRadius: 14, border: "1px solid rgba(46,92,184,0.12)",
                  padding: "14px 18px", display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: 10
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 4 }}>
                      {DIAS_FULL[h.dia_semana]}
                    </div>
                    <div style={{ fontSize: 13, color: C.muted }}>
                      🕐 {h.hora_inicio?.slice(0, 5)} – {h.hora_fin?.slice(0, 5)}
                    </div>
                  </div>
                  <Btn small outline color="#ef4444" onClick={() => eliminarHorario(h.id)}>🗑️</Btn>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Rechazar */}
      {modalRechazo && (
        <Modal title="❌ Rechazar cita" onClose={() => setModalRechazo(null)}>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
            Rechazando la cita de <strong style={{ color: C.text }}>{clienteNombre(modalRechazo.cliente_id)}</strong> el{" "}
            <strong style={{ color: C.text }}>{fmtFechaHora(modalRechazo.fecha_hora)}</strong>.
            <br/>El cliente verá el motivo en su aplicación.
          </div>
          <Field label="Motivo del rechazo">
            <textarea
              value={motivoRechazo}
              onChange={e => setMotivoRechazo(e.target.value)}
              placeholder="Ej. El horario ya fue ocupado por otro paciente. Te invitamos a seleccionar una nueva fecha."
              rows={4}
              style={{ resize: "vertical", fontFamily: "'Inter',sans-serif", fontSize: 13 }}
            />
          </Field>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn outline color={C.muted} onClick={() => setModalRechazo(null)}>Cancelar</Btn>
            <Btn danger onClick={rechazar} disabled={saving || !motivoRechazo.trim()}>
              {saving ? "Rechazando…" : "Confirmar rechazo"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Modal Agregar Horario */}
      {showHorario && (
        <Modal title="🕐 Agregar horario de disponibilidad" onClose={() => setShowHorario(false)}>
          <Field label="Día de la semana">
            <select value={horarioForm.dia_semana} onChange={e => setHorarioForm(p => ({ ...p, dia_semana: +e.target.value }))}>
              {DIAS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Hora inicio">
              <select value={horarioForm.hora_inicio} onChange={e => setHorarioForm(p => ({ ...p, hora_inicio: e.target.value }))}>
                {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </Field>
            <Field label="Hora fin">
              <select value={horarioForm.hora_fin} onChange={e => setHorarioForm(p => ({ ...p, hora_fin: e.target.value }))}>
                {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn outline color={C.muted} onClick={() => setShowHorario(false)}>Cancelar</Btn>
            <Btn grad onClick={agregarHorario}>Guardar horario</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
