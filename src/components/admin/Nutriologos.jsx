import { useState, useEffect, useCallback, useRef } from "react";
import { getNutriologos, updateProfile, authInvite, storageUpload } from "../../lib/supabase";
import { Image, CheckCircle2, XCircle, AlertCircle, Search, User, MessageCircle, Pencil, X, Plus, Mail } from "lucide-react";

const COLORS = ["#56CCF2","#2D9CDB","#BB86FC","#FF6B6B","#F7DC6F","#2ECC71","#E67E22","#E91E63"];

const uploadLogo = async (file) => {
  const ext  = file.name.split(".").pop();
  const fname = `${Date.now()}.${ext}`;
  return await storageUpload("logos", fname, file);
};

const Btn = ({ children, onClick, disabled, small, outline, grad, className = "" }) => {
  let baseClass = "inline-flex items-center justify-center font-medium transition-all duration-200 rounded-lg outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ";
  if (small) baseClass += "px-3 py-1.5 text-xs ";
  else baseClass += "px-4 py-2 text-sm ";
  
  if (grad) baseClass += "bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 border-transparent shadow-sm focus:ring-blue-500 ";
  else if (outline) baseClass += "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-200 ";
  else baseClass += "bg-blue-600 text-white hover:bg-blue-700 border-transparent shadow-sm focus:ring-blue-500 ";
  
  // Custom color overrides
  if (outline && className.includes("text-red-500")) {
    baseClass = baseClass.replace("text-slate-700 hover:bg-slate-50", "text-red-600 hover:bg-red-50 border-red-200");
  }
  
  return (
    <button onClick={onClick} disabled={disabled} className={baseClass + className}>
      {children}
    </button>
  );
};

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">{title}</h3>
        <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <X size={20} />
        </button>
      </div>
      <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        {children}
      </div>
    </div>
  </div>
);

const Field = ({ label, hint, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-slate-700">{label}</label>
    {children}
    {hint && <span className="text-xs text-slate-500">{hint}</span>}
  </div>
);

const InputClass = "w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors";

const LogoPicker = ({ value, onChange, uploading }) => {
  const ref = useRef();
  return (
    <div className="flex items-center gap-4 mt-1">
      {/* Preview */}
      <div
        onClick={() => ref.current?.click()}
        className={`w-16 h-16 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer shrink-0 overflow-hidden transition-colors ${value ? 'border-blue-400 bg-slate-50' : 'border-slate-200 bg-slate-50 hover:border-blue-300'}`}
        title="Haz clic para seleccionar imagen"
      >
        {value
          ? <img src={value} alt="logo" className="w-full h-full object-contain" />
          : <Image className="w-6 h-6 text-slate-300" />
        }
      </div>
      <div>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onChange}/>
        <Btn small outline onClick={() => ref.current?.click()} disabled={uploading}>
          {uploading ? "Subiendo…" : value ? "Cambiar logo" : "Subir logo"}
        </Btn>
        {value && (
          <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
            <CheckCircle2 size={12} /> Logo cargado
          </div>
        )}
        <div className="text-[11px] text-slate-400 mt-1">PNG, JPG o SVG recomendado</div>
      </div>
    </div>
  );
};

export function Nutriologos({ setMsg }) {
  const [nutriologos, setNutriologos]       = useState([]);
  const [loading, setLoading]               = useState(true);
  const [showInvite, setShowInvite]         = useState(false);
  const [showEdit, setShowEdit]             = useState(null);
  const [saving, setSaving]                 = useState(false);
  const [searchNutris, setSearchNutris]     = useState("");
  const [uploadingLogo, setUploadingLogo]   = useState(false);
  const [form, setForm] = useState({ nombre:"", email:"", telefono:"", nombre_marca:"", color_primario:"#56CCF2", logo_url:"" });
  const [editForm, setEditForm] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await getNutriologos(); setNutriologos(r); } catch{}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Upload handlers ──
  const handleLogoChange = async (e, setter) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadLogo(file);
      setter(p => ({ ...p, logo_url: url }));
      setMsg(<span className="flex items-center gap-2"><CheckCircle2 size={16}/> Logo cargado</span>);
    } catch(err) { setMsg(<span className="flex items-center gap-2"><XCircle size={16}/> {err.message}</span>); }
    setUploadingLogo(false);
  };

  const invite = async () => {
    if (!form.email || !form.nombre) { setMsg(<span className="flex items-center gap-2"><AlertCircle size={16}/> Nombre y email son obligatorios</span>); return; }
    setSaving(true);
    try {
      await authInvite(form.email, {
        role: "nutriologo",
        nombre: form.nombre,
        telefono: form.telefono,
        nombre_marca: form.nombre_marca || form.nombre,
        color_primario: form.color_primario,
        logo_url: form.logo_url || ""
      });
      setMsg(<span className="flex items-center gap-2"><CheckCircle2 size={16}/> Invitación enviada — el nutriólogo recibirá un email para crear su contraseña</span>);
      setShowInvite(false);
      setForm({ nombre:"", email:"", telefono:"", nombre_marca:"", color_primario:"#56CCF2", logo_url:"" });
      setTimeout(load, 2000);
    } catch(e) { setMsg(<span className="flex items-center gap-2"><XCircle size={16}/> {e.message}</span>); }
    setSaving(false);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await updateProfile(showEdit.id, editForm);
      setMsg(<span className="flex items-center gap-2"><CheckCircle2 size={16}/> Perfil actualizado</span>);
      setShowEdit(null);
      await load();
    } catch(e) { setMsg(<span className="flex items-center gap-2"><XCircle size={16}/> {e.message}</span>); }
    setSaving(false);
  };

  const toggleActivo = async (n) => {
    try {
      const newState = n.activo === false ? true : false;
      await updateProfile(n.id, { activo: newState });
      setMsg(<span className="flex items-center gap-2"><CheckCircle2 size={16}/> Nutriólogo {newState ? "activado" : "suspendido"}</span>);
      await load();
    } catch(e) { setMsg(<span className="flex items-center gap-2"><XCircle size={16}/> Error: {e.message}</span>); }
  };

  return (
    <div className="animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="font-sans font-bold text-2xl text-slate-800 tracking-wide">
            Nutriólogos
          </h2>
          <div className="text-sm text-slate-500 mt-1">
            {nutriologos.length} registrado{nutriologos.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchNutris}
              onChange={e=>setSearchNutris(e.target.value)}
              placeholder="Buscar nutriólogo…"
              className="bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors w-52"
            />
          </div>
          <Btn grad onClick={() => setShowInvite(true)}>
            <Plus size={16} className="mr-1.5" /> Invitar nutriólogo
          </Btn>
        </div>
      </div>

      {/* Lista */}
      {(() => {
        const filteredNutriologos = nutriologos.filter(n =>
          n.nombre?.toLowerCase().includes(searchNutris.toLowerCase()) ||
          n.email?.toLowerCase().includes(searchNutris.toLowerCase())
        );

        if (loading) return (
          <div className="text-center py-16 text-slate-500">
            <div className="w-9 h-9 rounded-full border-4 border-slate-200 border-t-blue-500 animate-spin mx-auto mb-4"/>
            Cargando…
          </div>
        );

        if (nutriologos.length === 0) return (
          <div className="text-center py-20 text-slate-500">
            <User size={48} className="mx-auto mb-4 text-slate-300" />
            <div className="text-base font-semibold mb-2 text-slate-700">Sin nutriólogos aún</div>
            <div className="text-sm">Invita al primer nutriólogo para comenzar</div>
          </div>
        );

        if (filteredNutriologos.length === 0 && searchNutris) return (
          <div className="text-center py-16 text-slate-500">
            <Search size={40} className="mx-auto mb-3 text-slate-300 opacity-50" />
            <div className="text-sm font-semibold">Sin resultados para "{searchNutris}"</div>
          </div>
        );

        return (
          <div className="flex flex-col gap-3">
            {filteredNutriologos.map((n, i) => (
              <div key={n.id} className="relative overflow-hidden bg-white hover:bg-slate-50 transition-colors rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${i*0.04}s`, animationFillMode: 'both' }}>
              {/* Barra de color de marca */}
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: n.color_primario || '#3b82f6' }}/>
              
              <div className="pl-2 flex items-center gap-4">
                {/* Logo thumbnail */}
                <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                  {n.logo_url
                    ? <img src={n.logo_url} alt="logo" className="w-full h-full object-contain" />
                    : <Image size={20} className="text-slate-300" />
                  }
                </div>
                <div>
                  <div className="font-semibold text-base text-slate-800 mb-1 flex items-center gap-2">
                    {n.nombre || "—"}
                    {n.nombre_marca && n.nombre_marca !== n.nombre && (
                      <span className="text-xs text-slate-500 font-normal">
                        {n.nombre_marca}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center flex-wrap gap-x-3 gap-y-1">
                    <span>{n.email || "Sin email"}</span>
                    {n.telefono && (
                      <a href={`https://wa.me/${n.telefono.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="text-emerald-600 font-medium no-underline inline-flex items-center gap-1 hover:text-emerald-700 transition-colors">
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-200 shrink-0" style={{ background: n.color_primario || '#3b82f6' }}/>
                    <span className="text-[11px] text-slate-500">{n.color_primario || "#56CCF2"}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${n.activo !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${n.activo !== false ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  {n.activo !== false ? "Activo" : "Suspendido"}
                </span>
                <Btn small outline onClick={() => {
                  setShowEdit(n);
                  setEditForm({ nombre:n.nombre||"", nombre_marca:n.nombre_marca||"", color_primario:n.color_primario||"#56CCF2", email:n.email||"", telefono:n.telefono||"", logo_url:n.logo_url||"" });
                }}>
                  Editar marca
                </Btn>
                <Btn small outline className={n.activo !== false ? "text-red-500" : ""} onClick={() => toggleActivo(n)}>
                  {n.activo !== false ? "Suspender" : "Activar"}
                </Btn>
              </div>
            </div>
            ))}
          </div>
        );
      })()}

      {/* Modal Invitar */}
      {showInvite && (
        <Modal title={<><User size={20} className="text-blue-500"/> Invitar nutriólogo</>} onClose={() => setShowInvite(false)}>
          <Field label="Nombre completo">
            <input className={InputClass} value={form.nombre} onChange={e => setForm(p=>({...p,nombre:e.target.value}))} placeholder="Ej. Dra. Ana García"/>
          </Field>
          <Field label="Email">
            <input className={InputClass} type="email" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} placeholder="ana@email.com"/>
          </Field>
          <Field label="Teléfono (WhatsApp)">
            <input className={InputClass} type="tel" value={form.telefono} onChange={e => setForm(p=>({...p,telefono:e.target.value}))} placeholder="Ej. +525512345678"/>
          </Field>
          <Field label="Nombre de marca (opcional)">
            <input className={InputClass} value={form.nombre_marca} onChange={e => setForm(p=>({...p,nombre_marca:e.target.value}))} placeholder="Ej. NutriMax Pro"/>
          </Field>
          <Field label="Logo de marca (opcional)" hint="Aparecerá en el panel del nutriólogo y en el panel de sus clientes">
            <LogoPicker
              value={form.logo_url}
              onChange={e => handleLogoChange(e, setForm)}
              uploading={uploadingLogo}
            />
          </Field>
          <Field label="Color principal de su marca">
            <div className="flex gap-2 flex-wrap mt-1">
              {COLORS.map(col => (
                <div key={col} onClick={() => setForm(p=>({...p,color_primario:col}))} className="w-7 h-7 rounded-full cursor-pointer transition-all" style={{
                  background:col,
                  border: form.color_primario===col ? `2px solid white` : `2px solid transparent`,
                  boxShadow: form.color_primario===col ? `0 0 0 2px ${col}` : "none",
                }}/>
              ))}
              <div className="relative w-7 h-7 rounded-full overflow-hidden border border-slate-200">
                <input type="color" value={form.color_primario} onChange={e => setForm(p=>({...p,color_primario:e.target.value}))}
                  className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer"
                  title="Color personalizado"/>
              </div>
            </div>
          </Field>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 mb-5 leading-relaxed flex items-start gap-2">
            <Mail size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <span>El nutriólogo recibirá un email para crear su contraseña. Su panel ya estará configurado con su branding.</span>
          </div>
          <div className="flex gap-2.5 justify-end mt-2">
            <Btn outline onClick={() => setShowInvite(false)}>Cancelar</Btn>
            <Btn grad onClick={invite} disabled={saving || uploadingLogo}>{saving ? "Enviando…" : "Invitar"}</Btn>
          </div>
        </Modal>
      )}

      {/* Modal editar branding */}
      {showEdit && (
        <Modal title={<><Pencil size={20} className="text-blue-500"/> Editar — {showEdit.nombre || "Nutriólogo"}</>} onClose={() => setShowEdit(null)}>
          <Field label="Nombre completo">
            <input className={InputClass} value={editForm.nombre} onChange={e => setEditForm(p=>({...p,nombre:e.target.value}))}/>
          </Field>
          <Field label="Teléfono (WhatsApp)">
            <input className={InputClass} type="tel" value={editForm.telefono} onChange={e => setEditForm(p=>({...p,telefono:e.target.value}))}/>
          </Field>
          <Field label="Nombre de marca">
            <input className={InputClass} value={editForm.nombre_marca} onChange={e => setEditForm(p=>({...p,nombre_marca:e.target.value}))}/>
          </Field>
          <Field label="Logo de marca" hint="Aparecerá en el panel del nutriólogo y en el panel de sus clientes">
            <LogoPicker
              value={editForm.logo_url}
              onChange={e => handleLogoChange(e, setEditForm)}
              uploading={uploadingLogo}
            />
          </Field>
          <Field label="Color de marca">
            <div className="flex gap-2 flex-wrap mt-1">
              {COLORS.map(col => (
                <div key={col} onClick={() => setEditForm(p=>({...p,color_primario:col}))} className="w-7 h-7 rounded-full cursor-pointer transition-all" style={{
                  background:col,
                  border: editForm.color_primario===col ? `2px solid white` : `2px solid transparent`,
                  boxShadow: editForm.color_primario===col ? `0 0 0 2px ${col}` : "none",
                }}/>
              ))}
              <div className="relative w-7 h-7 rounded-full overflow-hidden border border-slate-200">
                <input type="color" value={editForm.color_primario} onChange={e => setEditForm(p=>({...p,color_primario:e.target.value}))}
                  className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer"/>
              </div>
            </div>
          </Field>
          <div className="flex gap-2.5 justify-end mt-2">
            <Btn outline onClick={() => setShowEdit(null)}>Cancelar</Btn>
            <Btn grad onClick={saveEdit} disabled={saving || uploadingLogo}>{saving ? "Guardando…" : "Guardar cambios"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
