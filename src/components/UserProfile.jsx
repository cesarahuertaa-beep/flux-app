import { useState, useEffect } from "react";
import { dbPatch } from "../lib/supabase";
import { LogOut, ShoppingBag, RefreshCw, CheckCircle2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import DatosPersonalesCard from "./admin/DatosPersonalesCard";
import { syncPersonalData } from "../lib/supabase";

export default function UserProfile({ session, onLogout, onChangeRole, multiRoles }) {
  const user = session?.data || session; // Cliente o Admin
  const isCliente = session?.role === "cliente";
  
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

  const handleSavePersonal = async (formData) => {
    setIsSaving(true);
    try {
      await syncPersonalData(form.email, formData);
      if (user) {
        Object.assign(user, formData); // Actualizar cache local de sesión
      }
    } catch (e) {
      console.error("Error saving profile", e);
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

      {multiRoles && multiRoles.length > 1 && (
        <div className="mt-8 border-t border-[#E2E8F0] pt-6 mb-8">
          <h3 className="text-sm font-bold text-[#0B1929] mb-4 flex items-center gap-2">
            <RefreshCw size={16} className="text-[#6B7A8D]" />
            Cambiar Perfil (Sesión Múltiple)
          </h3>
          <div className="flex flex-col gap-2">
            {multiRoles.map((r, i) => {
              const isCivilRole = r.role === 'cliente' && !r.data?.nutriologo_id;
              const roleIdentifier = isCivilRole ? 'civil' : r.role;
              const isActive = session.role === roleIdentifier;
              return (
                <button
                  key={i}
                  disabled={isActive}
                  onClick={() => onChangeRole && onChangeRole(r)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isActive ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5" : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1]"}`}
                >
                  <div className="text-left min-w-0 flex-1 pr-4">
                    <p
                      className={`font-bold text-sm truncate ${
                        isActive ? "text-[var(--brand-primary)]" : "text-[#0B1929]"
                      }`}
                    >
                      {r.role === "cliente"
                        ? (r.data?.nutriologo_id ? "Paciente en Consultorio" : "Atleta Independiente")
                        : r.role === "nutriologo"
                        ? "Nutriólogo"
                        : r.role === "nutriologo_estudiante"
                        ? "Estudiante"
                        : r.role === "staff"
                        ? "Staff"
                        : "Administrativo"}
                    </p>
                    <p className={`text-xs mt-0.5 opacity-80 truncate ${isActive ? "text-[var(--brand-primary)]" : "text-[#6B7A8D]"}`}>
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
