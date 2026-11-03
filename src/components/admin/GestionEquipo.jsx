import { useBrand } from "../BrandContext";
import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Users, AlertCircle, CheckCircle2, XCircle, Folder, MessageCircle, Mail, 
  Loader2, Circle, CircleDashed, Trash2, Crown, ChevronRight, ArrowLeft, 
  Check, Shield, Plus, Sparkles, Building2, Briefcase, Lock, UserCheck
} from "lucide-react";
import { 
  authInvite, authResetPassword, dbPeek, dbGet, dbGetFresh, dbPost, 
  dbPatch, getProfileId, updateQueryCache, invalidateCache 
} from "../../lib/supabase";
import { useBackButton } from "../../lib/backButtonHandler";
import { getLatestConfiguredRates } from "../../utils/tarifas";

// ─── ROLES PREDETERMINADOS CORPORATIVOS (FLUX STAFF) ─────────────────────────
export const DEFAULT_STAFF_ROLES = [
  {
    id: "staff_general",
    nombre: "Staff Corporativo (General)",
    departamento: "Operaciones",
    descripcion: "Acceso estándar a operaciones diarias, directorio general, biblioteca y tienda.",
    modulos: ["directorio", "biblioteca", "tienda"],
    colorBadge: "bg-blue-50 text-blue-700 border-blue-200"
  },
  {
    id: "staff_ventas",
    nombre: "Ventas y Afiliaciones",
    departamento: "Comercial",
    descripcion: "Prospección, validación de solicitudes profesionales de especialistas y tienda.",
    modulos: ["directorio", "aprobaciones", "tienda"],
    colorBadge: "bg-emerald-50 text-emerald-700 border-emerald-200"
  },
  {
    id: "staff_finanzas",
    nombre: "Finanzas y Liquidaciones",
    departamento: "Administración",
    descripcion: "Auditoría financiera, control de recibos, tarifas vigentes y comisiones.",
    modulos: ["pagos", "directorio"],
    colorBadge: "bg-purple-50 text-purple-700 border-purple-200"
  },
  {
    id: "staff_marketing",
    nombre: "Marketing y Catálogo",
    departamento: "Marketing",
    descripcion: "Gestión de catálogo de suplementos, promociones de tienda y biblioteca visual.",
    modulos: ["tienda", "biblioteca"],
    colorBadge: "bg-amber-50 text-amber-700 border-amber-200"
  },
  {
    id: "staff_soporte",
    nombre: "Soporte y Operaciones",
    departamento: "Atención a Usuarios",
    descripcion: "Resolución de incidencias, altas asistidas y validación de especialistas.",
    modulos: ["directorio", "aprobaciones"],
    colorBadge: "bg-cyan-50 text-cyan-700 border-cyan-200"
  }
];

export const MODULOS_DISPONIBLES = [
  { id: "directorio",   nombre: "Directorio General",  desc: "Especialistas y atletas" },
  { id: "aprobaciones", nombre: "Aprobaciones",        desc: "Solicitudes de registro" },
  { id: "pagos",        nombre: "Auditoría Financiera", desc: "Pagos y comisiones" },
  { id: "tienda",       nombre: "Tienda Oficial",      desc: "Productos y suplementos" },
  { id: "biblioteca",   nombre: "Biblioteca Ejercicios", desc: "Catálogo de movimientos" }
];

// ─── GestionEquipo ──────────────────────────────────────────────────────────
export function GestionEquipo({ setMsg, profileId, isSuperadmin, role }) {
  const myId = profileId || getProfileId();
  const _peekRows = dbPeek("profiles?select=id,nombre,email,telefono,activo,role,nutriologo_id,especialidad&order=nombre.asc");
  const [equipo, setEquipo]         = useState(() =>
    Array.isArray(_peekRows)
      ? _peekRows.filter(r => (r.role === "administrativo" && r.nutriologo_id === myId) || (isSuperadmin && r.role === "staff"))
      : []
  );
  const [loading, setLoading]       = useState(() => _peekRows === null);
  const hasLoadedRef                = useRef(_peekRows !== null);

  // Subpestañas principales (solo visibles para Superadmin): 'colaboradores' | 'roles'
  const [activeSubTab, setActiveSubTab] = useState("colaboradores");

  // Edición Inline de Colaborador (Al hacer clic en la tarjeta)
  const [editUser, setEditUser]     = useState(null);
  const [editForm, setEditForm]     = useState({ nombre: "", telefono: "", roleAssigned: "staff_general" });
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");

  // Invitación
  const [showInvite, setShowInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState("staff_general");
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ nombre: "", email: "", telefono: "" });
  
  // Interceptor State
  const [conflictUser, setConflictUser] = useState(null);

  // Premium patrocinado (administrativos)
  const isEstudiante = role === "nutriologo_estudiante";
  const [patrocinios, setPatrocinios] = useState({}); // miembro_profile_id -> registro activo
  const [tarifaAdmin, setTarifaAdmin] = useState(50);
  const [confirmPremium, setConfirmPremium] = useState(null); // { miembro, activar }

  // Generador de Roles (Superadmin)
  const [customRoles, setCustomRoles] = useState(() => {
    try {
      const saved = localStorage.getItem("flux_staff_custom_roles");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showNewRoleModal, setShowNewRoleModal] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState({
    nombre: "",
    departamento: "",
    descripcion: "",
    modulos: ["directorio"]
  });

  const allStaffRoles = [...DEFAULT_STAFF_ROLES, ...customRoles];

  // Manejador de botón atrás (Capacitor y navegador)
  useBackButton(!!showConfirmDelete, () => { setShowConfirmDelete(false); setConfirmDeleteText(""); }, 40);
  useBackButton(!!conflictUser, () => setConflictUser(null), 35);
  useBackButton(!!confirmPremium, () => setConfirmPremium(null), 30);
  useBackButton(showInvite, () => setShowInvite(false), 25);
  useBackButton(showNewRoleModal, () => setShowNewRoleModal(false), 25);
  useBackButton(!!editUser, () => { setEditUser(null); setShowConfirmDelete(false); setConfirmDeleteText(""); }, 20);

  const load = useCallback(async ({ forceFresh = false } = {}) => {
    if (!hasLoadedRef.current) setLoading(true);
    const fetcher = forceFresh ? dbGetFresh : dbGet;
    try {
      const rows = await fetcher(`profiles?select=id,nombre,email,telefono,activo,role,nutriologo_id,especialidad&order=nombre.asc`);
      const myTeam = rows.filter(r => 
        (r.role === "administrativo" && r.nutriologo_id === myId) || 
        (isSuperadmin && r.role === "staff")
      );
      setEquipo(myTeam);

      // Patrocinios premium activos + tarifa vigente (solo aplica a nutriólogos)
      if (!isSuperadmin) {
        try {
          const [pats, cfg] = await Promise.all([
            fetcher(`premium_patrocinado?patrocinador_id=eq.${myId}&desactivado_en=is.null`),
            fetcher("configuracion_plataforma?id=eq.1")
          ]);
          const m = {};
          (pats || []).forEach(x => { m[x.miembro_profile_id] = x; });
          setPatrocinios(m);
          if (cfg && cfg.length > 0) setTarifaAdmin(getLatestConfiguredRates(cfg[0]).admin_premium);
        } catch { }
      }
    } catch { }
    hasLoadedRef.current = true;
    setLoading(false);
  }, [myId, isSuperadmin]);

  useEffect(() => {
    load();
    let timer = null;
    const onCacheUpdated = (ev) => {
      const table = ev?.detail?.table;
      if (table && !["profiles", "*"].includes(table)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => load(), 250);
    };
    window.addEventListener("flux:cache-updated", onCacheUpdated);
    window.addEventListener("flux:synced", onCacheUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("flux:cache-updated", onCacheUpdated);
      window.removeEventListener("flux:synced", onCacheUpdated);
    };
  }, [load]);

  // Abrir vista completa de edición al interactuar con la tarjeta del colaborador
  const openEdit = (collaborator) => {
    setEditUser(collaborator);
    setEditForm({
      nombre: collaborator.nombre || "",
      telefono: collaborator.telefono || "",
      roleAssigned: collaborator.especialidad || "staff_general"
    });
    setShowConfirmDelete(false);
    setConfirmDeleteText("");
  };

  const closeEdit = () => {
    setEditUser(null);
    setShowConfirmDelete(false);
    setConfirmDeleteText("");
  };

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
      
      const patchData = {
        nutriologo_id: myId,
        role: targetRole
      };
      if (isSuperadmin) {
        patchData.especialidad = inviteRole;
      }

      await dbPatch(`profiles?id=eq.${authUser.id}`, patchData);

      setMsg(`✅ Invitación enviada — el ${isSuperadmin ? 'colaborador de staff' : 'administrativo'} recibirá un correo para crear su contraseña`);
      setShowInvite(false);
      setForm({ nombre: "", email: "", telefono: "" });
      setTimeout(load, 1000);
    } catch (e) { 
      if (e.message?.includes("already been registered")) {
        try {
          await authResetPassword(cleanEmail);
          setMsg("⚠️ El correo ya existía; se le envió un enlace para configurar su contraseña.");
        } catch {
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
      setMsg(`✅ Enlace de acceso enviado a ${emailToSend}`);
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
      
      const finalNombre = useNewData ? conflictUser.typedData.nombre : (p?.nombre || c?.nombre || conflictUser.typedData.nombre);
      const finalTelefono = useNewData ? conflictUser.typedData.telefono : (p?.telefono || c?.telefono || conflictUser.typedData.telefono);
      const newRole = isSuperadmin ? "staff" : "administrativo";

      const payload = {
        role: newRole,
        nutriologo_id: myId,
        nombre: finalNombre,
        telefono: finalTelefono,
        activo: true
      };
      if (isSuperadmin) payload.especialidad = inviteRole;

      if (p) {
        await dbPatch(`profiles?id=eq.${p.id}`, payload);
      } else if (targetId) {
        await dbPost("profiles", {
          id: targetId,
          email: conflictUser.email,
          ...payload
        });
      }

      if (c && useNewData) {
        await dbPatch(`clientes?id=eq.${c.id}`, {
          nombre: finalNombre,
          telefono: finalTelefono
        });
      }

      setMsg(`✅ Permisos otorgados exitosamente. El colaborador podrá acceder de inmediato.`);
      setConflictUser(null);
      setForm({ nombre: "", email: "", telefono: "" });
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

  const toggleActivoFromEdit = async () => {
    if (!editUser) return;
    const nextActivo = !editUser.activo;
    setEditUser(prev => ({ ...prev, activo: nextActivo }));
    setEquipo(prev => prev.map(item => item.id === editUser.id ? { ...item, activo: nextActivo } : item));
    updateQueryCache("profiles", (list) => Array.isArray(list) ? list.map(item => item.id === editUser.id ? { ...item, activo: nextActivo } : item) : list);
    setMsg(nextActivo ? "🟢 Acceso reactivado para este colaborador" : "🔴 Acceso suspendido para este colaborador");
    try {
      await dbPatch(`profiles?id=eq.${editUser.id}`, { activo: nextActivo });
      invalidateCache("profiles");
    } catch (e) {
      setMsg("❌ " + e.message);
      load({ forceFresh: true });
    }
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    const targetId = editUser.id;
    const { nombre, telefono, roleAssigned } = editForm;

    setEquipo(prev => prev.map(item => item.id === targetId ? { 
      ...item, 
      nombre, 
      telefono, 
      especialidad: isSuperadmin ? roleAssigned : item.especialidad 
    } : item));

    setMsg("✅ Colaborador actualizado con éxito.");
    closeEdit();

    try {
      const patchData = { nombre, telefono };
      if (isSuperadmin && roleAssigned) {
        patchData.especialidad = roleAssigned;
      }
      await dbPatch(`profiles?id=eq.${targetId}`, patchData);
      invalidateCache("profiles");
      load({ forceFresh: true });
    } catch (e) {
      setMsg("❌ " + e.message);
      load({ forceFresh: true });
    }
    setSaving(false);
  };

  const deleteCollaborator = async () => {
    if (confirmDeleteText !== "ELIMINAR" || !editUser) return;
    const targetId = editUser.id;
    const prevEquipo = equipo;

    setEquipo(prev => prev.filter(c => c.id !== targetId));
    closeEdit();
    updateQueryCache("profiles", (list) => Array.isArray(list) ? list.filter(p => p.id !== targetId) : list);
    invalidateCache("profiles");
    setMsg("✅ Colaborador eliminado del equipo permanentemente.");

    setSaving(true);
    try {
      try {
        await dbPost("rpc/eliminar_colaborador_definitivo", { p_profile_id: targetId });
      } catch {
        // Fallback: revocar rol y desvincular sin borrar cuenta de atleta/civil
        await dbPatch(`profiles?id=eq.${targetId}`, {
          role: "cliente",
          nutriologo_id: null,
          especialidad: null,
          activo: true
        });
      }
      load({ forceFresh: true });
    } catch (e) {
      setEquipo(prevEquipo);
      setMsg("❌ Error eliminando colaborador: " + e.message);
    }
    setSaving(false);
  };

  // Crear un rol personalizado (Superadmin)
  const handleCreateCustomRole = () => {
    const cleanNombre = (newRoleForm.nombre || "").trim();
    if (!cleanNombre) {
      setMsg("⚠️ El nombre del rol es obligatorio");
      return;
    }
    const newId = "custom_" + cleanNombre.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now().toString(36);
    const newRole = {
      id: newId,
      nombre: cleanNombre,
      departamento: newRoleForm.departamento.trim() || "Corporativo",
      descripcion: newRoleForm.descripcion.trim() || "Rol personalizado creado por Superadmin",
      modulos: newRoleForm.modulos.length > 0 ? newRoleForm.modulos : ["directorio"],
      colorBadge: "bg-indigo-50 text-indigo-700 border-indigo-200"
    };

    const updated = [...customRoles, newRole];
    setCustomRoles(updated);
    try {
      localStorage.setItem("flux_staff_custom_roles", JSON.stringify(updated));
    } catch {}

    setMsg(`✅ Rol "${cleanNombre}" creado y disponible para asignación`);
    setShowNewRoleModal(false);
    setNewRoleForm({ nombre: "", departamento: "", descripcion: "", modulos: ["directorio"] });
  };

  const handleDeleteCustomRole = (roleId) => {
    const updated = customRoles.filter(r => r.id !== roleId);
    setCustomRoles(updated);
    try {
      localStorage.setItem("flux_staff_custom_roles", JSON.stringify(updated));
    } catch {}
    setMsg("✓ Rol personalizado eliminado.");
  };

  const getRoleInfo = (roleKey) => {
    return allStaffRoles.find(r => r.id === roleKey) || DEFAULT_STAFF_ROLES[0];
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA SUB-PÁGINA COMPLETA: EDITAR COLABORADOR (REEMPLAZA TODA LA PESTAÑA)
  // ═══════════════════════════════════════════════════════════════════════════
  if (editUser) {
    const assignedRoleInfo = isSuperadmin ? getRoleInfo(editForm.roleAssigned) : null;

    return (
      <div className="flex-1 flex flex-col w-full pb-28 md:pb-12 animate-in fade-in duration-200 px-4 md:px-0">
        {/* Cabecera de la ficha del colaborador */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-6 mb-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={closeEdit}
                className="w-10 h-10 rounded-xl bg-[#F0F4FA] hover:bg-[#E2E8F0] text-[#0B1929] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Volver a lista de colaboradores"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg md:text-xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
                    {editForm.nombre || editUser.nombre || "Colaborador"}
                  </h2>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${editUser.activo !== false ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]' : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2]'}`}>
                    {editUser.activo !== false ? <Circle className="w-2.5 h-2.5 fill-current" /> : <CircleDashed className="w-2.5 h-2.5" />}
                    {editUser.activo !== false ? "Activo" : "Suspendido"}
                  </span>
                  {isSuperadmin && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${assignedRoleInfo?.colorBadge || 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                      <Shield size={12} />
                      {assignedRoleInfo?.nombre || "Staff Corporativo"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#6B7A8D] mt-0.5">{editUser.email}</p>
              </div>
            </div>

            {/* Botón Guardar en cabecera */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={closeEdit}
                className="px-4 py-2 rounded-xl text-xs md:text-sm font-semibold text-[#6B7A8D] hover:bg-[#F0F4FA] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="flex items-center gap-1.5 bg-[var(--brand-primary)] text-white px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold shadow-2xs hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.5} />}
                <span>{saving ? "Guardando..." : "Guardar cambios"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tarjetas del Formulario */}
        <div className="space-y-4 md:space-y-5">
          {/* Tarjeta 1: Información Personal y de Contacto */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-6 shadow-2xs">
            <h3 className="text-sm font-bold text-[#0B1929] uppercase tracking-wider mb-4 flex items-center gap-2">
              <UserCheck size={16} className="text-[var(--brand-primary)]" />
              Datos de Identidad y Contacto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Nombre Completo</label>
                <input
                  type="text"
                  value={editForm.nombre}
                  onChange={e => setEditForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej. Sofía López"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all placeholder-[#94A3B8]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Teléfono (WhatsApp)</label>
                <input
                  type="tel"
                  value={editForm.telefono}
                  onChange={e => setEditForm(p => ({ ...p, telefono: e.target.value }))}
                  placeholder="Ej. +52 55 1234 5678"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all placeholder-[#94A3B8]"
                />
              </div>

              <div className="md:col-span-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center text-[#6B7A8D] shrink-0">
                    <Mail size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#0B1929]">Correo de Acceso (Credencial)</div>
                    <div className="text-xs text-[#6B7A8D]">{editUser.email || "Sin email registrado"}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => resendCollaboratorAccess(editUser.email)}
                  disabled={saving}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F0F4FA] border border-[#CBD5E1] text-[var(--brand-primary)] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 shadow-2xs"
                >
                  <Mail size={14} /> Reenviar enlace de contraseña
                </button>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Asignación de Rol y Permisos (Especialmente relevante para Superadmin) */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-6 shadow-2xs">
            <h3 className="text-sm font-bold text-[#0B1929] uppercase tracking-wider mb-1 flex items-center gap-2">
              <Shield size={16} className="text-[var(--brand-primary)]" />
              Rol y Permisos en la Empresa
            </h3>
            <p className="text-xs text-[#6B7A8D] mb-4">
              {isSuperadmin 
                ? "Elige las responsabilidades específicas de este colaborador para limitar a qué módulos corporativos tiene acceso."
                : "Como nutriólogo, tu colaborador adquiere el perfil de Administrativo de Clínica para gestionar tus pacientes y agenda."
              }
            </p>

            {isSuperadmin ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allStaffRoles.map(r => {
                    const isSelected = editForm.roleAssigned === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setEditForm(p => ({ ...p, roleAssigned: r.id }))}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected 
                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 ring-2 ring-[var(--brand-primary)]/20 shadow-2xs' 
                            : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${r.colorBadge || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                              {r.departamento || "Corporativo"}
                            </span>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white' : 'border-[#CBD5E1]'}`}>
                              {isSelected && <Check size={10} strokeWidth={3} />}
                            </div>
                          </div>
                          <div className="text-sm font-bold text-[#0B1929] mb-1">{r.nombre}</div>
                          <p className="text-[11px] text-[#6B7A8D] leading-relaxed line-clamp-2 mb-2">{r.descripcion}</p>
                        </div>

                        <div className="pt-2 border-t border-[#E2E8F0]/70 flex flex-wrap gap-1">
                          {(r.modulos || []).map(mod => {
                            const modInfo = MODULOS_DISPONIBLES.find(m => m.id === mod);
                            return (
                              <span key={mod} className="text-[10px] font-semibold bg-[#F0F4FA] text-[#475569] px-1.5 py-0.5 rounded">
                                {modInfo?.nombre || mod}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-[#F8FAFC] border border-[#BFDBFE] rounded-xl p-4 text-xs text-[#6B7A8D] leading-relaxed flex items-start gap-3">
                <Briefcase size={18} className="text-[var(--brand-primary)] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#0B1929] block text-sm mb-1">Administrativo de Clínica</strong>
                  Tu colaborador tiene acceso exclusivo a la lista de pacientes y a la gestión de citas en tu agenda.
                  Por privacidad médica y confidencialidad, <strong>no tiene acceso</strong> a los expedientes clínicos, dietas, rutinas ni métricas privadas.
                </div>
              </div>
            )}
          </div>

          {/* Tarjeta 3: Estado de la Cuenta y Suspender Acceso */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-6 shadow-2xs">
            <h3 className="text-sm font-bold text-[#0B1929] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Lock size={16} className="text-[var(--brand-primary)]" />
              Estado y Control de Acceso
            </h3>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${editUser.activo !== false ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`}></span>
                  <span className="text-sm font-bold text-[#0B1929]">
                    {editUser.activo !== false ? "Acceso al Sistema Habilitado" : "Acceso al Sistema Suspendido"}
                  </span>
                </div>
                <p className="text-xs text-[#6B7A8D] leading-relaxed max-w-xl">
                  {editUser.activo !== false
                    ? "El colaborador puede iniciar sesión, ver sus módulos asignados y colaborar activamente. Si suspendes el acceso, su sesión se bloqueará de inmediato."
                    : "El colaborador no puede ingresar a la plataforma hasta que reactives su acceso. Su información y registros se mantienen intactos."
                  }
                </p>
              </div>

              <button
                type="button"
                onClick={toggleActivoFromEdit}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs ${
                  editUser.activo !== false
                    ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                }`}
              >
                {editUser.activo !== false ? <CircleDashed size={14} /> : <CheckCircle2 size={14} />}
                <span>{editUser.activo !== false ? "Suspender acceso" : "Reactivar acceso"}</span>
              </button>
            </div>

            {/* Premium Patrocinado para Nutriólogos */}
            {!isSuperadmin && editUser.role === "administrativo" && (
              <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                    <Crown size={15} className="text-amber-500 shrink-0" />
                    Beneficio de Atleta Premium
                  </div>
                  <p className="text-[11px] text-[#6B7A8D]">
                    Otorga una cuenta de Atleta Independiente Premium a tu administrativo para sus propios entrenamientos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmPremium({ miembro: editUser, activar: !patrocinios[editUser.id] })}
                  className={`px-3.5 py-2 text-xs font-bold border rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                    patrocinios[editUser.id] 
                      ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" 
                      : "border-[#CBD5E1] text-[#6B7A8D] bg-white hover:bg-[#F8FAFC]"
                  }`}
                >
                  <Crown size={14} />
                  {patrocinios[editUser.id] ? "Quitar Premium" : "Otorgar Premium"}
                </button>
              </div>
            )}
          </div>

          {/* Tarjeta 4: Zona de Peligro (Eliminar Colaborador Homologado en el Cuerpo) */}
          <div className="bg-white rounded-2xl border border-red-100 p-4 md:p-6 shadow-2xs">
            {showConfirmDelete ? (
              <div className="bg-red-50/90 border border-red-200 p-4 rounded-xl animate-in fade-in">
                <p className="text-red-700 text-xs font-bold mb-2">
                  Esta acción revocará de forma permanente el acceso de este colaborador. Si el usuario cuenta con cuenta de atleta o paciente civil independiente, esa cuenta personal se conservará intacta.
                  Escribe la palabra <strong>ELIMINAR</strong> para confirmar.
                </p>
                <input 
                  value={confirmDeleteText}
                  onChange={e => setConfirmDeleteText(e.target.value)}
                  placeholder="ELIMINAR"
                  className="w-full bg-white border border-red-200 text-red-900 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-red-500 mb-2.5"
                />
                <div className="flex justify-end gap-2">
                  <button 
                    type="button"
                    onClick={() => { setShowConfirmDelete(false); setConfirmDeleteText(""); }} 
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#6B7A8D] hover:bg-white transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button"
                    onClick={deleteCollaborator} 
                    disabled={confirmDeleteText !== "ELIMINAR" || saving} 
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {saving ? "Eliminando..." : "Eliminar Definitivamente"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                    <Trash2 size={14} className="text-red-500 shrink-0" />
                    Eliminar colaborador del equipo
                  </h4>
                  <p className="text-[11px] text-[#6B7A8D] leading-relaxed">
                    Revoca el rol de colaborador y lo desvincula de la clínica o empresa permanentemente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={13} />
                  Eliminar colaborador
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA PRINCIPAL: LISTA DE COLABORADORES O GENERADOR DE ROLES
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="pb-28 md:pb-8">
      {/* Top action bar */}
      <div className="flex justify-between items-center mb-4 md:mb-5 flex-wrap gap-3 px-4 pt-3 md:px-0 md:pt-0">
        {/* Selector de subpestañas para Superadmin */}
        {isSuperadmin ? (
          <div className="flex items-center gap-2 bg-[#E2E8F0]/60 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSubTab("colaboradores")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "colaboradores" 
                  ? 'bg-white text-[#0B1929] shadow-2xs' 
                  : 'text-[#6B7A8D] hover:text-[#0B1929]'
              }`}
            >
              <Users size={14} />
              Colaboradores ({equipo.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("roles")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "roles" 
                  ? 'bg-white text-[#0B1929] shadow-2xs' 
                  : 'text-[#6B7A8D] hover:text-[#0B1929]'
              }`}
            >
              <Shield size={14} />
              Roles y Permisos ({allStaffRoles.length})
            </button>
          </div>
        ) : (
          <div className="text-sm text-[#6B7A8D] font-medium">
            {equipo.length} colaborador{equipo.length !== 1 ? "es" : ""} registrado{equipo.length !== 1 ? "s" : ""}
          </div>
        )}

        <div className="flex items-center gap-2">
          {activeSubTab === "roles" && isSuperadmin ? (
            <button 
              type="button"
              onClick={() => setShowNewRoleModal(true)}
              className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-2xs text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} /> Crear Nuevo Rol
            </button>
          ) : (
            <button 
              type="button"
              onClick={() => setShowInvite(true)}
              className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-2xs text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} /> Invitar colaborador
            </button>
          )}
        </div>
      </div>

      {/* Subpestaña: GENERADOR Y CATÁLOGO DE ROLES (Superadmin) */}
      {isSuperadmin && activeSubTab === "roles" ? (
        <div className="space-y-4 px-4 md:px-0">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-[#0B1929] mb-1 flex items-center gap-2">
              <Sparkles size={16} className="text-[var(--brand-primary)]" />
              Estructura Departamental de FLUX
            </h3>
            <p className="text-xs text-[#6B7A8D] leading-relaxed">
              Configura los perfiles de acceso para que cada equipo corporativo (ventas, finanzas, marketing u operaciones) acceda únicamente a sus herramientas designadas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allStaffRoles.map(r => {
              const colaboradoresEnRol = equipo.filter(c => (c.especialidad || 'staff_general') === r.id);
              const isCustom = r.id.startsWith("custom_");

              return (
                <div key={r.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-2xs flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${r.colorBadge || 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {r.departamento || "Corporativo"}
                      </span>
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomRole(r.id)}
                          className="text-[#94A3B8] hover:text-red-600 transition-colors cursor-pointer"
                          title="Eliminar rol personalizado"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-[#0B1929] mb-1.5">{r.nombre}</h4>
                    <p className="text-xs text-[#6B7A8D] leading-relaxed mb-4">{r.descripcion}</p>

                    <div className="mb-4">
                      <div className="text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Módulos Activos:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(r.modulos || []).map(mId => {
                          const mInfo = MODULOS_DISPONIBLES.find(m => m.id === mId);
                          return (
                            <span key={mId} className="text-[11px] font-semibold bg-[#F0F4FA] text-[#0B1929] px-2 py-0.5 rounded-md border border-[#E2E8F0]">
                              {mInfo?.nombre || mId}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#6B7A8D]">
                    <span>{colaboradoresEnRol.length} colaborador{colaboradoresEnRol.length !== 1 ? 'es' : ''} asignado{colaboradoresEnRol.length !== 1 ? 's' : ''}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSubTab("colaboradores");
                      }}
                      className="text-[var(--brand-primary)] font-bold hover:underline cursor-pointer"
                    >
                      Ver miembros
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Subpestaña: LISTA DE COLABORADORES */
        <>
          {/* Explicación amigable */}
          <div className="hidden md:block bg-[#F8FAFC] border-y md:border border-[#BFDBFE] rounded-none md:rounded-xl px-4 md:px-5 py-3.5 text-sm text-[#6B7A8D] mb-4 md:mb-6 leading-relaxed">
            <strong className="text-[#0B1929]">Gestión de Colaboradores:</strong><br />
            {isSuperadmin 
              ? "Haz clic sobre cualquier tarjeta de empleado para editar sus datos, ajustar su rol departamental o suspender su acceso al sistema." 
              : "Haz clic sobre la tarjeta de tu administrativo para editar sus datos de contacto o gestionar su acceso."
            }
          </div>

          {/* Lista de Colaboradores */}
          {loading ? (
            <div className="text-center py-16 text-[#6B7A8D] flex flex-col items-center">
              <Loader2 className="w-9 h-9 text-[var(--brand-primary)] animate-spin mb-3.5" />
              Cargando equipo…
            </div>
          ) : equipo.length === 0 ? (
            <div className="text-center py-20 text-[#6B7A8D] bg-white rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col items-center mx-4 md:mx-0">
              <Folder className="w-12 h-12 text-[#94A3B8] mb-4" />
              <div className="text-base font-semibold mb-2 text-[#0B1929]">Sin colaboradores aún</div>
              <div className="text-sm">Invita a tu primer colaborador para comenzar a delegar</div>
              <div className="mt-5">
                <button 
                  type="button"
                  onClick={() => setShowInvite(true)}
                  className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm text-sm cursor-pointer"
                >
                  + Invitar primer colaborador
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {equipo.map((p, i) => {
                const assignedRole = isSuperadmin ? getRoleInfo(p.especialidad) : null;

                return (
                  <div 
                    key={p.id} 
                    onClick={() => openEdit(p)}
                    className="animate-in bg-white rounded-none md:rounded-2xl border-y md:border border-[#E2E8F0] p-4 md:p-5 flex items-center justify-between gap-3 relative overflow-hidden shadow-none md:shadow-2xs hover:shadow-md hover:border-[#CBD5E1] transition-all cursor-pointer group"
                    style={{ animationDelay: `${i * 0.04}s` }}
                  >
                    {/* Barra lateral de estado */}
                    <div className={`absolute left-0 top-[15%] bottom-[15%] w-1 rounded-r-md ${p.activo !== false ? 'bg-[var(--brand-primary)]' : 'bg-[#EF4444]'}`} />

                    {/* Información Principal del Empleado */}
                    <div className="pl-3.5 flex items-center gap-3.5 flex-1 min-w-0">
                      {/* Avatar Inicial */}
                      <div className="w-10 h-10 rounded-xl bg-[#F0F4FA] group-hover:bg-[#E2E8F0] border border-[#E2E8F0] flex items-center justify-center font-bold text-sm text-[var(--brand-primary)] shrink-0 transition-colors">
                        {(p.nombre || "C").charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[15px] text-[#0B1929] group-hover:text-[var(--brand-primary)] transition-colors truncate">
                            {p.nombre || "Sin nombre"}
                          </span>

                          {/* Rol corporativo (si es staff) o administrativo */}
                          {isSuperadmin && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${assignedRole?.colorBadge || 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                              <Shield size={11} />
                              {assignedRole?.nombre || "Staff Corporativo"}
                            </span>
                          )}

                          {p.role === "administrativo" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              Administrativo
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-[#6B7A8D] flex items-center gap-3 flex-wrap mt-0.5">
                          <span className="truncate">{p.email || "Sin email"}</span>
                          {p.telefono && (
                            <a
                              href={`https://wa.me/${p.telefono.replace(/\D/g,"")}`}
                              target="_blank" 
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-[#22c55e] no-underline font-semibold inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                            </a>
                          )}
                        </div>

                        {/* Badges de estado */}
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${p.activo !== false ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]' : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2]'}`}>
                            {p.activo !== false ? <Circle className="w-2.5 h-2.5 fill-current" /> : <CircleDashed className="w-2.5 h-2.5" />}
                            {p.activo !== false ? "Activo" : "Suspendido"}
                          </span>
                          
                          {p.role === "staff" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <Crown className="w-3 h-3" /> Premium incluido
                            </span>
                          )}

                          {p.role === "administrativo" && patrocinios[p.id] && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <Crown className="w-3 h-3" /> Premium{patrocinios[p.id].gratis ? " (incluido)" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Flecha indicadora de interacción */}
                    <div className="flex items-center text-[#94A3B8] group-hover:text-[var(--brand-primary)] group-hover:translate-x-0.5 transition-all shrink-0 pr-1">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* MODAL CREAR NUEVO ROL (SUPERADMIN)                                   */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {showNewRoleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0B1929]/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 md:p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#0B1929] flex items-center gap-2">
                <Shield size={18} className="text-[var(--brand-primary)]" />
                Generador de Rol Corporativo
              </h3>
              <button 
                type="button" 
                onClick={() => setShowNewRoleModal(false)}
                className="text-[#94A3B8] hover:text-[#0B1929] transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1">Nombre del Rol</label>
                <input
                  type="text"
                  value={newRoleForm.nombre}
                  onChange={e => setNewRoleForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej. Líder de Afiliaciones"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1">Departamento / Área</label>
                <input
                  type="text"
                  value={newRoleForm.departamento}
                  onChange={e => setNewRoleForm(p => ({ ...p, departamento: e.target.value }))}
                  placeholder="Ej. Comercial o Clínico"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1">Descripción Breve</label>
                <textarea
                  rows={2}
                  value={newRoleForm.descripcion}
                  onChange={e => setNewRoleForm(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Explica qué funciones desempeña este perfil..."
                  className="w-full px-3.5 py-2 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-2">Módulos Habilitados</label>
                <div className="space-y-2">
                  {MODULOS_DISPONIBLES.map(mod => {
                    const isChecked = newRoleForm.modulos.includes(mod.id);
                    return (
                      <div
                        key={mod.id}
                        onClick={() => {
                          setNewRoleForm(p => ({
                            ...p,
                            modulos: isChecked 
                              ? p.modulos.filter(m => m !== mod.id)
                              : [...p.modulos, mod.id]
                          }));
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isChecked 
                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' 
                            : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-[#0B1929]">{mod.nombre}</div>
                          <div className="text-[11px] text-[#6B7A8D]">{mod.desc}</div>
                        </div>
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${isChecked ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white' : 'border-[#CBD5E1]'}`}>
                          {isChecked && <Check size={11} strokeWidth={3} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setShowNewRoleModal(false)}
                  className="px-4 py-2 text-xs font-semibold border border-[#E2E8F0] text-[#6B7A8D] rounded-xl hover:bg-[#F8FAFC]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateCustomRole}
                  className="px-5 py-2 text-xs font-bold bg-[var(--brand-primary)] text-white rounded-xl hover:opacity-90 transition-opacity shadow-2xs"
                >
                  Guardar Rol
                </button>
              </div>
            </div>
          </div>
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
                {confirmPremium.miembro.nombre} volverá al plan Estándar. El cobro se calcula con la misma regla de bajas que tus pacientes.
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
              Nombre: {conflictUser.profile?.nombre || conflictUser.cliente?.nombre || "Sin nombre"}<br/>
              Teléfono: {conflictUser.profile?.telefono || conflictUser.cliente?.telefono || "Sin teléfono"}
            </div>

            <p className="text-[#6B7A8D] text-sm mb-5">
              Al otorgarle permisos de colaborador, el usuario podrá ingresar a este panel usando su <strong>misma contraseña actual</strong>. ¿Qué datos deseas usar para su nuevo rol?
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => resolveConflict(false)}
                disabled={saving}
                className="w-full text-left p-4 rounded-xl border border-[#E2E8F0] hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors flex items-start gap-3 cursor-pointer"
              >
                <div className="w-5 h-5 mt-0.5 rounded-full border-2 border-[var(--brand-primary)] flex items-center justify-center">
                  <div className="w-2.5 h-2.5 bg-[var(--brand-primary)] rounded-full"></div>
                </div>
                <div>
                  <div className="font-bold text-[#0B1929] text-sm">Usar sus datos actuales</div>
                  <div className="text-xs text-[#6B7A8D] mt-1">Vincula su rol usando el nombre y teléfono que ya tenía registrado.</div>
                </div>
              </button>

              <button 
                onClick={() => resolveConflict(true)}
                disabled={saving}
                className="w-full text-left p-4 rounded-xl border border-[#E2E8F0] hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors flex items-start gap-3 cursor-pointer"
              >
                <div className="w-5 h-5 mt-0.5 rounded-full border-2 border-[#E2E8F0] group-hover:border-[var(--brand-primary)] flex items-center justify-center">
                </div>
                <div>
                  <div className="font-bold text-[#0B1929] text-sm">Actualizar todo con los datos nuevos</div>
                  <div className="text-xs text-[#6B7A8D] mt-1">Sobrescribe su nombre y teléfono en todos sus roles usando la nueva información.</div>
                </div>
              </button>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-[#E2E8F0]">
              <button 
                onClick={() => setConflictUser(null)}
                disabled={saving}
                className="px-5 py-2.5 text-sm font-bold border border-[#E2E8F0] text-[#6B7A8D] rounded-xl hover:bg-[#F8FAFC] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Invitar */}
      {showInvite && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-none md:rounded-2xl border-0 md:border border-[#E2E8F0] shadow-xl w-full md:max-w-md h-full max-h-full md:h-auto p-5 md:p-6 overflow-y-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-[#0B1929] flex items-center gap-2">
                <Folder className="w-5 h-5 text-[var(--brand-primary)]" /> Invitar colaborador
              </h3>
              <button onClick={() => setShowInvite(false)} className="text-[#94A3B8] hover:text-[#0B1929] transition-colors cursor-pointer">
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

              {/* Selector de Rol inicial si es Superadmin */}
              {isSuperadmin && (
                <div>
                  <label className="block text-sm font-medium text-[#475569] mb-1">Rol Inicial a Asignar</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] cursor-pointer"
                  >
                    {allStaffRoles.map(r => (
                      <option key={r.id} value={r.id}>{r.nombre} ({r.departamento})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-[#F8FAFC] border border-[#BFDBFE] rounded-lg p-3 text-xs text-[#6B7A8D] leading-relaxed mt-2 flex gap-2">
                <Mail className="w-4 h-4 text-[var(--brand-primary)] shrink-0 mt-0.5" />
                <span>
                  El colaborador recibirá un correo de invitación para configurar su contraseña.
                  {isSuperadmin ? (
                    <>
                      {" "}Se le asignará el rol corporativo seleccionado con sus permisos correspondientes.
                    </>
                  ) : (
                    <>
                      {" "}Solo tendrá acceso a <strong className="text-[#0B1929]">Clientes</strong> y{" "}
                      <strong className="text-[#0B1929]">Agenda</strong> — sin acceso a información clínica confidencial.
                    </>
                  )}
                </span>
              </div>

              <div className="flex gap-2 justify-end mt-2">
                <button 
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="px-4 py-2 text-sm font-medium border border-[#E2E8F0] text-[#6B7A8D] rounded-lg hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={invite} 
                  disabled={saving}
                  className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? "Enviando invitación…" : "Invitar colaborador"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
