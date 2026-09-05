import { useState, useEffect } from "react";
import { dbGet, dbPost, dbPatch, dbDel, storageUpload } from "../../lib/supabase";
import { Plus, Search, Trash2, Edit2, Image as ImageIcon, Filter, Tag, X, ShoppingBag } from "lucide-react";

export default function GestorTienda({ setMsg }) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editProd, setEditProd] = useState(null);
  const [form, setForm] = useState({
    nombre: "", subtitulo: "", precio: "", categoria: "suplemento", variantes: "", badge: "", imagen_url: ""
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [filtroCat, setFiltroCat] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");

  const loadProductos = async () => {
    setLoading(true);
    try {
      const rows = await dbGet('productos?order=created_at.desc');
      if (Array.isArray(rows)) setProductos(rows);
    } catch (e) {
      console.error(e);
      setMsg("Error al cargar productos. ¿Ejecutaste el script setup_store.sql?");
    }
    setLoading(false);
  };

  useEffect(() => { loadProductos(); }, []);

  const uploadImg = async (file) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fname = `producto_${Date.now()}.${ext}`;
      // Usamos el bucket 'ejercicios' o puedes crear uno 'productos'
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

      if (editProd) {
        await dbPatch(`productos?id=eq.${editProd.id}`, payload);
        setMsg("Producto actualizado");
      } else {
        await dbPost('productos', payload);
        setMsg("Producto creado");
      }
      setShowModal(false);
      setEditProd(null);
      loadProductos();
    } catch (e) {
      setMsg("Error al guardar: " + e.message);
    }
    setSaving(false);
  };

  const deleteProd = async (p) => {
    if (!confirm(`¿Eliminar ${p.nombre}?`)) return;
    try {
      await dbDel(`productos?id=eq.${p.id}`);
      setMsg("Producto eliminado");
      loadProductos();
    } catch (e) {
      setMsg("Error al eliminar: " + e.message);
    }
  };

  const filtered = productos.filter(p => {
    if (filtroCat !== "Todas" && p.categoria !== filtroCat) return false;
    if (busqueda && !p.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#0B1929]">Catálogo de Productos</h2>
          <p className="text-sm text-[#6B7A8D] mt-1">{productos.length} productos en tienda</p>
        </div>
        <button
          onClick={() => {
            setEditProd(null);
            setForm({ nombre: "", subtitulo: "", precio: "", categoria: "suplemento", variantes: "", badge: "", imagen_url: "" });
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-[var(--brand-primary)] text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={18} /> Nuevo Producto
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-6 bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA5B0] w-4 h-4" />
          <input
            className="w-full bg-[#F0F4FA] rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand-primary)] transition-all placeholder:text-[#9BA5B0]"
            placeholder="Buscar producto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-[#6B7A8D] ml-2" />
          {["Todas", "suplemento", "ropa"].map(c => (
            <button
              key={c}
              onClick={() => setFiltroCat(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filtroCat === c
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'bg-[#F0F4FA] text-[#6B7A8D] hover:bg-[#E2E8F0]'
              }`}
            >
              <span className="capitalize">{c}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex justify-center py-12 text-[#6B7A8D]">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="w-12 h-12 text-[#E2E8F0] mx-auto mb-3" />
            <h3 className="text-[#0B1929] font-bold">Sin resultados</h3>
            <p className="text-[#6B7A8D] text-sm">No se encontraron productos que coincidan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
            {filtered.map(p => (
              <div key={p.id} className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm hover:border-[var(--brand-primary)] transition-colors flex flex-col group">
                <div className="h-40 bg-[#F0F4FA] relative flex items-center justify-center">
                  {p.imagen_url ? (
                    <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-[#C1C9D2]" />
                  )}
                  {p.badge && (
                    <span className="absolute top-2 left-2 bg-[#0B1929] text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">
                      {p.badge}
                    </span>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => {
                        setEditProd(p);
                        setForm({
                          nombre: p.nombre, subtitulo: p.subtitulo||"", precio: p.precio,
                          categoria: p.categoria, variantes: (p.variantes||[]).join(", "),
                          badge: p.badge||"", imagen_url: p.imagen_url||""
                        });
                        setShowModal(true);
                      }}
                      className="bg-white text-blue-600 p-1.5 rounded-lg shadow-sm hover:bg-blue-50"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => deleteProd(p)} className="bg-white text-red-600 p-1.5 rounded-lg shadow-sm hover:bg-red-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="text-[10px] uppercase font-bold text-[#6B7A8D] mb-1">{p.categoria}</div>
                  <h3 className="font-bold text-[#0B1929] leading-tight mb-1">{p.nombre}</h3>
                  <p className="text-xs text-[#6B7A8D] line-clamp-2 mb-3 flex-1">{p.subtitulo}</p>
                  <div className="flex justify-between items-center mt-auto">
                    <span className="font-bold text-lg text-[var(--brand-primary)]">${p.precio}</span>
                    {p.variantes && p.variantes.length > 0 && (
                      <span className="bg-[#F0F4FA] text-[#6B7A8D] text-[10px] font-semibold px-2 py-1 rounded-md">
                        {p.variantes.length} opc
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-[#0B1929]">{editProd ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              <button onClick={() => setShowModal(false)} className="text-[#6B7A8D] hover:text-[#0B1929]">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase mb-1.5">Nombre *</label>
                  <input value={form.nombre} onChange={e=>setForm(p=>({...p, nombre:e.target.value}))} className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2 text-sm outline-none" />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase mb-1.5">Precio ($) *</label>
                  <input type="number" value={form.precio} onChange={e=>setForm(p=>({...p, precio:e.target.value}))} className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2 text-sm outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase mb-1.5">Subtítulo / Breve descripción</label>
                <input value={form.subtitulo} onChange={e=>setForm(p=>({...p, subtitulo:e.target.value}))} className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2 text-sm outline-none" />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase mb-1.5">Categoría</label>
                  <select value={form.categoria} onChange={e=>setForm(p=>({...p, categoria:e.target.value}))} className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2 text-sm outline-none">
                    <option value="suplemento">Suplemento</option>
                    <option value="ropa">Ropa Deportiva</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase mb-1.5">Etiqueta (Badge)</label>
                  <input value={form.badge} onChange={e=>setForm(p=>({...p, badge:e.target.value}))} placeholder="Ej: Bestseller, Nuevo..." className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2 text-sm outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase mb-1.5">Variantes (Separadas por coma)</label>
                <input value={form.variantes} onChange={e=>setForm(p=>({...p, variantes:e.target.value}))} placeholder="Ej: Chocolate, Vainilla o S, M, L" className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2 text-sm outline-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase mb-1.5">Imagen del producto</label>
                <div className="flex items-center gap-3">
                  {form.imagen_url && <img src={form.imagen_url} alt="preview" className="w-16 h-16 rounded-xl object-cover border border-[#E2E8F0]" />}
                  <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#E2E8F0] rounded-xl p-4 hover:bg-[#F0F4FA] cursor-pointer transition-colors text-center">
                    <ImageIcon className="w-6 h-6 text-[#9BA5B0] mb-2" />
                    <span className="text-xs font-medium text-[var(--brand-primary)]">
                      {uploading ? "Subiendo..." : "Subir nueva foto (JPG/PNG)"}
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      if(e.target.files[0]) uploadImg(e.target.files[0]);
                    }} />
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F7F9FC] flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-[#6B7A8D] hover:bg-[#E2E8F0] transition-colors">Cancelar</button>
              <button onClick={saveProducto} disabled={saving || uploading} className="px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--brand-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
                {saving ? "Guardando..." : "Guardar Producto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
