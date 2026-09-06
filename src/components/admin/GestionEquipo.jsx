import { useState, useEffect, useCallback } from "react";
import { Users, AlertCircle, CheckCircle2, XCircle, Folder, MessageCircle, Edit2, Mail, Loader2, Circle, CircleDashed } from "lucide-react";
import { authInvite, dbGet, dbPatch, getProfileId } from "../../lib/supabase";

// ─── GestionEquipo ──────────────────────────────────────────────────────────
// Permite que un nutriólogo invite y gestione a su personal administrativo.
// El administrativo queda ligado al nutriologo_id del creador.
// ────────────────────────────────────────────────────────────────────────────

export function GestionEquipo({ setMsg, profileId, isSuperadmin }) {
  const [equipo, setEquipo]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ nombre: "", email: "", telefono: "" });
  const [editUser, setEditUser]     = useState(null);
  const [editForm, setEditForm]     = useState({ nombre: "", telefono: "" });

  const myId = profileId || getProfileId();
  const roleTarget = isSuperadmin ? "staff" : "administrativo";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await dbGet(
        `profiles?role=eq.${roleTarget}&nutriologo_id=eq.${myId}&select=id,nombre,email,telefono,activo&order=nombre.asc`
      );
      setEquipo(rows);
    } catch { }
    setLoading(false);
  }, [myId, roleTarget]);

  useEffect(() => { load(); }, [load]);

  const invite = async () => {
    if (!form.email || !form.nombre) {
      setMsg("⚠️ Nombre y email son obligatorios");
      return;
    }
    setSaving(true);
    try {
      await authInvite(form.email, {
        role: roleTarget,
        nombre: form.nombre,
        telefono: form.telefono,
        nutriologo_id: myId,
      });
      setMsg(`✅ Invitación enviada — el ${roleTarget === 'staff' ? 'staff' : 'administrativo'} recibirá un email para crear su contraseña`);
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

  const saveEdit = async () => {
    setSaving(true);
    try {
      await dbPatch(`profiles?id=eq.${editUser.id}`, { nombre: editForm.nombre, telefono: editForm.telefono });
      setMsg("✅ Colaborador actualizado");
      setEditUser(null);
      load();
    } catch (e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <div>
          <h2 className="font-['Rajdhani'] font-bold text-2xl text-[#0B1929] tracking-[0.5px] flex items-center gap-2">
            <Users className="w-6 h-6 text-[#3B82F6]" /> Equipo Administrativo
          </h2>
          <div className="text-sm text-[#6B7A8D] mt-0.5">
            {equipo.length} colaborador{equipo.length !== 1 ? "es" : ""} registrado{equipo.length !== 1 ? "s" : ""}
          </div>
        </div>
        <button 
          onClick={() => setShowInvite(true)}
          className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-sm text-sm"
        >
          + Invitar colaborador
        </button>
      </div>

      {/* Explicación */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-5 py-3.5 text-sm text-[#6B7A8D] mb-6 leading-relaxed">
        <strong className="text-[#0B1929]">¿Qué puede hacer un colaborador?</strong><br />
        Tiene acceso únicamente a la lista de clientes y a la gestión de citas.
        <strong className="text-[#0B1929]"> No puede</strong> ver ni editar dietas, rutinas ni la biblioteca.
        Puedes suspender su acceso en cualquier momento.
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-16 text-[#6B7A8D] flex flex-col items-center">
          <Loader2 className="w-9 h-9 text-[#3B82F6] animate-spin mb-3.5" />
          Cargando equipo…
        </div>
      ) : equipo.length === 0 ? (
        <div className="text-center py-20 text-[#6B7A8D] bg-white rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col items-center">
          <Folder className="w-12 h-12 text-[#94A3B8] mb-4" />
          <div className="text-base font-semibold mb-2 text-[#0B1929]">Sin colaboradores aún</div>
          <div className="text-sm">Invita a tu primer secretario o administrativo para comenzar</div>
          <div className="mt-5">
            <button 
              onClick={() => setShowInvite(true)}
              className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-sm text-sm"
            >
              + Invitar primer colaborador
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {equipo.map((p, i) => (
            <div key={p.id} className="animate-in bg-white rounded-xl border border-[#E2E8F0] p-4 flex items-center justify-between flex-wrap gap-3 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow" style={{ animationDelay: `${i * 0.05}s` }}>
              {/* Barra lateral de estado */}
              <div className={`absolute left-0 top-[15%] bottom-[15%] w-1 rounded-r-md ${p.activo !== false ? 'bg-gradient-to-b from-[#38bdf8] to-[#818cf8]' : 'bg-[#EF4444]'}`} />

              {/* Info */}
              <div className="pl-3.5">
                <div className="font-bold text-[15px] text-[#0B1929] mb-1 font-['Space_Grotesk']">
                  {p.nombre || "—"}
                </div>
                <div className="text-xs text-[#6B7A8D] flex items-center gap-2.5 flex-wrap">
                  {p.email || "Sin email"}
                  {p.telefono && (
                    <a
                      href={`https://wa.me/${p.telefono.replace(/\D/g, "")}`}
                      target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-[#22c55e] no-underline font-semibold inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                  )}
                </div>
                <div className="mt-1.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${p.activo !== false ? 'bg-[#EFF6FF] text-[#3B82F6]' : 'bg-[#FEF2F2] text-[#EF4444]'}`}>
                    {p.activo !== false ? <Circle className="w-3 h-3 fill-current" /> : <CircleDashed className="w-3 h-3" />}
                    {p.activo !== false ? "Activo" : "Suspendido"}
                  </span>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-2 items-center flex-wrap">
                <button 
                  onClick={() => {
                    setEditUser(p);
                    setEditForm({ nombre: p.nombre || "", telefono: p.telefono || "" });
                  }}
                  className="px-3 py-1.5 text-xs font-medium border border-[#E2E8F0] text-[#6B7A8D] rounded-lg hover:bg-[#F8FAFC] transition-colors flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </button>
                <button
                  onClick={() => toggleActivo(p)}
                  className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors flex items-center gap-1.5 ${p.activo !== false ? 'border-[#FEE2E2] text-[#EF4444] hover:bg-[#FEF2F2]' : 'border-[#E0E7FF] text-[#4F46E5] hover:bg-[#EEF2FF]'}`}
                >
                  {p.activo !== false ? "Suspender acceso" : "Activar acceso"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Invitar */}
      {showInvite && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-[#0B1929] flex items-center gap-2">
                <Folder className="w-5 h-5 text-[#3B82F6]" /> Invitar colaborador
              </h3>
              <button onClick={() => setShowInvite(false)} className="text-[#94A3B8] hover:text-[#0B1929] transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-[#475569] mb-1">Nombre completo</label>
                <input
                  value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej. Sofía López"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0B1929] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all placeholder-[#94A3B8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#475569] mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="sofia@clinica.com"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0B1929] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all placeholder-[#94A3B8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#475569] mb-1">Teléfono (WhatsApp)</label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
                  placeholder="Ej. +525512345678"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0B1929] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all placeholder-[#94A3B8]"
                />
              </div>

              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3 text-xs text-[#6B7A8D] leading-relaxed mt-2 flex gap-2">
                <Mail className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
                <span>
                  El colaborador recibirá un email de invitación para crear su contraseña.
                  {isSuperadmin ? (
                    <>
                      {" "}Solo tendrá acceso a <strong className="text-[#0B1929]">Directorio</strong>,{" "}
                      <strong className="text-[#0B1929]">Biblioteca</strong> y <strong className="text-[#0B1929]">Tienda</strong>.
                    </>
                  ) : (
                    <>
                      {" "}Solo tendrá acceso a <strong className="text-[#0B1929]">Clientes</strong> y{" "}
                      <strong className="text-[#0B1929]">Agenda</strong> — sin acceso a información clínica.
                    </>
                  )}
                </span>
              </div>

              <div className="flex gap-2 justify-end mt-2">
                <button 
                  onClick={() => setShowInvite(false)}
                  className="px-4 py-2 text-sm font-medium border border-[#E2E8F0] text-[#6B7A8D] rounded-lg hover:bg-[#F8FAFC] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={invite} 
                  disabled={saving}
                  className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? "Enviando invitación…" : "Invitar colaborador"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {editUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-[#0B1929] flex items-center gap-2 truncate">
                <Edit2 className="w-5 h-5 text-[#3B82F6]" /> Editar colaborador
              </h3>
              <button onClick={() => setEditUser(null)} className="text-[#94A3B8] hover:text-[#0B1929] transition-colors shrink-0">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="text-sm text-[#6B7A8D] mb-4 truncate">{editUser.email}</div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-[#475569] mb-1">Nombre completo</label>
                <input
                  value={editForm.nombre}
                  onChange={e => setEditForm(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0B1929] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all placeholder-[#94A3B8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#475569] mb-1">Teléfono (WhatsApp)</label>
                <input
                  type="tel"
                  value={editForm.telefono}
                  onChange={e => setEditForm(p => ({ ...p, telefono: e.target.value }))}
                  placeholder="Ej. +525512345678"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0B1929] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all placeholder-[#94A3B8]"
                />
              </div>
              <div className="flex gap-2 justify-end mt-2">
                <button 
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 text-sm font-medium border border-[#E2E8F0] text-[#6B7A8D] rounded-lg hover:bg-[#F8FAFC] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={saveEdit} 
                  disabled={saving}
                  className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
