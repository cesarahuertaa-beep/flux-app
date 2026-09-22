import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { dbPatch, dbGet } from"../lib/supabase";
import { LogOut, ShoppingBag, RefreshCw, CheckCircle2, MapPin, User, Mail, Phone } from"lucide-react";
import { Capacitor } from"@capacitor/core";
import DatosPersonalesCard from"./admin/DatosPersonalesCard";
import { syncPersonalData } from"../lib/supabase";
import RoleSwitcher from"./RoleSwitcher";

export default function UserProfile({ session, onLogout, onChangeRole, multiRoles }) {
  const navigate = useNavigate();
  const user = session?.data || session; // Cliente o Admin
  const isCliente = session?.role ==="cliente" || session?.role ==="civil";
  
  const [form, setForm] = useState({
    nombre: user?.nombre ||"",
    telefono: user?.telefono ||"",
    email: user?.email ||"",
    avatar_url: user?.avatar_url ||"",
    fecha_nacimiento: user?.fecha_nacimiento ||"",
    genero: user?.genero ||"",
    pais: user?.pais ||"México",
    estado_provincia: user?.estado_provincia ||""
  });
  
  const [objetivo, setObjetivo] = useState(user?.objetivo ||"");
  const [isSaving, setIsSaving] = useState(false);
  const [miNutriologo, setMiNutriologo] = useState(null);

  useEffect(() => {
    if (isCliente && user?.nutriologo_id) {
      dbGet(`profiles?id=eq.${user.nutriologo_id}`).then(rows => {
        if (rows.length > 0) setMiNutriologo(rows[0]);
      }).catch(()=>{});
    }
  }, [isCliente, user?.nutriologo_id]);

  // Refrescar datos frescos desde la BD al montar, para no depender del caché del localStorage
  useEffect(() => {
    const email = user?.email;
    if (!email) return;
    const table = isCliente ? `clientes?email=ilike.${email}` : `profiles?email=ilike.${email}`;
    dbGet(table).then(rows => {
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
  }, [user?.email]);

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
      alert("Error guardando:" + e.message);
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

  return (
    <div className="w-full bg-[#F7F9FC] flex flex-col">
      <div className="max-w-4xl mx-auto w-full pb-32 px-6 md:px-8 pt-6 md:pt-8">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-[#0B1929] tracking-tight font-['Space_Grotesk',sans-serif]">Mi Perfil</h1>
        <p className="text-[#6B7A8D] mt-1">Gestiona tu información personal e identidad en la plataforma.</p>
      </div>

      <RoleSwitcher currentRole={session?.role} currentData={user} multiRoles={multiRoles} onChangeRole={onChangeRole} activeNutriologo={miNutriologo} />

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
                  {miNutriologo.telefono && (() => {
                    const cleanPhone = miNutriologo.telefono.replace(/\D/g, '');
                    return (
                      <div className="flex items-center gap-2 text-sm text-[#6B7A8D]">
                        <svg className="w-4 h-4 shrink-0 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.06-.173-.299-.018-.461.13-.611.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        <a href={`https://wa.me/${cleanPhone}`} target="_blank" rel="noopener noreferrer" className="text-[#0B1929] hover:underline font-medium">{miNutriologo.telefono}</a>
                      </div>
                    );
                  })()}
                {(miNutriologo.pais || miNutriologo.estado || miNutriologo.ubicacion_texto) && (
                  <div className="flex items-start gap-2 text-sm text-[#6B7A8D]">
                    <MapPin size={16} className="shrink-0 mt-0.5" /> 
                    <span className="text-[#0B1929]">
                      {miNutriologo.ubicacion_texto ? miNutriologo.ubicacion_texto : [miNutriologo.estado, miNutriologo.pais].filter(Boolean).join(",")}
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

      <div className="flex flex-col sm:flex-row gap-4">
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
    </div>
  );
}
