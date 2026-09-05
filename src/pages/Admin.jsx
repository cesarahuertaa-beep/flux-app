import { useState, useEffect, useCallback } from "react";
import { 
  Users, Folder, CalendarDays, UsersRound, Building2, 
  Search, Plus, Activity, Edit2, MessageCircle, AlertCircle, X, ShoppingBag 
} from "lucide-react";
import { AppLayout } from "../components/ui/AppLayout";
import { Biblioteca } from "../components/admin/Biblioteca";
import { ProgramarCliente } from "../components/admin/ProgramarCliente";
import { Nutriologos } from "../components/admin/Nutriologos";
import { GestionEquipo } from "../components/admin/GestionEquipo";
import { AgendaAdmin } from "../components/admin/AgendaAdmin";
import UserProfile from "../components/UserProfile";
import PerfilNutriologo from "../components/admin/PerfilNutriologo";
import GestorTienda from "../components/admin/GestorTienda";
import { authInvite, dbGet, dbPost, dbPatch, getProfileId } from "../lib/supabase";
import { useBrand } from "../components/BrandContext";

// Contenedor temporal para los sub-componentes oscuros (legacy)
// Ocupa al menos el 100% de la altura para que no se corte el fondo
const SubComponentWrapper = ({ children, title }) => (
  <div className="flex-1 flex flex-col w-full bg-[#F7F9FC] text-[#0B1929] overflow-hidden">
    {title && (
      <div className="px-4 md:px-8 py-4 border-b border-[#E2E8F0] bg-white flex items-center justify-between shadow-sm z-10 shrink-0">
        <h1 className="text-lg font-bold tracking-tight text-[#0B1929]">{title}</h1>
      </div>
    )}
    <div className="flex-1 w-full relative p-4 md:p-8 overflow-y-auto">
      {children}
    </div>
  </div>
);

export default function Admin({ onLogout, isSuperadmin, profileId, onModoAtleta, role }) {
  const brand = useBrand();
  const [tab, setTab] = useState("clientes");
  
  const [clientes, setClientes]             = useState([]);
  const [selected, setSelected]             = useState(null);
  const [loading, setLoading]               = useState(true);
  const [showNewClient, setShowNewClient]   = useState(false);
  const [newClient, setNewClient]           = useState({ nombre:"", email:"", objetivo:"", telefono:"" });
  const [editClient, setEditClient]         = useState(null);
  const [editClientForm, setEditClientForm] = useState({ nombre:"", telefono:"", objetivo:"" });
  const [saving, setSaving]                 = useState(false);
  const [msg, setMsg]                       = useState("");
  const [biblioteca, setBiblioteca]         = useState([]);
  const [nutriologoMap, setNutrioMap]       = useState({});
  const [searchClientes, setSearchClientes] = useState("");

  const myId = profileId || getProfileId();
  const clientesFilter = isSuperadmin
    ? "clientes?order=created_at.asc"
    : `clientes?nutriologo_id=eq.${myId}&order=created_at.asc`;
  const bibliotecaFilter = "biblioteca_ejercicios?order=nombre.asc";

  const loadClientes = useCallback(async () => {
    setLoading(true);
    try { const r = await dbGet(clientesFilter); setClientes(r); } catch(e) { console.error("Error cargando clientes:", e); }
    setLoading(false);
  }, [clientesFilter]);

  const loadBiblioteca = useCallback(async () => {
    try { const r = await dbGet(bibliotecaFilter); setBiblioteca(r); } catch(e) { console.error("Error cargando biblioteca:", e); }
  }, [bibliotecaFilter]);

  useEffect(() => { loadClientes(); loadBiblioteca(); }, [loadClientes, loadBiblioteca]);

  useEffect(() => {
    if (tab === "programar" && !selected) {
      setTab("clientes");
    }
  }, [tab, selected]);

  useEffect(() => {
    if (!isSuperadmin) return;
    dbGet("profiles?role=eq.nutriologo&select=id,nombre").then(rows => {
      const map = {};
      rows.forEach(r => { map[r.id] = r.nombre; });
      setNutrioMap(map);
    }).catch(() => {});
  }, [isSuperadmin]);

  const createClient = async () => {
    if (!newClient.email||!newClient.nombre) { setMsg("❌ Nombre y email son obligatorios"); return; }
    setSaving(true);
    try {
      const authUser = await authInvite(newClient.email, { role: "cliente", nombre: newClient.nombre });
      await dbPost("clientes", {
        nombre: newClient.nombre,
        objetivo: newClient.objetivo,
        email: newClient.email,
        telefono: newClient.telefono,
        auth_id: authUser.id,
        activo: true,
        nutriologo_id: myId
      });
      setShowNewClient(false); setNewClient({ nombre:"", email:"", objetivo:"", telefono:"" });
      await loadClientes(); setMsg("✅ Cliente creado - se le envió email de invitación");
    } catch(e) { setMsg("❌ "+e.message); }
    setSaving(false);
  };

  const toggleActivo = async (c) => {
    try {
      await dbPatch(`clientes?id=eq.${c.id}`, { activo:!c.activo });
      await loadClientes();
      setMsg(`✅ Cliente ${!c.activo ? "activado" : "desactivado"}`);
    } catch(e) { setMsg("❌ Error: "+e.message); }
  };

  const saveEditClient = async () => {
    setSaving(true);
    try {
      await dbPatch(`clientes?id=eq.${editClient.id}`, editClientForm);
      setMsg("✅ Cliente actualizado");
      setEditClient(null);
      loadClientes();
    } catch(e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const activarModoAtleta = async () => {
    try {
      const profiles = await dbGet(`profiles?id=eq.${myId}&select=id,nombre,email`);
      if (!profiles.length) { setMsg("❌ No se encontró tu perfil"); return; }
      const { nombre, email } = profiles[0];

      const existing = await dbGet(`clientes?nutriologo_id=eq.${myId}&email=ilike.${encodeURIComponent(email)}&limit=1`);
      let clienteRecord;
      if (existing.length) {
        clienteRecord = existing[0];
      } else {
        const created = await dbPost("clientes", {
          nombre, email,
          objetivo: "Mi entrenamiento personal",
          nutriologo_id: myId,
          activo: true,
        });
        clienteRecord = Array.isArray(created) ? created[0] : created;
      }
      onModoAtleta(clienteRecord);
    } catch(e) { setMsg("❌ " + e.message); }
  };

  const activeCount = clientes.filter(c=>c.activo).length;
  const filteredClientes = clientes.filter(c =>
    c.nombre?.toLowerCase().includes(searchClientes.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchClientes.toLowerCase())
  );

  const SIDEBAR_ITEMS = role === "administrativo"
    ? [
        { id: "clientes", label: "Clientes", icon: <Users size={18} strokeWidth={1.5} /> },
        { id: "agenda",   label: "Agenda",   icon: <CalendarDays size={18} strokeWidth={1.5} /> }
      ]
    : [
        { id: "clientes",   label: "Clientes",   icon: <Users size={18} strokeWidth={1.5} /> },
        { id: "biblioteca", label: "Biblioteca", icon: <Folder size={18} strokeWidth={1.5} /> },
        { id: "agenda",     label: "Agenda",     icon: <CalendarDays size={18} strokeWidth={1.5} /> },
        { id: "equipo",     label: "Mi Equipo",  icon: <UsersRound size={18} strokeWidth={1.5} /> },
        ...(isSuperadmin ? [
          { id: "nutriologos", label: "Nutriólogos", icon: <Building2 size={18} strokeWidth={1.5} /> },
          { id: "tienda", label: "Tienda (Admin)", icon: <ShoppingBag size={18} strokeWidth={1.5} /> }
        ] : [])
      ];

  return (
    <AppLayout
      nav={SIDEBAR_ITEMS}
      active={tab}
      setActive={setTab}
      brand={brand}
      onLogout={onLogout}
    >
      {/* Toast Notification (z-[110] para que siempre esté arriba) */}
      {msg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] animate-in slide-in-from-top-4">
          <div className="bg-white px-4 py-3 rounded-xl shadow-lg border border-[#E2E8F0] flex items-center gap-3">
            <span className="text-sm font-medium text-[#0B1929]">{msg}</span>
            <button onClick={() => setMsg("")} className="text-[#6B7A8D] hover:text-[#0B1929]">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {tab === "clientes" && (
        <div className="flex-1 flex flex-col bg-[#F7F9FC]">
          {/* Header */}
          <div className="px-6 md:px-8 pt-6 md:pt-8 pb-6 bg-white border-b border-[#F0F4FA] flex flex-col gap-4">
            {/* Cabecera superior: Título y Modo Atleta */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">
                  Panel de Administración
                </p>
                <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
                  Pacientes
                </h1>
                <p className="text-sm text-[#6B7A8D] mt-1">
                  {activeCount} pacientes activos de {clientes.length} totales
                </p>
              </div>
              
              {!isSuperadmin && (
                <button
                  onClick={activarModoAtleta}
                  className="flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs md:text-sm font-semibold text-[var(--brand-primary)] hover:bg-[#F0F4FA] transition-colors shadow-sm"
                >
                  <Activity size={16} />
                  <span className="hidden sm:inline">Modo Atleta</span>
                  <span className="sm:hidden">Atleta</span>
                </button>
              )}
            </div>
            
            {/* Controles de búsqueda y acción */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
              <div className="relative flex-1 w-full">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA5B0]" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o email..."
                  value={searchClientes}
                  onChange={(e) => setSearchClientes(e.target.value)}
                  className="w-full bg-[#F0F4FA] text-[#0B1929] text-sm rounded-xl pl-9 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-[var(--brand-primary)] transition-all placeholder:text-[#9BA5B0]"
                />
              </div>
              <button
                onClick={() => setShowNewClient(true)}
                className="flex items-center justify-center gap-2 bg-[var(--brand-primary)] text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity w-full sm:w-auto"
              >
                <Plus size={18} />
                <span>Nuevo Paciente</span>
              </button>
            </div>
          </div>

          {/* Lista de Clientes */}
          <div className="flex-1 p-6 md:p-8">
            {loading ? (
              <div className="flex h-full items-center justify-center text-[#6B7A8D]">Cargando pacientes...</div>
            ) : filteredClientes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
                <div className="w-16 h-16 bg-[#E2E8F0] rounded-full flex items-center justify-center mb-4">
                  <Users size={32} className="text-[#6B7A8D]" />
                </div>
                <h2 className="text-xl font-bold text-[#0B1929] mb-2" style={{ fontFamily: "DM Sans" }}>
                  No se encontraron pacientes
                </h2>
                <p className="text-sm text-[#6B7A8D]">Agrega un nuevo paciente para comenzar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClientes.map((c) => (
                  <div 
                    key={c.id} 
                    className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden flex flex-col hover:border-[var(--brand-primary)] transition-colors shadow-sm"
                  >
                    <div className="p-5 flex-1 relative">
                      <div className={`absolute top-0 left-0 w-1 h-full ${c.activo ? 'bg-[var(--brand-primary)]' : 'bg-red-400'}`} />
                      
                      <div className="pl-2">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-bold text-[#0B1929] text-lg leading-tight truncate pr-2">
                            {c.nombre}
                          </h3>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                            c.activo 
                              ? 'bg-[#E8F1FB] text-[var(--brand-primary)]' 
                              : 'bg-red-50 text-red-500'
                          }`}>
                            {c.activo ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                        <p className="text-xs text-[#6B7A8D] mb-3 truncate">{c.email}</p>
                        
                        <div className="text-sm text-[#4A5568] mb-4 line-clamp-2 min-h-[40px]">
                          {c.objetivo || "Sin objetivo definido"}
                        </div>

                        {c.telefono && (
                          <a 
                            href={`https://wa.me/${c.telefono.replace(/\D/g,'')}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            onClick={e => e.stopPropagation()} 
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 hover:text-green-700 bg-green-50 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            <MessageCircle size={14} /> WhatsApp
                          </a>
                        )}

                        {isSuperadmin && c.nutriologo_id && (
                          <div className="text-[10px] text-[#6B7A8D] mt-3 font-medium flex items-center gap-1">
                            <Building2 size={12} /> {nutriologoMap[c.nutriologo_id] || "Nutriólogo desconocido"}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] p-3 flex items-center gap-2">
                      {role !== "administrativo" && (
                        <button 
                          onClick={() => { setSelected(c); setTab("programar"); }}
                          className="flex-1 bg-white border border-[#E2E8F0] text-[var(--brand-primary)] px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[var(--brand-primary)] hover:text-white transition-colors"
                        >
                          Programar
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          setEditClient(c);
                          setEditClientForm({ nombre:c.nombre||"", telefono:c.telefono||"", objetivo:c.objetivo||"" });
                        }}
                        className="flex items-center justify-center bg-white border border-[#E2E8F0] text-[#6B7A8D] p-1.5 rounded-lg hover:text-[#0B1929] hover:bg-[#F0F4FA] transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => toggleActivo(c)}
                        className={`flex items-center justify-center bg-white border border-[#E2E8F0] p-1.5 rounded-lg transition-colors ${
                          c.activo ? 'text-red-500 hover:bg-red-50' : 'text-green-500 hover:bg-green-50'
                        }`}
                        title={c.activo ? "Desactivar" : "Activar"}
                      >
                        {c.activo ? <X size={16} /> : <AlertCircle size={16} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legacy Dark Mode Sub-Components */}
      {tab === "biblioteca" && <SubComponentWrapper><Biblioteca biblioteca={biblioteca} onUpdate={loadBiblioteca} setMsg={setMsg} isSuperadmin={isSuperadmin}/></SubComponentWrapper>}
      {tab === "programar" && <SubComponentWrapper title="Asignador de Dietas y Rutinas"><ProgramarCliente clientes={clientes} selected={selected} setSelected={setSelected} setMsg={setMsg} biblioteca={biblioteca} /></SubComponentWrapper>}
      {tab === "nutriologos" && isSuperadmin && <SubComponentWrapper><Nutriologos setMsg={setMsg}/></SubComponentWrapper>}
      {tab === "equipo" && role !== "administrativo" && <SubComponentWrapper><GestionEquipo setMsg={setMsg} profileId={myId}/></SubComponentWrapper>}
      {tab === "agenda" && <SubComponentWrapper><AgendaAdmin setMsg={setMsg} profileId={myId}/></SubComponentWrapper>}

      {/* Modals (z-[100] para sobreponerse a la barra móvil que tiene z-50) */}
      {showNewClient && (
        <div className="fixed inset-0 bg-[#0B1929]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0B1929]">Nuevo Paciente</h2>
              <button onClick={() => setShowNewClient(false)} className="text-[#6B7A8D] hover:text-[#0B1929]">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Nombre completo</label>
                <input value={newClient.nombre} onChange={e=>setNewClient(p=>({...p,nombre:e.target.value}))} placeholder="Ej. Ana García" className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Email</label>
                <input type="email" value={newClient.email} onChange={e=>setNewClient(p=>({...p,email:e.target.value}))} placeholder="ana@email.com" className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Teléfono (WhatsApp)</label>
                <input type="tel" value={newClient.telefono} onChange={e=>setNewClient(p=>({...p,telefono:e.target.value}))} placeholder="Ej. +525512345678" className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Objetivo</label>
                <input value={newClient.objetivo} onChange={e=>setNewClient(p=>({...p,objetivo:e.target.value}))} placeholder="Pérdida de peso, ganancia muscular..." className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors" />
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 mt-2">
                El paciente recibirá un email de invitación para crear su contraseña.
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F7F9FC] flex justify-end gap-3">
              <button onClick={() => setShowNewClient(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-[#6B7A8D] hover:bg-[#E2E8F0] transition-colors">Cancelar</button>
              <button onClick={createClient} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--brand-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
                {saving ? "Enviando..." : "Crear y enviar invitación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editClient && (
        <div className="fixed inset-0 bg-[#0B1929]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0B1929]">Editar Paciente</h2>
              <button onClick={() => setEditClient(null)} className="text-[#6B7A8D] hover:text-[#0B1929]">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Nombre completo</label>
                <input value={editClientForm.nombre} onChange={e=>setEditClientForm(p=>({...p,nombre:e.target.value}))} className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Teléfono (WhatsApp)</label>
                <input type="tel" value={editClientForm.telefono} onChange={e=>setEditClientForm(p=>({...p,telefono:e.target.value}))} placeholder="Ej. +525512345678" className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Objetivo</label>
                <input value={editClientForm.objetivo} onChange={e=>setEditClientForm(p=>({...p,objetivo:e.target.value}))} className="w-full bg-[#F0F4FA] border border-transparent focus:border-[var(--brand-primary)] text-[#0B1929] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F7F9FC] flex justify-end gap-3">
              <button onClick={() => setEditClient(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-[#6B7A8D] hover:bg-[#E2E8F0] transition-colors">Cancelar</button>
              <button onClick={saveEditClient} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--brand-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "perfil" && (
        <PerfilNutriologo profileId={myId} onLogout={onLogout} role={role} />
      )}

      {tab === "tienda" && isSuperadmin && (
        <SubComponentWrapper><GestorTienda setMsg={setMsg}/></SubComponentWrapper>
      )}
    </AppLayout>
  );
}
