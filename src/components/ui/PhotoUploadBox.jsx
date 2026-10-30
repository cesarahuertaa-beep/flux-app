import React, { useRef } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { CachedImage } from "../../lib/mediaCache";

/**
 * PhotoUploadBox
 * Componente unificado para carga y edición de imágenes (logos, avatares, fotos de platillos/productos).
 * Incluye estado vacío con borde discontinuo e icono, y estado lleno con botón inferior 'Cambiar'
 * y botón superior derecho '✕' para eliminar la foto.
 */
export default function PhotoUploadBox({
  value,
  onChange,
  onRemove,
  uploading = false,
  label = "Subir foto",
  shape = "square", // "square" (rounded-2xl) | "circle" (rounded-full)
  size = "md",      // "sm" | "md" | "lg"
  className = "",
  disabled = false,
  accept = "image/*",
}) {
  const fileInputRef = useRef(null);

  const sizeClasses = {
    sm: "w-20 h-20",
    md: "w-24 h-24 sm:w-28 sm:h-28",
    lg: "w-28 h-28 sm:w-32 sm:h-32",
  }[size] || "w-24 h-24 sm:w-28 sm:h-28";

  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-2xl";

  const displaySrc = value instanceof File || value instanceof Blob
    ? URL.createObjectURL(value)
    : value;

  // Estado: Subiendo
  if (uploading) {
    return (
      <div className={`relative ${sizeClasses} ${shapeClass} bg-[#F0F4FA] text-[#6B7A8D] flex flex-col items-center justify-center shadow-inner border-2 border-dashed border-[#CBD5E1] shrink-0 select-none ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-primary)]" />
        <span className="text-[10px] font-bold text-[#6B7A8D] mt-1.5">Subiendo...</span>
      </div>
    );
  }

  // Estado: Con foto cargada
  if (displaySrc) {
    return (
      <div className={`relative ${sizeClasses} ${shapeClass} overflow-hidden border border-[#CBD5E1] bg-[#F8FAFC] shadow-2xs group shrink-0 ${className}`}>
        {typeof displaySrc === "string" && displaySrc.startsWith("http") ? (
          <CachedImage
            src={displaySrc}
            alt={label}
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={displaySrc}
            alt={label}
            className="w-full h-full object-cover"
          />
        )}

        {/* Botón inferior: Cambiar Foto (Barra con desenfoque e icono de cámara) */}
        <label
          className="absolute inset-x-0 bottom-0 py-1 bg-black/65 hover:bg-black/85 text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors backdrop-blur-xs select-none z-10"
          title="Cambiar imagen"
        >
          <Camera className="w-3 h-3" />
          <span>Cambiar</span>
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={onChange}
            disabled={disabled}
          />
        </label>

        {/* Botón superior derecho: Quitar / Eliminar Foto */}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 hover:bg-rose-600 text-white transition-colors cursor-pointer shadow-sm z-20"
            title="Quitar imagen"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  // Estado vacío: Sin foto cargada
  return (
    <label
      className={`relative ${sizeClasses} ${shapeClass} border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] hover:border-[var(--brand-primary)] hover:bg-blue-50/30 flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all group shrink-0 select-none ${className}`}
      title={label}
    >
      <div className="w-8 h-8 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center text-[#94A3B8] group-hover:text-[var(--brand-primary)] group-hover:border-blue-200 shadow-2xs transition-colors">
        <Camera className="w-4 h-4" />
      </div>
      <span className="text-[10px] font-bold text-[#6B7A8D] group-hover:text-[var(--brand-primary)] transition-colors px-1 truncate max-w-full">
        {label}
      </span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={onChange}
        disabled={disabled}
      />
    </label>
  );
}
