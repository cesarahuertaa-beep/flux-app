import { useState } from "react";
import { dbUpsert } from "../lib/supabase";
import { User, Mail, Save, AlertCircle, CheckCircle2, LogOut } from "lucide-react";

export default function UserProfile({ session, onLogout }) {
  const user = session?.data || session; // Cliente o Admin
  
  const [nombre, setNombre] = useState(user?.nombre || "");
  const [objetivo, setObjetivo] = useState(user?.objetivo || "");
  const [telefono, setTelefono] = useState(user?.telefono || "");
  
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const isCliente = session?.role === "client";

  const handleSave = async () => {
    setLoading(true); setMsg(""); setErr("");
    try {
      if (isCliente) {
        await dbUpsert("clientes", {
          id: user.id,
          nombre,
          objetivo,
          telefono
        });
      } else {
        await dbUpsert("profiles", {
          id: user.id,
          nombre
        });
      }
      setMsg("Perfil actualizado correctamente");
      // Actualizar sesión localmente para que se refleje inmediatamente
      if (user) {
        user.nombre = nombre;
        if (isCliente) {
          user.objetivo = objetivo;
          user.telefono = telefono;
        }
      }
    } catch (e) {
      setErr("Error al guardar: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 text-center md:text-left">
        <h1 className="text-3xl font-extrabold text-[#0B1929] tracking-tight font-['Space_Grotesk',sans-serif]">Mi Perfil</h1>
        <p className="text-[#6B7A8D] mt-1">Actualiza tu información personal</p>
      </div>

      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[#E2E8F0]">
        
        {msg && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2 text-sm">
            <CheckCircle2 size={18} className="text-green-600" /> {msg}
          </div>
        )}
        
        {err && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 flex items-center gap-2 text-sm">
            <AlertCircle size={18} className="text-red-500" /> {err}
          </div>
        )}

        <div className="flex items-center gap-4 mb-8 pb-8 border-b border-[#E2E8F0]">
          <div className="w-16 h-16 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center shadow-md">
            <User size={28} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0B1929]">{user?.nombre}</h2>
            <p className="text-[#6B7A8D] text-sm flex items-center gap-1 mt-0.5">
              <Mail size={14} /> {user?.email}
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

          <button 
            onClick={handleSave}
            disabled={loading}
            className={`w-full mt-4 py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-md ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[var(--brand-primary)] hover:opacity-90'}`}
          >
            {loading ? "Guardando..." : <><Save size={18} /> Guardar Cambios</>}
          </button>

          {onLogout && (
            <button 
              onClick={onLogout}
              className="w-full mt-2 py-3.5 rounded-xl font-bold text-red-500 bg-red-50 hover:bg-red-100 flex items-center justify-center gap-2 transition-all border border-red-100"
            >
              <LogOut size={18} /> Cerrar Sesión
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
