import React, { useRef, useState } from "react";
import { Building2 } from "lucide-react";
import { storageUpload, storageDelete } from "../../lib/supabase";
import { cacheMediaUrl } from "../../lib/mediaCache";
import { showFluxAlert } from "../ui/ConfirmModal";
import BrandColorPicker from "../ui/BrandColorPicker";
import PhotoUploadBox from "../ui/PhotoUploadBox";

export default function IdentidadEmpresarialCard({ form, setForm, loading, onSave, isSaving, children, isSuperadmin }) {
  const [uploading, setUploading] = useState(false);
  const [tempLogoFile, setTempLogoFile] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTempLogoFile(file);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const url = await storageUpload("logos", path, file);
      cacheMediaUrl(url).catch(() => {});

      if (form.logo_url && form.logo_url.includes("storage/v1/object/public/logos/")) {
        const oldPath = form.logo_url.split("/public/logos/")[1];
        if (oldPath) {
          await storageDelete("logos", oldPath).catch(err => console.warn("No se pudo borrar logo anterior", err));
        }
      }

      setForm((prev) => ({ ...prev, logo_url: url }));
      onSave({ ...form, logo_url: url });
    } catch (error) {
      showFluxAlert("Error subiendo logo", error.message);
    }
    setUploading(false);
  };

  const handleRemoveLogo = async () => {
    setTempLogoFile(null);
    if (form.logo_url && form.logo_url.includes("storage/v1/object/public/logos/")) {
      const oldPath = form.logo_url.split("/public/logos/")[1];
      if (oldPath) {
        await storageDelete("logos", oldPath).catch(err => console.warn("No se pudo borrar logo", err));
      }
    }
    setForm((prev) => ({ ...prev, logo_url: "" }));
    onSave({ ...form, logo_url: "" });
  };

  const handleColorChange = (newColor) => {
    setForm({ ...form, color_primario: newColor });
    onSave({ ...form, color_primario: newColor });
  };

  if (loading) {
    return <div className="p-6 bg-white rounded-2xl shadow-sm border border-[#E2E8F0] animate-pulse h-64"></div>;
  }

  const currentLogo = tempLogoFile || form.logo_url;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0] mb-8">
      <h2 className="text-xl font-bold text-[#0B1929] flex items-center gap-2 mb-6">
        <Building2 size={20} className="text-[var(--brand-primary)]" />
        {isSuperadmin ? "Identidad de Marca (FLUX)" : "Identidad de Marca (Consultorio)"}
      </h2>
      
      <div className="flex flex-col md:flex-row items-center gap-6 pb-8 border-b border-[#E2E8F0] mb-8">
        <PhotoUploadBox
          value={currentLogo}
          onChange={handleFileChange}
          onRemove={currentLogo ? handleRemoveLogo : null}
          uploading={uploading}
          label="Subir logo"
          size="md"
          shape="square"
        />

        <div className="flex-1 min-w-0 w-full text-center md:text-left">
          <h2 className="text-xl font-bold text-[#0B1929] truncate">{form.nombre_marca || "Nombre de tu Consultorio"}</h2>
          <p className="text-[#6B7A8D] text-sm">Este logo y color aparecerán en los PDFs de tus pacientes.</p>
        </div>
        <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto mt-4 md:mt-0">
          <label className="text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider">Color de Marca</label>
          <BrandColorPicker
            value={form.color_primario || "#1A6FD4"}
            onChange={handleColorChange}
            logoSource={currentLogo}
          />
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
