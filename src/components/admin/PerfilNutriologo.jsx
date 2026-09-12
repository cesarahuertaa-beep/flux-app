import { useState, useEffect, useRef } from "react";
import { dbGet, dbPatch, dbPost, storageUpload } from "../../lib/supabase";
import { Capacitor } from "@capacitor/core";
import { User, Image as ImageIcon, MapPin, Link as LinkIcon, Phone, Save, LogOut, CheckCircle2, AlertCircle, Building2, ShoppingBag, RefreshCw, CreditCard } from "lucide-react";
import { useBrand } from "../BrandContext";

export default function PerfilNutriologo({ profileId, onLogout, role, onChangeRole, multiRoles }) {
  const { setBrandColor } = useBrand();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    nombre: "",
    nombre_marca: "",
    telefono: "",
    especialidad: "",
    ubicacion_texto: "",
    mapa_url: "",
    color_primario: "#1A6FD4",
    logo_url: "",
    email: ""
  });

  // Config de cobro (solo superadmin)
  const isSuperadmin = role === "superadmin";
  const [configPago, setConfigPago] = useState({ clabe: "", banco: "", beneficiario: "" });
  const [savingConfig, setSavingConfig] = useState(false);
  
  const [solicitudes, setSolicitudes] = useState([]);

  const fileInputRef = useRef(null);
  const loadProfile = async () => {
    try {
      const rows = await dbGet(`profiles?id=eq.${profileId}`);
      if (rows.length > 0) {
        const p = rows[0];
        setForm({
          nombre: p.nombre || "",
          nombre_marca: p.nombre_marca || "",
          telefono: p.telefono || "",
          especialidad: p.especialidad || "",
          ubicacion_texto: p.ubicacion_texto || "",
          mapa_url: p.mapa_url || "",
          color_primario: p.color_primario || "#1A6FD4",
          logo_url: p.logo_url || "",
          email: p.email || ""
        });
        
        if (p.email) {
          const reqs = await dbGet(`solicitudes_entrenamiento?to_email=eq.${p.email}&estado=eq.pendiente`);
          setSolicitudes(reqs);
        }
      }

      // Si es superadmin, cargar config de pago
      if (role === "superadmin") {
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
      console.error("Error cargando perfil", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, [profileId]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setErr("");
    setMsg("");
    try {
      await dbPatch("configuracion_plataforma?id=eq.1", {
        clabe: configPago.clabe,
        banco: configPago.banco,
        beneficiario: configPago.beneficiario,
        updated_at: new Date().toISOString()
      });
      setMsg("Datos de cobro actualizados correctamente.");
    } catch (error) {
      setErr("Error guardando config: " + error.message);
    }
    setSavingConfig(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleColorChange = (e) => {
    const val = e.target.value;
    setForm(prev => ({ ...prev, color_primario: val }));
    setBrandColor(val);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const ext = file.name.split(".").pop();
      const fname = `logo_${profileId}_${Date.now()}.${ext}`;
      // Usamos el bucket "avatars" (o "ejercicios" si avatars no existe, 
      // pero asumimos que crearán un bucket para fotos de perfil)
      const url = await storageUpload("ejercicios", fname, file); // fallback temporal a ejercicios si no hay bucket avatars
      setForm(prev => ({ ...prev, logo_url: url }));
      setMsg("Imagen subida. No olvides guardar los cambios.");
    } catch (error) {
      setErr("Error subiendo imagen: " + error.message);
    }
    setSaving(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      await dbPatch(`profiles?id=eq.${profileId}`, {
        nombre: form.nombre,
        nombre_marca: form.nombre_marca,
        telefono: form.telefono,
        especialidad: form.especialidad,
        ubicacion_texto: form.ubicacion_texto,
        mapa_url: form.mapa_url,
        color_primario: form.color_primario,
        logo_url: form.logo_url
      });
      setMsg("Perfil actualizado correctamente. Los cambios se reflejarán en la Landing Page.");
    } catch (error) {
      setErr("Error guardando perfil: " + error.message);
    }
    setSaving(false);
  };

  const handleAcceptRequest = async (req) => {
    setSaving(true);
    setErr("");
    try {
      await dbPost("clientes", {
        nombre: form.nombre || "Colega",
        objetivo: "Entrenamiento entre colegas",
        email: form.email,
        telefono: form.telefono,
        nutriologo_id: req.from_nutriologo_id,
        auth_id: profileId,
        activo: true
      });
      await dbPatch(`solicitudes_entrenamiento?id=eq.${req.id}`, { estado: 'aceptada' });
      setMsg(`✅ Eres ahora paciente de ${req.from_nutriologo_nombre}`);
      loadProfile();
    } catch (e) {
      setErr("Error al aceptar solicitud: " + e.message);
    }
    setSaving(false);
  };

  const handleRejectRequest = async (req) => {
    setSaving(true);
    try {
      await dbPatch(`solicitudes_entrenamiento?id=eq.${req.id}`, { estado: 'rechazada' });
      loadProfile();
    } catch (e) {
      setErr("Error al rechazar: " + e.message);
    }
    setSaving(false);
  };

  const isTeam = role === "administrativo" || role === "staff";

  const handleStore = () => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true || window.location.search.includes('pwa=true');
    const isAppMode = window.location.protocol === 'app:' || window.location.protocol === 'file:' || Capacitor.isNativePlatform() || isStandalone;
    if (isAppMode) {
      window.open("https://www.flux-sport.com", "_blank"); 
    } else {
      window.location.href = "/";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 border-4 border-[#1A6FD4]/30 border-t-[#1A6FD4] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-[#0B1929] tracking-tight" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          {isTeam ? "Configuración de Cuenta" : "Configuración de Profesional"}
        </h1>
        <p className="text-[#6B7A8D] mt-1">
          {isTeam ? "Actualiza tu información de contacto personal." : "Completa estos datos para aparecer correctamente en el Directorio Público."}
        </p>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#E2E8F0]">
        
        {msg && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2 text-sm">
            <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" /> <span>{msg}</span>
          </div>
        )}
        
        {err && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 flex items-center gap-2 text-sm">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0" /> <span>{err}</span>
          </div>
        )}

        {/* BUZÓN DE SOLICITUDES DE ENTRENAMIENTO */}
        {solicitudes.length > 0 && (
          <div className="mb-8 p-5 bg-blue-50 border border-blue-200 rounded-2xl">
            <h3 className="font-bold text-[#0B1929] flex items-center gap-2 mb-3">
              <User size={18} className="text-blue-600" /> Solicitudes de Paciente
            </h3>
            <div className="flex flex-col gap-3">
              {solicitudes.map(req => (
                <div key={req.id} className="bg-white p-4 rounded-xl border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-[#0B1929]">
                      <strong>{req.from_nutriologo_nombre}</strong> desea agregarte como paciente para asignarte planes de entrenamiento y dieta.
                    </p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto shrink-0">
                    <button 
                      onClick={() => handleRejectRequest(req)}
                      disabled={saving}
                      className="px-4 py-2 text-sm font-medium border border-[#E2E8F0] text-[#6B7A8D] rounded-lg hover:bg-gray-50 flex-1 sm:flex-none"
                    >
                      Rechazar
                    </button>
                    <button 
                      onClick={() => handleAcceptRequest(req)}
                      disabled={saving}
                      className="px-4 py-2 text-sm font-bold bg-[#1A6FD4] text-white rounded-lg hover:bg-[#155ab0] flex-1 sm:flex-none"
                    >
                      Aceptar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isTeam && (
          <div className="flex flex-col md:flex-row items-center gap-6 pb-8 border-b border-[#E2E8F0] mb-8">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg bg-[#F7F9FC]" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#F0F4FA] text-[#6B7A8D] flex items-center justify-center shadow-inner border-2 border-dashed border-[#CBD5E1] group-hover:border-[#1A6FD4] transition-colors">
                  <ImageIcon size={32} />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-[10px] font-bold uppercase tracking-wider">Cambiar Foto</span>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>
            <div className="flex-1 w-full text-center md:text-left">
              <h2 className="text-xl font-bold text-[#0B1929]">{form.nombre_marca || "Nombre de tu Consultorio"}</h2>
              <p className="text-[#6B7A8D] text-sm">Sube una foto tuya profesional o el logo de tu marca.</p>
            </div>
            <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto mt-4 md:mt-0">
              <label className="text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider">Color de Marca</label>
              <div className="flex items-center gap-2 bg-[#F0F4FA] rounded-xl p-1.5 border border-[#E2E8F0]">
                <input type="color" value={form.color_primario} onChange={handleColorChange} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none" />
                <span className="text-xs font-mono text-[#6B7A8D] px-2">{form.color_primario.toUpperCase()}</span>
              </div>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 ${!isTeam ? 'md:grid-cols-2' : ''} gap-6`}>
          <div className="space-y-4">
            <h3 className="font-bold text-[#0B1929] flex items-center gap-2"><User size={18} className="text-[#1A6FD4]"/> {isTeam ? "Mis Datos" : "Identidad"}</h3>
            
            <div>
              <label className="block text-xs font-bold text-[#6B7A8D] mb-2">Nombre Personal</label>
              <input type="text" name="nombre" value={form.nombre} onChange={handleChange} placeholder="Ej. Dr. Miguel Sánchez" className="w-full bg-[#F7F9FC] border border-[#E2E5EA] focus:border-[#1A6FD4] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors" />
            </div>

            {!isTeam && (
              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] mb-2">Nombre de Marca (App)</label>
                <input type="text" name="nombre_marca" value={form.nombre_marca} onChange={handleChange} placeholder="Ej. NutriFit Pro" className="w-full bg-[#F7F9FC] border border-[#E2E5EA] focus:border-[#1A6FD4] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors" />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#6B7A8D] mb-2 flex items-center gap-1.5"><Phone size={14}/> WhatsApp (Contacto)</label>
              <input type="tel" name="telefono" value={form.telefono} onChange={handleChange} placeholder="10 dígitos" className="w-full bg-[#F7F9FC] border border-[#E2E5EA] focus:border-[#1A6FD4] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors" />
            </div>
          </div>

          {!isTeam && (
            <div className="space-y-4">
              <h3 className="font-bold text-[#0B1929] flex items-center gap-2"><Building2 size={18} className="text-[#1A6FD4]"/> Directorio Público</h3>
              
              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] mb-2">Especialidad</label>
                <input type="text" name="especialidad" value={form.especialidad} onChange={handleChange} placeholder="Ej. Nutrición Deportiva | Vegana" className="w-full bg-[#F7F9FC] border border-[#E2E5EA] focus:border-[#1A6FD4] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors" />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] mb-2 flex items-center gap-1.5"><MapPin size={14}/> Ubicación (Texto Corto)</label>
                <input type="text" name="ubicacion_texto" value={form.ubicacion_texto} onChange={handleChange} placeholder="Ej. CDMX - Polanco" className="w-full bg-[#F7F9FC] border border-[#E2E5EA] focus:border-[#1A6FD4] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors" />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] mb-2 flex items-center gap-1.5"><LinkIcon size={14}/> Enlace de Google Maps</label>
                <input type="url" name="mapa_url" value={form.mapa_url} onChange={handleChange} placeholder="https://maps.app.goo.gl/..." className="w-full bg-[#F7F9FC] border border-[#E2E5EA] focus:border-[#1A6FD4] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors" />
              </div>
            </div>
          )}
        </div>

        {(multiRoles?.filter(r => r.role !== 'client') || []).length > 1 && (
          <div className="mt-8 border-t border-[#E2E8F0] pt-8">
            <h3 className="text-sm font-bold text-[#0B1929] mb-4 flex items-center gap-2">
              <RefreshCw size={16} className="text-[#6B7A8D]" />
              Cambiar Perfil (Sesión Múltiple)
            </h3>
            <div className="flex flex-col gap-2">
              {multiRoles.filter(r => r.role !== 'client').map((r, i) => {
                const isActive = (role === "admin" ? "admin" : role) === (r.role === "admin" ? "admin" : r.role);
                return (
                  <button
                    key={i}
                    disabled={isActive}
                    onClick={() => onChangeRole && onChangeRole(r)}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isActive ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5" : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1]"}`}
                  >
                    <div className="text-left">
                      <p className={`font-bold text-sm ${isActive ? "text-[var(--brand-primary)]" : "text-[#0B1929]"}`}>
                        {r.role === "client" ? "Paciente" : (r.role === "nutriologo" ? "Nutriólogo" : "Staff Administrativo")}
                      </p>
                      <p className="text-xs text-[#6B7A8D]">
                        {r.data.nombre_clinica || r.data.nombre || "Panel de Control"}
                      </p>
                    </div>
                    {isActive && <CheckCircle2 size={18} className="text-[var(--brand-primary)]" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-[#0B1929] text-white hover:bg-[#1A2D45] py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50">
            {saving ? "Guardando..." : <><Save size={18} /> {isTeam ? "Guardar Cambios" : "Guardar Perfil Público"}</>}
          </button>
          
          <button onClick={handleStore} className="sm:w-auto w-full py-3.5 px-6 rounded-xl font-bold text-[#0B1929] bg-white hover:bg-gray-50 border border-[#E2E8F0] flex items-center justify-center gap-2 transition-all shadow-sm">
            <ShoppingBag size={18} /> Ir a la tienda FLUX
          </button>

          <button onClick={onLogout} className="sm:w-auto w-full py-3.5 px-6 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center gap-2 transition-all">
            <LogOut size={18} /> Salir
          </button>
        </div>

        {/* Sección de datos de cobro — solo Superadmin */}
        {isSuperadmin && (
          <div className="mt-10 border-t border-[#E2E8F0] pt-8">
            <h3 className="font-bold text-[#0B1929] flex items-center gap-2 mb-1">
              <CreditCard size={18} className="text-[#1A6FD4]" /> Datos de Cobro (SPEI)
            </h3>
            <p className="text-xs text-[#6B7A8D] mb-5">Esta información aparecerá en el panel de "Mi Membresía" de cada nutriólogo para que sepan a dónde hacer su transferencia.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Banco</label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1A6FD4]"
                  placeholder="Ej. BBVA, BANAMEX..."
                  value={configPago.banco}
                  onChange={e => setConfigPago(p => ({ ...p, banco: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">CLABE Interbancaria (18 dígitos)</label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-[14px] font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-[#1A6FD4]"
                  placeholder="000000000000000000"
                  maxLength={18}
                  value={configPago.clabe}
                  onChange={e => setConfigPago(p => ({ ...p, clabe: e.target.value.replace(/\D/g, '') }))}
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Beneficiario (nombre de cuenta)</label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1A6FD4]"
                  placeholder="Ej. Flux Technologies SA de CV"
                  value={configPago.beneficiario}
                  onChange={e => setConfigPago(p => ({ ...p, beneficiario: e.target.value }))}
                />
              </div>
            </div>

            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="mt-4 w-full md:w-auto px-6 py-3 bg-[#1A6FD4] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              <Save size={16} /> {savingConfig ? "Guardando..." : "Guardar datos de cobro"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
