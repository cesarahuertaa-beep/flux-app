import { useState, useEffect } from "react";
import { GRUPOS } from "../../lib/constants";
import { dbGet, dbPost, dbPatch, dbDel, storageUpload } from "../../lib/supabase";
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  Image as ImageIcon,
  Dumbbell,
  Play,
  Video,
  X,
  CheckCircle2,
  AlertCircle,
  Utensils,
  Apple,
  Flame,
  ChevronDown,
  ChevronUp,
  FileText,
  Upload,
  Loader2,
  Sparkles,
  Eye
} from "lucide-react";
import { useBackButton } from "../../lib/backButtonHandler";
import { CustomSelect } from "../ui/CustomSelect";
import { ConfirmModal } from "../ui/ConfirmModal";
import {
  peekCustomPlatillos,
  peekCustomIngredientes,
  fetchCustomPlatillos,
  fetchCustomIngredientes,
  saveCustomPlatillos,
  saveCustomIngredientes,
  CATEGORIAS_PLATILLOS,
  CATEGORIAS_INGREDIENTES
} from "../../lib/customCatalogs";

export function Biblioteca({ biblioteca, onUpdate, setMsg, isSuperadmin }) {
  // ── Sub-pestaña activa ("ejercicios" | "platillos" | "ingredientes") ──
  const [subtab, setSubtab] = useState("ejercicios");

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. ESTADOS DE EJERCICIOS
  // ─────────────────────────────────────────────────────────────────────────────
  const [showEjModal, setShowEjModal]     = useState(false);
  const [editEj, setEditEj]               = useState(null);
  const [deleteEjModal, setDeleteEjModal] = useState(null);
  const [formEj, setFormEj]               = useState({ nombre: "", grupo_muscular: "Pecho", gif_url: "" });
  const [savingEj, setSavingEj]           = useState(false);
  const [uploadingEj, setUploadingEj]     = useState(false);
  const [filtroGrupoEj, setFiltroGrupoEj] = useState("Todos");
  const [busquedaEj, setBusquedaEj]       = useState("");
  const [previewEj, setPreviewEj]         = useState(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. ESTADOS DE PLATILLOS
  // ─────────────────────────────────────────────────────────────────────────────
  const [platillos, setPlatillos]                     = useState(() => peekCustomPlatillos());
  const [showPlatilloModal, setShowPlatilloModal]     = useState(false);
  const [editPlatillo, setEditPlatillo]               = useState(null);
  const [deletePlatilloModal, setDeletePlatilloModal] = useState(null);
  const [recipePreviewModal, setRecipePreviewModal]   = useState(null);
  const [savingPlatillo, setSavingPlatillo]           = useState(false);
  const [uploadingPlatillo, setUploadingPlatillo]     = useState(false);
  const [filtroCatPlatillo, setFiltroCatPlatillo]     = useState("todos");
  const [busquedaPlatillo, setBusquedaPlatillo]       = useState("");
  const [formPlatillo, setFormPlatillo]               = useState({
    nombre: "",
    categoria: "desayuno",
    calorias: 400,
    proteina: 30,
    carbohidratos: 40,
    grasas: 12,
    foto_url: "",
    texto: "",
    keywordsStr: ""
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. ESTADOS DE INGREDIENTES
  // ─────────────────────────────────────────────────────────────────────────────
  const [ingredientes, setIngredientes]                   = useState(() => peekCustomIngredientes());
  const [showIngModal, setShowIngModal]                   = useState(false);
  const [editIng, setEditIng]                             = useState(null);
  const [deleteIngModal, setDeleteIngModal]               = useState(null);
  const [savingIng, setSavingIng]                         = useState(false);
  const [uploadingIng, setUploadingIng]                   = useState(false);
  const [filtroCatIng, setFiltroCatIng]                   = useState("todos");
  const [busquedaIng, setBusquedaIng]                     = useState("");
  const [formIng, setFormIng]                             = useState({
    nombre: "",
    categoria: "proteinas",
    foto: ""
  });

  // Sincronización en segundo plano de catálogos en Supabase Storage
  useEffect(() => {
    fetchCustomPlatillos().then(data => {
      if (Array.isArray(data) && data.length > 0) setPlatillos(data);
    });
    fetchCustomIngredientes().then(data => {
      if (Array.isArray(data) && data.length > 0) setIngredientes(data);
    });

    const onPlatillosUpdated = (e) => {
      if (Array.isArray(e.detail)) setPlatillos(e.detail);
    };
    const onIngredientesUpdated = (e) => {
      if (Array.isArray(e.detail)) setIngredientes(e.detail);
    };

    window.addEventListener("flux:platillos-updated", onPlatillosUpdated);
    window.addEventListener("flux:ingredientes-updated", onIngredientesUpdated);
    return () => {
      window.removeEventListener("flux:platillos-updated", onPlatillosUpdated);
      window.removeEventListener("flux:ingredientes-updated", onIngredientesUpdated);
    };
  }, []);

  useBackButton(!!previewEj || !!recipePreviewModal, () => {
    setPreviewEj(null);
    setRecipePreviewModal(null);
  }, 50);

  useBackButton(showEjModal || showPlatilloModal || showIngModal, () => {
    setShowEjModal(false);
    setShowPlatilloModal(false);
    setShowIngModal(false);
  }, 20);

  // ── Subida de Multimedia para Ejercicios ──
  const uploadGif = async (file) => {
    setUploadingEj(true);
    try {
      const ext = file.name.split(".").pop();
      const fname = `ej_${Date.now()}.${ext}`;
      const url = await storageUpload("ejercicios", fname, file);
      setFormEj(p => ({ ...p, gif_url: url }));
      setMsg(<div className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-green-500" /> Archivo subido</div>);
    } catch (e) {
      setMsg("❌ " + e.message);
    }
    setUploadingEj(false);
  };

  // ── Subida de Foto para Platillos ──
  const uploadPlatilloFoto = async (file) => {
    setUploadingPlatillo(true);
    try {
      const ext = file.name.split(".").pop();
      const fname = `platillo_${Date.now()}.${ext}`;
      const url = await storageUpload("ejercicios", fname, file);
      setFormPlatillo(p => ({ ...p, foto_url: url }));
      setMsg(<div className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-green-500" /> Fotografía subida</div>);
    } catch (e) {
      setMsg("❌ " + e.message);
    }
    setUploadingPlatillo(false);
  };

  // ── Subida de Foto para Ingredientes ──
  const uploadIngredienteFoto = async (file) => {
    setUploadingIng(true);
    try {
      const ext = file.name.split(".").pop();
      const fname = `ingrediente_${Date.now()}.${ext}`;
      const url = await storageUpload("ejercicios", fname, file);
      setFormIng(p => ({ ...p, foto: url }));
      setMsg(<div className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-green-500" /> Imagen de ingrediente subida</div>);
    } catch (e) {
      setMsg("❌ " + e.message);
    }
    setUploadingIng(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ACCIONES DE EJERCICIOS
  // ─────────────────────────────────────────────────────────────────────────────
  const openNewEj = () => {
    setEditEj(null);
    setFormEj({ nombre: "", grupo_muscular: "Pecho", gif_url: "" });
    setShowEjModal(true);
  };

  const openEditEj = (e) => {
    setEditEj(e);
    setFormEj({ nombre: e.nombre, grupo_muscular: e.grupo_muscular, gif_url: e.gif_url || "" });
    setShowEjModal(true);
  };

  const saveEj = async () => {
    if (!formEj.nombre.trim()) {
      setMsg(<div className="flex gap-2 items-center"><AlertCircle className="w-4 h-4 text-yellow-500" /> Escribe el nombre del ejercicio</div>);
      return;
    }
    setSavingEj(true);
    try {
      if (editEj) await dbPatch(`biblioteca_ejercicios?id=eq.${editEj.id}`, formEj);
      else await dbPost("biblioteca_ejercicios", formEj);
      setShowEjModal(false);
      setMsg(<div className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-green-500" /> Ejercicio guardado</div>);
      onUpdate();
    } catch (e) {
      setMsg("❌ " + e.message);
    }
    setSavingEj(false);
  };

  const executeDeleteEj = async () => {
    if (!deleteEjModal) return;
    try {
      await dbDel(`biblioteca_ejercicios?id=eq.${deleteEjModal.id}`);
      setMsg(<div className="flex gap-2 items-center"><Trash2 className="w-4 h-4 text-red-500" /> Ejercicio eliminado</div>);
      setDeleteEjModal(null);
      onUpdate();
    } catch (e) {
      setMsg("❌ " + e.message);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ACCIONES DE PLATILLOS
  // ─────────────────────────────────────────────────────────────────────────────
  const openNewPlatillo = () => {
    setEditPlatillo(null);
    setFormPlatillo({
      nombre: "",
      categoria: "desayuno",
      calorias: 400,
      proteina: 30,
      carbohidratos: 40,
      grasas: 12,
      foto_url: "",
      texto: "",
      keywordsStr: ""
    });
    setShowPlatilloModal(true);
  };

  const openEditPlatillo = (p) => {
    setEditPlatillo(p);
    setFormPlatillo({
      nombre: p.nombre || "",
      categoria: p.categoria || "comida",
      calorias: p.calorias != null ? Number(p.calorias) : 400,
      proteina: p.proteina != null ? Number(p.proteina) : 30,
      carbohidratos: p.carbohidratos != null ? Number(p.carbohidratos) : 40,
      grasas: p.grasas != null ? Number(p.grasas) : 12,
      foto_url: p.foto_url || "",
      texto: p.texto || "",
      keywordsStr: Array.isArray(p.keywords) ? p.keywords.join(", ") : (p.keywords || "")
    });
    setShowPlatilloModal(true);
  };

  const savePlatillo = async () => {
    if (!formPlatillo.nombre.trim()) {
      setMsg(<div className="flex gap-2 items-center"><AlertCircle className="w-4 h-4 text-yellow-500" /> Escribe el nombre del platillo</div>);
      return;
    }
    setSavingPlatillo(true);
    try {
      const kws = formPlatillo.keywordsStr
        ? formPlatillo.keywordsStr.split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
        : formPlatillo.nombre.toLowerCase().split(/\s+/).filter(w => w.length > 2);

      const itemPayload = {
        id: editPlatillo ? editPlatillo.id : `dish_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        nombre: formPlatillo.nombre.trim(),
        categoria: formPlatillo.categoria,
        calorias: Math.max(0, Math.round(Number(formPlatillo.calorias) || 0)),
        proteina: Math.max(0, Math.round(Number(formPlatillo.proteina) || 0)),
        carbohidratos: Math.max(0, Math.round(Number(formPlatillo.carbohidratos) || 0)),
        grasas: Math.max(0, Math.round(Number(formPlatillo.grasas) || 0)),
        foto_url: formPlatillo.foto_url.trim(),
        texto: formPlatillo.texto.trim(),
        keywords: kws,
        updated_at: new Date().toISOString()
      };

      let updatedList = [];
      if (editPlatillo) {
        updatedList = platillos.map(p => p.id === editPlatillo.id ? { ...p, ...itemPayload } : p);
      } else {
        updatedList = [itemPayload, ...platillos];
      }

      setPlatillos(updatedList);
      await saveCustomPlatillos(updatedList);
      setShowPlatilloModal(false);
      setMsg(<div className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-green-500" /> Platillo guardado en el catálogo</div>);
    } catch (e) {
      setMsg("❌ " + e.message);
    }
    setSavingPlatillo(false);
  };

  const executeDeletePlatillo = async () => {
    if (!deletePlatilloModal) return;
    try {
      const updatedList = platillos.filter(p => p.id !== deletePlatilloModal.id);
      setPlatillos(updatedList);
      await saveCustomPlatillos(updatedList);
      setMsg(<div className="flex gap-2 items-center"><Trash2 className="w-4 h-4 text-red-500" /> Platillo eliminado del catálogo</div>);
      setDeletePlatilloModal(null);
    } catch (e) {
      setMsg("❌ " + e.message);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ACCIONES DE INGREDIENTES
  // ─────────────────────────────────────────────────────────────────────────────
  const openNewIng = () => {
    setEditIng(null);
    setFormIng({
      nombre: "",
      categoria: "proteinas",
      foto: ""
    });
    setShowIngModal(true);
  };

  const openEditIng = (ing) => {
    setEditIng(ing);
    setFormIng({
      nombre: ing.nombre || "",
      categoria: ing.categoria || "proteinas",
      foto: ing.foto || ""
    });
    setShowIngModal(true);
  };

  const saveIng = async () => {
    if (!formIng.nombre.trim()) {
      setMsg(<div className="flex gap-2 items-center"><AlertCircle className="w-4 h-4 text-yellow-500" /> Escribe el nombre del ingrediente</div>);
      return;
    }
    setSavingIng(true);
    try {
      const itemPayload = {
        id: editIng ? editIng.id : `ing_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        nombre: formIng.nombre.trim(),
        categoria: formIng.categoria,
        foto: formIng.foto.trim() || `https://www.themealdb.com/images/ingredients/${encodeURIComponent(formIng.nombre.trim())}.png`,
        updated_at: new Date().toISOString()
      };

      let updatedList = [];
      if (editIng) {
        updatedList = ingredientes.map(item => item.id === editIng.id ? { ...item, ...itemPayload } : item);
      } else {
        updatedList = [itemPayload, ...ingredientes];
      }

      setIngredientes(updatedList);
      await saveCustomIngredientes(updatedList);
      setShowIngModal(false);
      setMsg(<div className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-green-500" /> Ingrediente guardado en el catálogo</div>);
    } catch (e) {
      setMsg("❌ " + e.message);
    }
    setSavingIng(false);
  };

  const executeDeleteIng = async () => {
    if (!deleteIngModal) return;
    try {
      const updatedList = ingredientes.filter(item => item.id !== deleteIngModal.id);
      setIngredientes(updatedList);
      await saveCustomIngredientes(updatedList);
      setMsg(<div className="flex gap-2 items-center"><Trash2 className="w-4 h-4 text-red-500" /> Ingrediente eliminado del catálogo</div>);
      setDeleteIngModal(null);
    } catch (e) {
      setMsg("❌ " + e.message);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // FILTRADO DE DATOS
  // ─────────────────────────────────────────────────────────────────────────────
  const ejerciciosFiltrados = biblioteca.filter(e => {
    const matchG = filtroGrupoEj === "Todos" || e.grupo_muscular === filtroGrupoEj;
    const matchB = (e.nombre || "").toLowerCase().includes(busquedaEj.toLowerCase());
    return matchG && matchB;
  });

  const platillosFiltrados = platillos.filter(p => {
    const matchCat = filtroCatPlatillo === "todos" || p.categoria === filtroCatPlatillo;
    const matchSearch =
      (p.nombre || "").toLowerCase().includes(busquedaPlatillo.toLowerCase()) ||
      (p.texto || "").toLowerCase().includes(busquedaPlatillo.toLowerCase()) ||
      (Array.isArray(p.keywords) && p.keywords.some(k => k.toLowerCase().includes(busquedaPlatillo.toLowerCase())));
    return matchCat && matchSearch;
  });

  const ingredientesFiltrados = ingredientes.filter(ing => {
    const matchCat = filtroCatIng === "todos" || ing.categoria === filtroCatIng;
    const matchSearch = (ing.nombre || "").toLowerCase().includes(busquedaIng.toLowerCase());
    return matchCat && matchSearch;
  });

  // Colores por grupo muscular
  const groupColors = {
    Pecho: "#38bdf8",
    Espalda: "#818cf8",
    Piernas: "#34d399",
    Hombros: "#f472b6",
    Bíceps: "#fb923c",
    Tríceps: "#a78bfa",
    Core: "#fbbf24",
    Cardio: "#ef4444"
  };

  // Colores por categoría de platillos
  const platilloCatColors = {
    desayuno: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    comida: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    cena: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
    colacion: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" }
  };

  return (
    <div className="space-y-5">
      {/* ── Sub-tabs Superiores: Selector de Colección (Multi-Módulo) ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-1.5 shadow-sm flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1.5 overflow-x-auto scroll-hide w-full sm:w-auto">
          {/* Tab Ejercicios */}
          <button
            type="button"
            onClick={() => setSubtab("ejercicios")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              subtab === "ejercicios"
                ? "bg-[var(--brand-primary)] text-white shadow-sm"
                : "text-[#6B7A8D] hover:text-[#0B1929] hover:bg-gray-50"
            }`}
          >
            <Dumbbell className="w-4 h-4 shrink-0" />
            <span>Ejercicios</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold ${
              subtab === "ejercicios" ? "bg-white/20 text-white" : "bg-gray-100 text-[#6B7A8D]"
            }`}>
              {biblioteca.length}
            </span>
          </button>

          {/* Tab Platillos */}
          <button
            type="button"
            onClick={() => setSubtab("platillos")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              subtab === "platillos"
                ? "bg-[var(--brand-primary)] text-white shadow-sm"
                : "text-[#6B7A8D] hover:text-[#0B1929] hover:bg-gray-50"
            }`}
          >
            <Utensils className="w-4 h-4 shrink-0" />
            <span>Platillos y Recetas</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold ${
              subtab === "platillos" ? "bg-white/20 text-white" : "bg-gray-100 text-[#6B7A8D]"
            }`}>
              {platillos.length}
            </span>
          </button>

          {/* Tab Ingredientes */}
          <button
            type="button"
            onClick={() => setSubtab("ingredientes")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              subtab === "ingredientes"
                ? "bg-[var(--brand-primary)] text-white shadow-sm"
                : "text-[#6B7A8D] hover:text-[#0B1929] hover:bg-gray-50"
            }`}
          >
            <Apple className="w-4 h-4 shrink-0" />
            <span>Ingredientes Culinarios</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold ${
              subtab === "ingredientes" ? "bg-white/20 text-white" : "bg-gray-100 text-[#6B7A8D]"
            }`}>
              {ingredientes.length}
            </span>
          </button>
        </div>

        {/* Botón de Creación Dinámico según el Tab Activo */}
        {isSuperadmin && (
          <div className="w-full sm:w-auto flex justify-end">
            {subtab === "ejercicios" && (
              <button
                type="button"
                onClick={openNewEj}
                className="bg-[var(--brand-primary)] hover:opacity-90 text-white px-4 py-2 rounded-xl text-xs sm:text-[13px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus size={16} /> <span>Nuevo ejercicio</span>
              </button>
            )}
            {subtab === "platillos" && (
              <button
                type="button"
                onClick={openNewPlatillo}
                className="bg-[var(--brand-primary)] hover:opacity-90 text-white px-4 py-2 rounded-xl text-xs sm:text-[13px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus size={16} /> <span>Nuevo platillo</span>
              </button>
            )}
            {subtab === "ingredientes" && (
              <button
                type="button"
                onClick={openNewIng}
                className="bg-[var(--brand-primary)] hover:opacity-90 text-white px-4 py-2 rounded-xl text-xs sm:text-[13px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus size={16} /> <span>Nuevo ingrediente</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* VISTA 1: EJERCICIOS */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {subtab === "ejercicios" && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="flex gap-2.5 flex-wrap p-3.5 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm items-center">
            <div className="relative flex-1 min-w-[160px] max-w-[240px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7A8D]" />
              <input
                value={busquedaEj}
                onChange={e => setBusquedaEj(e.target.value)}
                placeholder="Buscar ejercicio…"
                className="w-full bg-white text-[#0B1929] border border-[#E2E8F0] rounded-xl pl-9 pr-3 py-2 text-[13px] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all font-['Inter',sans-serif]"
              />
            </div>
            <CustomSelect
              value={filtroGrupoEj}
              onChange={setFiltroGrupoEj}
              options={["Todos", ...GRUPOS]}
              className="min-w-[140px]"
            />
            {(filtroGrupoEj !== "Todos" || busquedaEj) && (
              <button
                onClick={() => { setBusquedaEj(""); setFiltroGrupoEj("Todos"); }}
                className="bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl px-3 py-2 text-red-500 text-xs cursor-pointer font-semibold font-['Inter',sans-serif] transition-colors flex items-center gap-1"
              >
                <X size={14} /> Limpiar
              </button>
            )}
          </div>

          {/* Grid de Ejercicios */}
          {ejerciciosFiltrados.length === 0 ? (
            <div className="text-center py-20 text-[#6B7A8D] bg-white rounded-2xl border border-[#E2E8F0] shadow-sm">
              <Dumbbell size={48} className="mx-auto mb-4 opacity-20" />
              <div className="text-[16px] font-semibold mb-1.5 text-[#0B1929]">
                {biblioteca.length === 0 ? "La biblioteca de ejercicios está vacía" : "No hay ejercicios que coincidan"}
              </div>
              <div className="text-[13px] text-[#6B7A8D]">
                {biblioteca.length === 0 && isSuperadmin ? "Agrega el primer ejercicio con el botón de arriba" : "Intenta con otros filtros"}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-[14px]">
              {ejerciciosFiltrados.map((e, i) => {
                const accentColor = groupColors[e.grupo_muscular] || "#38bdf8";
                return (
                  <div
                    key={e.id}
                    className="group bg-white border border-[#E2E8F0] shadow-sm rounded-2xl overflow-hidden relative transition-all hover:shadow-md flex flex-col justify-between"
                  >
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 2,
                      background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`
                    }} />

                    {/* Media Area */}
                    <div
                      onClick={() => e.gif_url && setPreviewEj(e)}
                      className={`h-[130px] bg-gray-50 flex items-center justify-center relative overflow-hidden ${e.gif_url ? "cursor-pointer" : "cursor-default"}`}
                    >
                      {e.gif_url ? (
                        <>
                          <img
                            src={e.gif_url}
                            alt={e.nombre}
                            className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-[#0B1929]/40 flex items-center justify-center opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center text-[#0B1929] shadow-lg">
                              <Play size={20} className="ml-1" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <Dumbbell size={40} className="text-gray-300" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="font-semibold text-[13px] text-[#0B1929] mb-2 leading-snug">
                          {e.nombre}
                        </div>
                        <div className="flex gap-1 flex-wrap mb-2.5">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
                            {e.grupo_muscular}
                          </span>
                        </div>
                      </div>

                      {isSuperadmin && (
                        <div className="flex gap-1.5 mt-2 pt-2 border-t border-[#F8FAFC]">
                          <button
                            type="button"
                            onClick={() => openEditEj(e)}
                            className="flex-1 flex justify-center items-center gap-1 border border-[#E2E8F0] text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 bg-white rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Edit2 size={12} /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteEjModal(e)}
                            className="flex-1 flex justify-center items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Trash2 size={12} /> Borrar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* VISTA 2: PLATILLOS Y RECETAS */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {subtab === "platillos" && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="flex gap-2.5 flex-wrap p-3.5 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm items-center">
            <div className="relative flex-1 min-w-[160px] max-w-[240px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7A8D]" />
              <input
                value={busquedaPlatillo}
                onChange={e => setBusquedaPlatillo(e.target.value)}
                placeholder="Buscar platillo o ingrediente…"
                className="w-full bg-white text-[#0B1929] border border-[#E2E8F0] rounded-xl pl-9 pr-3 py-2 text-[13px] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all font-['Inter',sans-serif]"
              />
            </div>
            <CustomSelect
              value={filtroCatPlatillo}
              onChange={setFiltroCatPlatillo}
              options={CATEGORIAS_PLATILLOS.map(c => ({ value: c.id, label: `${c.icono} ${c.nombre}` }))}
              className="min-w-[160px]"
            />
            {(filtroCatPlatillo !== "todos" || busquedaPlatillo) && (
              <button
                onClick={() => { setBusquedaPlatillo(""); setFiltroCatPlatillo("todos"); }}
                className="bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl px-3 py-2 text-red-500 text-xs cursor-pointer font-semibold font-['Inter',sans-serif] transition-colors flex items-center gap-1"
              >
                <X size={14} /> Limpiar
              </button>
            )}
          </div>

          {/* Grid de Platillos */}
          {platillosFiltrados.length === 0 ? (
            <div className="text-center py-20 text-[#6B7A8D] bg-white rounded-2xl border border-[#E2E8F0] shadow-sm">
              <Utensils size={48} className="mx-auto mb-4 opacity-20" />
              <div className="text-[16px] font-semibold mb-1.5 text-[#0B1929]">
                {platillos.length === 0 ? "El catálogo de platillos está vacío" : "No hay platillos que coincidan"}
              </div>
              <div className="text-[13px] text-[#6B7A8D]">
                {platillos.length === 0 && isSuperadmin ? "Agrega el primer platillo con el botón de arriba" : "Intenta con otros filtros"}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {platillosFiltrados.map((p) => {
                const badge = platilloCatColors[p.categoria] || { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
                const catLabel = CATEGORIAS_PLATILLOS.find(c => c.id === p.categoria)?.nombre || p.categoria;

                return (
                  <div
                    key={p.id}
                    className="group bg-white border border-[#E2E8F0] shadow-sm rounded-2xl overflow-hidden relative transition-all hover:shadow-md flex flex-col justify-between"
                  >
                    {/* Media Area */}
                    <div
                      onClick={() => setRecipePreviewModal(p)}
                      className="h-[145px] bg-slate-100 relative overflow-hidden cursor-pointer"
                    >
                      {p.foto_url ? (
                        <img
                          src={p.foto_url}
                          alt={p.nombre}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1">
                          <Utensils size={36} />
                          <span className="text-[11px] font-semibold">Sin imagen</span>
                        </div>
                      )}
                      <div className="absolute top-2.5 left-2.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-2xs ${badge.bg} ${badge.text} ${badge.border}`}>
                          {catLabel}
                        </span>
                      </div>
                      <div className="absolute top-2.5 right-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[#0B1929]/80 text-white backdrop-blur-xs flex items-center gap-1 shadow-2xs">
                          <Flame className="w-3 h-3 text-amber-400" />
                          <span>{p.calorias || 0} kcal</span>
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-[14px] text-[#0B1929] leading-snug line-clamp-2 mb-2">
                          {p.nombre}
                        </h4>

                        {/* Macros Pills */}
                        <div className="grid grid-cols-3 gap-1.5 mb-3 text-center">
                          <div className="bg-red-50/70 border border-red-100 rounded-lg p-1">
                            <span className="text-[10px] text-red-600 block font-semibold">Proteína</span>
                            <span className="text-xs font-bold text-red-900">{p.proteina || 0}g</span>
                          </div>
                          <div className="bg-amber-50/70 border border-amber-100 rounded-lg p-1">
                            <span className="text-[10px] text-amber-600 block font-semibold">Carbos</span>
                            <span className="text-xs font-bold text-amber-900">{p.carbohidratos || 0}g</span>
                          </div>
                          <div className="bg-emerald-50/70 border border-emerald-100 rounded-lg p-1">
                            <span className="text-[10px] text-emerald-600 block font-semibold">Grasas</span>
                            <span className="text-xs font-bold text-emerald-900">{p.grasas || 0}g</span>
                          </div>
                        </div>

                        {/* Recipe preview */}
                        {p.texto && (
                          <p className="text-[11px] text-[#6B7A8D] line-clamp-2 leading-relaxed mb-2">
                            {p.texto}
                          </p>
                        )}
                      </div>

                      {/* Botones de acción */}
                      <div className="flex gap-1.5 pt-2 border-t border-[#F0F4FA]">
                        <button
                          type="button"
                          onClick={() => setRecipePreviewModal(p)}
                          className="flex items-center justify-center gap-1 text-[#6B7A8D] hover:text-[#0B1929] bg-gray-50 hover:bg-gray-100 border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                          title="Ver receta completa"
                        >
                          <Eye size={12} />
                          <span>Ver</span>
                        </button>
                        {isSuperadmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditPlatillo(p)}
                              className="flex-1 flex justify-center items-center gap-1 border border-[#E2E8F0] text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 bg-white rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Edit2 size={12} /> Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletePlatilloModal(p)}
                              className="flex justify-center items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* VISTA 3: INGREDIENTES CULINARIOS */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {subtab === "ingredientes" && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="flex gap-2.5 flex-wrap p-3.5 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm items-center">
            <div className="relative flex-1 min-w-[160px] max-w-[240px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7A8D]" />
              <input
                value={busquedaIng}
                onChange={e => setBusquedaIng(e.target.value)}
                placeholder="Buscar ingrediente…"
                className="w-full bg-white text-[#0B1929] border border-[#E2E8F0] rounded-xl pl-9 pr-3 py-2 text-[13px] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all font-['Inter',sans-serif]"
              />
            </div>
            <CustomSelect
              value={filtroCatIng}
              onChange={setFiltroCatIng}
              options={CATEGORIAS_INGREDIENTES.map(c => ({ value: c.id, label: `${c.icono} ${c.nombre}` }))}
              className="min-w-[180px]"
            />
            {(filtroCatIng !== "todos" || busquedaIng) && (
              <button
                onClick={() => { setBusquedaIng(""); setFiltroCatIng("todos"); }}
                className="bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl px-3 py-2 text-red-500 text-xs cursor-pointer font-semibold font-['Inter',sans-serif] transition-colors flex items-center gap-1"
              >
                <X size={14} /> Limpiar
              </button>
            )}
          </div>

          {/* Grid de Ingredientes */}
          {ingredientesFiltrados.length === 0 ? (
            <div className="text-center py-20 text-[#6B7A8D] bg-white rounded-2xl border border-[#E2E8F0] shadow-sm">
              <Apple size={48} className="mx-auto mb-4 opacity-20" />
              <div className="text-[16px] font-semibold mb-1.5 text-[#0B1929]">
                {ingredientes.length === 0 ? "El catálogo de ingredientes está vacío" : "No hay ingredientes que coincidan"}
              </div>
              <div className="text-[13px] text-[#6B7A8D]">
                {ingredientes.length === 0 && isSuperadmin ? "Agrega el primer ingrediente con el botón de arriba" : "Intenta con otros filtros"}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3.5">
              {ingredientesFiltrados.map((ing) => {
                const catInfo = CATEGORIAS_INGREDIENTES.find(c => c.id === ing.categoria);

                return (
                  <div
                    key={ing.id}
                    className="group bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-3.5 text-center relative transition-all hover:shadow-md flex flex-col justify-between"
                  >
                    <div>
                      {/* Imagen centrada y nítida */}
                      <div className="w-20 h-20 mx-auto mb-2 flex items-center justify-center bg-[#F8FAFC] rounded-2xl p-2 border border-[#F0F4FA] group-hover:scale-105 transition-transform duration-300">
                        {ing.foto ? (
                          <img
                            src={ing.foto}
                            alt={ing.nombre}
                            className="max-h-full max-w-full object-contain drop-shadow-xs"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=150&auto=format&fit=crop&q=60";
                            }}
                          />
                        ) : (
                          <Apple className="w-8 h-8 text-slate-300" />
                        )}
                      </div>

                      <h4 className="font-bold text-[13px] text-[#0B1929] leading-snug line-clamp-2 mb-1.5">
                        {ing.nombre}
                      </h4>

                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-[#475569] mb-2">
                        {catInfo ? `${catInfo.icono} ${catInfo.nombre}` : ing.categoria}
                      </span>
                    </div>

                    {isSuperadmin && (
                      <div className="flex gap-1.5 pt-2 border-t border-[#F8FAFC]">
                        <button
                          type="button"
                          onClick={() => openEditIng(ing)}
                          className="flex-1 flex justify-center items-center gap-1 border border-[#E2E8F0] text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 bg-white rounded-lg px-2 py-1 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Edit2 size={11} /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteIngModal(ing)}
                          className="flex justify-center items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-2 py-1 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* MODALES DE CREACIÓN Y EDICIÓN */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}

      {/* Modal Ejercicio */}
      {showEjModal && (
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex justify-between items-center">
              <h3 className="font-bold text-lg text-[#0B1929] flex items-center gap-2">
                {editEj ? <><Edit2 size={20} className="text-[var(--brand-primary)]" /> Editar ejercicio</> : <><Plus size={20} className="text-[var(--brand-primary)]" /> Nuevo ejercicio</>}
              </h3>
              <button onClick={() => setShowEjModal(false)} className="text-[#6B7A8D] hover:text-[#0B1929] transition-colors"><X size={20} /></button>
            </div>

            <div className="p-5 overflow-y-auto flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#0B1929] mb-1.5">Nombre del ejercicio</label>
                <input value={formEj.nombre} onChange={e => setFormEj(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej. Press de banca inclinado" className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#0B1929] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0B1929] mb-1.5">Grupo muscular</label>
                <CustomSelect
                  value={formEj.grupo_muscular}
                  onChange={v => setFormEj(p => ({ ...p, grupo_muscular: v }))}
                  options={GRUPOS}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0B1929] mb-1.5">GIF / Video del ejercicio</label>
                <div className="border border-dashed border-gray-300 rounded-xl p-5 text-center bg-gray-50">
                  {formEj.gif_url ? (
                    <div>
                      <img src={formEj.gif_url} alt="preview" className="max-h-[140px] rounded-lg mx-auto mb-3 shadow-sm object-cover" />
                      <div>
                        <button onClick={() => setFormEj(p => ({ ...p, gif_url: "" }))} className="text-sm px-3 py-1.5 border border-[#E2E8F0] text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 bg-white rounded-lg font-semibold transition-colors">
                          Cambiar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Video size={36} className="mx-auto mb-2 text-gray-300" />
                      <div className="text-[13px] text-[#6B7A8D] mb-3">Sube un GIF o video MP4</div>
                      <input
                        id="gif-upload"
                        type="file"
                        accept="image/gif,video/mp4,image/png,image/jpg,image/jpeg"
                        className="hidden"
                        onChange={e => e.target.files[0] && uploadGif(e.target.files[0])}
                      />
                      <label
                        htmlFor="gif-upload"
                        className="inline-block px-4 py-2 bg-[var(--brand-primary)]/10 hover:bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 rounded-lg font-semibold text-[12px] cursor-pointer transition-colors shadow-sm"
                      >
                        {uploadingEj ? "Subiendo..." : "Seleccionar archivo"}
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-[#E2E8F0] flex gap-2.5 justify-end bg-gray-50">
              <button onClick={() => setShowEjModal(false)} className="px-4 py-2 border border-[#E2E8F0] bg-white hover:bg-gray-50 text-[#6B7A8D] rounded-xl font-semibold text-sm transition-colors">
                Cancelar
              </button>
              <button onClick={saveEj} disabled={savingEj || uploadingEj} className="px-4 py-2 bg-[var(--brand-primary)] hover:opacity-90 text-white rounded-xl font-semibold text-sm shadow-sm transition-opacity disabled:opacity-50 flex items-center gap-2">
                {savingEj ? "Guardando..." : "Guardar ejercicio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Platillo */}
      {showPlatilloModal && (
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex justify-between items-center">
              <h3 className="font-bold text-lg text-[#0B1929] flex items-center gap-2">
                {editPlatillo ? <><Edit2 size={20} className="text-[var(--brand-primary)]" /> Editar platillo</> : <><Plus size={20} className="text-[var(--brand-primary)]" /> Nuevo platillo</>}
              </h3>
              <button onClick={() => setShowPlatilloModal(false)} className="text-[#6B7A8D] hover:text-[#0B1929] transition-colors"><X size={20} /></button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-1.5">Nombre del platillo</label>
                <input
                  value={formPlatillo.nombre}
                  onChange={e => setFormPlatillo(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej. Salmón a la plancha con espárragos y arroz integral"
                  className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#0B1929] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-1.5">Categoría de comida</label>
                <CustomSelect
                  value={formPlatillo.categoria}
                  onChange={v => setFormPlatillo(p => ({ ...p, categoria: v }))}
                  options={CATEGORIAS_PLATILLOS.filter(c => c.id !== "todos").map(c => ({ value: c.id, label: `${c.icono} ${c.nombre}` }))}
                />
              </div>

              {/* Grid de 4 Macros */}
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-[#E2E8F0]">
                <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider block mb-2">
                  Valores Nutricionales de Referencia
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Calorías (kcal)</label>
                    <input
                      type="number"
                      value={formPlatillo.calorias}
                      onChange={e => setFormPlatillo(p => ({ ...p, calorias: e.target.value }))}
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-2.5 py-1.5 text-sm font-bold text-[#0B1929] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-red-600 mb-1">Proteína (g)</label>
                    <input
                      type="number"
                      value={formPlatillo.proteina}
                      onChange={e => setFormPlatillo(p => ({ ...p, proteina: e.target.value }))}
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-2.5 py-1.5 text-sm font-bold text-[#0B1929] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-600 mb-1">Carbos (g)</label>
                    <input
                      type="number"
                      value={formPlatillo.carbohidratos}
                      onChange={e => setFormPlatillo(p => ({ ...p, carbohidratos: e.target.value }))}
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-2.5 py-1.5 text-sm font-bold text-[#0B1929] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-600 mb-1">Grasas (g)</label>
                    <input
                      type="number"
                      value={formPlatillo.grasas}
                      onChange={e => setFormPlatillo(p => ({ ...p, grasas: e.target.value }))}
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-2.5 py-1.5 text-sm font-bold text-[#0B1929] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>
                </div>
              </div>

              {/* Imagen / Fotografía */}
              <div>
                <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-1.5">Fotografía del Platillo</label>
                <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center bg-gray-50 flex flex-col items-center gap-3">
                  {formPlatillo.foto_url ? (
                    <div className="w-full flex flex-col items-center">
                      <img src={formPlatillo.foto_url} alt="preview" className="h-28 w-auto max-w-full rounded-xl object-cover shadow-sm mb-2" />
                      <button
                        type="button"
                        onClick={() => setFormPlatillo(p => ({ ...p, foto_url: "" }))}
                        className="text-xs px-3 py-1 border border-[#E2E8F0] text-red-600 bg-white hover:bg-red-50 rounded-lg font-semibold transition-colors"
                      >
                        Quitar fotografía
                      </button>
                    </div>
                  ) : (
                    <div className="w-full space-y-2">
                      <ImageIcon size={32} className="mx-auto text-gray-300" />
                      <div className="text-[12px] text-[#6B7A8D]">Sube una foto o pega un enlace web directo</div>
                      <div className="flex gap-2 justify-center flex-wrap">
                        <input
                          id="platillo-foto-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => e.target.files[0] && uploadPlatilloFoto(e.target.files[0])}
                        />
                        <label
                          htmlFor="platillo-foto-upload"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-primary)]/10 hover:bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 rounded-lg font-semibold text-xs cursor-pointer transition-colors shadow-2xs"
                        >
                          <Upload size={13} /> {uploadingPlatillo ? "Subiendo..." : "Subir archivo"}
                        </label>
                      </div>
                    </div>
                  )}
                  <input
                    type="url"
                    value={formPlatillo.foto_url}
                    onChange={e => setFormPlatillo(p => ({ ...p, foto_url: e.target.value }))}
                    placeholder="O pega URL de imagen (https://...)"
                    className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#0B1929] outline-none focus:border-[var(--brand-primary)] transition-all"
                  />
                </div>
              </div>

              {/* Receta y preparación */}
              <div>
                <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-1.5">Receta / Instrucciones de Preparación</label>
                <textarea
                  rows={4}
                  value={formPlatillo.texto}
                  onChange={e => setFormPlatillo(p => ({ ...p, texto: e.target.value }))}
                  placeholder="Detalla los ingredientes exactos, gramajes y pasos de cocción..."
                  className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3 text-xs text-[#0B1929] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all leading-relaxed"
                />
              </div>

              {/* Palabras clave */}
              <div>
                <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-1.5">Palabras clave de búsqueda (opcional)</label>
                <input
                  value={formPlatillo.keywordsStr}
                  onChange={e => setFormPlatillo(p => ({ ...p, keywordsStr: e.target.value }))}
                  placeholder="Ej. salmon, pescado, arroz, espárragos, omega 3"
                  className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0B1929] outline-none focus:border-[var(--brand-primary)] transition-all"
                />
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-[#E2E8F0] flex gap-2.5 justify-end bg-gray-50">
              <button
                type="button"
                onClick={() => setShowPlatilloModal(false)}
                className="px-4 py-2 border border-[#E2E8F0] bg-white hover:bg-gray-50 text-[#6B7A8D] rounded-xl font-semibold text-sm transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={savePlatillo}
                disabled={savingPlatillo || uploadingPlatillo}
                className="px-4 py-2 bg-[var(--brand-primary)] hover:opacity-90 text-white rounded-xl font-semibold text-sm shadow-sm transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {savingPlatillo ? "Guardando..." : "Guardar platillo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ingrediente */}
      {showIngModal && (
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex justify-between items-center">
              <h3 className="font-bold text-lg text-[#0B1929] flex items-center gap-2">
                {editIng ? <><Edit2 size={20} className="text-[var(--brand-primary)]" /> Editar ingrediente</> : <><Plus size={20} className="text-[var(--brand-primary)]" /> Nuevo ingrediente</>}
              </h3>
              <button onClick={() => setShowIngModal(false)} className="text-[#6B7A8D] hover:text-[#0B1929] transition-colors"><X size={20} /></button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-1.5">Nombre del ingrediente</label>
                <input
                  value={formIng.nombre}
                  onChange={e => setFormIng(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej. Pechuga de pollo deshebrada"
                  className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#0B1929] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-1.5">Grupo / Categoría</label>
                <CustomSelect
                  value={formIng.categoria}
                  onChange={v => setFormIng(p => ({ ...p, categoria: v }))}
                  options={CATEGORIAS_INGREDIENTES.filter(c => c.id !== "todos").map(c => ({ value: c.id, label: `${c.icono} ${c.nombre}` }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-1.5">Fotografía o Icono</label>
                <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center bg-gray-50 flex flex-col items-center gap-3">
                  {formIng.foto ? (
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 bg-white rounded-2xl p-2 border border-[#E2E8F0] flex items-center justify-center mb-2 shadow-2xs">
                        <img src={formIng.foto} alt="preview" className="max-h-full max-w-full object-contain" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormIng(p => ({ ...p, foto: "" }))}
                        className="text-xs px-2.5 py-1 border border-[#E2E8F0] text-red-600 bg-white hover:bg-red-50 rounded-lg font-semibold transition-colors"
                      >
                        Quitar imagen
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Apple size={32} className="mx-auto text-gray-300" />
                      <div className="text-[12px] text-[#6B7A8D]">Sube una imagen o pega URL directa</div>
                      <input
                        id="ing-foto-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => e.target.files[0] && uploadIngredienteFoto(e.target.files[0])}
                      />
                      <label
                        htmlFor="ing-foto-upload"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-primary)]/10 hover:bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 rounded-lg font-semibold text-xs cursor-pointer transition-colors shadow-2xs"
                      >
                        <Upload size={13} /> {uploadingIng ? "Subiendo..." : "Subir archivo"}
                      </label>
                    </div>
                  )}
                  <input
                    type="url"
                    value={formIng.foto}
                    onChange={e => setFormIng(p => ({ ...p, foto: e.target.value }))}
                    placeholder="O pega URL (https://...)"
                    className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#0B1929] outline-none focus:border-[var(--brand-primary)] transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-[#E2E8F0] flex gap-2.5 justify-end bg-gray-50">
              <button
                type="button"
                onClick={() => setShowIngModal(false)}
                className="px-4 py-2 border border-[#E2E8F0] bg-white hover:bg-gray-50 text-[#6B7A8D] rounded-xl font-semibold text-sm transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveIng}
                disabled={savingIng || uploadingIng}
                className="px-4 py-2 bg-[var(--brand-primary)] hover:opacity-90 text-white rounded-xl font-semibold text-sm shadow-sm transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {savingIng ? "Guardando..." : "Guardar ingrediente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL PREVIEW DE RECETA / DETALLE DE PLATILLO */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {recipePreviewModal && (
        <div
          onClick={() => setRecipePreviewModal(null)}
          className="fixed inset-0 bg-[#0B1929]/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in"
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden border border-[#E2E8F0] shadow-2xl relative flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header con Imagen */}
            <div className="h-52 bg-slate-100 relative overflow-hidden shrink-0">
              {recipePreviewModal.foto_url ? (
                <img
                  src={recipePreviewModal.foto_url}
                  alt={recipePreviewModal.nombre}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Utensils size={48} />
                </div>
              )}
              <button
                onClick={() => setRecipePreviewModal(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#0B1929]/60 hover:bg-[#0B1929] text-white flex items-center justify-center transition-colors cursor-pointer shadow-lg"
              >
                <X size={18} />
              </button>
              <div className="absolute bottom-3 left-3">
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#0B1929]/80 text-white backdrop-blur-xs shadow-md flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>{recipePreviewModal.calorias || 0} kcal</span>
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-primary)] block mb-1">
                  {CATEGORIAS_PLATILLOS.find(c => c.id === recipePreviewModal.categoria)?.nombre || recipePreviewModal.categoria}
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-[#0B1929] leading-snug">
                  {recipePreviewModal.nombre}
                </h3>
              </div>

              {/* Macro breakdown */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-2xl border border-[#E2E8F0] text-center">
                <div>
                  <span className="text-[10px] text-red-600 block font-semibold uppercase">Proteína</span>
                  <span className="text-base font-extrabold text-red-950">{recipePreviewModal.proteina || 0}g</span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-600 block font-semibold uppercase">Carbos</span>
                  <span className="text-base font-extrabold text-amber-950">{recipePreviewModal.carbohidratos || 0}g</span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 block font-semibold uppercase">Grasas</span>
                  <span className="text-base font-extrabold text-emerald-950">{recipePreviewModal.grasas || 0}g</span>
                </div>
              </div>

              {/* Recipe instructions */}
              <div>
                <h4 className="text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                  <span>Instrucciones y Gramajes</span>
                </h4>
                <div className="p-4 rounded-2xl bg-blue-50/40 border border-blue-100/70 text-xs sm:text-[13px] text-[#334155] leading-relaxed whitespace-pre-line">
                  {recipePreviewModal.texto || "No se han especificado instrucciones de preparación para este platillo."}
                </div>
              </div>

              {/* Keywords */}
              {Array.isArray(recipePreviewModal.keywords) && recipePreviewModal.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {recipePreviewModal.keywords.map((kw, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 text-[#64748B] font-medium">
                      #{kw}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#E2E8F0] bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setRecipePreviewModal(null)}
                className="px-5 py-2 bg-white hover:bg-gray-100 border border-[#E2E8F0] text-[#0B1929] rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview Ejercicio (GIF / Video) */}
      {previewEj && (
        <div
          onClick={() => setPreviewEj(null)}
          className="fixed inset-0 bg-[#0B1929]/40 backdrop-blur-sm z-[200] flex items-center justify-center p-5"
        >
          <div
            className="animate-in bg-white rounded-2xl p-6 max-w-[440px] w-full text-center border border-[#E2E8F0] shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setPreviewEj(null)} className="absolute top-4 right-4 text-[#6B7A8D] hover:text-[#0B1929] transition-colors"><X size={20} /></button>
            <img
              src={previewEj.gif_url}
              alt={previewEj.nombre}
              className="w-full rounded-xl mb-4 shadow-sm"
            />
            <div className="font-bold text-[18px] text-[#0B1929] mb-2 font-['Space_Grotesk',sans-serif]">
              {previewEj.nombre}
            </div>
            <div className="flex gap-1.5 justify-center mb-4">
              <span className="px-2.5 py-1 rounded-md text-xs font-medium" style={{ backgroundColor: `${groupColors[previewEj.grupo_muscular] || "#38bdf8"}20`, color: groupColors[previewEj.grupo_muscular] || "#38bdf8" }}>
                {previewEj.grupo_muscular}
              </span>
            </div>
            <button
              onClick={() => setPreviewEj(null)}
              className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-[#0B1929] rounded-xl text-[13px] font-semibold font-['Inter',sans-serif] transition-colors border border-gray-200 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* MODALES DE CONFIRMACIÓN DE ELIMINACIÓN */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={Boolean(deleteEjModal)}
        onClose={() => setDeleteEjModal(null)}
        onConfirm={executeDeleteEj}
        title={`¿Eliminar "${deleteEjModal?.nombre}"?`}
        description="Esta acción eliminará el ejercicio de la biblioteca global permanentemente."
        confirmText="Eliminar"
        cancelText="Cancelar"
      />

      <ConfirmModal
        isOpen={Boolean(deletePlatilloModal)}
        onClose={() => setDeletePlatilloModal(null)}
        onConfirm={executeDeletePlatillo}
        title={`¿Eliminar "${deletePlatilloModal?.nombre}"?`}
        description="Esta acción eliminará el platillo y su receta del catálogo global permanentemente."
        confirmText="Eliminar"
        cancelText="Cancelar"
      />

      <ConfirmModal
        isOpen={Boolean(deleteIngModal)}
        onClose={() => setDeleteIngModal(null)}
        onConfirm={executeDeleteIng}
        title={`¿Eliminar "${deleteIngModal?.nombre}"?`}
        description="Esta acción eliminará el ingrediente del catálogo culinario global permanentemente."
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}
