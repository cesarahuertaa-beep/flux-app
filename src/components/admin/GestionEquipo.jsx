import { useState, useEffect, useCallback } from "react";
import { C } from "../../styles/theme";
import { Btn, Modal, Field, Tag } from "../ui";
import { authInvite, dbGet, dbPatch, getProfileId } from "../../lib/supabase";

// ─── GestionEquipo ──────────────────────────────────────────────────────────
// Permite que un nutriólogo invite y gestione a su personal administrativo.
// El administrativo queda ligado al nutriologo_id del creador.
// ────────────────────────────────────────────────────────────────────────────

export function GestionEquipo({ setMsg, profileId }) {
  const [equipo, setEquipo]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ nombre: "", email: "", telefono: "" });

  const myId = profileId || getProfileId();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await dbGet(
        `profiles?role=eq.administrativo&nutriologo_id=eq.${myId}&select=id,nombre,email,telefono,activo&order=nombre.asc`
      );
      setEquipo(rows);
    } catch { }
    setLoading(false);
  }, [myId]);

  useEffect(() => { load(); }, [load]);

  const invite = async () => {
    if (!form.email || !form.nombre) {
      setMsg("⚠️ Nombre y email son obligatorios");
      return;
    }
    setSaving(true);
    try {
      await authInvite(form.email, {
        role: "administrativo",
        nombre: form.nombre,
        telefono: form.telefono,
        nutriologo_id: myId,
      });
      setMsg("✅ Invitación enviada — el administrativo recibirá un email para crear su contraseña");
      setShowInvite(false);
      setForm({ nombre: "", email: "", telefono: "" });
      setTimeout(load, 2000);
    } catch (e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const toggleActivo = async (p) => {
    try {
      await dbPatch(`profiles?id=eq.${p.id}`, { activo: !p.activo });
      setMsg(p.activo ? "🔴 Acceso suspendido" : "🟢 Acceso activado");
      load();
    } catch (e) { setMsg("❌ " + e.message); }
  };

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 24, color: C.text, letterSpacing: "0.5px" }}>
            👥 Equipo Administrativo
          </h2>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
            {equipo.length} colaborador{equipo.length !== 1 ? "es" : ""} registrado{equipo.length !== 1 ? "s" : ""}
          </div>
        </div>
        <Btn grad onClick={() => setShowInvite(true)}>+ Invitar colaborador</Btn>
      </div>

      {/* Explicación */}
      <div style={{
        background: "rgba(46,92,184,0.07)", border: "1px solid rgba(46,92,184,0.15)",
        borderRadius: 12, padding: "13px 18px", fontSize: 13, color: C.muted,
        marginBottom: 22, lineHeight: 1.7
      }}>
        <strong style={{ color: C.text }}>¿Qué puede hacer un colaborador?</strong><br />
        Tiene acceso únicamente a la lista de clientes y a la gestión de citas.
        <strong style={{ color: C.text }}> No puede</strong> ver ni editar dietas, rutinas ni la biblioteca.
        Puedes suspender su acceso en cualquier momento.
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${C.border}`, borderTopColor: C.accent, animation: "rotateSlow 0.8s linear infinite", margin: "0 auto 14px" }} />
          Cargando equipo…
        </div>
      ) : equipo.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: C.muted, background: "rgba(7,13,24,0.4)", borderRadius: 16, border: "1px solid rgba(46,92,184,0.06)" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🗂️</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: C.text }}>Sin colaboradores aún</div>
          <div style={{ fontSize: 13 }}>Invita a tu primer secretario o administrativo para comenzar</div>
          <div style={{ marginTop: 20 }}>
            <Btn grad onClick={() => setShowInvite(true)}>+ Invitar primer colaborador</Btn>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {equipo.map((p, i) => (
            <div key={p.id} className="card-hover animate-in" style={{
              animationDelay: `${i * 0.05}s`,
              background: "linear-gradient(145deg, rgba(10,20,40,0.8), rgba(7,13,24,0.9))",
              borderRadius: 16, border: "1px solid rgba(46,92,184,0.09)",
              padding: "16px 20px", display: "flex",
              alignItems: "center", justifyContent: "space-between",
              flexWrap: "wrap", gap: 12, position: "relative", overflow: "hidden",
              backdropFilter: "blur(12px)"
            }}>
              {/* Barra lateral de estado */}
              <div style={{
                position: "absolute", left: 0, top: "15%", bottom: "15%", width: 3,
                borderRadius: "0 3px 3px 0",
                background: p.activo !== false
                  ? "linear-gradient(180deg,#38bdf8,#818cf8)"
                  : "rgba(239,68,68,0.6)",
                boxShadow: p.activo !== false
                  ? "0 0 12px rgba(56,189,248,0.4)"
                  : "0 0 8px rgba(239,68,68,0.3)"
              }} />

              {/* Info */}
              <div style={{ paddingLeft: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 3, fontFamily: "'Space Grotesk',sans-serif" }}>
                  {p.nombre || "—"}
                </div>
                <div style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {p.email || "Sin email"}
                  {p.telefono && (
                    <a
                      href={`https://wa.me/${p.telefono.replace(/\D/g, "")}`}
                      target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ color: "#22c55e", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}
                    >
                      <span style={{ fontSize: 14 }}>💬</span> WhatsApp
                    </a>
                  )}
                </div>
                <div style={{ marginTop: 6 }}>
                  <Tag color={p.activo !== false ? C.accent : "#f87171"} size="sm">
                    {p.activo !== false ? "● Activo" : "○ Suspendido"}
                  </Tag>
                </div>
              </div>

              {/* Acciones */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Btn
                  small outline
                  color={p.activo !== false ? "#ef4444" : C.accent}
                  onClick={() => toggleActivo(p)}
                >
                  {p.activo !== false ? "Suspender acceso" : "Activar acceso"}
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Invitar */}
      {showInvite && (
        <Modal title="🗂️ Invitar colaborador administrativo" onClose={() => setShowInvite(false)}>
          <Field label="Nombre completo">
            <input
              value={form.nombre}
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej. Sofía López"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="sofia@clinica.com"
            />
          </Field>
          <Field label="Teléfono (WhatsApp)">
            <input
              type="tel"
              value={form.telefono}
              onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
              placeholder="Ej. +525512345678"
            />
          </Field>

          <div style={{
            background: "rgba(46,92,184,0.08)", border: "1px solid rgba(46,92,184,0.15)",
            borderRadius: 10, padding: "11px 14px",
            fontSize: 12, color: C.muted, marginBottom: 20, lineHeight: 1.6
          }}>
            📧 El colaborador recibirá un email de invitación para crear su contraseña.
            Solo tendrá acceso a <strong style={{ color: C.text }}>Clientes</strong> y{" "}
            <strong style={{ color: C.text }}>Agenda</strong> — sin acceso a información clínica.
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn outline color={C.muted} onClick={() => setShowInvite(false)}>Cancelar</Btn>
            <Btn grad onClick={invite} disabled={saving}>
              {saving ? "Enviando invitación…" : "Invitar colaborador"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
