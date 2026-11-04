import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { dbPeek, dbGet, dbPatch, dbPost } from"../../lib/supabase";
import { peekClinicalRecord, saveClinicalRecord } from "../../lib/clinicalRecord";
import { User, LogOut, CheckCircle2, RefreshCw, ShoppingBag, CreditCard, Loader2, XCircle, Trash2, AlertTriangle, X } from"lucide-react";
import { useBrand } from"../BrandContext";
import DatosPersonalesCard from"./DatosPersonalesCard";
import IdentidadEmpresarialCard from"./IdentidadEmpresarialCard";
import RoleSwitcher from"../RoleSwitcher";
import { syncPersonalData } from"../../lib/supabase";
import { isNativePlayApp } from "../../lib/playBilling";
import { refreshUserRoles, deleteNutriologoAccount, deleteCollaboratorAccount } from "../../lib/authRoles";

export default function PerfilNutriologo({ profileId, onLogout, role, onChangeRole, onRolesUpdated, multiRoles }) {
  const navigate = useNavigate();
  const isPlayApp = isNativePlayApp();
  const _peekRows = profileId ? dbPeek(`profiles?id=eq.${profileId}`) : null;
  const _peekP = Array.isArray(_peekRows) && _peekRows.length > 0 ? _peekRows[0] : null;
  const _peekCfg = dbPeek("configuracion_plataforma?id=eq.1");
  const _peekC = Array.isArray(_peekCfg) && _peekCfg.length > 0 ? _peekCfg[0] : null;

  const [loading, setLoading] = useState(() => !_peekP);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const isSuperadmin = role ==="superadmin";
  const isTeam = role ==="staff" || role ==="administrativo";

  const [currentMultiRoles, setCurrentMultiRoles] = useState(multiRoles || []);

  const [personalForm, setPersonalForm] = useState(() => ({
    nombre: _peekP?.nombre ||"",
    telefono: _peekP?.telefono ||"",
    email: _peekP?.email ||"",
    avatar_url: _peekP?.avatar_url ||"",
    fecha_nacimiento: _peekP?.fecha_nacimiento ||"",
    genero: _peekP?.genero ||"",
    pais: _peekP?.pais ||"México",
    estado_provincia: _peekP?.estado_provincia ||""
  }));

  const [businessForm, setBusinessForm] = useState(() => ({
    nombre_marca: _peekP?.nombre_marca ||"",
    especialidad: _peekP?.especialidad ||"",
    ubicacion_texto: _peekP?.ubicacion_texto ||"",
    cedula: _peekP?.cedula ||"",
    mapa_url: _peekP?.mapa_url ||"",
    color_primario: _peekP?.color_primario ||"#1A6FD4",
    logo_url: _peekP?.logo_url ||""
  }));

  const [bossId, setBossId] = useState(null);

  // Config de cobro (solo superadmin)
  const [configPago, setConfigPago] = useState(() => ({
    clabe: _peekC?.clabe ||"",
    banco: _peekC?.banco ||"",
    beneficiario: _peekC?.beneficiario ||""
  }));
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);
  const [configError, setConfigError] = useState(false);
  const isFirstRenderConfig = useRef(true);
  const hasPatchedEmailRef = useRef(false);
  const [solicitudes, setSolicitudes] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    loadProfile();
    let timer = null;
    const onCacheUpdated = (ev) => {
      const table = ev?.detail?.table;
      if (table && !["profiles", "solicitudes_profesionales", "configuracion_app", "*"].includes(table)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => loadProfile(), 250);
    };
    window.addEventListener("flux:cache-updated", onCacheUpdated);
    window.addEventListener("flux:synced", onCacheUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("flux:cache-updated", onCacheUpdated);
      window.removeEventListener("flux:synced", onCacheUpdated);
    };
  }, [profileId]);

  const loadProfile = async () => {
    try {
      const rows = await dbGet(`profiles?id=eq.${profileId}`);
      if (rows.length > 0) {
        const p = rows[0];
        let resolvedEmail = p.email || "";
        if (!resolvedEmail) {
          try {
            const tok = localStorage.getItem("flux_token");
            if (tok) {
              const payload = JSON.parse(atob(tok.split(".")[1]));
              if (payload.email) {
                resolvedEmail = payload.email.trim();
                if (!hasPatchedEmailRef.current) {
                  hasPatchedEmailRef.current = true;
                  dbPatch(`profiles?id=eq.${profileId}`, { email: resolvedEmail }).catch(() => {});
                }
              }
            }
          } catch {}
        }
        setPersonalForm({
          nombre: p.nombre ||"",
          telefono: p.telefono ||"",
          email: resolvedEmail,
          avatar_url: p.avatar_url ||"",
          fecha_nacimiento: p.fecha_nacimiento ||"",
          genero: p.genero ||"",
          pais: p.pais ||"México",
          estado_provincia: p.estado_provincia ||""
        });

        const targetBusinessId = (isTeam && p.nutriologo_id) ? p.nutriologo_id : profileId;
        setBossId(targetBusinessId);

        const busRows = await dbGet(`profiles?id=eq.${targetBusinessId}`);
        if (busRows.length > 0) {
          const b = busRows[0];
          setBusinessForm({
            nombre_marca: b.nombre_marca ||"",
            especialidad: b.especialidad ||"",
            ubicacion_texto: b.ubicacion_texto ||"",
            cedula: b.cedula ||"",
            mapa_url: b.mapa_url ||"",
            color_primario: b.color_primario ||"#1A6FD4",
            logo_url: b.logo_url ||""
          });
                  }

        if (resolvedEmail && !isTeam) {
          const reqs = await dbGet(`solicitudes_entrenamiento?to_email=ilike.${encodeURIComponent(resolvedEmail)}&estado=eq.pendiente`);
          setSolicitudes(reqs);
        }
      }

      if (isSuperadmin || isTeam) {
        const cfg = await dbGet("configuracion_plataforma?id=eq.1");
        if (cfg && cfg.length > 0) {
          setConfigPago({
            clabe: cfg[0].clabe ||"",
            banco: cfg[0].banco ||"",
            beneficiario: cfg[0].beneficiario ||""
          });
        }
      }
    } catch (error) {
      setErr("Error cargando perfil:" + error.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (multiRoles && multiRoles.length > 0) {
      setCurrentMultiRoles(multiRoles);
    }
  }, [multiRoles]);

  useEffect(() => {
    if (!profileId && !personalForm.email) return;
    refreshUserRoles(profileId, personalForm.email).then(roles => {
      if (roles && roles.length > 0) {
        setCurrentMultiRoles(roles);
        try { localStorage.setItem("flux_multi_roles", JSON.stringify(roles)); } catch {}
        if (typeof onRolesUpdated === "function") {
          onRolesUpdated(roles);
        }
      }
    }).catch(e => console.error("Error refreshing roles in PerfilNutriologo:", e));
  }, [profileId, personalForm.email]);

  const handleSavePersonal = async (formData) => {
    setSavingPersonal(true);
    try {
      await syncPersonalData(personalForm.email, formData);
      window.dispatchEvent(new CustomEvent("flux:profile-updated", { detail: formData }));
      if (currentMultiRoles && currentMultiRoles.length > 0) {
        currentMultiRoles.forEach(r => {
          if (r.data) Object.assign(r.data, formData);
        });
        localStorage.setItem("flux_multi_roles", JSON.stringify(currentMultiRoles));
      }

      // Sincronizar también con el expediente clínico de su propio "Mi Plan" (cliente sombra) si existe
      if (profileId) {
        try {
          const shadowRows = await dbGet(`clientes?nutriologo_id=eq.${profileId}&objetivo=eq.${encodeURIComponent("Mi entrenamiento personal")}&select=id`).catch(() => []);
          const shadowId = shadowRows?.[0]?.id;
          if (shadowId) {
            const rec = peekClinicalRecord(shadowId);
            const nextRec = {
              ...rec,
              anamnesis: {
                ...rec.anamnesis,
                telefono: formData.telefono !== undefined ? formData.telefono : rec.anamnesis?.telefono,
                fecha_nacimiento: formData.fecha_nacimiento !== undefined ? (formData.fecha_nacimiento || null) : rec.anamnesis?.fecha_nacimiento,
                sexo: formData.genero ? (formData.genero.toLowerCase().startsWith("f") ? "F" : "M") : rec.anamnesis?.sexo,
                updated_at: new Date().toISOString()
              }
            };
            await saveClinicalRecord(shadowId, nextRec);
          }
        } catch (clinicalErr) {
          console.warn("Aviso sincronizando perfil de nutriólogo con Mi Plan:", clinicalErr);
        }
      }
    } catch (e) {
      setErr("Error guardando datos personales: " + (e.message || ""));
    }
    setSavingPersonal(false);
  };

  const handleDeleteOwnAccount = async () => {
    if (confirmDeleteText.trim().toUpperCase() !== "ELIMINAR" || isSuperadmin) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      const targetEmail = (personalForm?.email || "").trim();
      if (isTeam) {
        await deleteCollaboratorAccount({
          profileId,
          email: targetEmail
        });
      } else {
        await deleteNutriologoAccount({
          nutriologoId: profileId,
          email: targetEmail
        });
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

  const handleSaveBusiness = async (formData) => {
    setSavingBusiness(true);
    try {
      if (bossId) {
        await dbPatch(`profiles?id=eq.${bossId}`, formData);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("flux:brand-updated"));
        }
      }
    } catch (e) {
      setErr("Error guardando datos empresariales.");
    }
    setSavingBusiness(false);
  };

  useEffect(() => {
    if (!isSuperadmin || loading || isFirstRenderConfig.current) {
      isFirstRenderConfig.current = false;
      return;
    }
    const timeoutId = setTimeout(async () => {
      setSavingConfig(true);
      setConfigSuccess(false);
      setConfigError(false);
      try {
        await dbPatch("configuracion_plataforma?id=eq.1", { ...configPago, updated_at: new Date().toISOString() });
        setConfigSuccess(true);
        setTimeout(() => setConfigSuccess(false), 2000);
      } catch (error) {
        setConfigError(true);
      }
      setSavingConfig(false);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [configPago.clabe, configPago.banco, configPago.beneficiario]);

  return (
    <div className="w-full flex-1 flex flex-col bg-[#F7F9FC]">
      {/* Header estandarizado */}
      <div className="px-4 md:px-8 py-3 md:pt-8 md:pb-6 bg-white border-b border-[#F0F4FA] pr-12 md:pr-8">
        <p className="hidden md:block text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">
          Mi Cuenta
        </p>
        <h1 className="text-lg md:text-2xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
          Mi Perfil
        </h1>
        <p className="hidden md:block text-sm text-[#6B7A8D] mt-1">
          Gestiona tu información personal e identidad en la plataforma.
        </p>
      </div>

      <div className="max-w-4xl mx-auto w-full pb-28 md:pb-8 px-0 md:px-8 pt-0 md:pt-6 overflow-x-hidden">
      {err && <div className="mb-4 bg-red-50 text-red-600 p-4 rounded-xl border border-red-200">{err}</div>}
      {msg && <div className="mb-4 bg-green-50 text-green-600 p-4 rounded-xl border border-green-200">{msg}</div>}

      {/* BUZÓN DE SOLICITUDES DE ENTRENAMIENTO */}
      {solicitudes.length > 0 && !isTeam && (
        <div className="mb-8 p-5 bg-slate-50 border border-slate-200 rounded-2xl">
          <h3 className="font-bold text-[#0B1929] flex items-center gap-2 mb-3">
            <User size={18} className="text-[var(--brand-primary)]" /> Solicitudes de Paciente
          </h3>
          <div className="flex flex-col gap-3">
            {solicitudes.map(req => (
              <div key={req.id} className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-[#0B1929]">
                  <strong>{req.from_nutriologo_nombre}</strong> desea agregarte como paciente para asignarte planes.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
                  <button onClick={async () => { await dbPatch(`solicitudes_entrenamiento?id=eq.${req.id}`, {estado:'rechazada'}); loadProfile(); }} className="px-4 py-2 text-sm font-medium border border-[#E2E8F0] text-[#6B7A8D] rounded-lg hover:bg-gray-50 flex-1">Rechazar</button>
                  <button onClick={async () => { 
                    await dbPost("clientes", {
                      nombre: personalForm.nombre || "Colega",
                      objetivo: "Entrenamiento entre colegas",
                      email: personalForm.email,
                      telefono: personalForm.telefono || null,
                      fecha_nacimiento: personalForm.fecha_nacimiento || null,
                      genero: personalForm.genero || null,
                      pais: personalForm.pais || "México",
                      estado_provincia: personalForm.estado_provincia || null,
                      avatar_url: personalForm.avatar_url || null,
                      nutriologo_id: req.from_nutriologo_id,
                      auth_id: profileId,
                      activo: true
                    });
                    await dbPatch(`solicitudes_entrenamiento?id=eq.${req.id}`, {estado:'aceptada'}); 
                    await loadProfile();
                    const updatedRoles = await refreshUserRoles(profileId, personalForm.email).catch(() => []);
                    if (updatedRoles && updatedRoles.length > 0) {
                      setCurrentMultiRoles(updatedRoles);
                      try { localStorage.setItem("flux_multi_roles", JSON.stringify(updatedRoles)); } catch {}
                      if (typeof onRolesUpdated === "function") onRolesUpdated(updatedRoles);
                    }
                  }} className="px-4 py-2 text-sm font-bold bg-[var(--brand-primary)] text-white rounded-lg hover:opacity-90 flex-1">Aceptar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <RoleSwitcher currentRole={role} multiRoles={currentMultiRoles} onChangeRole={onChangeRole} />

      <DatosPersonalesCard form={personalForm} setForm={setPersonalForm} onSave={handleSavePersonal} loading={loading} isSaving={savingPersonal} />
      <IdentidadEmpresarialCard 
        form={businessForm} 
        setForm={setBusinessForm} 
        onSave={handleSaveBusiness} 
        loading={loading} 
        isSaving={savingBusiness}
        isSuperadmin={isSuperadmin}
      >
        {/* Datos de Cobro (SPEI): Exclusivo para Superadmin/Team en PWA/Web (Oculto en Play Store por políticas de tienda) */}
        {!isPlayApp && (isSuperadmin || isTeam) && (
          <div className="mt-8 pt-8 border-t border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-[#0B1929] flex items-center gap-2">
                <CreditCard size={18} className="text-[var(--brand-primary)]" /> Datos de Cobro de la Plataforma (SPEI)
              </h3>
              <div className="h-6 flex items-center justify-end min-w-[24px]">
                {savingConfig && <Loader2 size={16} className="text-[#6B7A8D] animate-spin" />}
                {configSuccess && !savingConfig && <CheckCircle2 size={16} className="text-green-500" />}
                {configError && !savingConfig && <XCircle size={16} className="text-red-500" title="Error al guardar config" />}
              </div>
            </div>
            <p className="text-xs text-[#6B7A8D] mb-5">
              {isSuperadmin 
                ? 'Cuenta bancaria a la que los nutriólogos y atletas realizan sus transferencias SPEI en la versión Web.' 
                : 'Datos de la cuenta a la que los nutriólogos realizan sus pagos.'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Banco</label>
                <input 
                  className={`w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F7F9FC] text-[14px] text-[#0B1929] focus:outline-none ${isSuperadmin ? 'focus:ring-2 focus:ring-[var(--brand-primary)] focus:bg-white' : 'text-[#6B7A8D] cursor-not-allowed'}`} 
                  placeholder="Ej. BBVA, BANAMEX..." 
                  value={configPago.banco} 
                  onChange={e => isSuperadmin && setConfigPago(p => ({ ...p, banco: e.target.value }))} 
                  readOnly={!isSuperadmin} 
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">CLABE Interbancaria (18 dígitos)</label>
                <input 
                  className={`w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F7F9FC] text-[14px] font-mono tracking-widest text-[#0B1929] focus:outline-none ${isSuperadmin ? 'focus:ring-2 focus:ring-[var(--brand-primary)] focus:bg-white' : 'text-[#6B7A8D] cursor-not-allowed'}`} 
                  placeholder="000000000000000000" 
                  maxLength={18} 
                  value={configPago.clabe} 
                  onChange={e => isSuperadmin && setConfigPago(p => ({ ...p, clabe: e.target.value.replace(/\D/g, '') }))} 
                  readOnly={!isSuperadmin} 
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Beneficiario / Razón Social</label>
                <input 
                  className={`w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F7F9FC] text-[14px] text-[#0B1929] focus:outline-none ${isSuperadmin ? 'focus:ring-2 focus:ring-[var(--brand-primary)] focus:bg-white' : 'text-[#6B7A8D] cursor-not-allowed'}`} 
                  placeholder="Ej. Flux Technologies SA de CV" 
                  value={configPago.beneficiario} 
                  onChange={e => isSuperadmin && setConfigPago(p => ({ ...p, beneficiario: e.target.value }))} 
                  readOnly={!isSuperadmin} 
                />
              </div>
            </div>
          </div>
        )}
      </IdentidadEmpresarialCard>

      <div className="bg-white md:bg-transparent px-4 pt-3 pb-0 md:p-0 border-t md:border-0 border-[#E2E8F0] flex flex-col sm:flex-row gap-3 md:gap-4 mt-0 md:mt-8">
        {!(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) && !(window.Capacitor && window.Capacitor.isNativePlatform()) && (
          <button onClick={() => window.location.href = "/"} className="sm:w-auto w-full py-3.5 px-6 rounded-xl font-bold text-[#0B1929] bg-white hover:bg-gray-50 border border-[#E2E8F0] flex items-center justify-center gap-2 transition-all shadow-sm">
            <ShoppingBag size={18} /> Ir a la tienda FLUX
          </button>
        )}
        <button onClick={onLogout} className="sm:w-auto w-full py-3.5 px-6 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center gap-2 transition-all">
          <LogOut size={18} /> Salir
        </button>
      </div>

      {!isSuperadmin && (
        <div className="px-4 md:px-0 mt-6 pt-4 border-t border-[#E2E8F0]/60 flex justify-center md:justify-start">
          <button
            type="button"
            onClick={() => {
              setConfirmDeleteText("");
              setDeleteError("");
              setShowDeleteModal(true);
            }}
            className="text-xs font-medium text-[#94A3B8] hover:text-red-600 flex items-center gap-1.5 py-2 transition-colors cursor-pointer"
          >
            <Trash2 size={14} />
            <span>Dar de baja mi cuenta permanentemente</span>
          </button>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] bg-[#0B1929]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#E2E8F0] shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans, sans-serif" }}>
                    Eliminar cuenta definitivamente
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
              <p>
                Se eliminará tu perfil profesional, credenciales de acceso, configuración de consultorio y los expedientes clínicos vinculados a este consultorio. Los pacientes que cuenten con un perfil independiente o en otro consultorio conservarán esas cuentas intactas.
              </p>
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
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#6B7A8D] hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting || confirmDeleteText.trim().toUpperCase() !== "ELIMINAR"}
                onClick={handleDeleteOwnAccount}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  confirmDeleteText.trim().toUpperCase() === "ELIMINAR" && !isDeleting
                    ? "bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-md shadow-red-500/20"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Confirmar baja definitiva</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
