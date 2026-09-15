import { useState, useEffect, useRef } from "react";
import { dbPatch } from "../lib/supabase";
import { User, Mail, LogOut, ShoppingBag, RefreshCw, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Capacitor } from "@capacitor/core";

export default function UserProfile({ session, onLogout, onChangeRole, multiRoles }) {
  const user = session?.data || session; // Cliente o Admin
  
  const [nombre, setNombre] = useState(user?.nombre || "");
  const [objetivo, setObjetivo] = useState(user?.objetivo || "");
  const [telefono, setTelefono] = useState(user?.telefono || "");
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);
  
  const isCliente = session?.role === "cliente";
  const isFirstRender = useRef(true);

  // Auto-guardado silencioso (1 segundo después de dejar de escribir)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      setIsSaving(true);
      setSaveSuccess(false);
      setSaveError(false);
      try {
        let res;
        if (isCliente) {
          res = await dbPatch(`clientes?id=eq.${user.id}`, { nombre, objetivo, telefono });
        } else {
          res = await dbPatch(`profiles?id=eq.${user.id}`, { nombre });
        }
        
        if (Array.isArray(res) && res.length === 0) {
          throw new Error("No se pudo guardar en la base de datos (Posible bloqueo de RLS en Supabase).");
        }
        
        // Actualizar sesión localmente
        if (user) {
          user.nombre = nombre;
          if (isCliente) {
            user.objetivo = objetivo;
            user.telefono = telefono;
          }
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch (e) {
        console.error("Error al autoguardar:", e);
        setSaveError(true);
      }
      setIsSaving(false);
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [nombre, objetivo, telefono, user, isCliente]);

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
    <div className="p-6 max-w-md mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[#0B1929] tracking-tight font-['Space_Grotesk',sans-serif]">Mi Perfil</h1>
          <p className="text-[#6B7A8D] mt-1">Actualiza tu información personal</p>
        </div>
        
        {/* Indicador silencioso de guardado */}
        <div className="h-6 flex items-center justify-end min-w-[24px]">
          {isSaving && <Loader2 size={18} className="text-[#6B7A8D] animate-spin" />}
          {saveSuccess && !isSaving && <CheckCircle2 size={18} className="text-green-500" />}
          {saveError && !isSaving && <XCircle size={18} className="text-red-500" title="Error de permisos al guardar" />}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E2E8F0]">
        
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[#E2E8F0]">
          <div className="w-16 h-16 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center shadow-md flex-shrink-0">
            <User size={28} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-[#0B1929] truncate">{user?.nombre}</h2>
            <p className="text-[#6B7A8D] text-sm flex items-center gap-1 mt-0.5 truncate">
              <Mail size={14} className="flex-shrink-0" /> <span className="truncate">{user?.email}</span>
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-2">
              Nombre Completo
            </label>
            <input 
              type="text" 
              value={nombre} 
              onChange={e => setNombre(e.target.value)}
              className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] rounded-xl px-4 py-3 text-[#0B1929] outline-none transition-all"
            />
          </div>

          {isCliente && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-2">
                  Teléfono
                </label>
                <input 
                  type="tel" 
                  value={telefono} 
                  onChange={e => setTelefono(e.target.value)}
                  placeholder="Tu número telefónico"
                  className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] rounded-xl px-4 py-3 text-[#0B1929] outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-2">
                  Objetivo Principal
                </label>
                <textarea 
                  value={objetivo} 
                  onChange={e => setObjetivo(e.target.value)}
                  placeholder="Ej. Pérdida de grasa, hipertrofia..."
                  rows={3}
                  className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] rounded-xl px-4 py-3 text-[#0B1929] outline-none transition-all resize-none"
                />
              </div>
            </>
          )}

          {multiRoles && multiRoles.length > 1 && (
            <div className="mt-8 border-t border-[#E2E8F0] pt-6 mb-2">
              <h3 className="text-sm font-bold text-[#0B1929] mb-4 flex items-center gap-2">
                <RefreshCw size={16} className="text-[#6B7A8D]" />
                Cambiar Perfil (Sesión Múltiple)
              </h3>
              <div className="flex flex-col gap-2">
                {multiRoles.map((r, i) => {
                  const isActive = session.role === r.role;
                  return (
                    <button
                      key={i}
                      disabled={isActive}
                      onClick={() => onChangeRole && onChangeRole(r)}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isActive ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5" : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1]"}`}
                    >
                      <div className="text-left">
                        <p className={`font-bold text-sm ${isActive ? "text-[var(--brand-primary)]" : "text-[#0B1929]"}`}>
                          {r.role === "cliente" ? "Paciente" : (r.role === "nutriologo" ? "Nutriólogo" : (r.role === "nutriologo_estudiante" ? "Estudiante" : "Staff Administrativo"))}
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

          <div className="pt-4 border-t border-transparent space-y-2 mt-4">
            <button 
              onClick={handleStore}
              className="w-full py-3.5 rounded-xl font-bold text-[#0B1929] bg-white hover:bg-gray-50 flex items-center justify-center gap-2 transition-all shadow-sm border border-[#E2E8F0]"
            >
              <ShoppingBag size={18} /> Ir a la tienda FLUX
            </button>

            {onLogout && (
              <button 
                onClick={onLogout}
                className="w-full py-3.5 rounded-xl font-bold text-red-500 bg-red-50 hover:bg-red-100 flex items-center justify-center gap-2 transition-all border border-red-100"
              >
                <LogOut size={18} /> Cerrar Sesión
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
