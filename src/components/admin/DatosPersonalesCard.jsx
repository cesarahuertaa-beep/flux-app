import React, { useRef, useState } from "react";
import { User, Phone, MapPin, Calendar, Camera } from "lucide-react";
import { PAISES, ESTADOS_MEXICO } from "../../lib/constants";
import { storageUpload } from "../../lib/supabase";

export default function DatosPersonalesCard({ form, setForm, loading, onSave, isSaving }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await storageUpload(file, "avatars");
      setForm((prev) => ({ ...prev, avatar_url: url }));
      // Optionally trigger save here if wanted, or let the user click save
      onSave({ ...form, avatar_url: url });
    } catch (error) {
      alert("Error subiendo foto: " + error.message);
    }
    setUploading(false);
  };

  const calcularEdad = (fechaStr) => {
    if (!fechaStr) return "";
    const hoy = new Date();
    const nac = new Date(fechaStr);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) {
      edad--;
    }
    return `${edad} años`;
  };

  if (loading) {
    return <div className="p-6 bg-white rounded-2xl shadow-sm border border-[#E2E8F0] animate-pulse h-64"></div>;
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0] mb-8">
      <h2 className="text-xl font-bold text-[#0B1929] flex items-center gap-2 mb-6">
        <User size={20} className="text-[var(--brand-primary)]" />
        Datos Personales
      </h2>
      
      <div className="flex flex-col md:flex-row gap-8 mb-6">
        {/* Avatar Upload */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="relative group cursor-pointer" onClick={() => !uploading && fileInputRef.current?.click()}>
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg bg-[#F7F9FC]" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[#F0F4FA] text-[#6B7A8D] flex items-center justify-center shadow-inner border-2 border-dashed border-[#CBD5E1] group-hover:border-[var(--brand-primary)] transition-colors">
                {uploading ? <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6B7A8D]"></div> : <Camera size={32} />}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-[10px] font-bold uppercase tracking-wider">Cambiar</span>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>
          <p className="text-xs text-[#6B7A8D]">Foto de perfil</p>
        </div>

        {/* Fields Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          <div>
            <label className="block text-sm font-medium text-[#0B1929] mb-1">Nombre Completo</label>
            <input 
              type="text" 
              value={form.nombre} 
              onChange={e => setForm({...form, nombre: e.target.value})}
              onBlur={() => onSave(form)}
              className="w-full bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl px-4 py-2 text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0B1929] mb-1">Correo Electrónico</label>
            <input 
              type="email" 
              value={form.email} 
              disabled
              className="w-full bg-slate-100 border border-[#E2E8F0] rounded-xl px-4 py-2 text-[#6B7A8D] cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0B1929] mb-1">Teléfono</label>
            <input 
              type="tel" 
              value={form.telefono} 
              onChange={e => setForm({...form, telefono: e.target.value})}
              onBlur={() => onSave(form)}
              className="w-full bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl px-4 py-2 text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0B1929] mb-1">Género</label>
            <select 
              value={form.genero} 
              onChange={e => { setForm({...form, genero: e.target.value}); onSave({...form, genero: e.target.value}); }}
              className="w-full bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl px-4 py-2 text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:bg-white transition-all"
            >
              <option value="">Selecciona...</option>
              <option value="Femenino">Femenino</option>
              <option value="Masculino">Masculino</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0B1929] mb-1">
              Fecha de Nacimiento {form.fecha_nacimiento && <span className="text-[var(--brand-primary)] font-normal ml-1">({calcularEdad(form.fecha_nacimiento)})</span>}
            </label>
            <input 
              type="date" 
              value={form.fecha_nacimiento} 
              onChange={e => { setForm({...form, fecha_nacimiento: e.target.value}); onSave({...form, fecha_nacimiento: e.target.value}); }}
              className="w-full bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl px-4 py-2 text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:bg-white transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-[#0B1929] mb-1">País</label>
              <select 
                value={form.pais} 
                onChange={e => { setForm({...form, pais: e.target.value}); onSave({...form, pais: e.target.value}); }}
                className="w-full bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl px-4 py-2 text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:bg-white transition-all"
              >
                {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0B1929] mb-1">Estado</label>
              {form.pais === "México" ? (
                <select 
                  value={form.estado_provincia} 
                  onChange={e => { setForm({...form, estado_provincia: e.target.value}); onSave({...form, estado_provincia: e.target.value}); }}
                  className="w-full bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl px-4 py-2 text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:bg-white transition-all"
                >
                  <option value="">Selecciona...</option>
                  {ESTADOS_MEXICO.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              ) : (
                <input 
                  type="text" 
                  value={form.estado_provincia} 
                  onChange={e => setForm({...form, estado_provincia: e.target.value})}
                  onBlur={() => onSave(form)}
                  placeholder="Provincia/Región"
                  className="w-full bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl px-4 py-2 text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:bg-white transition-all"
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {isSaving && <div className="text-xs text-[#6B7A8D] flex items-center gap-1 mt-2 justify-end"><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#6B7A8D]"></div> Guardando...</div>}
    </div>
  );
}
