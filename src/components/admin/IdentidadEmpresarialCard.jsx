import React, { useRef, useState } from "react";
import { Building2, Image as ImageIcon } from "lucide-react";
import { storageUpload } from "../../lib/supabase";

export default function IdentidadEmpresarialCard({ form, setForm, loading, onSave, isSaving }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
      try {
        const ext = file.name.split('.').pop();
        const path = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const url = await storageUpload("logos", path, file);
        setForm((prev) => ({ ...prev, logo_url: url }));
      onSave({ ...form, logo_url: url });
    } catch (error) {
      alert("Error subiendo logo: " + error.message);
    }
    setUploading(false);
  };

  const handleColorChange = (e) => {
    const newColor = e.target.value;
    setForm({ ...form, color_primario: newColor });
    onSave({ ...form, color_primario: newColor });
  };

  if (loading) {
    return <div className="p-6 bg-white rounded-2xl shadow-sm border border-[#E2E8F0] animate-pulse h-64"></div>;
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0] mb-8">
      <h2 className="text-xl font-bold text-[#0B1929] flex items-center gap-2 mb-6">
        <Building2 size={20} className="text-[var(--brand-primary)]" />
        Identidad de Marca (Consultorio)
      </h2>
      
      <div className="flex flex-col md:flex-row items-center gap-6 pb-8 border-b border-[#E2E8F0] mb-8">
        <div className="relative group cursor-pointer" onClick={() => !uploading && fileInputRef.current?.click()}>
          {form.logo_url ? (
            <img src={form.logo_url} alt="Logo" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg bg-[#F7F9FC]" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[#F0F4FA] text-[#6B7A8D] flex items-center justify-center shadow-inner border-2 border-dashed border-[#CBD5E1] group-hover:border-[var(--brand-primary)] transition-colors">
              {uploading ? <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6B7A8D]"></div> : <ImageIcon size={32} />}
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white text-[10px] font-bold uppercase tracking-wider">Cambiar Logo</span>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        </div>
        <div className="flex-1 min-w-0 w-full text-center md:text-left">
          <h2 className="text-xl font-bold text-[#0B1929] truncate">{form.nombre_marca || "Nombre de tu Consultorio"}</h2>
          <p className="text-[#6B7A8D] text-sm">Este logo y color aparecerán en los PDFs de tus pacientes.</p>
        </div>
        <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto mt-4 md:mt-0">
          <label className="text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider">Color de Marca</label>
          <div className="flex items-center gap-2 bg-[#F0F4FA] rounded-xl p-1.5 border border-[#E2E8F0]">
            <input type="color" value={form.color_primario || "#1A6FD4"} onChange={handleColorChange} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none" />
            <span className="text-xs font-mono text-[#6B7A8D] px-2">{(form.color_primario || "#1A6FD4").toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
        <div>
          <label className="block text-sm font-medium text-[#0B1929] mb-1">Nombre de la Marca / Consultorio</label>
          <input 
            type="text" 
            value={form.nombre_marca} 
            onChange={e => setForm({...form, nombre_marca: e.target.value})}
            onBlur={() => onSave(form)}
            className="w-full min-w-0 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl px-4 py-2 text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:bg-white transition-all"
            placeholder="Ej: NutriFit, FLUX Sport"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#0B1929] mb-1">Especialidad</label>
          <input 
            type="text" 
            value={form.especialidad} 
            onChange={e => setForm({...form, especialidad: e.target.value})}
            onBlur={() => onSave(form)}
            className="w-full min-w-0 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl px-4 py-2 text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:bg-white transition-all"
            placeholder="Ej: Nutrición Deportiva"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#0B1929] mb-1">Cédula Profesional</label>
          <input 
            type="text" 
            value={form.cedula} 
            onChange={e => setForm({...form, cedula: e.target.value})}
            onBlur={() => onSave(form)}
            className="w-full min-w-0 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl px-4 py-2 text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:bg-white transition-all"
            placeholder="Opcional"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#0B1929] mb-1">Ubicación (Texto corto para el PDF)</label>
          <input 
            type="text" 
            value={form.ubicacion_texto} 
            onChange={e => setForm({...form, ubicacion_texto: e.target.value})}
            onBlur={() => onSave(form)}
            className="w-full min-w-0 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl px-4 py-2 text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:bg-white transition-all"
            placeholder="Ej: CDMX, Polanco"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-[#0B1929] mb-1">Link de Google Maps (Para tus pacientes)</label>
          <input 
            type="url" 
            value={form.mapa_url} 
            onChange={e => setForm({...form, mapa_url: e.target.value})}
            onBlur={() => onSave(form)}
            className="w-full min-w-0 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl px-4 py-2 text-[#0B1929] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:bg-white transition-all"
            placeholder="https://maps.app.goo.gl/..."
          />
        </div>
      </div>
      {isSaving && <div className="text-xs text-[#6B7A8D] flex items-center gap-1 mt-2 justify-end"><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#6B7A8D]"></div> Guardando...</div>}
    </div>
  );
}
