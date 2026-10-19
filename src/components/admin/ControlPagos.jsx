import React, { useState, useEffect, useMemo, useRef } from"react";
import { dbGet, dbPatch, dbPost } from"../../lib/supabase";
import { CheckCircle2, XCircle, Eye, Banknote, X, Clock, UserCheck, ChevronDown, ChevronRight, Calendar, Send, Dumbbell, Settings, Save } from"lucide-react";
import { DEFAULT_RATES, parseTarifasHistory, getLatestConfiguredRates, getRatesForCutoff, getNextCutoffDateStr } from"../../utils/tarifas";
import { ListSkeleton } from"../ui/Skeleton";

// ── Shared StatusBadge ──────────────────────────────────────────────────────
const StatusBadge = ({ s }) => {
  if (s ==="pendiente") return <span className="px-2 py-1 bg-yellow-50 text-yellow-600 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 w-max"><Clock size={12}/> Pendiente</span>;
  if (s ==="aprobado")  return <span className="px-2 py-1 bg-green-50 text-green-600 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 w-max"><CheckCircle2 size={12}/> Aprobado</span>;
  if (s ==="rechazado") return <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 w-max"><XCircle size={12}/> Rechazado</span>;
  return null;
};

export default function ControlPagos({ setMsg }) {
  // ── Estado nutriólogos ──────────────────────────────────────────────────
  const [recibos, setRecibos] = useState([]);
  const [nutriologos, setNutriologos] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalImg, setModalImg] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [filtroMes, setFiltroMes] = useState("todos");
  const [expandedColab, setExpandedColab] = useState(null);
  const [nominasEstado, setNominasEstado] = useState({});

  // ── Estado atletas independientes ───────────────────────────────────────
  const [recibosCivil, setRecibosCivil] = useState([]);
  const [clientesCivil, setClientesCivil] = useState({});
  const [loadingCivil, setLoadingCivil] = useState(true);
  const [filtroEstadoCivil, setFiltroEstadoCivil] = useState("pendiente");

  // ── Estado Configuración de Tarifas y Planes (Opción A) ─────────────────
  const [rawCfg, setRawCfg] = useState(null);
  const [showRatesPanel, setShowRatesPanel] = useState(false);
  const [savingRates, setSavingRates] = useState(false);
  const [ratesForm, setRatesForm] = useState({
    nutri_tier1: DEFAULT_RATES.nutri_tier1,
    nutri_tier2: DEFAULT_RATES.nutri_tier2,
    nutri_tier3: DEFAULT_RATES.nutri_tier3,
    nutri_estudiante: DEFAULT_RATES.nutri_estudiante,
    civil_premium: DEFAULT_RATES.civil_premium,
    comision_pct: DEFAULT_RATES.comision_pct
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [dataRecibos, profiles, dataNominas, cfg] = await Promise.all([
        dbGet("recibos_pago?order=created_at.desc"),
        dbGet("profiles?role=in.(nutriologo,nutriologo_estudiante)&select=id,nombre,role,creado_por_nombre"),
        dbGet("nomina_colaboradores"),
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
          comision_pct: latest.comision_pct
        });
      }
      const map = {};
      profiles.forEach(p => { map[p.id] = { nombre: p.nombre, role: p.role, creado_por: p.creado_por_nombre || null }; });
      const mapNominas = {};
      if(dataNominas && dataNominas.length > 0) {
        dataNominas.forEach(n => { mapNominas[`${n.colaborador_nombre}|${n.mes_facturacion}`] = n; });
      }
      setNutriologos(map);
      setNominasEstado(mapNominas);
      setRecibos(dataRecibos);
    } catch (e) {
      console.error(e);
      setMsg("❌ Error cargando pagos:" + e.message);
    }
    setLoading(false);
  };

  const handleSaveRates = async () => {
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
        comision_pct: Number(ratesForm.comision_pct) || 0,
        effective_from: nextCutoffStr,
        updated_at: new Date().toISOString()
      };

      // Si ya existía una entrada programada para ese mismo próximo corte, la actualizamos; si no, la agregamos al historial
      const filteredHistory = history.filter(h => h.effective_from !== nextCutoffStr);
      const updatedHistory = [...filteredHistory, newEntry].sort((a, b) =>
        (a.effective_from || "").localeCompare(b.effective_from || "")
      );

      const updatedRows = await dbPatch("configuracion_plataforma?id=eq.1", {
        tarifas_config: updatedHistory
      });
      if (updatedRows && updatedRows.length > 0) {
        setRawCfg(updatedRows[0]);
      } else {
        setRawCfg(prev => ({ ...(prev || {}), tarifas_config: updatedHistory }));
      }
      setMsg(`✓ Tarifas guardadas. Entrarán en vigor en el próximo corte (${nextCutoffStr}) respetando adeudos anteriores.`);
      setShowRatesPanel(false);
    } catch (e) {
      setMsg("❌ Error guardando tarifas: " + e.message);
    }
    setSavingRates(false);
  };

  const loadDataCivil = async () => {
    setLoadingCivil(true);
    try {
      const [dataRec, clientes] = await Promise.all([
        dbGet("recibos_pago_civil?order=created_at.desc"),
        dbGet("clientes?nutriologo_id=is.null&select=id,nombre,email")
      ]);
      const map = {};
      (clientes || []).forEach(c => { map[c.id] = c.nombre || c.email || c.id; });
      setClientesCivil(map);
      setRecibosCivil(dataRec || []);
    } catch (e) {
      console.error("Error cargando pagos civil:", e);
      // No mostrar error si la tabla aún no existe
    }
    setLoadingCivil(false);
  };

  useEffect(() => { loadData(); loadDataCivil(); }, []);

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

  const filtrados = useMemo(() => recibos.filter(r => {
    const matchEstado = filtroEstado ==="todos" ? true : r.estado === filtroEstado;
    const matchMes = filtroMes ==="todos" ? true : (r.fecha_corte_mes && r.fecha_corte_mes.startsWith(filtroMes));
    return matchEstado && matchMes;
  }), [recibos, filtroEstado, filtroMes]);

  // ── Filtros Civil ───────────────────────────────────────────────────────
  const filtradosCivil = useMemo(() =>
    recibosCivil.filter(r => filtroEstadoCivil ==="todos" ? true : r.estado === filtroEstadoCivil),
  [recibosCivil, filtroEstadoCivil]);

  // ── Comisiones colaboradores (Evaluadas por fecha de corte o nómina congelada) ──
  const comisiones = useMemo(() => {
    const map = {};
    filtrados.forEach(r => {
      const nutri = nutriologos[r.nutriologo_id];
      if (!nutri || !nutri.creado_por) return;
      const colab = nutri.creado_por;
      if (!map[colab]) map[colab] = { totalGenerado: 0, comisionAcumulada: 0, nutriologos: new Set(), recibosCount: 0 };
      const montoRecibo = Number(r.monto) || 0;
      const ratesForCut = getRatesForCutoff(rawCfg, r.fecha_corte_mes || r.created_at);
      const pct = (Number(ratesForCut.comision_pct) || 35) / 100;
      map[colab].totalGenerado += montoRecibo;
      map[colab].comisionAcumulada += montoRecibo * pct;
      map[colab].nutriologos.add(nutri.nombre ||"Desconocido");
      map[colab].recibosCount++;
    });
    return Object.entries(map)
      .map(([nombre, data]) => {
        const nominaKey = `${nombre}|${filtroMes}`;
        const existingNomina = filtroMes !== "todos" ? nominasEstado[nominaKey] : null;
        const comisionFinal = (existingNomina?.transferido_por_admin && existingNomina?.monto != null)
          ? Number(existingNomina.monto)
          : data.comisionAcumulada;
        return {
          nombre,
          totalGenerado: data.totalGenerado,
          comision: comisionFinal,
          nutriologos: [...data.nutriologos],
          recibosCount: data.recibosCount
        };
      })
      .sort((a, b) => b.comision - a.comision);
  }, [filtrados, nutriologos, rawCfg, filtroMes, nominasEstado]);

  // ── Acciones ────────────────────────────────────────────────────────────
  const updateEstado = async (id, nuevoEstado, nutriologoId) => {
    try {
      await dbPatch(`recibos_pago?id=eq.${id}`, { estado: nuevoEstado });
      if (nuevoEstado ==="aprobado" && nutriologoId) {
        await dbPatch(`profiles?id=eq.${nutriologoId}`, { bloqueado: false });
      }

      if (nutriologoId) {
        await dbPost("notificaciones", {
          profile_id: nutriologoId,
          titulo: nuevoEstado ==="aprobado" ?"Pago Aprobado" :"Pago Rechazado",
          mensaje: nuevoEstado ==="aprobado" ?"Tu pago ha sido validado exitosamente. Ya tienes acceso." :"Hubo un problema validando tu pago. Por favor revisa y vuelve a subirlo.",
          tipo: nuevoEstado ==="aprobado" ?"pago" :"alerta",
          link_url:"membresia",
          entidad_id: id
        });
      }

      setMsg("✓ Recibo " + nuevoEstado);
      loadData();
    } catch (e) { setMsg("❌ Error al actualizar: " + e.message); }
  };

  const updateEstadoCivil = async (id, nuevoEstado, clienteId) => {
    try {
      await dbPatch(`recibos_pago_civil?id=eq.${id}`, { estado: nuevoEstado });
      if (nuevoEstado ==="aprobado" && clienteId) {
        await dbPatch(`clientes?id=eq.${clienteId}`, { 
          activo: true, 
          deactivated_at: null,
          plan_tipo: 'premium'
        });
      } else if (nuevoEstado ==="rechazado" && clienteId) {
        // Re-evaluar si tiene derecho a ser premium por algún otro recibo anterior
        const recibos = await dbGet(`recibos_pago_civil?cliente_id=eq.${clienteId}&order=created_at.desc`);
        const lastAprobado = recibos?.find(r => r.estado === 'aprobado');
        let downgrade = false;
        if (!lastAprobado) {
          downgrade = true;
        } else {
          const today = new Date();
          const expirationDate = new Date(lastAprobado.fecha_corte_mes +"T23:59:59");
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
              titulo: nuevoEstado ==="aprobado" ?"Pago Aprobado" :"Pago Rechazado",
              mensaje: nuevoEstado ==="aprobado" ?"Tu membresía premium ha sido activada." :"Hubo un problema validando tu pago. Revísalo en tu membresía.",
              tipo: nuevoEstado ==="aprobado" ?"pago" :"alerta",
              link_url:"membresia",
              entidad_id: id
            });
          }
        } catch (err) {
          console.error("No se pudo notificar al atleta", err);
        }
      }

      setMsg("✓ Pago de atleta " + nuevoEstado);
      loadDataCivil();
    } catch (e) { setMsg("❌ Error al actualizar: " + e.message); }
  };

  const handleMarcarTransferido = async (colaboradorNombre, monto) => {
    if (filtroMes === 'todos') { setMsg("⚠️ Selecciona un mes específico."); return; }
    try {
      setMsg("Guardando...");
      const key = `${colaboradorNombre}|${filtroMes}`;
      const existing = nominasEstado[key];
      if (existing) {
        await dbPatch(`nomina_colaboradores?id=eq.${existing.id}`, { transferido_por_admin: true, monto });
      } else {
        await dbPost("nomina_colaboradores", { colaborador_nombre: colaboradorNombre, mes_facturacion: filtroMes, monto, transferido_por_admin: true });
      }
      setMsg("✓ Marcado como transferido");
      loadData();
    } catch (e) { setMsg("❌ Error: " + e.message); }
  };

  const formatMes = (yyyyMm) => {
    if (yyyyMm === 'todos') return 'Todos los meses';
    const [y, m] = yyyyMm.split('-');
    return new Date(y, m - 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in pb-10">

      {/* ── PANEL DE CONFIGURACIÓN DE TARIFAS Y PLANES (OPCIÓN A) ────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
        <div className="p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#0B1929] flex items-center gap-2">
              <Settings size={20} className="text-[var(--brand-primary)]" />
              Costos por Perfil, Planes y Comisiones
            </h2>
            <p className="text-xs text-[#6B7A8D] mt-0.5">
              Define los precios de suscripción para Nutriólogos, Atletas Independientes y el porcentaje de comisión de Staff.
            </p>
          </div>
          <button
            onClick={() => setShowRatesPanel(prev => !prev)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-[#E2E8F0] text-[#0B1929] hover:bg-[#F8FAFC] transition-colors shrink-0"
          >
            <Settings size={15} className="text-[var(--brand-primary)]" />
            {showRatesPanel ? "Ocultar Configuración" : "Configurar Tarifas y Planes"}
          </button>
        </div>

        {showRatesPanel && (
          <div className="px-5 md:px-6 pb-6 pt-4 border-t border-[#E2E8F0] bg-[#F8FAFC] space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              
              {/* 1. Perfil Nutriólogo */}
              <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#0B1929]">1. Perfil Nutriólogo</span>
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Costo / paciente</span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-medium text-[#6B7A8D]">Nivel 1 (1 – 20 pac.)</label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#6B7A8D]">$</span>
                      <input
                        type="number"
                        min="0"
                        value={ratesForm.nutri_tier1}
                        onChange={e => setRatesForm(p => ({ ...p, nutri_tier1: e.target.value }))}
                        className="w-24 bg-[#F0F4FA] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-sm font-bold text-[#0B1929] text-right outline-none focus:border-[var(--brand-primary)]"
                      />
                      <span className="text-[11px] text-[#6B7A8D]">MXN</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-medium text-[#6B7A8D]">Nivel 2 (21 – 50 pac.)</label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#6B7A8D]">$</span>
                      <input
                        type="number"
                        min="0"
                        value={ratesForm.nutri_tier2}
                        onChange={e => setRatesForm(p => ({ ...p, nutri_tier2: e.target.value }))}
                        className="w-24 bg-[#F0F4FA] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-sm font-bold text-[#0B1929] text-right outline-none focus:border-[var(--brand-primary)]"
                      />
                      <span className="text-[11px] text-[#6B7A8D]">MXN</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-medium text-[#6B7A8D]">Nivel 3 (51+ pac.)</label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#6B7A8D]">$</span>
                      <input
                        type="number"
                        min="0"
                        value={ratesForm.nutri_tier3}
                        onChange={e => setRatesForm(p => ({ ...p, nutri_tier3: e.target.value }))}
                        className="w-24 bg-[#F0F4FA] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-sm font-bold text-[#0B1929] text-right outline-none focus:border-[var(--brand-primary)]"
                      />
                      <span className="text-[11px] text-[#6B7A8D]">MXN</span>
                    </div>
                  </div>
                  <div className="pt-2.5 mt-1 border-t border-gray-100 flex items-center justify-between gap-3">
                    <div>
                      <label className="block text-xs font-bold text-amber-600">Nutriólogo Estudiante</label>
                      <span className="text-[10px] text-[#6B7A8D]">Mensualidad fija (30 días)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#6B7A8D]">$</span>
                      <input
                        type="number"
                        min="0"
                        value={ratesForm.nutri_estudiante}
                        onChange={e => setRatesForm(p => ({ ...p, nutri_estudiante: e.target.value }))}
                        className="w-24 bg-[#F0F4FA] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-sm font-bold text-[#0B1929] text-right outline-none focus:border-[var(--brand-primary)]"
                      />
                      <span className="text-[11px] text-[#6B7A8D]">MXN</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Perfil Atleta Independiente */}
              <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#0B1929]">2. Atleta Independiente</span>
                    <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">Planes</span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs font-medium text-[#6B7A8D]">Plan Estándar (Freemium)</label>
                      <span className="text-xs font-bold text-[#6B7A8D] bg-gray-100 px-2.5 py-1 rounded-lg">$0 MXN (Gratis)</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs font-medium text-[#6B7A8D]">Plan Premium (30 días)</label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#6B7A8D]">$</span>
                        <input
                          type="number"
                          min="0"
                          value={ratesForm.civil_premium}
                          onChange={e => setRatesForm(p => ({ ...p, civil_premium: e.target.value }))}
                          className="w-24 bg-[#F0F4FA] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-sm font-bold text-[#0B1929] text-right outline-none focus:border-[var(--brand-primary)]"
                        />
                        <span className="text-[11px] text-[#6B7A8D]">MXN</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Comisiones de Staff */}
              <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#0B1929]">3. Staff Corporativo</span>
                    <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">Comisión</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <label className="text-xs font-medium text-[#6B7A8D]">Comisión por nutriólogo invitado</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={ratesForm.comision_pct}
                        onChange={e => setRatesForm(p => ({ ...p, comision_pct: e.target.value }))}
                        className="w-20 bg-[#F0F4FA] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-sm font-bold text-[#0B1929] text-right outline-none focus:border-[var(--brand-primary)]"
                      />
                      <span className="text-xs font-bold text-[#6B7A8D]">%</span>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-[#6B7A8D] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  Las nóminas ya transferidas o de cortes anteriores mantienen su porcentaje original congelado.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-[#E2E8F0]">
              <p className="text-xs text-[#6B7A8D]">
                🔒 <strong>Protección Histórica Activa:</strong> Al guardar cambios, entrarán en vigor para el <strong>próximo corte ({getNextCutoffDateStr()})</strong>. Los adeudos pendientes de cortes pasados conservarán su costo anterior.
              </p>
              <button
                onClick={handleSaveRates}
                disabled={savingRates}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[var(--brand-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm shrink-0"
              >
                <Save size={15} />
                {savingRates ? "Guardando..." : "Guardar Tarifas"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── SECCIÓN NUTRIÓLOGOS ─────────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0] flex flex-col xl:flex-row justify-between xl:items-center gap-6">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-[#0B1929] flex items-center gap-2">
            <Banknote className="text-green-500" />
            Auditoría de Pagos — Nutriólogos
          </h2>
          <p className="text-[#6B7A8D] mt-1 text-sm">Revisa y valida las transferencias mensuales de los nutriólogos.</p>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 shadow-sm">
            <Calendar size={16} className="text-[#6B7A8D]" />
            <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className="bg-transparent text-sm font-bold text-[#0B1929] focus:outline-none cursor-pointer capitalize">
              <option value="todos">Todos los meses</option>
              {mesesDisponibles.map(m => <option key={m} value={m}>{formatMes(m)}</option>)}
            </select>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto max-w-full">
            {['pendiente', 'aprobado', 'rechazado', 'todos'].map(st => (
              <button key={st} onClick={() => setFiltroEstado(st)} className={`px-4 py-1.5 rounded-lg text-sm font-bold capitalize transition-all shrink-0 ${filtroEstado === st ? 'bg-white text-[#0B1929] shadow-sm' : 'text-[#6B7A8D] hover:text-[#0B1929]'}`}>{st}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
        {loading ? <div className="p-4"><ListSkeleton rows={3} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px] hidden md:table">
              <thead>
                <tr className="bg-gray-50 border-b border-[#E2E8F0]">
                  <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Fecha / Hora</th>
                  <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Nutriólogo</th>
                  <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Mes Facturado</th>
                  <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-right">Monto</th>
                  <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Estado</th>
                  <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.length === 0 ? (
                  <tr><td colSpan="6" className="py-8 text-center text-[#6B7A8D]">No hay recibos en esta categoría.</td></tr>
                ) : filtrados.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-6 text-sm text-[#0B1929]">
                      {new Date(r.created_at).toLocaleDateString('es-MX')}
                      <span className="block text-xs text-[#6B7A8D]">{new Date(r.created_at).toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})}</span>
                    </td>
                    <td className="py-3 px-6 font-semibold text-[#0B1929]">
                      {nutriologos[r.nutriologo_id]?.nombre ||"Desconocido"}
                      {nutriologos[r.nutriologo_id]?.creado_por && <span className="block text-[11px] text-[#6B7A8D] font-normal">Inv. por: {nutriologos[r.nutriologo_id].creado_por}</span>}
                    </td>
                    <td className="py-3 px-6 text-sm text-center text-[#6B7A8D]">
                      {r.fecha_corte_mes ? new Date(r.fecha_corte_mes).toLocaleDateString('es-MX', {month:'long', year:'numeric'}) : 'N/A'}
                    </td>
                    <td className="py-3 px-6 font-bold text-green-600 text-right">${Number(r.monto).toFixed(2)}</td>
                    <td className="py-3 px-6"><div className="flex justify-center"><StatusBadge s={r.estado} /></div></td>
                    <td className="py-3 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setModalImg(r.comprobante_url)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Ver foto"><Eye size={18} /></button>
                        {r.estado ==="pendiente" && <>
                          <button onClick={() => updateEstado(r.id,"aprobado", r.nutriologo_id)} className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors" title="Aprobar"><CheckCircle2 size={18} /></button>
                          <button onClick={() => updateEstado(r.id,"rechazado", r.nutriologo_id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Rechazar"><XCircle size={18} /></button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="md:hidden flex flex-col divide-y divide-gray-100">
              {filtrados.length === 0 ? (
                <div className="py-8 text-center text-[#6B7A8D]">No hay recibos en esta categoría.</div>
              ) : filtrados.map((r) => (
                <div key={r.id} className="p-4 flex flex-col gap-3 hover:bg-gray-50/50 transition-colors">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-semibold text-[#0B1929]">
                        {nutriologos[r.nutriologo_id]?.nombre ||"Desconocido"}
                      </div>
                      {nutriologos[r.nutriologo_id]?.creado_por && (
                        <div className="text-[11px] text-[#6B7A8D] font-normal">
                          Inv. por: {nutriologos[r.nutriologo_id].creado_por}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="font-bold text-green-600">${Number(r.monto).toFixed(2)}</div>
                      <StatusBadge s={r.estado} />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs text-[#6B7A8D]">
                    <div>
                      <span className="block">{new Date(r.created_at).toLocaleDateString('es-MX')}</span>
                      <span className="block">{new Date(r.created_at).toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div className="text-right">
                      <span className="block uppercase tracking-wider font-bold text-[10px]">Mes Facturado</span>
                      <span>{r.fecha_corte_mes ? new Date(r.fecha_corte_mes).toLocaleDateString('es-MX', {month:'long', year:'numeric'}) : 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 mt-1">
                    <button onClick={() => setModalImg(r.comprobante_url)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Ver foto"><Eye size={18} /></button>
                    {r.estado ==="pendiente" && <>
                      <button onClick={() => updateEstado(r.id,"aprobado", r.nutriologo_id)} className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors" title="Aprobar"><CheckCircle2 size={18} /></button>
                      <button onClick={() => updateEstado(r.id,"rechazado", r.nutriologo_id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Rechazar"><XCircle size={18} /></button>
                    </>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── COMISIONES POR COLABORADOR ──────────────────────────────────── */}
      {!loading && comisiones.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
          <div className="p-6 border-b border-[#E2E8F0] flex items-center gap-3">
            <UserCheck className="text-indigo-500" size={22} />
            <div>
              <h3 className="text-lg font-bold text-[#0B1929]">Comisiones de Colaboradores</h3>
              <p className="text-[#6B7A8D] text-sm mt-0.5">{ratesForm.comision_pct}% del total generado · <strong>{filtroMes === 'todos' ? 'Acumulado histórico' : <span className="capitalize">{formatMes(filtroMes)}</span>}</strong></p>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {comisiones.map((c, i) => {
              const nom = nominasEstado[`${c.nombre}|${filtroMes}`];
              const isTransferido = nom?.transferido_por_admin;
              const isConfirmado = nom?.confirmado_por_colaborador;
              return (
                <div key={i}>
                  <div className="w-full flex flex-col md:flex-row md:items-center justify-between px-6 py-4 hover:bg-gray-50/60 transition-colors">
                    <button onClick={() => setExpandedColab(expandedColab === c.nombre ? null : c.nombre)} className="flex items-center gap-3 text-left flex-1">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                        <span className="text-indigo-600 font-bold text-sm">{c.nombre.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-bold text-[#0B1929] flex items-center gap-2">
                          {c.nombre}
                          {isConfirmado && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] uppercase tracking-wider font-bold">FIRMADO</span>}
                        </p>
                        <p className="text-xs text-[#6B7A8D]">{c.nutriologos.length} nutriólogo{c.nutriologos.length !== 1 ? 's' : ''} · {c.recibosCount} recibo{c.recibosCount !== 1 ? 's' : ''}</p>
                      </div>
                      {expandedColab === c.nombre ? <ChevronDown size={18} className="text-[#6B7A8D] shrink-0 ml-2" /> : <ChevronRight size={18} className="text-[#6B7A8D] shrink-0 ml-2" />}
                    </button>
                    <div className="flex items-center justify-end gap-6 mt-4 md:mt-0 pl-12 md:pl-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-[#6B7A8D]">Total generado</p>
                        <p className="font-semibold text-[#0B1929] text-sm">${c.totalGenerado.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider">Tu pago ({ratesForm.comision_pct}%)</p>
                        <p className="font-black text-indigo-600 text-lg">${c.comision.toFixed(2)}</p>
                      </div>
                      {filtroMes !== 'todos' && (
                        <div className="border-l border-gray-200 pl-4">
                          {isConfirmado ? (
                            <div className="flex flex-col items-center text-green-600"><CheckCircle2 size={20} /><span className="text-[10px] font-bold mt-1">PAGADO</span></div>
                          ) : isTransferido ? (
                            <div className="flex flex-col items-center text-amber-500"><Clock size={20} /><span className="text-[10px] font-bold mt-1 text-center leading-tight">ESPERANDO<br/>FIRMA</span></div>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); handleMarcarTransferido(c.nombre, c.comision); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors">
                              <Send size={14} /> Transferir
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {expandedColab === c.nombre && (
                    <div className="px-6 pb-4 bg-indigo-50/40 border-t border-indigo-100/50 pt-3">
                      <p className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-2">Nutriólogos a su cargo:</p>
                      <div className="flex flex-wrap gap-2">
                        {c.nutriologos.map((n, j) => <span key={j} className="px-3 py-1 bg-white border border-indigo-100 rounded-full text-xs font-semibold text-indigo-700">{n}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-[#E2E8F0] flex justify-between items-center">
            <span className="text-sm font-bold text-[#6B7A8D] uppercase tracking-wider">Total nómina de colaboradores</span>
            <span className="text-xl font-black text-[#0B1929]">${comisiones.reduce((acc, c) => acc + c.comision, 0).toFixed(2)} MXN</span>
          </div>
        </div>
      )}

      {/* ── SECCIÓN ATLETAS INDEPENDIENTES ──────────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0] flex flex-col xl:flex-row justify-between xl:items-center gap-6">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-[#0B1929] flex items-center gap-2">
            <Dumbbell className="text-[var(--brand-primary)]" size={22} />
            Pagos — Atletas Independientes
          </h2>
          <p className="text-[#6B7A8D] mt-1 text-sm">Comprobantes del plan Premium (${ratesForm.civil_premium} MXN/mes). El 100% va directo al superadmin, sin comisiones.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto max-w-full shrink-0">
          {['pendiente', 'aprobado', 'rechazado', 'todos'].map(st => (
            <button key={st} onClick={() => setFiltroEstadoCivil(st)} className={`px-4 py-1.5 rounded-lg text-sm font-bold capitalize transition-all shrink-0 ${filtroEstadoCivil === st ? 'bg-white text-[#0B1929] shadow-sm' : 'text-[#6B7A8D] hover:text-[#0B1929]'}`}>{st}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
        {loadingCivil ? <div className="p-4"><ListSkeleton rows={3} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px] hidden md:table">
              <thead>
                <tr className="bg-gray-50 border-b border-[#E2E8F0]">
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
                  <tr><td colSpan="6" className="py-8 text-center text-[#6B7A8D]">{recibosCivil.length === 0 ?"Aún no hay comprobantes de atletas independientes." :"No hay recibos en esta categoría."}</td></tr>
                ) : filtradosCivil.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-6 text-sm text-[#0B1929]">
                      {new Date(r.created_at).toLocaleDateString('es-MX')}
                      <span className="block text-xs text-[#6B7A8D]">{new Date(r.created_at).toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})}</span>
                    </td>
                    <td className="py-3 px-6 font-semibold text-[#0B1929]">
                      {clientesCivil[r.cliente_id] ||"Atleta Independiente"}
                      <span className="block text-[11px] text-[var(--brand-primary)] font-normal">Atleta Independiente Premium</span>
                    </td>
                    <td className="py-3 px-6 text-sm text-center text-[#6B7A8D]">
                      {r.fecha_corte_mes ? new Date(r.fecha_corte_mes).toLocaleDateString('es-MX', {month:'long', year:'numeric'}) : 'N/A'}
                    </td>
                    <td className="py-3 px-6 font-bold text-green-600 text-right">${Number(r.monto).toFixed(2)}</td>
                    <td className="py-3 px-6"><div className="flex justify-center"><StatusBadge s={r.estado} /></div></td>
                    <td className="py-3 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {r.comprobante_url && <button onClick={() => setModalImg(r.comprobante_url)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Ver comprobante"><Eye size={18} /></button>}
                        {r.estado ==="pendiente" && <>
                          <button onClick={() => updateEstadoCivil(r.id,"aprobado", r.cliente_id)} className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors" title="Aprobar"><CheckCircle2 size={18} /></button>
                          <button onClick={() => updateEstadoCivil(r.id,"rechazado", r.cliente_id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Rechazar"><XCircle size={18} /></button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="md:hidden flex flex-col divide-y divide-gray-100">
              {filtradosCivil.length === 0 ? (
                <div className="py-8 text-center text-[#6B7A8D]">
                  {recibosCivil.length === 0 ?"Aún no hay comprobantes de atletas independientes." :"No hay recibos en esta categoría."}
                </div>
              ) : filtradosCivil.map((r) => (
                <div key={r.id} className="p-4 flex flex-col gap-3 hover:bg-gray-50/50 transition-colors">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-semibold text-[#0B1929]">
                        {clientesCivil[r.cliente_id] ||"Atleta Independiente"}
                      </div>
                      <div className="text-[11px] text-[var(--brand-primary)] font-normal">
                        Atleta Independiente Premium
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="font-bold text-green-600">${Number(r.monto).toFixed(2)}</div>
                      <StatusBadge s={r.estado} />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs text-[#6B7A8D]">
                    <div>
                      <span className="block">{new Date(r.created_at).toLocaleDateString('es-MX')}</span>
                      <span className="block">{new Date(r.created_at).toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div className="text-right">
                      <span className="block uppercase tracking-wider font-bold text-[10px]">Mes Facturado</span>
                      <span>{r.fecha_corte_mes ? new Date(r.fecha_corte_mes).toLocaleDateString('es-MX', {month:'long', year:'numeric'}) : 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 mt-1">
                    {r.comprobante_url && <button onClick={() => setModalImg(r.comprobante_url)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Ver comprobante"><Eye size={18} /></button>}
                    {r.estado ==="pendiente" && <>
                      <button onClick={() => updateEstadoCivil(r.id,"aprobado", r.cliente_id)} className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors" title="Aprobar"><CheckCircle2 size={18} /></button>
                      <button onClick={() => updateEstadoCivil(r.id,"rechazado", r.cliente_id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Rechazar"><XCircle size={18} /></button>
                    </>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!loadingCivil && filtradosCivil.filter(r => r.estado === 'aprobado').length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-[#E2E8F0] flex justify-between items-center">
            <span className="text-sm font-bold text-[#6B7A8D] uppercase tracking-wider">Total cobrado (atletas independientes)</span>
            <span className="text-xl font-black text-green-600">
              ${filtradosCivil.filter(r => r.estado === 'aprobado').reduce((acc, r) => acc + Number(r.monto), 0).toFixed(2)} MXN
            </span>
          </div>
        )}
      </div>

      {/* ── MODAL COMPROBANTE ───────────────────────────────────────────── */}
      {modalImg && (
        <div className="fixed inset-0 z-[100] bg-[#0B1929]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#E2E8F0] flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-[#0B1929]">Comprobante de Pago</h3>
              <button onClick={() => setModalImg(null)} className="text-[#6B7A8D] hover:bg-gray-200 p-1 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <div className="p-4 overflow-y-auto bg-gray-100 flex-1 flex justify-center items-center">
              <img src={modalImg} alt="Comprobante" className="max-w-full max-h-full rounded-lg shadow-sm border border-gray-200 object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}