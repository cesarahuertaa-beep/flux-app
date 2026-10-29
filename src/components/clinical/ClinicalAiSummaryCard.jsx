import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  ChevronDown,
  ShieldAlert,
  Check,
  AlertTriangle,
  Pill,
  HeartPulse,
  Briefcase,
  Activity,
} from "lucide-react";
import {
  extractClinicalHighlights,
  generateClinicalAiSynopsis
} from "../../lib/clinicalAi";
import { saveClinicalRecord } from "../../lib/clinicalRecord";

export default function ClinicalAiSummaryCard({
  cliente,
  clinicalRec,
  onRecordUpdated,
}) {
  const anamnesis = clinicalRec?.anamnesis || {};
  // Por defecto colapsado según requerimiento del usuario
  const [collapsed, setCollapsed] = useState(true);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiSynopsis, setAiSynopsis] = useState(() => {
    return anamnesis?.resumen_ia?.texto || null;
  });

  const highlights = useMemo(() => {
    return extractClinicalHighlights(anamnesis, cliente);
  }, [anamnesis, cliente]);

  // Si no hay diagnóstico guardado o era la versión con campos antiguos, enriquecer automáticamente con IA
  useEffect(() => {
    const existing = anamnesis?.resumen_ia?.texto;
    const esTextoAntiguoConFallas =
      existing &&
      (existing.includes("(Norml)") ||
        existing.includes("Desde la perspectiva de prescripción") ||
        existing.includes("Dabetes") ||
        existing.includes("sintomatología GI") ||
        existing.includes("y hidratación") ||
        existing.includes("8 de descanso") ||
        existing.includes("alergia confirmada") ||
        existing.includes("comidas predilectas") ||
        existing.includes("alimentos que le desagraden"));

    if (existing && !esTextoAntiguoConFallas) {
      setAiSynopsis(existing);
    } else {
      // Mostrar primero la síntesis limpia local y luego actualizar con IA
      setAiSynopsis(highlights.sintesisTexto);
      if (cliente?.id && !loadingAi) {
        setLoadingAi(true);
        generateClinicalAiSynopsis(anamnesis, cliente)
          .then((res) => {
            if (res?.texto) {
              setAiSynopsis(res.texto);
              const updatedAnamnesis = {
                ...anamnesis,
                resumen_ia: {
                  texto: res.texto,
                  origen: res.origen,
                  generado_en: res.generadoEn,
                },
              };
              const nextRec = {
                ...clinicalRec,
                anamnesis: updatedAnamnesis,
              };
              saveClinicalRecord(cliente.id, nextRec).then((saved) => {
                if (onRecordUpdated) onRecordUpdated(saved);
              });
            }
          })
          .catch(() => {})
          .finally(() => setLoadingAi(false));
      }
    }
  }, [cliente?.id, anamnesis?.resumen_ia?.texto]);

  const hayAlertasMedicas =
    highlights.patologias.presente ||
    highlights.alergias.presente;

  return (
    <div className="mb-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-white rounded-2xl border border-blue-200/80 shadow-sm overflow-hidden transition-all duration-200">
      
      {/* ── Barra Superior (Encabezado Limpio y Colapsable) ── */}
      <div
        onClick={() => setCollapsed((p) => !p)}
        className="p-3.5 sm:px-5 sm:py-3 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-blue-50/50 transition-colors"
      >
        {/* Left: Icono y Título */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-[var(--brand-primary)] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h3 className="text-sm font-bold text-[#0B1929] tracking-tight">
              Resumen Clínico Inteligente
            </h3>
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100/80 text-[var(--brand-primary)] border border-blue-200">
              IA FLUX
            </span>
          </div>
        </div>

        {/* Right: Flecha para extender / colapsar */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-[#6B7A8D] hidden sm:inline">
            {collapsed ? "Ver diagnóstico y antecedentes" : "Ocultar"}
          </span>
          <button
            type="button"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#6B7A8D] hover:text-[#0B1929] bg-white shadow-2xs border border-[#E2E8F0] transition-transform"
            title={collapsed ? "Extender análisis clínico" : "Colapsar"}
          >
            <ChevronDown
              className={`w-4 h-4 text-[#0B1929] transition-transform duration-200 ${
                collapsed ? "" : "rotate-180"
              }`}
            />
          </button>
        </div>
      </div>

      {/* ── Contenido Expandido ── */}
      {!collapsed && (
        <div className="p-4 sm:p-5 pt-1 space-y-3.5 border-t border-blue-100/60 animate-in fade-in duration-150">
          
          {/* Fila 1: Las 4 Tarjetas de Puntos Clave del Expediente */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Card 1: Diagnósticos y Alergias Médicas */}
            <div className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
              hayAlertasMedicas
                ? "bg-red-50/40 border-red-200/80"
                : "bg-emerald-50/30 border-emerald-200/60"
            }`}>
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-wider">
                  {hayAlertasMedicas ? (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      <span className="text-red-900">Alertas & Diagnósticos</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-emerald-900">Salud & Alertas</span>
                    </>
                  )}
                </div>

                {hayAlertasMedicas ? (
                  <div className="space-y-2">
                    {/* Alergias / Intolerancias */}
                    {highlights.alergias.presente && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-0.5">
                          Alergias / Intolerancias:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {highlights.alergias.tags.length > 0 ? (
                            highlights.alergias.tags.map((t, i) => (
                              <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                                <span>{t}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-[#0B1929]">{highlights.alergias.raw}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Patologías */}
                    {highlights.patologias.presente && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-red-800 block mb-0.5">
                          Patologías / Condiciones:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {highlights.patologias.tags.length > 0 ? (
                            highlights.patologias.tags.map((t, i) => (
                              <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-900 border border-red-200">
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-[#0B1929]">{highlights.patologias.raw}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                    Sin patologías crónicas ni alergias reportadas en el expediente.
                  </p>
                )}
              </div>
              <span className="text-[10px] text-red-700/80 mt-2 block font-medium">
                Condición clínica basal
              </span>
            </div>

            {/* Card 2: Medicación y Suplementación */}
            <div className="p-3.5 rounded-xl border bg-indigo-50/40 border-indigo-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-wider text-indigo-900">
                  <Pill className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Medicación & Suplementos</span>
                </div>

                {highlights.medicacion.presente ? (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 block">
                      Tratamiento actual:
                    </span>
                    <p className="text-xs text-[#0B1929] font-medium leading-snug">
                      {highlights.medicacion.raw}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[#6B7A8D] italic">
                    No reporta medicación ni suplementación actual.
                  </p>
                )}
              </div>
              <span className="text-[10px] text-indigo-700/80 mt-2 block font-medium">
                Vigilancia fármaco-nutriente
              </span>
            </div>

            {/* Card 3: Antecedentes Heredofamiliares */}
            <div className="p-3.5 rounded-xl border bg-purple-50/40 border-purple-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-wider text-purple-900">
                  <HeartPulse className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>Riesgo Heredofamiliar</span>
                </div>

                {highlights.heredo?.presente ? (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 block">
                      Antecedentes en la familia:
                    </span>
                    <p className="text-xs text-[#0B1929] font-medium leading-snug">
                      {highlights.heredo.raw}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[#6B7A8D] italic">
                    Sin antecedentes familiares de riesgo reportados.
                  </p>
                )}
              </div>
              <span className="text-[10px] text-purple-700/80 mt-2 block font-medium">
                Prevención metabólica y cardiovascular
              </span>
            </div>

            {/* Card 4: Contexto Ocupacional, Cirugías & Salud GI */}
            <div className="p-3.5 rounded-xl border bg-blue-50/40 border-blue-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-wider text-blue-900">
                  <Briefcase className="w-3.5 h-3.5 text-[var(--brand-primary)] shrink-0" />
                  <span>Contexto & Cirugías</span>
                </div>

                <div className="space-y-1 text-xs">
                  {highlights.lesiones.presente && (
                    <div className="truncate">
                      <strong className="text-[#0B1929]">Cirugías/Lesiones:</strong>{" "}
                      <span className="text-[#6B7A8D]">{highlights.lesiones.raw}</span>
                    </div>
                  )}
                  {highlights.habitos.ocupacion && (
                    <div className="truncate">
                      <strong className="text-[#0B1929]">Ocupación:</strong>{" "}
                      <span className="text-[#6B7A8D]">{highlights.habitos.ocupacion}</span>
                    </div>
                  )}
                  <div>
                    <strong className="text-[#0B1929]">Función digestiva:</strong>{" "}
                    <span className="text-[#6B7A8D]">
                      {highlights.digestivo.isNormal ? "Digestión conservada" : highlights.digestivo.raw}
                    </span>
                  </div>
                  {highlights.habitos.alcoholTabaco && (
                    <div className="truncate text-amber-800">
                      <strong>Alcohol/Tabaco:</strong> {highlights.habitos.alcoholTabaco}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-blue-700/80 mt-2 block font-medium">
                Adaptación biomecánica y de rutina
              </span>
            </div>

          </div>

          {/* Fila 2: Diagnóstico Basado en el Expediente (Potenciado por IA) */}
          <div className="bg-white rounded-xl border border-blue-200/70 p-3.5 sm:p-4 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 border border-indigo-200">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider flex items-center gap-1.5">
                    Diagnóstico Basado en el Expediente
                  </span>
                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    {loadingAi ? "Analizando con IA..." : "Análisis IA"}
                  </span>
                </div>
                <p className="text-xs text-[#0B1929] leading-relaxed font-normal">
                  {aiSynopsis || highlights.sintesisTexto || "Sin antecedentes registrados en el expediente."}
                </p>
                {highlights.notasConsulta && (
                  <div className="mt-2 pt-2 border-t border-[#F0F4FA] text-xs text-[#6B7A8D]">
                    <strong className="text-[#0B1929]">Notas de consulta:</strong> {highlights.notasConsulta}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
