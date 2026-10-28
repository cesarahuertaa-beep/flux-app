import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  ClipboardList,
  AlertTriangle,
  Heart,
  Ban,
  Clock,
  ChevronDown,
  Copy,
  Check,
  RotateCcw,
  Utensils,
  ShieldAlert,
  Activity,
  HeartPulse,
  Send
} from "lucide-react";
import {
  extractClinicalHighlights,
  generateClinicalAiSynopsis
} from "../../lib/clinicalAi";
import { saveClinicalRecord } from "../../lib/clinicalRecord";

export default function ClinicalAiSummaryCard({
  cliente,
  clinicalRec,
  onOpenExpediente,
  onRecordUpdated,
}) {
  const anamnesis = clinicalRec?.anamnesis || {};
  const [collapsed, setCollapsed] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiSynopsis, setAiSynopsis] = useState(() => {
    return anamnesis?.resumen_ia?.texto || null;
  });

  const highlights = useMemo(() => {
    return extractClinicalHighlights(anamnesis, cliente);
  }, [anamnesis, cliente]);

  // Si no hay resumen IA guardado, inicializar con la síntesis estructurada
  useEffect(() => {
    if (anamnesis?.resumen_ia?.texto) {
      setAiSynopsis(anamnesis.resumen_ia.texto);
    } else if (highlights.sintesisTexto) {
      setAiSynopsis(highlights.sintesisTexto);
    }
  }, [anamnesis?.resumen_ia?.texto, highlights.sintesisTexto]);

  const handleCopiar = () => {
    const textoACopiar = aiSynopsis || highlights.sintesisTexto;
    if (!textoACopiar) return;
    navigator.clipboard?.writeText(textoACopiar).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRegenerar = async () => {
    if (!cliente?.id || loadingAi) return;
    setLoadingAi(true);
    try {
      const res = await generateClinicalAiSynopsis(anamnesis, cliente);
      setAiSynopsis(res.texto);

      // Guardar el resumen en el registro clínico
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

      const saved = await saveClinicalRecord(cliente.id, nextRec);
      if (onRecordUpdated) onRecordUpdated(saved);
    } finally {
      setLoadingAi(false);
    }
  };

  const hayAlertasMedicas =
    highlights.patologias.presente ||
    highlights.alergias.presente ||
    highlights.lesiones.presente ||
    highlights.digestivo.presente;

  return (
    <div className="mb-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-white rounded-2xl border border-blue-200/80 shadow-sm overflow-hidden transition-all duration-200">
      
      {/* ── Barra Superior (Encabezado del Resumen) ── */}
      <div className="p-4 sm:px-5 sm:py-3.5 flex items-center justify-between gap-3 border-b border-blue-100/60 flex-wrap sm:flex-nowrap">
        
        {/* Left: Icono y Título */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-[var(--brand-primary)] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-[#0B1929] tracking-tight">
                Resumen Clínico Inteligente
              </h3>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100/80 text-[var(--brand-primary)] border border-blue-200">
                IA FLUX
              </span>
              {clinicalRec?.anamnesis?.completado_por && (
                <span className="hidden md:inline-flex text-[11px] font-semibold text-[#6B7A8D] bg-white/80 px-2 py-0.5 rounded-md border border-[#E2E8F0]">
                  Llenado por: {clinicalRec.anamnesis.completado_por === "paciente" ? "Paciente" : "Nutriólogo"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#6B7A8D] truncate">
              Puntos clave para el diseño del plan sin revisar todo el expediente
            </p>
          </div>
        </div>

        {/* Right: Acciones Rápidas */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Botón: Copiar Síntesis */}
          <button
            type="button"
            onClick={handleCopiar}
            className="px-2.5 py-1.5 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-[11px] font-bold text-[#0B1929] transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
            title="Copiar resumen al portapapeles"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#6B7A8D]" />
                <span className="hidden sm:inline">Copiar</span>
              </>
            )}
          </button>

          {/* Botón: Regenerar con IA */}
          <button
            type="button"
            onClick={handleRegenerar}
            disabled={loadingAi}
            className="px-2.5 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-[11px] font-bold text-indigo-700 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
            title="Actualizar y enriquecer análisis con IA"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loadingAi ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{loadingAi ? "Analizando..." : "Actualizar"}</span>
          </button>

          {/* Botón: Ver Expediente Completo */}
          {onOpenExpediente && (
            <button
              type="button"
              onClick={onOpenExpediente}
              className="px-2.5 py-1.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-gray-50 text-[11px] font-bold text-[#0B1929] transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              title="Abrir expediente clínico completo"
            >
              <ClipboardList className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
              <span>Expediente</span>
            </button>
          )}

          {/* Botón: Colapsar / Expandir */}
          <button
            type="button"
            onClick={() => setCollapsed((p) => !p)}
            className="p-1.5 rounded-xl text-[#6B7A8D] hover:text-[#0B1929] hover:bg-white/80 transition-colors cursor-pointer"
            title={collapsed ? "Expandir resumen" : "Minimizar resumen"}
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`} />
          </button>
        </div>

      </div>

      {/* ── Contenido Expandido ── */}
      {!collapsed && (
        <div className="p-4 sm:p-5 space-y-3.5 animate-in fade-in duration-150">
          
          {/* Fila 1: Las 4 Tarjetas de Puntos Clave */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* 🔴 Card 1: Alertas Médicas & Clínicas */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              hayAlertasMedicas
                ? "bg-red-50/40 border-red-200/80"
                : "bg-emerald-50/30 border-emerald-200/60"
            }`}>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-wider">
                {hayAlertasMedicas ? (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span className="text-red-900">Alertas Médicas</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-emerald-900">Salud & Alertas</span>
                  </>
                )}
              </div>

              {hayAlertasMedicas ? (
                <div className="space-y-1.5">
                  {/* Alergias / Intolerancias */}
                  {highlights.alergias.presente && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                        Alergias / Intolerancias:
                      </span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {highlights.alergias.tags.length > 0 ? (
                          highlights.alergias.tags.map((t, i) => (
                            <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                              ⚠️ {t}
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
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-800 block">
                        Diagnósticos:
                      </span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
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

                  {/* Lesiones */}
                  {highlights.lesiones.presente && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-800 block">
                        Lesiones / Cirugías:
                      </span>
                      <span className="text-xs text-[#0B1929] font-medium block">
                        {highlights.lesiones.raw}
                      </span>
                    </div>
                  )}

                  {/* Digestión / GI */}
                  {highlights.digestivo.presente && (
                    <div className="text-[11px] text-[#6B7A8D]">
                      <strong className="text-[#0B1929]">Síntomas GI:</strong> {highlights.digestivo.raw}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                  Sin patologías, cirugías ni alergias reportadas en su cuestionario.
                </p>
              )}
            </div>

            {/* 🚫 Card 2: Alimentos que Rechaza (Aversiones) — ¡NUNCA INCLUIR! */}
            <div className="p-3.5 rounded-xl border bg-rose-50/40 border-rose-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-wider text-rose-900">
                  <Ban className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>Alimentos a Evitar</span>
                </div>

                {highlights.aversiones.presente ? (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-rose-800 font-semibold leading-tight">
                      🚫 No incluir en las opciones de comida:
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {highlights.aversiones.tags.length > 0 ? (
                        highlights.aversiones.tags.map((t, i) => (
                          <span
                            key={i}
                            className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-white text-rose-700 border border-rose-300 shadow-2xs"
                          >
                            ✕ {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[#0B1929] font-medium bg-white px-2 py-1 rounded-lg border border-rose-200">
                          {highlights.aversiones.raw}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#6B7A8D] italic">
                    El paciente no especificó alimentos que le desagraden.
                  </p>
                )}
              </div>
              <span className="text-[10px] text-rose-700/80 mt-2 block font-medium">
                Garantiza adherencia al plan
              </span>
            </div>

            {/* 💚 Card 3: Alimentos Favoritos (Preferencias) */}
            <div className="p-3.5 rounded-xl border bg-emerald-50/40 border-emerald-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-wider text-emerald-900">
                  <Heart className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600 shrink-0" />
                  <span>Favoritos del Paciente</span>
                </div>

                {highlights.preferencias.presente ? (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-emerald-800 font-semibold leading-tight">
                      💚 Priorizar como base en los menús:
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {highlights.preferencias.tags.length > 0 ? (
                        highlights.preferencias.tags.map((t, i) => (
                          <span
                            key={i}
                            className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-white text-emerald-700 border border-emerald-300 shadow-2xs"
                          >
                            ✓ {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[#0B1929] font-medium bg-white px-2 py-1 rounded-lg border border-emerald-200">
                          {highlights.preferencias.raw}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#6B7A8D] italic">
                    No registró comidas predilectas específicas.
                  </p>
                )}
              </div>
              <span className="text-[10px] text-emerald-700/80 mt-2 block font-medium">
                Facilita opciones atractivas
              </span>
            </div>

            {/* ⏱️ Card 4: Estilo de Vida & Hábitos */}
            <div className="p-3.5 rounded-xl border bg-blue-50/40 border-blue-200/80 space-y-1.5">
              <div className="flex items-center gap-1.5 mb-1.5 text-xs font-bold uppercase tracking-wider text-blue-900">
                <Clock className="w-3.5 h-3.5 text-[var(--brand-primary)] shrink-0" />
                <span>Hábitos & Rutina</span>
              </div>

              <div className="space-y-1 text-xs">
                {highlights.objetivo && (
                  <div className="truncate">
                    <strong className="text-[#0B1929]">Meta:</strong>{" "}
                    <span className="text-[var(--brand-primary)] font-semibold">{highlights.objetivo}</span>
                  </div>
                )}
                {highlights.habitos.sueno && (
                  <div>
                    <strong className="text-[#0B1929]">Sueño:</strong>{" "}
                    <span className="text-[#6B7A8D]">{highlights.habitos.sueno}</span>
                  </div>
                )}
                <div>
                  <strong className="text-[#0B1929]">Estrés:</strong>{" "}
                  <span className={`font-semibold ${
                    highlights.habitos.estresNivel >= 4 ? "text-amber-700" : "text-[#6B7A8D]"
                  }`}>
                    {highlights.habitos.estresEtiqueta} ({highlights.habitos.estresNivel}/5)
                  </span>
                </div>
                {highlights.habitos.agua && (
                  <div className="truncate">
                    <strong className="text-[#0B1929]">Agua:</strong>{" "}
                    <span className="text-[#6B7A8D]">{highlights.habitos.agua}</span>
                  </div>
                )}
                {highlights.r24h.picoteos && !/^(no|ningun|nada)/i.test(highlights.r24h.picoteos) && (
                  <div className="truncate text-amber-800">
                    <strong>Picoteo:</strong> {highlights.r24h.picoteos}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Fila 2: Síntesis Narrativa Ejecutiva de la IA */}
          <div className="bg-white rounded-xl border border-blue-200/70 p-3.5 sm:p-4 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 border border-indigo-200">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider">
                    Síntesis Clínica Ejecutiva
                  </span>
                  <span className="text-[10px] text-[#6B7A8D]">
                    {loadingAi ? "Consultando a la IA..." : "Resumen consolidado"}
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
