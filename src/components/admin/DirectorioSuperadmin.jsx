import { useState, useEffect, useMemo, useRef } from "react";
import { updateProfile, authInvite, storageUpload, dbGet, dbPost, dbPatch } from "../../lib/supabase";
import { User, MessageCircle, Pencil, X, Plus, Mail, ChevronDown, ChevronUp, Users, Search, Target, CheckCircle2 } from "lucide-react";

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
  
  if (outline && className.includes("text-red-500")) {
    baseClass = baseClass.replace("text-slate-700 hover:bg-slate-50", "text-red-600 hover:bg-red-50 border-red-200");
  }
  
  return <button onClick={onClick} disabled={disabled} className={baseClass + className}>{children}</button>;
};

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">{title}</h3>
        <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={20} /></button>
      </div>
      <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">{children}</div>
    </div>
  </div>
);

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
    {children}
    {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
  </div>
);

const LogoPicker = ({ value, onChange, uploading }) => {
  const fileRef = useRef(null);
  return (
    <div className="flex items-center gap-4 mt-1">
      <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
        {value ? <img src={value} alt="Logo" className="w-full h-full object-cover"/> : <span className="text-xs text-slate-400">N/A</span>}
      </div>
      <div className="flex-1">
        <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={onChange}/>
        <Btn small outline onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? "Subiendo..." : value ? "Cambiar logo" : "Subir logo"}
        </Btn>
      </div>
    </div>
  );
};

export function DirectorioSuperadmin({ myId, clientes, loadClientes, setMsg, setSelected, setTab }) {
  const [nutriologos, setNutriologos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Modals state
  const [showInviteNutri, setShowInviteNutri] = useState(false);
  const [showEditNutri, setShowEditNutri] = useState(null);
  const [showNewClient, setShowNewClient] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  const [expandedNutri, setExpandedNutri] = useState(null);

  // Forms
  const [formNutri, setFormNutri] = useState({ nombre:"", email:"", telefono:"", nombre_marca:"", logo_url:"", color_primario:"#56CCF2" });
  const [editFormNutri, setEditFormNutri] = useState({ nombre:"", nombre_marca:"", color_primario:"", email:"", telefono:"", logo_url:"" });
  const [formClient, setFormClient] = useState({ nombre:"", email:"", objetivo:"", telefono:"" });

  const [resolvedOwnerId, setResolvedOwnerId] = useState(myId);

  const loadNutriologos = async () => {
    setLoading(true);
    try {
      const data = await dbGet("profiles?role=eq.nutriologo&order=created_at.desc");
      const currentUser = await dbGet(`profiles?id=eq.${myId}`);
      
      if (currentUser.length > 0) {
        let owner = currentUser[0];
        
        // Si es staff/administrativo, el "dueño" del directorio es su jefe (el superadmin)
        if (owner.role === "staff" || owner.role === "administrativo") {
          if (owner.nutriologo_id) {
            const boss = await dbGet(`profiles?id=eq.${owner.nutriologo_id}`);
            if (boss.length > 0) owner = boss[0];
          }
        }

        setResolvedOwnerId(owner.id);
        
        owner.isSuperadmin = true;
        
        if (currentUser[0].role !== "superadmin") {
          owner.nombre_marca = owner.nombre_marca || "Flux Sports";
        } else {
          owner.nombre_marca = owner.nombre_marca || "Flux Sports (Tú)";
        }
        
        setNutriologos([owner, ...data]);
      } else {
        setNutriologos(data);
      }
    } catch(e) {
      setMsg("❌ Error cargando nutriólogos");
    }
    setLoading(false);
  };

  useEffect(() => { loadNutriologos(); }, []);

  const handleLogoChange = async (e, setFnc) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadLogo(file);
      setFnc(p => ({...p, logo_url: url}));
      setMsg("✅ Logo subido");
    } catch(err) {
      setMsg("❌ Error al subir logo: " + err.message);
    }
    setUploadingLogo(false);
  };

  const inviteNutri = async () => {
    if(!formNutri.email || !formNutri.nombre){ setMsg("❌ Nombre y email requeridos"); return; }
    setSaving(true);
    try {
      const authUser = await authInvite(formNutri.email, { role: "nutriologo", nombre: formNutri.nombre });
      await updateProfile(authUser.id, {
        nombre: formNutri.nombre,
        telefono: formNutri.telefono,
        nombre_marca: formNutri.nombre_marca,
        logo_url: formNutri.logo_url,
        color_primario: formNutri.color_primario,
        activo: true
      });
      setShowInviteNutri(false);
      setFormNutri({ nombre:"", email:"", telefono:"", nombre_marca:"", logo_url:"", color_primario:"#56CCF2" });
      loadNutriologos();
      setMsg("✅ Invitación enviada");
    } catch(e) {
      setMsg("❌ " + e.message);
    }
    setSaving(false);
  };

  const saveEditNutri = async () => {
    setSaving(true);
    try {
      await updateProfile(showEditNutri.id, editFormNutri);
      setShowEditNutri(null);
      loadNutriologos();
      setMsg("✅ Cambios guardados");
    } catch(e) {
      setMsg("❌ " + e.message);
    }
    setSaving(false);
  };

  const toggleActivoNutri = async (n) => {
    try {
      await updateProfile(n.id, { activo: n.activo === false ? true : false });
      loadNutriologos();
      setMsg(`✅ Nutriólogo ${n.activo === false ? "activado" : "suspendido"}`);
    } catch(e) {
      setMsg("❌ Error: " + e.message);
    }
  };

  const createClient = async () => {
    if (!formClient.email || !formClient.nombre) { setMsg("❌ Nombre y email son obligatorios"); return; }
    setSaving(true);
    try {
      const authUser = await authInvite(formClient.email, { role: "cliente", nombre: formClient.nombre });
      await dbPost("clientes", {
        nombre: formClient.nombre,
        objetivo: formClient.objetivo,
        email: formClient.email,
        telefono: formClient.telefono,
        nutriologo_id: resolvedOwnerId,
        auth_id: authUser.id,
        activo: true
      });
      setShowNewClient(false); 
      setFormClient({ nombre:"", email:"", objetivo:"", telefono:"" });
      await loadClientes(); 
      setMsg("✅ Paciente creado (asignado a ti)");
    } catch(e) { setMsg("❌ "+e.message); }
    setSaving(false);
  };

  const filteredNutris = nutriologos.filter(n => {
    const term = search.toLowerCase();
    return (n.nombre||"").toLowerCase().includes(term) || (n.nombre_marca||"").toLowerCase().includes(term);
  });

  const InputClass = "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all";

  return (
    <div className="flex-1 flex flex-col bg-[#F7F9FC]">
      {/* Header */}
      <div className="px-6 md:px-8 pt-6 md:pt-8 pb-6 bg-white border-b border-[#F0F4FA] flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">Panel de Super Administrador</p>
            <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>Directorio</h1>
            <p className="text-sm text-[#6B7A8D] mt-1">{clientes.length} pacientes y {nutriologos.length} nutriólogos en la plataforma</p>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button onClick={() => setShowNewClient(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#1A6FD4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:bg-blue-600 transition-colors">
              <Plus size={16} /> Paciente
            </button>
            <button onClick={() => setShowInviteNutri(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-[#E2E8F0] text-[#0B1929] px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors">
              <Plus size={16} /> Nutriólogo
            </button>
          </div>
        </div>

        <div className="relative mt-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA5B0]" />
          <input
            type="text"
            placeholder="Buscar por nutriólogo o marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#F0F4FA] text-[#0B1929] text-sm rounded-xl pl-9 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-[#1A6FD4] transition-all placeholder:text-[#9BA5B0]"
          />
        </div>
      </div>

      {/* Directorio List */}
      <div className="flex-1 p-6 md:p-8 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-[#6B7A8D]">Cargando directorio...</div>
        ) : (
          <div className="flex flex-col gap-4 max-w-5xl mx-auto">
            {filteredNutris.map(n => {
              const nClients = clientes.filter(c => c.nutriologo_id === n.id);
              const isExpanded = expandedNutri === n.id;
              
              return (
                <div key={n.id} className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm transition-all hover:border-slate-300">
                  {/* Nutriologo Row */}
                  <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center bg-slate-50 relative">
                        {n.logo_url ? <img src={n.logo_url} className="w-full h-full object-cover"/> : <User className="text-slate-300" size={24}/>}
                        {n.isSuperadmin && <div className="absolute top-0 right-0 w-3 h-3 bg-amber-400 rounded-full border-2 border-white"></div>}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-[#0B1929] text-lg">{n.nombre_marca || n.nombre || "Sin nombre"}</h3>
                          {n.isSuperadmin && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">{n.id === myId ? "TÚ" : "CORPORATIVO"}</span>}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${n.activo !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {n.activo !== false ? "Activo" : "Suspendido"}
                          </span>
                        </div>
                        <div className="text-xs text-[#6B7A8D] flex items-center gap-3">
                          <span>{n.nombre}</span>
                          {n.telefono && (
                            <a href={`https://wa.me/${n.telefono.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-emerald-600 font-medium no-underline inline-flex items-center gap-1 hover:text-emerald-700">
                              <MessageCircle size={12} /> WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <Btn small outline onClick={() => {
                        setShowEditNutri(n);
                        setEditFormNutri({ nombre:n.nombre||"", nombre_marca:n.nombre_marca||"", color_primario:n.color_primario||"#56CCF2", email:n.email||"", telefono:n.telefono||"", logo_url:n.logo_url||"" });
                      }}>Editar</Btn>
                      {!n.isSuperadmin && (
                        <Btn small outline className={n.activo !== false ? "text-red-500" : ""} onClick={() => toggleActivoNutri(n)}>
                          {n.activo !== false ? "Suspender" : "Activar"}
                        </Btn>
                      )}
                      <button 
                        onClick={() => setExpandedNutri(isExpanded ? null : n.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isExpanded ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                      >
                        <Users size={16} />
                        <span>{nClients.length} Pacientes</span>
                        {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Clients Sub-grid */}
                  {isExpanded && (
                    <div className="bg-slate-50 border-t border-slate-100 p-5">
                      {nClients.length === 0 ? (
                        <p className="text-sm text-center text-slate-500 py-4">No tiene pacientes registrados.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {nClients.map(c => (
                            <div 
                              key={c.id} 
                              onClick={() => { setSelected(c); setTab("programar"); }}
                              className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group relative overflow-hidden"
                            >
                              <div className={`absolute top-0 left-0 w-1 h-full ${c.activo ? 'bg-[#1A6FD4]' : 'bg-red-400'}`} />
                              <div className="pl-2">
                                <h4 className="font-bold text-[#0B1929] text-sm truncate group-hover:text-blue-600 transition-colors">{c.nombre}</h4>
                                <p className="text-xs text-slate-500 truncate mb-2">{c.email}</p>
                                <div className="flex items-start gap-1.5 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg line-clamp-2 min-h-[32px]">
                                  <Target size={14} className="shrink-0 text-slate-400 mt-0.5" />
                                  <span>{c.objetivo || "Sin objetivo definido"}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showInviteNutri && (
        <Modal title={<><User size={20} className="text-blue-500"/> Nuevo Nutriólogo</>} onClose={() => setShowInviteNutri(false)}>
          <Field label="Nombre completo">
            <input className={InputClass} value={formNutri.nombre} onChange={e => setFormNutri(p=>({...p,nombre:e.target.value}))}/>
          </Field>
          <Field label="Email">
            <input className={InputClass} type="email" value={formNutri.email} onChange={e => setFormNutri(p=>({...p,email:e.target.value}))}/>
          </Field>
          <Field label="Teléfono (WhatsApp)">
            <input className={InputClass} type="tel" value={formNutri.telefono} onChange={e => setFormNutri(p=>({...p,telefono:e.target.value}))}/>
          </Field>
          <Field label="Nombre de marca (opcional)">
            <input className={InputClass} value={formNutri.nombre_marca} onChange={e => setFormNutri(p=>({...p,nombre_marca:e.target.value}))}/>
          </Field>
          <Field label="Logo de marca (opcional)">
            <LogoPicker value={formNutri.logo_url} onChange={e => handleLogoChange(e, setFormNutri)} uploading={uploadingLogo}/>
          </Field>
          <Field label="Color principal de su marca">
            <div className="flex gap-2 flex-wrap mt-1">
              {COLORS.map(col => (
                <div key={col} onClick={() => setFormNutri(p=>({...p,color_primario:col}))} className="w-7 h-7 rounded-full cursor-pointer transition-all" style={{ background:col, border: formNutri.color_primario===col ? `2px solid white` : `2px solid transparent`, boxShadow: formNutri.color_primario===col ? `0 0 0 2px ${col}` : "none" }}/>
              ))}
            </div>
          </Field>
          <div className="flex gap-2.5 justify-end mt-4">
            <Btn outline onClick={() => setShowInviteNutri(false)}>Cancelar</Btn>
            <Btn grad onClick={inviteNutri} disabled={saving || uploadingLogo}>{saving ? "Enviando..." : "Invitar Nutriólogo"}</Btn>
          </div>
        </Modal>
      )}

      {showEditNutri && (
        <Modal title={<><Pencil size={20} className="text-blue-500"/> Editar {showEditNutri.nombre}</>} onClose={() => setShowEditNutri(null)}>
          <Field label="Nombre completo">
            <input className={InputClass} value={editFormNutri.nombre} onChange={e => setEditFormNutri(p=>({...p,nombre:e.target.value}))}/>
          </Field>
          <Field label="Teléfono (WhatsApp)">
            <input className={InputClass} type="tel" value={editFormNutri.telefono} onChange={e => setEditFormNutri(p=>({...p,telefono:e.target.value}))}/>
          </Field>
          <Field label="Nombre de marca">
            <input className={InputClass} value={editFormNutri.nombre_marca} onChange={e => setEditFormNutri(p=>({...p,nombre_marca:e.target.value}))}/>
          </Field>
          <Field label="Logo de marca">
            <LogoPicker value={editFormNutri.logo_url} onChange={e => handleLogoChange(e, setEditFormNutri)} uploading={uploadingLogo}/>
          </Field>
          <Field label="Color de marca">
            <div className="flex gap-2 flex-wrap mt-1">
              {COLORS.map(col => (
                <div key={col} onClick={() => setEditFormNutri(p=>({...p,color_primario:col}))} className="w-7 h-7 rounded-full cursor-pointer transition-all" style={{ background:col, border: editFormNutri.color_primario===col ? `2px solid white` : `2px solid transparent`, boxShadow: editFormNutri.color_primario===col ? `0 0 0 2px ${col}` : "none" }}/>
              ))}
            </div>
          </Field>
          <div className="flex gap-2.5 justify-end mt-4">
            <Btn outline onClick={() => setShowEditNutri(null)}>Cancelar</Btn>
            <Btn grad onClick={saveEditNutri} disabled={saving || uploadingLogo}>{saving ? "Guardando..." : "Guardar cambios"}</Btn>
          </div>
        </Modal>
      )}

      {showNewClient && (
        <Modal title={<><Users size={20} className="text-blue-500"/> Nuevo Paciente</>} onClose={() => setShowNewClient(false)}>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 mb-4 flex items-start gap-2">
            <CheckCircle2 size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <span>Este paciente quedará asignado directamente a tu cuenta (Flux Sports).</span>
          </div>
          <Field label="Nombre completo">
            <input className={InputClass} value={formClient.nombre} onChange={e => setFormClient(p=>({...p,nombre:e.target.value}))}/>
          </Field>
          <Field label="Email">
            <input className={InputClass} type="email" value={formClient.email} onChange={e => setFormClient(p=>({...p,email:e.target.value}))}/>
          </Field>
          <Field label="Teléfono (WhatsApp)">
            <input className={InputClass} type="tel" value={formClient.telefono} onChange={e => setFormClient(p=>({...p,telefono:e.target.value}))}/>
          </Field>
          <Field label="Objetivo principal">
            <textarea className={InputClass + " min-h-[80px] resize-none"} value={formClient.objetivo} onChange={e => setFormClient(p=>({...p,objetivo:e.target.value}))} placeholder="Ej. Pérdida de grasa, hipertrofia..."/>
          </Field>
          <div className="flex gap-2.5 justify-end mt-4">
            <Btn outline onClick={() => setShowNewClient(false)}>Cancelar</Btn>
            <Btn grad onClick={createClient} disabled={saving}>{saving ? "Creando..." : "Crear paciente"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
