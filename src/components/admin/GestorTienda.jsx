import { useState, useEffect, useRef, useMemo } from "react";
import { dbPeek, dbGet, dbPost, dbPatch, dbDel, storageUpload } from "../../lib/supabase";
import {
  Plus, Search, Trash2, Edit2, Image as ImageIcon, Filter, Tag, X,
  ShoppingBag, Settings, MessageCircle, Globe, Video, ExternalLink,
  Smartphone, CheckCircle2, Save, Upload, Link2, Share2, Mail
} from "lucide-react";
import { useBackButton } from "../../lib/backButtonHandler";
import { ConfirmModal } from "../ui/ConfirmModal";
import { CustomSelect } from "../ui/CustomSelect";
import PhotoUploadBox from "../ui/PhotoUploadBox";
import {
  peekLandingConfig,
  fetchLandingConfig,
  saveLandingConfig,
  formatWhatsAppUrl
} from "../../lib/landingConfig";

export default function GestorTienda({ setMsg }) {
  // ── PESTAÑA PRINCIPAL (Catálogo vs Ajustes) ──
  const [activeTab, setActiveTab] = useState("catalogo"); // "catalogo" | "ajustes"

  // ── CATÁLOGO DE PRODUCTOS ──
  const _peekProds = dbPeek("productos?order=created_at.desc");
  const [productos, setProductos] = useState(() => Array.isArray(_peekProds) ? _peekProds : []);
  const [loading, setLoading] = useState(() => _peekProds === null);
  const hasLoadedRef = useRef(_peekProds !== null);
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useBackButton(showModal, () => setShowModal(false), 20);

  const [editProd, setEditProd] = useState(null);
  const [form, setForm] = useState({
    nombre: "",
    subtitulo: "",
    precio: "",
    categoria: "suplemento",
    variantes: "",
    badge: "",
    imagen_url: "",
    enlace_externo: ""
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [filtroCat, setFiltroCat] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");

  // ── AJUSTES DE TIENDA Y LANDING ──
  const [config, setConfig] = useState(() => peekLandingConfig());
  const [savingConfig, setSavingConfig] = useState(false);
  const [uploadingScreen, setUploadingScreen] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [newScreenTitle, setNewScreenTitle] = useState("");
  const [newAdvisorName, setNewAdvisorName] = useState("");
  const [newAdvisorPhone, setNewAdvisorPhone] = useState("");
  const [uploadingQr, setUploadingQr] = useState(false);

  const loadProductos = async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const rows = await dbGet('productos?order=created_at.desc');
      if (Array.isArray(rows)) setProductos(rows);
    } catch (e) {
      console.error(e);
      setMsg("Error al cargar productos. ¿Ejecutaste el script setup_store.sql?");
    }
    hasLoadedRef.current = true;
    setLoading(false);
  };

  useEffect(() => {
    loadProductos();
    fetchLandingConfig().then(cfg => {
      if (cfg) setConfig(cfg);
    });

    let timer = null;
    const onCacheUpdated = (ev) => {
      const table = ev?.detail?.table;
      if (table && !["productos", "*"].includes(table)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => loadProductos(), 250);
    };

    const onConfigUpdated = (ev) => {
      if (ev?.detail) setConfig(ev.detail);
    };

    window.addEventListener("flux:cache-updated", onCacheUpdated);
    window.addEventListener("flux:synced", onCacheUpdated);
    window.addEventListener("flux:landing-config-updated", onConfigUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("flux:cache-updated", onCacheUpdated);
      window.removeEventListener("flux:synced", onCacheUpdated);
      window.removeEventListener("flux:landing-config-updated", onConfigUpdated);
    };
  }, []);

  const uploadImg = async (file) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fname = `producto_${Date.now()}.${ext}`;
      const url = await storageUpload("ejercicios", fname, file);
      setForm(prev => ({ ...prev, imagen_url: url }));
      setMsg("Imagen subida correctamente");
    } catch (e) {
      setMsg("Error subiendo imagen: " + e.message);
    }
    setUploading(false);
  };

  const saveProducto = async () => {
    if (!form.nombre || !form.precio) {
      setMsg("El nombre y precio son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const varsArr = form.variantes ? form.variantes.split(",").map(s => s.trim()).filter(Boolean) : [];

      const payload = {
        nombre: form.nombre,
        subtitulo: form.subtitulo,
        precio: parseFloat(form.precio) || 0,
        categoria: form.categoria,
        badge: form.badge,
        imagen_url: form.imagen_url,
        variantes: varsArr
      };

      let prodId = editProd?.id;
      if (editProd) {
        await dbPatch(`productos?id=eq.${editProd.id}`, payload);
        setMsg("Producto actualizado");
      } else {
        const created = await dbPost('productos', payload);
        if (Array.isArray(created) && created[0]) prodId = created[0].id;
        setMsg("Producto creado");
      }

      // Si se configuró un enlace externo individual, guardarlo en la config
      if (prodId) {
        const currentLinks = { ...(config.external_links || {}) };
        if (form.enlace_externo && form.enlace_externo.trim()) {
          currentLinks[prodId] = form.enlace_externo.trim();
        } else {
          delete currentLinks[prodId];
        }
        const updatedCfg = await saveLandingConfig({ ...config, external_links: currentLinks });
        setConfig(updatedCfg);
      }

      setShowModal(false);
      setEditProd(null);
      loadProductos();
    } catch (e) {
      setMsg("Error al guardar: " + e.message);
    }
    setSaving(false);
  };

  const deleteProd = (p) => {
    setConfirmDelete({
      title: `¿Eliminar "${p.nombre}"?`,
      description: "Este producto se eliminará del catálogo de la tienda.",
      confirmText: "Eliminar producto",
      danger: true,
      icon: "trash",
      onConfirm: async () => {
        try {
          await dbDel(`productos?id=eq.${p.id}`);
          if (config.external_links && config.external_links[p.id]) {
            const nextLinks = { ...config.external_links };
            delete nextLinks[p.id];
            const updated = await saveLandingConfig({ ...config, external_links: nextLinks });
            setConfig(updated);
          }
          setMsg("Producto eliminado");
          setConfirmDelete(null);
          loadProductos();
        } catch (e) {
          setMsg("Error al eliminar: " + e.message);
        }
      }
    });
  };

  // ── GESTIÓN DE AJUSTES GLOBALES ──
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const saved = await saveLandingConfig(config);
      setConfig(saved);
      setMsg("✓ Ajustes de Tienda y Redes guardados correctamente");
    } catch (e) {
      setMsg("Error guardando ajustes: " + e.message);
    }
    setSavingConfig(false);
  };

  const handleUploadScreenshot = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingScreen(true);
    try {
      const ext = file.name.split(".").pop();
      const fname = `app_screenshot_${Date.now()}.${ext}`;
      const url = await storageUpload("ejercicios", fname, file);

      const newItem = {
        id: `screen_${Date.now()}`,
        url,
        title: newScreenTitle.trim() || `Captura ${((config.app_screenshots || []).length + 1)}`
      };

      const updatedScreens = [...(config.app_screenshots || []), newItem];
      const updatedConfig = { ...config, app_screenshots: updatedScreens };
      setConfig(updatedConfig);
      await saveLandingConfig(updatedConfig);
      setNewScreenTitle("");
      setMsg("✓ Captura añadida a la previsualización de la app");
    } catch (err) {
      setMsg("Error al subir captura: " + err.message);
    }
    setUploadingScreen(false);
    e.target.value = "";
  };

  const handleRemoveScreenshot = async (screenId) => {
    const updatedScreens = (config.app_screenshots || []).filter(s => s.id !== screenId);
    const updatedConfig = { ...config, app_screenshots: updatedScreens };
    setConfig(updatedConfig);
    await saveLandingConfig(updatedConfig);
    setMsg("Captura eliminada");
  };

  const handleUploadVideo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 80 * 1024 * 1024) {
      setMsg("El video supera los 80MB. Te sugerimos optimizar o comprimir el video para una carga web ultra rápida.");
      return;
    }
    setUploadingVideo(true);
    try {
      const ext = file.name.split(".").pop();
      const fname = `landing_showcase_video_${Date.now()}.${ext}`;
      const url = await storageUpload("ejercicios", fname, file, { timeout: 120000 });
      const updatedConfig = { ...config, app_video_url: url };
      setConfig(updatedConfig);
      await saveLandingConfig(updatedConfig);
      setMsg("✓ Video de la aplicación subido y vinculado correctamente");
    } catch (err) {
      setMsg("Error al subir video: " + err.message);
    }
    setUploadingVideo(false);
    e.target.value = "";
  };

  const handleRemoveVideo = () => {
    setConfirmDelete({
      title: "¿Eliminar video del showcase?",
      description: "El smartphone del landing volverá a mostrar las capturas o la interfaz simulada.",
      confirmText: "Eliminar video",
      danger: true,
      icon: "trash",
      onConfirm: async () => {
        const updatedConfig = { ...config, app_video_url: "" };
        setConfig(updatedConfig);
        await saveLandingConfig(updatedConfig);
        setMsg("Video del showcase eliminado");
        setConfirmDelete(null);
      }
    });
  };

  // ── GESTIÓN DE MÚLTIPLES NÚMEROS DE WHATSAPP ──
  const handleAddAdvisor = () => {
    const cleanPhone = newAdvisorPhone.trim().replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setMsg("Ingresa un número de WhatsApp válido (mínimo 10 dígitos)");
      return;
    }
    const label = newAdvisorName.trim() || `Línea ${(config.whatsapp_ventas_numeros || []).length + 1}`;
    const newAdv = {
      id: `adv_${Date.now()}`,
      nombre: label,
      numero: cleanPhone,
      activo: true
    };
    const currentList = Array.isArray(config.whatsapp_ventas_numeros) ? config.whatsapp_ventas_numeros : [];
    const updatedList = [...currentList, newAdv];
    const updatedConfig = {
      ...config,
      whatsapp_ventas_numeros: updatedList,
      whatsapp_ventas: updatedList[0]?.numero || cleanPhone
    };
    setConfig(updatedConfig);
    setNewAdvisorName("");
    setNewAdvisorPhone("");
    setMsg(`✓ Número añadido: ${label}`);
  };

  const handleToggleAdvisor = (id) => {
    const currentList = Array.isArray(config.whatsapp_ventas_numeros) ? config.whatsapp_ventas_numeros : [];
    const updatedList = currentList.map(a => a.id === id ? { ...a, activo: !a.activo } : a);
    const activeFirst = updatedList.find(a => a.activo);
    const updatedConfig = {
      ...config,
      whatsapp_ventas_numeros: updatedList,
      whatsapp_ventas: activeFirst ? activeFirst.numero : config.whatsapp_ventas
    };
    setConfig(updatedConfig);
  };

  const handleRemoveAdvisor = (id) => {
    const currentList = Array.isArray(config.whatsapp_ventas_numeros) ? config.whatsapp_ventas_numeros : [];
    if (currentList.length <= 1) {
      setMsg("Debe haber al menos un número de ventas configurado.");
      return;
    }
    const updatedList = currentList.filter(a => a.id !== id);
    const updatedConfig = {
      ...config,
      whatsapp_ventas_numeros: updatedList,
      whatsapp_ventas: updatedList[0]?.numero || config.whatsapp_ventas
    };
    setConfig(updatedConfig);
    setMsg("Número eliminado");
  };

  // ── SUBIDA DE QR PERSONALIZADO ──
  const handleUploadCustomQr = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    try {
      const ext = file.name.split(".").pop();
      const fname = `custom_qr_${Date.now()}.${ext}`;
      const url = await storageUpload("logos", fname, file);
      const updatedConfig = { ...config, qr_imagen_url: url };
      setConfig(updatedConfig);
      await saveLandingConfig(updatedConfig);
      setMsg("✓ Imagen personalizada del Código QR subida");
    } catch (err) {
      setMsg("Error al subir QR: " + err.message);
    }
    setUploadingQr(false);
    e.target.value = "";
  };

  const handleRemoveCustomQr = async () => {
    const updatedConfig = { ...config, qr_imagen_url: "" };
    setConfig(updatedConfig);
    await saveLandingConfig(updatedConfig);
    setMsg("Imagen personalizada eliminada. Se usará el QR dinámico.");
  };

  const prodPills = useMemo(() => [
    { key: "Todas", label: `Todas (${productos.length})` },
    { key: "suplemento", label: `Suplementos (${productos.filter(p => p.categoria === "suplemento").length})` },
    { key: "ropa", label: `Ropa (${productos.filter(p => p.categoria === "ropa").length})` }
  ], [productos]);

  const filtered = productos.filter(p => {
    if (filtroCat !== "Todas" && p.categoria !== filtroCat) return false;
    if (busqueda && !p.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="w-full flex-1 flex flex-col">
      {/* ── Cabecera Principal con Barra de Búsqueda Integrada ── */}
      <div className="px-4 md:px-8 pt-3 pb-2.5 md:pt-8 md:pb-6 bg-white border-b-0 md:border-b border-[#E2E8F0] flex flex-col gap-3 md:gap-4">
        <div>
          <p className="hidden md:block text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">
            Panel de Administración
          </p>
          <h1 className="text-lg md:text-2xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
            Gestor de Tienda
          </h1>
          <p className="hidden md:block text-sm text-[#6B7A8D] mt-1">
            Administra el catálogo de productos, suplementos y ajustes de la tienda
          </p>
        </div>

        {/* Fila de Búsqueda de ancho completo + Botón de Acción a la derecha (solo visible en catálogo) */}
        {activeTab === "catalogo" && (
          <div className="flex items-center gap-2 sm:gap-3 w-full">
            <div className="relative flex-1 min-w-0">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA5B0]" />
              <input
                type="text"
                placeholder="Buscar producto por nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-8 py-2 md:py-2.5 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl text-xs sm:text-[13px] text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] focus:bg-white focus:ring-1 focus:ring-[var(--brand-primary)] placeholder:text-[#9BA5B0] transition-all font-['Inter',sans-serif]"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9BA5B0] hover:text-[#0B1929] p-0.5 rounded transition-colors cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setEditProd(null);
                setForm({
                  nombre: "", subtitulo: "", precio: "", categoria: "suplemento",
                  variantes: "", badge: "", imagen_url: "", enlace_externo: ""
                });
                setShowModal(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 bg-[var(--brand-primary)] text-white h-[38px] md:h-[42px] px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all shrink-0 cursor-pointer"
              title="Nuevo Producto"
              aria-label="Nuevo Producto"
            >
              <Plus size={18} strokeWidth={2.5} className="shrink-0" />
              <span className="hidden sm:inline">Nuevo Producto</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Fila 1: Sub-tabs Switch Homologado ── */}
      <div className="flex items-center gap-2 overflow-x-auto scroll-hide px-4 md:px-8 pt-2 md:pt-4 pb-1">
        <div className="flex gap-1 bg-[#F0F4FA] p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("catalogo")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "catalogo"
                ? "bg-white text-[var(--brand-primary)] shadow-sm font-bold"
                : "text-[#6B7A8D] hover:text-[#0B1929]"
            }`}
          >
            <ShoppingBag size={16} />
            <span>Catálogo</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === "catalogo" ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]" : "bg-white/60 text-[#6B7A8D]"
            }`}>
              {productos.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ajustes")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "ajustes"
                ? "bg-white text-[var(--brand-primary)] shadow-sm font-bold"
                : "text-[#6B7A8D] hover:text-[#0B1929]"
            }`}
          >
            <Settings size={16} />
            <span>Ajustes & Redes</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ── SUB-PESTAÑA 1: CATÁLOGO DE PRODUCTOS ── */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "catalogo" && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* ── Fila 2: Filtros en Píldoras Horizontales con Conteo ── */}
          <div className="flex gap-2 overflow-x-auto scroll-hide px-4 md:px-8 py-2.5">
            {prodPills.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => setFiltroCat(p.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                  filtroCat === p.key
                    ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm"
                    : "bg-white text-[#6B7A8D] border-[#E2E8F0] hover:bg-[#E8F1FB]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex-1 pt-1">
            {loading ? (
              <div className="flex justify-center py-12 text-[#6B7A8D]">Cargando catálogo...</div>
            ) : filtered.length === 0 ? (
              <div className="mx-4 md:mx-8 text-center py-16 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-8">
                <ShoppingBag className="w-12 h-12 text-[#E2E8F0] mx-auto mb-3" />
                <h3 className="text-[#0B1929] font-bold text-base">Sin resultados</h3>
                <p className="text-[#6B7A8D] text-xs sm:text-sm mt-1">No se encontraron productos que coincidan.</p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 px-4 md:px-8 pb-28 md:pb-8">
                {filtered.map(p => {
                  const extLink = config.external_links?.[p.id];
                  return (
                    <div
                      key={p.id}
                      className="group bg-white border border-[#E2E8F0] shadow-sm rounded-2xl overflow-hidden relative transition-all hover:shadow-md flex flex-col justify-between"
                    >
                      {/* Media Area */}
                      <div className="h-[145px] bg-[#F8FAFC] relative overflow-hidden flex items-center justify-center border-b border-[#F0F4FA]">
                        {p.imagen_url ? (
                          <img
                            src={p.imagen_url}
                            alt={p.nombre}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1 bg-[#F8FAFC]">
                            <ShoppingBag size={36} />
                            <span className="text-[11px] font-semibold">Sin imagen</span>
                          </div>
                        )}

                        {/* Badges superiores sobre el media */}
                        <div className="absolute top-2.5 left-2.5">
                          {p.badge ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-2xs bg-[#0B1929] text-white border-transparent">
                              {p.badge}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-2xs bg-white/95 text-[#0B1929] border-slate-200 backdrop-blur-xs flex items-center gap-1.5 capitalize">
                              <Tag size={10} className="text-[var(--brand-primary)]" />
                              <span>{p.categoria}</span>
                            </span>
                          )}
                        </div>
                        <div className="absolute top-2.5 right-2.5">
                          {extLink ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[#0B1929]/80 text-white backdrop-blur-xs flex items-center gap-1 shadow-2xs">
                              <ExternalLink size={11} className="text-blue-400" />
                              <span>Link</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[#0B1929]/80 text-white backdrop-blur-xs flex items-center gap-1 shadow-2xs">
                              <MessageCircle size={11} className="text-emerald-400" />
                              <span>WhatsApp</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="font-bold text-[14px] text-[#0B1929] leading-snug line-clamp-2 mb-1">
                            {p.nombre}
                          </h4>
                          <p className="text-xs text-[#6B7A8D] line-clamp-2 leading-relaxed mb-3">
                            {p.subtitulo || "Producto de alta calidad disponible en la tienda FLUX."}
                          </p>

                          {/* Especificaciones / Info pills homologadas */}
                          <div className="grid grid-cols-2 gap-1.5 mb-3 text-center">
                            <div className="bg-sky-50/70 border border-sky-100 rounded-lg p-1.5">
                              <span className="text-[10px] text-sky-600 block font-semibold">Precio</span>
                              <span className="text-xs font-bold text-sky-950 truncate block">${p.precio} MXN</span>
                            </div>
                            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-1.5">
                              <span className="text-[10px] text-slate-500 block font-semibold">Variantes</span>
                              <span className="text-xs font-bold text-slate-800 flex items-center justify-center gap-1">
                                {p.variantes && p.variantes.length > 0 ? (
                                  <span className="text-slate-700 font-semibold">{p.variantes.length} opc</span>
                                ) : (
                                  <span className="text-slate-400 font-normal">Estándar</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Botones de acción homologados */}
                        <div className="flex gap-1.5 pt-2 border-t border-[#F0F4FA]">
                          <button
                            type="button"
                            onClick={() => {
                              setEditProd(p);
                              setForm({
                                nombre: p.nombre,
                                subtitulo: p.subtitulo || "",
                                precio: p.precio,
                                categoria: p.categoria,
                                variantes: (p.variantes || []).join(","),
                                badge: p.badge || "",
                                imagen_url: p.imagen_url || "",
                                enlace_externo: config.external_links?.[p.id] || ""
                              });
                              setShowModal(true);
                            }}
                            className="flex-1 flex justify-center items-center gap-1 border border-[#E2E8F0] text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 bg-white rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Edit2 size={12} /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteProd(p)}
                            className="flex justify-center items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                            title="Eliminar producto"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ── SUB-PESTAÑA 2: AJUSTES DE TIENDA Y REDES ── */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "ajustes" && (
        <div className="flex-1 space-y-6 px-4 md:px-8 pb-28 md:pb-8 pt-2">
          {/* Tarjeta 1: Canal de Ventas WhatsApp (Múltiples Números y Rotación) */}
          <div className="bg-white rounded-none md:rounded-3xl p-4 sm:p-7 border-y md:border border-[#E2E8F0] shadow-none md:shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#F0F4FA]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <MessageCircle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0B1929]">Líneas de Ventas por WhatsApp (Múltiples Asesores)</h3>
                  <p className="text-xs text-[#6B7A8D] mt-0.5">
                    Configura varios números. FLUX rotará automáticamente las solicitudes para repartir los leads de forma equitativa.
                  </p>
                </div>
              </div>

              {/* Interruptor Tienda Activa */}
              <div className="flex items-center gap-3 bg-[#F7F9FC] px-4 py-2.5 rounded-2xl border border-[#E2E8F0]">
                <span className="text-xs font-bold text-[#0B1929]">Tienda Pública:</span>
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, tienda_activa: !prev.tienda_activa }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    config.tienda_activa ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.tienda_activa ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-xs font-semibold text-[#6B7A8D]">
                  {config.tienda_activa ? "Activa" : "Pausada (Próximamente)"}
                </span>
              </div>
            </div>

            {/* Lista de Números Registrados */}
            <div className="mt-5 space-y-3">
              <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">
                Números Activos de Ventas ({(config.whatsapp_ventas_numeros || []).length})
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(config.whatsapp_ventas_numeros || []).map((adv, idx) => (
                  <div key={adv.id || idx} className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    adv.activo ? 'bg-[#F7FDF9] border-emerald-200 shadow-2xs' : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${adv.activo ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        <p className="text-xs font-bold text-[#0B1929] truncate">{adv.nombre || `Asesor ${idx + 1}`}</p>
                      </div>
                      <p className="text-xs font-mono font-bold text-emerald-700 mt-0.5">+52 {adv.numero}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleAdvisor(adv.id)}
                        className={`text-[11px] font-bold px-2 py-1 rounded-lg border cursor-pointer ${
                          adv.activo
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-gray-200 text-gray-700 border-gray-300'
                        }`}
                        title={adv.activo ? "Pausar este asesor" : "Activar este asesor"}
                      >
                        {adv.activo ? "Activo" : "Pausado"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveAdvisor(adv.id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 cursor-pointer"
                        title="Eliminar número"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Formulario para Agregar Nuevo Asesor */}
              <div className="bg-[#F7F9FC] p-4 rounded-2xl border border-[#E2E8F0] mt-4 flex flex-col sm:flex-row items-end gap-3">
                <div className="flex-1 w-full">
                  <label className="block text-[11px] font-bold text-[#6B7A8D] uppercase mb-1">Nombre o Etiqueta</label>
                  <input
                    type="text"
                    value={newAdvisorName}
                    onChange={e => setNewAdvisorName(e.target.value)}
                    placeholder="Ej: Ventas Sucursal 2"
                    className="w-full bg-white border border-[#E2E8F0] focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-3 py-2 text-xs font-medium outline-none"
                  />
                </div>
                <div className="w-full sm:w-48">
                  <label className="block text-[11px] font-bold text-[#6B7A8D] uppercase mb-1">Teléfono (10 dígitos)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#9BA5B0]">+52</span>
                    <input
                      type="text"
                      value={newAdvisorPhone}
                      onChange={e => setNewAdvisorPhone(e.target.value)}
                      placeholder="7751234567"
                      className="w-full bg-white border border-[#E2E8F0] focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl pl-10 pr-3 py-2 text-xs font-mono font-bold outline-none"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddAdvisor}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Agregar Número
                </button>
              </div>

              {/* Mensaje Automático */}
              <div className="pt-3 border-t border-[#F0F4FA] mt-4">
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5">
                  Plantilla de Mensaje Automático para Pedidos
                </label>
                <input
                  type="text"
                  value={config.whatsapp_mensaje || ""}
                  onChange={e => setConfig(prev => ({ ...prev, whatsapp_mensaje: e.target.value }))}
                  placeholder="¡Hola FLUX! Me interesa adquirir [producto] por $[precio]."
                  className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 text-sm outline-none font-medium"
                />
                <p className="text-[11px] text-[#9BA5B0] mt-1.5">
                  Usa <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono">[producto]</code> y <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono">[precio]</code> para que se completen automáticamente al hacer clic.
                </p>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Distribución de la App (Google Play Store y Código QR) */}
          <div className="bg-white rounded-none md:rounded-3xl p-4 sm:p-7 border-y md:border border-[#E2E8F0] shadow-none md:shadow-xs">
            <div className="flex items-center gap-3 pb-5 border-b border-[#F0F4FA] mb-5">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Smartphone size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0B1929]">Distribución de la App (Google Play y Código QR)</h3>
                <p className="text-xs text-[#6B7A8D] mt-0.5">
                  Configura el enlace oficial a Play Store y el código QR de descarga para la Landing Page sin necesidad de modificar código.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sección Google Play Store */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">
                    Enlace de Google Play Store
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#0B1929]">
                      {config.playstore_activo ? "Público en Tienda" : "Fase Beta / Testers"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, playstore_activo: !prev.playstore_activo }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                        config.playstore_activo ? 'bg-emerald-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          config.playstore_activo ? 'translate-x-4.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <input
                  type="url"
                  value={config.playstore_url || ""}
                  onChange={e => setConfig(prev => ({ ...prev, playstore_url: e.target.value }))}
                  placeholder="https://play.google.com/store/apps/details?id=com.fluxsport.app"
                  className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 text-xs font-mono outline-none"
                />
                <p className="text-[11px] text-[#9BA5B0]">
                  {config.playstore_activo
                    ? "✓ Activo: Los botones del Hero y de la sección de Descargas dirigirán directamente a la Play Store."
                    : "ℹ En fase beta: La landing mostrará la etiqueta de «Próximamente / Versión de prueba»."}
                </p>
              </div>

              {/* Sección Código QR */}
              <div className="space-y-4">
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">
                  Configuración del Código QR
                </label>

                <div>
                  <label className="block text-[11px] font-semibold text-[#6B7A8D] mb-1">URL de Destino del QR</label>
                  <input
                    type="url"
                    value={config.qr_destino_url || ""}
                    onChange={e => setConfig(prev => ({ ...prev, qr_destino_url: e.target.value }))}
                    placeholder="https://www.flux-sport.com/app"
                    className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2 text-xs font-mono outline-none"
                  />
                </div>

                <div className="flex items-center gap-4 pt-1">
                  {/* Vista Previa del QR */}
                  <div className="w-20 h-20 bg-[#0B1929] rounded-xl p-1.5 flex items-center justify-center shrink-0 shadow-xs">
                    <img
                      src={config.qr_imagen_url || `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(config.qr_destino_url || 'https://www.flux-sport.com/app')}`}
                      alt="QR Preview"
                      className="w-full h-full object-contain rounded-lg bg-white p-0.5"
                    />
                  </div>

                  <div className="flex-1">
                    <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#F0F4FA] text-[#0B1929] hover:bg-[#E2E8F0] transition-colors cursor-pointer border border-[#E2E8F0] ${uploadingQr ? 'opacity-50 pointer-events-none' : ''}`}>
                      <Upload size={13} />
                      <span>{uploadingQr ? "Subiendo..." : "Subir QR Personalizado"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadCustomQr}
                        className="hidden"
                      />
                    </label>

                    {config.qr_imagen_url ? (
                      <button
                        type="button"
                        onClick={handleRemoveCustomQr}
                        className="block text-[11px] text-red-600 hover:underline mt-1.5 font-semibold cursor-pointer"
                      >
                        Quitar imagen y usar QR automático
                      </button>
                    ) : (
                      <p className="text-[11px] text-[#9BA5B0] mt-1.5">
                        Generando QR dinámico en tiempo real hacia la URL indicada.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Redes Sociales y Soporte */}
          <div className="bg-white rounded-none md:rounded-3xl p-4 sm:p-7 border-y md:border border-[#E2E8F0] shadow-none md:shadow-xs">
            <div className="flex items-center gap-3 pb-5 border-b border-[#F0F4FA] mb-5">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
                <Share2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0B1929]">Redes Sociales y Enlaces Oficiales</h3>
                <p className="text-xs text-[#6B7A8D] mt-0.5">
                  Estos enlaces se mostrarán en la Landing Page, en el pie de página y en los botones de contacto.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Instagram */}
              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span className="text-pink-600">📸</span> Instagram URL
                </label>
                <input
                  type="url"
                  value={config.instagram_url || ""}
                  onChange={e => setConfig(prev => ({ ...prev, instagram_url: e.target.value }))}
                  placeholder="https://instagram.com/flux.sport"
                  className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 text-sm outline-none"
                />
              </div>

              {/* TikTok */}
              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span>🎵</span> TikTok URL
                </label>
                <input
                  type="url"
                  value={config.tiktok_url || ""}
                  onChange={e => setConfig(prev => ({ ...prev, tiktok_url: e.target.value }))}
                  placeholder="https://tiktok.com/@flux.sport"
                  className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 text-sm outline-none"
                />
              </div>

              {/* YouTube */}
              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span className="text-red-600">▶️</span> YouTube URL
                </label>
                <input
                  type="url"
                  value={config.youtube_url || ""}
                  onChange={e => setConfig(prev => ({ ...prev, youtube_url: e.target.value }))}
                  placeholder="https://youtube.com/@fluxsport"
                  className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 text-sm outline-none"
                />
              </div>

              {/* Facebook */}
              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span className="text-blue-600">👥</span> Facebook URL
                </label>
                <input
                  type="url"
                  value={config.facebook_url || ""}
                  onChange={e => setConfig(prev => ({ ...prev, facebook_url: e.target.value }))}
                  placeholder="https://facebook.com/fluxsport"
                  className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 text-sm outline-none"
                />
              </div>

              {/* WhatsApp Soporte */}
              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span className="text-emerald-600">💬</span> WhatsApp de Soporte / Atención
                </label>
                <input
                  type="text"
                  value={config.whatsapp_soporte || ""}
                  onChange={e => setConfig(prev => ({ ...prev, whatsapp_soporte: e.target.value }))}
                  placeholder="7751016733"
                  className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 text-sm outline-none"
                />
              </div>

              {/* Correo Contacto */}
              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mail size={13} className="text-[#1A6FD4]" /> Correo Oficial de Contacto
                </label>
                <input
                  type="email"
                  value={config.email_contacto || ""}
                  onChange={e => setConfig(prev => ({ ...prev, email_contacto: e.target.value }))}
                  placeholder="Flux.Sport.C@gmail.com"
                  className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 text-sm outline-none"
                />
              </div>
            </div>
          </div>

          {/* Tarjeta 3: Video Vertical de la App (Showcase en Hero del Landing) */}
          <div className="bg-white rounded-none md:rounded-3xl p-4 sm:p-7 border-y md:border border-[#E2E8F0] shadow-none md:shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#F0F4FA] mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
                  <Video size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0B1929]">Video de la App (Showcase en Celular)</h3>
                  <p className="text-xs text-[#6B7A8D] mt-0.5">
                    Video vertical de tu app que se reproduce en bucle en el Hero (el marco del teléfono se adapta automáticamente a las medidas de tu video).
                  </p>
                </div>
              </div>

              <label className={`flex items-center gap-2 bg-[var(--brand-primary)] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs hover:opacity-90 transition-opacity cursor-pointer ${uploadingVideo ? 'opacity-50 pointer-events-none' : ''}`}>
                <Upload size={14} />
                <span>{uploadingVideo ? "Subiendo video..." : "Subir Video"}</span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/mov"
                  onChange={handleUploadVideo}
                  className="hidden"
                />
              </label>
            </div>

            {config.app_video_url ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 bg-[#F7F9FC] p-4 rounded-2xl border border-[#E2E8F0]">
                {/* Mini preview del video */}
                <div className="relative w-24 sm:w-28 aspect-[9/19.5] bg-black rounded-2xl overflow-hidden shrink-0 shadow-md border-2 border-slate-800">
                  <video
                    src={config.app_video_url}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-6 h-1 bg-white/40 rounded-full" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h4 className="text-xs sm:text-sm font-bold text-[#0B1929]">Video Activo en el Landing (Auto-adaptable)</h4>
                  </div>
                  <p className="text-[11px] text-[#6B7A8D] break-all line-clamp-2 mb-3 bg-white px-3 py-1.5 rounded-lg border border-[#E2E8F0]">
                    {config.app_video_url}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-white border border-[#E2E8F0] text-[#0B1929] hover:bg-gray-50 cursor-pointer transition-colors shadow-2xs ${uploadingVideo ? 'opacity-50 pointer-events-none' : ''}`}>
                      <Upload size={13} />
                      <span>{uploadingVideo ? "Subiendo..." : "Reemplazar video"}</span>
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,video/mov"
                        onChange={handleUploadVideo}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveVideo}
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Quitar video</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-center py-7 bg-[#F7F9FC] rounded-2xl border border-dashed border-[#E2E8F0]">
                  <Video className="w-10 h-10 text-[#CBD5E1] mx-auto mb-2" />
                  <p className="text-xs font-bold text-[#0B1929]">Aún no has subido un video para el smartphone</p>
                  <p className="text-[11px] text-[#6B7A8D] max-w-sm mx-auto mt-1">
                    Sube un video en proporción vertical 9:16 de tu app para que los visitantes lo vean correr en tiempo real en el Hero.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <input
                    type="url"
                    value={config.app_video_url || ""}
                    onChange={e => setConfig(prev => ({ ...prev, app_video_url: e.target.value }))}
                    placeholder="O pega directamente una URL de video (https://.../video.mp4)"
                    className="flex-1 w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#0B1929] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Vincular URL
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tarjeta 4: Capturas de la App (Showcase para el Landing) */}
          <div className="bg-white rounded-none md:rounded-3xl p-4 sm:p-7 border-y md:border border-[#E2E8F0] shadow-none md:shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#F0F4FA] mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0B1929]">Capturas de la App (Showcase)</h3>
                  <p className="text-xs text-[#6B7A8D] mt-0.5">
                    Sube capturas de pantalla de la app para mostrarlas dentro del teléfono interactivo en el Hero del Landing.
                  </p>
                </div>
              </div>

              <label className={`flex items-center gap-2 bg-[var(--brand-primary)] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs hover:opacity-90 transition-opacity cursor-pointer ${uploadingScreen ? 'opacity-50 pointer-events-none' : ''}`}>
                <Upload size={14} />
                <span>{uploadingScreen ? "Subiendo..." : "Subir Captura"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadScreenshot}
                  className="hidden"
                />
              </label>
            </div>

            {/* Lista de capturas subidas */}
            {(!config.app_screenshots || config.app_screenshots.length === 0) ? (
              <div className="text-center py-8 bg-[#F7F9FC] rounded-2xl border border-dashed border-[#E2E8F0]">
                <Smartphone className="w-10 h-10 text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-xs font-bold text-[#0B1929]">Aún no has subido capturas reales</p>
                <p className="text-[11px] text-[#6B7A8D] max-w-sm mx-auto mt-1">
                  Mientras no subas capturas, la landing mostrará automáticamente la previsualización interactiva simulada en CSS (con temporizador y macros).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {config.app_screenshots.map((s, idx) => (
                  <div key={s.id || idx} className="bg-[#F0F4FA] rounded-2xl p-2.5 border border-[#E2E8F0] relative group flex flex-col">
                    <div className="aspect-[9/16] bg-black rounded-xl overflow-hidden mb-2 relative">
                      <img src={s.url} alt={s.title || "Captura"} className="w-full h-full object-cover" />
                      <button
                        onClick={() => handleRemoveScreenshot(s.id)}
                        className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-lg opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shadow-md cursor-pointer"
                        title="Eliminar captura"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <span className="text-[11px] font-bold text-[#0B1929] truncate">{s.title || `Captura ${idx + 1}`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botón flotante para Guardar Ajustes */}
          <div className="sticky bottom-20 md:bottom-4 z-20 flex justify-end">
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="flex items-center gap-2 bg-[#0B1929] hover:bg-[#1E2D3D] text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <Save size={16} />
              <span>{savingConfig ? "Guardando en la nube..." : "Guardar y Publicar Ajustes"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ── MODAL: NUEVO / EDITAR PRODUCTO ── */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-0 md:p-4">
          <div className="bg-white rounded-none md:rounded-3xl w-full md:max-w-lg h-full max-h-full md:h-auto md:max-h-[90vh] shadow-xl overflow-hidden animate-in zoom-in-95 flex flex-col">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 modal-safe-header">
              <h2 className="text-base font-bold text-[#0B1929]">{editProd ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              <button onClick={() => setShowModal(false)} className="text-[#6B7A8D] hover:text-[#0B1929] cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase mb-1.5">Nombre *</label>
                  <input
                    value={form.nombre}
                    onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ej: Proteína Whey Flux"
                    className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2 text-sm outline-none"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase mb-1.5">Precio ($) *</label>
                  <input
                    type="number"
                    value={form.precio}
                    onChange={e => setForm(p => ({ ...p, precio: e.target.value }))}
                    placeholder="899"
                    className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase mb-1.5">Subtítulo / Breve descripción</label>
                <input
                  value={form.subtitulo}
                  onChange={e => setForm(p => ({ ...p, subtitulo: e.target.value }))}
                  placeholder="Ej: Aislada + Concentrada | 25g Proteína"
                  className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2 text-sm outline-none"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase mb-1.5">Categoría</label>
                  <CustomSelect
                    value={form.categoria}
                    onChange={val => setForm(p => ({ ...p, categoria: val }))}
                    options={[
                      { value: "suplemento", label: "Suplemento" },
                      { value: "ropa", label: "Ropa Deportiva" }
                    ]}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase mb-1.5">Etiqueta (Badge)</label>
                  <input
                    value={form.badge}
                    onChange={e => setForm(p => ({ ...p, badge: e.target.value }))}
                    placeholder="Ej: Bestseller, Nuevo..."
                    className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase mb-1.5">Variantes (Separadas por coma)</label>
                <input
                  value={form.variantes}
                  onChange={e => setForm(p => ({ ...p, variantes: e.target.value }))}
                  placeholder="Ej: Chocolate, Vainilla o S, M, L, XL"
                  className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2 text-sm outline-none"
                />
              </div>

              {/* Enlace externo opcional */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase mb-1.5 flex items-center gap-1.5">
                  <Link2 size={13} className="text-[#1A6FD4]" /> Enlace de compra externo (Opcional)
                </label>
                <input
                  value={form.enlace_externo}
                  onChange={e => setForm(p => ({ ...p, enlace_externo: e.target.value }))}
                  placeholder="https://mercadolibre.com/... (Si se deja vacío, pedirá por WhatsApp)"
                  className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2 text-sm outline-none"
                />
                <p className="text-[11px] text-[#9BA5B0] mt-1">
                  Si se deja en blanco, el botón en la web dirá automáticamente &quot;Pedir por WhatsApp&quot;.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase mb-1.5">Imagen del producto</label>
                <PhotoUploadBox
                  value={form.imagen_url}
                  onChange={(e) => {
                    if (e.target.files?.[0]) uploadImg(e.target.files[0]);
                  }}
                  onRemove={() => setForm(p => ({ ...p, imagen_url: "" }))}
                  uploading={uploading}
                  label="Subir foto de producto"
                  size="md"
                  shape="square"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F7F9FC] flex justify-end gap-3 shrink-0 modal-safe-footer">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-[#6B7A8D] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={saveProducto}
                disabled={saving || uploading}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-[var(--brand-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer shadow-xs"
              >
                {saving ? "Guardando..." : "Guardar Producto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de Borrado */}
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
