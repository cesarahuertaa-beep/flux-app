import { useState, useEffect, useMemo } from "react";
import {
  Bookmark,
  Utensils,
  Dumbbell,
  Plus,
  Search,
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
    <div className="w-full flex-1 flex flex-col gap-4 pb-24 md:pb-8">
      {/* Cabecera */}
      <div className="bg-white rounded-none md:rounded-2xl border-b md:border border-[#E2E8F0] p-4 sm:p-6 shadow-none md:shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
              <Bookmark className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-[#0B1929]">Mis Plantillas</h1>
                {loadingCloud && (
                  <span className="text-[11px] font-semibold text-[var(--brand-primary)]">
                    Sincronizando...
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6B7A8D] mt-0.5">
                Tu recetario personal de dietas y rutinas genéricas. Edítalas con total libertad sin alterar planes ya asignados a tus pacientes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateTemplate}
            className="px-4 py-2.5 rounded-xl bg-[var(--brand-primary)] text-white text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>
              {activeType === "nutri" ? "Nueva plantilla de nutrición" : "Nueva plantilla de entrenamiento"}
            </span>
          </button>
        </div>

        {/* Filtros de dominio + búsqueda */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex gap-1 bg-[#F0F4FA] rounded-xl p-1 w-full sm:w-max">
            <button
              type="button"
              onClick={() => setActiveType("nutri")}
              className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-[13px] transition-all flex-1 sm:flex-none cursor-pointer ${
                activeType === "nutri"
                  ? "bg-white shadow-sm text-[var(--brand-primary)] font-bold"
                  : "text-[#6B7A8D] hover:text-[#0B1929] font-medium"
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Nutrición ({nutriCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveType("rutina")}
              className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-[13px] transition-all flex-1 sm:flex-none cursor-pointer ${
                activeType === "rutina"
                  ? "bg-white shadow-sm text-[var(--brand-primary)] font-bold"
                  : "text-[#6B7A8D] hover:text-[#0B1929] font-medium"
              }`}
            >
              <Dumbbell className="w-3.5 h-3.5" />
              <span>Entrenamiento ({rutinaCount})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#9BA5B0] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o etiqueta..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white text-xs sm:text-sm text-[#0B1929] outline-none focus:border-[var(--brand-primary)]"
            />
          </div>
        </div>
      </div>

      {/* Lista / Grid */}
      {filteredList.length === 0 ? (
        <div className="bg-white rounded-none md:rounded-2xl border-y md:border border-[#E2E8F0] p-10 text-center space-y-3">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-3 md:px-0">
          {filteredList.map((tpl) => {
            const summary = summarizeTemplate(tpl, activeType);
            const isCustom = tpl?.isDefault !== true && !String(tpl?.id || "").startsWith("base_");
            const dateLabel = formatShortDate(tpl.updated_at || tpl.updatedAt || tpl.created_at || tpl.createdAt);
            return (
              <div
                key={tpl.id}
                onClick={() => handleOpenOrEdit(tpl)}
                className="group bg-white rounded-2xl border border-[#E2E8F0] hover:border-[var(--brand-primary)]/50 p-4 shadow-none md:shadow-2xs transition-all cursor-pointer flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm sm:text-base text-[#0B1929] group-hover:text-[var(--brand-primary)] transition-colors line-clamp-1">
                        {tpl.nombre}
                      </h3>
                      {tpl.tags && (
                        <p className="text-xs text-[#6B7A8D] line-clamp-1 mt-0.5">{tpl.tags}</p>
                      )}
                    </div>
                    {isCustom ? (
                      <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full shrink-0">
                        Personal
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-[#F0F4FA] text-[#6B7A8D] px-2 py-0.5 rounded-full shrink-0">
                        Base FLUX
                      </span>
                    )}
                  </div>

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
                          <span className="px-2 py-0.5 rounded-md bg-blue-50/70 text-[var(--brand-primary)]">
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
                  className="pt-2.5 border-t border-[#F0F4FA] flex items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[11px] text-[#9BA5B0] truncate">
                    {dateLabel ? `Act. ${dateLabel}` : "Lista para usar"}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleDuplicate(tpl, e)}
                      className="p-2 rounded-lg text-[#6B7A8D] hover:text-[#0B1929] hover:bg-[#F0F4FA] transition-colors cursor-pointer"
                      title="Duplicar plantilla"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteTpl(tpl)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Eliminar plantilla"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenOrEdit(tpl)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)] hover:text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{isCustom ? "Abrir" : "Editar copia"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
