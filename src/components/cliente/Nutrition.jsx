import { useState } from "react";
import { Flame, ChevronRight, Apple, FileText } from "lucide-react";
import { useBrand } from "../BrandContext";
import { generateNutriPDF } from "../../utils/pdf";

const DAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAY_FULL  = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function Nutrition({ dias, cliente, nutri, semanaActualCiclo = 1 }) {
  const [activeDay, setActiveDay]     = useState(0);
  const [expandedMeal, setExpandedMeal] = useState(0); // Primer comida abierta por defecto
  const brand = useBrand();

  if (!dias || dias.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
          <Apple className="w-8 h-8 text-[#94A3B8]" />
        </div>
        <h3 className="text-[#0B1929] font-bold text-lg mb-2">Sin plan asignado</h3>
        <p className="text-[#6B7A8D] text-sm max-w-[250px]">
          Tu nutriólogo aún no ha asignado tu dieta para este ciclo.
        </p>
      </div>
    );
  }

  const diaActual  = dias[activeDay];
  const comidas    = diaActual?.comidas || [];
  const caloriasMeta = nutri?.calorias_meta || 0;
  const totalKcal  = comidas.reduce((s, m) => s + (Number(m.calorias) || 0), 0) || caloriasMeta;
  const clienteNombre = cliente?.nombre;

  const getDayShort = (nombre, i) => {
    if (!nombre) return DAY_SHORT[i] ?? `Día ${i + 1}`;
    const parts = String(nombre).split('|');
    return parts.length > 1 ? parts[0] : "S/D";
  };
  const getDayFull = (nombre, i) => {
    if (!nombre) return DAY_FULL[i] || `Día ${i + 1}`;
    const parts = String(nombre).split('|');
    const title = parts.length > 1 ? parts[1] : parts[0];
    return `${title} — Semana ${semanaActualCiclo}`;
  };

  const handleDownloadPDF = () => {
    generateNutriPDF(cliente, nutri, dias, brand);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* ── Header ── */}
      <div className="px-6 md:px-8 pt-6 md:pt-8 pb-6 bg-white/50 border-b border-[#F0F4FA]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">
              Plan de Alimentación
            </p>
            <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
              Nutrición Semanal
            </h1>
            {clienteNombre && (
              <p className="text-sm text-[#6B7A8D] mt-1">
                Paciente: <span className="text-[var(--brand-primary)] font-medium">{clienteNombre}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleDownloadPDF}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-[#E2E8F0] text-[#0B1929] px-4 py-3 rounded-xl text-sm font-semibold shadow-sm hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors"
            >
              <FileText size={18} />
              Descargar PDF
            </button>
            <div className="text-right bg-[#E8F1FB] rounded-xl px-4 py-2 flex-shrink-0">
              <p className="text-[10px] text-[#6B7A8D] font-mono">TOTAL DÍA</p>
              <p className="text-2xl font-bold text-[var(--brand-primary)] font-mono leading-none mt-1">
                {totalKcal}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Day tabs ── */}
      <div className="px-6 md:px-8 flex gap-2 mb-6 mt-6 overflow-x-auto scroll-hide">
        {dias.map((d, i) => {
          // El nombre del día viene en d.dia o d.nombre
          const nombreDia = d.dia || d.nombre;
          return (
            <button
              key={d.id || i}
              onClick={() => { setActiveDay(i); setExpandedMeal(0); }}
              className={`flex-1 min-w-[44px] py-2 rounded-lg text-sm font-semibold transition-all ${
                activeDay === i
                  ? "bg-[var(--brand-primary)] text-white shadow-md"
                  : "bg-white text-[#6B7A8D] hover:bg-[#E8F1FB] border border-[#E2E8F0]"
              }`}
            >
              {getDayShort(nombreDia, i)}
            </button>
          );
        })}
      </div>

      {/* ── Meals list ── */}
      <div className="px-6 md:px-8 flex-1 overflow-y-auto space-y-3 pb-8">
        <p className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-4">
          {getDayFull(diaActual?.dia || diaActual?.nombre, activeDay)}
        </p>

        {comidas.length === 0 && (
          <p className="text-sm text-[#6B7A8D] italic">No hay comidas registradas para este día.</p>
        )}

        {comidas.map((meal, idx) => {
          const isExpanded = expandedMeal === idx;
          // Etiqueta visual: usamos meal.nombre como label principal
          const label = meal.nombre || `Comida ${idx + 1}`;
          const hora  = meal.hora || "";
          // Extracto de texto para mostrar en el acordeón cerrado
          const preview = meal.opcion1
            ? meal.opcion1.split(",")[0].substring(0, 50)
            : label;

          return (
            <div
              key={meal.id || idx}
              className={`bg-white rounded-xl border overflow-hidden transition-all ${
                isExpanded ? "border-[var(--brand-primary)] shadow-sm" : "border-[#E2E8F0]"
              }`}
            >
              {/* ── Row header ── */}
              <button
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
                onClick={() => setExpandedMeal(isExpanded ? null : idx)}
              >
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    isExpanded ? "bg-[var(--brand-primary)]" : "bg-[#CBD5E1]"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {hora && (
                      <>
                        <span className="text-xs font-mono text-[#6B7A8D]">{hora}</span>
                        <span className="w-1 h-1 rounded-full bg-[#CBD5E1]" />
                      </>
                    )}
                    <span className="text-xs font-semibold text-[var(--brand-primary)] uppercase tracking-wide">
                      {label}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[#0B1929] mt-0.5 truncate">{preview}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {meal.calorias > 0 && (
                    <div className="flex items-center gap-1 bg-[#FFF7ED] px-2 py-1 rounded-lg">
                      <Flame size={12} className="text-orange-400" />
                      <span className="text-xs font-mono font-semibold text-orange-500">
                        {meal.calorias}
                      </span>
                    </div>
                  )}
                  <ChevronRight
                    size={16}
                    className={`text-[#CBD5E1] transition-transform ${isExpanded ? "rotate-90 text-[var(--brand-primary)]" : ""}`}
                  />
                </div>
              </button>

              {/* ── Expanded content: diseño vertical optimizado para móviles ── */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-[#F0F4FA]">

                  {/* Opciones de comida en disposición vertical */}
                  <div className="flex flex-col gap-4 mt-4">
                    {/* Imagen a lo ancho (solo si existe) */}
                    {(meal.foto_url || meal.imagen_url) && (
                      <div className="w-full h-40 sm:h-48 rounded-xl bg-[#F0F4FA] overflow-hidden shrink-0">
                        <img
                          src={meal.foto_url || meal.imagen_url}
                          alt={label}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <p className="text-lg font-bold text-[#0B1929]">{label}</p>

                      {/* Opción 1 (Descripción completa sin line-clamp) */}
                      {meal.opcion1 && (
                        <p className="text-sm text-[#6B7A8D] leading-relaxed">
                          {meal.opcion1}
                        </p>
                      )}
                      
                      {/* Alternativa */}
                      {meal.opcion2 && (
                        <p className="text-sm text-[#9BA8B7] leading-relaxed mt-1">
                          <span className="font-semibold">Alt:</span> {meal.opcion2}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Macros (Proteína, Carbos, Grasas) — fila separada si existen */}
                  {(meal.proteina > 0 || meal.carbohidratos > 0 || meal.grasas > 0) && (
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <div className="flex items-center gap-1 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                        <span className="text-xs font-mono font-bold text-blue-700">{meal.proteina || 0}g</span>
                        <span className="text-[10px] text-blue-600">Prot</span>
                      </div>
                      <div className="flex items-center gap-1 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-lg">
                        <span className="text-xs font-mono font-bold text-purple-700">{meal.carbohidratos || 0}g</span>
                        <span className="text-[10px] text-purple-600">Carbs</span>
                      </div>
                      <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg">
                        <span className="text-xs font-mono font-bold text-amber-700">{meal.grasas || 0}g</span>
                        <span className="text-[10px] text-amber-600">Grasa</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
