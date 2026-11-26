import { useState, useEffect, useMemo } from "react";
import {
  X,
  Bookmark,
  Plus,
  Check,
  Trash2,
  Utensils,
  Dumbbell,
  ArrowRight,
  ArrowLeft,
  Save,
  Search,
  Edit3,
  Copy,
  Layers,
  RefreshCw,
} from "lucide-react";
import {
  resolvePlantillasCreatorId,
  readLocalTemplates,
  fetchCloudTemplates,
  upsertUserTemplate,
  deleteUserTemplate,
  createEmptyTemplateDraft,
  generateTemplateId,
  serializeDiaForTemplate,
  serializeRutinaForTemplate,
  stripWeightsFromTemplateExercise,
  summarizeTemplate,
} from "../../lib/plantillasStore";

export default function TemplatesManagerModal({
  type = "nutri",
  currentData,
  hasExistingPlan = false,
  hasPatientMacros = false,
  patientMacros = null,
  cycleWeeks = 4,
  profileId,
  onApplyTemplate,
  onOpenTemplateBuilder,
  onClose,
  setMsg,
}) {
  const isNutri = type === "nutri";
  const creatorId = resolvePlantillasCreatorId(profileId);

  const [activeTab, setActiveTab] = useState("list"); // 'list' | 'crear' | 'guardar'
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [templates, setTemplates] = useState(() =>
    readLocalTemplates({ type, creatorId, profileId })
  );
  const [loadingCloud, setLoadingCloud] = useState(false);

  // Estado para paso de previsualización y aplicación selectiva
  const [selectedTplForApply, setSelectedTplForApply] = useState(null);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [applyMode, setApplyMode] = useState("append"); // 'append' | 'replace'
  const [applyMacrosOption, setApplyMacrosOption] = useState("keep"); // 'keep' | 'template'
  const [clearWeightsOption, setClearWeightsOption] = useState(false);

  // Estado para "+ Crear Plantilla"
  const [newTplTitle, setNewTplTitle] = useState("");
  const [newTplTags, setNewTplTags] = useState("");

  // Estado para "Guardar Actual"
  const [saveMode, setSaveMode] = useState("new"); // 'new' | 'overwrite'
  const [newTitle, setNewTitle] = useState("");
  const [newTags, setNewTags] = useState("");
  const [targetOverwriteId, setTargetOverwriteId] = useState("");
  const [stripWeightsOnSave, setStripWeightsOnSave] = useState(true);
  const [savingTpl, setSavingTpl] = useState(false);

  useEffect(() => {
    let active = true;
    const refreshFromLocal = () => {
      if (!active) return;
      setTemplates(readLocalTemplates({ type, creatorId, profileId }));
    };
    const loadCloud = async () => {
      setLoadingCloud(true);
      try {
        const merged = await fetchCloudTemplates({ type, creatorId, profileId });
        if (active && Array.isArray(merged)) {
          setTemplates(merged);
        }
      } finally {
        if (active) setLoadingCloud(false);
      }
    };
    loadCloud();
    const onUpdated = (ev) => {
      const evType = ev?.detail?.type;
      if (!evType || evType === type) {
        refreshFromLocal();
      }
    };
    window.addEventListener("flux:plantillas-updated", onUpdated);
    return () => {
      active = false;
      window.removeEventListener("flux:plantillas-updated", onUpdated);
    };
  }, [type, creatorId, profileId]);

  const userCustomTemplates = useMemo(
    () => (templates || []).filter((t) => t?.isDefault !== true && !String(t?.id || "").startsWith("base_")),
    [templates]
  );

  const effectiveOverwriteId = targetOverwriteId || userCustomTemplates[0]?.id || "";

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return templates || [];
    return (templates || []).filter((tpl) => {
      const hay = `${tpl.nombre || ""} ${tpl.tags || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [templates, searchQuery]);

  const openApplyPreview = (tpl) => {
    const items = isNutri ? tpl.dias || [] : tpl.rutinas || [];
    setSelectedTplForApply(tpl);
    setSelectedIndices(items.map((_, i) => i));
    setApplyMode("append");
    const tplKcal = Number(tpl?.macros?.calorias || 0);
    setApplyMacrosOption(hasPatientMacros || tplKcal <= 0 ? "keep" : "template");
    setClearWeightsOption(false);
  };

  const handleConfirmApply = () => {
    if (!selectedTplForApply) return;
    const opts = isNutri
      ? {
          mode: applyMode,
          selectedIndices,
          applyMacros: applyMacrosOption === "template",
        }
      : {
          mode: applyMode,
          selectedIndices,
          clearWeights: clearWeightsOption,
        };
    onApplyTemplate(selectedTplForApply, opts);
    onClose();
  };

  const handleEditTemplate = (tpl) => {
    if (!onOpenTemplateBuilder) return;
    if (tpl?.isDefault === true || String(tpl?.id || "").startsWith("base_")) {
      const duplicated = {
        ...createEmptyTemplateDraft({ type, creatorId }),
        ...tpl,
        id: generateTemplateId(type),
        nombre: `${tpl.nombre || "Plantilla"} (Personal)`,
        creatorId,
        isDefault: false,
        isCustom: true,
        updated_at: new Date().toISOString(),
      };
      upsertUserTemplate({ type, creatorId, profileId, template: duplicated });
      onOpenTemplateBuilder(duplicated);
      return;
    }
    onOpenTemplateBuilder(tpl);
  };

  const handleDeleteTemplate = async (id, e) => {
    e?.stopPropagation();
    await deleteUserTemplate({ type, creatorId, profileId, id });
    setConfirmDeleteId(null);
    setTemplates(readLocalTemplates({ type, creatorId, profileId }));
    setMsg?.(
      <div className="flex items-center gap-1.5 text-red-600">
        <Trash2 className="w-4 h-4" /> Plantilla eliminada de tu biblioteca personal
      </div>
    );
  };

  const handleCreateEmptyTemplate = async (e) => {
    e.preventDefault();
    const draft = createEmptyTemplateDraft({
      type,
      creatorId,
      nombre: newTplTitle.trim() || (isNutri ? "Nueva plantilla de nutrición" : "Nueva plantilla de entrenamiento"),
      tags: newTplTags.trim() || "Personalizada",
    });
    const nextList = await upsertUserTemplate({ type, creatorId, profileId, template: draft });
    setTemplates(nextList);
    setNewTplTitle("");
    setNewTplTags("");
    setActiveTab("list");
    onOpenTemplateBuilder?.(draft);
  };

  const handleSaveCurrentAsTemplate = async (e) => {
    e.preventDefault();
    const isOverwrite = saveMode === "overwrite" && Boolean(effectiveOverwriteId);
    if (!isOverwrite && !newTitle.trim()) return;
    setSavingTpl(true);

    const existingTarget = isOverwrite
      ? userCustomTemplates.find((t) => t.id === effectiveOverwriteId) || null
      : null;

    let newTemplate;
    if (isNutri) {
      const m = currentData?.macros || {};
      const parsedDias = (currentData?.dias || []).map((d, dIdx) => serializeDiaForTemplate(d, dIdx));
      newTemplate = {
        ...(existingTarget || {}),
        id: existingTarget?.id || generateTemplateId("nutri"),
        creatorId,
        nombre: isOverwrite ? existingTarget?.nombre || newTitle.trim() : newTitle.trim(),
        tags: isOverwrite ? (existingTarget?.tags || "Personalizada") : (newTags.trim() || "Personalizada"),
        created_at: existingTarget?.created_at || existingTarget?.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isDefault: false,
        isCustom: true,
        macros: {
          calorias: Number(m.calorias) || 0,
          proteina: Number(m.proteina) || 0,
          carbohidratos: Number(m.carbohidratos) || 0,
          grasas: Number(m.grasas) || 0,
        },
        dias: parsedDias,
      };
    } else {
      const parsedRutinas = (currentData?.rutinas || [])
        .filter((r) => (r.ejercicios || []).length > 0)
        .map((r, rIdx) => {
          const serialized = serializeRutinaForTemplate(r, rIdx, null);
          if (!stripWeightsOnSave) return serialized;
          return {
            ...serialized,
            ejercicios: (serialized.ejercicios || []).map((ex) => stripWeightsFromTemplateExercise(ex)),
          };
        });
      newTemplate = {
        ...(existingTarget || {}),
        id: existingTarget?.id || generateTemplateId("rutina"),
        creatorId,
        nombre: isOverwrite ? existingTarget?.nombre || newTitle.trim() : newTitle.trim(),
        tags: isOverwrite ? (existingTarget?.tags || "Personalizada") : (newTags.trim() || "Personalizada"),
        created_at: existingTarget?.created_at || existingTarget?.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isDefault: false,
        isCustom: true,
        rutinas: parsedRutinas,
      };
    }

    const updatedList = await upsertUserTemplate({
      type,
      creatorId,
      profileId,
      template: newTemplate,
    });
    setTemplates(updatedList);
    setSavingTpl(false);
    setNewTitle("");
    setNewTags("");
    setActiveTab("list");
    setMsg?.(
      <div className="flex items-center gap-1.5 text-emerald-600">
        <Check className="w-4 h-4" />{" "}
        {isOverwrite
          ? `Plantilla "${newTemplate.nombre}" actualizada en tu recetario`
          : `Plantilla "${newTemplate.nombre}" guardada en tu biblioteca personal`}
      </div>
    );
  };

  const canSaveCurrent = isNutri
    ? Boolean(currentData?.dias?.length > 0 || Number(currentData?.macros?.calorias) > 0)
    : Boolean((currentData?.rutinas || []).some((r) => (r.ejercicios || []).length > 0));

  return (
    <div className="fixed inset-0 z-[110] bg-[#0B1929]/50 backdrop-blur-sm flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-none md:rounded-2xl w-full md:max-w-2xl h-full max-h-full md:h-auto md:max-h-[88vh] shadow-2xl border-0 md:border md:border-[#E2E8F0] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex items-center justify-between gap-3 bg-white modal-safe-header">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
              {isNutri ? <Utensils className="w-5 h-5" /> : <Dumbbell className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-[#0B1929] truncate">
                Plantillas Maestro
              </h3>
              <p className="text-xs text-[#6B7A8D] truncate">
                {isNutri
                  ? "Menús y macros personales listos para aplicar o editar"
                  : "Rutinas personales independientes de cada paciente"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#6B7A8D] hover:text-[#0B1929] hover:bg-gray-100 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs (hidden when inside apply preview) */}
        {!selectedTplForApply && (
          <div className="flex border-b border-[#E2E8F0] px-4 sm:px-5 gap-4 sm:gap-6 bg-[#F8FAFC]/50 overflow-x-auto scroll-hide">
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className={`py-3 px-0.5 text-xs sm:text-[13px] font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30 rounded-t-md cursor-pointer ${
                activeTab === "list"
                  ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                  : "border-transparent text-[#6B7A8D] hover:text-[#0B1929]"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5 shrink-0" />
              <span>Plantillas ({templates.length})</span>
            </button>
            {onOpenTemplateBuilder && (
              <button
                type="button"
                onClick={() => setActiveTab("crear")}
                className={`py-3 px-0.5 text-xs sm:text-[13px] font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30 rounded-t-md cursor-pointer ${
                  activeTab === "crear"
                    ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                    : "border-transparent text-[#6B7A8D] hover:text-[#0B1929]"
                }`}
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Crear Plantilla</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("guardar")}
              className={`py-3 px-0.5 text-xs sm:text-[13px] font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30 rounded-t-md cursor-pointer ${
                activeTab === "guardar"
                  ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                  : "border-transparent text-[#6B7A8D] hover:text-[#0B1929]"
              }`}
            >
              <Copy className="w-3.5 h-3.5 shrink-0" />
              <span>Guardar Actual</span>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0">
          {/* ── Paso de Previsualización & Aplicación Selectiva ── */}
          {selectedTplForApply ? (() => {
            const items = isNutri ? selectedTplForApply.dias || [] : selectedTplForApply.rutinas || [];
            const tplKcal = Number(selectedTplForApply?.macros?.calorias || 0);
            const curKcal = Number(patientMacros?.calorias || 0);
            const allSelected = items.length > 0 && selectedIndices.length === items.length;

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedTplForApply(null)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6B7A8D] hover:text-[#0B1929] px-2.5 py-1.5 rounded-xl hover:bg-[#F0F4FA] cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Volver a la lista</span>
                  </button>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[var(--brand-primary)]">
                    Vista previa antes de aplicar
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="font-bold text-sm text-[#0B1929]">{selectedTplForApply.nombre}</div>
                  {selectedTplForApply.tags && (
                    <div className="text-xs text-[#6B7A8D] mt-0.5">{selectedTplForApply.tags}</div>
                  )}
                </div>

                {/* Selección de días / sesiones */}
                {items.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider">
                        {isNutri ? "Días a importar" : "Sesiones a importar"} ({selectedIndices.length}/{items.length})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedIndices(allSelected ? [] : items.map((_, i) => i))
                        }
                        className="text-[11px] font-bold text-[var(--brand-primary)] hover:underline cursor-pointer"
                      >
                        {allSelected ? "Desmarcar todos" : "Seleccionar todos"}
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {items.map((it, idx) => {
                        const checked = selectedIndices.includes(idx);
                        const label = isNutri
                          ? (it.dia || "").split("|")[0] || `Día ${idx + 1}`
                          : (it.nombre || "").split("|").filter(Boolean).join(" · ") || `Rutina ${idx + 1}`;
                        const metaStr = isNutri
                          ? `${(it.comidas || []).length} comidas · ${(it.comidas || []).reduce((s, c) => s + (Number(c.calorias) || 0), 0)} kcal`
                          : `${(it.ejercicios || []).length} ejercicios`;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              setSelectedIndices((prev) =>
                                prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]
                              )
                            }
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
                              checked
                                ? "bg-blue-50/50 border-[var(--brand-primary)]/40 text-[#0B1929]"
                                : "bg-white border-[#E2E8F0] text-[#6B7A8D]"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                  checked
                                    ? "bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white"
                                    : "border-gray-300 bg-white"
                                }`}
                              >
                                {checked && <Check className="w-3 h-3 stroke-[3]" />}
                              </span>
                              <span className="text-xs font-bold truncate">{label}</span>
                            </div>
                            <span className="text-[11px] text-[#6B7A8D] shrink-0">{metaStr}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Agregar vs Reemplazar */}
                {hasExistingPlan && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider block">
                      ¿Cómo aplicar al ciclo actual?
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setApplyMode("append")}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          applyMode === "append"
                            ? "border-[var(--brand-primary)] bg-blue-50/50"
                            : "border-[#E2E8F0] bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                          <span>Agregar al plan actual</span>
                        </div>
                        <div className="text-[11px] text-[#6B7A8D] mt-0.5">
                          Mantiene lo existente y suma los elementos seleccionados.
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setApplyMode("replace")}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          applyMode === "replace"
                            ? "border-amber-500 bg-amber-50/60"
                            : "border-[#E2E8F0] bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                          <span>Reemplazar plan actual</span>
                        </div>
                        <div className="text-[11px] text-[#6B7A8D] mt-0.5">
                          Borra {isNutri ? "los días" : "las rutinas"} actuales de este ciclo y carga esta plantilla.
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Opciones de Macros (Nutrición) o Pesos/Semanas (Entrenamiento) */}
                {isNutri && tplKcal > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider block">
                      Prescripción de Kcal &amp; Macros
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setApplyMacrosOption("keep")}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          applyMacrosOption === "keep"
                            ? "border-emerald-500 bg-emerald-50/60"
                            : "border-[#E2E8F0] bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="text-xs font-bold text-[#0B1929]">
                          Conservar macros del paciente {hasPatientMacros ? "(recomendado)" : ""}
                        </div>
                        <div className="text-[11px] text-[#6B7A8D] mt-0.5">
                          {curKcal > 0
                            ? `Mantiene su meta clínica actual (${curKcal} kcal).`
                            : "No sobrescribe la meta actual."}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setApplyMacrosOption("template")}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          applyMacrosOption === "template"
                            ? "border-[var(--brand-primary)] bg-blue-50/50"
                            : "border-[#E2E8F0] bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="text-xs font-bold text-[#0B1929]">
                          Usar macros de la plantilla
                        </div>
                        <div className="text-[11px] text-[#6B7A8D] mt-0.5">
                          Aplica {tplKcal} kcal ({selectedTplForApply.macros.proteina || 0}g P / {selectedTplForApply.macros.carbohidratos || 0}g C / {selectedTplForApply.macros.grasas || 0}g G).
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {!isNutri && (
                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/70 text-[11px] text-[#0B1929]">
                      Duración automática: las sesiones importadas adoptarán automáticamente las{" "}
                      <strong>{cycleWeeks} semanas</strong> del plan activo del paciente.
                    </div>
                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clearWeightsOption}
                        onChange={(e) => setClearWeightsOption(e.target.checked)}
                        className="w-4 h-4 accent-[var(--brand-primary)] rounded"
                      />
                      <div>
                        <div className="text-xs font-bold text-[#0B1929]">Limpiar pesos sugeridos</div>
                        <div className="text-[11px] text-[#6B7A8D]">
                          Deja los kg sugeridos en blanco para ajustar cargas o importar marcas del paciente.
                        </div>
                      </div>
                    </label>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTplForApply(null)}
                    className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#6B7A8D] hover:bg-gray-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={items.length > 0 && selectedIndices.length === 0}
                    onClick={handleConfirmApply}
                    className="px-4 py-2.5 rounded-xl bg-[var(--brand-primary)] text-white text-xs sm:text-sm font-bold hover:opacity-90 disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    <span>Aplicar al paciente</span>
                  </button>
                </div>
              </div>
            );
          })() : activeTab === "list" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-[#6B7A8D]">
                  Tu biblioteca personal aislada: editar una plantilla no modifica planes ya asignados.
                </p>
                {loadingCloud && (
                  <span className="text-[11px] text-[var(--brand-primary)] font-semibold">
                    Sincronizando...
                  </span>
                )}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-[#9BA5B0] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre o etiqueta..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-xs sm:text-sm text-[#0B1929] outline-none focus:border-[var(--brand-primary)]"
                />
              </div>

              {filteredTemplates.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <div className="text-sm font-bold text-[#0B1929]">No hay plantillas que coincidan</div>
                  <p className="text-xs text-[#6B7A8D]">
                    Crea una plantilla desde cero sin paciente o guarda el plan actual.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredTemplates.map((tpl) => {
                    const summary = summarizeTemplate(tpl, type);
                    const isCustom = tpl?.isDefault !== true && !String(tpl?.id || "").startsWith("base_");
                    const isConfirmingDel = confirmDeleteId === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => openApplyPreview(tpl)}
                        className="group border border-[#E2E8F0] hover:border-[var(--brand-primary)]/50 rounded-xl p-3.5 sm:p-4 bg-white transition-all cursor-pointer flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-[#0B1929] group-hover:text-[var(--brand-primary)] transition-colors truncate">
                              {tpl.nombre}
                            </span>
                            {isCustom ? (
                              <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                                Tu Plantilla
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold bg-[#F0F4FA] text-[#6B7A8D] px-2 py-0.5 rounded-full">
                                Base FLUX
                              </span>
                            )}
                          </div>

                          {tpl.tags && (
                            <p className="text-xs text-[#6B7A8D] line-clamp-1">{tpl.tags}</p>
                          )}

                          <div className="flex items-center flex-wrap gap-1.5 pt-1 text-[11px] font-medium text-[#0B1929]">
                            <span className="px-2 py-0.5 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] font-semibold">
                              {summary.totalItems} {summary.unitLabel}
                            </span>
                            {isNutri ? (
                              <>
                                {summary.kcal > 0 && (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-50/70 text-emerald-800 border border-emerald-200/70">
                                    {summary.kcal} kcal · {summary.prot}g P · {summary.carbs}g C · {summary.fats}g G
                                  </span>
                                )}
                                {summary.smaeEquiv > 0 && (
                                  <span className="px-2 py-0.5 rounded-md bg-blue-50/70 text-[var(--brand-primary)]">
                                    {summary.smaeEquiv} eq SMAE
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                {summary.effectiveSets > 0 && (
                                  <span className="px-2 py-0.5 rounded-md bg-blue-50/70 text-[var(--brand-primary)] border border-blue-200/60">
                                    {summary.effectiveSets} series ef.
                                  </span>
                                )}
                                {(summary.muscleList || []).slice(0, 3).map((m) => (
                                  <span
                                    key={m.id}
                                    className="px-1.5 py-0.5 rounded bg-[#F8FAFC] text-[#6B7A8D] text-[10px]"
                                  >
                                    {m.label}
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onOpenTemplateBuilder && (
                            <button
                              type="button"
                              onClick={() => handleEditTemplate(tpl)}
                              className="p-2 rounded-lg text-[#6B7A8D] hover:text-[var(--brand-primary)] hover:bg-blue-50 transition-colors cursor-pointer"
                              title={isCustom ? "Editar plantilla en constructor" : "Duplicar y editar plantilla"}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {isCustom && (
                            isConfirmingDel ? (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                                className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-bold hover:bg-red-700 cursor-pointer"
                              >
                                Eliminar
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(tpl.id)}
                                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                                title="Eliminar plantilla"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )
                          )}
                          <button
                            type="button"
                            onClick={() => openApplyPreview(tpl)}
                            className="w-8 h-8 rounded-lg bg-blue-50 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                            title="Seleccionar plantilla"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === "crear" ? (
            <form onSubmit={handleCreateEmptyTemplate} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/70 text-xs text-[#0B1929]">
                {isNutri ? (
                  <>
                    Arma una plantilla independiente <strong>sin asociarla a ningún paciente</strong>, con metas manuales de calorías/SMAE y días de menú. Al aplicarla se adaptará automáticamente a la duración del plan activo.
                  </>
                ) : (
                  <>
                    Arma una plantilla independiente <strong>sin asociarla a ningún paciente</strong>, con tus sesiones y ejercicios listos para reusar. No requiere duración fija: al aplicarla adoptará automáticamente la duración del plan activo del paciente.
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-1.5">
                  Nombre de la Plantilla
                </label>
                <input
                  type="text"
                  required
                  value={newTplTitle}
                  onChange={(e) => setNewTplTitle(e.target.value)}
                  placeholder={isNutri ? "Ej. Definición 2000 kcal · 4 comidas" : "Ej. Hipertrofia Push/Pull/Legs"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] focus:border-[var(--brand-primary)] outline-none text-sm text-[#0B1929]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-1.5">
                  Etiquetas / Objetivo <span className="font-normal text-[#6B7A8D]">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={newTplTags}
                  onChange={(e) => setNewTplTags(e.target.value)}
                  placeholder={isNutri ? "Ej. Déficit, Alta Proteína, Práctica" : "Ej. Hipertrofia, Gimnasio, Intermedio"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] focus:border-[var(--brand-primary)] outline-none text-sm text-[#0B1929]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[var(--brand-primary)] text-white font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Abrir Constructor Completo</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleSaveCurrentAsTemplate} className="space-y-4">
              {userCustomTemplates.length > 0 && (
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#F0F4FA]">
                  <button
                    type="button"
                    onClick={() => setSaveMode("new")}
                    className={`py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      saveMode === "new" ? "bg-white text-[var(--brand-primary)] shadow-xs" : "text-[#6B7A8D]"
                    }`}
                  >
                    Guardar como nueva
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaveMode("overwrite")}
                    className={`py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      saveMode === "overwrite" ? "bg-white text-[var(--brand-primary)] shadow-xs" : "text-[#6B7A8D]"
                    }`}
                  >
                    Actualizar existente
                  </button>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0B1929]">
                <strong>Se capturará del paciente actual:</strong>{" "}
                {isNutri
                  ? `${currentData?.dias?.length || 0} ${currentData?.dias?.length === 1 ? "día" : "días"} (${currentData?.macros?.calorias || 0} kcal base)`
                  : `${(currentData?.rutinas || []).filter((r) => (r.ejercicios || []).length > 0).length} rutinas activas`}
              </div>

              {saveMode === "overwrite" && userCustomTemplates.length > 0 ? (
                <div>
                  <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-1.5">
                    Plantilla existente a reemplazar
                  </label>
                  <select
                    value={effectiveOverwriteId}
                    onChange={(e) => setTargetOverwriteId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-sm font-medium text-[#0B1929] outline-none focus:border-[var(--brand-primary)]"
                  >
                    {userCustomTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-1.5">
                      Nombre de la Plantilla
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isNutri ? "Ej. Volumen Limpio 2800 kcal" : "Ej. Hipertrofia Torso/Pierna 4 Días"}
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] focus:border-[var(--brand-primary)] outline-none text-sm text-[#0B1929]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-1.5">
                      Etiquetas o Enfoque <span className="font-normal text-[#6B7A8D]">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder={isNutri ? "Ej. Keto, Baja en carbohidratos, 4 comidas" : "Ej. Intermedio, Fuerza, Gimnasio"}
                      value={newTags}
                      onChange={(e) => setNewTags(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] focus:border-[var(--brand-primary)] outline-none text-sm text-[#0B1929]"
                    />
                  </div>
                </>
              )}

              {!isNutri && (
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stripWeightsOnSave}
                    onChange={(e) => setStripWeightsOnSave(e.target.checked)}
                    className="w-4 h-4 accent-[var(--brand-primary)] rounded"
                  />
                  <div>
                    <div className="text-xs font-bold text-[#0B1929]">Quitar pesos específicos del paciente</div>
                    <div className="text-[11px] text-[#6B7A8D]">
                      Guarda series y repeticiones sin copiar cargas en kg de este paciente.
                    </div>
                  </div>
                </label>
              )}

              <button
                type="submit"
                disabled={savingTpl || !canSaveCurrent}
                className="w-full py-2.5 rounded-xl bg-[var(--brand-primary)] text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>
                  {savingTpl
                    ? "Guardando..."
                    : saveMode === "overwrite"
                    ? "Actualizar Plantilla"
                    : "Guardar en Biblioteca Personal"}
                </span>
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center text-xs text-[#6B7A8D]">
          <span>
            {selectedTplForApply
              ? "Cada plantilla aplicada es una copia independiente."
              : "Editar una plantilla no afecta planes previos."}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-[#0B1929] font-bold hover:bg-gray-50 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
