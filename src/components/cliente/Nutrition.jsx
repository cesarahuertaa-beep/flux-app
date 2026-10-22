import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Flame, ChevronRight, Apple, FileText, ShoppingBag, Droplets, Plus, Minus, Check, CheckCircle2 } from "lucide-react";
import { useBrand } from "../BrandContext";
import { generateNutriPDF } from "../../utils/pdf";

const GroceryListModal = lazy(() => import("../ui/GroceryListModal"));

const DAY_SHORT = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const DAY_FULL  = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

export default function Nutrition({ dias, cliente, nutri, semanaActualCiclo = 1, isSelfManaged }) {
  const [activeDay, setActiveDay]       = useState(0);
  const [expandedMeal, setExpandedMeal] = useState(0); // Primer comida abierta por defecto
  const [showGrocery, setShowGrocery]   = useState(false);
  const brand = useBrand();

  // ── Hábitos diarios: Hidratación y Comidas Realizadas ──
  const habitStorageKey = `flux_nutri_habits_${cliente?.id || "user"}_s${semanaActualCiclo}_d${activeDay}`;
  const [habitsData, setHabitsData] = useState(() => {
    try {
      const saved = localStorage.getItem(habitStorageKey);
      return saved ? JSON.parse(saved) : { agua: 0, comidasDone: {} };
    } catch {
      return { agua: 0, comidasDone: {} };
    }
  });

  // Al cambiar de día o semana, recargar los hábitos correspondientes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(habitStorageKey);
      setHabitsData(saved ? JSON.parse(saved) : { agua: 0, comidasDone: {} });
    } catch {
      setHabitsData({ agua: 0, comidasDone: {} });
    }
  }, [habitStorageKey]);

  // Persistir cambios
  const updateHabits = (updater) => {
    setHabitsData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try {
        localStorage.setItem(habitStorageKey, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const pesoKg = parseFloat(cliente?.peso || nutri?.peso || 0);
  const metaAguaMl = pesoKg > 0 ? Math.round(pesoKg * 35 / 50) * 50 : 2500;
  const aguaActual = habitsData?.agua || 0;
  const pctAgua = Math.min(100, Math.round((aguaActual / metaAguaMl) * 100));

  const addAgua = (ml) => {
    updateHabits((prev) => ({
      ...prev,
      agua: Math.max(0, (prev.agua || 0) + ml)
    }));
  };

  const toggleComidaDone = (mealId, e) => {
    if (e) e.stopPropagation();
    updateHabits((prev) => ({
      ...prev,
      comidasDone: {
        ...(prev.comidasDone || {}),
        [mealId]: !prev.comidasDone?.[mealId]
      }
    }));
  };

  if (!dias || dias.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
          <Apple className="w-8 h-8 text-[#94A3B8]" />
        </div>
        <h3 className="text-[#0B1929] font-bold text-lg mb-2">{isSelfManaged ?"Sin plan creado" :"Sin plan asignado"}</h3>
        <p className="text-[#6B7A8D] text-sm max-w-[250px]">
          {isSelfManaged ?"Aún no has creado tu plan de alimentación para este ciclo." :"Tu nutriólogo aún no ha asignado tu dieta para este ciclo."}
        </p>
      </div>
    );
  }

  const diaActual  = dias[activeDay];
  const comidas    = diaActual?.comidas || [];
  const caloriasMeta = nutri?.calorias || nutri?.calorias_meta || 0; // fallback to legacy
  const sumKcal = comidas.reduce((s, m) => s + (Number(m.calorias) || 0), 0);
  const totalKcal = sumKcal > 0 ? sumKcal : caloriasMeta;
  const totalProt = comidas.reduce((s, m) => s + (Number(m.proteina) || 0), 0);
  const totalCarbs = comidas.reduce((s, m) => s + (Number(m.carbohidratos) || 0), 0);
  const totalGrasas = comidas.reduce((s, m) => s + (Number(m.grasas) || 0), 0);
  const clienteNombre = cliente?.nombre;

  const getDayShort = (nombre, i) => {
    if (!nombre) return DAY_SHORT[i] ?? `Día ${i + 1}`;
    const parts = String(nombre).split('|');
    return parts.length > 1 ? parts[0] :"S/D";
  };
  const getDayFull = (nombre, i) => {
    if (!nombre) return DAY_FULL[i] || `Día ${i + 1}`;
    const parts = String(nombre).split('|');
    const title = parts.length > 1 ? parts.slice(1).join('|') : parts[0];
    return `${title} — Semana ${semanaActualCiclo}`;
  };

  const handleDownloadPDF = () => {
    generateNutriPDF(cliente, nutri, dias, brand);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F7F9FC] min-h-full">
      {/* ── Header ── */}
      <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-8 pb-4 md:pb-6 bg-white border-b border-[#F0F4FA] pr-12 md:pr-8 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-0.5 sm:mb-1">
                Plan de Alimentación
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
                Nutrición Semanal
              </h1>
              {isSelfManaged ? (
                <p className="text-xs sm:text-sm text-[#6B7A8D] mt-0.5 sm:mt-1">
                  Tu plan de alimentación activo — Semana {semanaActualCiclo}
                </p>
              ) : clienteNombre ? (
                <p className="text-xs sm:text-sm text-[#6B7A8D] mt-0.5 sm:mt-1">
                  Paciente: <span className="text-[var(--brand-primary)] font-medium">{clienteNombre}</span>
                </p>
              ) : null}
            </div>

            {/* Total Día pill (en mobile va en la fila superior con el título para ahorrar espacio vertical) */}
            <div className="sm:hidden bg-[#E8F1FB] rounded-xl px-3 py-1.5 flex flex-col items-end shrink-0 border border-[#D0E2F7]">
              <p className="text-[9px] text-[#6B7A8D] font-mono font-semibold uppercase tracking-wider">Total Día</p>
              <p className="flex items-center gap-1 text-base font-bold text-[var(--brand-primary)] font-mono leading-none mt-0.5">
                <Flame size={15} className="text-[var(--brand-primary)]" />
                {totalKcal} <span className="text-[10px] text-[var(--brand-primary)]/70 font-sans">kcal</span>
              </p>
            </div>
          </div>

          {/* Action buttons + Total Día desktop */}
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={() => setShowGrocery(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white border border-[#E2E8F0] text-[#0B1929] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors"
            >
              <ShoppingBag size={15} className="text-[var(--brand-primary)] shrink-0" />
              <span>Lista del Súper</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white border border-[#E2E8F0] text-[#0B1929] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors"
            >
              <FileText size={15} className="shrink-0" />
              <span>Descargar PDF</span>
            </button>
            
            {/* Total Día badge (en desktop) */}
            <div className="hidden sm:flex bg-[#E8F1FB] rounded-xl px-4 py-2 flex-shrink-0 items-center gap-4 border border-[#D0E2F7]">
              <div className="text-left">
                <p className="text-[10px] text-[#6B7A8D] font-mono font-semibold uppercase tracking-wider">Total Día</p>
                <p className="flex items-center gap-1 text-xl sm:text-2xl font-bold text-[var(--brand-primary)] font-mono leading-none mt-1">
                  <Flame size={20} className="text-[var(--brand-primary)]" />
                  {totalKcal} <span className="text-xs text-[var(--brand-primary)]/70 font-sans tracking-normal">kcal</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Day tabs ── */}
      <div className="sticky top-0 z-30 bg-[#F7F9FC]/95 backdrop-blur-sm px-4 sm:px-6 md:px-8 py-2.5 mb-2 border-b border-[#E2E8F0]/60 shrink-0">
        <div className="flex gap-2 overflow-x-auto scroll-hide">
          {dias.map((d, i) => {
            // El nombre del día viene en d.dia o d.nombre
            const nombreDia = d.dia || d.nombre;
            return (
              <button
                key={d.id || i}
                onClick={() => { setActiveDay(i); setExpandedMeal(0); }}
                className={`flex-1 min-w-[50px] py-2 px-3 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  activeDay === i
                    ?"bg-[var(--brand-primary)] text-white shadow-sm"
                    :"bg-white text-[#6B7A8D] hover:bg-[#E8F1FB] border border-[#E2E8F0]"
                }`}
              >
                {getDayShort(nombreDia, i)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Day Content (Habits & Adherence + Meals) — scrolls smoothly with page ── */}
      <div className="px-4 sm:px-6 md:px-8 flex-1 space-y-3 pb-32 md:pb-12 min-h-0">
        {/* Habits & Adherence Widget */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-3.5 sm:p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
          {/* Hidratación (Agua) */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#0B1929]">
                <Droplets size={16} className="text-cyan-500 fill-cyan-500" />
                <span>Hidratación del Día</span>
              </div>
              <span className="font-mono text-cyan-600 font-bold text-xs">
                {aguaActual} / {metaAguaMl} ml ({pctAgua}%)
              </span>
            </div>

            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${pctAgua}%` }}
              />
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <button
                type="button"
                onClick={() => addAgua(250)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-700 hover:bg-cyan-100 font-semibold text-xs border border-cyan-200 transition-colors cursor-pointer"
              >
                <Plus size={13} />
                <span>250 ml (1 vaso)</span>
              </button>
              <button
                type="button"
                onClick={() => addAgua(500)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs border border-blue-200 transition-colors cursor-pointer"
              >
                <Plus size={13} />
                <span>500 ml (1 botella)</span>
              </button>
              {aguaActual > 0 && (
                <button
                  type="button"
                  onClick={() => addAgua(-250)}
                  className="p-1 rounded-lg bg-gray-100 text-[#6B7A8D] hover:bg-gray-200 text-xs transition-colors cursor-pointer"
                  title="Restar 250 ml"
                >
                  <Minus size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="hidden md:block w-px h-12 bg-[#E2E8F0]" />

          {/* Adherencia de Comidas del Día */}
          <div className="w-full md:w-64 flex flex-col gap-2">
            {(() => {
              const realizadasCount = comidas.filter((_, idx) => !!habitsData?.comidasDone?.[idx]).length;
              const pctComidas = comidas.length > 0 ? Math.round((realizadasCount / comidas.length) * 100) : 0;
              return (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#0B1929]">Adherencia del Día</span>
                    <span className="font-mono text-emerald-600 font-bold text-xs">
                      {realizadasCount} / {comidas.length} comidas ({pctComidas}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${pctComidas}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#6B7A8D]">
                    {pctComidas === 100
                      ? "🎉 ¡Excelente! Cumpliste todas las comidas hoy."
                      : "Marca cada comida cumplida con el botón ✓."}
                  </p>
                </>
              );
            })()}
          </div>
        </div>

        {/* Subtítulo del día activo */}
        <div className="pt-1">
          <p className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase">
            {getDayFull(diaActual?.dia || diaActual?.nombre, activeDay)}
          </p>
        </div>

        {comidas.length === 0 && (
          <p className="text-sm text-[#6B7A8D] italic">No hay comidas registradas para este día.</p>
        )}

        {comidas.map((meal, idx) => {
          const isExpanded = expandedMeal === idx;
          const isDone = !!habitsData?.comidasDone?.[idx];
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
                isDone
                  ? "border-emerald-200 bg-emerald-50/20 shadow-xs"
                  : isExpanded
                  ? "border-[var(--brand-primary)] shadow-sm"
                  : "border-[#E2E8F0]"
              }`}
            >
              {/* ── Row header ── */}
              <div className="w-full flex items-center gap-3 px-5 py-4">
                {/* Botón de Check de Comida Realizada */}
                <button
                  type="button"
                  onClick={(e) => toggleComidaDone(idx, e)}
                  title={isDone ? "Comida cumplida (clic para desmarcar)" : "Marcar como comida realizada"}
                  className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                    isDone
                      ? "bg-emerald-500 border-emerald-500 text-white shadow-xs"
                      : "border-gray-300 bg-white hover:border-emerald-400 text-gray-400 hover:text-emerald-500"
                  }`}
                >
                  <Check size={14} className="stroke-[3]" />
                </button>

                <button
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                  onClick={() => setExpandedMeal(isExpanded ? null : idx)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {hora && (
                        <>
                          <span className="text-xs font-mono text-[#6B7A8D]">{hora}</span>
                          <span className="w-1 h-1 rounded-full bg-[#CBD5E1]" />
                        </>
                      )}
                      <span className={`text-xs font-semibold uppercase tracking-wide ${isDone ? "text-emerald-600" : "text-[var(--brand-primary)]"}`}>
                        {label} {isDone && "✓"}
                      </span>
                    </div>
                    <p className={`text-sm font-medium mt-0.5 truncate ${isDone ? "text-gray-500" : "text-[#0B1929]"}`}>
                      {preview}
                    </p>
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
              </div>

              {/* ── Expanded content: diseño vertical optimizado para móviles ── */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-[#F0F4FA]">

                    {/* Layout: imagen izquierda, contenido derecha igual que en Entrenamiento */}
                    <div className="flex mt-4 gap-3 sm:gap-4">
  
                      {(meal.foto_url || meal.imagen_url) && (
                        <div className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm relative flex items-center justify-center">
                          <img
                            src={meal.foto_url || meal.imagen_url}
                            alt={label}
                            className="w-full h-full object-contain mix-blend-multiply"
                          />
                        </div>
                      )}
  
                      {/* Contenido: nombre, opciones, alternativa */}
                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
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

      {/* ── Modal de Lista de Compras del Súper ── */}
      {showGrocery && (
        <Suspense fallback={null}>
          <GroceryListModal
            dias={dias}
            onClose={() => setShowGrocery(false)}
            clienteNombre={clienteNombre}
            semanaActualCiclo={semanaActualCiclo}
          />
        </Suspense>
      )}
    </div>
  );
}
