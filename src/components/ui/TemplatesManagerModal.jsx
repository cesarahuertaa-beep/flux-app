import React, { useState, useEffect } from "react";
import { X, Bookmark, Plus, Trash2, CheckCircle2, Copy, Dumbbell, Utensils, Sparkles, ChevronRight, AlertCircle, Users } from "lucide-react";
import { dbGet } from "../../lib/supabase";
import { useBackButton } from "../../lib/backButtonHandler";

// Plantillas maestras predefinidas para Nutrición (vacío para usar solo plantillas creadas o clonadas por el profesional)
const DEFAULT_NUTRI_TEMPLATES = [];

// Plantillas maestras predefinidas para Rutinas (vacío para usar solo plantillas creadas o clonadas por el profesional)
const DEFAULT_RUTINA_TEMPLATES = [];

export default function TemplatesManagerModal({
  type = "nutri", // "nutri" | "rutina"
  currentData,    // { macros, dias } o { rutinas, semanas }
  clientes = [],
  onApplyTemplate,
  onClose,
  setMsg
}) {
  useBackButton(true, onClose, 60);
  const [tab, setTab] = useState("cargar"); // "cargar" | "guardar" | "clonar"
  const storageKey = type === "nutri" ? "flux_plantillas_nutri" : "flux_plantillas_rutinas";

  // Cargar plantillas de usuario
  const [userTemplates, setUserTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Guardar en localStorage
  const saveUserTemplates = (newList) => {
    setUserTemplates(newList);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newList));
    } catch (e) {
      console.error(e);
    }
  };

  // Estado para crear nueva plantilla
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTags, setNuevoTags]     = useState("");

  // Estado para clonar de otro paciente
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [clienteCiclos, setClienteCiclos]         = useState([]);
  const [loadingCiclos, setLoadingCiclos]         = useState(false);
  const [selectedCicloId, setSelectedCicloId]     = useState("");

  // Cargar ciclos cuando cambia el cliente en Clonar
  useEffect(() => {
    if (!selectedClienteId) {
      setClienteCiclos([]);
      return;
    }
    const fetchCiclos = async () => {
      setLoadingCiclos(true);
      try {
        const cs = await dbGet(`ciclos?cliente_id=eq.${selectedClienteId}&order=created_at.desc`);
        setClienteCiclos(cs || []);
        if (cs && cs.length > 0) setSelectedCicloId(cs[0].id);
      } catch (e) {
        console.error(e);
      }
      setLoadingCiclos(false);
    };
    fetchCiclos();
  }, [selectedClienteId]);

  // Lista combinada de plantillas (Predefinidas + Usuario)
  const defaultList = type === "nutri" ? DEFAULT_NUTRI_TEMPLATES : DEFAULT_RUTINA_TEMPLATES;
  const allTemplates = [...userTemplates, ...defaultList];

  const handleSaveCurrentAsTemplate = () => {
    if (!nuevoNombre.trim()) {
      alert("Por favor ingresa un nombre para la plantilla");
      return;
    }

    const newTemplate = {
      id: `tpl_${Date.now()}`,
      nombre: nuevoNombre.trim(),
      tags: nuevoTags.trim() || (type === "nutri" ? "Personalizada" : "Rutina propia"),
      isDefault: false,
      created_at: new Date().toISOString(),
      ...(type === "nutri"
        ? {
            macros: currentData?.macros || { calorias: 0, proteina: 0, carbohidratos: 0, grasas: 0 },
            dias: (currentData?.dias || []).map((d) => ({
              dia: d.dia,
              orden: d.orden,
              comidas: (d.comidas || []).map((c) => ({
                hora: c.hora || "",
                nombre: c.nombre || "",
                opcion1: c.opcion1 || "",
                opcion2: c.opcion2 || "",
                calorias: c.calorias || 0,
                proteina: c.proteina || 0,
                carbohidratos: c.carbohidratos || 0,
                grasas: c.grasas || 0,
                foto_url: c.foto_url || c.imagen_url || ""
              }))
            }))
          }
        : {
            semanas: currentData?.semanas || 4,
            rutinas: (currentData?.rutinas || []).map((r) => ({
              nombre: r.nombre,
              semanas: r.semanas || 4,
              ejercicios: (r.ejercicios || []).map((e) => ({
                biblioteca_id: e.biblioteca_id || null,
                nombre: e.nombre,
                gif_url: e.gif_url || "",
                grupo_muscular: e.grupo_muscular || "",
                tipo_movimiento: e.tipo_movimiento || "",
                num_series: e.num_series || 4,
                reps_sugeridas: e.reps_sugeridas || 10,
                peso_sugerido: (e.peso_sugerido !== "" && e.peso_sugerido !== null && e.peso_sugerido !== undefined && !isNaN(e.peso_sugerido)) ? Number(e.peso_sugerido) : null,
                unidad: e.unidad || "kg",
                alternativas: (e.alternativas || []).map((alt) => ({
                  ...alt,
                  peso_sugerido: (alt.peso_sugerido !== "" && alt.peso_sugerido !== null && alt.peso_sugerido !== undefined && !isNaN(alt.peso_sugerido)) ? Number(alt.peso_sugerido) : null
                }))
              }))
            }))
          })
    };

    saveUserTemplates([newTemplate, ...userTemplates]);
    setNuevoNombre("");
    setNuevoTags("");
    setTab("cargar");
    if (setMsg) {
      setMsg(
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          Plantilla "{newTemplate.nombre}" guardada con éxito
        </div>
      );
    }
  };

  const handleDeleteTemplate = (id, e) => {
    e.stopPropagation();
    if (!confirm("¿Seguro que deseas eliminar esta plantilla guardada?")) return;
    saveUserTemplates(userTemplates.filter((t) => t.id !== id));
  };

  const handleCloneFromCycle = async () => {
    if (!selectedCicloId) return;
    try {
      if (type === "nutri") {
        // Cargar nutrición de ese ciclo
        const nRes = await dbGet(`nutricion?ciclo_id=eq.${selectedCicloId}`);
        if (!nRes || nRes.length === 0) {
          alert("El ciclo seleccionado no tiene plan de nutrición.");
          return;
        }
        const nut = nRes[0];
        const diasRes = await dbGet(`nutricion_dias?nutricion_id=eq.${nut.id}&order=orden.asc`);
        const dids = diasRes.map((d) => d.id).join(",");
        const comsRes = dids ? await dbGet(`comidas?dia_id=in.(${dids})&order=orden.asc`) : [];

        const clonedDias = diasRes.map((d) => ({
          dia: d.dia,
          orden: d.orden,
          comidas: comsRes.filter((c) => c.dia_id === d.id).map((c) => ({
            hora: c.hora || "",
            nombre: c.nombre || "",
            opcion1: c.opcion1 || "",
            opcion2: c.opcion2 || "",
            calorias: c.calorias || 0,
            proteina: c.proteina || 0,
            carbohidratos: c.carbohidratos || 0,
            grasas: c.grasas || 0,
            foto_url: c.foto_url || c.imagen_url || ""
          }))
        }));

        onApplyTemplate({
          macros: { calorias: nut.calorias, proteina: nut.proteina, carbohidratos: nut.carbohidratos, grasas: nut.grasas },
          dias: clonedDias
        });
      } else {
        // Cargar rutinas de ese ciclo
        const rutRes = await dbGet(`rutinas?ciclo_id=eq.${selectedCicloId}&order=orden.asc`);
        if (!rutRes || rutRes.length === 0) {
          alert("El ciclo seleccionado no tiene rutinas.");
          return;
        }
        const rids = rutRes.map((r) => r.id).join(",");
        const ejsRes = rids ? await dbGet(`ejercicios?rutina_id=in.(${rids})&order=orden.asc`) : [];

        const clonedRutinas = rutRes.map((r) => ({
          nombre: r.nombre,
          semanas: r.semanas || 4,
          ejercicios: ejsRes.filter((e) => e.rutina_id === r.id).map((e) => ({
            biblioteca_id: e.biblioteca_id || null,
            nombre: e.nombre,
            gif_url: e.gif_url || "",
            grupo_muscular: e.grupo_muscular || "",
            tipo_movimiento: e.tipo_movimiento || "",
            num_series: e.num_series || 4,
            reps_sugeridas: e.reps_sugeridas || 10,
            peso_sugerido: (e.peso_sugerido !== "" && e.peso_sugerido !== null && e.peso_sugerido !== undefined && !isNaN(e.peso_sugerido)) ? Number(e.peso_sugerido) : null,
            unidad: e.unidad || "kg",
            alternativas: (e.alternativas || []).map((alt) => ({
              ...alt,
              peso_sugerido: (alt.peso_sugerido !== "" && alt.peso_sugerido !== null && alt.peso_sugerido !== undefined && !isNaN(alt.peso_sugerido)) ? Number(alt.peso_sugerido) : null
            }))
          }))
        }));

        onApplyTemplate({
          rutinas: clonedRutinas
        });
      }

      onClose();
    } catch (e) {
      alert("Error clonando ciclo: " + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-[#0B1929]/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-[#E2E8F0] overflow-hidden animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        
        {/* ── Modal Header ── */}
        <div className="px-4 sm:px-6 py-4 sm:py-6 border-b border-[#F0F4FA] flex items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#E8F1FB] text-[var(--brand-primary)] flex items-center justify-center shadow-sm shrink-0">
              {type === "nutri" ? <Utensils size={20} /> : <Dumbbell size={20} />}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-bold text-[#0B1929] leading-tight" style={{ fontFamily: "DM Sans" }}>
                Plantillas Maestro
              </h2>
              <p className="text-[11px] sm:text-xs text-[#6B7A8D] mt-0.5 leading-snug">
                {type === "nutri" ? "Menús semanales listos para aplicar" : "Programas completos de entrenamiento"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-[#6B7A8D] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Tabs Navigation ── */}
        <div className="px-2 sm:px-6 pt-2 sm:pt-3 pb-0 bg-[#F8FAFC] border-b border-[#E2E8F0] flex gap-1 sm:gap-2 shrink-0">
          {[
            { id: "cargar", icon: Bookmark, short: `Plantillas (${allTemplates.length})`, long: `Plantillas (${allTemplates.length})`, show: true },
            { id: "guardar", icon: Plus, short: "Guardar", long: "Guardar Actual como Plantilla", show: true },
            { id: "clonar", icon: Users, short: "Clonar", long: "Clonar de Otro Paciente", show: clientes.length > 0 },
          ].filter(t => t.show).map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 sm:flex-none px-2 sm:px-4 py-2.5 text-[11px] sm:text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                  tab === t.id
                    ? "bg-white text-[var(--brand-primary)] border-[var(--brand-primary)] shadow-xs"
                    : "text-[#6B7A8D] border-transparent hover:text-[#0B1929]"
                }`}
              >
                <Icon size={14} className="shrink-0" />
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.long}</span>
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain">
          
          {/* TAB 1: CARGAR PLANTILLA */}
          {tab === "cargar" && (
            <div className="space-y-3">
              {allTemplates.length === 0 ? (
                <div className="text-center py-10 px-4 border border-dashed border-[#CBD5E1] rounded-2xl bg-[#F8FAFC]">
                  <Bookmark className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
                  <p className="text-sm font-bold text-[#0B1929]">No hay plantillas guardadas</p>
                  <p className="text-xs text-[#6B7A8D] mt-1 max-w-sm mx-auto">
                    Aún no has guardado plantillas para {type === "nutri" ? "nutrición" : "rutinas"}. Puedes guardar el plan actual como plantilla maestra o clonar el plan de otro paciente.
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => setTab("guardar")}
                      className="px-3.5 py-2 text-xs font-bold rounded-xl bg-[var(--brand-primary)] text-white hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Plus size={14} />
                      Guardar plan actual
                    </button>
                    {clientes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTab("clonar")}
                        className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-[#CBD5E1] text-[#0B1929] hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Users size={14} />
                        Clonar de paciente
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-[#6B7A8D] mb-3">
                    Selecciona una plantilla para cargarla automáticamente en el ciclo activo de este paciente:
                  </p>

                  {allTemplates.map((t) => {
                    const totalItems = type === "nutri" ? (t.dias || []).length : (t.rutinas || []).length;
                    const unitLabel = type === "nutri" ? "días con menú" : "rutinas";

                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          if (confirm(`¿Aplicar la plantilla "${t.nombre}" a este ciclo? Se importarán todos sus ${unitLabel}.`)) {
                            onApplyTemplate(t);
                            onClose();
                          }
                        }}
                        className="p-3 sm:p-4 rounded-2xl border border-[#E2E8F0] hover:border-[var(--brand-primary)] bg-white hover:shadow-md transition-all flex items-center justify-between gap-2 sm:gap-4 cursor-pointer group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-[#0B1929] group-hover:text-[var(--brand-primary)] transition-colors">
                              {t.nombre}
                            </span>
                            {t.isDefault ? (
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[var(--brand-primary)] text-[10px] font-bold">
                                Oficial FLUX
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold">
                                Tu Plantilla
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-[#6B7A8D] mt-1">{t.tags}</p>

                          <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-[#6B7A8D]">
                            <span className="font-semibold text-[#0B1929]">
                              {totalItems} {unitLabel}
                            </span>
                            {type === "nutri" && t.macros?.calorias > 0 && (
                              <span>• {t.macros.calorias} kcal</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {!t.isDefault && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteTemplate(t.id, e)}
                              title="Eliminar plantilla"
                              className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                          <div className="w-9 h-9 rounded-xl bg-[#E8F1FB] text-[var(--brand-primary)] flex items-center justify-center group-hover:bg-[var(--brand-primary)] group-hover:text-white transition-all">
                            <ChevronRight size={18} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* TAB 2: GUARDAR ACTUAL COMO PLANTILLA */}
          {tab === "guardar" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#E8F1FB]/60 border border-[#CBD5E1]/50 text-xs text-[#0B1929]">
                <p className="font-bold mb-1">¿Qué se guardará en esta plantilla?</p>
                {type === "nutri" ? (
                  <p className="text-[#6B7A8D]">
                    Se guardará la configuración de macros y los <strong>{(currentData?.dias || []).length} días</strong> activos con todas sus comidas, horarios e ingredientes.
                  </p>
                ) : (
                  <p className="text-[#6B7A8D]">
                    Se guardarán las <strong>{(currentData?.rutinas || []).length} rutinas</strong> activas con todos sus ejercicios, series sugeridas, repeticiones y alternativas.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-1.5">
                  Nombre de la Plantilla
                </label>
                <input
                  type="text"
                  placeholder={type === "nutri" ? "Ej. Déficit 1,800 kcal - 5 comidas" : "Ej. Push Pull Legs - Hipertrofia"}
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-1.5">
                  Etiquetas o Notas (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Definición • 4 Semanas • Principiantes"
                  value={nuevoTags}
                  onChange={(e) => setNuevoTags(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveCurrentAsTemplate}
                  className="w-full py-3 bg-[var(--brand-primary)] text-white rounded-xl text-sm font-bold shadow-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Bookmark size={16} />
                  <span>Guardar en mis Plantillas</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: CLONAR DE OTRO PACIENTE */}
          {tab === "clonar" && (
            <div className="space-y-4">
              <p className="text-xs text-[#6B7A8D]">
                Copia de forma instantánea todo el programa de {type === "nutri" ? "nutrición" : "entrenamiento"} de otro paciente a este ciclo:
              </p>

              <div>
                <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-1.5">
                  1. Seleccionar Paciente
                </label>
                <select
                  value={selectedClienteId}
                  onChange={(e) => setSelectedClienteId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                >
                  <option value="">-- Elige un paciente del directorio --</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.email || "Sin email"})
                    </option>
                  ))}
                </select>
              </div>

              {selectedClienteId && (
                <div>
                  <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-1.5">
                    2. Seleccionar Ciclo / Plan a Copiar
                  </label>
                  {loadingCiclos ? (
                    <p className="text-xs text-[#6B7A8D]">Cargando planes del paciente...</p>
                  ) : clienteCiclos.length === 0 ? (
                    <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
                      Este paciente aún no tiene ciclos o planes registrados.
                    </p>
                  ) : (
                    <select
                      value={selectedCicloId}
                      onChange={(e) => setSelectedCicloId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                    >
                      {clienteCiclos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre.split("|")[0]} {c.activo ? "🟢 (Plan Activo)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {selectedCicloId && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleCloneFromCycle}
                    className="w-full py-3 bg-[var(--brand-primary)] text-white rounded-xl text-sm font-bold shadow-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Copy size={16} />
                    <span>Clonar Todo el {type === "nutri" ? "Menú" : "Programa"} a este Ciclo</span>
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Modal Footer ── */}
        <div className="px-4 py-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gray-50 border-t border-[#E2E8F0] flex items-center justify-between gap-3 shrink-0">
          <p className="hidden sm:block text-xs text-[#6B7A8D]">
            ✨ Las plantillas te ahorran tiempo al reutilizar tus mejores programas.
          </p>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#0B1929] hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
