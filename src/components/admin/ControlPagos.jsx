import React, { useState, useEffect, useMemo, useRef } from "react";
import { dbPeek, dbGet, dbPatch, dbPost, invalidateCache } from "../../lib/supabase";
import { 
  CheckCircle2, XCircle, Eye, Banknote, X, Clock, Calendar, 
  Dumbbell, Settings, Save, Zap, Search, ChevronRight, UserCheck, ShieldCheck
} from "lucide-react";
import { DEFAULT_RATES, parseTarifasHistory, getLatestConfiguredRates, getNextCutoffDateStr } from "../../utils/tarifas";
import { ListSkeleton } from "../ui/Skeleton";
import { CustomSelect } from "../ui/CustomSelect";
import { useBackButton } from "../../lib/backButtonHandler";

// ── Shared StatusBadge ──────────────────────────────────────────────────────
const StatusBadge = ({ s }) => {
  if (s === "pendiente") {
    return (
      <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 w-max">
        <Clock size={12} className="text-amber-600" /> Pendiente
      </span>
    );
  }
  if (s === "aprobado") {
    return (
      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 w-max">
        <CheckCircle2 size={12} className="text-emerald-600" /> Aprobado
      </span>
    );
  }
  if (s === "rechazado") {
    return (
      <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200/60 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 w-max">
        <XCircle size={12} className="text-red-600" /> Rechazado
      </span>
    );
  }
  return null;
};

export default function ControlPagos({ setMsg }) {
  // ── Switch principal: 'nutriologos' | 'atletas' | 'tarifas' ────────────────
  const [activeTab, setActiveTab] = useState("nutriologos");

  const _peekRecibos = dbPeek("recibos_pago?order=created_at.desc");
  const _peekCfg = dbPeek("configuracion_plataforma?id=eq.1");
  const _peekRecibosCivil = dbPeek("recibos_pago_civil?order=created_at.desc");

  // ── Estado nutriólogos ──────────────────────────────────────────────────
  const [recibos, setRecibos] = useState(() => Array.isArray(_peekRecibos) ? _peekRecibos : []);
  const [nutriologos, setNutriologos] = useState({});
  const [loading, setLoading] = useState(() => _peekRecibos === null);
  const hasLoadedRef = useRef(_peekRecibos !== null);
  const [modalImg, setModalImg] = useState(null);

  useBackButton(!!modalImg, () => setModalImg(null), 50);

  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroMes, setFiltroMes] = useState("todos");
  const [busquedaNutri, setBusquedaNutri] = useState("");

  // ── Estado atletas independientes ───────────────────────────────────────
  const [recibosCivil, setRecibosCivil] = useState(() => Array.isArray(_peekRecibosCivil) ? _peekRecibosCivil : []);
  const [clientesCivil, setClientesCivil] = useState({});
  const [loadingCivil, setLoadingCivil] = useState(() => _peekRecibosCivil === null);
  const hasLoadedCivilRef = useRef(_peekRecibosCivil !== null);
  const [filtroEstadoCivil, setFiltroEstadoCivil] = useState("todos");
  const [busquedaCivil, setBusquedaCivil] = useState("");

  // ── Estado Configuración de Tarifas y Planes ────────────────────────────
  const [rawCfg, setRawCfg] = useState(() => Array.isArray(_peekCfg) && _peekCfg.length > 0 ? _peekCfg[0] : null);
  const [savingRates, setSavingRates] = useState(false);
  const [ratesForm, setRatesForm] = useState({
    nutri_tier1: DEFAULT_RATES.nutri_tier1,
    nutri_tier2: DEFAULT_RATES.nutri_tier2,
    nutri_tier3: DEFAULT_RATES.nutri_tier3,
    nutri_estudiante: DEFAULT_RATES.nutri_estudiante,
    civil_premium: DEFAULT_RATES.civil_premium,
    admin_premium: DEFAULT_RATES.admin_premium,
    comision_pct: DEFAULT_RATES.comision_pct
  });

  const loadData = async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [dataRecibos, profiles, cfg] = await Promise.all([
        dbGet("recibos_pago?order=created_at.desc"),
        dbGet("profiles?role=in.(nutriologo,nutriologo_estudiante)&select=id,nombre,role,creado_por_nombre,email"),
        dbGet("configuracion_plataforma?id=eq.1")
      ]);
      if (cfg && cfg.length > 0) {
        setRawCfg(cfg[0]);
        const latest = getLatestConfiguredRates(cfg[0]);
        setRatesForm({
          nutri_tier1: latest.nutri_tier1,
          nutri_tier2: latest.nutri_tier2,
          nutri_tier3: latest.nutri_tier3,
          nutri_estudiante: latest.nutri_estudiante,
          civil_premium: latest.civil_premium,
          admin_premium: latest.admin_premium,
          comision_pct: latest.comision_pct
        });
      }
      const map = {};
      (profiles || []).forEach(p => { 
        map[p.id] = { nombre: p.nombre, role: p.role, creado_por: p.creado_por_nombre || null, email: p.email || "" }; 
      });
      setNutriologos(map);
      setRecibos(dataRecibos || []);
    } catch (e) {
      console.error(e);
      setMsg("❌ Error cargando pagos: " + e.message);
    }
    hasLoadedRef.current = true;
    setLoading(false);
  };

  const handleSaveRates = async (applyNow = false) => {
    setSavingRates(true);
    try {
      const history = parseTarifasHistory(rawCfg);
      const nextCutoffStr = getNextCutoffDateStr(new Date());
      const newEntry = {
        nutri_tier1: Number(ratesForm.nutri_tier1) || 0,
        nutri_tier2: Number(ratesForm.nutri_tier2) || 0,
        nutri_tier3: Number(ratesForm.nutri_tier3) || 0,
        nutri_estudiante: Number(ratesForm.nutri_estudiante) || 0,
        civil_premium: Number(ratesForm.civil_premium) || 0,
        admin_premium: Number(ratesForm.admin_premium) || 0,
        comision_pct: Number(ratesForm.comision_pct) || 0,
        effective_from: applyNow ? "2020-01-01" : nextCutoffStr,
        updated_at: new Date().toISOString()
      };

      let updatedHistory;
      if (applyNow) {
        updatedHistory = [newEntry];
      } else {
        const filteredHistory = history.filter(h => h.effective_from !== nextCutoffStr);
        updatedHistory = [...filteredHistory, newEntry].sort((a, b) =>
          (a.effective_from || "").localeCompare(b.effective_from || "")
        );
      }

      const updatedRows = await dbPatch("configuracion_plataforma?id=eq.1", {
        tarifas_config: updatedHistory
      });
      invalidateCache("configuracion_plataforma");
      if (updatedRows && updatedRows.length > 0) {
        setRawCfg(updatedRows[0]);
      } else {
        setRawCfg(prev => ({ ...(prev || {}), tarifas_config: updatedHistory }));
      }
      setMsg(applyNow
        ? "✓ Tarifas aplicadas de inmediato como tarifa base vigente hoy."
        : `✓ Tarifas guardadas. Entrarán en vigor en el próximo corte (${nextCutoffStr}) respetando adeudos anteriores.`
      );
    } catch (e) {
      setMsg("❌ Error guardando tarifas: " + e.message);
    }
    setSavingRates(false);
  };

  const loadDataCivil = async () => {
    if (!hasLoadedCivilRef.current) setLoadingCivil(true);
    try {
      const [dataRec, clientes] = await Promise.all([
        dbGet("recibos_pago_civil?order=created_at.desc"),
        dbGet("clientes?nutriologo_id=is.null&select=id,nombre,email,telefono")
      ]);
      const map = {};
      (clientes || []).forEach(c => { 
        map[c.id] = { nombre: c.nombre || "Atleta Independiente", email: c.email || "", telefono: c.telefono || "" }; 
      });
      setClientesCivil(map);
      setRecibosCivil(dataRec || []);
    } catch (e) {
      console.error("Error cargando pagos civil:", e);
    }
    hasLoadedCivilRef.current = true;
    setLoadingCivil(false);
  };

  useEffect(() => {
    loadData();
    loadDataCivil();
    let timer = null;
    const onCacheUpdated = (ev) => {
      const table = ev?.detail?.table;
      if (table && !["recibos_pago", "recibos_pago_civil", "profiles", "clientes", "configuracion_plataforma", "*"].includes(table)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { loadData(); loadDataCivil(); }, 250);
    };
    window.addEventListener("flux:cache-updated", onCacheUpdated);
    window.addEventListener("flux:synced", onCacheUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("flux:cache-updated", onCacheUpdated);
      window.removeEventListener("flux:synced", onCacheUpdated);
    };
  }, []);

  // ── Filtros Nutriólogos ─────────────────────────────────────────────────
  const mesesDisponibles = useMemo(() => {
    const setMeses = new Set();
    recibos.forEach(r => { if (r.fecha_corte_mes) setMeses.add(r.fecha_corte_mes.substring(0, 7)); });
    return Array.from(setMeses).sort().reverse();
  }, [recibos]);

  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (isInitialLoad.current && mesesDisponibles.length > 0) {
      setFiltroMes(mesesDisponibles[0]);
      isInitialLoad.current = false;
    }
  }, [mesesDisponibles]);

  const formatMes = (yyyyMm) => {
    if (yyyyMm === 'todos') return 'Todos los meses';
    const [y, m] = yyyyMm.split('-');
    return new Date(y, m - 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  };

  const filtradosNutri = useMemo(() => {
    return recibos.filter(r => {
      const matchEstado = filtroEstado === "todos" ? true : r.estado === filtroEstado;
      const matchMes = filtroMes === "todos" ? true : (r.fecha_corte_mes && r.fecha_corte_mes.startsWith(filtroMes));
      const nutri = nutriologos[r.nutriologo_id];
      const matchQuery = !busquedaNutri.trim() ? true : (
        (nutri?.nombre || "").toLowerCase().includes(busquedaNutri.toLowerCase()) ||
        (nutri?.email || "").toLowerCase().includes(busquedaNutri.toLowerCase()) ||
        (nutri?.creado_por || "").toLowerCase().includes(busquedaNutri.toLowerCase())
      );
      return matchEstado && matchMes && matchQuery;
    });
  }, [recibos, filtroEstado, filtroMes, busquedaNutri, nutriologos]);

  // Contadores Nutriólogos
  const nutriCounts = useMemo(() => {
    const base = recibos.filter(r => filtroMes === "todos" ? true : (r.fecha_corte_mes && r.fecha_corte_mes.startsWith(filtroMes)));
    return {
      todos: base.length,
      pendiente: base.filter(r => r.estado === "pendiente").length,
      aprobado: base.filter(r => r.estado === "aprobado").length,
      rechazado: base.filter(r => r.estado === "rechazado").length
    };
  }, [recibos, filtroMes]);

  // ── Filtros Civil ───────────────────────────────────────────────────────
  const filtradosCivil = useMemo(() => {
    return recibosCivil.filter(r => {
      const matchEstado = filtroEstadoCivil === "todos" ? true : r.estado === filtroEstadoCivil;
      const cliente = clientesCivil[r.cliente_id];
      const matchQuery = !busquedaCivil.trim() ? true : (
        (cliente?.nombre || "").toLowerCase().includes(busquedaCivil.toLowerCase()) ||
        (cliente?.email || "").toLowerCase().includes(busquedaCivil.toLowerCase())
      );
      return matchEstado && matchQuery;
    });
  }, [recibosCivil, filtroEstadoCivil, busquedaCivil, clientesCivil]);

  // Contadores Atletas
  const civilCounts = useMemo(() => ({
    todos: recibosCivil.length,
    pendiente: recibosCivil.filter(r => r.estado === "pendiente").length,
    aprobado: recibosCivil.filter(r => r.estado === "aprobado").length,
    rechazado: recibosCivil.filter(r => r.estado === "rechazado").length
  }), [recibosCivil]);

  // ── Acciones de validación ──────────────────────────────────────────────
  const updateEstado = async (id, nuevoEstado, nutriologoId) => {
    try {
      await dbPatch(`recibos_pago?id=eq.${id}`, { estado: nuevoEstado });
      if (nuevoEstado === "aprobado" && nutriologoId) {
        await dbPatch(`profiles?id=eq.${nutriologoId}`, { bloqueado: false });
      }

      if (nutriologoId) {
        try {
          await dbPost("notificaciones", {
            profile_id: nutriologoId,
            titulo: nuevoEstado === "aprobado" ? "Pago Aprobado" : "Pago Rechazado",
            mensaje: nuevoEstado === "aprobado" ? "Tu pago ha sido validado exitosamente. Ya tienes acceso total." : "Hubo un problema validando tu pago. Por favor revisa y vuelve a subirlo.",
            tipo: nuevoEstado === "aprobado" ? "pago" : "alerta",
            link_url: "membresia",
            entidad_id: id
          }, { headers: { Prefer: "return=minimal" } });
        } catch (notifErr) {
          console.warn("No se pudo enviar notificación de pago:", notifErr);
        }
      }

      setMsg("✓ Recibo de nutriólogo " + nuevoEstado);
      loadData();
    } catch (e) { 
      setMsg("❌ Error al actualizar: " + e.message); 
    }
  };

  const updateEstadoCivil = async (id, nuevoEstado, clienteId) => {
    try {
      await dbPatch(`recibos_pago_civil?id=eq.${id}`, { estado: nuevoEstado });
      if (nuevoEstado === "aprobado" && clienteId) {
        await dbPatch(`clientes?id=eq.${clienteId}`, { 
          activo: true, 
          deactivated_at: null, 
          plan_tipo: 'premium' 
        });
      } else if (nuevoEstado === "rechazado" && clienteId) {
        const recibos = await dbGet(`recibos_pago_civil?cliente_id=eq.${clienteId}&order=created_at.desc`);
        const lastAprobado = recibos?.find(r => r.estado === 'aprobado');
        let downgrade = false;
        if (!lastAprobado) {
          downgrade = true;
        } else {
          const today = new Date();
          const expirationDate = new Date(lastAprobado.fecha_corte_mes + "T23:59:59");
          const blockDate = new Date(expirationDate);
          blockDate.setDate(blockDate.getDate() + 2);
          if (today > blockDate) downgrade = true;
        }
        
        if (downgrade) {
          await dbPatch(`clientes?id=eq.${clienteId}`, { plan_tipo: 'estandar' });
        }
      }

      if (clienteId) {
        try {
          const cliente = await dbGet(`clientes?id=eq.${clienteId}`);
          if (cliente && cliente.length > 0 && cliente[0].auth_id) {
            await dbPost("notificaciones", {
              profile_id: cliente[0].auth_id,
              titulo: nuevoEstado === "aprobado" ? "Membresía Activada" : "Comprobante Rechazado",
              mensaje: nuevoEstado === "aprobado" ? "Tu suscripción Premium ha sido activada exitosamente." : "Hubo un problema validando tu pago. Revísalo en tu membresía.",
              tipo: nuevoEstado === "aprobado" ? "pago" : "alerta",
              link_url: "membresia",
              entidad_id: id
            }, { headers: { Prefer: "return=minimal" } });
          }
        } catch (err) {
          console.error("No se pudo notificar al atleta", err);
        }
      }

      setMsg("✓ Pago de atleta " + nuevoEstado);
      loadDataCivil();
    } catch (e) { 
      setMsg("❌ Error al actualizar: " + e.message); 
    }
  };

  // Totales
  const totalNutriCobrado = useMemo(() => {
    return filtradosNutri
      .filter(r => r.estado === "aprobado")
      .reduce((sum, r) => sum + (Number(r.monto) || 0), 0);
  }, [filtradosNutri]);

  const totalCivilCobrado = useMemo(() => {
    return filtradosCivil
      .filter(r => r.estado === "aprobado")
      .reduce((sum, r) => sum + (Number(r.monto) || 0), 0);
  }, [filtradosCivil]);

  return (
    <div className="w-full flex-1 flex flex-col">
      {/* ── Cabecera Principal Homologada ── */}
      <div className="px-4 md:px-8 pt-3 pb-2.5 md:pt-8 md:pb-6 bg-white border-b-0 md:border-b border-[#E2E8F0] flex flex-col gap-3 md:gap-4">
        <div>
          <p className="hidden md:block text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">
            Panel de Administración
          </p>
          <h1 className="text-lg md:text-2xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
            Control de Ingresos
          </h1>
          <p className="hidden md:block text-sm text-[#6B7A8D] mt-1">
            Auditoría financiera y conciliación de suscripciones de nutriólogos y atletas independientes
          </p>
        </div>

        {/* Barra de Búsqueda de Ancho Completo + Selector de Mes Integrado */}
        {activeTab !== "tarifas" && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full">
            <div className="relative flex-1 min-w-0">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA5B0]" />
              <input
                type="text"
                placeholder={activeTab === "nutriologos" ? "Buscar por nutriólogo o staff que invitó..." : "Buscar por atleta o email..."}
                value={activeTab === "nutriologos" ? busquedaNutri : busquedaCivil}
                onChange={(e) => activeTab === "nutriologos" ? setBusquedaNutri(e.target.value) : setBusquedaCivil(e.target.value)}
                className="w-full pl-9 pr-8 py-2 md:py-2.5 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl text-xs sm:text-[13px] text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] focus:bg-white focus:ring-1 focus:ring-[var(--brand-primary)] placeholder:text-[#9BA5B0] transition-all font-['Inter',sans-serif]"
              />
              {(activeTab === "nutriologos" ? busquedaNutri : busquedaCivil) && (
                <button
                  type="button"
                  onClick={() => activeTab === "nutriologos" ? setBusquedaNutri("") : setBusquedaCivil("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9BA5B0] hover:text-[#0B1929] p-0.5 rounded transition-colors cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Selector de Mes para Nutriólogos */}
            {activeTab === "nutriologos" && (
              <div className="flex items-center gap-2 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl px-3 py-2 md:py-2.5 shrink-0 shadow-2xs">
                <Calendar size={15} className="text-[#6B7A8D] shrink-0" />
                <CustomSelect
                  title="Filtrar por mes de corte"
                  value={filtroMes}
                  onChange={(v) => setFiltroMes(v)}
                  className="bg-transparent text-xs sm:text-[13px] font-bold text-[#0B1929] focus:outline-none cursor-pointer capitalize border-none p-0 shadow-none"
                  options={[
                    { value: "todos", label: "Todos los meses" },
                    ...mesesDisponibles.map((m) => ({ value: m, label: formatMes(m) })),
                  ]}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Switch Principal de Pestañas Homologado ── */}
      <div className="flex items-center gap-2 overflow-x-auto scroll-hide px-4 md:px-8 pt-2 md:pt-4 pb-1">
        <div className="flex gap-1 bg-[#F0F4FA] p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("nutriologos")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "nutriologos"
                ? "bg-white text-[var(--brand-primary)] shadow-sm font-bold"
                : "text-[#6B7A8D] hover:text-[#0B1929]"
            }`}
          >
            <Banknote size={15} />
            <span>Nutriólogos</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === "nutriologos" ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]" : "bg-white/60 text-[#6B7A8D]"
            }`}>
              {recibos.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("atletas")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "atletas"
                ? "bg-white text-[var(--brand-primary)] shadow-sm font-bold"
                : "text-[#6B7A8D] hover:text-[#0B1929]"
            }`}
          >
            <Dumbbell size={15} />
            <span>Atletas Independientes</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === "atletas" ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]" : "bg-white/60 text-[#6B7A8D]"
            }`}>
              {recibosCivil.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tarifas")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "tarifas"
                ? "bg-white text-[var(--brand-primary)] shadow-sm font-bold"
                : "text-[#6B7A8D] hover:text-[#0B1929]"
            }`}
          >
            <Settings size={15} />
            <span>Tarifas y Planes</span>
          </button>
        </div>
      </div>

      {/* ── Pills de Filtro por Estado (solo para listas de recibos) ── */}
      {activeTab === "nutriologos" && (
        <div className="flex items-center gap-1.5 overflow-x-auto scroll-hide px-4 md:px-8 py-2 md:py-3">
          {[
            { key: "todos", label: `Todos (${nutriCounts.todos})` },
            { key: "pendiente", label: `Pendientes (${nutriCounts.pendiente})` },
            { key: "aprobado", label: `Aprobados (${nutriCounts.aprobado})` },
            { key: "rechazado", label: `Rechazados (${nutriCounts.rechazado})` },
          ].map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => setFiltroEstado(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                filtroEstado === p.key
                  ? "bg-[var(--brand-primary)] text-white shadow-2xs"
                  : "bg-white border border-[#E2E8F0] text-[#6B7A8D] hover:text-[#0B1929] hover:bg-[#F8FAFC]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === "atletas" && (
        <div className="flex items-center gap-1.5 overflow-x-auto scroll-hide px-4 md:px-8 py-2 md:py-3">
          {[
            { key: "todos", label: `Todos (${civilCounts.todos})` },
            { key: "pendiente", label: `Pendientes (${civilCounts.pendiente})` },
            { key: "aprobado", label: `Aprobados (${civilCounts.aprobado})` },
            { key: "rechazado", label: `Rechazados (${civilCounts.rechazado})` },
          ].map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => setFiltroEstadoCivil(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                filtroEstadoCivil === p.key
                  ? "bg-[var(--brand-primary)] text-white shadow-2xs"
                  : "bg-white border border-[#E2E8F0] text-[#6B7A8D] hover:text-[#0B1929] hover:bg-[#F8FAFC]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* ── CUERPO PRINCIPAL SEGÚN PESTAÑA ACTIVA ── */}
      <div className="px-4 md:px-8 pb-28 md:pb-12 pt-1 md:pt-2">

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* PESTAÑA 1: NUTRIÓLOGOS                                                 */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "nutriologos" && (
          <div className="space-y-4">
            {/* Banner de Total Conciliado del Mes */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                  <Banknote size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">
                    Total Facturado Nutriólogos {filtroMes !== "todos" ? `(${formatMes(filtroMes)})` : "(Histórico)"}
                  </div>
                  <div className="text-xl md:text-2xl font-black text-[#0B1929]">
                    ${totalNutriCobrado.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-[#6B7A8D] self-end sm:self-auto">
                <span className="font-semibold">{filtradosNutri.length} comprobante{filtradosNutri.length !== 1 ? 's' : ''} filtrados</span>
              </div>
            </div>

            {/* Tabla Desktop y Tarjetas Móviles */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
              {loading ? (
                <div className="p-6"><ListSkeleton rows={4} /></div>
              ) : (
                <>
                  {/* Vista Desktop (Tabla) */}
                  <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                          <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Fecha / Hora</th>
                          <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Especialista</th>
                          <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Mes de Corte</th>
                          <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-right">Monto</th>
                          <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Estado</th>
                          <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filtradosNutri.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="py-12 text-center text-[#6B7A8D] text-sm">
                              No se encontraron recibos de nutriólogos en esta vista.
                            </td>
                          </tr>
                        ) : filtradosNutri.map((r) => {
                          const nutri = nutriologos[r.nutriologo_id];
                          return (
                            <tr key={r.id} className="hover:bg-[#F8FAFC]/70 transition-colors">
                              <td className="py-3.5 px-6 text-sm text-[#0B1929]">
                                <span className="font-semibold block">{new Date(r.created_at).toLocaleDateString('es-MX')}</span>
                                <span className="text-xs text-[#6B7A8D]">{new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                              </td>
                              <td className="py-3.5 px-6">
                                <div className="font-bold text-[#0B1929]">{nutri?.nombre || "Nutriólogo"}</div>
                                <div className="text-xs text-[#6B7A8D] flex items-center gap-1.5">
                                  {nutri?.email && <span>{nutri.email}</span>}
                                  {nutri?.creado_por && (
                                    <span className="text-[11px] text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded font-medium">
                                      Por: {nutri.creado_por}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-6 text-sm text-center font-medium text-[#475569] capitalize">
                                {r.fecha_corte_mes ? new Date(r.fecha_corte_mes.includes("T") ? r.fecha_corte_mes : `${r.fecha_corte_mes}T12:00:00`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }) : 'N/A'}
                              </td>
                              <td className="py-3.5 px-6 font-black text-emerald-600 text-right text-base">
                                ${Number(r.monto || 0).toFixed(2)}
                              </td>
                              <td className="py-3.5 px-6 text-center">
                                <div className="flex justify-center">
                                  <StatusBadge s={r.estado} />
                                </div>
                              </td>
                              <td className="py-3.5 px-6 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setModalImg(r.comprobante_url)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                                    title="Ver comprobante"
                                  >
                                    <Eye size={17} />
                                  </button>
                                  {r.estado === "pendiente" && (
                                    <>
                                      <button
                                        onClick={() => updateEstado(r.id, "aprobado", r.nutriologo_id)}
                                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                                        title="Aprobar pago"
                                      >
                                        <CheckCircle2 size={17} />
                                      </button>
                                      <button
                                        onClick={() => updateEstado(r.id, "rechazado", r.nutriologo_id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                        title="Rechazar pago"
                                      >
                                        <XCircle size={17} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Vista Móvil (Tarjetas Homologadas) */}
                  <div className="md:hidden flex flex-col divide-y divide-gray-100">
                    {filtradosNutri.length === 0 ? (
                      <div className="py-10 text-center text-[#6B7A8D] text-sm">
                        No se encontraron recibos de nutriólogos.
                      </div>
                    ) : filtradosNutri.map((r) => {
                      const nutri = nutriologos[r.nutriologo_id];
                      return (
                        <div key={r.id} className="p-4 flex flex-col gap-2.5 hover:bg-[#F8FAFC]/50 transition-colors">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className="font-bold text-[#0B1929] text-sm">
                                {nutri?.nombre || "Nutriólogo"}
                              </div>
                              {nutri?.creado_por && (
                                <div className="text-[11px] text-indigo-600 font-medium">
                                  Invitado por: {nutri.creado_por}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-black text-emerald-600 text-sm">
                                ${Number(r.monto || 0).toFixed(2)}
                              </span>
                              <StatusBadge s={r.estado} />
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-xs text-[#6B7A8D] pt-1">
                            <div>
                              <span>{new Date(r.created_at).toLocaleDateString('es-MX')}</span> · <span>{new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="font-medium text-[#475569] capitalize">
                              {r.fecha_corte_mes ? new Date(r.fecha_corte_mes.includes("T") ? r.fecha_corte_mes : `${r.fecha_corte_mes}T12:00:00`).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }) : 'N/A'}
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 mt-1">
                            <button
                              onClick={() => setModalImg(r.comprobante_url)}
                              className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Eye size={14} /> Ver Comprobante
                            </button>
                            {r.estado === "pendiente" && (
                              <>
                                <button
                                  onClick={() => updateEstado(r.id, "aprobado", r.nutriologo_id)}
                                  className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle2 size={14} /> Aprobar
                                </button>
                                <button
                                  onClick={() => updateEstado(r.id, "rechazado", r.nutriologo_id)}
                                  className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <XCircle size={14} /> Rechazar
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* PESTAÑA 2: ATLETAS INDEPENDIENTES                                     */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "atletas" && (
          <div className="space-y-4">
            {/* Banner de Total Conciliado Atletas */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center shrink-0 border border-blue-100">
                  <Dumbbell size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">
                    Total Cobrado Atletas Independientes Premium (100% Superadmin)
                  </div>
                  <div className="text-xl md:text-2xl font-black text-[#0B1929]">
                    ${totalCivilCobrado.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-[#6B7A8D] self-end sm:self-auto">
                <span className="font-semibold">{filtradosCivil.length} comprobante{filtradosCivil.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Tabla Desktop y Tarjetas Móviles */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
              {loadingCivil ? (
                <div className="p-6"><ListSkeleton rows={4} /></div>
              ) : (
                <>
                  {/* Vista Desktop (Tabla) */}
                  <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                          <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Fecha / Hora</th>
                          <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Atleta</th>
                          <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Mes Facturado</th>
                          <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-right">Monto</th>
                          <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Estado</th>
                          <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filtradosCivil.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="py-12 text-center text-[#6B7A8D] text-sm">
                              {recibosCivil.length === 0 ? "Aún no hay comprobantes de atletas independientes." : "No hay recibos en esta categoría."}
                            </td>
                          </tr>
                        ) : filtradosCivil.map((r) => {
                          const cli = clientesCivil[r.cliente_id];
                          return (
                            <tr key={r.id} className="hover:bg-[#F8FAFC]/70 transition-colors">
                              <td className="py-3.5 px-6 text-sm text-[#0B1929]">
                                <span className="font-semibold block">{new Date(r.created_at).toLocaleDateString('es-MX')}</span>
                                <span className="text-xs text-[#6B7A8D]">{new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                              </td>
                              <td className="py-3.5 px-6">
                                <div className="font-bold text-[#0B1929]">{cli?.nombre || "Atleta Independiente"}</div>
                                <div className="text-xs text-[#6B7A8D]">{cli?.email || "Sin email"}</div>
                              </td>
                              <td className="py-3.5 px-6 text-sm text-center font-medium text-[#475569] capitalize">
                                {r.fecha_corte_mes ? new Date(r.fecha_corte_mes.includes("T") ? r.fecha_corte_mes : `${r.fecha_corte_mes}T12:00:00`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }) : 'N/A'}
                              </td>
                              <td className="py-3.5 px-6 font-black text-emerald-600 text-right text-base">
                                ${Number(r.monto || 0).toFixed(2)}
                              </td>
                              <td className="py-3.5 px-6 text-center">
                                <div className="flex justify-center">
                                  <StatusBadge s={r.estado} />
                                </div>
                              </td>
                              <td className="py-3.5 px-6 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {r.comprobante_url && (
                                    <button
                                      onClick={() => setModalImg(r.comprobante_url)}
                                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                                      title="Ver comprobante"
                                    >
                                      <Eye size={17} />
                                    </button>
                                  )}
                                  {r.estado === "pendiente" && (
                                    <>
                                      <button
                                        onClick={() => updateEstadoCivil(r.id, "aprobado", r.cliente_id)}
                                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                                        title="Aprobar pago"
                                      >
                                        <CheckCircle2 size={17} />
                                      </button>
                                      <button
                                        onClick={() => updateEstadoCivil(r.id, "rechazado", r.cliente_id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                        title="Rechazar pago"
                                      >
                                        <XCircle size={17} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Vista Móvil (Tarjetas Homologadas) */}
                  <div className="md:hidden flex flex-col divide-y divide-gray-100">
                    {filtradosCivil.length === 0 ? (
                      <div className="py-10 text-center text-[#6B7A8D] text-sm">
                        {recibosCivil.length === 0 ? "Aún no hay comprobantes de atletas independientes." : "No hay recibos en esta categoría."}
                      </div>
                    ) : filtradosCivil.map((r) => {
                      const cli = clientesCivil[r.cliente_id];
                      return (
                        <div key={r.id} className="p-4 flex flex-col gap-2.5 hover:bg-[#F8FAFC]/50 transition-colors">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className="font-bold text-[#0B1929] text-sm">
                                {cli?.nombre || "Atleta Independiente"}
                              </div>
                              <div className="text-[11px] text-[var(--brand-primary)] font-medium">
                                Plan Premium Independiente
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-black text-emerald-600 text-sm">
                                ${Number(r.monto || 0).toFixed(2)}
                              </span>
                              <StatusBadge s={r.estado} />
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-xs text-[#6B7A8D] pt-1">
                            <div>
                              <span>{new Date(r.created_at).toLocaleDateString('es-MX')}</span> · <span>{new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="font-medium text-[#475569] capitalize">
                              {r.fecha_corte_mes ? new Date(r.fecha_corte_mes.includes("T") ? r.fecha_corte_mes : `${r.fecha_corte_mes}T12:00:00`).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }) : 'N/A'}
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 mt-1">
                            {r.comprobante_url && (
                              <button
                                onClick={() => setModalImg(r.comprobante_url)}
                                className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Eye size={14} /> Ver Comprobante
                              </button>
                            )}
                            {r.estado === "pendiente" && (
                              <>
                                <button
                                  onClick={() => updateEstadoCivil(r.id, "aprobado", r.cliente_id)}
                                  className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle2 size={14} /> Aprobar
                                </button>
                                <button
                                  onClick={() => updateEstadoCivil(r.id, "rechazado", r.cliente_id)}
                                  className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <XCircle size={14} /> Rechazar
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* PESTAÑA 3: CONFIGURACIÓN DE TARIFAS Y PLANES                          */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "tarifas" && (
          <div className="space-y-5 animate-in fade-in">
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 md:p-6 shadow-2xs space-y-6">
              <div>
                <h2 className="text-base md:text-lg font-bold text-[#0B1929] flex items-center gap-2">
                  <Settings size={20} className="text-[var(--brand-primary)]" />
                  Costos por Perfil, Planes y Tarifas de Suscripción
                </h2>
                <p className="text-xs md:text-sm text-[#6B7A8D] mt-1">
                  Define los precios oficiales para Nutriólogos por nivel de pacientes, estudiantes y atletas independientes.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Perfil Nutriólogo */}
                <div className="bg-[#F8FAFC] p-4.5 rounded-xl border border-[#E2E8F0] space-y-3.5">
                  <div className="flex items-center justify-between border-b border-gray-200/70 pb-2.5">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#0B1929]">1. Nutriólogos</span>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">Por paciente</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs font-semibold text-[#475569]">Nivel 1 (1 – 20 pac.)</label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#6B7A8D]">$</span>
                        <input
                          type="number"
                          min="0"
                          value={ratesForm.nutri_tier1}
                          onChange={e => setRatesForm(p => ({ ...p, nutri_tier1: e.target.value }))}
                          className="w-24 bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-sm font-bold text-[#0B1929] text-right outline-none focus:border-[var(--brand-primary)]"
                        />
                        <span className="text-[11px] text-[#6B7A8D]">MXN</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs font-semibold text-[#475569]">Nivel 2 (21 – 50 pac.)</label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#6B7A8D]">$</span>
                        <input
                          type="number"
                          min="0"
                          value={ratesForm.nutri_tier2}
                          onChange={e => setRatesForm(p => ({ ...p, nutri_tier2: e.target.value }))}
                          className="w-24 bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-sm font-bold text-[#0B1929] text-right outline-none focus:border-[var(--brand-primary)]"
                        />
                        <span className="text-[11px] text-[#6B7A8D]">MXN</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs font-semibold text-[#475569]">Nivel 3 (51+ pac.)</label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#6B7A8D]">$</span>
                        <input
                          type="number"
                          min="0"
                          value={ratesForm.nutri_tier3}
                          onChange={e => setRatesForm(p => ({ ...p, nutri_tier3: e.target.value }))}
                          className="w-24 bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-sm font-bold text-[#0B1929] text-right outline-none focus:border-[var(--brand-primary)]"
                        />
                        <span className="text-[11px] text-[#6B7A8D]">MXN</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-200/70 flex items-center justify-between gap-3">
                      <div>
                        <label className="block text-xs font-bold text-amber-700">Nutriólogo Estudiante</label>
                        <span className="text-[10px] text-[#6B7A8D]">Mensualidad fija (30 días)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#6B7A8D]">$</span>
                        <input
                          type="number"
                          min="0"
                          value={ratesForm.nutri_estudiante}
                          onChange={e => setRatesForm(p => ({ ...p, nutri_estudiante: e.target.value }))}
                          className="w-24 bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-sm font-bold text-[#0B1929] text-right outline-none focus:border-[var(--brand-primary)]"
                        />
                        <span className="text-[11px] text-[#6B7A8D]">MXN</span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-gray-200/70 flex items-center justify-between gap-3">
                      <div>
                        <label className="block text-xs font-bold text-indigo-700">Administrativo Extra</label>
                        <span className="text-[10px] text-[#6B7A8D]">Por administrativo patrocinado</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#6B7A8D]">$</span>
                        <input
                          type="number"
                          min="0"
                          value={ratesForm.admin_premium}
                          onChange={e => setRatesForm(p => ({ ...p, admin_premium: e.target.value }))}
                          className="w-24 bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-sm font-bold text-[#0B1929] text-right outline-none focus:border-[var(--brand-primary)]"
                        />
                        <span className="text-[11px] text-[#6B7A8D]">MXN</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Perfil Atleta Independiente */}
                <div className="bg-[#F8FAFC] p-4.5 rounded-xl border border-[#E2E8F0] space-y-3.5 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-200/70 pb-2.5">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-[#0B1929]">2. Atleta Independiente</span>
                      <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">Planes</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-xs font-semibold text-[#475569]">Plan Estándar (Freemium)</label>
                        <span className="text-xs font-bold text-[#475569] bg-white border border-[#E2E8F0] px-3 py-1.5 rounded-lg">$0 MXN (Gratis)</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-xs font-semibold text-[#475569]">Plan Premium (30 días)</label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#6B7A8D]">$</span>
                          <input
                            type="number"
                            min="0"
                            value={ratesForm.civil_premium}
                            onChange={e => setRatesForm(p => ({ ...p, civil_premium: e.target.value }))}
                            className="w-24 bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-sm font-bold text-[#0B1929] text-right outline-none focus:border-[var(--brand-primary)]"
                          />
                          <span className="text-[11px] text-[#6B7A8D]">MXN</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#6B7A8D] bg-white p-3 rounded-lg border border-[#E2E8F0] leading-relaxed">
                    Los atletas independientes pagan su suscripción mensual directamente a la cuenta del Superadmin.
                  </p>
                </div>
              </div>

              {/* Acciones de Guardado */}
              <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 pt-4 border-t border-[#E2E8F0]">
                <div className="text-xs text-[#6B7A8D] space-y-1">
                  <p>
                    🔒 <strong>Programar ({getNextCutoffDateStr()}):</strong> Entrará en vigor el próximo día de corte, protegiendo adeudos en proceso.
                  </p>
                  <p>
                    ⚡ <strong>Aplicar Inmediatamente Hoy:</strong> Actualiza la tarifa base desde hoy mismo para nuevos cobros y validaciones.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleSaveRates(false)}
                    disabled={savingRates}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-[#CBD5E1] hover:bg-gray-50 text-[#0B1929] transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                  >
                    <Save size={14} />
                    <span>{savingRates ? "Guardando..." : `Programar (${getNextCutoffDateStr()})`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveRates(true)}
                    disabled={savingRates}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-[var(--brand-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm cursor-pointer"
                  >
                    <Zap size={14} />
                    <span>{savingRates ? "Aplicando..." : "Aplicar Inmediatamente Hoy"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── MODAL COMPROBANTE DE PAGO ── */}
      {modalImg && (
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
              <h3 className="font-bold text-[#0B1929] text-sm md:text-base flex items-center gap-2">
                <Eye size={18} className="text-[var(--brand-primary)]" />
                Comprobante de Pago
              </h3>
              <button 
                onClick={() => setModalImg(null)} 
                className="text-[#6B7A8D] hover:bg-gray-200 p-1 rounded-lg transition-colors cursor-pointer"
                title="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto bg-gray-100 flex-1 flex flex-col justify-center items-center min-h-[300px] gap-3">
              {/\.pdf($|\?)/i.test(modalImg) ? (
                <>
                  <iframe
                    src={modalImg}
                    title="Comprobante PDF"
                    className="w-full h-[65vh] rounded-xl shadow-sm border border-gray-200 bg-white"
                  />
                  <a
                    href={modalImg}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#0B1929] hover:bg-[#1E2D3D] text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    Abrir PDF en pestaña nueva
                  </a>
                </>
              ) : (
                <img 
                  src={modalImg} 
                  alt="Comprobante" 
                  className="max-w-full max-h-[70vh] rounded-xl shadow-sm border border-gray-200 object-contain" 
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
