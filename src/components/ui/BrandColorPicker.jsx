import React, { useState, useEffect, useRef } from "react";
import { Check, ChevronDown, Palette } from "lucide-react";
import { useBrand, getFluxOfficialColor } from "../BrandContext";
import { extractPaletteFromImage } from "../../lib/colorExtractor";

// 11 colores armónicos estándar utilizados cuando no hay logo cargado
const DEFAULT_SECONDARY_COLORS = [
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

export default function BrandColorPicker({
  value,
  onChange,
  disabled = false,
  logoSource = null,
  customPalette = null,
}) {
  const brandCtx = useBrand();
  // El color oficial de FLUX dictaminado por el Superadmin
  const officialFluxColor = (brandCtx?.fluxBrandColor || getFluxOfficialColor()).toUpperCase();

  const [isOpen, setIsOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value || officialFluxColor);
  const [extractedPalette, setExtractedPalette] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const containerRef = useRef(null);

  const currentColor = (value || officialFluxColor).toUpperCase();

  useEffect(() => {
    setHexInput(value || officialFluxColor);
  }, [value, officialFluxColor]);

  // Extraer paleta en tiempo real cuando se proporcione un logo (File, Blob, DataURL o URL)
  useEffect(() => {
    if (!logoSource) {
      setExtractedPalette([]);
      return;
    }

    let isCurrent = true;
    setExtracting(true);

    extractPaletteFromImage(logoSource, 11)
      .then((pal) => {
        if (isCurrent && Array.isArray(pal) && pal.length > 0) {
          setExtractedPalette(pal);
        }
      })
      .catch((err) => {
        console.warn("Error analizando paleta de logo:", err);
      })
      .finally(() => {
        if (isCurrent) setExtracting(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [logoSource]);

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
    const formatted = hex.toUpperCase();
    setHexInput(formatted);
    if (typeof onChange === "function") {
      onChange(formatted);
    }
  };

  const handleHexChange = (e) => {
    let raw = e.target.value.trim();
    if (!raw.startsWith("#")) raw = "#" + raw;
    setHexInput(raw);

    // Si es un hex válido de 3 o 6 dígitos, propagar
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(raw)) {
      if (typeof onChange === "function") {
        onChange(raw.toUpperCase());
      }
    }
  };

  // Construcción de la grilla de 12 swatches:
  // Posición 1 = SIEMPRE el Color Oficial de FLUX (del Superadmin)
  // Posiciones 2 a 12 = Paleta extraída del logo (o recomendados por defecto)
  const hasLogoPalette = extractedPalette && extractedPalette.length > 0;
  const secondaryList = (customPalette && customPalette.length > 0)
    ? customPalette
    : hasLogoPalette
    ? extractedPalette
    : DEFAULT_SECONDARY_COLORS;

  const swatches = [
    { hex: officialFluxColor, name: "Color Oficial FLUX", isFluxOfficial: true },
    ...secondaryList.slice(0, 11),
  ];

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
          className="w-7 h-7 rounded-lg shadow-xs border border-black/10 shrink-0 transition-transform active:scale-95"
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
          {/* Cabecera del selector */}
          {hasLogoPalette ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#6B7A8D] mb-2 px-0.5">
              <Palette size={14} className="text-[#6B7A8D]" />
              <span>Paleta de tu logo</span>
            </div>
          ) : extracting ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#6B7A8D] mb-2 px-0.5">
              <div className="w-3 h-3 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Analizando colores del logo...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#6B7A8D] mb-2 px-0.5">
              <Palette size={14} className="text-[#6B7A8D]" />
              <span>Colores recomendados</span>
            </div>
          )}

          {/* Grilla de 12 colores (2 filas x 6 columnas) */}
          <div className="grid grid-cols-6 gap-2 mb-3">
            {swatches.map((col, idx) => {
              const isSelected = currentColor.toLowerCase() === col.hex.toLowerCase();
              const isFlux = idx === 0;

              return (
                <button
                  key={`${col.hex}_${idx}`}
                  type="button"
                  title={isFlux ? `FLUX Oficial (${col.hex})` : `${col.name} (${col.hex})`}
                  onClick={() => selectColor(col.hex)}
                  className={`w-8 h-8 rounded-lg relative flex items-center justify-center transition-all hover:scale-110 active:scale-95 border shadow-xs ${
                    isFlux
                      ? 'ring-2 ring-[var(--brand-primary)]/40 border-black/15'
                      : 'border-black/10'
                  }`}
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
                  {isFlux && !isSelected && (
                    <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border border-white" title="Color Oficial FLUX" />
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
                placeholder={officialFluxColor}
                className="flex-1 bg-[#F0F4FA] border border-[#E2E8F0] focus:border-[var(--brand-primary)] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#0B1929] outline-none transition-all uppercase"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
