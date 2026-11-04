import { useState, useEffect, useRef, useMemo } from "react";
import { CheckCircle2, XCircle, FileText, UserCheck, AlertCircle, Trash2, RotateCcw } from "lucide-react";
import { dbPeek, dbGet, dbGetFresh, dbPatch, dbDel, authInvite, authResetPassword, invalidateCache } from "../../lib/supabase";
import { ConfirmModal } from "../ui/ConfirmModal";
import { checkAndCleanOrphanedEmail } from "../../lib/authRoles";

export default function Aprobaciones({ setMsg }) {
  const [filtroEstado, setFiltroEstado] = useState("pendiente"); // "todos" | "pendiente" | "rechazada"
  const _peekSols = dbPeek("solicitudes_profesionales?order=created_at.desc");
  const [solicitudes, setSolicitudes] = useState(() => Array.isArray(_peekSols) ? _peekSols : []);
  const [loading, setLoading] = useState(() => _peekSols === null);
  const hasLoadedRef = useRef(_peekSols !== null);
  const [confirmAction, setConfirmAction] = useState(null);

  const loadData = async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const data = await dbGet(`solicitudes_profesionales?order=created_at.desc`);
      setSolicitudes(data || []);
    } catch (e) {
      setMsg("❌ Error al cargar solicitudes.");
    }
    hasLoadedRef.current = true;
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    let timer = null;
    const onCacheUpdated = (ev) => {
      const table = ev?.detail?.table;
      if (table && !["solicitudes_profesionales", "profiles", "*"].includes(table)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => loadData(), 250);
    };
    window.addEventListener("flux:cache-updated", onCacheUpdated);
    window.addEventListener("flux:synced", onCacheUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("flux:cache-updated", onCacheUpdated);
      window.removeEventListener("flux:synced", onCacheUpdated);
    };
  }, []);

  const handleApprove = (sol) => {
    setConfirmAction({
      title: `¿Aprobar a ${sol.nombre}?`,
      description: `Se registrará como ${sol.tipo} y se le enviará un correo para acceder a la plataforma.`,
      confirmText: "Aprobar",
      danger: false,
      icon: "alert",
      onConfirm: async () => {
        try {
          const cleanEmail = sol.email.trim();
          const { existingProfiles: existingProfs } = await checkAndCleanOrphanedEmail(cleanEmail);

          if (existingProfs && existingProfs.length > 0) {
            await dbPatch(`profiles?id=eq.${existingProfs[0].id}`, {
              role: sol.tipo,
              nombre: sol.nombre,
              cedula: sol.cedula || "",
              nombre_marca: sol.nombre_marca || sol.nombre,
              mapa_url: sol.mapa_url || "",
              activo: true
            });
            try { await authResetPassword(cleanEmail); } catch (e) {}
          } else {
            try {
              const authUser = await authInvite(cleanEmail, {
                role: sol.tipo,
                nombre: sol.nombre,
                nombre_marca: sol.nombre_marca || sol.nombre,
                cedula: sol.cedula || "",
                mapa_url: sol.mapa_url || ""
              });
              if (authUser?.id) {
                await dbPatch(`profiles?id=eq.${authUser.id}`, {
                  role: sol.tipo,
                  nombre: sol.nombre,
                  cedula: sol.cedula || "",
                  nombre_marca: sol.nombre_marca || sol.nombre,
                  mapa_url: sol.mapa_url || "",
                  activo: true
                });
              }
            } catch (inviteErr) {
              if (inviteErr.message?.includes("already been registered") || inviteErr.message?.includes("already exists")) {
                const profsRetry = await dbGetFresh(`profiles?email=ilike.${encodeURIComponent(cleanEmail)}`).catch(() => []);
                if (profsRetry.length > 0) {
                  await dbPatch(`profiles?id=eq.${profsRetry[0].id}`, {
                    role: sol.tipo,
                    nombre: sol.nombre,
                    cedula: sol.cedula || "",
                    nombre_marca: sol.nombre_marca || sol.nombre,
                    mapa_url: sol.mapa_url || "",
                    activo: true
                  });
                }
                try { await authResetPassword(cleanEmail); } catch (e) {}
              } else {
                throw inviteErr;
              }
            }
          }

          setSolicitudes(prev => prev.filter(s => s.id !== sol.id));
          setConfirmAction(null);
          // Al aprobar, eliminamos la solicitud de solicitudes_profesionales para no dejar filas zombie
          await dbDel(`solicitudes_profesionales?id=eq.${sol.id}`).catch(() => {});
          invalidateCache("solicitudes_profesionales");
          invalidateCache("profiles");
          setMsg("✅ Solicitud aprobada y correo de acceso enviado.");
        } catch (e) {
          setMsg("❌ Error al aprobar: " + e.message);
          loadData();
        }
      }
    });
  };

  const handleReject = (sol) => {
    setConfirmAction({
      title: `¿Rechazar a ${sol.nombre}?`,
      description: "Esta solicitud se marcará como rechazada. Podrás verla en el filtro 'Rechazadas' y eliminarla o reactivarla cuando gustes.",
      confirmText: "Rechazar",
      danger: true,
      icon: "alert",
      onConfirm: async () => {
        setSolicitudes(prev => prev.map(s => s.id === sol.id ? { ...s, estado: 'rechazada' } : s));
        setConfirmAction(null);
        try {
          await dbPatch(`solicitudes_profesionales?id=eq.${sol.id}`, { estado: 'rechazada' });
          invalidateCache("solicitudes_profesionales");
          setMsg("⚠️ Solicitud rechazada.");
        } catch (e) {
          setMsg("❌ Error al rechazar: " + e.message);
          loadData();
        }
      }
    });
  };

  const handleReactivate = async (sol) => {
    setSolicitudes(prev => prev.map(s => s.id === sol.id ? { ...s, estado: 'pendiente' } : s));
    try {
      await dbPatch(`solicitudes_profesionales?id=eq.${sol.id}`, { estado: 'pendiente' });
      invalidateCache("solicitudes_profesionales");
      setMsg("✓ Solicitud reactivada a pendiente.");
    } catch (e) {
      setMsg("❌ Error al reactivar: " + e.message);
      loadData();
    }
  };

  const handleDelete = (id) => {
    setConfirmAction({
      title: "¿Eliminar registro?",
      description: "¿Estás seguro de eliminar este registro permanentemente? El correo quedará 100% liberado.",
      confirmText: "Eliminar",
      danger: true,
      icon: "trash",
      onConfirm: async () => {
        setSolicitudes(prev => prev.filter(s => s.id !== id));
        setConfirmAction(null);
        try {
          await dbDel(`solicitudes_profesionales?id=eq.${id}`);
          invalidateCache("solicitudes_profesionales");
          setMsg("✅ Registro eliminado y correo liberado.");
        } catch (e) {
          setMsg("❌ Error al eliminar: " + e.message);
          loadData();
        }
      }
    });
  };

  const countPendientes = useMemo(() => solicitudes.filter(s => s.estado === "pendiente").length, [solicitudes]);
  const countRechazadas = useMemo(() => solicitudes.filter(s => s.estado === "rechazada").length, [solicitudes]);

  const filterOptions = useMemo(() => [
    ["todos", `Todas (${solicitudes.length})`],
    ["pendiente", `Pendientes (${countPendientes})`],
    ["rechazada", `Rechazadas (${countRechazadas})`],
  ], [solicitudes.length, countPendientes, countRechazadas]);

  const filteredSolicitudes = useMemo(() => {
    if (filtroEstado === "todos") return solicitudes;
    return solicitudes.filter(s => s.estado === filtroEstado);
  }, [solicitudes, filtroEstado]);

  if (loading) {
    return <div className="p-8 text-center text-[#6B7A8D]">Cargando solicitudes...</div>;
  }

  return (
    <div className="w-full pb-28 md:pb-8">
      {/* Barra de filtros horizontales (homologada con Agenda y Mi Equipo) */}
      <div className="mb-4">
        <div className="flex gap-2 overflow-x-auto scroll-hide pb-1 px-4 md:px-0">
          {filterOptions.map(([k, lb]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFiltroEstado(k)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                filtroEstado === k
                  ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm"
                  : "bg-white text-[#6B7A8D] border-[#E2E8F0] hover:bg-[#E8F1FB]"
              }`}
            >
              {lb}
            </button>
          ))}
        </div>
      </div>

      {filteredSolicitudes.length === 0 ? (
        <div className="mx-4 md:mx-0 text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="text-[15px] font-semibold text-[#6B7A8D]">
            {filtroEstado === "pendiente"
              ? "No hay solicitudes pendientes"
              : filtroEstado === "rechazada"
              ? "No hay solicitudes rechazadas"
              : "No hay solicitudes registradas"}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-4">
          {filteredSolicitudes.map(s => (
            <div key={s.id} className="bg-white rounded-none md:rounded-2xl p-4 sm:p-5 shadow-none md:shadow-sm border-b first:border-t md:first:border-t-0 md:border border-[#E2E8F0] flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-[#0B1929]">{s.nombre}</h3>
                  <p className="text-sm text-[#6B7A8D]">{s.email}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded-full bg-blue-50 text-blue-600 uppercase">
                    {s.tipo === 'nutriologo' ? 'Nutriólogo' : 'Estudiante de Nutrición'}
                  </span>
                  {s.estado === 'rechazada' && (
                    <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded-full bg-red-50 text-red-600 uppercase">
                      Rechazada
                    </span>
                  )}
                </div>
              </div>
              
              <div className="bg-[#F0F4FA] p-3 rounded-xl flex flex-col gap-2">
                <div className="text-sm">
                  <span className="font-bold text-[#6B7A8D]">Cédula:</span> {s.cedula || 'No especificada'}
                </div>
                <div className="text-sm">
                  <span className="font-bold text-[#6B7A8D]">Marca/Consultorio:</span> {s.nombre_marca || 'No especificada'}
                </div>
                {s.mapa_url && (
                  <a href={s.mapa_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#1A6FD4] font-medium hover:underline truncate">
                    📍 Ver Ubicación en Maps
                  </a>
                )}
                {s.documentacion_url && (
                  <a href={s.documentacion_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#1A6FD4] font-medium hover:underline truncate">
                    📄 Ver Documento Adjunto
                  </a>
                )}
              </div>

              {s.estado === "rechazada" ? (
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => handleReactivate(s)} className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer">
                    <RotateCcw size={16} /> Reactivar a Pendiente
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="w-10 bg-white border border-[#E2E8F0] hover:bg-red-50 hover:border-red-200 text-[#6B7A8D] hover:text-red-500 py-2 rounded-xl flex items-center justify-center transition-colors cursor-pointer" title="Eliminar permanentemente">
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => handleApprove(s)} className="flex-1 bg-[#10B981] hover:bg-[#059669] text-white py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer">
                    <CheckCircle2 size={16} /> Aprobar
                  </button>
                  <button onClick={() => handleReject(s)} className="flex-1 bg-white border border-[#E2E8F0] hover:bg-gray-50 text-[#6B7A8D] py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer">
                    <XCircle size={16} /> Rechazar
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="w-10 bg-white border border-[#E2E8F0] hover:bg-red-50 hover:border-red-200 text-[#6B7A8D] hover:text-red-500 py-2 rounded-xl flex items-center justify-center transition-colors cursor-pointer" title="Eliminar solicitud">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmAction?.onConfirm}
        title={confirmAction?.title}
        description={confirmAction?.description}
        confirmText={confirmAction?.confirmText || "Eliminar"}
        cancelText={confirmAction?.cancelText || "Cancelar"}
        danger={confirmAction?.danger ?? true}
        icon={confirmAction?.icon || "trash"}
      />
    </div>
  );
}
