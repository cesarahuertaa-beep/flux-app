import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  FileText,
  Layers,
  Eye,
  Scale,
  Activity,
  BicepsFlexed,
  Ruler,
  Heart,
  X,
  ArrowUp,
  ArrowDown,
  Sparkles,
  CheckCircle2,
  Lock,
  Camera,
  Zap,
  Utensils,
  Moon,
  Stethoscope,
  Target,
  Flame,
  Trash2,
  AlertCircle
} from "lucide-react";
import { EvolutionCharts } from "../ui/EvolutionCharts";
import { BeforeAfterComparator } from "../ui/BeforeAfterComparator";
import { ConfirmModal } from "../ui/ConfirmModal";
import { generateProgresoPDF } from "../../utils/pdf";
import {
  enrichMetrica,
  linkMetricasToCiclos,
  getMetodoLabel,
  getGoalPresetInfo,
  getActivityFactorInfo,
} from "../../lib/bodyComposition";
import { dbPeek, dbGet, dbDel, updateQueryCache } from "../../lib/supabase";
import { parseFotos } from "../../utils/helpers";
import { useBackButton } from "../../lib/backButtonHandler";

const fmtDate = (d) => {
  if (!d) return "";
  const parts = d.split("T")[0].split("-");
  if (parts.length === 3) {
    const months = [
      "ene", "feb", "mar", "abr", "may", "jun",
      "jul", "ago", "sep", "oct", "nov", "dic"
    ];
    return `${parseInt(parts[2], 10)} ${months[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
  }
  return d;
};

export default function ProgresoHistoricoModal({
  isOpen,
  onClose,
  cliente,
  ciclos = [],
  brand,
}) {
  const [metricas, setMetricas] = useState(() => {
    if (!cliente?.id) return [];
    const peeked = dbPeek(`metricas_progreso?cliente_id=eq.${cliente.id}&order=fecha.desc`);
    return Array.isArray(peeked) ? peeked.map(enrichMetrica) : [];
  });
  const [loading, setLoading] = useState(false);
  const [selectedEval, setSelectedEval] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useBackButton(Boolean(confirmDelete), () => setConfirmDelete(null), 115);
  useBackButton(Boolean(lightboxUrl), () => setLightboxUrl(null), 110);
  useBackButton(Boolean(selectedEval), () => setSelectedEval(null), 105);
  useBackButton(isOpen && !selectedEval && !lightboxUrl && !confirmDelete, onClose, 100);

  useEffect(() => {
    if (!isOpen || !cliente?.id) return;
    let cancelled = false;

    const loadData = async () => {
      const peeked = dbPeek(`metricas_progreso?cliente_id=eq.${cliente.id}&order=fecha.desc`);
      if (Array.isArray(peeked) && peeked.length > 0) {
        if (!cancelled) setMetricas(peeked.map(enrichMetrica));
      }
      setLoading(true);
      try {
        const fresh = await dbGet(`metricas_progreso?cliente_id=eq.${cliente.id}&order=fecha.desc`).catch(() => []);
        if (!cancelled && Array.isArray(fresh)) {
          setMetricas(fresh.map(enrichMetrica));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [isOpen, cliente?.id]);

  // Vincular cada métrica con su plan correspondiente
  const allLinkedMetricas = useMemo(() => {
    return linkMetricasToCiclos(metricas, ciclos);
  }, [metricas, ciclos]);

  // Evaluaciones que no pertenecen a ningún ciclo actual
  const unlinkedEvals = useMemo(() => {
    return allLinkedMetricas.filter(
      (m) => !ciclos.some((c) => String(c.id) === String(m.ciclo_id))
    );
  }, [allLinkedMetricas, ciclos]);

  // Eliminar evaluación con confirmación y sincronización de caché
  const handleDeleteEval = (ev) => {
    if (!ev) return;
    setConfirmDelete({
      title: "¿Eliminar evaluación?",
      description: `Se eliminará permanentemente la evaluación del ${fmtDate(ev.fecha)} (${ev.peso ? `${ev.peso} kg` : "sin peso"} • ${ev.grasa_pct ? `${ev.grasa_pct}%` : "sin %"} grasa). Esta acción destruirá permanentemente sus mediciones y no se puede deshacer.`,
      confirmText: "Eliminar evaluación",
      danger: true,
      icon: "trash",
      onConfirm: async () => {
        const idStr = String(ev.id);
        setConfirmDelete(null);
        if (selectedEval?.id === ev.id) {
          setSelectedEval(null);
        }

        // 1. Eliminación optimista en el modal
        setMetricas((prev) => prev.filter((m) => String(m.id) !== idStr));

        // 2. Actualizar caché de consultas de metricas_progreso
        updateQueryCache("metricas_progreso", (cachedList) => {
          if (!Array.isArray(cachedList)) return [];
          return cachedList.filter((m) => String(m.id) !== idStr);
        });

        // 3. Ejecutar borrado en base de datos
        try {
          await dbDel(`metricas_progreso?id=eq.${idStr}`);
          if (typeof window !== "undefined" && cliente?.id) {
            window.dispatchEvent(
              new CustomEvent("flux:metricas-updated", {
                detail: { clienteId: cliente.id, source: "ProgresoHistoricoModal" },
              })
            );
          }
        } catch (err) {
          console.error("Error al eliminar evaluación:", err);
        }
      },
    });
  };

  // Orden cronológico (de la más antigua a la más reciente)
  const chronologicalEvals = useMemo(() => {
    return [...allLinkedMetricas]
      .filter((m) => m && m.fecha)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  }, [allLinkedMetricas]);

  // Fotos de todas las evaluaciones para el comparador antes/después
  const allClientPhotos = useMemo(() => {
    return allLinkedMetricas.flatMap((m) =>
      parseFotos(m.fotos)
        .filter(Boolean)
        .map((url) => ({
          url,
          fecha: m.fecha,
          label: fmtDate(m.fecha),
          peso: m.peso,
          grasa_pct: m.grasa_pct,
        }))
    );
  }, [allLinkedMetricas]);

  // KPIs de cambio total
  const kpiStats = useMemo(() => {
    if (chronologicalEvals.length === 0) return null;
    const initial = chronologicalEvals[0];
    const current = chronologicalEvals[chronologicalEvals.length - 1];

    const weightDelta =
      initial.peso && current.peso && initial.id !== current.id
        ? Number((Number(current.peso) - Number(initial.peso)).toFixed(1))
        : null;

    const fatDelta =
      initial.grasa_pct && current.grasa_pct && initial.id !== current.id
        ? Number((Number(current.grasa_pct) - Number(initial.grasa_pct)).toFixed(1))
        : null;

    const lbmDelta =
      initial.masa_libre_grasa && current.masa_libre_grasa && initial.id !== current.id
        ? Number((Number(current.masa_libre_grasa) - Number(initial.masa_libre_grasa)).toFixed(1))
        : null;

    return {
      initial,
      current,
      weightDelta,
      fatDelta,
      lbmDelta,
      totalEvals: allLinkedMetricas.length,
      totalPlanes: ciclos.length,
    };
  }, [chronologicalEvals, allLinkedMetricas, ciclos]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#F8FAFC] flex flex-col overflow-hidden animate-in fade-in duration-150">
      {/* ── Top Header Fijo (Estilo Nueva Rutina / Nueva Dieta) ── */}
      <div className="shrink-0 bg-white border-b border-[#E2E8F0] shadow-2xs z-30">
        <div className="px-4 md:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#6B7A8D] hover:text-[#0B1929] transition-colors py-1.5 px-2.5 sm:px-3 rounded-xl hover:bg-gray-100 shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver</span>
            </button>
            <span className="text-[#CBD5E1] hidden sm:inline">|</span>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-[#0B1929] truncate flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--brand-primary)] shrink-0" />
                <span>Progreso Histórico Plan a Plan</span>
              </h2>
              <div className="text-[11px] text-[#6B7A8D] hidden sm:block truncate">
                {cliente?.nombre} • {ciclos.length} Planes • {allLinkedMetricas.length} Evaluaciones
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {allLinkedMetricas.length > 0 && (
              <button
                type="button"
                onClick={() => generateProgresoPDF(cliente, allLinkedMetricas, brand)}
                className="border border-[#E2E8F0] bg-white text-[#0B1929] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Generar expediente PDF con todas las evaluaciones"
              >
                <FileText className="w-4 h-4 text-[var(--brand-primary)]" />
                <span className="hidden sm:inline">Descargar PDF Histórico</span>
                <span className="sm:hidden">PDF</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-gray-100 text-[#0B1929] text-xs sm:text-sm font-bold hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* ── Cuerpo a Pantalla Completa ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
        {/* Banner de Resumen Global KPIs */}
        {kpiStats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Peso */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-[var(--brand-primary)]" /> Peso Corporal
                </span>
                {kpiStats.weightDelta !== null && (
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                      kpiStats.weightDelta < 0
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-blue-50 text-[var(--brand-primary)]"
                    }`}
                  >
                    {kpiStats.weightDelta > 0 ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )}
                    {Math.abs(kpiStats.weightDelta)} kg
                  </span>
                )}
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#0B1929] font-['Rajdhani']">
                {kpiStats.current.peso || "—"}{" "}
                <span className="text-xs text-[#6B7A8D] font-normal">kg actual</span>
              </div>
              <div className="text-[11px] text-[#6B7A8D] mt-0.5">
                Inicial: {kpiStats.initial.peso || "—"} kg ({fmtDate(kpiStats.initial.fecha)})
              </div>
            </div>

            {/* % Grasa */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-500" /> % Grasa
                </span>
                {kpiStats.fatDelta !== null && (
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                      kpiStats.fatDelta < 0
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {kpiStats.fatDelta > 0 ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )}
                    {Math.abs(kpiStats.fatDelta)}%
                  </span>
                )}
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#0B1929] font-['Rajdhani']">
                {kpiStats.current.grasa_pct || "—"}{" "}
                <span className="text-xs text-[#6B7A8D] font-normal">% actual</span>
              </div>
              <div className="text-[11px] text-[#6B7A8D] mt-0.5">
                Inicial: {kpiStats.initial.grasa_pct ? `${kpiStats.initial.grasa_pct}%` : "—"}
              </div>
            </div>

            {/* Masa Magra */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider flex items-center gap-1.5">
                  <BicepsFlexed className="w-3.5 h-3.5 text-emerald-600" /> Masa Magra
                </span>
                {kpiStats.lbmDelta !== null && (
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                      kpiStats.lbmDelta > 0
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-[#6B7A8D]"
                    }`}
                  >
                    {kpiStats.lbmDelta > 0 ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )}
                    {Math.abs(kpiStats.lbmDelta)} kg
                  </span>
                )}
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-700 font-['Rajdhani']">
                {kpiStats.current.masa_libre_grasa || "—"}{" "}
                <span className="text-xs text-[#6B7A8D] font-normal">kg actual</span>
              </div>
              <div className="text-[11px] text-[#6B7A8D] mt-0.5">
                Inicial: {kpiStats.initial.masa_libre_grasa ? `${kpiStats.initial.masa_libre_grasa} kg` : "—"}
              </div>
            </div>

            {/* Planes y Evaluaciones */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-2xs flex flex-col justify-between">
              <span className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-600" /> Trayectoria
              </span>
              <div className="text-xl sm:text-2xl font-black text-[#0B1929] font-['Rajdhani'] mt-1">
                {kpiStats.totalPlanes}{" "}
                <span className="text-xs text-[#6B7A8D] font-normal">planes</span>
                {" • "}
                {kpiStats.totalEvals}{" "}
                <span className="text-xs text-[#6B7A8D] font-normal">evals</span>
              </div>
              <div className="text-[11px] text-[#6B7A8D] mt-0.5 truncate">
                {ciclos.find((c) => c.activo)?.nombre?.split("|")[0] || "Plan activo"}
              </div>
            </div>
          </div>
        )}

        {/* ── 1. Gráficas de Evolución en función del tiempo ── */}
        {allLinkedMetricas.length > 0 ? (
          <div className="bg-white rounded-3xl p-5 md:p-7 border border-[#E2E8F0] shadow-2xs">
            <div className="flex items-center justify-between gap-3 mb-3 border-b border-[#F0F4FA] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0B1929]">
                    Curvas de Evolución en el Tiempo
                  </h3>
                  <p className="text-xs text-[#6B7A8D]">
                    Ploteo continuo cronológico de todas las evaluaciones plan a plan
                  </p>
                </div>
              </div>
            </div>

            <EvolutionCharts
              metricas={allLinkedMetricas}
              brandColor={brand?.color_primario}
            />
          </div>
        ) : (
          <div className="text-center py-16 text-[#6B7A8D] bg-white rounded-3xl border border-dashed border-[#E2E8F0] p-8 shadow-2xs">
            <div className="flex justify-center mb-3 text-[#CBD5E1]">
              <TrendingUp className="w-14 h-14" />
            </div>
            <h3 className="text-base font-bold text-[#0B1929] mb-1.5">
              Sin evaluaciones registradas aún
            </h3>
            <p className="text-xs sm:text-sm text-[#6B7A8D] max-w-md mx-auto">
              En cuanto registres evaluaciones y check-ins en los planes del paciente, aquí se trazarán automáticamente sus curvas de peso, grasa, masa muscular y somatocarta a través del tiempo.
            </p>
          </div>
        )}

        {/* ── 2. Comparador Visual de Fotos ── */}
        {allClientPhotos.length >= 2 && (
          <div className="bg-white rounded-3xl p-5 md:p-7 border border-[#E2E8F0] shadow-2xs">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#F0F4FA]">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#0B1929]">
                  Comparador Visual de Progreso
                </h3>
                <p className="text-xs text-[#6B7A8D]">
                  Desliza para contrastar el antes y después en el tiempo ({allClientPhotos.length} fotos registradas)
                </p>
              </div>
            </div>

            <BeforeAfterComparator
              photos={allClientPhotos}
              brand={brand}
              clienteNombre={cliente?.nombre}
            />
          </div>
        )}

        {/* ── 3. Desglose Detallado Plan a Plan ── */}
        {ciclos.length > 0 && (
          <div className="bg-white rounded-3xl p-5 md:p-7 border border-[#E2E8F0] shadow-2xs space-y-5">
            <div className="flex items-center justify-between gap-3 border-b border-[#F0F4FA] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0B1929]">
                    Línea de Tiempo y Evaluaciones por Plan
                  </h3>
                  <p className="text-xs text-[#6B7A8D]">
                    Detalle de los objetivos y check-ins registrados en cada etapa
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-[#6B7A8D] bg-gray-50 border border-[#E2E8F0] px-3 py-1 rounded-xl">
                {ciclos.length} Planes registrados
              </span>
            </div>

            <div className="space-y-4">
              {ciclos.map((c, cIdx) => {
                const planEvals = allLinkedMetricas.filter(
                  (m) => String(m.ciclo_id) === String(c.id)
                );
                const isCurrent = c.activo;
                const firstEval = planEvals[planEvals.length - 1]; // Más antigua de este plan
                const lastEval = planEvals[0]; // Más reciente de este plan
                const weightDelta =
                  firstEval?.peso && lastEval?.peso && firstEval.id !== lastEval.id
                    ? (Number(lastEval.peso) - Number(firstEval.peso)).toFixed(1)
                    : null;

                return (
                  <div
                    key={c.id}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                      isCurrent
                        ? "border-[var(--brand-primary)]/40 bg-blue-50/20 shadow-xs"
                        : "border-[#E2E8F0] bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                            isCurrent
                              ? "bg-[var(--brand-primary)] text-white shadow-2xs"
                              : "bg-gray-100 text-[#6B7A8D]"
                          }`}
                        >
                          {isCurrent ? "Plan Activo" : `Plan #${ciclos.length - cIdx}`}
                        </span>
                        <h4 className="text-sm sm:text-base font-bold text-[#0B1929]">
                          {c.nombre?.split("|")[0]}
                        </h4>
                        {c.created_at && (
                          <span className="text-xs text-[#6B7A8D] flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#94A3B8]" />
                            {fmtDate(c.created_at)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 text-xs">
                        <span className="text-[#6B7A8D] font-medium">
                          {planEvals.length} evaluación{planEvals.length !== 1 ? "es" : ""}
                        </span>
                        {weightDelta !== null && (
                          <span
                            className={`font-bold px-2.5 py-0.5 rounded-md ${
                              Number(weightDelta) < 0
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-blue-50 text-[var(--brand-primary)] border border-blue-200"
                            }`}
                          >
                            Δ {Number(weightDelta) > 0 ? `+${weightDelta}` : weightDelta} kg
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Lista de Evaluaciones de este Plan */}
                    {planEvals.length === 0 ? (
                      <div className="text-xs text-[#94A3B8] italic py-3 bg-white/60 rounded-xl px-4 border border-dashed border-[#E2E8F0]">
                        Sin evaluaciones corporales registradas durante este plan.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-[#F0F4FA]">
                        {planEvals.map((ev) => (
                          <div
                            key={ev.id}
                            className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col justify-between gap-2.5 hover:shadow-xs transition-shadow"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                                {fmtDate(ev.fecha)}
                              </span>
                              <div className="flex items-center gap-1 flex-wrap">
                                {ev.eval_objetivo && (() => {
                                  const g = getGoalPresetInfo(ev.eval_objetivo);
                                  return g ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                                      <Target className="w-2.5 h-2.5" /> {g.title}
                                    </span>
                                  ) : null;
                                })()}
                                {ev.metodo_evaluacion && (
                                  <span className="text-[10px] font-bold text-[#6B7A8D] bg-gray-50 border border-[#E2E8F0] px-2 py-0.5 rounded-md">
                                    {getMetodoLabel(ev.metodo_evaluacion)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center py-1.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]/60">
                              <div>
                                <span className="text-[10px] text-[#6B7A8D] block">Peso</span>
                                <span className="text-xs font-bold text-[#0B1929]">
                                  {ev.peso ? `${ev.peso} kg` : "—"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-[#6B7A8D] block">Grasa</span>
                                <span className="text-xs font-bold text-[#0B1929]">
                                  {ev.grasa_pct ? `${ev.grasa_pct}%` : "—"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-[#6B7A8D] block">M. Magra</span>
                                <span className="text-xs font-bold text-emerald-700">
                                  {ev.masa_libre_grasa ? `${ev.masa_libre_grasa} kg` : "—"}
                                </span>
                              </div>
                            </div>

                            {/* Check-in de Sensaciones */}
                            {Boolean(
                              ev.checkin_energia ||
                                ev.checkin_saciedad ||
                                ev.checkin_observaciones
                            ) && (
                              <div className="text-[11px] text-[#6B7A8D] bg-blue-50/50 rounded-lg p-2 border border-blue-100/60 space-y-1">
                                <div className="flex items-center justify-between font-bold text-[#0B1929]">
                                  <span>Check-in consulta</span>
                                  <span className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1">
                                      <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                                      {ev.checkin_energia || 4}/5
                                    </span>
                                    <span className="text-[#94A3B8]">•</span>
                                    <span className="inline-flex items-center gap-1">
                                      <Utensils className="w-3 h-3 text-emerald-600" />
                                      {ev.checkin_saciedad || 4}/5
                                    </span>
                                  </span>
                                </div>
                                {ev.checkin_observaciones && (
                                  <p className="text-[11px] text-[#0B1929] line-clamp-2">
                                    "{ev.checkin_observaciones}"
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-1 border-t border-[#F0F4FA] text-xs">
                              {parseFotos(ev.fotos).length > 0 ? (
                                <span className="text-[11px] text-[#6B7A8D] flex items-center gap-1">
                                  <Camera className="w-3 h-3 text-[var(--brand-primary)]" />
                                  {parseFotos(ev.fotos).length} fotos
                                </span>
                              ) : (
                                <span />
                              )}
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEval(ev)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                  title="Eliminar esta evaluación"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedEval(ev)}
                                  className="text-[var(--brand-primary)] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer py-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Consultar</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Evaluaciones Huérfanas / Sin Plan Asignado */}
              {unlinkedEvals.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/20 p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                        Sin Plan Asignado
                      </span>
                      <h4 className="text-sm sm:text-base font-bold text-[#0B1929]">
                        Evaluaciones Previas o Huérfanas
                      </h4>
                    </div>
                    <span className="text-xs text-[#6B7A8D] font-medium">
                      {unlinkedEvals.length} evaluación{unlinkedEvals.length !== 1 ? "es" : ""}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-amber-200/60">
                    {unlinkedEvals.map((ev) => (
                      <div
                        key={ev.id}
                        className="bg-white border border-amber-200/80 rounded-xl p-3.5 flex flex-col justify-between gap-2.5 hover:shadow-xs transition-shadow"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-amber-600" />
                            {fmtDate(ev.fecha)}
                          </span>
                          {ev.metodo_evaluacion && (
                            <span className="text-[10px] font-bold text-[#6B7A8D] bg-gray-50 border border-[#E2E8F0] px-2 py-0.5 rounded-md">
                              {getMetodoLabel(ev.metodo_evaluacion)}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center py-1.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]/60">
                          <div>
                            <span className="text-[10px] text-[#6B7A8D] block">Peso</span>
                            <span className="text-xs font-bold text-[#0B1929]">
                              {ev.peso ? `${ev.peso} kg` : "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#6B7A8D] block">Grasa</span>
                            <span className="text-xs font-bold text-[#0B1929]">
                              {ev.grasa_pct ? `${ev.grasa_pct}%` : "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#6B7A8D] block">M. Magra</span>
                            <span className="text-xs font-bold text-emerald-700">
                              {ev.masa_libre_grasa ? `${ev.masa_libre_grasa} kg` : "—"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-[#F0F4FA] text-xs">
                          {parseFotos(ev.fotos).length > 0 ? (
                            <span className="text-[11px] text-[#6B7A8D] flex items-center gap-1">
                              <Camera className="w-3 h-3 text-amber-600" />
                              {parseFotos(ev.fotos).length} fotos
                            </span>
                          ) : (
                            <span />
                          )}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDeleteEval(ev)}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Eliminar esta evaluación"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedEval(ev)}
                              className="text-[var(--brand-primary)] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer py-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Consultar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* ── Modal de Detalle de Evaluación Consultada ── */}
      {selectedEval && (
        <div
          onClick={() => setSelectedEval(null)}
          className="fixed inset-0 z-[120] bg-[#0B1929]/50 backdrop-blur-sm flex justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-xl my-auto flex flex-col shadow-2xl border border-[#E2E8F0] overflow-hidden max-h-[88vh]"
          >
            {/* Header del detalle */}
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-3 bg-white shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-[#0B1929] truncate">
                    Evaluación del {fmtDate(selectedEval.fecha)}
                  </h3>
                  <div className="flex items-center gap-1.5 flex-wrap text-xs text-[#6B7A8D] mt-0.5">
                    <span className="text-[11px] font-medium text-[#6B7A8D]">
                      {getMetodoLabel(selectedEval.metodo_evaluacion)}
                    </span>
                    {selectedEval.eval_objetivo && (() => {
                      const g = getGoalPresetInfo(selectedEval.eval_objetivo);
                      return g ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                          <Target className="w-2.5 h-2.5" /> {g.title} ({g.pct > 0 ? `+${g.pct}%` : `${g.pct}%`})
                        </span>
                      ) : null;
                    })()}
                    {selectedEval.eval_faf && (() => {
                      const f = getActivityFactorInfo(selectedEval.eval_faf);
                      return f ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                          <Flame className="w-2.5 h-2.5" /> FAF {f.value}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEval(null)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-[#6B7A8D] hover:text-[#0B1929] transition-colors cursor-pointer shrink-0"
                title="Cerrar (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body del detalle */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {/* Prescripción Nutricional / Dictamen IA si existe */}
              {Boolean(
                selectedEval.prescribed_macros?.targetKcal ||
                  selectedEval.ai_audit_result?.targetKcal ||
                  selectedEval.manual_macros?.targetKcal
              ) && (() => {
                const pm =
                  selectedEval.prescribed_macros ||
                  selectedEval.ai_audit_result ||
                  selectedEval.manual_macros ||
                  {};
                const kcal = pm.targetKcal;
                const p = pm.proteinG;
                const c = pm.carbsG;
                const g = pm.fatsG;
                const mode =
                  selectedEval.prescription_mode ||
                  (selectedEval.ai_audit_result ? "ia" : "matematico");
                const modeLabel =
                  pm.modeLabel ||
                  (mode === "ia"
                    ? "Auditado con IA"
                    : mode === "manual"
                    ? "Manual"
                    : "Matemático");
                return (
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Meta Prescrita ({modeLabel})
                      </span>
                      <span className="text-xs font-black text-indigo-900 font-['Rajdhani']">
                        {kcal} kcal
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-white rounded-xl p-2 border border-indigo-100/80">
                        <span className="text-[10px] text-[#6B7A8D] block">Kcal</span>
                        <span className="text-xs font-bold text-[#0B1929]">{kcal}</span>
                      </div>
                      <div className="bg-white rounded-xl p-2 border border-indigo-100/80">
                        <span className="text-[10px] text-[#6B7A8D] block">Proteína</span>
                        <span className="text-xs font-bold text-blue-600">{p ? `${p}g` : "—"}</span>
                      </div>
                      <div className="bg-white rounded-xl p-2 border border-indigo-100/80">
                        <span className="text-[10px] text-[#6B7A8D] block">Carbos</span>
                        <span className="text-xs font-bold text-emerald-600">{c ? `${c}g` : "—"}</span>
                      </div>
                      <div className="bg-white rounded-xl p-2 border border-indigo-100/80">
                        <span className="text-[10px] text-[#6B7A8D] block">Grasas</span>
                        <span className="text-xs font-bold text-amber-600">{g ? `${g}g` : "—"}</span>
                      </div>
                    </div>
                    {pm.analisisClinico && (
                      <p className="text-[11px] text-[#0B1929] bg-white rounded-xl p-2.5 border border-indigo-100/80 leading-relaxed">
                        <strong className="text-indigo-700">Dictamen:</strong> {pm.analisisClinico}
                      </p>
                    )}
                    {pm.estrategiaMenu && (
                      <p className="text-[11px] text-[#0B1929] bg-white rounded-xl p-2.5 border border-indigo-100/80 leading-relaxed">
                        <strong className="text-indigo-700">Estrategia sugerida:</strong> {pm.estrategiaMenu}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Check-in */}
              {Boolean(
                selectedEval.checkin_energia ||
                  selectedEval.checkin_saciedad ||
                  selectedEval.checkin_observaciones ||
                  selectedEval.checkin_ajustes
              ) && (
                <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4 space-y-2.5">
                  <span className="text-xs font-bold text-[var(--brand-primary)] uppercase tracking-wider block">
                    Check-in y Adherencia de la Semana
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-white rounded-xl p-2.5 border border-blue-100 text-center flex flex-col items-center justify-center">
                      <span className="text-[10px] text-[#6B7A8D] flex items-center gap-1 mb-1 font-medium">
                        <Zap className="w-3 h-3 text-amber-500 fill-amber-500" /> Energía
                      </span>
                      <span className="text-sm font-bold text-[#0B1929]">
                        {selectedEval.checkin_energia || 4}/5
                      </span>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 border border-blue-100 text-center flex flex-col items-center justify-center">
                      <span className="text-[10px] text-[#6B7A8D] flex items-center gap-1 mb-1 font-medium">
                        <Utensils className="w-3 h-3 text-emerald-600" /> Saciedad
                      </span>
                      <span className="text-sm font-bold text-[#0B1929]">
                        {selectedEval.checkin_saciedad || 4}/5
                      </span>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 border border-blue-100 text-center flex flex-col items-center justify-center">
                      <span className="text-[10px] text-[#6B7A8D] flex items-center gap-1 mb-1 font-medium">
                        <Stethoscope className="w-3 h-3 text-purple-600" /> Digestión
                      </span>
                      <span className="text-sm font-bold text-[#0B1929]">
                        {selectedEval.checkin_digestion || 4}/5
                      </span>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 border border-blue-100 text-center flex flex-col items-center justify-center">
                      <span className="text-[10px] text-[#6B7A8D] flex items-center gap-1 mb-1 font-medium">
                        <Moon className="w-3 h-3 text-indigo-500" /> Descanso
                      </span>
                      <span className="text-sm font-bold text-[#0B1929]">
                        {selectedEval.checkin_descanso || 4}/5
                      </span>
                    </div>
                  </div>
                  {selectedEval.checkin_observaciones && (
                    <p className="text-xs text-[#0B1929] bg-white rounded-xl p-3 border border-blue-100">
                      <strong className="text-[#6B7A8D]">Sensaciones:</strong>{" "}
                      {selectedEval.checkin_observaciones}
                    </p>
                  )}
                  {selectedEval.checkin_ajustes && (
                    <p className="text-xs text-[var(--brand-primary)] bg-white rounded-xl p-3 border border-blue-100 font-medium">
                      <strong className="text-[#6B7A8D]">Ajustes de menú solicitados:</strong>{" "}
                      {selectedEval.checkin_ajustes}
                    </p>
                  )}
                </div>
              )}

              {/* Medidas Antropométricas Principales */}
              <div className="bg-gray-50 border border-[#E2E8F0] rounded-2xl p-4">
                <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider block mb-3">
                  Composición Antropométrica
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center">
                  {selectedEval.peso && (
                    <div className="bg-white rounded-xl p-2.5 border border-[#E2E8F0]">
                      <span className="text-[10px] text-[#6B7A8D] block">Peso</span>
                      <span className="text-base font-bold text-[#0B1929] font-['Rajdhani']">
                        {selectedEval.peso} kg
                      </span>
                    </div>
                  )}
                  {selectedEval.grasa_pct && (
                    <div className="bg-white rounded-xl p-2.5 border border-[#E2E8F0]">
                      <span className="text-[10px] text-[#6B7A8D] block">% Grasa</span>
                      <span className="text-base font-bold text-[#0B1929] font-['Rajdhani']">
                        {selectedEval.grasa_pct}%
                      </span>
                    </div>
                  )}
                  {selectedEval.masa_libre_grasa && (
                    <div className="bg-white rounded-xl p-2.5 border border-[#E2E8F0]">
                      <span className="text-[10px] text-emerald-700 block">Masa Magra</span>
                      <span className="text-base font-bold text-emerald-700 font-['Rajdhani']">
                        {selectedEval.masa_libre_grasa} kg
                      </span>
                    </div>
                  )}
                  {selectedEval.imc && (
                    <div className="bg-white rounded-xl p-2.5 border border-[#E2E8F0]">
                      <span className="text-[10px] text-[#6B7A8D] block">IMC</span>
                      <span className="text-base font-bold text-[#0B1929] font-['Rajdhani']">
                        {selectedEval.imc}
                      </span>
                    </div>
                  )}
                  {selectedEval.cintura && (
                    <div className="bg-white rounded-xl p-2.5 border border-[#E2E8F0]">
                      <span className="text-[10px] text-[#6B7A8D] block">Cintura</span>
                      <span className="text-base font-bold text-[#0B1929] font-['Rajdhani']">
                        {selectedEval.cintura} cm
                      </span>
                    </div>
                  )}
                  {selectedEval.cadera && (
                    <div className="bg-white rounded-xl p-2.5 border border-[#E2E8F0]">
                      <span className="text-[10px] text-[#6B7A8D] block">Cadera</span>
                      <span className="text-base font-bold text-[#0B1929] font-['Rajdhani']">
                        {selectedEval.cadera} cm
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notas del especialista */}
              {selectedEval.notas && (
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
                  <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider block mb-1.5">
                    Notas u Observaciones
                  </span>
                  <p className="text-xs text-[#0B1929] leading-relaxed whitespace-pre-wrap">
                    {selectedEval.notas}
                  </p>
                </div>
              )}

              {/* Fotografías */}
              {parseFotos(selectedEval.fotos).length > 0 && (
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
                  <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider block mb-2.5 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-[var(--brand-primary)]" />
                    Fotografías ({parseFotos(selectedEval.fotos).length})
                  </span>
                  <div className="flex gap-2.5 flex-wrap">
                    {parseFotos(selectedEval.fotos).map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt="Foto progreso"
                        onClick={() => setLightboxUrl(url)}
                        className="w-20 h-20 object-cover rounded-xl border border-[#E2E8F0] cursor-zoom-in hover:opacity-90 transition-opacity"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer del detalle */}
            <div className="px-5 py-3 border-t border-[#E2E8F0] flex items-center justify-between bg-gray-50 shrink-0">
              <button
                type="button"
                onClick={() => handleDeleteEval(selectedEval)}
                className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar evaluación</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedEval(null)}
                className="px-4 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-bold text-[#0B1929] hover:bg-gray-100 transition-colors cursor-pointer shadow-2xs"
              >
                Cerrar consulta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox para fotos */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-[150] bg-black/90 flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-150"
        >
          <img
            src={lightboxUrl}
            alt="Foto en grande"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl"
          />
        </div>
      )}

      {/* Modal de confirmación para eliminar evaluación */}
      <ConfirmModal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDelete?.onConfirm}
        title={confirmDelete?.title}
        description={confirmDelete?.description}
        confirmText={confirmDelete?.confirmText || "Eliminar"}
        cancelText={confirmDelete?.cancelText || "Cancelar"}
        danger={confirmDelete?.danger ?? true}
        icon={confirmDelete?.icon || "trash"}
      />
    </div>
  );
}
