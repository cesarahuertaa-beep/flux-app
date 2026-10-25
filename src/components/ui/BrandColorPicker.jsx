import React, { useState, useEffect, useRef } from "react";
import { Check, ChevronDown, Palette } from "lucide-react";

const PRESET_COLORS = [
  { hex: "#1A6FD4", name: "Azul Flux" },
  { hex: "#00B4D8", name: "Cyan Vibrante" },
  { hex: "#0EA5E9", name: "Celeste" },
  { hex: "#0F766E", name: "Verde Azulado" },
  { hex: "#10B981", name: "Esmeralda" },
  { hex: "#16A34A", name: "Verde" },
  { hex: "#F59E0B", name: "Ámbar" },
  { hex: "#EA580C", name: "Naranja" },
  { hex: "#EF4444", name: "Rojo" },
  { hex: "#EC4899", name: "Rosa" },
  { hex: "#8B5CF6", name: "Violeta" },
  { hex: "#0B1929", name: "Obsidiana" },
];

export default function BrandColorPicker({ value = "#1A6FD4", onChange, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value || "#1A6FD4");
  const containerRef = useRef(null);

  const currentColor = (value || "#1A6FD4").toUpperCase();

  useEffect(() => {
    setHexInput(value || "#1A6FD4");
  }, [value]);

  // Cerrar al hacer click afuera
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const selectColor = (hex) => {
    setHexInput(hex);
    if (typeof onChange === "function") {
      onChange(hex);
    }
  };

  const handleHexChange = (e) => {
    let raw = e.target.value.trim();
    if (!raw.startsWith("#")) raw = "#" + raw;
    setHexInput(raw);

    // Si es un hex válido de 3 o 6 dígitos, propagar
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(raw)) {
      if (typeof onChange === "function") {
        onChange(raw);
      }
    }
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Botón Trigger elegante e in-app */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 bg-[#F0F4FA] hover:bg-[#E2E8F0]/70 rounded-xl p-1.5 border border-[#E2E8F0] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 disabled:opacity-50"
      >
        <span
          className="w-7 h-7 rounded-lg shadow-sm border border-black/10 shrink-0 transition-transform active:scale-95"
          style={{ backgroundColor: currentColor }}
        />
        <span className="text-xs font-mono font-bold text-[#0B1929] px-1 select-none">
          {currentColor}
        </span>
        <ChevronDown size={14} className={`text-[#6B7A8D] mr-1 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Popover desplegable flotante */}
      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 sm:bottom-auto sm:top-full sm:mt-2 z-[150] w-64 bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] p-3.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#6B7A8D] mb-2 px-0.5">
            <Palette size={14} />
            <span>Colores recomendados</span>
          </div>

          {/* Grilla de colores preestablecidos */}
          <div className="grid grid-cols-6 gap-2 mb-3">
            {PRESET_COLORS.map((col) => {
              const isSelected = currentColor.toLowerCase() === col.hex.toLowerCase();
              return (
                <button
                  key={col.hex}
                  type="button"
                  title={col.name}
                  onClick={() => selectColor(col.hex)}
                  className="w-8 h-8 rounded-lg relative flex items-center justify-center transition-all hover:scale-110 active:scale-95 border border-black/10 shadow-xs"
                  style={{ backgroundColor: col.hex }}
                >
                  {isSelected && (
                    <Check
                      size={14}
                      className={`stroke-[3] drop-shadow-sm ${
                        col.hex === "#FFFFFF" || col.hex === "#F59E0B" ? "text-slate-900" : "text-white"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Input HEX personalizado */}
          <div className="pt-2 border-t border-[#F0F4FA]">
            <label className="block text-[11px] font-bold text-[#6B7A8D] uppercase tracking-wider mb-1">
              Código HEX personalizado
            </label>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg border border-black/10 shrink-0 shadow-inner"
                style={{ backgroundColor: /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hexInput) ? hexInput : currentColor }}
              />
              <input
                type="text"
                value={hexInput}
                onChange={handleHexChange}
                maxLength={7}
                placeholder="#1A6FD4"
                className="flex-1 bg-[#F0F4FA] border border-[#E2E8F0] focus:border-[var(--brand-primary)] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#0B1929] outline-none transition-all uppercase"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
