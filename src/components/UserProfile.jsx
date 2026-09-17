import { useState, useEffect } from "react";
import { dbPatch, dbGet } from "../lib/supabase";
import { LogOut, ShoppingBag, RefreshCw, CheckCircle2, MapPin, User, Mail, Phone } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import DatosPersonalesCard from "./admin/DatosPersonalesCard";
import { syncPersonalData } from "../lib/supabase";
import RoleSwitcher from "./RoleSwitcher";

export default function UserProfile({ session, onLogout, onChangeRole, multiRoles }) {
  const user = session?.data || session; // Cliente o Admin
  const isCliente = session?.role === "cliente" || session?.role === "civil";
  
  const [form, setForm] = useState({
    nombre: user?.nombre || "",
    telefono: user?.telefono || "",
    email: user?.email || "",
    avatar_url: user?.avatar_url || "",
    fecha_nacimiento: user?.fecha_nacimiento || "",
    genero: user?.genero || "",
    pais: user?.pais || "México",
    estado_provincia: user?.estado_provincia || ""
  });
  
  const [objetivo, setObjetivo] = useState(user?.objetivo || "");
  const [isSaving, setIsSaving] = useState(false);
  const [miNutriologo, setMiNutriologo] = useState(null);

  useEffect(() => {
    if (isCliente && user?.nutriologo_id) {
      dbGet(`profiles?id=eq.${user.nutriologo_id}`).then(rows => {
        if (rows.length > 0) setMiNutriologo(rows[0]);
      }).catch(()=>{});
    }
  }, [isCliente, user?.nutriologo_id]);

  const handleSavePersonal = async (formData) => {
    setIsSaving(true);
    try {
      await syncPersonalData(form.email, formData);
      if (user) {
        Object.assign(user, formData); // Actualizar cache local de sesión
      }
      if (multiRoles) {
        multiRoles.forEach(r => {
          if (r.data) Object.assign(r.data, formData);
        });
        localStorage.setItem("flux_multi_roles", JSON.stringify(multiRoles));
      }
    } catch (e) {
      console.error("Error saving profile", e);
      alert("Error guardando: " + e.message);
    }
    setIsSaving(false);
  };

  const handleSaveObjetivo = async () => {
    if (!isCliente) return;
    try {
      await dbPatch(`clientes?id=eq.${user.id}`, { objetivo });
      if (user) user.objetivo = objetivo;
    } catch (e) {
      console.error(e);
    }
  };

  const handleStore = () => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true || window.location.search.includes('pwa=true');
    const isAppMode = window.location.protocol === 'app:' || window.location.protocol === 'file:' || Capacitor.isNativePlatform() || isStandalone;
    if (isAppMode) {
      window.open("https://www.flux-sport.com", "_blank"); 
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 pb-32 overflow-x-hidden px-4 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-[#0B1929] tracking-tight font-['Space_Grotesk',sans-serif]">Mi Perfil</h1>
        <p className="text-[#6B7A8D] mt-1">Gestiona tu información personal e identidad en la plataforma.</p>
      </div>

      <DatosPersonalesCard 
        form={form} 
        setForm={setForm} 
        onSave={handleSavePersonal} 
        loading={false} 
        isSaving={isSaving} 
      />

      {isCliente && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0] mb-8">
          <label className="block text-sm font-bold text-[#0B1929] mb-2">
            Objetivo Principal
          </label>
          <textarea 
            value={objetivo} 
            onChange={e => setObjetivo(e.target.value)}
            onBlur={handleSaveObjetivo}
            placeholder="Ej. Pérdida de grasa, hipertrofia..."
            rows={3}
            className="w-full min-w-0 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-[#0B1929] outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:bg-white transition-all resize-none"
          />
        </div>
      )}

      {isCliente && miNutriologo && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0] mb-8">
          <h2 className="text-xl font-bold text-[#0B1929] flex items-center gap-2 mb-6">
            <User size={20} className="text-[var(--brand-primary)]" />
            Mi Especialista
          </h2>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex justify-center md:justify-start gap-4 shrink-0">
              {miNutriologo.logo_url && (
                <img src={miNutriologo.logo_url} alt="Logo" className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md bg-[#F7F9FC]" />
              )}
              {miNutriologo.avatar_url && (
                <img src={miNutriologo.avatar_url} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md bg-[#F7F9FC]" />
              )}
              {!miNutriologo.logo_url && !miNutriologo.avatar_url && (
                <div className="w-20 h-20 rounded-full bg-[#F0F4FA] text-[#6B7A8D] flex items-center justify-center shadow-inner border-2 border-dashed border-[#CBD5E1]">
                  <User size={32} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h3 className="text-lg font-bold text-[#0B1929]">{miNutriologo.nombre}</h3>
              {miNutriologo.nombre_marca && <p className="text-sm font-semibold text-[var(--brand-primary)] mb-1">{miNutriologo.nombre_marca}</p>}
              {miNutriologo.especialidad && <p className="text-xs text-[#6B7A8D] uppercase tracking-wider font-bold mb-3">{miNutriologo.especialidad}</p>}
              
              <div className="space-y-2 mt-2">
                {miNutriologo.email && (
                  <div className="flex items-center gap-2 text-sm text-[#6B7A8D]">
                    <Mail size={16} className="shrink-0" /> <a href={`mailto:${miNutriologo.email}`} className="text-[#0B1929] hover:underline truncate">{miNutriologo.email}</a>
                  </div>
                )}
                {miNutriologo.telefono && (
                  <div className="flex items-center gap-2 text-sm text-[#6B7A8D]">
                    <Phone size={16} className="shrink-0" /> <a href={`tel:${miNutriologo.telefono}`} className="text-[#0B1929] hover:underline">{miNutriologo.telefono}</a>
                  </div>
                )}
                {(miNutriologo.pais || miNutriologo.estado || miNutriologo.ubicacion_texto) && (
                  <div className="flex items-start gap-2 text-sm text-[#6B7A8D]">
                    <MapPin size={16} className="shrink-0 mt-0.5" /> 
                    <span className="text-[#0B1929]">
                      {miNutriologo.ubicacion_texto ? miNutriologo.ubicacion_texto : [miNutriologo.estado, miNutriologo.pais].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
              </div>
              {miNutriologo.mapa_url && (
                <div className="mt-5">
                  <a href={miNutriologo.mapa_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-4 py-2.5 rounded-xl hover:bg-[var(--brand-primary)]/20 transition-colors">
                    <MapPin size={16} /> Ver ubicación en Maps
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <RoleSwitcher currentRole={session?.role} currentData={user} multiRoles={multiRoles} onChangeRole={onChangeRole} />

      <div className="flex flex-col sm:flex-row gap-4">
        <button 
          onClick={handleStore}
          className="w-full min-w-0 sm:w-auto px-6 py-3.5 rounded-xl font-bold text-[#0B1929] bg-white hover:bg-gray-50 flex items-center justify-center gap-2 transition-all shadow-sm border border-[#E2E8F0]"
        >
          <ShoppingBag size={18} /> Ir a la tienda FLUX
        </button>

        {onLogout && (
          <button 
            onClick={onLogout}
            className="w-full min-w-0 sm:w-auto px-6 py-3.5 rounded-xl font-bold text-red-500 bg-red-50 hover:bg-red-100 flex items-center justify-center gap-2 transition-all border border-red-100"
          >
            <LogOut size={18} /> Cerrar Sesión
          </button>
        )}
      </div>
    </div>
  );
}
