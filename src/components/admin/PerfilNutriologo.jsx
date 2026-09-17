import { useState, useEffect, useRef } from "react";
import { dbGet, dbPatch, dbPost } from "../../lib/supabase";
import { User, LogOut, CheckCircle2, RefreshCw, ShoppingBag, CreditCard, Loader2, XCircle } from "lucide-react";
import { useBrand } from "../BrandContext";
import DatosPersonalesCard from "./DatosPersonalesCard";
import IdentidadEmpresarialCard from "./IdentidadEmpresarialCard";
import RoleSwitcher from "../RoleSwitcher";
import { syncPersonalData } from "../../lib/supabase";

export default function PerfilNutriologo({ profileId, onLogout, role, onChangeRole, multiRoles }) {
    const [loading, setLoading] = useState(true);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const isSuperadmin = role === "superadmin";
  const isTeam = role === "staff" || role === "administrativo";

  const [personalForm, setPersonalForm] = useState({
    nombre: "", telefono: "", email: "", avatar_url: "", fecha_nacimiento: "", genero: "", pais: "México", estado_provincia: ""
  });

  const [businessForm, setBusinessForm] = useState({
    nombre_marca: "", especialidad: "", ubicacion_texto: "", cedula: "", mapa_url: "", color_primario: "#1A6FD4", logo_url: ""
  });

  const [bossId, setBossId] = useState(null);

  // Config de cobro (solo superadmin)
  const [configPago, setConfigPago] = useState({ clabe: "", banco: "", beneficiario: "" });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);
  const [configError, setConfigError] = useState(false);
  const isFirstRenderConfig = useRef(true);
  const [solicitudes, setSolicitudes] = useState([]);

  useEffect(() => { loadProfile(); }, [profileId]);

  const loadProfile = async () => {
    try {
      const rows = await dbGet(`profiles?id=eq.${profileId}`);
      if (rows.length > 0) {
        const p = rows[0];
        setPersonalForm({
          nombre: p.nombre || "",
          telefono: p.telefono || "",
          email: p.email || "",
          avatar_url: p.avatar_url || "",
          fecha_nacimiento: p.fecha_nacimiento || "",
          genero: p.genero || "",
          pais: p.pais || "México",
          estado_provincia: p.estado_provincia || ""
        });

        const targetBusinessId = (isTeam && p.nutriologo_id) ? p.nutriologo_id : profileId;
        setBossId(targetBusinessId);

        const busRows = await dbGet(`profiles?id=eq.${targetBusinessId}`);
        if (busRows.length > 0) {
          const b = busRows[0];
          setBusinessForm({
            nombre_marca: b.nombre_marca || "",
            especialidad: b.especialidad || "",
            ubicacion_texto: b.ubicacion_texto || "",
            cedula: b.cedula || "",
            mapa_url: b.mapa_url || "",
            color_primario: b.color_primario || "#1A6FD4",
            logo_url: b.logo_url || ""
          });
                  }

        if (p.email && !isTeam) {
          const reqs = await dbGet(`solicitudes_entrenamiento?to_email=eq.${p.email}&estado=eq.pendiente`);
          setSolicitudes(reqs);
        }
      }

      if (isSuperadmin || isTeam) {
        const cfg = await dbGet("configuracion_plataforma?id=eq.1");
        if (cfg && cfg.length > 0) {
          setConfigPago({
            clabe: cfg[0].clabe || "",
            banco: cfg[0].banco || "",
            beneficiario: cfg[0].beneficiario || ""
          });
        }
      }
    } catch (error) {
      setErr("Error cargando perfil: " + error.message);
    }
    setLoading(false);
  };

  const handleSavePersonal = async (formData) => {
    setSavingPersonal(true);
    try {
      await syncPersonalData(personalForm.email, formData);
      if (multiRoles) {
        multiRoles.forEach(r => {
          if (r.data) Object.assign(r.data, formData);
        });
        localStorage.setItem("flux_multi_roles", JSON.stringify(multiRoles));
      }
    } catch (e) {
      setErr("Error guardando datos personales.");
    }
    setSavingPersonal(false);
  };

  const handleSaveBusiness = async (formData) => {
    setSavingBusiness(true);
    try {
      if (bossId) {
        await dbPatch(`profiles?id=eq.${bossId}`, formData);
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

  const handleStore = () => window.open('https://flux-sport.mitiendanube.com/', '_blank');

  return (
    <div className="max-w-4xl mx-auto w-full pb-10 px-4 sm:px-6 md:px-8 pt-4 overflow-x-hidden">
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
                    await dbPost("clientes", { nombre: personalForm.nombre || "Colega", objetivo: "Entrenamiento entre colegas", email: personalForm.email, telefono: personalForm.telefono, nutriologo_id: req.from_nutriologo_id, auth_id: profileId, activo: true });
                    await dbPatch(`solicitudes_entrenamiento?id=eq.${req.id}`, {estado:'aceptada'}); 
                    loadProfile(); 
                  }} className="px-4 py-2 text-sm font-bold bg-[var(--brand-primary)] text-white rounded-lg hover:opacity-90 flex-1">Aceptar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DatosPersonalesCard form={personalForm} setForm={setPersonalForm} onSave={handleSavePersonal} loading={loading} isSaving={savingPersonal} />
      <IdentidadEmpresarialCard form={businessForm} setForm={setBusinessForm} onSave={handleSaveBusiness} loading={loading} isSaving={savingBusiness} />
      <RoleSwitcher currentRole={role} multiRoles={multiRoles} onChangeRole={onChangeRole} />

      <div className="mt-10 flex flex-col sm:flex-row gap-4">
        <button onClick={handleStore} className="sm:w-auto w-full py-3.5 px-6 rounded-xl font-bold text-[#0B1929] bg-white hover:bg-gray-50 border border-[#E2E8F0] flex items-center justify-center gap-2 transition-all shadow-sm">
          <ShoppingBag size={18} /> Ir a la tienda FLUX
        </button>
        <button onClick={onLogout} className="sm:w-auto w-full py-3.5 px-6 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center gap-2 transition-all">
          <LogOut size={18} /> Salir
        </button>
      </div>

      {/* Sección de datos de cobro */}
      {(isSuperadmin || isTeam) && (
        <div className="mt-10 border-t border-[#E2E8F0] pt-8">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-[#0B1929] flex items-center gap-2">
              <CreditCard size={18} className="text-[var(--brand-primary)]" /> Datos de Cobro (SPEI)
            </h3>
            <div className="h-6 flex items-center justify-end min-w-[24px]">
              {savingConfig && <Loader2 size={16} className="text-[#6B7A8D] animate-spin" />}
              {configSuccess && !savingConfig && <CheckCircle2 size={16} className="text-green-500" />}
              {configError && !savingConfig && <XCircle size={16} className="text-red-500" title="Error al guardar config" />}
            </div>
          </div>
          <p className="text-xs text-[#6B7A8D] mb-5">
            {isSuperadmin ? 'Esta información aparecerá en el panel de "Mi Membresía" de cada nutriólogo.' : 'Datos de la cuenta a la que los nutriólogos realizan sus pagos.'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Banco</label>
              <input className={`w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-[14px] focus:outline-none ${isSuperadmin ? 'focus:ring-2 focus:ring-[var(--brand-primary)]' : 'bg-gray-50 text-[#6B7A8D] cursor-not-allowed'}`} placeholder="Ej. BBVA, BANAMEX..." value={configPago.banco} onChange={e => isSuperadmin && setConfigPago(p => ({ ...p, banco: e.target.value }))} readOnly={!isSuperadmin} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">CLABE Interbancaria</label>
              <input className={`w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-[14px] font-mono tracking-widest focus:outline-none ${isSuperadmin ? 'focus:ring-2 focus:ring-[var(--brand-primary)]' : 'bg-gray-50 text-[#6B7A8D] cursor-not-allowed'}`} placeholder="000000000000000000" maxLength={18} value={configPago.clabe} onChange={e => isSuperadmin && setConfigPago(p => ({ ...p, clabe: e.target.value.replace(/\D/g, '') }))} readOnly={!isSuperadmin} />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Beneficiario</label>
              <input className={`w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-[14px] focus:outline-none ${isSuperadmin ? 'focus:ring-2 focus:ring-[var(--brand-primary)]' : 'bg-gray-50 text-[#6B7A8D] cursor-not-allowed'}`} placeholder="Ej. Flux Technologies SA de CV" value={configPago.beneficiario} onChange={e => isSuperadmin && setConfigPago(p => ({ ...p, beneficiario: e.target.value }))} readOnly={!isSuperadmin} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
