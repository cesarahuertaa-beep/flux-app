import { useState, useEffect, useRef } from "react";
import { dbGet, dbPatch, storageUpload } from "../../lib/supabase";
import { User, Image as ImageIcon, MapPin, Link as LinkIcon, Phone, Save, LogOut, CheckCircle2, AlertCircle, Building2 } from "lucide-react";
import { useBrand } from "../BrandContext";

export default function PerfilNutriologo({ profileId, onLogout, role }) {
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
    logo_url: ""
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
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
            logo_url: p.logo_url || ""
          });
        }
      } catch (error) {
        console.error("Error cargando perfil", error);
      }
      setLoading(false);
    };
    loadProfile();
  }, [profileId]);

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
      await dbPatch(`profiles?id=eq.${profileId}`, form);
      setMsg("Perfil actualizado correctamente. Los cambios se reflejarán en la Landing Page.");
    } catch (error) {
      setErr("Error guardando perfil: " + error.message);
    }
    setSaving(false);
  };

  const isTeam = role === "administrativo" || role === "staff";

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

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-[#0B1929] text-white hover:bg-[#1A2D45] py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50">
            {saving ? "Guardando..." : <><Save size={18} /> {isTeam ? "Guardar Cambios" : "Guardar Perfil Público"}</>}
          </button>
          
          <button onClick={onLogout} className="sm:w-auto w-full py-3.5 px-6 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center gap-2 transition-all">
            <LogOut size={18} /> Salir
          </button>
        </div>

      </div>
    </div>
  );
}
