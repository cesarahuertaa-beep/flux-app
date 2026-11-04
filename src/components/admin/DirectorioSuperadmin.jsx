import { useState, useEffect, useMemo, useRef } from "react";
import { updateProfile, authInvite, authResetPassword, storageUpload, storageListFolder, storageRemoveMany, dbPeek, dbGet, dbGetFresh, dbPost, dbPatch, dbDel, updateQueryCache, invalidateCache } from "../../lib/supabase";
import { 
  User, UserPlus, MessageCircle, Pencil, X, Plus, Mail, ChevronDown, ChevronUp, 
  Users, Search, Target, CheckCircle2, AlertCircle, Dumbbell, Trash2,
  ArrowLeft, Clock, Sparkles, UtensilsCrossed, Phone, CalendarDays, Edit2
} from "lucide-react";
import { ListSkeleton } from "../ui/Skeleton";
import { CustomSelect } from "../ui/CustomSelect";
import BrandColorPicker from "../ui/BrandColorPicker";
import PhotoUploadBox from "../ui/PhotoUploadBox";
import { useBackButton } from "../../lib/backButtonHandler";
import { CachedImage } from "../../lib/mediaCache";
import { calcEdadFromBirthdate } from "../../lib/bodyComposition";
import { peekClinicalRecord } from "../../lib/clinicalRecord";
import { checkAndCleanOrphanedEmail, deleteNutriologoAccount } from "../../lib/authRoles";

const getInitials = (name) => {
  if (!name) return "P";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const sanitizeWhatsAppPhone = (phone) => {
  if (!phone) return "";
  let clean = String(phone).replace(/\D/g, "");
  if (clean.length === 10) clean = "52" + clean;
  return clean;
};

const getWhatsAppUrl = (phone, text) => {
  const cleanPhone = sanitizeWhatsAppPhone(phone);
  if (!cleanPhone) return "";
  if (!text) return `https://wa.me/${cleanPhone}`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
};

const buildWhatsAppMessage = (c, templateType, remitente) => {
  const primerNombre = (c.nombre || "campeón").trim().split(" ")[0];
  const sender = remitente || "tu especialista";

  if (templateType === "cuestionario") {
    const appUrl = typeof window !== "undefined" ? window.location.origin : "https://flux-sport.com";
    return `¡Hola ${primerNombre}! 👋 Te saluda ${sender}. Te recuerdo llenar tu cuestionario inicial en tu app FLUX antes de nuestra cita para tener listo tu plan personalizado: ${appUrl} 💪`;
  }

  if (templateType === "inactividad") {
    return `¡Hola ${primerNombre}! 👋 Te escribe ${sender}. Noté que llevas unos días sin registrar tus comidas o entrenamientos en tu app FLUX. ¿Cómo te has sentido? ¿Se te ha complicado algún ejercicio o comida? Recuerda que estoy aquí para apoyarte y podemos hacer cualquier ajuste que necesites 💪`;
  }

  if (templateType === "renovacion") {
    return `¡Hola ${primerNombre}! 🎯 Te escribe ${sender}. Tu plan actual de entrenamiento y nutrición está por concluir. ¡Muchas felicidades por el esfuerzo y constancia en el proceso! 🚀 ¿Cuándo tienes un espacio para agendar tu cita de valoración y preparar tu siguiente ciclo con nuevos objetivos?`;
  }

  if (templateType === "bienvenida") {
    return `¡Hola ${primerNombre}! 🎉 ¡Te damos la bienvenida a FLUX! Ya tienes activo tu plan. Recuerda entrar a tu app para consultar tus rutinas de entrenamiento y nutrición. Cualquier duda que tengas sobre cómo registrar tus avances, aquí estoy para ayudarte 🙌`;
  }

  return `¡Hola ${primerNombre}! 👋 Te saluda ${sender}. Paso a saludarte y ver cómo vas con tu plan esta semana. ¿Tienes alguna duda con tus entrenamientos o tu alimentación? ¡A seguir con toda la motivación! 💥`;
};

const uploadLogo = async (file) => {
  const ext  = file.name.split(".").pop();
  const fname = `${Date.now()}.${ext}`;
  return await storageUpload("logos", fname, file);
};

const Btn = ({ children, onClick, disabled, small, outline, grad, className = "" }) => {
  let baseClass = "inline-flex items-center justify-center font-medium transition-all duration-200 rounded-lg outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  if (small) baseClass += " px-3 py-1.5 text-xs";
  else baseClass += " px-4 py-2 text-sm";
  
  if (grad) baseClass += " bg-[var(--brand-primary)] text-white hover:opacity-90 border-transparent shadow-sm focus:ring-[var(--brand-primary)]";
  else if (outline) baseClass += " border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-200";
  else baseClass += " bg-[var(--brand-primary)] text-white hover:opacity-90 border-transparent shadow-sm focus:ring-[var(--brand-primary)]";
  
  if (outline && className.includes("text-red-500")) {
    baseClass = baseClass.replace("text-slate-700 hover:bg-slate-50", "text-red-600 hover:bg-red-50 border-red-200");
  }
  
  return <button onClick={onClick} disabled={disabled} className={`${baseClass} ${className}`}>{children}</button>;
};

const Modal = ({ title, onClose, children }) => {
  useBackButton(true, onClose, 20);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-[#0B1929]/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-none md:rounded-2xl shadow-xl border-0 md:border border-[#E2E8F0] w-full md:max-w-md h-full max-h-full md:h-auto overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h3 className="text-lg font-bold text-[#0B1929] flex items-center gap-2">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md text-[#6B7A8D] hover:text-[#0B1929] hover:bg-slate-100 transition-colors"><X size={20} /></button>
        </div>
        <div className="p-5 md:p-6 space-y-4 flex-1 md:max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
    {children}
    {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
  </div>
);

const LogoPicker = ({ value, onChange, onRemove, uploading }) => (
  <div className="mt-1">
    <PhotoUploadBox
      value={value}
      onChange={onChange}
      onRemove={onRemove}
      uploading={uploading}
      label="Subir logo"
      size="sm"
      shape="square"
    />
  </div>
);

export function DirectorioSuperadmin({ myId, clientes, loadClientes, setMsg, setSelected, setTab, setEditClient, toggleActivo }) {
  const _peekNutris = dbPeek("profiles?role=in.(nutriologo,nutriologo_estudiante)&order=created_at.desc");
  const _peekMe = myId ? dbPeek(`profiles?id=eq.${myId}`) : null;
  const [nutriologos, setNutriologos] = useState(() => {
    if (Array.isArray(_peekMe) && _peekMe.length > 0 && Array.isArray(_peekNutris)) {
      const owner = { ..._peekMe[0], isSuperadmin: true, nombre_marca: _peekMe[0].nombre_marca || "Flux Sports (Tú)" };
      return [owner, ..._peekNutris];
    }
    return Array.isArray(_peekNutris) ? _peekNutris : [];
  });
  const [loading, setLoading] = useState(() => _peekNutris === null);
  const hasLoadedRef = useRef(_peekNutris !== null);
  const [search, setSearch] = useState("");
  
  // Modals state
  const [showInviteNutri, setShowInviteNutri] = useState(false);
  const [showEditNutri, setShowEditNutri] = useState(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [showConfirmDeleteNutri, setShowConfirmDeleteNutri] = useState(false);
  const [confirmDeleteNutriText, setConfirmDeleteNutriText] = useState("");
  
  const [conflictUser, setConflictUser] = useState(null);
  const [conflictType, setConflictType] = useState(null);

  useBackButton(!!conflictUser, () => setConflictUser(null), 30);
  
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  // Vista detallada de pacientes del nutriólogo
  const [selectedNutri, setSelectedNutri] = useState(() => {
    try {
      const s = sessionStorage.getItem("flux_admin_selected_nutri");
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (selectedNutri) {
      sessionStorage.setItem("flux_admin_selected_nutri", JSON.stringify(selectedNutri));
    } else {
      sessionStorage.removeItem("flux_admin_selected_nutri");
    }
  }, [selectedNutri]);

  useBackButton(!!selectedNutri, () => setSelectedNutri(null), 15);

  const [patientSearch, setPatientSearch] = useState("");
  const [patientFilter, setPatientFilter] = useState("todos"); // "todos" | "inactivos" | "venciendo" | "al_dia"
  const [retentionData, setRetentionData] = useState({ activeCiclos: [], lastActivityMap: {} });

  // Forms
  const [formNutri, setFormNutri] = useState({ nombre: "", email: "", telefono: "", nombre_marca: "", logo_url: "", color_primario: "#1A6FD4", role: "nutriologo", cedula: "" });
  const [editFormNutri, setEditFormNutri] = useState({ nombre: "", nombre_marca: "", color_primario: "", email: "", telefono: "", logo_url: "", role: "nutriologo", cedula: "" });
  const [formClient, setFormClient] = useState({ nombre: "", email: "", objetivo: "", telefono: "" });

  const [resolvedOwnerId, setResolvedOwnerId] = useState(myId);
  const [myName, setMyName] = useState("");
  const [myRole, setMyRole] = useState("superadmin");
  const deletingNutriIdsRef = useRef(new Set());

  const loadNutriologos = async ({ forceFresh = false } = {}) => {
    if (!hasLoadedRef.current) setLoading(true);
    const fetcher = forceFresh ? dbGetFresh : dbGet;
    try {
      const rawData = await fetcher("profiles?role=in.(nutriologo,nutriologo_estudiante)&order=created_at.desc").catch(() => []);
      const data = (rawData || []).filter(n => !deletingNutriIdsRef.current.has(n.id));
      const currentUser = await fetcher(`profiles?id=eq.${myId}`).catch(() => []);
      
      if (currentUser && currentUser.length > 0) {
        const me = currentUser[0];
        setMyName(me.nombre || "Staff");
        setMyRole(me.role || "superadmin");

        let owner = { ...me };
        // Si es staff/administrativo, el "dueño" del directorio corporativo es su jefe (el superadmin)
        if (me.role === "staff" || me.role === "administrativo") {
          if (me.nutriologo_id) {
            const boss = await dbGet(`profiles?id=eq.${me.nutriologo_id}`).catch(() => []);
            if (boss && boss.length > 0) owner = { ...boss[0] };
          } else {
            const superBoss = await dbGet("profiles?role=eq.superadmin&limit=1").catch(() => []);
            if (superBoss && superBoss.length > 0) owner = { ...superBoss[0] };
          }
        }

        setResolvedOwnerId(owner.id);
        owner.isSuperadmin = true;
        
        if (me.role !== "superadmin") {
          owner.nombre_marca = owner.nombre_marca || "Flux Sports";
        } else {
          owner.nombre_marca = owner.nombre_marca || "Flux Sports (Tú)";
        }
        
        setNutriologos([owner, ...(data || [])]);
      } else if (data && data.length > 0) {
        setNutriologos(data);
      }
    } catch(e) {
      const isOffline = !navigator.onLine || (e?.message || "").toLowerCase().includes("offline");
      if (!isOffline) setMsg("❌ Error cargando nutriólogos");
    }
    hasLoadedRef.current = true;
    setLoading(false);
  };

  useEffect(() => {
    loadNutriologos();
    let timer = null;
    const onCacheUpdated = (ev) => {
      if (deletingNutriIdsRef.current.size > 0) return;
      const table = ev?.detail?.table;
      if (table && !["profiles", "clientes", "recibos_pago", "solicitudes_profesionales", "*"].includes(table)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (deletingNutriIdsRef.current.size === 0) loadNutriologos();
      }, 250);
    };
    window.addEventListener("flux:cache-updated", onCacheUpdated);
    window.addEventListener("flux:synced", onCacheUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("flux:cache-updated", onCacheUpdated);
      window.removeEventListener("flux:synced", onCacheUpdated);
    };
  }, []);

  const handleLogoChange = async (e, setFnc) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadLogo(file);
      setFnc(p => ({ ...p, logo_url: url }));
      setMsg("✅ Logo subido");
    } catch(err) {
      setMsg("❌ Error al subir logo: " + err.message);
    }
    setUploadingLogo(false);
  };

  const inviteNutri = async () => {
    const cleanEmail = (formNutri.email || "").trim().toLowerCase();
    const cleanNombre = (formNutri.nombre || "").trim();
    if (!cleanEmail || !cleanNombre) { setMsg("❌ Nombre y email requeridos"); return; }
    setSaving(true);
    try {
      const { existingProfiles, existingClientes } = await checkAndCleanOrphanedEmail(cleanEmail);

      if (existingProfiles.length > 0 && ["nutriologo", "nutriologo_estudiante"].includes(existingProfiles[0].role)) {
        try {
          await authResetPassword(cleanEmail);
          setMsg("✅ Este nutriólogo ya está registrado. Se le reenvió un enlace de acceso a su correo.");
        } catch (err) {
          setMsg("✅ Este nutriólogo ya está registrado. (" + err.message + ")");
        }
        setShowInviteNutri(false);
        setSaving(false);
        return;
      }

      if (existingProfiles.length > 0 || existingClientes.length > 0) {
        setConflictUser({
          profile: existingProfiles[0],
          cliente: existingClientes[0],
          email: cleanEmail,
          typedData: { ...formNutri, email: cleanEmail, nombre: cleanNombre }
        });
        setConflictType("nutri");
        setShowInviteNutri(false);
        setSaving(false);
        return;
      }

      const targetRole = formNutri.role || "nutriologo";
      const finalCedula = targetRole === "nutriologo" ? (formNutri.cedula?.trim() || null) : null;
      const authUser = await authInvite(cleanEmail, { 
        role: targetRole, 
        nombre: cleanNombre, 
        nombre_marca: formNutri.nombre_marca,
        cedula: finalCedula
      });
      await updateProfile(authUser.id, {
        role: targetRole,
        nombre: cleanNombre,
        telefono: formNutri.telefono,
        nombre_marca: formNutri.nombre_marca,
        logo_url: formNutri.logo_url,
        color_primario: formNutri.color_primario,
        cedula: finalCedula,
        creado_por_nombre: myName,
        activo: true
      });
      setShowInviteNutri(false);
      setFormNutri({ nombre: "", email: "", telefono: "", nombre_marca: "", logo_url: "", color_primario: "#1A6FD4", role: "nutriologo", cedula: "" });
      loadNutriologos();
      setMsg("✅ Invitación enviada al nutriólogo");
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

  const resendNutriAccess = async (emailToSend) => {
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

  const saveEditNutri = async () => {
    setSaving(true);
    try {
      const payload = { ...editFormNutri };
      delete payload.email;
      if (showEditNutri?.isSuperadmin) delete payload.role;
      if (payload.role === "nutriologo_estudiante") {
        payload.cedula = null;
      } else if (payload.cedula !== undefined) {
        payload.cedula = payload.cedula?.trim() || null;
      }
      await updateProfile(showEditNutri.id, payload);
      setShowEditNutri(null);
      loadNutriologos();
      setMsg("✅ Cambios guardados");
    } catch (e) {
      setMsg("❌ " + e.message);
    }
    setSaving(false);
  };

  const toggleActivoNutri = async (n) => {
    if (n.isSuperadmin) return;
    const nextActivo = n.activo === false ? true : false;
    setNutriologos(prev => prev.map(item => item.id === n.id ? { ...item, activo: nextActivo } : item));
    updateQueryCache("profiles", (list) => Array.isArray(list) ? list.map(item => item.id === n.id ? { ...item, activo: nextActivo } : item) : list);
    try {
      await updateProfile(n.id, { activo: nextActivo });
      invalidateCache("profiles");
      setMsg(`✅ Nutriólogo ${nextActivo ? "activado" : "suspendido"}`);
    } catch (e) {
      setMsg("❌ Error: " + e.message);
      loadNutriologos({ forceFresh: true });
    }
  };

  const deleteNutriologo = async () => {
    if (confirmDeleteNutriText !== "ELIMINAR" || !showEditNutri || showEditNutri.isSuperadmin) return;
    const targetId = showEditNutri.id;
    const nutriEmail = (showEditNutri?.email || "").trim();
    const prevNutris = nutriologos;

    // 1. Cierre inmediato de modal y actualización optimista instantánea (0 ms)
    deletingNutriIdsRef.current.add(targetId);
    setNutriologos(prev => prev.filter(n => n.id !== targetId));
    if (selectedNutri?.id === targetId) setSelectedNutri(null);
    setShowEditNutri(null);
    setShowConfirmDeleteNutri(false);
    setConfirmDeleteNutriText("");
    updateQueryCache("profiles", (list) => Array.isArray(list) ? list.filter(n => n.id !== targetId) : list);
    updateQueryCache("clientes", (list) => Array.isArray(list) ? list.filter(c => c.nutriologo_id !== targetId && c.auth_id !== targetId) : list);
    setMsg("✅ Nutriólogo y sus expedientes eliminados permanentemente.");

    setSaving(true);
    try {
      await deleteNutriologoAccount({ nutriologoId: targetId, email: nutriEmail });
      deletingNutriIdsRef.current.delete(targetId);
      invalidateCache("profiles");
      invalidateCache("clientes");
      await loadNutriologos({ forceFresh: true });
      await loadClientes({ forceFresh: true });
    } catch (e) {
      deletingNutriIdsRef.current.delete(targetId);
      setNutriologos(prevNutris);
      setMsg("❌ Error eliminando nutriólogo: " + e.message);
    }
    setSaving(false);
  };

  const createClient = async () => {
    const cleanEmail = (formClient.email || "").trim().toLowerCase();
    const cleanNombre = (formClient.nombre || "").trim();
    if (!cleanEmail || !cleanNombre) { setMsg("❌ Nombre y email son obligatorios"); return; }
    setSaving(true);
    try {
      const { existingProfiles, existingClientes } = await checkAndCleanOrphanedEmail(cleanEmail);

      // Evitar duplicado si ya es paciente de este mismo directorio corporativo
      const alreadyMine = existingClientes.find(c => c.nutriologo_id === resolvedOwnerId);
      if (alreadyMine) {
        if (!alreadyMine.activo) {
          await dbPatch(`clientes?id=eq.${alreadyMine.id}`, { activo: true, deactivated_at: null });
        }
        try {
          await authResetPassword(cleanEmail);
          setMsg("✅ Este paciente ya estaba en tu lista. Se le reenvió un enlace de acceso a su correo.");
        } catch (err) {
          setMsg("✅ Este paciente ya está en tu lista. (" + err.message + ")");
        }
        setShowNewClient(false);
        setFormClient({ nombre: "", email: "", objetivo: "", telefono: "" });
        await loadClientes();
        setSaving(false);
        return;
      }

      if (existingProfiles.length > 0 || existingClientes.length > 0) {
        const profile = existingProfiles[0];

        // Consentimiento si es colega o rol superior (solo para cuando lo invitan como paciente)
        if (profile && ["nutriologo", "nutriologo_estudiante", "administrativo", "staff", "superadmin"].includes(profile.role)) {
          await dbPost("solicitudes_entrenamiento", {
            from_nutriologo_id: myId,
            from_nutriologo_nombre: myName || 'Superadmin',
            to_email: cleanEmail,
            estado: "pendiente"
          });

          setMsg("✅ Solicitud de consentimiento enviada. El colega deberá aceptar desde su perfil.");
          setShowNewClient(false);
          setFormClient({ nombre: "", email: "", objetivo: "", telefono: "" });
          setSaving(false);
          return;
        }

        setConflictUser({
          profile: existingProfiles[0],
          cliente: existingClientes[0],
          email: cleanEmail,
          typedData: { ...formClient, email: cleanEmail, nombre: cleanNombre }
        });
        setConflictType("cliente");
        setShowNewClient(false);
        setSaving(false);
        return;
      }

      const authUser = await authInvite(cleanEmail, { role: "cliente", nombre: cleanNombre });
      await dbPost("clientes", {
        nombre: cleanNombre,
        objetivo: formClient.objetivo,
        email: cleanEmail,
        telefono: formClient.telefono,
        nutriologo_id: resolvedOwnerId,
        auth_id: authUser.id,
        activo: true
      });
      setShowNewClient(false);
      setFormClient({ nombre: "", email: "", objetivo: "", telefono: "" });
      await loadClientes();
      setMsg("✅ Paciente creado y correo de invitación enviado");
    } catch (e) {
      if (e.message?.includes("already been registered")) {
        try {
          const cleanEmailFallback = formClient.email.trim().toLowerCase();
          await dbPost("clientes", {
            nombre: formClient.nombre.trim(),
            objetivo: formClient.objetivo,
            email: cleanEmailFallback,
            telefono: formClient.telefono,
            nutriologo_id: resolvedOwnerId,
            activo: true
          });
          await authResetPassword(cleanEmailFallback).catch(() => {});
          setShowNewClient(false);
          setFormClient({ nombre: "", email: "", objetivo: "", telefono: "" });
          await loadClientes();
          setMsg("✅ Paciente vinculado y se le envió un enlace para configurar su contraseña.");
        } catch (fallbackErr) {
          setMsg("❌ " + fallbackErr.message);
        }
      } else {
        setMsg("❌ " + e.message);
      }
    }
    setSaving(false);
  };

  const resolveConflict = async (useNewData) => {
    setSaving(true);
    try {
      const p = conflictUser.profile;
      const c = conflictUser.cliente;
      const targetId = p?.id || c?.auth_id;

      const finalNombre = useNewData ? conflictUser.typedData.nombre : (p?.nombre || c?.nombre || conflictUser.typedData.nombre);
      const finalTelefono = useNewData ? conflictUser.typedData.telefono : (p?.telefono || c?.telefono || conflictUser.typedData.telefono);

      if (conflictType === "nutri") {
        const targetRole = conflictUser.typedData?.role || "nutriologo";
        if (p) {
          await dbPatch(`profiles?id=eq.${p.id}`, {
            role: targetRole,
            nombre: finalNombre,
            telefono: finalTelefono,
            nombre_marca: useNewData ? conflictUser.typedData.nombre_marca : p.nombre_marca,
            logo_url: useNewData ? conflictUser.typedData.logo_url : p.logo_url,
            color_primario: useNewData ? conflictUser.typedData.color_primario : p.color_primario,
            cedula: targetRole === "nutriologo" ? (conflictUser.typedData.cedula || p.cedula || null) : null,
            creado_por_nombre: myName,
            activo: true
          });
        } else if (targetId) {
          await dbPost("profiles", {
            id: targetId,
            email: conflictUser.email,
            role: targetRole,
            nombre: finalNombre,
            telefono: finalTelefono,
            nombre_marca: conflictUser.typedData.nombre_marca || finalNombre,
            logo_url: conflictUser.typedData.logo_url || "",
            color_primario: conflictUser.typedData.color_primario || "#1A6FD4",
            cedula: targetRole === "nutriologo" ? (conflictUser.typedData.cedula || null) : null,
            creado_por_nombre: myName,
            activo: true
          });
        }
        if (useNewData && c) await dbPatch(`clientes?id=eq.${c.id}`, { nombre: finalNombre, telefono: finalTelefono });
        loadNutriologos();
      } else {
        const existingCheck = await dbGet(`clientes?email=ilike.${encodeURIComponent(conflictUser.email)}&nutriologo_id=eq.${resolvedOwnerId}`);
        if (existingCheck.length === 0) {
          await dbPost("clientes", {
            nombre: finalNombre,
            objetivo: conflictUser.typedData.objetivo || "Mejorar salud",
            email: conflictUser.email,
            telefono: finalTelefono,
            nutriologo_id: resolvedOwnerId,
            auth_id: targetId,
            activo: true
          });
        }
        if (useNewData && p) await dbPatch(`profiles?id=eq.${p.id}`, { nombre: finalNombre, telefono: finalTelefono });
        loadClientes();
      }

      setMsg(`✅ Permisos otorgados exitosamente.`);
      setConflictUser(null);
      setConflictType(null);
      setFormNutri({ nombre: "", email: "", telefono: "", nombre_marca: "", logo_url: "", color_primario: "#1A6FD4", role: "nutriologo" });
      setFormClient({ nombre: "", email: "", objetivo: "", telefono: "" });
    } catch (e) {
      setMsg("❌ Error al resolver: " + e.message);
    }
    setSaving(false);
  };

  const filteredNutris = nutriologos.filter(n => {
    const term = search.toLowerCase();
    return (n.nombre || "").toLowerCase().includes(term) || (n.nombre_marca || "").toLowerCase().includes(term);
  });

  // Cargar métricas de retención para el nutriólogo seleccionado
  useEffect(() => {
    if (!selectedNutri) return;
    const targetClients = selectedNutri.id === "__atletas__" 
      ? clientes.filter(c => !c.nutriologo_id)
      : clientes.filter(c => c.nutriologo_id === selectedNutri.id);
    const ids = targetClients.map(c => c.id).filter(Boolean);
    if (ids.length === 0) {
      setRetentionData({ activeCiclos: [], lastActivityMap: {} });
      return;
    }
    const cIdsParam = ids.slice(0, 100).join(",");
    Promise.all([
      dbGet(`ciclos?activo=eq.true&cliente_id=in.(${cIdsParam})&select=id,cliente_id,nombre,fecha_inicio,activo`).catch(() => []),
      dbGet(`progreso?cliente_id=in.(${cIdsParam})&select=cliente_id,updated_at&order=updated_at.desc&limit=500`).catch(() => []),
      dbGet(`metricas_progreso?cliente_id=in.(${cIdsParam})&select=cliente_id,fecha,created_at&order=created_at.desc&limit=500`).catch(() => [])
    ]).then(([activeCiclosRes, recentProgRes, recentMetricasRes]) => {
      const activityMap = {};
      if (Array.isArray(recentMetricasRes)) {
        for (const m of recentMetricasRes) {
          if (!m.cliente_id) continue;
          const dateStr = m.fecha || m.created_at;
          if (!dateStr) continue;
          const time = new Date(dateStr).getTime();
          if (!isNaN(time) && (!activityMap[m.cliente_id] || time > activityMap[m.cliente_id])) {
            activityMap[m.cliente_id] = time;
          }
        }
      }
      if (Array.isArray(recentProgRes)) {
        for (const p of recentProgRes) {
          if (!p.cliente_id) continue;
          const dateStr = p.updated_at;
          if (!dateStr) continue;
          const time = new Date(dateStr).getTime();
          if (!isNaN(time) && (!activityMap[p.cliente_id] || time > activityMap[p.cliente_id])) {
            activityMap[p.cliente_id] = time;
          }
        }
      }
      setRetentionData({
        activeCiclos: Array.isArray(activeCiclosRes) ? activeCiclosRes : [],
        lastActivityMap: activityMap
      });
    }).catch(() => {});
  }, [selectedNutri, clientes]);

  const getPatientRetention = (c) => {
    if (!c) return { isInactivo: false, isVenciendo: false, isVencido: false, daysInactive: null, daysToExpire: null, activeCycle: null, isAlDia: false, isNuevo: false };
    const now = new Date();
    
    // 1. Ciclo Activo
    const activeCycle = retentionData.activeCiclos?.find(ac => ac.cliente_id === c.id);
    let daysToExpire = null;
    let isVenciendo = false;
    let isVencido = false;
    
    if (activeCycle) {
      let semanas = 4;
      if (activeCycle.nombre && activeCycle.nombre.includes("|")) {
        const parsed = parseInt(activeCycle.nombre.split("|")[1], 10);
        if (!isNaN(parsed) && parsed > 0) semanas = parsed;
      }
      const startDate = new Date(activeCycle.fecha_inicio + "T12:00:00");
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (semanas * 7));
      const diffMs = endDate.getTime() - now.getTime();
      daysToExpire = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      isVenciendo = daysToExpire <= 3;
      isVencido = daysToExpire <= 0;
    }
    
    // 2. Inactividad
    const lastTime = retentionData.lastActivityMap?.[c.id];
    let daysInactive = null;
    let isInactivo = false;
    let isNuevo = false;
    
    if (lastTime) {
      const diffMs = now.getTime() - lastTime;
      daysInactive = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      isInactivo = daysInactive >= 5;
    } else if (c.created_at) {
      const regTime = new Date(c.created_at).getTime();
      const diffMs = now.getTime() - regTime;
      const daysSinceReg = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (daysSinceReg < 5) {
        isNuevo = true;
      } else {
        daysInactive = daysSinceReg;
        isInactivo = true;
      }
    }

    const isAlDia = !isInactivo && !isVenciendo && c.activo;

    return {
      activeCycle,
      daysToExpire,
      isVenciendo,
      isVencido,
      daysInactive,
      isInactivo,
      isNuevo,
      isAlDia
    };
  };

  const currentNutriClients = useMemo(() => {
    if (!selectedNutri) return [];
    if (selectedNutri.id === "__atletas__") {
      return clientes.filter(c => !c.nutriologo_id);
    }
    return clientes.filter(c => c.nutriologo_id === selectedNutri.id);
  }, [clientes, selectedNutri]);

  const activeClientsCount = currentNutriClients.filter(c => c.activo).length;
  const inactivosCount = currentNutriClients.filter(c => c.activo && getPatientRetention(c).isInactivo).length;
  const venciendoCount = currentNutriClients.filter(c => c.activo && getPatientRetention(c).isVenciendo).length;
  const alDiaCount = currentNutriClients.filter(c => c.activo && getPatientRetention(c).isAlDia).length;

  const filteredPatients = useMemo(() => {
    return currentNutriClients.filter(c => {
      const term = patientSearch.toLowerCase().trim();
      const matchesSearch = !term || 
        (c.nombre || "").toLowerCase().includes(term) ||
        (c.email || "").toLowerCase().includes(term);
      if (!matchesSearch) return false;

      if (patientFilter === "inactivos") return c.activo && getPatientRetention(c).isInactivo;
      if (patientFilter === "venciendo") return c.activo && getPatientRetention(c).isVenciendo;
      if (patientFilter === "al_dia") return c.activo && getPatientRetention(c).isAlDia;
      return true;
    });
  }, [currentNutriClients, patientSearch, patientFilter, retentionData]);

  const renderNutri = (n) => {
    const nClients = clientes.filter(c => c.nutriologo_id === n.id);

    const handleEditNutri = (e) => {
      e.stopPropagation();
      setShowEditNutri(n);
      setEditFormNutri({ 
        nombre: n.nombre || "", 
        nombre_marca: n.nombre_marca || "", 
        color_primario: n.color_primario || "#1A6FD4", 
        email: n.email || "", 
        telefono: n.telefono || "", 
        logo_url: n.logo_url || "", 
        role: n.role || "nutriologo", 
        cedula: n.cedula || "" 
      });
    };

    const whatsAppUrl = n.telefono
      ? `https://wa.me/${n.telefono.replace(/\D/g, '').length === 10 ? '52' + n.telefono.replace(/\D/g, '') : n.telefono.replace(/\D/g, '')}`
      : "";
    
    return (
      <div 
        key={n.id} 
        onClick={() => setSelectedNutri(n)}
        className="bg-white rounded-none md:rounded-2xl border-b md:border border-[#E2E8F0] overflow-hidden shadow-none md:shadow-xs hover:border-[var(--brand-primary)]/40 hover:shadow-sm transition-all cursor-pointer group"
      >
        {/* ── VISTA MÓVIL (Formato estructurado de 5 filas) ── */}
        <div className="p-4 md:hidden flex items-center gap-3.5">
          {/* Foto (posición y tamaño intactos, centrada verticalmente) */}
          <div className="w-11 h-11 rounded-xl border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center bg-slate-50 relative">
            {n.logo_url ? (
              <CachedImage 
                src={n.logo_url} 
                alt={n.nombre || "Logo"} 
                className="w-full h-full object-cover" 
                fallback={<User className="text-slate-300" size={22}/>} 
              />
            ) : (
              <User className="text-slate-300" size={22}/>
            )}
            {n.isSuperadmin && <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-white"></div>}
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            {/* Fila 1: Nombre de la marca y a la derecha pacientes colapsado + lápiz de edición */}
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-[#0B1929] text-base leading-tight truncate group-hover:text-[var(--brand-primary)] transition-colors">
                {n.nombre_marca || n.nombre || "Sin nombre"}
              </h3>
              <div className="flex items-center gap-1.5 shrink-0">
                <div 
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F0F4FA] text-[#0B1929] text-[11px] font-bold border border-[#E2E8F0]/80"
                  title={`${nClients.length} ${nClients.length === 1 ? 'paciente' : 'pacientes'}`}
                >
                  <Users size={12} className="text-[#6B7A8D]" />
                  <span>{nClients.length}</span>
                </div>
                <button 
                  type="button"
                  onClick={handleEditNutri}
                  className="w-7 h-7 rounded-lg border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[#6B7A8D] hover:text-[var(--brand-primary)] flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                  title="Editar nutriólogo"
                >
                  <Pencil size={13} />
                </button>
              </div>
            </div>

            {/* Fila 2: Todos sus banners (tarjetitas de colores) */}
            <div className="flex flex-wrap items-center gap-1.5">
              {n.isSuperadmin && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 shrink-0">
                  {n.id === myId ? "TÚ" : "CORPORATIVO"}
                </span>
              )}
              {n.role === "nutriologo_estudiante" ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 shrink-0">
                  ESTUDIANTE
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 shrink-0">
                  TITULAR
                </span>
              )}
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                n.activo !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}>
                {n.activo !== false ? "Activo" : "Suspendido"}
              </span>
              {n.cedula && (
                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0">
                  Céd: {n.cedula}
                </span>
              )}
            </div>

            {/* Fila 3: Icono de WhatsApp + Nombre como enlace directo */}
            <div className="text-xs leading-tight pt-0.5">
              {whatsAppUrl ? (
                <a 
                  href={whatsAppUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  onClick={(e) => e.stopPropagation()}
                  className="text-emerald-700 font-medium no-underline inline-flex items-center gap-1.5 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded transition-colors max-w-full"
                  title={`Contactar por WhatsApp a ${n.nombre}`}
                >
                  <MessageCircle size={12} className="text-emerald-600 shrink-0" />
                  <span className="truncate">{n.nombre || "Sin nombre registrado"}</span>
                </a>
              ) : (
                <span className="text-[#475569] font-medium">{n.nombre || "Sin nombre registrado"}</span>
              )}
            </div>

            {/* Si aplica, quién lo invitó */}
            {n.creado_por_nombre && !n.isSuperadmin && (
              <div className="pt-0.5">
                <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                  <UserPlus size={11} className="shrink-0" />
                  <span>Invitado por: <strong className="font-medium text-slate-600">{n.creado_por_nombre}</strong></span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── VISTA ESCRITORIO (md:flex) ── */}
        <div className="hidden md:flex p-4.5 items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center bg-slate-50 relative">
              {n.logo_url ? (
                <CachedImage 
                  src={n.logo_url} 
                  alt={n.nombre || "Logo"} 
                  className="w-full h-full object-cover" 
                  fallback={<User className="text-slate-300" size={22}/>} 
                />
              ) : (
                <User className="text-slate-300" size={22}/>
              )}
              {n.isSuperadmin && <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-white"></div>}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <h3 className="font-bold text-[#0B1929] text-base md:text-lg truncate group-hover:text-[var(--brand-primary)] transition-colors">
                  {n.nombre_marca || n.nombre || "Sin nombre"}
                </h3>
                {n.isSuperadmin && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 shrink-0">{n.id === myId ? "TÚ" : "CORPORATIVO"}</span>}
                {n.role === "nutriologo_estudiante" ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 shrink-0">ESTUDIANTE</span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 shrink-0">TITULAR</span>
                )}
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${n.activo !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {n.activo !== false ? "Activo" : "Suspendido"}
                </span>
              </div>
              <div className="text-xs text-[#6B7A8D] flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{n.nombre}</span>
                {n.cedula && (
                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                    Céd: {n.cedula}
                  </span>
                )}
                {whatsAppUrl && (
                  <a 
                    href={whatsAppUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    onClick={(e) => e.stopPropagation()}
                    className="text-emerald-600 font-medium no-underline inline-flex items-center gap-1 hover:text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded transition-colors"
                  >
                    <MessageCircle size={12} /> WhatsApp
                  </a>
                )}
                {n.creado_por_nombre && !n.isSuperadmin && (
                  <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                    <UserPlus size={11} /> Invitado por: <span className="font-medium text-slate-500">{n.creado_por_nombre}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F0F4FA] text-[#0B1929] text-xs font-bold border border-[#E2E8F0]/80">
              <Users size={14} className="text-[#6B7A8D]" />
              <span>{nClients.length} {nClients.length === 1 ? "Paciente" : "Pacientes"}</span>
            </div>

            <button 
              type="button"
              onClick={handleEditNutri}
              className="w-8 h-8 rounded-xl border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[#6B7A8D] hover:text-[var(--brand-primary)] flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
              title="Editar nutriólogo"
            >
              <Pencil size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const InputClass = "w-full bg-[#F0F4FA] border border-transparent rounded-xl px-3.5 py-2.5 text-sm text-[#0B1929] outline-none focus:bg-white focus:border-[var(--brand-primary)] transition-all";

  const isSuperadminProfile = !!selectedNutri && (
    selectedNutri.isSuperadmin || 
    selectedNutri.id === myId || 
    selectedNutri.id === resolvedOwnerId
  );

  return (
    <div className="flex-1 flex flex-col bg-white md:bg-[#F7F9FC]">
      {selectedNutri ? (
        <div className="flex-1 flex flex-col bg-white md:bg-[#F7F9FC]">
          {/* Header Vista Nutriólogo */}
          <div className="px-4 md:px-8 pt-3 pb-2.5 md:pt-6 md:pb-5 bg-white border-b border-[#E2E8F0] flex flex-col gap-2.5 md:gap-3">
            <div className="flex items-center justify-between">
              <button 
                type="button"
                onClick={() => setSelectedNutri(null)}
                className="inline-flex items-center gap-2 text-xs md:text-sm font-bold text-[#6B7A8D] hover:text-[#0B1929] transition-colors cursor-pointer group"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                <span>Volver al Directorio</span>
              </button>
            </div>

            <div className="flex items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center bg-[#F8FAFC]">
                  {selectedNutri.isAtletas ? (
                    <Dumbbell className="text-[var(--brand-primary)]" size={22} />
                  ) : selectedNutri.logo_url ? (
                    <CachedImage 
                      src={selectedNutri.logo_url} 
                      alt={selectedNutri.nombre || "Logo"} 
                      className="w-full h-full object-cover" 
                      fallback={<User className="text-slate-300" size={24}/>} 
                    />
                  ) : (
                    <User className="text-slate-300" size={24}/>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg md:text-2xl font-bold text-[#0B1929] leading-tight truncate" style={{ fontFamily: "DM Sans" }}>
                      {selectedNutri.nombre_marca || selectedNutri.nombre || "Sin nombre"}
                    </h1>
                    {selectedNutri.isSuperadmin && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">TÚ</span>}
                    {!selectedNutri.isAtletas && (
                      selectedNutri.role === "nutriologo_estudiante" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">ESTUDIANTE</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">TITULAR</span>
                      )
                    )}
                    {!selectedNutri.isAtletas && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedNutri.activo !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {selectedNutri.activo !== false ? "Activo" : "Suspendido"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs md:text-sm text-[#6B7A8D] mt-0.5">
                    {activeClientsCount} pacientes activos de {currentNutriClients.length} totales
                    {!selectedNutri.isAtletas && selectedNutri.nombre && selectedNutri.nombre !== selectedNutri.nombre_marca && (
                      <span className="hidden sm:inline text-slate-400"> · Especialista: <strong className="text-slate-600 font-semibold">{selectedNutri.nombre}</strong></span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Controles de búsqueda y acción */}
            <div className="flex items-center gap-2 sm:gap-3 w-full mt-1">
              <div className="relative flex-1 min-w-0">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA5B0]" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o email..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] placeholder:text-[#9BA5B0]"
                />
              </div>
              {isSuperadminProfile && (
                <button
                  type="button"
                  onClick={() => setShowNewClient(true)}
                  className="flex items-center justify-center gap-1.5 bg-[var(--brand-primary)] text-white h-[42px] px-3 sm:px-4 rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all shrink-0 cursor-pointer"
                  title="Nuevo Paciente"
                  aria-label="Nuevo Paciente"
                >
                  <Plus size={18} strokeWidth={2.5} className="shrink-0" />
                  <span className="hidden sm:inline">Nuevo Paciente</span>
                </button>
              )}
            </div>

            {/* Píldoras de retención */}
            <div className="flex items-center gap-2 pt-0.5 overflow-x-auto scroll-hide pb-0.5 -mx-4 px-4 md:mx-0 md:px-0">
              <button
                type="button"
                onClick={() => setPatientFilter("todos")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                  patientFilter === "todos"
                    ? "bg-[#0B1929] text-white shadow-sm"
                    : "bg-[#F0F4FA] text-[#6B7A8D] hover:text-[#0B1929] hover:bg-slate-200"
                }`}
              >
                Todos ({currentNutriClients.length})
              </button>
              <button
                type="button"
                onClick={() => setPatientFilter("inactivos")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                  patientFilter === "inactivos"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                }`}
              >
                <AlertCircle size={13} />
                <span>Inactivos &gt;5d ({inactivosCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setPatientFilter("venciendo")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                  patientFilter === "venciendo"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                }`}
              >
                <Clock size={13} />
                <span>Por Vencer ({venciendoCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setPatientFilter("al_dia")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                  patientFilter === "al_dia"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                }`}
              >
                <CheckCircle2 size={13} />
                <span>Al Día ({alDiaCount})</span>
              </button>
            </div>
          </div>

          {/* Grilla de Pacientes */}
          <div className="flex-1 px-0 py-0 pb-28 md:p-8">
            {filteredPatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center opacity-60">
                <div className="w-16 h-16 bg-[#E2E8F0] rounded-full flex items-center justify-center mb-4">
                  <Users size={30} className="text-[#6B7A8D]" />
                </div>
                <h2 className="text-lg font-bold text-[#0B1929] mb-1" style={{ fontFamily: "DM Sans" }}>
                  No se encontraron pacientes
                </h2>
                <p className="text-xs text-[#6B7A8D]">
                  {currentNutriClients.length === 0 ? "Este nutriólogo aún no tiene pacientes asignados." : "Ningún paciente coincide con los filtros aplicados."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 md:gap-4 max-w-6xl mx-auto">
                {filteredPatients.map(c => {
                  const ret = getPatientRetention(c);
                  const barColor = !c.activo 
                    ? 'bg-slate-300' 
                    : ret.isVenciendo 
                    ? 'bg-amber-400' 
                    : ret.isInactivo 
                    ? 'bg-rose-500' 
                    : 'bg-[var(--brand-primary)]';

                  const clinRec = peekClinicalRecord(c.id);
                  const edad = calcEdadFromBirthdate(c.fecha_nacimiento || clinRec?.anamnesis?.fecha_nacimiento, null);
                  const generoRaw = c.genero || clinRec?.anamnesis?.genero;
                  const genero = generoRaw ? (generoRaw.toLowerCase().startsWith("m") ? "Masculino" : generoRaw.toLowerCase().startsWith("f") ? "Femenino" : generoRaw) : null;
                  const pesoVal = c.peso || clinRec?.anamnesis?.peso;
                  const peso = pesoVal ? `${pesoVal} kg` : null;
                  const demograficos = [edad ? `${edad} años` : null, genero, peso].filter(Boolean);

                  const activeCycle = ret.activeCycle;
                  const cleanCycleName = activeCycle?.nombre ? activeCycle.nombre.split("|")[0].trim() : null;
                  const isIntakePending = clinRec?.solicitud_activa === "historia_inicial" && !clinRec?.anamnesis_completada;

                  return (
                    <div 
                      key={c.id} 
                      className="bg-white rounded-none md:rounded-2xl border-b md:border border-[#E2E8F0] hover:border-[var(--brand-primary)] hover:shadow-md transition-all flex flex-col shadow-none md:shadow-xs overflow-hidden"
                    >
                      <div className={`h-1.5 w-full ${barColor}`} />

                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Cabecera paciente */}
                          <div className="flex items-start justify-between gap-2.5 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative shrink-0">
                                {c.avatar_url || c.foto_url ? (
                                  <CachedImage
                                    src={c.avatar_url || c.foto_url}
                                    alt={c.nombre}
                                    className="w-11 h-11 rounded-2xl object-cover border border-slate-200/80 shadow-2xs bg-[#F7F9FC]"
                                    fallback={
                                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100/80 border border-blue-200/60 flex items-center justify-center text-[var(--brand-primary)] font-black text-sm tracking-wide shadow-2xs">
                                        {getInitials(c.nombre)}
                                      </div>
                                    }
                                  />
                                ) : (
                                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100/80 border border-blue-200/60 flex items-center justify-center text-[var(--brand-primary)] font-black text-sm tracking-wide shadow-2xs">
                                    {getInitials(c.nombre)}
                                  </div>
                                )}
                                <span 
                                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                    !c.activo 
                                      ? 'bg-slate-400' 
                                      : ret.isInactivo 
                                      ? 'bg-rose-500' 
                                      : ret.isVenciendo 
                                      ? 'bg-amber-400' 
                                      : 'bg-emerald-500'
                                  }`} 
                                  title={!c.activo ? "Inactivo" : ret.isInactivo ? "Requiere atención / Inactivo" : ret.isVenciendo ? "Por vencer" : "Activo y al día"}
                                />
                              </div>

                              <div className="min-w-0">
                                <h3 className="font-bold text-[#0B1929] text-base leading-tight truncate" title={c.nombre}>
                                  {c.nombre}
                                </h3>
                                <div className="text-xs text-[#6B7A8D] font-medium mt-0.5 truncate">
                                  {demograficos.length > 0 ? demograficos.join(" • ") : (
                                    <span className="text-[#9BA5B0] italic">Datos clínicos pendientes</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Badges de estado */}
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <div className="flex items-center gap-1.5">
                                {c.activo && ret.isNuevo && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                                    <Sparkles size={10} />
                                    Nuevo
                                  </span>
                                )}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                  c.activo 
                                    ? 'bg-[#E8F1FB] text-[var(--brand-primary)]' 
                                    : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {c.activo ? "Activo" : "Inactivo"}
                                </span>
                              </div>

                              {c.activo && ret.isVenciendo && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                                  <Clock size={10} />
                                  {ret.isVencido 
                                    ? `Vencido (${Math.abs(ret.daysToExpire)}d)` 
                                    : (ret.daysToExpire === 0 ? "Vence hoy" : `Vence en ${ret.daysToExpire}d`)}
                                </span>
                              )}

                              {c.activo && ret.isInactivo && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 whitespace-nowrap">
                                  <AlertCircle size={10} />
                                  {ret.daysInactive ? `Inactivo (${ret.daysInactive}d)` : "Inactivo"}
                                </span>
                              )}

                              {c.activo && ret.isAlDia && !ret.isVenciendo && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                  <CheckCircle2 size={10} />
                                  Al día
                                </span>
                              )}

                              {isIntakePending && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                                  <Clock size={10} />
                                  Expediente solicitado
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Recuadro de Objetivo y Plan Actual */}
                          <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0] space-y-2 mb-3">
                            <div className="flex items-center gap-2 text-xs truncate">
                              <Target size={14} className="text-[var(--brand-primary)] shrink-0" />
                              <div className="min-w-0 flex-1 truncate">
                                <span className="text-[#6B7A8D] font-medium">Objetivo: </span>
                                <span className="text-[#0B1929] font-bold" title={c.objetivo || "General / Salud"}>
                                  {c.objetivo || "General / Salud"}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-xs">
                              <UtensilsCrossed size={14} className="text-indigo-600 shrink-0" />
                              <div className="min-w-0 flex-1 flex items-center justify-between gap-1">
                                <div className="min-w-0 flex-1 truncate">
                                  <span className="text-[#6B7A8D] font-medium">Plan activo: </span>
                                  {cleanCycleName ? (
                                    <span className="text-[#0B1929] font-bold" title={cleanCycleName}>{cleanCycleName}</span>
                                  ) : (
                                    <span className="text-[#9BA5B0] italic">Sin plan asignado</span>
                                  )}
                                </div>
                                {activeCycle && ret.daysToExpire !== null && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                    ret.isVencido 
                                      ? 'bg-rose-100 text-rose-700' 
                                      : ret.isVenciendo 
                                      ? 'bg-amber-100 text-amber-800' 
                                      : 'bg-blue-100/80 text-[var(--brand-primary)]'
                                  }`}>
                                    {ret.isVencido 
                                      ? `Vencido` 
                                      : ret.daysToExpire === 0 
                                      ? 'Vence hoy' 
                                      : `${ret.daysToExpire}d rest.`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Contacto: Email y WhatsApp */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#F0F4FA]">
                            <div className="flex items-center gap-1.5 text-xs text-[#6B7A8D] min-w-0 flex-1" title={c.email}>
                              <Mail size={13} className="text-[#9BA5B0] shrink-0" />
                              <span className="truncate">{c.email}</span>
                            </div>

                            {c.telefono ? (
                              <a 
                                href={getWhatsAppUrl(
                                  c.telefono,
                                  buildWhatsAppMessage(
                                    c, 
                                    isIntakePending ? "cuestionario" : (ret.isVenciendo ? "renovacion" : (ret.isInactivo ? "inactividad" : (ret.isNuevo ? "bienvenida" : "seguimiento"))),
                                    selectedNutri.nombre_marca || selectedNutri.nombre
                                  )
                                )} 
                                target="_blank" 
                                rel="noreferrer" 
                                className={`inline-flex items-center gap-1 text-[11px] font-bold text-white px-2.5 py-1 rounded-lg transition-colors shrink-0 ${
                                  isIntakePending
                                    ? 'bg-blue-600 hover:bg-blue-700'
                                    : ret.isVenciendo 
                                    ? 'bg-amber-600 hover:bg-amber-700' 
                                    : ret.isInactivo 
                                    ? 'bg-rose-600 hover:bg-rose-700' 
                                    : 'bg-[#25D366] hover:bg-[#20bd5a]'
                                }`}
                                title="Enviar mensaje por WhatsApp a 1 clic"
                              >
                                <MessageCircle size={12} className="fill-white shrink-0" />
                                <span>
                                  {isIntakePending ? "Cuestionario" : ret.isVenciendo ? "Renovación" : ret.isInactivo ? "Check-in" : "WhatsApp"}
                                </span>
                              </a>
                            ) : (
                              <span className="text-[11px] text-[#9BA5B0] italic flex items-center gap-1 shrink-0">
                                <Phone size={11} className="text-slate-300" /> Sin tel
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Footer de Acciones */}
                        <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center gap-2">
                          <button 
                            type="button"
                            onClick={() => { setSelected(c); setTab("programar"); }}
                            className="flex-1 bg-[var(--brand-primary)] hover:opacity-90 text-white px-3 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Programar nutrición y entrenamiento"
                          >
                            <CalendarDays size={14} />
                            <span>Programar</span>
                          </button>
                          <button 
                            type="button"
                            onClick={() => setEditClient(c)}
                            className="flex items-center justify-center bg-white border border-[#E2E8F0] text-[#6B7A8D] p-2.5 rounded-xl hover:text-[#0B1929] hover:bg-[#F0F4FA] transition-colors cursor-pointer shrink-0"
                            title="Editar datos básicos"
                          >
                            <Edit2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col bg-white md:bg-[#F7F9FC]">
          {/* Header */}
          <div className="px-4 md:px-8 pt-3 pb-2.5 md:pt-8 md:pb-6 bg-white border-b border-[#E2E8F0] flex flex-col gap-2.5 md:gap-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="hidden md:block text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">
                  {myRole === "staff" ? "Panel de Staff FLUX" : "Panel de Super Administrador"}
                </p>
                <h1 className="text-lg md:text-2xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>Directorio</h1>
                <p className="hidden md:block text-sm text-[#6B7A8D] mt-1">{clientes.length} pacientes y {nutriologos.length} nutriólogos en la plataforma</p>
              </div>
            </div>

            {/* Controles de búsqueda y acción */}
            <div className="flex items-center gap-2 sm:gap-3 w-full">
              <div className="relative flex-1 min-w-0">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA5B0]" />
                <input
                  type="text"
                  placeholder="Buscar por nutriólogo o marca..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] placeholder:text-[#9BA5B0]"
                />
              </div>
              <button 
                type="button"
                onClick={() => setShowInviteNutri(true)} 
                className="flex items-center justify-center gap-1.5 bg-[var(--brand-primary)] text-white h-[42px] px-3 sm:px-4 rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all shrink-0 cursor-pointer"
                title="Nuevo Nutriólogo"
                aria-label="Nuevo Nutriólogo"
              >
                <Plus size={18} strokeWidth={2.5} className="shrink-0" />
                <span className="hidden sm:inline">Nutriólogo</span>
              </button>
            </div>
          </div>

          {/* Directorio List */}
          <div className="flex-1 px-0 py-0 pb-28 md:p-8">
            {loading ? (
              <div className="max-w-5xl mx-auto"><ListSkeleton rows={5} /></div>
            ) : (
              <div className="flex flex-col gap-0 md:gap-4 max-w-5xl mx-auto">
                {filteredNutris.filter(n => n.isSuperadmin).map(n => renderNutri(n))}

                {(() => {
                  const atletasIndependientes = clientes.filter(c => !c.nutriologo_id);
                  return (
                    <div 
                      key="__atletas__" 
                      onClick={() => setSelectedNutri({ id: "__atletas__", nombre: "Atletas Independientes", nombre_marca: "Atletas Independientes", isAtletas: true })}
                      className="bg-white rounded-none md:rounded-2xl border-b md:border border-[#E2E8F0] overflow-hidden shadow-none md:shadow-xs hover:border-[var(--brand-primary)]/40 hover:shadow-sm transition-all cursor-pointer group"
                    >
                      {/* Vista Móvil (Estructurada y con contador colapsado en fila 1) */}
                      <div className="p-4 md:hidden flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl border border-slate-100 shrink-0 flex items-center justify-center bg-[var(--brand-primary)]/10">
                          <Dumbbell className="text-[var(--brand-primary)]" size={20} />
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                          {/* Fila 1: Título y contador colapsado a la derecha */}
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-[#0B1929] text-base leading-tight truncate group-hover:text-[var(--brand-primary)] transition-colors">
                              Atletas Independientes
                            </h3>
                            <div 
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F0F4FA] text-[#0B1929] text-[11px] font-bold border border-[#E2E8F0]/80 shrink-0"
                              title={`${atletasIndependientes.length} ${atletasIndependientes.length !== 1 ? 'atletas' : 'atleta'}`}
                            >
                              <Users size={12} className="text-[#6B7A8D]" />
                              <span>{atletasIndependientes.length}</span>
                            </div>
                          </div>

                          {/* Fila 2: Banner */}
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8F1FB] text-[var(--brand-primary)] shrink-0">
                              AUTODIRIGIDOS
                            </span>
                          </div>

                          {/* Fila 3: Descripción */}
                          <p className="text-xs text-[#6B7A8D] leading-tight">
                            Usuarios que gestionan su propio plan · Sin nutriólogo asignado
                          </p>
                        </div>
                      </div>

                      {/* Vista Escritorio */}
                      <div className="hidden md:flex p-4.5 items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-12 h-12 rounded-xl border border-slate-100 shrink-0 flex items-center justify-center bg-[var(--brand-primary)]/10">
                            <Dumbbell className="text-[var(--brand-primary)]" size={20} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                              <h3 className="font-bold text-[#0B1929] text-base md:text-lg leading-tight group-hover:text-[var(--brand-primary)] transition-colors">
                                Atletas Independientes
                              </h3>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8F1FB] text-[var(--brand-primary)] shrink-0">AUTODIRIGIDOS</span>
                            </div>
                            <p className="text-xs text-[#6B7A8D]">Usuarios que gestionan su propio plan · Sin nutriólogo asignado</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F0F4FA] text-[#0B1929] text-xs font-bold border border-[#E2E8F0]/80">
                            <Users size={14} className="text-[#6B7A8D]" />
                            <span>{atletasIndependientes.length} Atleta{atletasIndependientes.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {filteredNutris.filter(n => !n.isSuperadmin).map(n => renderNutri(n))}
              </div>
            )}
          </div>
        </div>
      )}


      {/* Modals */}
      {conflictUser && (
        <div className="fixed inset-0 bg-[#0B1929]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-[#0B1929] flex items-center gap-2 mb-5">
              <AlertCircle className="w-5 h-5 text-yellow-500" /> Usuario Existente
            </h3>
            
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl text-sm mb-5">
              El correo <strong>{conflictUser.email}</strong> ya pertenece a otro usuario de la plataforma.
              <br/><br/>
              <strong>Datos Actuales:</strong><br/>
              Nombre: {conflictUser.cliente?.nombre || conflictUser.profile?.nombre || "Sin nombre"}<br/>
              Teléfono: {conflictUser.cliente?.telefono || conflictUser.profile?.telefono || "Sin teléfono"}
            </div>

            <p className="text-[#6B7A8D] text-sm mb-5">
              ¿Qué datos deseas usar para su expediente en este nuevo rol?
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => resolveConflict(false)}
                disabled={saving}
                className="w-full text-left p-4 rounded-xl border border-[#E2E8F0] hover:border-[var(--brand-primary)] hover:bg-blue-50 transition-colors flex items-start gap-3"
              >
                <div className="w-5 h-5 mt-0.5 rounded-full border-2 border-[var(--brand-primary)] flex items-center justify-center"><div className="w-2.5 h-2.5 bg-[var(--brand-primary)] rounded-full"></div></div>
                <div>
                  <div className="font-bold text-[#0B1929] text-sm">Usar sus datos actuales</div>
                  <div className="text-xs text-[#6B7A8D] mt-1">Ignora lo que escribiste y vincúlalo usando el nombre y teléfono que ya tenía registrado.</div>
                </div>
              </button>

              <button 
                onClick={() => resolveConflict(true)}
                disabled={saving}
                className="w-full text-left p-4 rounded-xl border border-[#E2E8F0] hover:border-[var(--brand-primary)] hover:bg-blue-50 transition-colors flex items-start gap-3"
              >
                <div className="w-5 h-5 mt-0.5 rounded-full border-2 border-[#E2E8F0] flex items-center justify-center"></div>
                <div>
                  <div className="font-bold text-[#0B1929] text-sm">Actualizar todo con los datos nuevos</div>
                  <div className="text-xs text-[#6B7A8D] mt-1">Sobrescribe su nombre y teléfono globalmente usando la información que acabas de escribir.</div>
                </div>
              </button>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-[#E2E8F0]">
              <button onClick={() => { setConflictUser(null); setConflictType(null); }} disabled={saving} className="px-5 py-2.5 text-sm font-bold border border-[#E2E8F0] text-[#6B7A8D] rounded-xl hover:bg-[#F8FAFC]">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showInviteNutri && (
        <Modal title={<><User size={20} className="text-[var(--brand-primary)]"/> Nuevo Nutriólogo</>} onClose={() => setShowInviteNutri(false)}>
          <Field label="Tipo de perfil">
            <CustomSelect
              title="Tipo de perfil"
              className={InputClass}
              value={formNutri.role || "nutriologo"}
              onChange={(v) => setFormNutri((p) => ({ ...p, role: v }))}
              options={[
                { value: "nutriologo", label: "Nutriólogo Titular" },
                { value: "nutriologo_estudiante", label: "Nutriólogo Estudiante" },
              ]}
            />
          </Field>
          <Field label="Nombre completo">
            <input className={InputClass} value={formNutri.nombre} onChange={e => setFormNutri(p=>({...p,nombre:e.target.value}))}/>
          </Field>
          {formNutri.role !== "nutriologo_estudiante" && (
            <Field label="Cédula profesional">
              <input 
                className={InputClass} 
                placeholder="Ej. 12345678" 
                value={formNutri.cedula || ""} 
                onChange={e => setFormNutri(p=>({...p, cedula: e.target.value}))}
              />
            </Field>
          )}
          <Field label="Email">
            <input className={InputClass} type="email" value={formNutri.email} onChange={e => setFormNutri(p=>({...p,email:e.target.value}))}/>
          </Field>
          <Field label="Teléfono">
            <input className={InputClass} type="tel" value={formNutri.telefono} onChange={e => setFormNutri(p=>({...p,telefono:e.target.value}))}/>
          </Field>
          <Field label="Nombre de marca">
            <input className={InputClass} value={formNutri.nombre_marca} onChange={e => setFormNutri(p=>({...p,nombre_marca:e.target.value}))}/>
          </Field>
          <div className="grid grid-cols-2 gap-4 items-start">
            <Field label="Logo de marca">
              <LogoPicker value={formNutri.logo_url} onChange={e => handleLogoChange(e, setFormNutri)} onRemove={() => setFormNutri(p => ({ ...p, logo_url: "" }))} uploading={uploadingLogo}/>
            </Field>
            <div className="flex flex-col items-end">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 text-right">Color de marca</label>
              <BrandColorPicker
                value={formNutri.color_primario || "#1A6FD4"}
                onChange={val => setFormNutri(p => ({ ...p, color_primario: val }))}
                logoSource={formNutri.logo_url}
              />
            </div>
          </div>
          <div className="flex gap-2.5 justify-end mt-4">
            <Btn outline onClick={() => setShowInviteNutri(false)}>Cancelar</Btn>
            <Btn grad onClick={inviteNutri} disabled={saving || uploadingLogo}>{saving ? "Enviando..." : "Invitar Nutriólogo"}</Btn>
          </div>
        </Modal>
      )}

      {showEditNutri && (
        <Modal title={<><Pencil size={20} className="text-[var(--brand-primary)]"/> Editar {showEditNutri.nombre}</>} onClose={() => { setShowEditNutri(null); setShowConfirmDeleteNutri(false); setConfirmDeleteNutriText(""); }}>
          {showEditNutri.email && (
            <Field label="Correo de acceso">
              <input className={InputClass} type="email" value={showEditNutri.email} readOnly />
              <button
                type="button"
                onClick={() => resendNutriAccess(showEditNutri.email)}
                disabled={saving}
                className="mt-2 w-full py-2 px-3 rounded-xl bg-[#F0F4FA] hover:bg-[#E2E8F0]/70 border border-[#E2E8F0] text-[var(--brand-primary)] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                📧 Reenviar correo de acceso
              </button>
            </Field>
          )}
          {!showEditNutri.isSuperadmin && (
            <Field label="Tipo de perfil">
              <CustomSelect
                title="Tipo de perfil"
                className={InputClass}
                value={editFormNutri.role || "nutriologo"}
                onChange={(v) => setEditFormNutri((p) => ({ ...p, role: v }))}
                options={[
                  { value: "nutriologo", label: "Nutriólogo Titular" },
                  { value: "nutriologo_estudiante", label: "Nutriólogo Estudiante" },
                ]}
              />
            </Field>
          )}
          <Field label="Nombre completo">
            <input className={InputClass} value={editFormNutri.nombre} onChange={e => setEditFormNutri(p=>({...p,nombre:e.target.value}))}/>
          </Field>
          {!showEditNutri.isSuperadmin && editFormNutri.role !== "nutriologo_estudiante" && (
            <Field label="Cédula profesional">
              <input 
                className={InputClass} 
                placeholder="Ej. 12345678" 
                value={editFormNutri.cedula || ""} 
                onChange={e => setEditFormNutri(p=>({...p, cedula: e.target.value}))}
              />
            </Field>
          )}
          <Field label="Teléfono">
            <input className={InputClass} type="tel" value={editFormNutri.telefono} onChange={e => setEditFormNutri(p=>({...p,telefono:e.target.value}))}/>
          </Field>
          <Field label="Nombre de marca">
            <input className={InputClass} value={editFormNutri.nombre_marca} onChange={e => setEditFormNutri(p=>({...p,nombre_marca:e.target.value}))}/>
          </Field>
          <div className="grid grid-cols-2 gap-4 items-start">
            <Field label="Logo de marca">
              <LogoPicker value={editFormNutri.logo_url} onChange={e => handleLogoChange(e, setEditFormNutri)} onRemove={() => setEditFormNutri(p => ({ ...p, logo_url: "" }))} uploading={uploadingLogo}/>
            </Field>
            <div className="flex flex-col items-end">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 text-right">Color de marca</label>
              <BrandColorPicker
                value={editFormNutri.color_primario || "#1A6FD4"}
                onChange={val => setEditFormNutri(p => ({ ...p, color_primario: val }))}
                logoSource={editFormNutri.logo_url}
              />
            </div>
          </div>

          {!showEditNutri.isSuperadmin && (
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[#0B1929] flex items-center gap-2">
                  <span>Estado de la cuenta:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${showEditNutri.activo !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {showEditNutri.activo !== false ? "Activo" : "Suspendido"}
                  </span>
                </div>
                <p className="text-[11px] text-[#6B7A8D] mt-0.5">
                  {showEditNutri.activo !== false 
                    ? "El nutriólogo y sus pacientes tienen acceso a la plataforma." 
                    : "El acceso del nutriólogo se encuentra suspendido temporalmente."}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const updatedStatus = showEditNutri.activo === false;
                  await toggleActivoNutri(showEditNutri);
                  setShowEditNutri(prev => prev ? { ...prev, activo: updatedStatus } : null);
                }}
                disabled={saving}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors shrink-0 cursor-pointer ${
                  showEditNutri.activo !== false
                    ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
                    : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                {showEditNutri.activo !== false ? "Suspender cuenta" : "Activar cuenta"}
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 mt-4">
            {showConfirmDeleteNutri && !showEditNutri.isSuperadmin ? (
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl">
                <p className="text-red-700 text-xs font-bold mb-2">
                  Esta acción es irreversible. Se eliminará al nutriólogo y todos los expedientes clínicos de sus pacientes (si algún paciente tiene cuenta independiente, su cuenta independiente se conservará).
                  Escribe la palabra <strong>ELIMINAR</strong> para confirmar.
                </p>
                <input 
                  value={confirmDeleteNutriText}
                  onChange={e => setConfirmDeleteNutriText(e.target.value)}
                  placeholder="ELIMINAR"
                  className="w-full bg-white border border-red-200 text-red-900 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-red-500 mb-2"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setShowConfirmDeleteNutri(false); setConfirmDeleteNutriText(""); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-white transition-colors">Cancelar</button>
                  <button onClick={deleteNutriologo} disabled={confirmDeleteNutriText !== "ELIMINAR" || saving} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                    {saving ? "Eliminando..." : "Eliminar Definitivamente"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                {!showEditNutri.isSuperadmin ? (
                  <button onClick={() => setShowConfirmDeleteNutri(true)} className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors flex items-center gap-1">
                    <Trash2 size={14} /> Borrar Nutriólogo
                  </button>
                ) : <div />}
                <div className="flex gap-2.5">
                  <Btn outline onClick={() => { setShowEditNutri(null); setShowConfirmDeleteNutri(false); setConfirmDeleteNutriText(""); }}>Cancelar</Btn>
                  <Btn grad onClick={saveEditNutri} disabled={saving || uploadingLogo}>{saving ? "Guardando..." : "Guardar cambios"}</Btn>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {showNewClient && (
        <Modal title={<><Users size={20} className="text-[var(--brand-primary)]"/> Nuevo Paciente</>} onClose={() => setShowNewClient(false)}>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 mb-4 flex items-start gap-2">
            <CheckCircle2 size={16} className="text-[var(--brand-primary)] shrink-0 mt-0.5" />
            <span>Este paciente quedará asignado directamente a tu cuenta (Flux Sports).</span>
          </div>
          <Field label="Nombre completo">
            <input className={InputClass} value={formClient.nombre} onChange={e => setFormClient(p=>({...p,nombre:e.target.value}))}/>
          </Field>
          <Field label="Email">
            <input className={InputClass} type="email" value={formClient.email} onChange={e => setFormClient(p=>({...p,email:e.target.value}))}/>
          </Field>
          <Field label="Teléfono (WhatsApp)">
            <input className={InputClass} type="tel" value={formClient.telefono} onChange={e => setFormClient(p=>({...p,telefono:e.target.value}))}/>
          </Field>
          <Field label="Objetivo principal">
            <textarea className={InputClass + " min-h-[80px] resize-none"} value={formClient.objetivo} onChange={e => setFormClient(p=>({...p,objetivo:e.target.value}))} placeholder="Ej. Pérdida de grasa, hipertrofia..."/>
          </Field>
          <div className="flex gap-2.5 justify-end mt-4">
            <Btn outline onClick={() => setShowNewClient(false)}>Cancelar</Btn>
            <Btn grad onClick={createClient} disabled={saving}>{saving ? "Creando..." : "Crear paciente"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

