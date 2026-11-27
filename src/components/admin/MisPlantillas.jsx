import { useState, useEffect, useMemo } from "react";
import {
  Bookmark,
  Utensils,
  Dumbbell,
  Plus,
  Search,
  X,
  Edit3,
  Copy,
  Trash2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { ProgramarCliente } from "./ProgramarCliente";
import { ConfirmModal } from "../ui/ConfirmModal";
import { useBackButton } from "../../lib/backButtonHandler";
import {
  resolvePlantillasCreatorId,
  readLocalTemplates,
  fetchCloudTemplates,
  upsertUserTemplate,
  deleteUserTemplate,
  createEmptyTemplateDraft,
  generateTemplateId,
  summarizeTemplate,
} from "../../lib/plantillasStore";

const formatShortDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
};

export function MisPlantillas({ biblioteca, profileId, setMsg }) {
  const creatorId = resolvePlantillasCreatorId(profileId);
  const [activeType, setActiveType] = useState("nutri"); // 'nutri' | 'rutina'
  const [search, setSearch] = useState("");
  const [templatesByType, setTemplatesByType] = useState(() => ({
    nutri: readLocalTemplates({ type: "nutri", creatorId, profileId }),
    rutina: readLocalTemplates({ type: "rutina", creatorId, profileId }),
  }));
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [editingState, setEditingState] = useState(null); // { type, template }
  const [confirmDeleteTpl, setConfirmDeleteTpl] = useState(null);

  useBackButton(Boolean(editingState), () => setEditingState(null), 15);

  useEffect(() => {
    let active = true;
    const syncLocal = () => {
      if (!active) return;
      setTemplatesByType({
        nutri: readLocalTemplates({ type: "nutri", creatorId, profileId }),
        rutina: readLocalTemplates({ type: "rutina", creatorId, profileId }),
      });
    };
    const loadAllCloud = async () => {
      setLoadingCloud(true);
      try {
        const [nutriList, rutinaList] = await Promise.all([
          fetchCloudTemplates({ type: "nutri", creatorId, profileId }),
          fetchCloudTemplates({ type: "rutina", creatorId, profileId }),
        ]);
        if (active) {
          setTemplatesByType({ nutri: nutriList, rutina: rutinaList });
        }
      } finally {
        if (active) setLoadingCloud(false);
      }
    };
    loadAllCloud();
    const onUpdated = () => syncLocal();
    window.addEventListener("flux:plantillas-updated", onUpdated);
    return () => {
      active = false;
      window.removeEventListener("flux:plantillas-updated", onUpdated);
    };
  }, [creatorId, profileId]);

  const currentList = useMemo(
    () => templatesByType[activeType] || [],
    [templatesByType, activeType]
  );

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return currentList;
    return currentList.filter((tpl) =>
      `${tpl.nombre || ""} ${tpl.tags || ""}`.toLowerCase().includes(q)
    );
  }, [currentList, search]);

  const handleCreateTemplate = async () => {
    const draft = createEmptyTemplateDraft({
      type: activeType,
      creatorId,
      nombre:
        activeType === "nutri"
          ? "Nueva plantilla de nutrición"
          : "Nueva plantilla de entrenamiento",
      tags: "Personalizada",
    });
    const nextList = await upsertUserTemplate({
      type: activeType,
      creatorId,
      profileId,
      template: draft,
    });
    setTemplatesByType((prev) => ({ ...prev, [activeType]: nextList }));
    setEditingState({ type: activeType, template: draft });
  };

  const handleOpenOrEdit = async (tpl) => {
    const isCustom = tpl?.isDefault !== true && !String(tpl?.id || "").startsWith("base_");
    if (!isCustom) {
      const cloned = {
        ...createEmptyTemplateDraft({ type: activeType, creatorId }),
        ...tpl,
        id: generateTemplateId(activeType),
        nombre: `${tpl.nombre || "Plantilla"} (Personal)`,
        creatorId,
        isDefault: false,
        isCustom: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const nextList = await upsertUserTemplate({
        type: activeType,
        creatorId,
        profileId,
        template: cloned,
      });
      setTemplatesByType((prev) => ({ ...prev, [activeType]: nextList }));
      setEditingState({ type: activeType, template: cloned });
      return;
    }
    setEditingState({ type: activeType, template: tpl });
  };

  const handleDuplicate = async (tpl, e) => {
    e?.stopPropagation();
    const copy = {
      ...tpl,
      id: generateTemplateId(activeType),
      creatorId,
      nombre: `${tpl.nombre || "Plantilla"} (Copia)`,
      isDefault: false,
      isCustom: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const nextList = await upsertUserTemplate({
      type: activeType,
      creatorId,
      profileId,
      template: copy,
    });
    setTemplatesByType((prev) => ({ ...prev, [activeType]: nextList }));
    setMsg?.(
      <div className="flex items-center gap-1.5 text-emerald-600">
        <CheckCircle2 className="w-4 h-4" /> Plantilla duplicada en tu recetario
      </div>
    );
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteTpl) return;
    const idToDelete = confirmDeleteTpl.id;
    setConfirmDeleteTpl(null);
    const nextList = await deleteUserTemplate({
      type: activeType,
      creatorId,
      profileId,
      id: idToDelete,
    });
    setTemplatesByType((prev) => ({ ...prev, [activeType]: nextList }));
    setMsg?.(
      <div className="flex items-center gap-1.5 text-red-600">
        <Trash2 className="w-4 h-4" /> Plantilla eliminada
      </div>
    );
  };

  if (editingState?.template) {
    return (
      <ProgramarCliente
        key={editingState.template.id}
        templateWorkspace={{
          type: editingState.type,
          template: editingState.template,
          onChangeTemplate: (updatedTpl) => {
            upsertUserTemplate({
              type: editingState.type,
              creatorId,
              profileId,
              template: updatedTpl,
            }).then((nextList) => {
              setTemplatesByType((prev) => ({ ...prev, [editingState.type]: nextList }));
            });
            setEditingState((prev) =>
              prev && prev.template?.id === updatedTpl.id
                ? { ...prev, template: updatedTpl }
                : prev
            );
          },
          onBack: () => setEditingState(null),
        }}
        biblioteca={biblioteca}
        setMsg={setMsg}
        profileId={profileId}
      />
    );
  }

  const nutriCount = templatesByType.nutri?.length || 0;
  const rutinaCount = templatesByType.rutina?.length || 0;

  return (
    <div className="w-full max-w-full min-w-0 flex-1 flex flex-col overflow-x-hidden">
      {/* Cabecera Principal (Estandarizada con Pacientes y Biblioteca) */}
      <div className="px-4 md:px-8 pt-3 pb-2.5 md:pt-8 md:pb-6 bg-white border-b border-[#E2E8F0] flex flex-col gap-2.5 md:gap-4 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="hidden md:block text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">
              Panel de Administración
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg md:text-2xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
                Mis Plantillas
              </h1>
              {loadingCloud && (
                <span className="text-[11px] font-semibold text-[var(--brand-primary)]">
                  Sincronizando...
                </span>
              )}
            </div>
            <p className="hidden md:block text-sm text-[#6B7A8D] mt-1">
              Tu recetario personal de dietas y rutinas base para asignar en un clic sin alterar planes activos
            </p>
          </div>

          {/* Botón Desktop */}
          <button
            type="button"
            onClick={handleCreateTemplate}
            className="hidden sm:inline-flex items-center justify-center gap-1.5 bg-[var(--brand-primary)] text-white h-[42px] px-4 rounded-xl text-xs sm:text-sm font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all shrink-0 cursor-pointer"
            title="Nueva Plantilla"
          >
            <Plus size={18} strokeWidth={2.5} className="shrink-0" />
            <span>
              {activeType === "nutri" ? "Nueva Plantilla de Nutrición" : "Nueva Plantilla de Entrenamiento"}
            </span>
          </button>
        </div>

        {/* Barra de Búsqueda y Botón en móvil */}
        <div className="flex items-center gap-2 sm:gap-3 w-full">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA5B0]" />
            <input
              type="text"
              placeholder="Buscar por nombre o etiqueta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F0F4FA] text-[#0B1929] text-xs sm:text-sm rounded-xl pl-9 pr-8 py-2.5 outline-none focus:ring-2 focus:ring-[var(--brand-primary)] transition-all placeholder:text-[#9BA5B0]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9BA5B0] hover:text-[#0B1929] p-0.5 cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Botón Móvil (< sm) */}
          <button
            type="button"
            onClick={handleCreateTemplate}
            className="sm:hidden flex items-center justify-center gap-1.5 bg-[var(--brand-primary)] text-white h-[42px] px-3 rounded-xl text-xs font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all shrink-0 cursor-pointer"
            title="Nueva Plantilla"
            aria-label="Nueva Plantilla"
          >
            <Plus size={18} strokeWidth={2.5} className="shrink-0" />
            <span className="text-xs">Nueva</span>
          </button>
        </div>

        {/* Píldoras de Filtro (Segmented Control Nutrición / Entrenamiento) */}
        <div className="flex items-center gap-2 pt-0 overflow-x-auto scroll-hide pb-0.5 -mx-4 px-4 md:mx-0 md:px-0">
          <button
            type="button"
            onClick={() => setActiveType("nutri")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeType === "nutri"
                ? "bg-[var(--brand-primary)] text-white shadow-2xs font-bold"
                : "bg-white border border-[#E2E8F0] text-[#6B7A8D] hover:text-[#0B1929] hover:bg-[#F8FAFC]"
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Nutrición ({nutriCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveType("rutina")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeType === "rutina"
                ? "bg-[var(--brand-primary)] text-white shadow-2xs font-bold"
                : "bg-white border border-[#E2E8F0] text-[#6B7A8D] hover:text-[#0B1929] hover:bg-[#F8FAFC]"
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5" />
            <span>Entrenamiento ({rutinaCount})</span>
          </button>
        </div>
      </div>

      {/* Contenido / Grid de Plantillas */}
      <div className="flex-1 w-full min-w-0 max-w-full px-0 py-0 pb-28 md:p-8">
        {filteredList.length === 0 ? (
          <div className="mx-4 my-6 md:mx-0 bg-white rounded-2xl border border-[#E2E8F0] p-8 md:p-14 text-center space-y-3 shadow-none md:shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-[#F0F4FA] text-[var(--brand-primary)] flex items-center justify-center mx-auto">
              {activeType === "nutri" ? <Utensils className="w-6 h-6" /> : <Dumbbell className="w-6 h-6" />}
            </div>
            <div className="text-sm sm:text-base font-bold text-[#0B1929]">
              {search.trim()
                ? "Sin plantillas que coincidan con tu búsqueda"
                : `Aún no tienes plantillas de ${activeType === "nutri" ? "nutrición" : "entrenamiento"}`}
            </div>
            <p className="text-xs text-[#6B7A8D] max-w-md mx-auto">
              {activeType === "nutri"
                ? "Crea dietas base por calorías (ej. 1800 kcal, 2200 kcal) con distribución SMAE y platillos listos para asignar en segundos."
                : "Arma tus splits favoritos (Torso/Pierna, PPL, Full Body) y aplícalos a cualquier plan activo adaptándose automáticamente a su duración."}
            </p>
            {!search.trim() && (
              <button
                type="button"
                onClick={handleCreateTemplate}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--brand-primary)] text-white text-xs sm:text-sm font-bold hover:opacity-90 cursor-pointer shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>Crear primera plantilla</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 md:gap-4">
            {filteredList.map((tpl) => {
              const summary = summarizeTemplate(tpl, activeType);
              const isCustom = tpl?.isDefault !== true && !String(tpl?.id || "").startsWith("base_");
              const dateLabel = formatShortDate(tpl.updated_at || tpl.updatedAt || tpl.created_at || tpl.createdAt);
              const accentColor = activeType === "nutri" ? "bg-emerald-500" : "bg-sky-500";

              return (
                <div
                  key={tpl.id}
                  onClick={() => handleOpenOrEdit(tpl)}
                  className="group bg-white rounded-none md:rounded-2xl border-b first:border-t md:first:border-t-0 md:border border-[#E2E8F0] hover:border-[var(--brand-primary)] hover:shadow-md transition-all flex flex-col justify-between shadow-none md:shadow-2xs cursor-pointer relative overflow-hidden"
                >
                  {/* Barra superior de acento (homólogo a Pacientes y Agenda) */}
                  <div className={`h-1.5 w-full ${accentColor}`} />

                  <div className="p-4 md:p-5 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-[15px] sm:text-base text-[#0B1929] group-hover:text-[var(--brand-primary)] transition-colors line-clamp-1">
                            {tpl.nombre}
                          </h3>
                          {tpl.tags ? (
                            <p className="text-xs text-[#6B7A8D] line-clamp-1 mt-0.5">{tpl.tags}</p>
                          ) : (
                            <p className="text-xs text-[#94A3B8] italic mt-0.5">
                              {activeType === "nutri" ? "Plan de alimentación base" : "Rutina de entrenamiento base"}
                            </p>
                          )}
                        </div>
                        {isCustom ? (
                          <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/60 px-2 py-0.5 rounded-full shrink-0">
                            Personal
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-[#F0F4FA] text-[#6B7A8D] border border-[#E2E8F0] px-2 py-0.5 rounded-full shrink-0">
                            Base FLUX
                          </span>
                        )}
                      </div>

                      {/* Badges de Información / Macros / Series */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
                        <span className="px-2 py-0.5 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-[#0B1929] font-semibold">
                          {summary.totalItems} {summary.unitLabel}
                        </span>
                        {activeType === "nutri" ? (
                          <>
                            {summary.kcal > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50/70 text-emerald-800 border border-emerald-200/70">
                                {summary.kcal} kcal · {summary.prot}P / {summary.carbs}C / {summary.fats}G
                              </span>
                            )}
                            {summary.smaeEquiv > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-50/70 text-[var(--brand-primary)] border border-blue-200/60">
                                {summary.smaeEquiv} eq SMAE
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            {summary.effectiveSets > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-50/70 text-[var(--brand-primary)] border border-blue-200/70">
                                {summary.effectiveSets} series ef.
                              </span>
                            )}
                            {(summary.muscleList || []).slice(0, 3).map((m) => (
                              <span
                                key={m.id}
                                className="px-1.5 py-0.5 rounded bg-[#F8FAFC] text-[#6B7A8D] border border-[#E2E8F0] text-[10px]"
                              >
                                {m.label}
                              </span>
                            ))}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Footer de la tarjeta */}
                    <div
                      className="pt-3 border-t border-[#F0F4FA] flex items-center justify-between gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[11px] text-[#9BA5B0] truncate">
                        {dateLabel ? `Act. ${dateLabel}` : "Lista para usar"}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleDuplicate(tpl, e)}
                          className="p-2 rounded-xl text-[#6B7A8D] hover:text-[#0B1929] hover:bg-[#F0F4FA] border border-transparent hover:border-[#E2E8F0] transition-colors cursor-pointer"
                          title="Duplicar plantilla"
                          aria-label="Duplicar plantilla"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTpl(tpl)}
                            className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors cursor-pointer"
                            title="Eliminar plantilla"
                            aria-label="Eliminar plantilla"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenOrEdit(tpl)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)] hover:text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{isCustom ? "Abrir" : "Editar copia"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(confirmDeleteTpl)}
        onClose={() => setConfirmDeleteTpl(null)}
        onConfirm={handleConfirmDelete}
        title={`¿Eliminar "${confirmDeleteTpl?.nombre || ""}"?`}
        description="Se eliminará de tu recetario personal. Los planes que ya aplicaste a tus pacientes permanecerán intactos."
        confirmText="Eliminar plantilla"
        danger
        icon="trash"
      />
    </div>
  );
}
