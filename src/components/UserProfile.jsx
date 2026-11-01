import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  dbPatch,
  dbGet,
  dbPost,
  dbDel,
  storageListFolder,
  storageRemoveMany,
  storageUpload,
  storageDelete,
  syncPersonalData,
} from "../lib/supabase";
import {
  LogOut,
  ShoppingBag,
  RefreshCw,
  CheckCircle2,
  MapPin,
  User,
  Mail,
  Phone,
  Trash2,
  AlertTriangle,
  X,
  Target,
  Calendar,
  Globe,
  Sparkles,
  ShieldCheck,
  Check,
  Loader2,
  Lock,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  Shield,
  Users,
  Flame,
  Award,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import RoleSwitcher from "./RoleSwitcher";
import { useBackButton } from "../lib/backButtonHandler";
import { CachedImage, cacheMediaUrl } from "../lib/mediaCache";
import { showFluxAlert } from "./ui/ConfirmModal";
import { refreshUserRoles } from "../lib/authRoles";
import { peekClinicalRecord, saveClinicalRecord } from "../lib/clinicalRecord";
import PhotoUploadBox from "./ui/PhotoUploadBox";
import { CustomSelect } from "./ui/CustomSelect";
import { PAISES, ESTADOS_MEXICO } from "../lib/constants";

const GOAL_PRESETS = [
  { label: "Pérdida de grasa / Definición", icon: "🔥" },
  { label: "Aumento de masa / Hipertrofia", icon: "💪" },
  { label: "Fuerza y Rendimiento", icon: "⚡" },
  { label: "Recomposición corporal", icon: "⚖️" },
  { label: "Salud y Bienestar general", icon: "🌱" },
];

export default function UserProfile({ session, onLogout, onChangeRole, onRolesUpdated, multiRoles }) {
  const navigate = useNavigate();
  const user = session?.data || session; // Cliente o Admin
  const isCliente = session?.role === "cliente" || session?.role === "civil";
  const isSuperadmin = session?.role === "superadmin" || user?.role === "superadmin";

  const [currentMultiRoles, setCurrentMultiRoles] = useState(multiRoles || []);

  const [form, setForm] = useState({
    nombre: user?.nombre || "",
    telefono: user?.telefono || "",
    email: user?.email || "",
    avatar_url: user?.avatar_url || "",
    fecha_nacimiento: user?.fecha_nacimiento || "",
    genero: user?.genero || "",
    pais: user?.pais || "México",
    estado_provincia: user?.estado_provincia || "",
  });

  const [objetivo, setObjetivo] = useState(user?.objetivo || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // "idle" | "saving" | "saved"
  const saveTimerRef = useRef(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalSaved, setGoalSaved] = useState(false);

  const [miNutriologo, setMiNutriologo] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useBackButton(showDeleteModal && !isDeleting, () => setShowDeleteModal(false), 40);

  // Helper para feedback de guardado sutil
  const triggerSaveStatus = (status) => {
    setSaveStatus(status);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (status === "saved") {
      saveTimerRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2500);
    }
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const calcularEdad = (fechaStr) => {
    if (!fechaStr) return null;
    const parts = fechaStr.split("-");
    if (parts.length !== 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const nac = new Date(y, m, d);
    if (isNaN(nac.getTime())) return null;
    const hoy = new Date();
    let edad = hoy.getFullYear() - nac.getFullYear();
    const mesDiff = hoy.getMonth() - nac.getMonth();
    if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < nac.getDate())) {
      edad--;
    }
    return edad > 0 ? `${edad} años` : null;
  };

  useEffect(() => {
    if (isCliente && user?.nutriologo_id) {
      dbGet(`profiles?id=eq.${user.nutriologo_id}`).then(rows => {
        if (rows.length > 0) setMiNutriologo(rows[0]);
      }).catch(() => {});
    }
  }, [isCliente, user?.nutriologo_id]);

  useEffect(() => {
    if (multiRoles && multiRoles.length > 0) {
      setCurrentMultiRoles(multiRoles);
    }
  }, [multiRoles]);

  // Sincronizar roles disponibles desde Supabase para detectar invitaciones recientes sin requerir cerrar sesión
  useEffect(() => {
    const emailToLookup = form.email || user?.email;
    const authIdToLookup = session?.profileId || user?.auth_id;
    if (!emailToLookup && !authIdToLookup) return;

    refreshUserRoles(authIdToLookup, emailToLookup).then(roles => {
      if (roles && roles.length > 0) {
        setCurrentMultiRoles(roles);
        try { localStorage.setItem("flux_multi_roles", JSON.stringify(roles)); } catch {}
        if (typeof onRolesUpdated === "function") {
          onRolesUpdated(roles);
        }
      }
    }).catch(e => console.error("Error refreshing roles in UserProfile:", e));
  }, [user?.email, form.email, session?.profileId]);

  // Refrescar datos frescos desde la BD al montar y cuando ocurran cambios en tiempo real
  useEffect(() => {
    const email = user?.email;
    if (!email) return;
    const query = isCliente ? `clientes?email=ilike.${email}` : `profiles?email=ilike.${email}`;
    const loadPersonal = () => {
      dbGet(query).then(rows => {
        if (rows && rows.length > 0) {
          const p = rows[0];
          setForm(prev => ({
            ...prev,
            nombre: p.nombre || prev.nombre,
            telefono: p.telefono || prev.telefono,
            avatar_url: p.avatar_url || prev.avatar_url,
            fecha_nacimiento: p.fecha_nacimiento || "",
            genero: p.genero || "",
            pais: p.pais || prev.pais || "México",
            estado_provincia: p.estado_provincia || "",
          }));
          if (isCliente && p.objetivo) setObjetivo(p.objetivo);
        }
      }).catch(() => {});
    };
    loadPersonal();
    const onCacheUpdated = (ev) => {
      const tbl = ev?.detail?.table;
      if (!tbl || tbl === "*" || tbl === "profiles" || tbl === "clientes") {
        loadPersonal();
      }
    };
    window.addEventListener("flux:cache-updated", onCacheUpdated);
    window.addEventListener("flux:synced", onCacheUpdated);
    return () => {
      window.removeEventListener("flux:cache-updated", onCacheUpdated);
      window.removeEventListener("flux:synced", onCacheUpdated);
    };
  }, [user?.email, isCliente]);

  const handleSavePersonal = async (formData) => {
    setIsSaving(true);
    triggerSaveStatus("saving");
    try {
      await syncPersonalData(form.email, formData);
      window.dispatchEvent(new CustomEvent("flux:profile-updated", { detail: formData }));
      if (user) {
        Object.assign(user, formData); // Actualizar cache local de sesión
      }
      if (currentMultiRoles && currentMultiRoles.length > 0) {
        currentMultiRoles.forEach(r => {
          if (r.data) Object.assign(r.data, formData);
        });
        localStorage.setItem("flux_multi_roles", JSON.stringify(currentMultiRoles));
      }

      // Sincronizar también con el expediente clínico si es paciente
      if (isCliente && user?.id) {
        try {
          const rec = peekClinicalRecord(user.id);
          const nextRec = {
            ...rec,
            anamnesis: {
              ...rec?.anamnesis,
              telefono: formData.telefono !== undefined ? formData.telefono : rec?.anamnesis?.telefono,
              fecha_nacimiento: formData.fecha_nacimiento !== undefined ? (formData.fecha_nacimiento || null) : rec?.anamnesis?.fecha_nacimiento,
              sexo: formData.genero ? (formData.genero.toLowerCase().startsWith("f") ? "F" : "M") : rec?.anamnesis?.sexo,
              updated_at: new Date().toISOString()
            }
          };
          await saveClinicalRecord(user.id, nextRec);
        } catch (clinicalErr) {
          console.warn("Aviso sincronizando perfil con expediente:", clinicalErr);
        }
      }
      triggerSaveStatus("saved");
    } catch (e) {
      console.error("Error saving profile", e);
      triggerSaveStatus("idle");
      showFluxAlert("Error guardando datos", e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const url = await storageUpload("logos", path, file);
      cacheMediaUrl(url).catch(() => {});

      if (form.avatar_url && form.avatar_url.includes("storage/v1/object/public/logos/")) {
        const oldPath = form.avatar_url.split("/public/logos/")[1];
        if (oldPath) {
          await storageDelete("logos", oldPath).catch(() => {});
        }
      }

      const nextForm = { ...form, avatar_url: url };
      setForm(nextForm);
      await handleSavePersonal(nextForm);
    } catch (error) {
      showFluxAlert("Error subiendo foto", error.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (form.avatar_url && form.avatar_url.includes("storage/v1/object/public/logos/")) {
      const oldPath = form.avatar_url.split("/public/logos/")[1];
      if (oldPath) {
        await storageDelete("logos", oldPath).catch(() => {});
      }
    }
    const nextForm = { ...form, avatar_url: "" };
    setForm(nextForm);
    await handleSavePersonal(nextForm);
  };

  const handleSaveObjetivo = async (forcedVal) => {
    if (!isCliente) return;
    const finalVal = forcedVal !== undefined ? forcedVal : objetivo;
    setSavingGoal(true);
    try {
      await dbPatch(`clientes?id=eq.${user.id}`, { objetivo: finalVal });
      if (user) user.objetivo = finalVal;

      // Sincronizar objetivo con el expediente clínico
      try {
        const rec = peekClinicalRecord(user.id);
        const nextRec = {
          ...rec,
          anamnesis: {
            ...rec?.anamnesis,
            objetivo_principal: finalVal,
            objetivo_expectativas: finalVal,
            updated_at: new Date().toISOString()
          }
        };
        await saveClinicalRecord(user.id, nextRec);
      } catch (clinicalErr) {
        console.warn("Aviso sincronizando objetivo con expediente:", clinicalErr);
      }
      setGoalSaved(true);
      setTimeout(() => setGoalSaved(false), 2200);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingGoal(false);
    }
  };

  const handleGoalPreset = (presetText) => {
    setObjetivo(presetText);
    handleSaveObjetivo(presetText);
  };

  const handleDeleteOwnAccount = async () => {
    if (confirmDeleteText.trim().toUpperCase() !== "ELIMINAR" || isSuperadmin) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      if (isCliente) {
        try {
          const files = await storageListFolder("progress-photos", user.id);
          if (files && files.length > 0) {
            const paths = files.map((f) => `${user.id}/${f.name}`);
            await storageRemoveMany("progress-photos", paths);
          }
        } catch (storageErr) {
          console.warn("Aviso limpiando fotos:", storageErr);
        }
        await dbPost("rpc/eliminar_paciente_definitivo", {
          p_cliente_id: user.id,
          p_auth_id: user.auth_id || null,
        });
      } else {
        // Desvincular primero a los pacientes para no eliminar sus cuentas personales
        try {
          await dbPatch(`clientes?nutriologo_id=eq.${user.id}`, { nutriologo_id: null });
        } catch (unlinkErr) {
          console.warn("Aviso desvinculando pacientes:", unlinkErr);
        }
        await dbPost("rpc/eliminar_nutriologo_definitivo", {
          p_nutriologo_id: user.id,
        });
      }

      // Limpiar cualquier registro o solicitud profesional ligada a su correo (Cumplimiento Google Play)
      const targetEmail = (user?.email || form?.email || "").trim();
      if (targetEmail) {
        try {
          await dbDel(`solicitudes_profesionales?email=ilike.${encodeURIComponent(targetEmail)}`);
        } catch (solErr) {
          console.warn("Aviso limpiando solicitudes_profesionales:", solErr);
        }
      }

      localStorage.clear();
      setShowDeleteModal(false);
      if (onLogout) {
        onLogout();
      } else {
        window.location.href = "/app";
      }
    } catch (e) {
      console.error("Error eliminando cuenta:", e);
      setDeleteError("No se pudo completar la eliminación: " + (e.message || "Intenta de nuevo."));
      setIsDeleting(false);
    }
  };

  const edadCalculada = calcularEdad(form.fecha_nacimiento);

  return (
    <div className="w-full flex-1 flex flex-col bg-[#F8FAFC] min-h-full">
      {/* Barra Superior Minimalista */}
      <div className="px-4 md:px-8 py-3.5 bg-white border-b border-[#E2E8F0] flex items-center justify-between sticky top-0 z-20">
        <div>
          <p className="hidden md:block text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-0.5">
            Cuenta FLUX
          </p>
          <h1 className="text-base md:text-xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
            Mi Perfil
          </h1>
        </div>

        {/* Indicador sutil de guardado */}
        <div className="flex items-center gap-2">
          {saveStatus === "saving" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-primary)] bg-blue-50 px-2.5 py-1 rounded-full animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full animate-in fade-in duration-200">
              <Check className="w-3.5 h-3.5" /> Guardado
            </span>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full pb-24 md:pb-12 px-4 sm:px-6 pt-4 sm:pt-6 space-y-4 sm:space-y-6">

        {/* 1. HERO CARD: Identidad y Avatar */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-[#E2E8F0] shadow-2xs relative overflow-hidden">
          {/* Acento decorativo sutil */}
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-[var(--brand-primary)]/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6 relative z-10">
            {/* Avatar circular interactivo */}
            <div className="relative group shrink-0">
              <PhotoUploadBox
                value={form.avatar_url}
                onChange={handleAvatarChange}
                onRemove={form.avatar_url ? handleRemoveAvatar : null}
                uploading={uploadingAvatar}
                label="Foto"
                shape="circle"
                size="md"
                className="ring-4 ring-slate-100 shadow-sm"
              />
            </div>

            {/* Datos Principales */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-[#0B1929] leading-tight truncate" style={{ fontFamily: "DM Sans" }}>
                {form.nombre.trim() || "Atleta FLUX"}
              </h2>
              
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs sm:text-sm text-[#6B7A8D] mt-1 truncate">
                <Mail size={13} className="shrink-0 text-[#94A3B8]" />
                <span className="truncate">{form.email || user?.email || "Sin correo"}</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full shrink-0">
                  <ShieldCheck size={11} /> Verificado
                </span>
              </div>

              {/* Chips informativos */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2 mt-3.5">
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[var(--brand-primary)] border border-blue-100">
                  <Award size={12} />
                  {isCliente ? (miNutriologo ? "Paciente FLUX" : "Atleta FLUX") : "Administrador"}
                </span>

                {edadCalculada && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-[#475569]">
                    <Calendar size={12} className="text-[#6B7A8D]" />
                    {edadCalculada}
                  </span>
                )}

                {(form.estado_provincia || form.pais) && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-[#475569]">
                    <MapPin size={12} className="text-[#6B7A8D]" />
                    {[form.estado_provincia, form.pais].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Switcher de Roles (Si tiene múltiples roles asociados) */}
        <RoleSwitcher
          currentRole={session?.role}
          currentData={user}
          multiRoles={currentMultiRoles}
          onChangeRole={onChangeRole}
          activeNutriologo={miNutriologo}
        />

        {/* 2. CARD: Objetivo Principal (Si es atleta o paciente) */}
        {isCliente && (
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-[#E2E8F0] shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Target size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
                    Mi Objetivo Principal
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#6B7A8D]">
                    Meta física y de rendimiento actual
                  </p>
                </div>
              </div>

              {savingGoal && (
                <span className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" /> Guardando...
                </span>
              )}
              {goalSaved && (
                <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  <Check size={12} /> Guardado
                </span>
              )}
            </div>

            {/* Píldoras de sugerencias rápidas */}
            <div className="flex flex-wrap gap-1.5 my-3">
              {GOAL_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleGoalPreset(preset.label)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 border ${
                    objetivo === preset.label
                      ? "bg-amber-500 text-white border-amber-500 shadow-2xs"
                      : "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:bg-slate-100"
                  }`}
                >
                  <span>{preset.icon}</span>
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>

            {/* Textarea estilizado */}
            <textarea
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              onBlur={() => handleSaveObjetivo()}
              placeholder="Ej. Bajar porcentaje de grasa al 12% y optimizar hipertrofia..."
              rows={2}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0B1929] outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] focus:bg-white transition-all resize-none leading-relaxed"
            />
          </div>
        )}

        {/* 3. CARD: Información Personal & Contacto */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-[#E2E8F0] shadow-2xs">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#F1F5F9]">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
              <User size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
                Información Personal
              </h3>
              <p className="text-[11px] sm:text-xs text-[#6B7A8D]">
                Datos demográficos y contacto sincronizados con tu plan
              </p>
            </div>
          </div>

          <div className="space-y-3.5">
            {/* Nombre Completo y Teléfono */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#475569] mb-1.5 flex items-center gap-1.5">
                  <User size={13} className="text-[#94A3B8]" /> Nombre Completo
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  onBlur={() => handleSavePersonal(form)}
                  placeholder="Tu nombre completo"
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0B1929] outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] mb-1.5 flex items-center gap-1.5">
                  <Phone size={13} className="text-[#94A3B8]" /> Teléfono
                </label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  onBlur={() => handleSavePersonal(form)}
                  placeholder="Ej. 55 1234 5678"
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0B1929] outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Fecha de Nacimiento y Género */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#475569] mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-[#94A3B8]" /> Fecha de Nacimiento
                  </span>
                  {edadCalculada && (
                    <span className="text-[11px] font-bold text-[var(--brand-primary)]">
                      {edadCalculada}
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  value={form.fecha_nacimiento}
                  onChange={(e) => {
                    const next = { ...form, fecha_nacimiento: e.target.value };
                    setForm(next);
                    handleSavePersonal(next);
                  }}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0B1929] outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] mb-1.5 flex items-center gap-1.5">
                  <Users size={13} className="text-[#94A3B8]" /> Género
                </label>
                <CustomSelect
                  value={form.genero}
                  onChange={(val) => {
                    const next = { ...form, genero: val };
                    setForm(next);
                    handleSavePersonal(next);
                  }}
                  placeholder="Selecciona género..."
                  options={[
                    { value: "", label: "Selecciona..." },
                    { value: "Femenino", label: "Femenino" },
                    { value: "Masculino", label: "Masculino" },
                  ]}
                />
              </div>
            </div>

            {/* Ubicación: País y Estado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#475569] mb-1.5 flex items-center gap-1.5">
                  <Globe size={13} className="text-[#94A3B8]" /> País
                </label>
                <CustomSelect
                  value={form.pais}
                  onChange={(val) => {
                    const next = { ...form, pais: val };
                    setForm(next);
                    handleSavePersonal(next);
                  }}
                  placeholder="Selecciona país..."
                  options={PAISES}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] mb-1.5 flex items-center gap-1.5">
                  <MapPin size={13} className="text-[#94A3B8]" /> Estado / Región
                </label>
                {form.pais === "México" ? (
                  <CustomSelect
                    value={form.estado_provincia}
                    onChange={(val) => {
                      const next = { ...form, estado_provincia: val };
                      setForm(next);
                      handleSavePersonal(next);
                    }}
                    placeholder="Selecciona estado..."
                    options={[
                      { value: "", label: "Selecciona..." },
                      ...ESTADOS_MEXICO,
                    ]}
                  />
                ) : (
                  <input
                    type="text"
                    value={form.estado_provincia}
                    onChange={(e) => setForm({ ...form, estado_provincia: e.target.value })}
                    onBlur={() => handleSavePersonal(form)}
                    placeholder="Provincia / Región"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0B1929] outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] focus:bg-white transition-all"
                  />
                )}
              </div>
            </div>

            {/* Correo informativo / Credencial fija */}
            <div className="pt-1">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs text-[#6B7A8D]">
                <div className="flex items-center gap-2 truncate">
                  <Lock size={13} className="text-[#94A3B8] shrink-0" />
                  <span className="truncate">
                    Cuenta: <strong className="text-[#0B1929]">{form.email || user?.email}</strong>
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-slate-400 shrink-0 ml-2">
                  No modificable
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. CARD: Mi Especialista Asignado (Si aplica) */}
        {isCliente && miNutriologo && (
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-[#E2E8F0] shadow-2xs">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#F1F5F9]">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <User size={18} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
                  Mi Especialista
                </h3>
                <p className="text-[11px] sm:text-xs text-[#6B7A8D]">
                  Profesional de salud a cargo de tu plan
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4">
              <div className="shrink-0">
                {miNutriologo.logo_url || miNutriologo.avatar_url ? (
                  <CachedImage
                    src={miNutriologo.logo_url || miNutriologo.avatar_url}
                    alt="Especialista"
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-slate-100 shadow-xs bg-[#F8FAFC]"
                    fallback={
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#F0F4FA] text-[#6B7A8D] flex items-center justify-center border border-[#CBD5E1]">
                        <User size={28} />
                      </div>
                    }
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#F0F4FA] text-[#6B7A8D] flex items-center justify-center border border-[#CBD5E1]">
                    <User size={28} />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-base font-bold text-[#0B1929]">{miNutriologo.nombre}</h4>
                {miNutriologo.nombre_marca && (
                  <p className="text-xs font-bold text-[var(--brand-primary)] mt-0.5">
                    {miNutriologo.nombre_marca}
                  </p>
                )}
                {miNutriologo.especialidad && (
                  <p className="text-[11px] font-semibold text-[#6B7A8D] uppercase tracking-wide mt-0.5">
                    {miNutriologo.especialidad}
                  </p>
                )}

                {/* Acciones de contacto rápido */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3.5">
                  {miNutriologo.telefono && (() => {
                    const cleanPhone = miNutriologo.telefono.replace(/\D/g, "");
                    return (
                      <a
                        href={`https://wa.me/${cleanPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#25D366] hover:bg-[#20bd5a] transition-colors shadow-2xs"
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                    );
                  })()}

                  {miNutriologo.mapa_url && (
                    <a
                      href={miNutriologo.mapa_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[var(--brand-primary)] bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <MapPin size={14} /> Ver Consultorio
                    </a>
                  )}

                  {miNutriologo.email && (
                    <a
                      href={`mailto:${miNutriologo.email}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#475569] bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      <Mail size={13} /> {miNutriologo.email}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. CARD: Cuenta & Acciones */}
        <div className="space-y-3 pt-2">
          {/* Botón de Tienda (Solo si no es app nativa instalada) */}
          {!(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) &&
            !(window.Capacitor && window.Capacitor.isNativePlatform()) && (
              <button
                type="button"
                onClick={() => (window.location.href = "/")}
                className="w-full py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm text-[#0B1929] bg-white hover:bg-slate-50 border border-[#E2E8F0] shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ShoppingBag size={16} /> Ir a la tienda oficial FLUX
              </button>
            )}

          {/* Botón de Cerrar Sesión */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm text-red-600 bg-red-50/70 hover:bg-red-100/70 border border-red-200/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogOut size={16} /> Cerrar Sesión
            </button>
          )}

          {/* Zona de Privacidad y Baja de Cuenta (Requisito Google Play) */}
          {!isSuperadmin && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                  <Trash2 size={14} className="text-red-500" />
                  Eliminar mi cuenta y datos personales
                </h4>
                <p className="text-[11px] text-[#6B7A8D] leading-relaxed">
                  Solicita la baja definitiva e irreversible de registros conforme a normativas de privacidad.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteText("");
                  setDeleteError("");
                  setShowDeleteModal(true);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors shrink-0 self-end sm:self-auto cursor-pointer"
              >
                Eliminar cuenta
              </button>
            </div>
          )}

          {/* Pie de versión discreto */}
          <div className="text-center pt-2 text-[11px] text-[#94A3B8]">
            <p className="font-medium">FLUX Fitness & Health</p>
            <p className="text-[10px] text-[#CBD5E1] mt-0.5">Todos los datos personales están protegidos</p>
          </div>
        </div>

        {/* Modal de Confirmación de Eliminación de Cuenta */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-[110] bg-[#0B1929]/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-[#E2E8F0] animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
                      ¿Eliminar cuenta definitivamente?
                    </h3>
                    <p className="text-xs text-[#6B7A8D]">Esta acción es permanente e irreversible</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !isDeleting && setShowDeleteModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-[#6B7A8D] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="bg-red-50/70 border border-red-100 rounded-2xl p-3.5 text-xs text-red-900 space-y-1.5 mb-4 leading-relaxed">
                {isCliente ? (
                  <p>
                    Se eliminará tu cuenta de acceso, perfil personal, planes asociados, historial de entrenamientos, mediciones y fotografías de progreso de forma definitiva.
                  </p>
                ) : (
                  <p>
                    Se eliminará tu perfil profesional, credenciales de acceso y configuración de consultorio. Tus pacientes registrados conservarán sus cuentas personales como usuarios independientes.
                  </p>
                )}
              </div>

              <div className="space-y-2 mb-5">
                <label className="block text-xs font-bold text-[#0B1929]">
                  Escribe <span className="font-mono text-red-600 bg-red-50 px-1.5 py-0.5 rounded">ELIMINAR</span> para confirmar la baja definitiva:
                </label>
                <input
                  type="text"
                  value={confirmDeleteText}
                  onChange={(e) => setConfirmDeleteText(e.target.value)}
                  placeholder="ELIMINAR"
                  disabled={isDeleting}
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm font-mono text-[#0B1929] focus:outline-none focus:border-red-500"
                />
                {deleteError && (
                  <p className="text-xs text-red-600 font-medium mt-1">{deleteError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#6B7A8D] bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={confirmDeleteText.trim().toUpperCase() !== "ELIMINAR" || isDeleting}
                  onClick={handleDeleteOwnAccount}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2 ${
                    confirmDeleteText.trim().toUpperCase() === "ELIMINAR" && !isDeleting
                      ? "bg-red-600 hover:bg-red-700 shadow-sm cursor-pointer"
                      : "bg-red-300 cursor-not-allowed"
                  }`}
                >
                  <Trash2 size={14} />
                  <span>{isDeleting ? "Eliminando cuenta..." : "Confirmar eliminación"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
