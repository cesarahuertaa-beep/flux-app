import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { 
  Users, Folder, CalendarDays, UsersRound, Building2, 
  Search, Plus, Activity, Edit2, MessageCircle, AlertCircle, X, ShoppingBag, CreditCard, Banknote 
, UserCheck, Dumbbell, BarChart2, User, CheckCircle2, UtensilsCrossed, Camera, Trash2,
  Clock, Sparkles, ChevronDown
} from "lucide-react";
import { AppLayout } from "../components/ui/AppLayout";
import BloqueadoNutriologo from "../components/BloqueadoNutriologo";
import { authInvite, authResetPassword, dbPeek, dbGet, dbGetFresh, dbPost, dbPatch, dbDel, getProfileId, storageListFolder, storageRemoveMany, updateQueryCache, invalidateCache } from "../lib/supabase";
import { useBrand } from "../components/BrandContext";
import { CardGridSkeleton, ListSkeleton } from "../components/ui/Skeleton";
import { useBackButton } from "../lib/backButtonHandler";

import { Biblioteca } from "../components/admin/Biblioteca";
import { ProgramarCliente } from "../components/admin/ProgramarCliente";
import MiMembresiaCivil from "../components/admin/MiMembresiaCivil";
import { GestionEquipo } from "../components/admin/GestionEquipo";
import { AgendaAdmin } from "../components/admin/AgendaAdmin";
import ClienteView from "./Cliente";
import UserProfile from "../components/UserProfile";
import PerfilNutriologo from "../components/admin/PerfilNutriologo";
import Aprobaciones from "../components/admin/Aprobaciones";
import GestorTienda from "../components/admin/GestorTienda";
import MiMembresia from "../components/admin/MiMembresia";
import ControlPagos from "../components/admin/ControlPagos";
import MisComisiones from "../components/admin/MisComisiones";
import { DirectorioSuperadmin } from "../components/admin/DirectorioSuperadmin";

const sanitizeWhatsAppPhone = (phone) => {
  if (!phone) return "";
  let clean = String(phone).replace(/\D/g, "");
  if (clean.length === 10) clean = "52" + clean;
  return clean;
};

const SubComponentWrapper = ({ children, title, subtitle, eyebrow = "Panel de Administración", action }) => (
  <div className="flex-1 flex flex-col w-full bg-[#F7F9FC] text-[#0B1929] min-h-full">
    {title && (
      <div className="px-6 md:px-8 pt-6 md:pt-8 pb-6 pr-12 md:pr-8 bg-white border-b border-[#F0F4FA] flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <p className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">
            {eyebrow}
          </p>
          <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>{title}</h1>
          {subtitle && <p className="text-sm text-[#6B7A8D] mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
    )}
    <div className="flex-1 w-full relative p-4 md:p-8">
      <Suspense fallback={<ListSkeleton rows={4} />}>
        {children}
      </Suspense>
    </div>
  </div>
);

export default function Admin({ role, isSuperadmin, profileId, onLogout, onModoAtleta, onChangeRole, onRolesUpdated, multiRoles, clienteData, session }) {
  const isCivil = role ==="civil";
  const brand = useBrand();
  const { setBrandColor } = brand;
  
  const [tab, setTab] = useState(() => {
    const saved = sessionStorage.getItem("flux_admin_tab");
    return saved ? saved :"perfil";
  });

  const [visitedTabs, setVisitedTabs] = useState(() => new Set([tab]));

  useEffect(() => {
    if (tab) {
      sessionStorage.setItem("flux_admin_tab", tab);
      setVisitedTabs(prev => {
        if (prev.has(tab)) return prev;
        const next = new Set(prev);
        next.add(tab);
        return next;
      });
    }
  }, [tab]);

  useEffect(() => {
    const onNavigateTab = (e) => {
      const nextTab = e?.detail?.tab;
      if (nextTab) setTab(nextTab);
    };
    window.addEventListener("flux:navigate-tab", onNavigateTab);
    return () => window.removeEventListener("flux:navigate-tab", onNavigateTab);
  }, []);
  
  const myId = profileId || getProfileId();
  const _initClientesFilter = (isSuperadmin || role === "staff")
    ? "clientes?order=created_at.asc"
    : `clientes?nutriologo_id=eq.${myId}&order=created_at.asc`;
  const _peekClientes = dbPeek(_initClientesFilter);
  const _peekBiblio = dbPeek("biblioteca_ejercicios?order=nombre.asc");
  const _peekMe = myId ? (dbPeek(`profiles?id=eq.${myId}&select=id,nombre,email,nombre_marca,telefono,ubicacion_texto,mapa_url`) || dbPeek(`profiles?id=eq.${myId}`)) : null;

  const [clientes, setClientes] = useState(() =>
    Array.isArray(_peekClientes)
      ? _peekClientes.filter(c => c.objetivo !== "Mi entrenamiento personal")
      : []
  );
  const [selected, setSelected] = useState(() => {
    try {
      const s = sessionStorage.getItem("flux_admin_selected_client");
      return s ? JSON.parse(s) : null;
    } catch(e) { return null; }
  });

  useEffect(() => {
    if (selected) sessionStorage.setItem("flux_admin_selected_client", JSON.stringify(selected));
    else sessionStorage.removeItem("flux_admin_selected_client");
  }, [selected]);

  const [loading, setLoading]               = useState(() => _peekClientes === null);
  const [showNewClient, setShowNewClient]   = useState(false);
  const [newClient, setNewClient]           = useState({ nombre:"", email:"", objetivo:"", telefono:"" });
  const [editClient, setEditClient]         = useState(null);
  const [editClientForm, setEditClientForm] = useState({ nombre:"", telefono:"", objetivo:"" });
  const [saving, setSaving]                 = useState(false);
  const [msg, setMsg]                       = useState("");
  const [biblioteca, setBiblioteca]         = useState(() => Array.isArray(_peekBiblio) ? _peekBiblio : []);
  const [nutriologoMap, setNutrioMap]       = useState({});
  const [searchClientes, setSearchClientes] = useState("");

  const [myProfile, setMyProfile]           = useState(() => (Array.isArray(_peekMe) && _peekMe.length > 0 ? _peekMe[0] : null));
  const [retentionData, setRetentionData]   = useState({ activeCiclos: [], lastActivityMap: {} });
  const [filtroRetencion, setFiltroRetencion] = useState("todos"); // "todos" | "inactivos" | "venciendo" | "al_dia"
  const [selectedWaClient, setSelectedWaClient] = useState(null);

  const [myShadowClient, setMyShadowClient] = useState(() => {
    try {
      const s = sessionStorage.getItem(`flux_shadow_client_${myId}`);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (myShadowClient && myId) {
      try {
        sessionStorage.setItem(`flux_shadow_client_${myId}`, JSON.stringify(myShadowClient));
      } catch {}
    }
  }, [myShadowClient, myId]);

  const [bloqueado, setBloqueado] = useState(false);
  const [diasGracia, setDiasGracia] = useState(false); // true = días 11-12, mostrar alerta

  const hasCheckedPagoRef = useRef(false);
  const hasHealedShadowRef = useRef(false);

  // ── VERIFICACIÓN DE MORA (Nutriólogos y Civiles) ──
  useEffect(() => {
    const checkPago = async () => {
      if (role !== "nutriologo" && role !== "nutriologo_estudiante" && role !== "civil") return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (hasCheckedPagoRef.current) return;
      hasCheckedPagoRef.current = true;

      try {
        const today = new Date();

        const updateBloqueado = async (shouldBlock, inGrace = false) => {
          setBloqueado(shouldBlock);
          setDiasGracia(inGrace);
          try {
            const current = await dbGet(`profiles?id=eq.${myId}&select=bloqueado`);
            if (current && current.length > 0 && current[0]?.bloqueado !== shouldBlock) {
              await dbPatch(`profiles?id=eq.${myId}`, { bloqueado: shouldBlock });
            }
          } catch (e) {
            console.warn("Error actualizando bloqueado en profiles:", e);
          }
        };

        // ── LOGICA PARA CIVILES (Suscripción rolling de 30 días) ──
        if (isCivil && clienteData) {
          try {
            const fresh = await dbGet(`clientes?id=eq.${clienteData.id}&select=premium_origen,plan_tipo,activo`);
            const origen = fresh?.[0]?.premium_origen;
            if (origen === 'staff' || origen === 'patrocinado') {
              await dbPost('rpc/verificar_premium_cliente', { p_cliente: clienteData.id });
              setBloqueado(false);
              setDiasGracia(false);
              return;
            }

            const recibos = await dbGet(`recibos_pago_civil?cliente_id=eq.${clienteData.id}&order=created_at.desc`);
            const lastValid = recibos?.find(r => r.estado === 'aprobado');

            if (!lastValid) {
              if (fresh?.[0]?.plan_tipo !== 'estandar') {
                await dbPatch(`clientes?id=eq.${clienteData.id}`, { plan_tipo: 'estandar' });
              }
              setBloqueado(false);
              setDiasGracia(false);
              return;
            }

            const expirationDate = new Date(lastValid.fecha_corte_mes + "T23:59:59");
            const blockDate = new Date(expirationDate);
            blockDate.setDate(blockDate.getDate() + 2);

            if (today > blockDate) {
              if (fresh?.[0]?.plan_tipo !== 'estandar') {
                await dbPatch(`clientes?id=eq.${clienteData.id}`, { plan_tipo: 'estandar' });
              }
              setBloqueado(false);
              setDiasGracia(false);
            } else if (today > expirationDate && today <= blockDate) {
              setDiasGracia(true);
              setBloqueado(false);
            } else {
              if (fresh?.[0]?.plan_tipo !== 'premium' || !fresh?.[0]?.activo) {
                await dbPatch(`clientes?id=eq.${clienteData.id}`, { activo: true, plan_tipo: 'premium', deactivated_at: null });
              }
              setBloqueado(false);
              setDiasGracia(false);
            }
          } catch (e) {
            console.warn('Error en verificacion pago civil:', e);
          }
          return;
        }

        let firstClientDate = null;
        if (myId) {
          const firstClient = await dbGet(`clientes?nutriologo_id=eq.${myId}&objetivo=neq.Mi%20entrenamiento%20personal&order=created_at.asc&limit=1`);
          if (firstClient && firstClient.length > 0) {
            firstClientDate = new Date(firstClient[0].created_at);
          }
        }

        // ── LOGICA PARA NUTRIÓLOGO ESTUDIANTE (Suscripción rolling de 30 días + 2 de gracia) ──
        if (role === "nutriologo_estudiante") {
          const recibosEst = await dbGet(`recibos_pago?nutriologo_id=eq.${myId}&order=created_at.desc`);
          const tienePendiente = recibosEst?.some(r => r.estado === "pendiente");
          const lastApproved = recibosEst?.find(r => r.estado === "aprobado");

          if (tienePendiente || (!firstClientDate && !lastApproved)) {
            await updateBloqueado(false, false);
            return;
          }

          let expirationDate;
          if (lastApproved) {
            expirationDate = new Date(lastApproved.fecha_corte_mes + "T23:59:59");
          } else {
            expirationDate = new Date(firstClientDate);
            expirationDate.setDate(expirationDate.getDate() + 7);
            expirationDate.setHours(23, 59, 59, 999);
          }

          const blockDate = new Date(expirationDate);
          blockDate.setDate(blockDate.getDate() + 2);

          if (today > blockDate) {
            await updateBloqueado(true, false);
          } else if (today > expirationDate && today <= blockDate) {
            await updateBloqueado(false, true);
          } else {
            await updateBloqueado(false, false);
          }
          return;
        }

        // ── LOGICA PARA NUTRIÓLOGOS REGULARES (Fija los días 10) ──
        const diaCorte = 10;
        const DIA_BLOQUEO = 13;

        let lastPassedCutoff = new Date(today.getFullYear(), today.getMonth(), diaCorte);
        if (today.getDate() < diaCorte) {
          lastPassedCutoff = new Date(today.getFullYear(), today.getMonth() - 1, diaCorte);
        }

        if (!firstClientDate || firstClientDate > lastPassedCutoff) {
          await updateBloqueado(false, false);
          return;
        }

        const lastPassedCutoffStr = lastPassedCutoff.toISOString().split('T')[0];
        const recibos = await dbGet(`recibos_pago?nutriologo_id=eq.${myId}&fecha_corte_mes=eq.${lastPassedCutoffStr}`);
        const pagadoOPendiente = recibos && recibos.some(r => r.estado === 'aprobado' || r.estado === 'pendiente');

        if (pagadoOPendiente) {
          await updateBloqueado(false, false);
          return;
        }

        const diaHoy = today.getDate();
        if (today >= lastPassedCutoff && diaHoy >= DIA_BLOQUEO) {
          await updateBloqueado(true, false);
        } else if (today >= lastPassedCutoff && diaHoy > diaCorte && diaHoy < DIA_BLOQUEO) {
          await updateBloqueado(false, true);
        } else {
          await updateBloqueado(false, false);
        }

      } catch (e) {
        console.error("Error verificando pago:", e);
      }
    };

    checkPago();
  }, [myId, role, isCivil, clienteData]);

  const clientesFilter = (isSuperadmin || role ==="staff")
    ?"clientes?order=created_at.asc"
    : `clientes?nutriologo_id=eq.${myId}&order=created_at.asc`;
  const bibliotecaFilter ="biblioteca_ejercicios?order=nombre.asc";

  const loadClientes = useCallback(async ({ silent = false, forceFresh = false } = {}) => {
    if (!silent && clientes.length === 0) setLoading(true);
    let _allNutris = [];
    let _me = [];

    const getJwtEmail = () => {
      try {
        const tok = session?.token || localStorage.getItem("flux_token");
        if (!tok) return "";
        const payload = JSON.parse(atob(tok.split(".")[1]));
        return (payload.email || "").trim();
      } catch {
        return "";
      }
    };

    const findShadowCandidates = (list, myEmailNorm) => {
      return (Array.isArray(list) ? list : []).filter(c =>
        (c.nutriologo_id === myId && c.objetivo === "Mi entrenamiento personal") ||
        (c.auth_id && c.auth_id === myId) ||
        (myEmailNorm && (c.email || "").trim().toLowerCase() === myEmailNorm && (c.nutriologo_id === myId || !c.nutriologo_id))
      );
    };

    const updateState = (r, allNutris, me) => {
      const jwtEmail = getJwtEmail();
      const rawEmail = (me.length > 0 && me[0].email) ? me[0].email : jwtEmail;
      const myEmailNorm = (rawEmail || "").trim().toLowerCase();

      const nutriEmails = new Set(
        allNutris
          .map(n => (n.email || "").trim().toLowerCase())
          .filter(Boolean)
      );
      if (myEmailNorm) nutriEmails.add(myEmailNorm);

      const candidates = findShadowCandidates(r, myEmailNorm);
      if (candidates.length > 0) {
        setMyShadowClient(candidates[0]);
      }

      const shadowIds = new Set(candidates.map(c => c.id));
      setClientes(
        r.filter(c => {
          if (shadowIds.has(c.id)) return false;
          if (c.objetivo === "Mi entrenamiento personal") return false;
          const cEmail = (c.email || "").trim().toLowerCase();
          if (cEmail && nutriEmails.has(cEmail)) return false;
          return true;
        })
      );
    };

    const fetcher = forceFresh ? dbGetFresh : dbGet;
    try { 
      const [r, allNutris, me] = await Promise.all([
        fetcher(clientesFilter, (freshR) => updateState(freshR, _allNutris, _me)).catch(() => []),
        fetcher(`profiles?role=in.(nutriologo,nutriologo_estudiante,superadmin)&select=email`).catch(() => []),
        fetcher(`profiles?id=eq.${myId}&select=id,nombre,email,nombre_marca,telefono,ubicacion_texto,mapa_url`).catch(() => []),
      ]);
      _allNutris = allNutris;
      _me = me;
      if (me && me.length > 0) {
        setMyProfile(me[0]);
      }
      updateState(r, allNutris, me);

      // Consulta de retención acotada por IDs de clientes (ejecuta en <10ms en vez de escanear toda la DB)
      const clientIds = (Array.isArray(r) ? r : []).map(c => c.id).filter(Boolean);
      let activeCiclosRes = [];
      let recentProgRes = [];
      let recentMetricasRes = [];

      if (clientIds.length > 0) {
        if (!isSuperadmin && role !== "staff") {
          const cIdsParam = clientIds.slice(0, 100).join(",");
          [activeCiclosRes, recentProgRes, recentMetricasRes] = await Promise.all([
            dbGet(`ciclos?activo=eq.true&cliente_id=in.(${cIdsParam})&select=id,cliente_id,nombre,fecha_inicio,activo`).catch(() => []),
            dbGet(`progreso?cliente_id=in.(${cIdsParam})&select=cliente_id,updated_at&order=updated_at.desc&limit=500`).catch(() => []),
            dbGet(`metricas_progreso?cliente_id=in.(${cIdsParam})&select=cliente_id,fecha,created_at&order=created_at.desc&limit=500`).catch(() => [])
          ]);
        } else {
          [activeCiclosRes, recentProgRes, recentMetricasRes] = await Promise.all([
            dbGet(`ciclos?activo=eq.true&select=id,cliente_id,nombre,fecha_inicio,activo`).catch(() => []),
            dbGet(`progreso?select=cliente_id,updated_at&order=updated_at.desc&limit=1000`).catch(() => []),
            dbGet(`metricas_progreso?select=cliente_id,fecha,created_at&order=created_at.desc&limit=500`).catch(() => [])
          ]);
        }
      }

      const activityMap = {};
      if (Array.isArray(recentMetricasRes)) {
        for (const m of recentMetricasRes) {
          if (!m.cliente_id) continue;
          const dateStr = m.fecha || m.created_at;
          if (!dateStr) continue;
          const time = new Date(dateStr).getTime();
          if (!isNaN(time) && (!activityMap[m.cliente_id] || time > activityMap[m.cliente_id])) {
            activityMap[m.cliente_id] = time;
          }
        }
      }
      if (Array.isArray(recentProgRes)) {
        for (const p of recentProgRes) {
          if (!p.cliente_id) continue;
          const dateStr = p.updated_at;
          if (!dateStr) continue;
          const time = new Date(dateStr).getTime();
          if (!isNaN(time) && (!activityMap[p.cliente_id] || time > activityMap[p.cliente_id])) {
            activityMap[p.cliente_id] = time;
          }
        }
      }

      setRetentionData({
        activeCiclos: Array.isArray(activeCiclosRes) ? activeCiclosRes : [],
        lastActivityMap: activityMap
      });

      // Auto-sanar perfil de atleta sombra (reintentar hasta asegurar que myShadowClient existe)
      if (!isCivil && role !== "staff" && role !== "administrativo" && (!hasHealedShadowRef.current || !myShadowClient)) {
        const jwtEmail = getJwtEmail();
        const meProfile = (me && me.length > 0) ? me[0] : (session?.data || {});
        const trueEmail = (meProfile.email || jwtEmail || "").trim();
        const myEmailNorm = trueEmail.toLowerCase();

        if (!meProfile.email && trueEmail && myId) {
          dbPatch(`profiles?id=eq.${myId}`, { email: trueEmail }).catch(() => {});
        }

        let candidates = findShadowCandidates(r, myEmailNorm);

        // Si no está en r (ej. cuando el nutriólogo no tiene pacientes y r está vacío, o no vino por el filtro de nutriologo_id)
        if (candidates.length === 0 && myId) {
          try {
            let directDb = await dbGet(`clientes?or=(auth_id.eq.${myId},and(nutriologo_id.eq.${myId},objetivo.eq.Mi%20entrenamiento%20personal))&order=created_at.desc`).catch(() => []);
            if ((!directDb || directDb.length === 0) && myEmailNorm) {
              directDb = await dbGet(`clientes?email=ilike.${encodeURIComponent(myEmailNorm)}&order=created_at.desc`).catch(() => []);
            }
            if (directDb && directDb.length > 0) {
              candidates = directDb;
            }
          } catch (e) {
            console.warn("Error buscando shadow client directo:", e);
          }
        }

        if (candidates.length === 0 && (typeof navigator === "undefined" || navigator.onLine) && myId) {
          try {
            const created = await dbPost("clientes", {
              nombre: meProfile.nombre || "Mi Plan",
              email: trueEmail || `${myId}@flux.app`,
              auth_id: myId,
              objetivo: "Mi entrenamiento personal",
              nutriologo_id: myId,
              activo: true,
              plan_tipo: "premium"
            });
            if (created && created.length > 0) {
              setMyShadowClient(created[0]);
              hasHealedShadowRef.current = true;
            }
          } catch (err) {
            console.error("Error auto-creando perfil atleta:", err);
          }
        } else if (candidates.length > 0) {
          let primaryClone = candidates[0];
          if (candidates.length > 1) {
            const candidateChecks = await Promise.all(
              candidates.map(async (cand) => {
                try {
                  const [cics, ruts, mets] = await Promise.all([
                    dbGet(`ciclos?cliente_id=eq.${cand.id}&select=id&limit=1`).catch(() => []),
                    dbGet(`rutinas?cliente_id=eq.${cand.id}&select=id&limit=1`).catch(() => []),
                    dbGet(`metricas_progreso?cliente_id=eq.${cand.id}&select=id&limit=1`).catch(() => [])
                  ]);
                  const hasData = (cics?.length > 0) || (ruts?.length > 0) || (mets?.length > 0);
                  return { cand, hasData };
                } catch {
                  return { cand, hasData: true };
                }
              })
            );

            const withData = candidateChecks.find(x => x.hasData);
            if (withData) primaryClone = withData.cand;

            for (const item of candidateChecks) {
              if (item.cand.id !== primaryClone.id && !item.hasData && item.cand.objetivo === "Mi entrenamiento personal") {
                dbDel(`clientes?id=eq.${item.cand.id}`).catch(() => {});
              }
            }
          }

          const patchPayload = {};
          if (trueEmail && primaryClone.email !== trueEmail) patchPayload.email = trueEmail;
          if (myId && primaryClone.auth_id !== myId) patchPayload.auth_id = myId;
          if (primaryClone.nutriologo_id !== myId) patchPayload.nutriologo_id = myId;
          if (primaryClone.plan_tipo !== "premium") patchPayload.plan_tipo = "premium";
          if (!primaryClone.activo) patchPayload.activo = true;
          if (primaryClone.objetivo !== "Mi entrenamiento personal") patchPayload.objetivo = "Mi entrenamiento personal";

          if (Object.keys(patchPayload).length > 0) {
            try {
              const updated = await dbPatch(`clientes?id=eq.${primaryClone.id}`, patchPayload);
              primaryClone = (updated && updated.length > 0) ? updated[0] : { ...primaryClone, ...patchPayload };
            } catch (patchErr) {
              console.error("Error actualizando perfil atleta original:", patchErr);
            }
          }

          setMyShadowClient(primaryClone);
          hasHealedShadowRef.current = true;
        }
      }
    } catch(e) { console.error("Error cargando clientes:", e); }
    setLoading(false);
  }, [clientesFilter, myId, isCivil, role, session?.token]);

  useEffect(() => {
    if (!isCivil && !myShadowClient && ["mi_entrenamiento", "nutricion", "entrenamiento", "progreso_atleta"].includes(tab)) {
      loadClientes({ silent: true });
    }
  }, [tab, isCivil, myShadowClient, loadClientes]);

  const loadBiblioteca = useCallback(async () => {
    try { 
      const r = await dbGet(bibliotecaFilter, (freshData) => setBiblioteca(freshData)); 
      setBiblioteca(r); 
    } catch(e) { console.error("Error cargando biblioteca:", e); }
  }, [bibliotecaFilter]);

  useEffect(() => { 
    loadClientes(); 
    loadBiblioteca(); 
    let syncDebounce = null;
    const onCacheUpdated = (ev) => {
      const table = ev?.detail?.table;
      if (table && !["clientes", "profiles", "ciclos", "biblioteca_ejercicios"].includes(table)) return;
      if (syncDebounce) clearTimeout(syncDebounce);
      syncDebounce = setTimeout(() => {
        loadClientes({ silent: true });
        if (!table || table === "biblioteca_ejercicios") loadBiblioteca();
      }, 450);
    };
    window.addEventListener("flux:cache-updated", onCacheUpdated);
    window.addEventListener("flux:synced", onCacheUpdated);
    return () => {
      if (syncDebounce) clearTimeout(syncDebounce);
      window.removeEventListener("flux:cache-updated", onCacheUpdated);
      window.removeEventListener("flux:synced", onCacheUpdated);
    };
  }, [loadClientes, loadBiblioteca]);

  useEffect(() => {
    if (tab === "membresia" && isSuperadmin) {
      setTab("pagos");
    }
  }, [tab, isSuperadmin]);

  useEffect(() => {
    if (!isSuperadmin) return;
    dbGet("profiles?role=in.(nutriologo,nutriologo_estudiante)&select=id,nombre").then(rows => {
      const map = {};
      rows.forEach(r => { map[r.id] = r.nombre; });
      setNutrioMap(map);
    }).catch(() => {});
  }, [isSuperadmin]);

  const [conflictClient, setConflictClient] = useState(null);

  useBackButton(!!conflictClient, () => setConflictClient(null), 30);
  useBackButton(!!showNewClient, () => setShowNewClient(false), 20);
  useBackButton(!!editClient, () => setEditClient(null), 20);
  useBackButton(!!selectedWaClient, () => setSelectedWaClient(null), 25);
  useBackButton(!!selected, () => setSelected(null), 5);

  const createClient = async () => {
    const cleanEmail = (newClient.email || "").trim().toLowerCase();
    const cleanNombre = (newClient.nombre || "").trim();
    if (!cleanEmail || !cleanNombre) { setMsg("❌ Nombre y email son obligatorios"); return; }
    setSaving(true);
    try {
      // INTERCEPTOR: Detectar si el correo ya existe
      const existingProfiles = await dbGet(`profiles?email=ilike.${encodeURIComponent(cleanEmail)}`);
      const existingClientes = await dbGet(`clientes?email=ilike.${encodeURIComponent(cleanEmail)}`);

      // 1. Verificar si ya es paciente de ESTE mismo nutriólogo (evitar duplicados)
      const alreadyMyClient = existingClientes.find(c => c.nutriologo_id === myId);
      if (alreadyMyClient) {
        if (!alreadyMyClient.activo) {
          await dbPatch(`clientes?id=eq.${alreadyMyClient.id}`, { activo: true, deactivated_at: null });
        }
        try {
          await authResetPassword(cleanEmail);
          setMsg("✅ Este paciente ya estaba en tu lista. Se le acaba de reenviar un nuevo enlace de acceso a su correo.");
        } catch (resetErr) {
          setMsg("✅ El paciente ya está en tu lista. (" + resetErr.message + ")");
        }
        setShowNewClient(false);
        setNewClient({ nombre: "", email: "", objetivo: "", telefono: "" });
        await loadClientes();
        setSaving(false);
        return;
      }

      if (existingProfiles.length > 0 || existingClientes.length > 0) {
        const profile = existingProfiles[0];

        // Bloqueo / Consentimiento: Si es un colega o rol superior
        if (profile && ["nutriologo", "nutriologo_estudiante", "administrativo", "staff", "superadmin"].includes(profile.role)) {
          const me = await dbGet(`profiles?id=eq.${myId}`);
          const myName = me[0]?.nombre || 'Nutriólogo';

          await dbPost("solicitudes_entrenamiento", {
            from_nutriologo_id: myId,
            from_nutriologo_nombre: myName,
            to_email: cleanEmail,
            estado: "pendiente"
          });

          setMsg("✅ Solicitud de consentimiento enviada. El colega deberá aceptar desde su perfil.");
          setShowNewClient(false);
          setNewClient({ nombre: "", email: "", objetivo: "", telefono: "" });
          setSaving(false);
          return;
        }

        // Es un paciente de alguien más o un Atleta Independiente
        setConflictClient({
          profile: existingProfiles[0],
          cliente: existingClientes[0],
          email: cleanEmail,
          typedData: { nombre: cleanNombre, telefono: newClient.telefono, objetivo: newClient.objetivo }
        });
        setShowNewClient(false);
        setSaving(false);
        return;
      }

      const authUser = await authInvite(cleanEmail, { role: "cliente", nombre: cleanNombre });
      await dbPost("clientes", {
        nombre: cleanNombre,
        objetivo: newClient.objetivo,
        email: cleanEmail,
        telefono: newClient.telefono,
        auth_id: authUser.id,
        activo: true,
        nutriologo_id: myId
      });
      setShowNewClient(false); setNewClient({ nombre: "", email: "", objetivo: "", telefono: "" });
      await loadClientes(); setMsg("✅ Paciente creado — se le envió correo de invitación para crear su contraseña.");
    } catch (e) {
      if (e.message?.includes("already been registered") || e.message?.includes("already exists")) {
        try {
          const cleanEmailFallback = newClient.email.trim().toLowerCase();
          const existingCli = await dbGet(`clientes?email=ilike.${encodeURIComponent(cleanEmailFallback)}&auth_id=not.is.null`).catch(() => []);
          const existingProf = await dbGet(`profiles?email=ilike.${encodeURIComponent(cleanEmailFallback)}`).catch(() => []);
          const fallbackAuthId = existingCli[0]?.auth_id || existingProf[0]?.id || null;

          await dbPost("clientes", {
            nombre: newClient.nombre.trim(),
            objetivo: newClient.objetivo,
            email: cleanEmailFallback,
            telefono: newClient.telefono,
            auth_id: fallbackAuthId,
            activo: true,
            nutriologo_id: myId
          });
          setShowNewClient(false); setNewClient({ nombre: "", email: "", objetivo: "", telefono: "" });
          await loadClientes();
          setMsg("✅ Paciente vinculado con éxito a tu lista. Como ya tiene cuenta, podrá acceder o alternar su perfil directamente.");
        } catch (fallbackErr) {
          setMsg("❌ " + fallbackErr.message);
        }
      } else {
        setMsg("❌ " + e.message);
      }
    }
    setSaving(false);
  };

  const resolveConflict = async (useNewData) => {
    setSaving(true);
    try {
      const p = conflictClient.profile;
      const c = conflictClient.cliente;

      const finalNombre = useNewData ? conflictClient.typedData.nombre : (c?.nombre || p?.nombre || conflictClient.typedData.nombre);
      const finalTelefono = useNewData ? conflictClient.typedData.telefono : (c?.telefono || p?.telefono || conflictClient.typedData.telefono);

      let resolvedAuthId = p?.id || c?.auth_id;
      if (!resolvedAuthId) {
        const cliAuth = await dbGet(`clientes?email=ilike.${encodeURIComponent(conflictClient.email)}&auth_id=not.is.null`).catch(() => []);
        const profAuth = await dbGet(`profiles?email=ilike.${encodeURIComponent(conflictClient.email)}`).catch(() => []);
        resolvedAuthId = cliAuth[0]?.auth_id || profAuth[0]?.id || null;
      }

      // Evitar duplicado si ya existiera bajo este nutriólogo
      const existingCheck = await dbGet(`clientes?email=ilike.${encodeURIComponent(conflictClient.email)}&nutriologo_id=eq.${myId}`);
      if (existingCheck.length === 0) {
        await dbPost("clientes", {
          nombre: finalNombre,
          objetivo: conflictClient.typedData.objetivo || "Mejorar salud",
          email: conflictClient.email,
          telefono: finalTelefono,
          auth_id: resolvedAuthId,
          activo: true,
          nutriologo_id: myId
        });
      }

      // Si el cliente original no tenía auth_id vinculado y encontramos uno, actualizarlo
      if (resolvedAuthId && c?.id && !c.auth_id) {
        await dbPatch(`clientes?id=eq.${c.id}`, { auth_id: resolvedAuthId }).catch(() => {});
      }

      // Sincronizar datos si eligió actualizarlos
      if (useNewData) {
        if (p) await dbPatch(`profiles?id=eq.${p.id}`, { nombre: finalNombre, telefono: finalTelefono });
      }

      setMsg(`✅ Paciente vinculado exitosamente a tu lista.`);
      setConflictClient(null);
      setNewClient({ nombre: "", email: "", objetivo: "", telefono: "" });
      loadClientes();
    } catch (e) {
      setMsg("❌ Error al vincular paciente: " + e.message);
    }
    setSaving(false);
  };

  const resendClientAccess = async (emailToSend) => {
    if (!emailToSend) return;
    setSaving(true);
    try {
      await authResetPassword(emailToSend.trim());
      setMsg(`✅ Enlace para crear/restablecer contraseña enviado a ${emailToSend}`);
    } catch (e) {
      setMsg(`❌ ${e.message}`);
    }
    setSaving(false);
  };

  const toggleActivo = async (c) => {
    const nextActivo = !c.activo;
    const payload = { activo: nextActivo };
    if (!nextActivo) {
      payload.deactivated_at = new Date().toISOString();
    } else {
      payload.deactivated_at = null; // Limpiar si se vuelve a activar
    }

    // 1. Optimista instantáneo en 0ms
    setClientes(prev => prev.map(item => item.id === c.id ? { ...item, ...payload } : item));
    updateQueryCache("clientes", (list) => Array.isArray(list) ? list.map(item => item.id === c.id ? { ...item, ...payload } : item) : list);
    setMsg(`✓ Cliente ${nextActivo ? "activado" : "desactivado"}`);

    try {
      await dbPatch(`clientes?id=eq.${c.id}`, payload);
      invalidateCache("clientes");
    } catch (e) {
      setMsg("❌ Error:" + e.message);
      loadClientes({ silent: true, forceFresh: true });
    }
  };

  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    if (editClient) {
      setEditClientForm({
        nombre: editClient.nombre || "",
        telefono: editClient.telefono || "",
        objetivo: editClient.objetivo || ""
      });
    }
  }, [editClient]);

  const saveEditClient = async () => {
    setSaving(true);
    try {
      await dbPatch(`clientes?id=eq.${editClient.id}`, editClientForm);
      setMsg("✓ Cliente actualizado");
      setEditClient(null);
      loadClientes({ forceFresh: true });
    } catch (e) { setMsg("❌" + e.message); }
    setSaving(false);
  };

  const deleteClient = async () => {
    if (confirmDeleteText !=="ELIMINAR" || !editClient) return;
    const targetId = editClient.id;
    const targetAuthId = editClient.auth_id;
    const prevClientes = clientes;

    // 1. Cierre inmediato y actualización optimista instantánea (0 ms)
    setClientes(prev => prev.filter(c => c.id !== targetId));
    if (selected?.id === targetId) setSelected(null);
    setEditClient(null);
    setShowConfirmDelete(false);
    setConfirmDeleteText("");
    updateQueryCache("clientes", (list) => Array.isArray(list) ? list.filter(c => c.id !== targetId) : list);
    invalidateCache("clientes");
    setMsg("✓ Paciente eliminado permanentemente.");

    setSaving(true);
    try {
      // Borrar fotos de storage (progress-photos)
      const files = await storageListFolder("progress-photos", targetId);
      if (files && files.length > 0) {
        const paths = files.map(f => `${targetId}/${f.name}`);
        await storageRemoveMany("progress-photos", paths);
      }
      
      // Ejecutar borrado en BD vía RPC usando dbPost
      await dbPost("rpc/eliminar_paciente_definitivo", { p_cliente_id: targetId, p_auth_id: targetAuthId });
      loadClientes({ silent: true, forceFresh: true });
    } catch(e) {
      setClientes(prevClientes);
      setMsg("❌ Error eliminando:" + e.message);
    }
    setSaving(false);
  };

  const activarModoAtleta = async () => {
    if (myShadowClient) {
      onModoAtleta(myShadowClient);
      return;
    }
  };

  const getPatientRetention = useCallback((c) => {
    if (!c) return { isInactivo: false, isVenciendo: false, isVencido: false, daysInactive: null, daysToExpire: null, activeCycle: null, isAlDia: false, isNuevo: false };
    const now = new Date();
    
    // 1. Ciclo Activo
    const activeCycle = retentionData.activeCiclos?.find(ac => ac.cliente_id === c.id);
    let daysToExpire = null;
    let isVenciendo = false;
    let isVencido = false;
    
    if (activeCycle) {
      let semanas = 4;
      if (activeCycle.nombre && activeCycle.nombre.includes("|")) {
        const parsed = parseInt(activeCycle.nombre.split("|")[1], 10);
        if (!isNaN(parsed) && parsed > 0) semanas = parsed;
      }
      const startDate = new Date(activeCycle.fecha_inicio + "T12:00:00");
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (semanas * 7));
      const diffMs = endDate.getTime() - now.getTime();
      daysToExpire = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      isVenciendo = daysToExpire <= 3;
      isVencido = daysToExpire <= 0;
    }
    
    // 2. Inactividad
    const lastTime = retentionData.lastActivityMap?.[c.id];
    let daysInactive = null;
    let isInactivo = false;
    let isNuevo = false;
    
    if (lastTime) {
      const diffMs = now.getTime() - lastTime;
      daysInactive = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      isInactivo = daysInactive >= 5;
    } else if (c.created_at) {
      const regTime = new Date(c.created_at).getTime();
      const diffMs = now.getTime() - regTime;
      const daysSinceReg = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (daysSinceReg < 5) {
        isNuevo = true;
      } else {
        daysInactive = daysSinceReg;
        isInactivo = true;
      }
    }

    const isAlDia = !isInactivo && !isVenciendo && c.activo;

    return {
      activeCycle,
      daysToExpire,
      isVenciendo,
      isVencido,
      daysInactive,
      isInactivo,
      isNuevo,
      isAlDia
    };
  }, [retentionData]);

  const buildWhatsAppMessage = useCallback((c, templateType) => {
    const ret = getPatientRetention(c);
    const primerNombre = (c.nombre || "campeón").trim().split(" ")[0];
    const remitente = myProfile?.nombre_marca || myProfile?.nombre || "tu especialista";

    if (templateType === "inactividad") {
      const diasTxt = ret.daysInactive ? `llevas ${ret.daysInactive} días` : "llevas unos días";
      return `¡Hola ${primerNombre}! 👋 Te escribe ${remitente}. Noté que ${diasTxt} sin registrar tus comidas o entrenamientos en tu app FLUX. ¿Cómo te has sentido? ¿Se te ha complicado algún ejercicio o comida? Recuerda que estoy aquí para apoyarte y podemos hacer cualquier ajuste que necesites 💪`;
    }

    if (templateType === "renovacion") {
      const estadoCiclo = ret.isVencido 
        ? "ha finalizado" 
        : (ret.daysToExpire === 0 ? "finaliza hoy" : `está por concluir (le quedan ${ret.daysToExpire} día${ret.daysToExpire > 1 ? 's' : ''})`);
      return `¡Hola ${primerNombre}! 🎯 Te escribe ${remitente}. Tu plan actual de entrenamiento y nutrición ${estadoCiclo}. ¡Muchas felicidades por el esfuerzo y constancia en el proceso! 🚀 ¿Cuándo tienes un espacio para agendar tu cita de valoración y preparar tu siguiente ciclo con nuevos objetivos?`;
    }

    if (templateType === "bienvenida") {
      return `¡Hola ${primerNombre}! 🎉 ¡Te damos la bienvenida a FLUX! Ya tienes activo tu plan. Recuerda entrar a tu app para consultar tus rutinas de entrenamiento y nutrición. Cualquier duda que tengas sobre cómo registrar tus avances, aquí estoy para ayudarte 🙌`;
    }

    // templateType === "seguimiento" o default
    return `¡Hola ${primerNombre}! 👋 Te saluda ${remitente}. Paso a saludarte y ver cómo vas con tu plan esta semana. ¿Tienes alguna duda con tus entrenamientos o tu alimentación? ¡A seguir con toda la motivación! 💥`;
  }, [getPatientRetention, myProfile]);

  const getWhatsAppUrl = (phone, text) => {
    const cleanPhone = sanitizeWhatsAppPhone(phone);
    if (!cleanPhone) return "";
    if (!text) return `https://wa.me/${cleanPhone}`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  const activeCount = clientes.filter(c => c.activo).length;
  const inactivosCount = clientes.filter(c => c.activo && getPatientRetention(c).isInactivo).length;
  const venciendoCount = clientes.filter(c => c.activo && getPatientRetention(c).isVenciendo).length;
  const alDiaCount = clientes.filter(c => c.activo && getPatientRetention(c).isAlDia).length;

  const filteredClientes = clientes.filter(c => {
    const matchesSearch = 
      c.nombre?.toLowerCase().includes(searchClientes.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchClientes.toLowerCase());
    if (!matchesSearch) return false;

    if (filtroRetencion === "inactivos") return c.activo && getPatientRetention(c).isInactivo;
    if (filtroRetencion === "venciendo") return c.activo && getPatientRetention(c).isVenciendo;
    if (filtroRetencion === "al_dia") return c.activo && getPatientRetention(c).isAlDia;
    return true;
  });

  const SIDEBAR_ITEMS = isCivil ? [
    { id:"mi_plan",         label:"Mi Plan",       icon: <Activity size={18} strokeWidth={1.5} /> },
    { id:"nutricion",       label:"Nutrición",     icon: <UtensilsCrossed size={18} strokeWidth={1.5} /> },
    { id:"entrenamiento",   label:"Entrenamiento", icon: <Dumbbell size={18} strokeWidth={1.5} /> },
    { id:"progreso_atleta", label:"Progreso",      icon: <Camera size={18} strokeWidth={1.5} /> },
    { id:"membresia",       label:"Membresía",     icon: <CreditCard size={18} strokeWidth={1.5} /> },
  ]
  : role ==="staff"
    ? [
        { id:"clientes",   label:"Directorio", icon: <Users size={18} strokeWidth={1.5} /> },
        { id:"aprobaciones", label:"Aprobaciones", icon: <UserCheck size={18} strokeWidth={1.5} /> },
        { id:"biblioteca", label:"Biblioteca", icon: <Folder size={18} strokeWidth={1.5} /> },
        { id:"tienda",     label:"Tienda",     icon: <ShoppingBag size={18} strokeWidth={1.5} /> },
        { id:"comisiones", label:"Mis Comisiones", icon: <Banknote size={18} strokeWidth={1.5} /> }
      ]
    : role ==="administrativo"
      ? [
          { id:"clientes",   label:"Clientes", icon: <Users size={18} strokeWidth={1.5} /> },
          { id:"agenda",     label:"Agenda",   icon: <CalendarDays size={18} strokeWidth={1.5} /> },
          { id:"comisiones", label:"Mis Comisiones", icon: <Banknote size={18} strokeWidth={1.5} /> }
        ]
      : [
          { id:"clientes",   label: isSuperadmin ?"Directorio" :"Clientes",   icon: <Users size={18} strokeWidth={1.5} /> },
          { id:"agenda",     label:"Agenda",     icon: <CalendarDays size={18} strokeWidth={1.5} /> },
          { id:"equipo",     label:"Mi Equipo",  icon: <UsersRound size={18} strokeWidth={1.5} /> },
          ...(!isSuperadmin ? [
            { id:"membresia",  label:"Membresía",  icon: <CreditCard size={18} strokeWidth={1.5} /> }
          ] : []),
          ...(isSuperadmin ? [
            { id:"aprobaciones", label:"Aprobaciones", icon: <UserCheck size={18} strokeWidth={1.5} /> },
            { id:"biblioteca", label:"Biblioteca", icon: <Folder size={18} strokeWidth={1.5} /> },
            { id:"tienda", label:"Tienda", icon: <ShoppingBag size={18} strokeWidth={1.5} /> },
            { id:"pagos", label:"Control Pagos", icon: <Banknote size={18} strokeWidth={1.5} /> }
          ] : []),
          { id:"mi_entrenamiento", label:"Mi Plan", icon: <Activity size={18} strokeWidth={1.5} /> },
          { id:"nutricion",       label:"Nutrición",     icon: <UtensilsCrossed size={18} strokeWidth={1.5} /> },
          { id:"entrenamiento",   label:"Entrenamiento", icon: <Dumbbell size={18} strokeWidth={1.5} /> },
          { id:"progreso_atleta", label:"Progreso",      icon: <Camera size={18} strokeWidth={1.5} /> }
        ];

  const handlePaymentUploaded = async () => {
    setBloqueado(false);
    setDiasGracia(false);
    if (myId) {
      await dbPatch(`profiles?id=eq.${myId}`, { bloqueado: false });
    }
  };


  if (bloqueado && tab !=="membresia") {
    return <BloqueadoNutriologo onLogout={onLogout} onGoToMembresia={() => setTab("membresia")} />;
  }

  return (
    <AppLayout
      nav={SIDEBAR_ITEMS}
      active={tab}
      setActive={setTab}
      brand={brand}
      onLogout={onLogout}
      session={session}
    >
      {diasGracia && !isCivil && (
        <div className="bg-red-500 text-white p-3 text-center text-sm font-bold animate-pulse z-50 relative shrink-0 flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-yellow-200" />
          <span>Tu suscripción vence pronto. Sube tu comprobante en "Mi Membresía" antes de 48 horas para evitar la suspensión.</span>
        </div>
      )}
      {/* Toast Notification (z-[110] para que siempre esté arriba) */}
      {msg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] w-max max-w-[92vw] animate-in slide-in-from-top-4">
          <div className="bg-white px-4 py-3 rounded-xl shadow-lg border border-[#E2E8F0] flex items-center gap-3">
            <span className="text-sm font-medium text-[#0B1929] break-words min-w-0">{msg}</span>
            <button onClick={() => setMsg("")} className="text-[#6B7A8D] hover:text-[#0B1929] shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {!isCivil && tab ==="clientes" && (isSuperadmin || role ==="staff") ? (
        <Suspense fallback={<div className="p-6 md:p-8 max-w-5xl w-full mx-auto"><ListSkeleton rows={4} /></div>}>
          <DirectorioSuperadmin 
            myId={myId} 
            clientes={clientes} 
            loadClientes={loadClientes} 
            setMsg={setMsg} 
            setSelected={setSelected} 
            setTab={setTab}
            setEditClient={setEditClient}
            toggleActivo={toggleActivo}
          />
        </Suspense>
      ) : (tab === "clientes" || visitedTabs.has("clientes")) && (
        <div className={tab === "clientes" ? "flex-1 flex flex-col bg-[#F7F9FC] min-h-full" : "hidden"}>
          {/* Header */}
          <div className="px-6 md:px-8 pt-6 md:pt-8 pb-6 bg-white border-b border-[#F0F4FA] flex flex-col gap-4 pr-12 md:pr-8">
            {/* Cabecera superior: Título */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">
                  Panel de Administración
                </p>
                <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily:"DM Sans" }}>
                  Pacientes
                </h1>
                <p className="text-sm text-[#6B7A8D] mt-1">
                  {activeCount} pacientes activos de {clientes.length} totales
                </p>
              </div>
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

            {/* Píldoras de filtro por Retención y Estado */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#F0F4FA]">
              <button
                onClick={() => setFiltroRetencion("todos")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filtroRetencion === "todos"
                    ? "bg-[#0B1929] text-white shadow-sm"
                    : "bg-[#F0F4FA] text-[#6B7A8D] hover:text-[#0B1929] hover:bg-slate-200"
                }`}
              >
                Todos ({clientes.length})
              </button>
              <button
                onClick={() => setFiltroRetencion("inactivos")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filtroRetencion === "inactivos"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                }`}
              >
                <AlertCircle size={13} />
                <span>Inactivos &gt;5d ({inactivosCount})</span>
              </button>
              <button
                onClick={() => setFiltroRetencion("venciendo")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filtroRetencion === "venciendo"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                }`}
              >
                <Clock size={13} />
                <span>Por Vencer ({venciendoCount})</span>
              </button>
              <button
                onClick={() => setFiltroRetencion("al_dia")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filtroRetencion === "al_dia"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                }`}
              >
                <CheckCircle2 size={13} />
                <span>Al Día ({alDiaCount})</span>
              </button>
            </div>
          </div>

          {/* Lista de Clientes */}
          <div className="flex-1 p-6 md:p-8">
            {loading ? (
              <CardGridSkeleton count={6} />
            ) : filteredClientes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
                <div className="w-16 h-16 bg-[#E2E8F0] rounded-full flex items-center justify-center mb-4">
                  <Users size={32} className="text-[#6B7A8D]" />
                </div>
                <h2 className="text-xl font-bold text-[#0B1929] mb-2" style={{ fontFamily:"DM Sans" }}>
                  No se encontraron pacientes
                </h2>
                <p className="text-sm text-[#6B7A8D]">Agrega un nuevo paciente para comenzar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClientes.map((c) => {
                  const ret = getPatientRetention(c);
                  const barColor = !c.activo 
                    ? 'bg-slate-300' 
                    : ret.isVenciendo 
                    ? 'bg-amber-400' 
                    : ret.isInactivo 
                    ? 'bg-rose-500' 
                    : 'bg-[var(--brand-primary)]';

                  return (
                    <div 
                      key={c.id} 
                      className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden flex flex-col hover:border-[var(--brand-primary)] transition-colors shadow-sm"
                    >
                      <div className="p-5 flex-1 relative">
                        <div className={`absolute top-0 left-0 w-1.5 h-full ${barColor}`} />
                        
                        <div className="pl-2">
                          <div className="flex items-start justify-between mb-1">
                            <h3 className="font-bold text-[#0B1929] text-lg leading-tight truncate pr-2">
                              {c.nombre}
                            </h3>
                          </div>

                          {/* Badges de Estado y Retención */}
                          <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                              c.activo 
                                ? 'bg-[#E8F1FB] text-[var(--brand-primary)]' 
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {c.activo ? "Activo" : "Inactivo"}
                            </span>

                            {c.activo && ret.isVenciendo && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock size={11} />
                                {ret.isVencido 
                                  ? `Plan vencido (${Math.abs(ret.daysToExpire)}d)` 
                                  : (ret.daysToExpire === 0 ? "Vence hoy" : `Vence en ${ret.daysToExpire}d`)}
                              </span>
                            )}

                            {c.activo && ret.isInactivo && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                                <AlertCircle size={11} />
                                {ret.daysInactive ? `Inactivo (${ret.daysInactive}d)` : "Inactivo"}
                              </span>
                            )}

                            {c.activo && ret.isAlDia && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={11} />
                                Al día
                              </span>
                            )}

                            {c.activo && ret.isNuevo && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                <Sparkles size={11} />
                                Nuevo
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-[#6B7A8D] mb-3 truncate">{c.email}</p>
                          
                          <div className="text-sm text-[#4A5568] mb-4 line-clamp-2 min-h-[40px]">
                            {c.objetivo || "Sin objetivo definido"}
                          </div>

                          {/* Botón WhatsApp Inteligente a 1 Clic */}
                          {c.telefono ? (
                            <div className="inline-flex items-stretch h-9 rounded-xl overflow-hidden shadow-sm" onClick={e => e.stopPropagation()}>
                              <a 
                                href={getWhatsAppUrl(
                                  c.telefono,
                                  buildWhatsAppMessage(
                                    c, 
                                    ret.isVenciendo ? "renovacion" : (ret.isInactivo ? "inactividad" : (ret.isNuevo ? "bienvenida" : "seguimiento"))
                                  )
                                )} 
                                target="_blank" 
                                rel="noreferrer" 
                                className={`inline-flex items-center gap-1.5 text-xs font-bold text-white px-3 transition-colors ${
                                  ret.isVenciendo 
                                    ? 'bg-amber-600 hover:bg-amber-700' 
                                    : ret.isInactivo 
                                    ? 'bg-rose-600 hover:bg-rose-700' 
                                    : 'bg-[#25D366] hover:bg-[#20bd5a]'
                                }`}
                                title="Enviar mensaje por WhatsApp a 1 clic"
                              >
                                <MessageCircle size={14} className="fill-white shrink-0" />
                                <span>
                                  {ret.isVenciendo ? "Recordar Renovación" : ret.isInactivo ? "Check-in Adherencia" : "WhatsApp"}
                                </span>
                              </a>
                              <button
                                type="button"
                                onClick={() => setSelectedWaClient(c)}
                                className={`w-9 flex items-center justify-center border-l border-white/20 transition-colors text-white shrink-0 ${
                                  ret.isVenciendo 
                                    ? 'bg-amber-700 hover:bg-amber-800' 
                                    : ret.isInactivo 
                                    ? 'bg-rose-700 hover:bg-rose-800' 
                                    : 'bg-[#20bd5a] hover:bg-[#1caa50]'
                                }`}
                                title="Ver todas las plantillas de mensaje"
                              >
                                <ChevronDown size={14} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-[#9BA5B0] italic">Sin teléfono registrado</span>
                          )}

                          {isSuperadmin && c.nutriologo_id && (
                            <div className="text-[10px] text-[#6B7A8D] mt-3 font-medium flex items-center gap-1">
                              <Building2 size={12} /> {nutriologoMap[c.nutriologo_id] || "Nutriólogo desconocido"}
                            </div>
                          )}
                        </div>
                      </div>
                    
                    <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] p-3 flex items-center gap-2">
                      {role !=="administrativo" && (
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
                        title={c.activo ?"Desactivar" :"Activar"}
                      >
                        {c.activo ? <X size={16} /> : <AlertCircle size={16} />}
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-Components */}
      {(role === "superadmin" || role === "staff") && (tab === "biblioteca" || visitedTabs.has("biblioteca")) && (
        <div className={tab === "biblioteca" ? "min-h-full flex-1 flex flex-col bg-[#F7F9FC]" : "hidden"}>
          <SubComponentWrapper title="Biblioteca de Ejercicios" subtitle="Colección global de ejercicios con demostración visual">
            <Biblioteca biblioteca={biblioteca} onUpdate={loadBiblioteca} setMsg={setMsg} isSuperadmin={true}/>
          </SubComponentWrapper>
        </div>
      )}
      
      {!isCivil && (tab === "mi_entrenamiento" || visitedTabs.has("mi_entrenamiento")) && (
        <div className={tab === "mi_entrenamiento" ? "min-h-full flex-1 flex flex-col bg-[#F7F9FC]" : "hidden"}>
          <SubComponentWrapper title="Mi Plan Personal" subtitle="Gestiona tu propio plan de alimentación, rutinas y evaluaciones">
            {myShadowClient ? (
              <ProgramarCliente clientes={[myShadowClient]} selected={myShadowClient} setSelected={() => {}} setMsg={setMsg} biblioteca={biblioteca} isMiPlan={true} />
            ) : (
              <ListSkeleton rows={4} />
            )}
          </SubComponentWrapper>
        </div>
      )}

      {!isCivil && role !== "administrativo" && (tab === "programar" || visitedTabs.has("programar")) && (
        <div className={tab === "programar" ? "min-h-full flex-1 flex flex-col bg-[#F7F9FC]" : "hidden"}>
          <SubComponentWrapper
            title={selected ? null : "Asignador de Dietas y Rutinas"}
            subtitle={selected ? null : "Configura los ciclos de nutrición, entrenamiento y evaluaciones del paciente"}
          >
            <ProgramarCliente
              clientes={clientes}
              selected={selected}
              setSelected={setSelected}
              onBackToList={() => { setSelected(null); setTab("clientes"); }}
              setMsg={setMsg}
              biblioteca={biblioteca}
            />
          </SubComponentWrapper>
        </div>
      )}

      {!isCivil && role !== "administrativo" && role !== "staff" && (tab === "equipo" || visitedTabs.has("equipo")) && (
        <div className={tab === "equipo" ? "min-h-full flex-1 flex flex-col bg-[#F7F9FC]" : "hidden"}>
          <SubComponentWrapper title={isSuperadmin ? "Staff Corporativo" : "Mi Equipo"} subtitle="Administra los accesos de tus colaboradores">
            <GestionEquipo setMsg={setMsg} profileId={myId} isSuperadmin={isSuperadmin} role={role}/>
          </SubComponentWrapper>
        </div>
      )}

      {!isCivil && role !== "staff" && (tab === "agenda" || visitedTabs.has("agenda")) && (
        <div className={tab === "agenda" ? "min-h-full flex-1 flex flex-col bg-[#F7F9FC]" : "hidden"}>
          <SubComponentWrapper title="Agenda y Disponibilidad" subtitle="Gestiona tus citas programadas y horarios de atención">
            <AgendaAdmin setMsg={setMsg} profileId={myId}/>
          </SubComponentWrapper>
        </div>
      )}

      {(isSuperadmin || role === "staff") && (tab === "aprobaciones" || visitedTabs.has("aprobaciones")) && (
        <div className={tab === "aprobaciones" ? "min-h-full flex-1 flex flex-col bg-[#F7F9FC]" : "hidden"}>
          <SubComponentWrapper title="Aprobaciones" subtitle="Solicitudes de registro y verificación de especialistas">
            <Aprobaciones setMsg={setMsg} />
          </SubComponentWrapper>
        </div>
      )}

      {!isCivil && (role === "nutriologo" || role === "nutriologo_estudiante") && (tab === "membresia" || visitedTabs.has("membresia")) && (
        <div className={tab === "membresia" ? "min-h-full flex-1 flex flex-col bg-[#F7F9FC]" : "hidden"}>
          <SubComponentWrapper title="Mi Membresía" subtitle="Consulta el estado de tu suscripción y sube tus comprobantes de pago">
            <MiMembresia clientes={clientes} profileId={myId} setMsg={setMsg} onPaymentUploaded={handlePaymentUploaded} />
          </SubComponentWrapper>
        </div>
      )}

      {isSuperadmin && (tab === "pagos" || visitedTabs.has("pagos")) && (
        <div className={tab === "pagos" ? "min-h-full flex-1 flex flex-col bg-[#F7F9FC]" : "hidden"}>
          <SubComponentWrapper title="Auditoría Financiera" subtitle="Control de pagos, tarifas vigentes y comisiones de colaboradores">
            <ControlPagos setMsg={setMsg} />
          </SubComponentWrapper>
        </div>
      )}

      {(role === "staff" || role === "administrativo") && (tab === "comisiones" || visitedTabs.has("comisiones")) && (
        <div className={tab === "comisiones" ? "min-h-full flex-1 flex flex-col bg-[#F7F9FC]" : "hidden"}>
          <SubComponentWrapper title="Mis Comisiones" subtitle="Resumen de tus comisiones generadas y estado de pago">
            <MisComisiones myId={myId} setMsg={setMsg} />
          </SubComponentWrapper>
        </div>
      )}

      {/* Modals (z-[100] para sobreponerse a la barra móvil que tiene z-50) */}
      {conflictClient && (
        <div className="fixed inset-0 bg-[#0B1929]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-[#0B1929] flex items-center gap-2 mb-5">
              <AlertCircle className="w-5 h-5 text-yellow-500" /> Usuario Existente
            </h3>
            
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl text-sm mb-5">
              El correo <strong>{conflictClient.email}</strong> ya pertenece a otro paciente de la plataforma.
              <br/><br/>
              <strong>Datos Actuales:</strong><br/>
              Nombre: {conflictClient.cliente?.nombre || conflictClient.profile?.nombre ||"Sin nombre"}<br/>
              Teléfono: {conflictClient.cliente?.telefono || conflictClient.profile?.telefono ||"Sin teléfono"}
            </div>

            <p className="text-[#6B7A8D] text-sm mb-5">
              Al agregarlo a tu lista, el paciente podrá ver tus rutinas usando su misma cuenta actual. ¿Qué datos deseas usar para su expediente contigo?
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => resolveConflict(false)}
                disabled={saving}
                className="w-full text-left p-4 rounded-xl border border-[#E2E8F0] hover:border-[#3B82F6] hover:bg-blue-50 transition-colors flex items-start gap-3"
              >
                <div className="w-5 h-5 mt-0.5 rounded-full border-2 border-[#3B82F6] flex items-center justify-center"><div className="w-2.5 h-2.5 bg-[#3B82F6] rounded-full"></div></div>
                <div>
                  <div className="font-bold text-[#0B1929] text-sm">Usar sus datos actuales</div>
                  <div className="text-xs text-[#6B7A8D] mt-1">Ignora lo que escribiste y vincúlalo usando el nombre y teléfono que ya tenía registrado.</div>
                </div>
              </button>

              <button 
                onClick={() => resolveConflict(true)}
                disabled={saving}
                className="w-full text-left p-4 rounded-xl border border-[#E2E8F0] hover:border-[#3B82F6] hover:bg-blue-50 transition-colors flex items-start gap-3"
              >
                <div className="w-5 h-5 mt-0.5 rounded-full border-2 border-[#E2E8F0] flex items-center justify-center"></div>
                <div>
                  <div className="font-bold text-[#0B1929] text-sm">Actualizar todo con los datos nuevos</div>
                  <div className="text-xs text-[#6B7A8D] mt-1">Sobrescribe su nombre y teléfono globalmente usando la información que acabas de escribir.</div>
                </div>
              </button>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-[#E2E8F0]">
              <button onClick={() => setConflictClient(null)} disabled={saving} className="px-5 py-2.5 text-sm font-bold border border-[#E2E8F0] text-[#6B7A8D] rounded-xl hover:bg-[#F8FAFC]">Cancelar</button>
            </div>
          </div>
        </div>
      )}

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
                {saving ?"Enviando..." :"Crear y enviar invitación"}
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
              {editClient.email && (
                <div>
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Correo de acceso</label>
                  <input
                    type="email"
                    value={editClient.email}
                    readOnly
                    className="w-full bg-[#F0F4FA] border border-transparent text-[#0B1929] rounded-xl px-4 py-2.5 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => resendClientAccess(editClient.email)}
                    disabled={saving}
                    className="mt-2 w-full py-2 px-3 rounded-xl bg-[#F0F4FA] hover:bg-[#E2E8F0]/70 border border-[#E2E8F0] text-[var(--brand-primary)] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    📧 Reenviar correo de acceso
                  </button>
                </div>
              )}
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
            <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F7F9FC] flex flex-col gap-3">
                {showConfirmDelete ? (
                  <div className="bg-red-50 border border-red-100 p-3 rounded-xl">
                    <p className="text-red-700 text-xs font-bold mb-2">
                      Esta acción es irreversible. Se borrarán todas las fotos, planes, progreso y cuenta del paciente.
                      Escribe la palabra <strong>ELIMINAR</strong> para confirmar.
                    </p>
                    <input 
                      value={confirmDeleteText}
                      onChange={e=>setConfirmDeleteText(e.target.value)}
                      placeholder="ELIMINAR"
                      className="w-full bg-white border border-red-200 text-red-900 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-red-500 mb-2"
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={()=>setShowConfirmDelete(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#6B7A8D] hover:bg-white transition-colors">Cancelar</button>
                      <button onClick={deleteClient} disabled={confirmDeleteText !=="ELIMINAR" || saving} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                        {saving ?"Eliminando..." :"Eliminar Definitivamente"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <button onClick={() => setShowConfirmDelete(true)} className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors flex items-center gap-1">
                      <Trash2 size={14} /> Borrar Paciente
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditClient(null); setShowConfirmDelete(false); setConfirmDeleteText(""); }} className="px-4 py-2 rounded-xl text-sm font-semibold text-[#6B7A8D] hover:bg-[#E2E8F0] transition-colors">Cancelar</button>
                      <button onClick={saveEditClient} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--brand-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
                        {saving ?"Guardando..." :"Guardar cambios"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
          </div>
        </div>
      )}

      {/* Modal / Action Sheet de Plantillas WhatsApp */}
      {selectedWaClient && createPortal(
        <div 
          className="fixed inset-0 bg-[#0B1929]/50 backdrop-blur-sm z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedWaClient(null)}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#F0F4FA] flex items-center justify-between bg-white shrink-0">
              <div>
                <h3 className="font-bold text-lg text-[#0B1929] flex items-center gap-2" style={{ fontFamily: "DM Sans" }}>
                  <MessageCircle className="w-5 h-5 text-[#25D366] fill-[#25D366]" />
                  Plantillas para {selectedWaClient.nombre}
                </h3>
                <p className="text-xs text-[#6B7A8D] mt-0.5">
                  {selectedWaClient.telefono ? `WhatsApp: ${selectedWaClient.telefono}` : "Sin teléfono"}
                </p>
              </div>
              <button 
                onClick={() => setSelectedWaClient(null)} 
                className="w-8 h-8 rounded-full bg-[#F0F4FA] text-[#6B7A8D] hover:text-[#0B1929] flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body con plantillas interactivas */}
            <div className="p-5 overflow-y-auto space-y-3 bg-[#F8FAFC]">
              {/* Template 1: Check-in Adherencia */}
              {(() => {
                const ret = getPatientRetention(selectedWaClient);
                const isRec = ret.isInactivo;
                return (
                  <a
                    href={getWhatsAppUrl(selectedWaClient.telefono, buildWhatsAppMessage(selectedWaClient, "inactividad"))}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setSelectedWaClient(null)}
                    className={`block p-4 rounded-xl border transition-all text-left group bg-white ${
                      isRec 
                        ? 'border-rose-300 ring-2 ring-rose-500/20 shadow-sm' 
                        : 'border-[#E2E8F0] hover:border-[#25D366] hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-[#0B1929] flex items-center gap-1.5 group-hover:text-rose-600 transition-colors">
                        <AlertCircle size={16} className="text-rose-500" />
                        Check-in de Adherencia
                      </span>
                      {isRec && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                          Sugerido ({ret.daysInactive ? `${ret.daysInactive}d inactivo` : 'Inactivo'})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7A8D] leading-relaxed">
                      "{buildWhatsAppMessage(selectedWaClient, "inactividad")}"
                    </p>
                    <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-rose-600">
                      <span>Enviar por WhatsApp</span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </a>
                );
              })()}

              {/* Template 2: Renovación de Plan */}
              {(() => {
                const ret = getPatientRetention(selectedWaClient);
                const isRec = ret.isVenciendo;
                return (
                  <a
                    href={getWhatsAppUrl(selectedWaClient.telefono, buildWhatsAppMessage(selectedWaClient, "renovacion"))}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setSelectedWaClient(null)}
                    className={`block p-4 rounded-xl border transition-all text-left group bg-white ${
                      isRec 
                        ? 'border-amber-300 ring-2 ring-amber-500/20 shadow-sm' 
                        : 'border-[#E2E8F0] hover:border-[#25D366] hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-[#0B1929] flex items-center gap-1.5 group-hover:text-amber-600 transition-colors">
                        <Clock size={16} className="text-amber-500" />
                        Renovación de Plan / Ciclo
                      </span>
                      {isRec && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          {ret.isVencido ? 'Plan finalizado' : `Vence en ${ret.daysToExpire}d`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7A8D] leading-relaxed">
                      "{buildWhatsAppMessage(selectedWaClient, "renovacion")}"
                    </p>
                    <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-amber-600">
                      <span>Enviar por WhatsApp</span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </a>
                );
              })()}

              {/* Template 3: Saludo / Seguimiento Semanal */}
              <a
                href={getWhatsAppUrl(selectedWaClient.telefono, buildWhatsAppMessage(selectedWaClient, "seguimiento"))}
                target="_blank"
                rel="noreferrer"
                onClick={() => setSelectedWaClient(null)}
                className="block p-4 rounded-xl border border-[#E2E8F0] hover:border-[#25D366] hover:shadow-sm transition-all text-left group bg-white"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-[#0B1929] flex items-center gap-1.5 group-hover:text-emerald-600 transition-colors">
                    <Sparkles size={16} className="text-emerald-500" />
                    Saludo / Seguimiento Semanal
                  </span>
                </div>
                <p className="text-xs text-[#6B7A8D] leading-relaxed">
                  "{buildWhatsAppMessage(selectedWaClient, "seguimiento")}"
                </p>
                <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  <span>Enviar por WhatsApp</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </a>

              {/* Template 4: Chat Libre */}
              <a
                href={getWhatsAppUrl(selectedWaClient.telefono, "")}
                target="_blank"
                rel="noreferrer"
                onClick={() => setSelectedWaClient(null)}
                className="flex items-center justify-between p-3.5 rounded-xl border border-dashed border-[#CBD5E1] hover:border-[#25D366] hover:bg-emerald-50/50 transition-colors text-slate-600 hover:text-emerald-700 font-medium text-xs bg-white"
              >
                <span className="flex items-center gap-2">
                  <MessageCircle size={15} />
                  Abrir conversación en blanco (sin texto previo)
                </span>
                <span className="font-bold">Abrir chat →</span>
              </a>
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-[#F0F4FA] flex justify-end shrink-0">
              <button
                onClick={() => setSelectedWaClient(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-[#6B7A8D] hover:bg-[#F0F4FA] transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {!isCivil && (tab === "perfil" || visitedTabs.has("perfil")) && (
        <div className={tab === "perfil" ? "min-h-full flex-1 flex flex-col bg-[#F7F9FC]" : "hidden"}>
          <Suspense fallback={<div className="p-6 md:p-8 max-w-5xl w-full mx-auto"><ListSkeleton rows={4} /></div>}>
            <PerfilNutriologo profileId={myId} onLogout={onLogout} role={role} onChangeRole={onChangeRole} onRolesUpdated={onRolesUpdated} multiRoles={multiRoles} />
          </Suspense>
        </div>
      )}

      {(isSuperadmin || role === "staff") && (tab === "tienda" || visitedTabs.has("tienda")) && (
        <div className={tab === "tienda" ? "min-h-full flex-1 flex flex-col bg-[#F7F9FC]" : "hidden"}>
          <SubComponentWrapper title="Gestor de Tienda FLUX" subtitle="Administra el catálogo de productos y suplementos de la tienda">
            <GestorTienda setMsg={setMsg}/>
          </SubComponentWrapper>
        </div>
      )}
    
      {/* ════════════ CIVIL PREMIUM TABS ════════════ */}
      {isCivil && (tab === "mi_plan" || visitedTabs.has("mi_plan")) && (
        <div className={tab === "mi_plan" ? "min-h-full flex-1 flex flex-col bg-[#F7F9FC]" : "hidden"}>
          <SubComponentWrapper
            title="Mi Plan"
            subtitle="Configura tus propios ciclos de alimentación, rutinas y evaluaciones"
            eyebrow="Atleta Independiente"
          >
            {clienteData ? (
              <ProgramarCliente
                clientes={[clienteData]}
                selected={clienteData}
                setSelected={() => {}}
                setMsg={setMsg}
                biblioteca={biblioteca}
                isMiPlan={true}
              />
            ) : (
              <ListSkeleton rows={4} />
            )}
          </SubComponentWrapper>
        </div>
      )}

      {isCivil && (tab === "membresia" || visitedTabs.has("membresia")) && (
        <div className={tab === "membresia" ? "min-h-full flex-1 flex flex-col bg-[#F7F9FC]" : "hidden"}>
          <SubComponentWrapper
            title="Mi Membresía"
            subtitle="Gestiona tu suscripción mensual y sube tus comprobantes de pago"
            eyebrow="Atleta Independiente"
          >
            <MiMembresiaCivil clienteData={clienteData} setMsg={setMsg} />
          </SubComponentWrapper>
        </div>
      )}

      {isCivil && (tab === "perfil" || visitedTabs.has("perfil")) && (
        <div className={tab === "perfil" ? "min-h-full flex-1 flex flex-col bg-[#F7F9FC]" : "hidden"}>
          <Suspense fallback={<div className="p-6 md:p-8 max-w-5xl w-full mx-auto"><ListSkeleton rows={4} /></div>}>
            <UserProfile
              session={{ role:"civil", data: clienteData, profileId: profileId || clienteData?.auth_id }}
              onLogout={onLogout}
              onChangeRole={onChangeRole}
              onRolesUpdated={onRolesUpdated}
              multiRoles={multiRoles}
            />
          </Suspense>
        </div>
      )}
      {/* ════════════ END CIVIL PREMIUM TABS ════════════ */}

    
      {((tab === 'nutricion' || tab === 'entrenamiento' || tab === 'progreso_atleta') ||
        visitedTabs.has('nutricion') || visitedTabs.has('entrenamiento') || visitedTabs.has('progreso_atleta')) && (
        <div className={(tab === 'nutricion' || tab === 'entrenamiento' || tab === 'progreso_atleta') ? "flex-1 flex flex-col min-h-full" : "hidden"}>
          {(isCivil ? clienteData : myShadowClient) ? (
            <Suspense fallback={<div className="p-6 md:p-8 max-w-5xl w-full mx-auto"><ListSkeleton rows={4} /></div>}>
              <ClienteView 
                session={{ role:'cliente', data: isCivil ? clienteData : myShadowClient, token:session?.token, profileId: session?.profileId, adminRole: session?.role }}
                isAtletaMode={false}
                isEmbedded={true}
                embeddedTab={tab === 'entrenamiento' ? 'deporte' : tab === 'progreso_atleta' ? 'progreso' : 'nutricion'}
                onLogout={onLogout}
              />
            </Suspense>
          ) : (
            <div className="p-6 md:p-8 max-w-5xl w-full mx-auto">
              <ListSkeleton rows={4} />
            </div>
          )}
        </div>
      )}
</AppLayout>
  );
}


