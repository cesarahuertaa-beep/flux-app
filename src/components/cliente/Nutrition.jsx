import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Flame, ChevronRight, Apple, FileText, ShoppingBag, Droplets, Plus, Minus, Check, CheckCircle2 } from "lucide-react";
import { useBrand } from "../BrandContext";
import { generateNutriPDF } from "../../utils/pdf";
import { CachedImage } from "../../lib/mediaCache";

const GroceryListModal = lazy(() => import("../ui/GroceryListModal"));

const DAY_SHORT = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const DAY_FULL  = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const JS_DAY_CODES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const normalizeDayCode = (str) =>
  String(str || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export default function Nutrition({
  dias,
  cliente,
  nutri,
  semanaActualCiclo = 1,
  ultimoPeso = null,
  nutriProgreso = {},
  onNutriProgressChange,
  isSelfManaged,
}) {
  const [activeDay, setActiveDay]       = useState(0);
  const [expandedMeal, setExpandedMeal] = useState(0); // Primer comida abierta por defecto
  const [showGrocery, setShowGrocery]   = useState(false);
  const autoSelectedForPlanRef          = useRef(null);
  const brand = useBrand();

  const getDayShort = (nombre, i) => {
    if (!nombre) return DAY_SHORT[i] ?? `Día ${i + 1}`;
    const parts = String(nombre).split("|");
    return parts.length > 1 ? parts[0] : "S/D";
  };

  const getDayFull = (nombre, i) => {
    if (!nombre) return DAY_FULL[i] || `Día ${i + 1}`;
    const parts = String(nombre).split("|");
    const title = parts.length > 1 ? parts.slice(1).join("|") : parts[0];
    return `${title || DAY_FULL[i] || `Día ${i + 1}`} — Semana ${semanaActualCiclo}`;
  };

  // Auto-seleccionar la pestaña del día actual (en hora local del dispositivo) al cargar el plan
  useEffect(() => {
    if (!Array.isArray(dias) || dias.length === 0) return;
    const planSignature = `${cliente?.id || ""}_${dias.map((d) => d.id).join(",")}`;
    if (autoSelectedForPlanRef.current === planSignature) return;
    autoSelectedForPlanRef.current = planSignature;

    const todayCodeNorm = normalizeDayCode(JS_DAY_CODES[new Date().getDay()]);
    const matchIdx = dias.findIndex((d, i) => {
      const code = getDayShort(d.dia || d.nombre, i);
      return normalizeDayCode(code) === todayCodeNorm;
    });

    if (matchIdx >= 0) {
      setActiveDay(matchIdx);
    } else {
      // Si el plan es de 5 días (ej. Lun–Vie) y hoy es Sáb o Dom, mostrar el último día hábil del plan (ej. Vie)
      const isWeekend = todayCodeNorm === "sab" || todayCodeNorm === "dom";
      if (isWeekend) {
        const friIdx = dias.findIndex((d, i) => normalizeDayCode(getDayShort(d.dia || d.nombre, i)) === "vie");
        setActiveDay(friIdx >= 0 ? friIdx : dias.length - 1);
      } else {
        setActiveDay(0);
      }
    }
  }, [dias, cliente?.id]);

  const safeActiveDay = Array.isArray(dias) && activeDay < dias.length ? activeDay : 0;
  const diaActual     = Array.isArray(dias) ? dias[safeActiveDay] : null;
  const diaId         = diaActual?.id;
  const comidas       = diaActual?.comidas || [];

  const pesoKg = parseFloat(ultimoPeso || cliente?.peso || nutri?.peso || 0);
  const metaAguaMl = pesoKg > 0 ? Math.round((pesoKg * 35) / 50) * 50 : 2500;

  // ── Hábitos por Día del Plan + Semana del Ciclo (se conserva toda la semana y se reinicia al llegar la nueva semana) ──
  const habitStorageKey = `flux_nutri_habits_${cliente?.id || "user"}_s${semanaActualCiclo}_dia_${diaId || safeActiveDay}`;
  const legacyStorageKey = `flux_nutri_habits_${cliente?.id || "user"}_s${semanaActualCiclo}_d${safeActiveDay}`;

  const readLocalHabits = () => {
    try {
      const saved = localStorage.getItem(habitStorageKey) || localStorage.getItem(legacyStorageKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const serverRec = diaId ? nutriProgreso?.[`${diaId}-${semanaActualCiclo}`] : null;

  const [habitsData, setHabitsData] = useState(() => {
    if (serverRec) {
      return { agua: Number(serverRec.agua_ml) || 0, comidasDone: serverRec.comidas_done || {} };
    }
    return readLocalHabits() || { agua: 0, comidasDone: {} };
  });

  // Al cambiar de día, de semana o recibir datos sincronizados, actualizar el estado del día activo
  useEffect(() => {
    const rec = diaId ? nutriProgreso?.[`${diaId}-${semanaActualCiclo}`] : null;
    const local = readLocalHabits();

    if (rec) {
      const next = { agua: Number(rec.agua_ml) || 0, comidasDone: rec.comidas_done || {} };
      setHabitsData(next);
      try { localStorage.setItem(habitStorageKey, JSON.stringify(next)); } catch {}
    } else if (local) {
      setHabitsData(local);
      // Si había datos en localStorage que aún no estaban en Supabase, sincronizarlos automáticamente
      const hasLocalData = (Number(local.agua) > 0) || Object.values(local.comidasDone || {}).some(Boolean);
      if (hasLocalData && diaId && typeof onNutriProgressChange === "function") {
        const doneCount = comidas.filter((m, idx) => Boolean(
          (m?.id && local.comidasDone?.[m.id]) ||
          local.comidasDone?.[idx] ||
          local.comidasDone?.[String(idx)] ||
          (m?.orden != null && local.comidasDone?.[m.orden])
        )).length;
        onNutriProgressChange({
          dia_id: diaId,
          semana: Number(semanaActualCiclo) || 1,
          agua_ml: Number(local.agua) || 0,
          meta_agua_ml: metaAguaMl,
          comidas_done: local.comidasDone || {},
          comidas_realizadas: doneCount,
          total_comidas: comidas.length,
        });
      }
    } else {
      setHabitsData({ agua: 0, comidasDone: {} });
    }
  }, [habitStorageKey, diaId, semanaActualCiclo, serverRec?.updated_at]);

  const isMealDone = (meal, idx, doneObj = habitsData?.comidasDone) => {
    if (!doneObj || typeof doneObj !== "object") return false;
    return Boolean(
      (meal?.id && doneObj[meal.id]) ||
      doneObj[idx] ||
      doneObj[String(idx)] ||
      (meal?.orden != null && doneObj[meal.orden])
    );
  };

  // Persistir cambios en localStorage + Supabase (Local-First)
  const updateHabits = (updater) => {
    setHabitsData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try {
        localStorage.setItem(habitStorageKey, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      if (diaId && typeof onNutriProgressChange === "function") {
        const doneCount = comidas.filter((m, idx) => Boolean(
          (m?.id && next.comidasDone?.[m.id]) ||
          next.comidasDone?.[idx] ||
          next.comidasDone?.[String(idx)] ||
          (m?.orden != null && next.comidasDone?.[m.orden])
        )).length;
        onNutriProgressChange({
          dia_id: diaId,
          semana: Number(semanaActualCiclo) || 1,
          agua_ml: Number(next.agua) || 0,
          meta_agua_ml: metaAguaMl,
          comidas_done: next.comidasDone || {},
          comidas_realizadas: doneCount,
          total_comidas: comidas.length,
        });
      }
      return next;
    });
  };

  const aguaActual = habitsData?.agua || 0;
  const pctAgua = Math.min(100, Math.round((aguaActual / metaAguaMl) * 100));

  const addAgua = (ml) => {
    updateHabits((prev) => ({
      ...prev,
      agua: Math.max(0, (prev.agua || 0) + ml)
    }));
  };

  const toggleComidaDone = (meal, idx, e) => {
    if (e) e.stopPropagation();
    const isDone = isMealDone(meal, idx);
    const nextVal = !isDone;

    updateHabits((prev) => {
      const nextDone = { ...(prev.comidasDone || {}) };
      nextDone[idx] = nextVal;
      nextDone[String(idx)] = nextVal;
      if (meal?.id) {
        nextDone[meal.id] = nextVal;
      }
      if (meal?.orden != null) {
        nextDone[meal.orden] = nextVal;
      }
      return {
        ...prev,
        comidasDone: nextDone
      };
    });
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

  const caloriasMeta = Number(nutri?.calorias || nutri?.calorias_meta) || 0;
  const sumKcal = comidas.reduce((s, m) => s + (Number(m.calorias) || 0), 0);
  const sumProt = comidas.reduce((s, m) => s + (Number(m.proteina) || 0), 0);
  const sumCarbs = comidas.reduce((s, m) => s + (Number(m.carbohidratos) || 0), 0);
  const sumGrasas = comidas.reduce((s, m) => s + (Number(m.grasas) || 0), 0);
  const totalKcal = sumKcal > 0 ? sumKcal : caloriasMeta;
  const totalProt = sumProt > 0 ? sumProt : (Number(nutri?.proteina) || 0);
  const totalCarbs = sumCarbs > 0 ? sumCarbs : (Number(nutri?.carbohidratos) || 0);
  const totalGrasas = sumGrasas > 0 ? sumGrasas : (Number(nutri?.grasas) || 0);
  const clienteNombre = cliente?.nombre;

  const handleDownloadPDF = () => {
    generateNutriPDF(cliente, nutri, dias, brand);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F7F9FC] min-h-full">
      {/* ── Header ── */}
      <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-8 pb-4 md:pb-6 bg-white border-b border-[#F0F4FA] shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-0.5 sm:mb-1 whitespace-nowrap">
                Plan de Alimentación
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-[#0B1929] whitespace-nowrap" style={{ fontFamily: "DM Sans" }}>
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
              <p className="text-[9px] text-[#6B7A8D] font-mono font-semibold uppercase tracking-wider whitespace-nowrap">Total Día</p>
              <p className="flex items-center gap-1 text-base font-bold text-[var(--brand-primary)] font-mono leading-none mt-0.5 whitespace-nowrap">
                <Flame size={15} className="text-[var(--brand-primary)]" />
                {totalKcal} <span className="text-[10px] text-[var(--brand-primary)]/70 font-sans">kcal</span>
              </p>
            </div>
          </div>

          {/* Action buttons + Total Día desktop */}
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={() => setShowGrocery(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white border border-[#E2E8F0] text-[#0B1929] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors whitespace-nowrap"
            >
              <ShoppingBag size={15} className="text-[var(--brand-primary)] shrink-0" />
              <span>Lista del Súper</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white border border-[#E2E8F0] text-[#0B1929] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors whitespace-nowrap"
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
      <div className="px-4 sm:px-6 md:px-8 flex-1 space-y-3 pb-6 md:pb-8 min-h-0">
        {/* Habits & Adherence Widget */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-3.5 sm:p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
          {/* Hidratación (Agua) */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#0B1929] whitespace-nowrap">
                <Droplets size={16} className="text-cyan-500 fill-cyan-500 shrink-0" />
                <span>Hidratación del Día</span>
              </div>
              <span className="font-mono text-cyan-600 font-bold text-xs whitespace-nowrap">
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
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-700 hover:bg-cyan-100 font-semibold text-xs border border-cyan-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus size={13} className="shrink-0" />
                <span>250 ml (1 vaso)</span>
              </button>
              <button
                type="button"
                onClick={() => addAgua(500)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs border border-blue-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus size={13} className="shrink-0" />
                <span>500 ml (1 botella)</span>
              </button>
              {aguaActual > 0 && (
                <button
                  type="button"
                  onClick={() => addAgua(-250)}
                  className="p-1 rounded-lg bg-gray-100 text-[#6B7A8D] hover:bg-gray-200 text-xs transition-colors cursor-pointer shrink-0"
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
              const realizadasCount = comidas.filter((m, idx) => isMealDone(m, idx)).length;
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
                  <p className="text-[10px] text-[#6B7A8D] flex items-center gap-1.5">
                    {pctComidas === 100 ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>¡Excelente! Cumpliste todas las comidas hoy.</span>
                      </>
                    ) : (
                      <span>Marca cada comida cumplida con el botón de verificación.</span>
                    )}
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
          const isDone = isMealDone(meal, idx);
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
                  onClick={(e) => toggleComidaDone(meal, idx, e)}
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
                      <span className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-1 ${isDone ? "text-emerald-600" : "text-[var(--brand-primary)]"}`}>
                        <span>{label}</span>
                        {isDone && <Check className="w-3 h-3 stroke-[3]" />}
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
                          <CachedImage
                            src={meal.foto_url || meal.imagen_url}
                            alt={label}
                            className="w-full h-full object-contain mix-blend-multiply"
                            fallback={<Apple size={28} className="text-[#6B7A8D]" />}
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
