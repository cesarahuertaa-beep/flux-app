import React, { useState, useEffect } from "react";
import { X, Bookmark, Plus, Trash2, CheckCircle2, Copy, Dumbbell, Utensils, Sparkles, ChevronRight, AlertCircle, Users } from "lucide-react";
import { dbGet } from "../../lib/supabase";

// Plantillas maestras predefinidas para Nutrición
const DEFAULT_NUTRI_TEMPLATES = [
  {
    id: "def_nutri_1800",
    nombre: "Déficit 1,800 kcal — Alta Proteína (5 comidas)",
    tags: "Definición • 1800 kcal • 140g Prot",
    isDefault: true,
    macros: { calorias: 1800, proteina: 140, carbohidratos: 180, grasas: 55 },
    dias: [
      {
        dia: "LUN|Día 1",
        orden: 0,
        comidas: [
          { hora: "08:00", nombre: "Desayuno", opcion1: "3 claras de huevo + 1 huevo entero con espinacas y 2 rebanadas de pan integral tostado", calorias: 380, proteina: 28, carbohidratos: 32, grasas: 12 },
          { hora: "11:30", nombre: "Colación 1", opcion1: "1 taza de yogurt griego sin azúcar + 1 manzana + 15g de almendras", calorias: 240, proteina: 18, carbohidratos: 25, grasas: 8 },
          { hora: "14:30", nombre: "Comida", opcion1: "150g de pechuga de pollo a la plancha + 1 taza de arroz blanco cocido + ensalada verde con 1 cdita de aceite de oliva", calorias: 520, proteina: 42, carbohidratos: 55, grasas: 14 },
          { hora: "17:30", nombre: "Snack Pre-entreno", opcion1: "1 scoop de proteína whey en agua + 1 plátano mediano", calorias: 220, proteina: 25, carbohidratos: 27, grasas: 2 },
          { hora: "20:30", nombre: "Cena", opcion1: "1 lata de atún en agua con verduras mixtas al vapor y 1/3 de aguacate", calorias: 340, proteina: 32, carbohidratos: 16, grasas: 15 }
        ]
      },
      {
        dia: "MAR|Día 2",
        orden: 1,
        comidas: [
          { hora: "08:00", nombre: "Desayuno", opcion1: "1 taza de avena cocida con agua + 1 scoop de proteína + canela y 1/2 taza de fresas", calorias: 390, proteina: 30, carbohidratos: 52, grasas: 6 },
          { hora: "11:30", nombre: "Colación 1", opcion1: "2 huevos cocidos + 1 taza de pepino con limón y sal", calorias: 160, proteina: 13, carbohidratos: 4, grasas: 10 },
          { hora: "14:30", nombre: "Comida", opcion1: "150g de filete de tilapia o salmón + 150g de camote al horno + espárragos al vapor", calorias: 480, proteina: 38, carbohidratos: 45, grasas: 12 },
          { hora: "17:30", nombre: "Snack Pre-entreno", opcion1: "2 galletas de arroz inflado con 1 cda de crema de cacahuate", calorias: 190, proteina: 6, carbohidratos: 20, grasas: 9 },
          { hora: "20:30", nombre: "Cena", opcion1: "120g de pechuga deshebrada con 2 tortillas de maíz y salsa verde casera", calorias: 360, proteina: 35, carbohidratos: 28, grasas: 8 }
        ]
      }
    ]
  },
  {
    id: "def_nutri_2200",
    nombre: "Mantenimiento 2,200 kcal — Balanceado (4 comidas)",
    tags: "Mantenimiento • 2200 kcal • 160g Prot",
    isDefault: true,
    macros: { calorias: 2200, proteina: 160, carbohidratos: 240, grasas: 65 },
    dias: [
      {
        dia: "LUN|Día 1",
        orden: 0,
        comidas: [
          { hora: "08:30", nombre: "Desayuno", opcion1: "Omelette de 3 huevos enteros con champiñones, queso panela (60g) y 2 rebanadas de pan", calorias: 520, proteina: 35, carbohidratos: 36, grasas: 24 },
          { hora: "14:00", nombre: "Comida", opcion1: "180g de carne de res magra + 1.5 tazas de pasta integral con salsa de tomate casera y brócoli", calorias: 680, proteina: 52, carbohidratos: 75, grasas: 18 },
          { hora: "17:30", nombre: "Merienda", opcion1: "Licuado: 1 scoop de whey + 1 taza de leche descremada + 1 plátano + 20g de avena", calorias: 380, proteina: 34, carbohidratos: 48, grasas: 6 },
          { hora: "21:00", nombre: "Cena", opcion1: "160g de pechuga de pollo con 2 tazas de ensalada mixta, 1/2 aguacate y 1 papa horneada", calorias: 540, proteina: 44, carbohidratos: 40, grasas: 20 }
        ]
      }
    ]
  }
];

// Plantillas maestras predefinidas para Rutinas
const DEFAULT_RUTINA_TEMPLATES = [
  {
    id: "def_rutina_ppl",
    nombre: "Push / Pull / Legs (PPL Clásico - 3 Días)",
    tags: "Hipertrofia • 3-6 Días • Frecuencia 2",
    isDefault: true,
    semanas: 4,
    rutinas: [
      {
        nombre: "LUN|Push (Empuje: Pecho, Hombro, Tríceps)",
        ejercicios: [
          { nombre: "Press de Banca Plano con Barra", grupo_muscular: "Pecho", tipo_movimiento: "Compuesto", num_series: 4, reps_sugeridas: 8, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Press Inclinado con Mancuernas", grupo_muscular: "Pecho", tipo_movimiento: "Compuesto", num_series: 3, reps_sugeridas: 10, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Press Militar de Hombro", grupo_muscular: "Hombro", tipo_movimiento: "Compuesto", num_series: 3, reps_sugeridas: 10, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Elevaciones Laterales", grupo_muscular: "Hombro", tipo_movimiento: "Aislamiento", num_series: 4, reps_sugeridas: 15, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Extensión de Tríceps en Polea", grupo_muscular: "Brazos", tipo_movimiento: "Aislamiento", num_series: 3, reps_sugeridas: 12, peso_sugerido: "", unidad: "kg", alternativas: [] }
        ]
      },
      {
        nombre: "MIE|Pull (Jalón: Espalda, Bíceps)",
        ejercicios: [
          { nombre: "Jalón al Pecho en Polea", grupo_muscular: "Espalda", tipo_movimiento: "Compuesto", num_series: 4, reps_sugeridas: 10, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Remo con Barra o Mancuerna", grupo_muscular: "Espalda", tipo_movimiento: "Compuesto", num_series: 4, reps_sugeridas: 8, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Face Pulls", grupo_muscular: "Hombro", tipo_movimiento: "Aislamiento", num_series: 3, reps_sugeridas: 15, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Curl de Bíceps con Barra Z", grupo_muscular: "Brazos", tipo_movimiento: "Aislamiento", num_series: 3, reps_sugeridas: 10, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Curl Martillo con Mancuernas", grupo_muscular: "Brazos", tipo_movimiento: "Aislamiento", num_series: 3, reps_sugeridas: 12, peso_sugerido: "", unidad: "kg", alternativas: [] }
        ]
      },
      {
        nombre: "VIE|Legs (Pierna y Abdomen)",
        ejercicios: [
          { nombre: "Sentadilla Libre con Barra", grupo_muscular: "Pierna", tipo_movimiento: "Compuesto", num_series: 4, reps_sugeridas: 8, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Prensa de Piernas", grupo_muscular: "Pierna", tipo_movimiento: "Compuesto", num_series: 3, reps_sugeridas: 10, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Peso Muerto Rumano", grupo_muscular: "Pierna", tipo_movimiento: "Compuesto", num_series: 3, reps_sugeridas: 10, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Curl Femoral Tumbado o Sentado", grupo_muscular: "Pierna", tipo_movimiento: "Aislamiento", num_series: 3, reps_sugeridas: 12, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Elevación de Talones (Pantorrilla)", grupo_muscular: "Pierna", tipo_movimiento: "Aislamiento", num_series: 4, reps_sugeridas: 15, peso_sugerido: "", unidad: "kg", alternativas: [] }
        ]
      }
    ]
  },
  {
    id: "def_rutina_torso_pierna",
    nombre: "Torso / Pierna (Upper / Lower - 4 Días)",
    tags: "Fuerza e Hipertrofia • 4 Días",
    isDefault: true,
    semanas: 4,
    rutinas: [
      {
        nombre: "LUN|Torso A (Pecho, Espalda, Hombro)",
        ejercicios: [
          { nombre: "Press de Banca Plano", grupo_muscular: "Pecho", tipo_movimiento: "Compuesto", num_series: 4, reps_sugeridas: 6, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Remo con Barra", grupo_muscular: "Espalda", tipo_movimiento: "Compuesto", num_series: 4, reps_sugeridas: 8, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Press Militar Mancuernas", grupo_muscular: "Hombro", tipo_movimiento: "Compuesto", num_series: 3, reps_sugeridas: 10, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Jalón al Pecho", grupo_muscular: "Espalda", tipo_movimiento: "Compuesto", num_series: 3, reps_sugeridas: 10, peso_sugerido: "", unidad: "kg", alternativas: [] }
        ]
      },
      {
        nombre: "MAR|Pierna A (Cuádriceps, Isquios, Gemelos)",
        ejercicios: [
          { nombre: "Sentadilla Trasera", grupo_muscular: "Pierna", tipo_movimiento: "Compuesto", num_series: 4, reps_sugeridas: 8, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Peso Muerto Rumano", grupo_muscular: "Pierna", tipo_movimiento: "Compuesto", num_series: 3, reps_sugeridas: 10, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Extensiones de Cuádriceps", grupo_muscular: "Pierna", tipo_movimiento: "Aislamiento", num_series: 3, reps_sugeridas: 12, peso_sugerido: "", unidad: "kg", alternativas: [] },
          { nombre: "Elevación de Talones en Máquina", grupo_muscular: "Pierna", tipo_movimiento: "Aislamiento", num_series: 4, reps_sugeridas: 15, peso_sugerido: "", unidad: "kg", alternativas: [] }
        ]
      }
    ]
  }
];

export default function TemplatesManagerModal({
  type = "nutri", // "nutri" | "rutina"
  currentData,    // { macros, dias } o { rutinas, semanas }
  clientes = [],
  onApplyTemplate,
  onClose,
  setMsg
}) {
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
                peso_sugerido: e.peso_sugerido || "",
                unidad: e.unidad || "kg",
                alternativas: e.alternativas || []
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
            peso_sugerido: e.peso_sugerido || "",
            unidad: e.unidad || "kg",
            alternativas: e.alternativas || []
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
    <div className="fixed inset-0 z-[120] bg-[#0B1929]/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-[#E2E8F0] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* ── Modal Header ── */}
        <div className="p-6 border-b border-[#F0F4FA] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#E8F1FB] text-[var(--brand-primary)] flex items-center justify-center shadow-sm">
              {type === "nutri" ? <Utensils size={22} /> : <Dumbbell size={22} />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
                Biblioteca de Plantillas Maestro
              </h2>
              <p className="text-xs text-[#6B7A8D] mt-0.5">
                {type === "nutri" ? "Menús semanales completos listos para aplicar" : "Programas completos de entrenamiento"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-[#6B7A8D] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Tabs Navigation ── */}
        <div className="px-6 pt-3 pb-0 bg-[#F8FAFC] border-b border-[#E2E8F0] flex gap-2 shrink-0">
          <button
            onClick={() => setTab("cargar")}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              tab === "cargar"
                ? "bg-white text-[var(--brand-primary)] border-[var(--brand-primary)] shadow-xs"
                : "text-[#6B7A8D] border-transparent hover:text-[#0B1929]"
            }`}
          >
            <Bookmark size={15} />
            <span>Plantillas ({allTemplates.length})</span>
          </button>

          <button
            onClick={() => setTab("guardar")}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              tab === "guardar"
                ? "bg-white text-[var(--brand-primary)] border-[var(--brand-primary)] shadow-xs"
                : "text-[#6B7A8D] border-transparent hover:text-[#0B1929]"
            }`}
          >
            <Plus size={15} />
            <span>Guardar Actual como Plantilla</span>
          </button>

          {clientes.length > 0 && (
            <button
              onClick={() => setTab("clonar")}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
                tab === "clonar"
                  ? "bg-white text-[var(--brand-primary)] border-[var(--brand-primary)] shadow-xs"
                  : "text-[#6B7A8D] border-transparent hover:text-[#0B1929]"
              }`}
            >
              <Users size={15} />
              <span>Clonar de Otro Paciente</span>
            </button>
          )}
        </div>

        {/* ── Tab Content ── */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* TAB 1: CARGAR PLANTILLA */}
          {tab === "cargar" && (
            <div className="space-y-3">
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
                    className="p-4 rounded-2xl border border-[#E2E8F0] hover:border-[var(--brand-primary)] bg-white hover:shadow-md transition-all flex items-center justify-between gap-4 cursor-pointer group"
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
                          className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors"
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
        <div className="p-4 bg-gray-50 border-t border-[#E2E8F0] flex items-center justify-between shrink-0">
          <p className="text-xs text-[#6B7A8D]">
            ✨ Las plantillas te ahorran tiempo al reutilizar tus mejores programas.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#0B1929] hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
