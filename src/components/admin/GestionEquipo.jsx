import { useBrand } from "../BrandContext";
import { useState, useEffect, useCallback } from "react";
import { Users, AlertCircle, CheckCircle2, XCircle, Folder, MessageCircle, Edit2, Mail, Loader2, Circle, CircleDashed, Trash2, Crown } from "lucide-react";
import { authInvite, authResetPassword, dbGet, dbPost, dbPatch, getProfileId } from "../../lib/supabase";
import { useBackButton } from "../../lib/backButtonHandler";
import { getLatestConfiguredRates } from "../../utils/tarifas";

// ─── GestionEquipo ──────────────────────────────────────────────────────────
// Permite que un nutriólogo invite y gestione a su personal administrativo.
// El administrativo queda ligado al nutriologo_id del creador.
// ────────────────────────────────────────────────────────────────────────────

export function GestionEquipo({ setMsg, profileId, isSuperadmin, role }) {
  const [equipo, setEquipo]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ nombre:"", email:"", telefono:"" });
  const [editUser, setEditUser]     = useState(null);
  const [editForm, setEditForm]     = useState({ nombre:"", telefono:"" });
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  
  // Interceptor State
  const [conflictUser, setConflictUser] = useState(null);

  // Premium patrocinado (administrativos)
  const isEstudiante = role === "nutriologo_estudiante";
  const [patrocinios, setPatrocinios] = useState({}); // miembro_profile_id -> registro activo
  const [tarifaAdmin, setTarifaAdmin] = useState(50);
  const [confirmPremium, setConfirmPremium] = useState(null); // { miembro, activar }

  useBackButton(!!conflictUser, () => setConflictUser(null), 30);
  useBackButton(showInvite, () => setShowInvite(false), 20);
  useBackButton(!!editUser, () => setEditUser(null), 20);
  useBackButton(!!confirmPremium, () => setConfirmPremium(null), 30);

  const myId = profileId || getProfileId();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await dbGet(`profiles?select=id,nombre,email,telefono,activo,role,nutriologo_id&order=nombre.asc`);
      const myTeam = rows.filter(r => 
        (r.role ==="administrativo" && r.nutriologo_id === myId) || 
        (isSuperadmin && r.role ==="staff")
      );
      setEquipo(myTeam);

      // Patrocinios premium activos + tarifa vigente (solo aplica a nutriólogos)
      if (!isSuperadmin) {
        try {
          const [pats, cfg] = await Promise.all([
            dbGet(`premium_patrocinado?patrocinador_id=eq.${myId}&desactivado_en=is.null`),
            dbGet("configuracion_plataforma?id=eq.1")
          ]);
          const m = {};
          (pats || []).forEach(x => { m[x.miembro_profile_id] = x; });
          setPatrocinios(m);
          if (cfg && cfg.length > 0) setTarifaAdmin(getLatestConfiguredRates(cfg[0]).admin_premium);
        } catch { }
      }
    } catch { }
    setLoading(false);
  }, [myId, isSuperadmin]);

  useEffect(() => { load(); }, [load]);

  const invite = async () => {
    const cleanEmail = (form.email || "").trim().toLowerCase();
    const cleanNombre = (form.nombre || "").trim();
    if (!cleanEmail || !cleanNombre) {
      setMsg("⚠️ Nombre y email son obligatorios");
      return;
    }
    if (isEstudiante && equipo.length >= 1) {
      setMsg("⚠️ Como nutriólogo estudiante solo puedes tener 1 administrativo");
      return;
    }
    setSaving(true);
    try {
      // INTERCEPTOR: Detectar si el correo ya existe
      const existingProfiles = await dbGet(`profiles?email=ilike.${encodeURIComponent(cleanEmail)}`);
      const existingClientes = await dbGet(`clientes?email=ilike.${encodeURIComponent(cleanEmail)}`);
      
      if (existingProfiles.length > 0 || existingClientes.length > 0) {
        setConflictUser({ 
          profile: existingProfiles[0], 
          cliente: existingClientes[0], 
          email: cleanEmail,
          typedData: { nombre: cleanNombre, telefono: form.telefono }
        });
        setShowInvite(false);
        setSaving(false);
        return;
      }

      const targetRole = isSuperadmin ? "staff" : "administrativo";
      const authUser = await authInvite(cleanEmail, {
        role: targetRole,
        nombre: cleanNombre,
        telefono: form.telefono,
        nutriologo_id: myId
      });
      
      // Explicitly update profile to ensure nutriologo_id is linked properly
      await dbPatch(`profiles?id=eq.${authUser.id}`, {
        nutriologo_id: myId,
        role: targetRole
      });

      setMsg(`✅ Invitación enviada — el ${isSuperadmin ? 'staff' : 'administrativo'} recibirá un email para crear su contraseña`);
      setShowInvite(false);
      setForm({ nombre:"", email:"", telefono:"" });
      setTimeout(load, 1000);
    } catch (e) { 
      if (e.message?.includes("already been registered")) {
        try {
          await authResetPassword(cleanEmail);
          setMsg("⚠️ El correo ya existía en Auth; se le envió un enlace para configurar su contraseña.");
        } catch (err) {
          setMsg("❌ Este usuario ya tiene cuenta registrada.");
        }
      } else {
        setMsg("❌ " + e.message); 
      }
    }
    setSaving(false);
  };

  const resendCollaboratorAccess = async (emailToSend) => {
    if (!emailToSend) return;
    setSaving(true);
    try {
      await authResetPassword(emailToSend.trim());
      setMsg(`✅ Enlace de acceso/contraseña enviado a ${emailToSend}`);
    } catch (e) {
      setMsg("❌ " + e.message);
    }
    setSaving(false);
  };

  const resolveConflict = async (useNewData) => {
    if (isEstudiante && equipo.length >= 1) {
      setMsg("⚠️ Como nutriólogo estudiante solo puedes tener 1 administrativo");
      setConflictUser(null);
      return;
    }
    setSaving(true);
    try {
      const p = conflictUser.profile;
      const c = conflictUser.cliente;
      const targetId = p?.id || c?.auth_id;
      
      // Los datos finales a guardar
      const finalNombre = useNewData ? conflictUser.typedData.nombre : (p?.nombre || c?.nombre || conflictUser.typedData.nombre);
      const finalTelefono = useNewData ? conflictUser.typedData.telefono : (p?.telefono || c?.telefono || conflictUser.typedData.telefono);
      const newRole = isSuperadmin ? "staff" : "administrativo";

      // 1. Asegurarnos que exista en profiles y tenga el rol administrativo
      if (p) {
        await dbPatch(`profiles?id=eq.${p.id}`, {
          role: newRole,
          nutriologo_id: myId,
          nombre: finalNombre,
          telefono: finalTelefono,
          activo: true
        });
      } else if (targetId) {
        await dbPost("profiles", {
          id: targetId,
          email: conflictUser.email,
          role: newRole,
          nutriologo_id: myId,
          nombre: finalNombre,
          telefono: finalTelefono,
          activo: true
        });
      }

      // 2. Si existe en clientes, actualizar su información ahí también para sincronizar
      if (c && useNewData) {
        await dbPatch(`clientes?id=eq.${c.id}`, {
          nombre: finalNombre,
          telefono: finalTelefono
        });
      }

      setMsg(`✅ Permisos otorgados exitosamente. Al usuario le aparecerá el Selector de Roles.`);
      setConflictUser(null);
      setForm({ nombre:"", email:"", telefono:"" });
      load();
    } catch (e) {
      setMsg("❌ Error al otorgar accesos: " + e.message);
    }
    setSaving(false);
  };

  const cambiarPremium = async () => {
    if (!confirmPremium) return;
    const { miembro, activar } = confirmPremium;
    setSaving(true);
    try {
      await dbPost(activar ? "rpc/activar_premium_equipo" : "rpc/desactivar_premium_equipo", { p_miembro: miembro.id });
      setMsg(activar
        ? `✅ ${miembro.nombre || "El administrativo"} ahora tiene cuenta Premium de atleta`
        : `Premium retirado a ${miembro.nombre || "el administrativo"}`);
      setConfirmPremium(null);
      load();
    } catch (e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const toggleActivo = async (p) => {
    try {
      await dbPatch(`profiles?id=eq.${p.id}`, { activo: !p.activo });
      setMsg(p.activo ?"🔴 Acceso suspendido" :"🟢 Acceso activado");
      load();
    } catch (e) { setMsg("❌ " + e.message); }
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await dbPatch(`profiles?id=eq.${editUser.id}`, { nombre: editForm.nombre, telefono: editForm.telefono });
      setMsg("✅ Colaborador actualizado");
      setEditUser(null);
      setShowConfirmDelete(false);
      setConfirmDeleteText("");
      load();
    } catch (e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const deleteCollaborator = async () => {
    if (confirmDeleteText !== "ELIMINAR" || !editUser) return;
    setSaving(true);
    try {
      try {
        await dbPost("rpc/eliminar_colaborador_definitivo", { p_profile_id: editUser.id });
      } catch (rpcErr) {
        // Fallback inmediato si aún no se ha corrido el RPC en Supabase: revocar rol y desvincular
        await dbPatch(`profiles?id=eq.${editUser.id}`, {
          role: "cliente",
          nutriologo_id: null,
          activo: true
        });
      }
      setMsg("✅ Colaborador eliminado permanentemente del equipo.");
      setEditUser(null);
      setShowConfirmDelete(false);
      setConfirmDeleteText("");
      load();
    } catch (e) {
      setMsg("❌ Error eliminando colaborador: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div>
      {/* Top action bar */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <div className="text-sm text-[#6B7A8D] font-medium">
          {equipo.length} colaborador{equipo.length !== 1 ? "es" : ""} registrado{equipo.length !== 1 ? "s" : ""}
        </div>
        <button 
          onClick={() => setShowInvite(true)}
          className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm text-sm"
        >
          + Invitar colaborador
        </button>
      </div>

      {/* Explicación */}
      <div className="bg-[#F8FAFC] border border-[#BFDBFE] rounded-xl px-5 py-3.5 text-sm text-[#6B7A8D] mb-6 leading-relaxed">
        <strong className="text-[#0B1929]">¿Qué puede hacer un colaborador?</strong><br />
        {isSuperadmin 
          ? "Tiene acceso al Directorio general, a la Biblioteca de ejercicios, y a la Tienda de suplementos corporativa. " 
          : "Tiene acceso únicamente a la lista de clientes y a la gestión de citas. No puede ver ni editar dietas, rutinas ni la biblioteca. "
        }
        Puedes suspender su acceso en cualquier momento.
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-16 text-[#6B7A8D] flex flex-col items-center">
          <Loader2 className="w-9 h-9 text-[var(--brand-primary)] animate-spin mb-3.5" />
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
              className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm text-sm"
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
              <div className={`absolute left-0 top-[15%] bottom-[15%] w-1 rounded-r-md ${p.activo !== false ? 'bg-[var(--brand-primary)]' : 'bg-[#EF4444]'}`} />

              {/* Info */}
              <div className="pl-3.5">
                <div className="font-bold text-[15px] text-[#0B1929] mb-1">
                  {p.nombre ||"—"}
                </div>
                <div className="text-xs text-[#6B7A8D] flex items-center gap-2.5 flex-wrap">
                  {p.email ||"Sin email"}
                  {p.telefono && (
                    <a
                      href={`https://wa.me/${p.telefono.replace(/\D/g,"")}`}
                      target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-[#22c55e] no-underline font-semibold inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                  )}
                </div>
                <div className="mt-1.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${p.activo !== false ? 'bg-[#F8FAFC] text-[var(--brand-primary)]' : 'bg-[#FEF2F2] text-[#EF4444]'}`}>
                    {p.activo !== false ? <Circle className="w-3 h-3 fill-current" /> : <CircleDashed className="w-3 h-3" />}
                    {p.activo !== false ?"Activo" :"Suspendido"}
                  </span>
                  {p.role === "staff" && (
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">
                      <Crown className="w-3 h-3" /> Premium incluido
                    </span>
                  )}
                  {p.role === "administrativo" && patrocinios[p.id] && (
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">
                      <Crown className="w-3 h-3" /> Premium{patrocinios[p.id].gratis ? " (incluido)" : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-2 items-center flex-wrap">
                {!isSuperadmin && p.role === "administrativo" && (
                  <button
                    onClick={() => setConfirmPremium({ miembro: p, activar: !patrocinios[p.id] })}
                    className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors flex items-center gap-1.5 ${patrocinios[p.id] ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-[#E2E8F0] text-[#6B7A8D] hover:bg-[#F8FAFC]"}`}
                  >
                    <Crown className="w-3.5 h-3.5" /> {patrocinios[p.id] ? "Quitar Premium" : "Dar Premium"}
                  </button>
                )}
                <button 
                  onClick={() => {
                    setEditUser(p);
                    setEditForm({ nombre: p.nombre ||"", telefono: p.telefono ||"" });
                  }}
                  className="px-3 py-1.5 text-xs font-medium border border-[#E2E8F0] text-[#6B7A8D] rounded-lg hover:bg-[#F8FAFC] transition-colors flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </button>
                <button
                  onClick={() => toggleActivo(p)}
                  className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors flex items-center gap-1.5 ${p.activo !== false ? 'border-[#FEE2E2] text-[#EF4444] hover:bg-[#FEF2F2]' : 'border-[#E0E7FF] text-[#4F46E5] hover:bg-[#EEF2FF]'}`}
                >
                  {p.activo !== false ?"Suspender acceso" :"Activar acceso"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal confirmación Premium patrocinado */}
      {confirmPremium && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0B1929]/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-[#0B1929] flex items-center gap-2 mb-3">
              <Crown className="w-5 h-5 text-amber-500" />
              {confirmPremium.activar ? "Activar Premium" : "Quitar Premium"}
            </h3>
            {confirmPremium.activar ? (
              <p className="text-sm text-[#6B7A8D] leading-relaxed mb-5">
                <strong className="text-[#0B1929]">{confirmPremium.miembro.nombre}</strong> tendrá una cuenta Premium de atleta independiente
                (desde "Cambiar Perfil"). {isEstudiante
                  ? <>Como estudiante, este beneficio <strong>no tiene costo</strong> para ti.</>
                  : <>Se agregarán <strong className="text-[#0B1929]">${Number(tarifaAdmin).toFixed(2)} MXN / mes</strong> a tu facturación, prorrateado como tus pacientes.</>}
                {" "}Si tu cuenta tiene un adeudo y se bloquea, el Premium se suspende.
              </p>
            ) : (
              <p className="text-sm text-[#6B7A8D] leading-relaxed mb-5">
                {confirmPremium.miembro.nombre} volverá al plan Estándar. El cobro se calcula con la misma regla de bajas que tus pacientes
                (si llevaba menos de 20 días en el ciclo se factura el mes completo).
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmPremium(null)} disabled={saving}
                className="px-4 py-2 text-sm font-bold border border-[#E2E8F0] text-[#6B7A8D] rounded-xl hover:bg-[#F8FAFC]">Cancelar</button>
              <button onClick={cambiarPremium} disabled={saving}
                className="px-4 py-2 text-sm font-bold bg-[var(--brand-primary)] text-white rounded-xl hover:opacity-90 disabled:opacity-50">
                {saving ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Interceptor (Conflicto de Rol Existente) */}
      {conflictUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0B1929]/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-[#0B1929] flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                Usuario Existente
              </h3>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl text-sm mb-5">
              El correo <strong>{conflictUser.email}</strong> ya está registrado en tu plataforma (posiblemente como paciente).
              <br/><br/>
              <strong>Datos Actuales Registrados:</strong><br/>
              Nombre: {conflictUser.profile?.nombre || conflictUser.cliente?.nombre ||"Sin nombre"}<br/>
              Teléfono: {conflictUser.profile?.telefono || conflictUser.cliente?.telefono ||"Sin teléfono"}
            </div>

            <p className="text-[#6B7A8D] text-sm mb-5">
              Al otorgarle permisos administrativos, el usuario podrá ingresar a este panel usando su <strong>misma contraseña actual</strong>. ¿Qué datos deseas usar para su nuevo rol administrativo?
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => resolveConflict(false)}
                disabled={saving}
                className="w-full text-left p-4 rounded-xl border border-[#E2E8F0] hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors flex items-start gap-3"
              >
                <div className="w-5 h-5 mt-0.5 rounded-full border-2 border-[var(--brand-primary)] flex items-center justify-center">
                  <div className="w-2.5 h-2.5 bg-[var(--brand-primary)] rounded-full"></div>
                </div>
                <div>
                  <div className="font-bold text-[#0B1929] text-sm">Usar sus datos actuales</div>
                  <div className="text-xs text-[#6B7A8D] mt-1">Ignora lo que escribiste y vincula su rol administrativo usando el nombre y teléfono que ya tenía registrado.</div>
                </div>
              </button>

              <button 
                onClick={() => resolveConflict(true)}
                disabled={saving}
                className="w-full text-left p-4 rounded-xl border border-[#E2E8F0] hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors flex items-start gap-3"
              >
                <div className="w-5 h-5 mt-0.5 rounded-full border-2 border-[#E2E8F0] group-hover:border-[var(--brand-primary)] flex items-center justify-center">
                </div>
                <div>
                  <div className="font-bold text-[#0B1929] text-sm">Actualizar todo con los datos nuevos</div>
                  <div className="text-xs text-[#6B7A8D] mt-1">Sobrescribe su nombre y teléfono en todos sus roles usando la nueva información que escribiste.</div>
                </div>
              </button>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-[#E2E8F0]">
              <button 
                onClick={() => setConflictUser(null)}
                disabled={saving}
                className="px-5 py-2.5 text-sm font-bold border border-[#E2E8F0] text-[#6B7A8D] rounded-xl hover:bg-[#F8FAFC] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Invitar */}
      {showInvite && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-[#0B1929] flex items-center gap-2">
                <Folder className="w-5 h-5 text-[var(--brand-primary)]" /> Invitar colaborador
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
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all placeholder-[#94A3B8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#475569] mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="sofia@clinica.com"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all placeholder-[#94A3B8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#475569] mb-1">Teléfono (WhatsApp)</label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
                  placeholder="Ej. +525512345678"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all placeholder-[#94A3B8]"
                />
              </div>

              <div className="bg-[#F8FAFC] border border-[#BFDBFE] rounded-lg p-3 text-xs text-[#6B7A8D] leading-relaxed mt-2 flex gap-2">
                <Mail className="w-4 h-4 text-[var(--brand-primary)] shrink-0 mt-0.5" />
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
                  className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ?"Enviando invitación…" :"Invitar colaborador"}
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
                <Edit2 className="w-5 h-5 text-[var(--brand-primary)]" /> Editar colaborador
              </h3>
              <button onClick={() => { setEditUser(null); setShowConfirmDelete(false); setConfirmDeleteText(""); }} className="text-[#94A3B8] hover:text-[#0B1929] transition-colors shrink-0">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex flex-col gap-4">
              {editUser.email && (
                <div>
                  <label className="block text-sm font-medium text-[#475569] mb-1">Correo de acceso</label>
                  <input
                    type="email"
                    value={editUser.email}
                    readOnly
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-[#0B1929] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => resendCollaboratorAccess(editUser.email)}
                    disabled={saving}
                    className="mt-2 w-full py-2 px-3 rounded-lg bg-[#F0F4FA] hover:bg-[#E2E8F0]/70 border border-[#E2E8F0] text-[var(--brand-primary)] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    📧 Reenviar correo de acceso
                  </button>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-[#475569] mb-1">Nombre completo</label>
                <input
                  value={editForm.nombre}
                  onChange={e => setEditForm(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all placeholder-[#94A3B8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#475569] mb-1">Teléfono (WhatsApp)</label>
                <input
                  type="tel"
                  value={editForm.telefono}
                  onChange={e => setEditForm(p => ({ ...p, telefono: e.target.value }))}
                  placeholder="Ej. +525512345678"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all placeholder-[#94A3B8]"
                />
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] mt-2">
                {showConfirmDelete ? (
                  <div className="bg-red-50 border border-red-100 p-3 rounded-xl">
                    <p className="text-red-700 text-xs font-bold mb-2">
                      Esta acción eliminará su acceso como colaborador de forma permanente. Si tiene otros roles (como paciente o atleta independiente), esos se conservarán intactos.
                      Escribe la palabra <strong>ELIMINAR</strong> para confirmar.
                    </p>
                    <input 
                      value={confirmDeleteText}
                      onChange={e => setConfirmDeleteText(e.target.value)}
                      placeholder="ELIMINAR"
                      className="w-full bg-white border border-red-200 text-red-900 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-red-500 mb-2"
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setShowConfirmDelete(false); setConfirmDeleteText(""); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#6B7A8D] hover:bg-white transition-colors">Cancelar</button>
                      <button onClick={deleteCollaborator} disabled={confirmDeleteText !== "ELIMINAR" || saving} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                        {saving ? "Eliminando..." : "Eliminar Definitivamente"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <button onClick={() => setShowConfirmDelete(true)} className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors flex items-center gap-1">
                      <Trash2 size={14} /> Borrar Colaborador
                    </button>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setEditUser(null); setShowConfirmDelete(false); setConfirmDeleteText(""); }}
                        className="px-4 py-2 text-sm font-medium border border-[#E2E8F0] text-[#6B7A8D] rounded-lg hover:bg-[#F8FAFC] transition-colors"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={saveEdit} 
                        disabled={saving}
                        className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {saving ? "Guardando…" : "Guardar cambios"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
