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
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  extractClinicalHighlights,
  generateClinicalAiSynopsis,
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
  const [aiError, setAiError] = useState(null);

  const [aiData, setAiData] = useState(() => {
    const raw = anamnesis?.resumen_ia;
    if (!raw) return null;
    if (typeof raw === "object") return raw;
    return { texto: raw, diagnostico: raw };
  });

  const highlights = useMemo(() => {
    return extractClinicalHighlights(anamnesis, cliente);
  }, [anamnesis, cliente]);

  useEffect(() => {
    const raw = anamnesis?.resumen_ia;
    if (raw) {
      if (typeof raw === "object") {
        setAiData(raw);
      } else {
        setAiData({ texto: raw, diagnostico: raw });
      }
    }
  }, [anamnesis?.resumen_ia]);

  const handleRunAiAudit = async (e) => {
    if (e) e.stopPropagation();
    if (!cliente?.id || loadingAi) return;
    setLoadingAi(true);
    setAiError(null);
    try {
      const res = await generateClinicalAiSynopsis(anamnesis, cliente);
      if (res?.diagnostico || res?.texto) {
        const newAiData = {
          texto: res.diagnostico || res.texto,
          diagnostico: res.diagnostico || res.texto,
          alertas: res.alertas,
          medicacion_normalizada: res.medicacion_normalizada,
          heredo_normalizado: res.heredo_normalizado,
          contexto_normalizado: res.contexto_normalizado,
          directrices_nutricionales: res.directrices_nutricionales || [],
          origen: res.origen,
          model: res.model,
          generado_en: res.generadoEn || new Date().toISOString(),
        };
        setAiData(newAiData);
        const updatedAnamnesis = {
          ...anamnesis,
          resumen_ia: newAiData,
        };
        const nextRec = {
          ...clinicalRec,
          anamnesis: updatedAnamnesis,
        };
        const saved = await saveClinicalRecord(cliente.id, nextRec);
        if (onRecordUpdated) onRecordUpdated(saved);
        setCollapsed(false); // auto-expand to show new results
      }
    } catch (err) {
      console.error("Error auditando expediente con IA:", err);
      setAiError(err.message || "Error al conectar con Google Gemini");
    } finally {
      setLoadingAi(false);
    }
  };

  const hayAlertasMedicas =
    highlights.patologias.presente ||
    highlights.alergias.presente ||
    (aiData?.alertas?.patologias_normalizadas && aiData.alertas.patologias_normalizadas.length > 0) ||
    (aiData?.alertas?.exclusiones_alimentarias && aiData.alertas.exclusiones_alimentarias.length > 0);

  const isGeminiOrigin =
    aiData?.origen === "gemini" ||
    aiData?.origen === "gemini_direct" ||
    aiData?.origen === "edge_function";

  const exclusionesList =
    aiData?.alertas?.exclusiones_alimentarias && aiData.alertas.exclusiones_alimentarias.length > 0
      ? aiData.alertas.exclusiones_alimentarias
      : highlights.alergias.tags.length > 0
      ? highlights.alergias.tags
      : highlights.alergias.raw
      ? [highlights.alergias.raw]
      : [];

  const patologiasList =
    aiData?.alertas?.patologias_normalizadas && aiData.alertas.patologias_normalizadas.length > 0
      ? aiData.alertas.patologias_normalizadas
      : highlights.patologias.tags.length > 0
      ? highlights.patologias.tags
      : highlights.patologias.raw
      ? [highlights.patologias.raw]
      : [];

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
            {isGeminiOrigin && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Auditado con IA</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Botón Auditar con IA + Flecha colapsar */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRunAiAudit}
            disabled={loadingAi}
            className="py-1 px-3 rounded-lg bg-gradient-to-r from-indigo-600 to-[var(--brand-primary)] text-white text-xs font-bold shadow-2xs hover:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Auditar y normalizar el expediente clínico con Google Gemini"
          >
            <Sparkles className={`w-3.5 h-3.5 ${loadingAi ? "animate-spin" : ""}`} />
            <span>{loadingAi ? "Auditando..." : isGeminiOrigin ? "Reauditar con IA" : "Auditar con IA"}</span>
          </button>

          <span className="text-xs font-semibold text-[#6B7A8D] hidden md:inline ml-1">
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

      {aiError && (
        <div className="px-5 py-2 bg-red-50 border-t border-red-200 flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{aiError}</span>
        </div>
      )}

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
                    {/* Alergias / Intolerancias / Exclusiones de Alimentos */}
                    {exclusionesList.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-0.5">
                          Exclusiones Alimentarias:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {exclusionesList.map((t, i) => (
                            <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                              <span>{t}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Patologías / Condiciones */}
                    {patologiasList.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-red-800 block mb-0.5">
                          Patologías / Condiciones:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {patologiasList.map((t, i) => (
                            <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-900 border border-red-200">
                              {t}
                            </span>
                          ))}
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
                {aiData?.alertas?.observacion_alergias || "Condición clínica basal"}
              </span>
            </div>

            {/* Card 2: Medicación y Suplementación */}
            <div className="p-3.5 rounded-xl border bg-indigo-50/40 border-indigo-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-wider text-indigo-900">
                  <Pill className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Medicación & Suplementos</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 block">
                    Tratamiento actual:
                  </span>
                  <p className="text-xs text-[#0B1929] font-medium leading-snug">
                    {aiData?.medicacion_normalizada || highlights.medicacion.raw || (
                      <span className="text-[#6B7A8D] italic font-normal">No reporta medicación ni suplementación actual.</span>
                    )}
                  </p>
                </div>
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

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 block">
                    Antecedentes en la familia:
                  </span>
                  <p className="text-xs text-[#0B1929] font-medium leading-snug">
                    {aiData?.heredo_normalizado || highlights.heredo?.raw || (
                      <span className="text-[#6B7A8D] italic font-normal">Sin antecedentes familiares de riesgo reportados.</span>
                    )}
                  </p>
                </div>
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
                  <div>
                    <strong className="text-[#0B1929]">Ocupación:</strong>{" "}
                    <span className="text-[#6B7A8D]">
                      {aiData?.contexto_normalizado?.ocupacion || highlights.habitos.ocupacion || "No especificada"}
                    </span>
                  </div>
                  <div>
                    <strong className="text-[#0B1929]">Función digestiva:</strong>{" "}
                    <span className="text-[#6B7A8D]">
                      {aiData?.contexto_normalizado?.digestion || (highlights.digestivo.isNormal ? "Digestión conservada" : highlights.digestivo.raw)}
                    </span>
                  </div>
                  <div>
                    <strong className="text-[#0B1929]">Alcohol/Tabaco:</strong>{" "}
                    <span className="text-[#6B7A8D]">
                      {aiData?.contexto_normalizado?.alcohol_tabaco || highlights.habitos.alcoholTabaco || "No reportado"}
                    </span>
                  </div>
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
                <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                  <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider flex items-center gap-1.5">
                    Diagnóstico Basado en el Expediente
                  </span>
                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    {loadingAi
                      ? "Analizando con IA..."
                      : isGeminiOrigin
                      ? `Auditado IA · ${aiData?.model || "Gemini"}`
                      : "Análisis IA"}
                  </span>
                </div>
                
                <p className="text-xs text-[#0B1929] leading-relaxed font-normal">
                  {aiData?.diagnostico || aiData?.texto || highlights.sintesisTexto || "Sin antecedentes registrados en el expediente."}
                </p>

                {/* Directrices Nutricionales para la Programación */}
                {Array.isArray(aiData?.directrices_nutricionales) && aiData.directrices_nutricionales.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-indigo-100/70">
                    <span className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Directrices Nutricionales para la Programación:</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {aiData.directrices_nutricionales.map((dir, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 p-2 rounded-lg bg-indigo-50/50 border border-indigo-100 text-xs text-[#0B1929]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                          <span className="leading-snug">{dir}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
