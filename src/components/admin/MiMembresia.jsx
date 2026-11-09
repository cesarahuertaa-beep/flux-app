import React, { useState, useEffect, useMemo, useRef } from "react";
import { dbPeek, dbGet, dbPost, storageUpload } from "../../lib/supabase";
import { useBrand } from "../BrandContext";
import {
  CreditCard,
  Upload,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  FileText,
  Info,
  ShieldCheck,
  Copy,
  Check,
  Users,
  GraduationCap,
  Clock,
  Sparkles,
  ExternalLink,
  ArrowUpCircle
} from "lucide-react";
import { getRatesForCutoff, resolveNutriPlanByVolume, buildCardCheckoutUrl, createDynamicStripeSession } from "../../utils/tarifas";
import { isNativePlayApp } from "../../lib/playBilling";

/**
 * MiMembresia — Centro de Suscripción para Nutriólogos (Titulados y Estudiantes).
 * Opera bajo el Modelo de Bloques Mensuales (30 días naturales) + Estilo Netflix:
 * - En App Nativa (isPlayApp):
 *     • Modo "Solo Lectura / Multi-Platform" (sin pasarelas, sin links clicables ni SPEI).
 *     • Muestra el estado de la cuenta, capacidad de pacientes y fecha de vigencia.
 * - En Portal Web (!isPlayApp):
 *     • Centro de Facturación Oficial con cálculo dinámico desde Tarifas y Planes,
 *       soporte de Upgrade a mitad de ciclo (solo paga la diferencia) y carga de comprobante SPEI.
 */
export default function MiMembresia({ clientes, profileId, setMsg, onPaymentUploaded, role: roleProp }) {
  const isPlayApp = isNativePlayApp();
  const _peekPerfil = profileId ? dbPeek(`profiles?id=eq.${profileId}`) : null;
  const _peekCfg = dbPeek("configuracion_plataforma?id=eq.1");
  const _peekRecibos = profileId ? dbPeek(`recibos_pago?nutriologo_id=eq.${profileId}&order=created_at.desc`) : null;

  const [perfil, setPerfil] = useState(() => Array.isArray(_peekPerfil) && _peekPerfil.length > 0 ? _peekPerfil[0] : null);
  const [configPago, setConfigPago] = useState(() => {
    const c = Array.isArray(_peekCfg) && _peekCfg.length > 0 ? _peekCfg[0] : null;
    return { clabe: c?.clabe || "", banco: c?.banco || "", beneficiario: c?.beneficiario || "" };
  });
  const [rawCfg, setRawCfg] = useState(() => Array.isArray(_peekCfg) && _peekCfg.length > 0 ? _peekCfg[0] : null);
  const [loading, setLoading] = useState(() => _peekPerfil === null && _peekCfg === null);
  const hasLoadedRef = useRef(_peekPerfil !== null || _peekCfg !== null);
  const [uploading, setUploading] = useState(false);
  const [historial, setHistorial] = useState(() => Array.isArray(_peekRecibos) ? _peekRecibos : []);
  const [patrocinios, setPatrocinios] = useState([]);
  const [copiedClabe, setCopiedClabe] = useState(false);
  const [copiedConcepto, setCopiedConcepto] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("spei"); // "spei" | "card"
  useBrand();

  const loadData = async () => {
    if (!profileId) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [data, cfg, recibos] = await Promise.all([
        dbGet(`profiles?id=eq.${profileId}`),
        dbGet("configuracion_plataforma?id=eq.1"),
        dbGet(`recibos_pago?nutriologo_id=eq.${profileId}&order=created_at.desc`)
      ]);
      if (data && data.length > 0) setPerfil(data[0]);
      if (cfg && cfg.length > 0) {
        setRawCfg(cfg[0]);
        setConfigPago({
          clabe: cfg[0].clabe || "",
          banco: cfg[0].banco || "",
          beneficiario: cfg[0].beneficiario || ""
        });
      }
      if (recibos) setHistorial(recibos);
      try {
        const pats = await dbGet(`premium_patrocinado?patrocinador_id=eq.${profileId}&gratis=eq.false& desactivado_en=is.null&order=activo_desde.asc`.replace("& ", "&"));
        if (pats && pats.length > 0) {
          const ids = [...new Set(pats.map(x => x.miembro_profile_id))].join(",");
          const nombres = await dbGet(`profiles?id=in.(${ids})&select=id,nombre`);
          const nmap = {};
          (nombres || []).forEach(n => { nmap[n.id] = n.nombre; });
          setPatrocinios(pats.map(x => ({ ...x, nombre: nmap[x.miembro_profile_id] || "Administrativo" })));
        } else {
          setPatrocinios([]);
        }
      } catch (e) {
        console.warn("premium_patrocinado:", e);
      }
    } catch (e) {
      console.error("Error cargando perfil:", e);
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    let timer = null;
    const onCacheUpdated = (ev) => {
      const table = ev?.detail?.table;
      if (table && !["profiles", "clientes", "recibos_pago", "configuracion_plataforma", "premium_patrocinado", "*"].includes(table)) return;
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
  }, [profileId]);

  const isEstudiante = (roleProp || perfil?.role) === "nutriologo_estudiante";

  // ── MOTOR UNIFICADO DE BLOQUES MENSUALES (30 DÍAS NATURALES + UPGRADE ESTILO NETFLIX) ──
  const {
    activeClientsList,
    adminLines,
    adminTotal,
    activeCount,
    planInfo,
    currentTier,
    currentRate,
    maxPatients,
    totalAmount,
    fechaCorteText,
    nextCutoff,
    activeRates,
    expirationDate,
    diasRestantesText,
    yaPagado,
    hasPendingPayment,
    isTrial,
    trialDaysRemaining,
    firstClientDate,
    isUpgradeMidCycle,
    alreadyPaidInCycle,
    paidTierMaxPatients
  } = useMemo(() => {
    const today = new Date();
    const pendingPayment = historial.some(r => r.estado === "pendiente");

    // Filtrar pacientes del especialista (excluyendo su propio shadow client "Mi entrenamiento personal")
    const myClients = (clientes || []).filter(
      c => c.nutriologo_id === profileId && c.objetivo !== "Mi entrenamiento personal"
    );
    const activeList = myClients.filter(c => c.activo !== false);
    const activePatientsCount = activeList.length;

    let firstClientDateObj = null;
    if (myClients.length > 0) {
      const sorted = [...myClients].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      firstClientDateObj = new Date(sorted[0].created_at);
    }

    // Buscar el último corte válido (aprobado o pendiente)
    const validReceipts = historial.filter(r => r.estado === "aprobado" || r.estado === "pendiente");
    const lastValid = validReceipts[0] || null;

    let targetCutoff = null;
    let expDate = null;
    let isTrialPeriod = false;
    let trialDaysRemainingCalc = null;
    let isCycleActive = false;

    if (!lastValid) {
      if (!firstClientDateObj) {
        // 0 pacientes registrados hasta ahora: acceso de cortesía indefinido ($0 MXN)
        isTrialPeriod = true;
        isCycleActive = true;
        targetCutoff = null;
        expDate = null;
      } else {
        // 7 días de prueba sin costo a partir del 1er paciente (+2 días de gracia)
        const trialExp = new Date(firstClientDateObj);
        trialExp.setDate(trialExp.getDate() + 7);
        trialExp.setHours(23, 59, 59, 999);
        const trialGrace = new Date(trialExp);
        trialGrace.setDate(trialGrace.getDate() + 2);

        if (today <= trialGrace) {
          isTrialPeriod = true;
          isCycleActive = true;
          expDate = trialExp;
          const d = new Date(trialExp);
          d.setDate(d.getDate() + 30);
          targetCutoff = d;
          const now0 = new Date();
          now0.setHours(0, 0, 0, 0);
          const exp0 = new Date(trialExp);
          exp0.setHours(0, 0, 0, 0);
          trialDaysRemainingCalc = Math.max(0, Math.round((exp0 - now0) / (1000 * 60 * 60 * 24)));
        } else {
          expDate = trialExp;
          isCycleActive = false;
          const d = new Date();
          d.setDate(d.getDate() + 30);
          targetCutoff = d;
        }
      }
    } else {
      const lastExpStr = lastValid.fecha_corte_mes;
      let lastExp = new Date((lastExpStr.includes("T") ? lastExpStr.split("T")[0] : lastExpStr) + "T23:59:59");
      if (lastValid.created_at) {
        const createdAtDate = new Date(lastValid.created_at);
        if (lastExp <= createdAtDate) {
          const paidPlus30 = new Date(createdAtDate);
          paidPlus30.setDate(paidPlus30.getDate() + 30);
          paidPlus30.setHours(23, 59, 59, 999);
          lastExp = paidPlus30;
        }
      }
      const blockDate = new Date(lastExp);
      blockDate.setDate(blockDate.getDate() + 2);
      expDate = lastExp;

      if (today <= blockDate) {
        isCycleActive = true;
        const d = new Date(lastExp);
        d.setDate(d.getDate() + 30);
        targetCutoff = d;
      } else {
        isCycleActive = false;
        const d = new Date();
        d.setDate(d.getDate() + 30);
        targetCutoff = d;
      }
    }

    const refDate = targetCutoff || (expDate && today >= expDate ? expDate : today);
    const rates = getRatesForCutoff(rawCfg, refDate);

    // Determinar cuánto se ha pagado ya en el ciclo activo actual (para soportar Upgrades a mitad de mes estilo Netflix)
    let paidBaseInCurrentCycle = 0;
    let paidAdminInCurrentCycle = 0;
    if (isCycleActive && !isTrialPeriod && lastValid?.fecha_corte_mes) {
      const sameCycleReceipts = validReceipts.filter(r => r.fecha_corte_mes === lastValid.fecha_corte_mes);
      sameCycleReceipts.forEach(r => {
        const adm = Number(r.monto_admin_premium || 0);
        const tot = Number(r.monto || 0);
        paidAdminInCurrentCycle += adm;
        paidBaseInCurrentCycle += Math.max(0, tot - adm);
      });
    }

    // Si es Estudiante pero rebasa el límite de estudiante (ej. >15 pac.), evalúa el bloque profesional correspondiente
    const effectiveStudentMode = isEstudiante && activePatientsCount <= rates.estudiante_max;
    const resolvedPlan = resolveNutriPlanByVolume(activePatientsCount, effectiveStudentMode, rates);

    // Calcular capacidad máxima pagada actualmente en el ciclo activo
    let paidMaxPac = resolvedPlan.maxPatients;
    if (isCycleActive && !isTrialPeriod && paidBaseInCurrentCycle > 0) {
      if (isEstudiante && paidBaseInCurrentCycle < rates.nutri_tier1) {
        paidMaxPac = rates.estudiante_max;
      } else if (paidBaseInCurrentCycle < rates.nutri_tier2) {
        paidMaxPac = rates.tier1_max;
      } else if (paidBaseInCurrentCycle < rates.nutri_tier3) {
        paidMaxPac = rates.tier2_max;
      } else {
        paidMaxPac = null; // Nivel 3 ilimitado
      }
    }

    // Administrativos patrocinados activos (tarifa plana por bloque de 30 días)
    const adminRate = Number(rates.admin_premium ?? 50);
    const adminLinesCalc = (patrocinios || []).map(s => ({
      id: s.id,
      nombre: s.nombre,
      costo: adminRate,
      activo: !s.desactivado_en
    }));
    const adminTotalCalc = adminLinesCalc.reduce((acc, l) => acc + l.costo, 0);

    // Verificar si requiere Upgrade a mitad de ciclo (ya pagó un nivel menor pero ahora tiene más pacientes activos)
    const needsMidCycleUpgrade =
      isCycleActive &&
      !isTrialPeriod &&
      paidBaseInCurrentCycle > 0 &&
      resolvedPlan.blockPrice > paidBaseInCurrentCycle;

    const upgradeDiff = needsMidCycleUpgrade
      ? Math.max(0, resolvedPlan.blockPrice - paidBaseInCurrentCycle)
      : 0;

    const unpaidAdminDiff =
      isCycleActive && !isTrialPeriod
        ? Math.max(0, adminTotalCalc - paidAdminInCurrentCycle)
        : adminTotalCalc;

    // Si necesita Upgrade a mitad de mes, el corte del recibo de diferencia apunta a su fecha de expiración actual
    const effectiveCutoffForReceipt =
      needsMidCycleUpgrade && expDate
        ? expDate
        : targetCutoff || new Date(today.getTime() + 30 * 86400000);

    const amountToPay = needsMidCycleUpgrade
      ? upgradeDiff + unpaidAdminDiff
      : resolvedPlan.blockPrice + adminTotalCalc;

    // Texto de días restantes
    let remainingStr = null;
    if (isTrialPeriod) {
      if (!firstClientDateObj) {
        remainingStr = "Cortesía activa ($0 MXN · 7 días de prueba al registrar tu 1er paciente)";
      } else if (trialDaysRemainingCalc > 1) {
        remainingStr = `Prueba gratuita activa: ${trialDaysRemainingCalc} días restantes`;
      } else if (trialDaysRemainingCalc === 1) {
        remainingStr = "Prueba gratuita activa: vence mañana";
      } else if (trialDaysRemainingCalc === 0) {
        remainingStr = "Prueba gratuita activa: vence hoy";
      } else {
        remainingStr = "Prueba gratuita en días de gracia";
      }
    } else if (expDate) {
      const target0 = new Date(expDate);
      target0.setHours(0, 0, 0, 0);
      const now0 = new Date();
      now0.setHours(0, 0, 0, 0);
      const days = Math.round((target0 - now0) / (1000 * 60 * 60 * 24));
      if (days > 1) remainingStr = `Vigencia activa · Expira en ${days} días`;
      else if (days === 1) remainingStr = "Vigencia activa · Expira mañana";
      else if (days === 0) remainingStr = "Expira hoy";
      else if (days >= -2) remainingStr = `En días de gracia (venció hace ${Math.abs(days)} día${Math.abs(days) > 1 ? "s" : ""})`;
      else remainingStr = "Suscripción vencida · Requiere renovación";
    }

    const strCorte = effectiveCutoffForReceipt
      ? effectiveCutoffForReceipt.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
      : "Al registrar 1er paciente";

    const isPaidAndUpToDate = isCycleActive && !needsMidCycleUpgrade;

    return {
      activeClientsList: activeList,
      adminLines: adminLinesCalc,
      adminTotal: adminTotalCalc,
      activeCount: activePatientsCount,
      planInfo: resolvedPlan,
      currentTier: resolvedPlan.tier,
      currentRate: resolvedPlan.blockPrice,
      maxPatients: resolvedPlan.maxPatients,
      totalAmount: amountToPay,
      fechaCorteText: strCorte,
      nextCutoff: effectiveCutoffForReceipt,
      activeRates: rates,
      expirationDate: expDate,
      diasRestantesText: remainingStr,
      yaPagado: isPaidAndUpToDate,
      hasPendingPayment: pendingPayment,
      isTrial: isTrialPeriod,
      trialDaysRemaining: trialDaysRemainingCalc,
      firstClientDate: firstClientDateObj,
      isUpgradeMidCycle: needsMidCycleUpgrade,
      alreadyPaidInCycle: paidBaseInCurrentCycle,
      paidTierMaxPatients: paidMaxPac
    };
  }, [clientes, loading, rawCfg, historial, isEstudiante, profileId, patrocinios]);

  const copyToClipboard = (text, type) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    if (type === "clabe") {
      setCopiedClabe(true);
      setTimeout(() => setCopiedClabe(false), 2000);
    } else if (type === "concepto") {
      setCopiedConcepto(true);
      setTimeout(() => setCopiedConcepto(false), 2000);
    }
  };

  const conceptoStr = `FLX-${profileId ? String(profileId).substring(0, 6).toUpperCase() : "NUTRI"}`;
  const rawClabe = configPago.clabe ? configPago.clabe.replace(/\s+/g, "") : "";
  const formattedClabe = rawClabe ? rawClabe.replace(/(.{4})/g, "$1 ").trim() : "";

  const handleUploadClick = () => {
    document.getElementById("comprobanteUploadNutri")?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMsg("Subiendo comprobante...");

    try {
      const ext = file.name.split(".").pop();
      const path = `${profileId}_${Date.now()}.${ext}`;
      const url = await storageUpload("comprobantes", path, file);

      const reciboRes = await dbPost("recibos_pago", {
        nutriologo_id: profileId,
        monto: totalAmount,
        monto_admin_premium: isUpgradeMidCycle ? 0 : (adminTotal || 0),
        fecha_corte_mes: nextCutoff.toISOString().split("T")[0],
        comprobante_url: url,
        estado: "pendiente"
      });

      try {
        const superadmins = await dbGet("profiles?role=eq.superadmin");
        const notifs = (superadmins || []).map(admin => ({
          profile_id: admin.id,
          titulo: isUpgradeMidCycle ? "Upgrade de Nivel (Nutriólogo)" : "Nuevo comprobante de pago",
          mensaje: `El especialista ${perfil?.nombre || "Nutriólogo"} ha subido un comprobante por $${totalAmount.toFixed(2)} MXN (${planInfo.tierLabel}).`,
          tipo: "pago",
          link_url: "pagos",
          entidad_id: reciboRes?.[0]?.id
        }));
        for (const n of notifs) {
          await dbPost("notificaciones", n, { headers: { Prefer: "return=minimal" } });
        }
      } catch (err) {
        console.error("Error enviando notif", err);
      }

      setMsg(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>Comprobante enviado para revisión. Lo validaremos en breve.</span>
        </div>
      );
      if (onPaymentUploaded) onPaymentUploaded();
      loadData();
    } catch (error) {
      console.error(error);
      setMsg(
        <div className="flex items-center gap-2 text-red-500">
          <AlertCircle className="w-4 h-4" />
          <span>Error al subir: {error.message}</span>
        </div>
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const [stripeLoading, setStripeLoading] = useState(false);

  // Resolver link manual (opcional) o usar Opción B (API Dinámica de Stripe)
  const currentStripeLink = useMemo(() => {
    if (!activeRates?.domiciliacion_activa) return "";
    const rawLink = isEstudiante
      ? activeRates.stripe_link_estudiante
      : currentTier === 1
      ? activeRates.stripe_link_tier1
      : currentTier === 2
      ? activeRates.stripe_link_tier2
      : activeRates.stripe_link_tier3;
    return buildCardCheckoutUrl(rawLink, { userId: profileId, email: perfil?.email });
  }, [activeRates, isEstudiante, currentTier, profileId, perfil?.email]);

  const handleDynamicStripeCheckout = async () => {
    if (currentStripeLink && !isUpgradeMidCycle && activeClientCount <= (activeRates?.tier3_max || 60)) {
      window.open(currentStripeLink, "_blank", "noopener,noreferrer");
      return;
    }
    setStripeLoading(true);
    try {
      const url = await createDynamicStripeSession({
        action: "checkout",
        userType: "nutriologo",
        userId: profileId,
        email: perfil?.email || "",
        isUpgrade: isUpgradeMidCycle,
      });
      window.location.href = url;
    } catch (err) {
      setMsg?.(err?.message || "Aún no se ha conectado la llave de Stripe. Puedes pagar por SPEI.");
    } finally {
      setStripeLoading(false);
    }
  };

  const handleDynamicStripePortal = async () => {
    if (activeRates?.stripe_portal_url) {
      window.open(activeRates.stripe_portal_url, "_blank", "noopener,noreferrer");
      return;
    }
    setStripeLoading(true);
    try {
      const url = await createDynamicStripeSession({
        action: "portal",
        userType: "nutriologo",
        userId: profileId,
        email: perfil?.email || "",
      });
      window.location.href = url;
    } catch (err) {
      setMsg?.(err?.message || "No se encontró una tarjeta domiciliada activa para tu correo.");
    } finally {
      setStripeLoading(false);
    }
  };

  // Tarjeta de Facturación en Portal Web (Selector Tarjeta Domiciliada estilo Netflix vs SPEI)
  const renderSpeiCard = (customSubtitle) => (
    <div className="bg-white p-5 md:p-7 rounded-none md:rounded-3xl shadow-none md:shadow-sm border-b md:border border-[#E2E8F0] flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2.5 mb-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0B1929]">
                {isUpgradeMidCycle ? `Upgrade a ${planInfo.tierLabel}` : "Portal de Facturación FLUX"}
              </h3>
              <p className="text-xs text-[#6B7A8D]">
                {customSubtitle || "Elige pago con tarjeta domiciliada o transferencia SPEI (30 días)."}
              </p>
            </div>
          </div>
        </div>

        {/* Selector de método de pago en Web (Tarjeta Domiciliada vs SPEI) */}
        {activeRates?.domiciliacion_activa && (
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F1F5F9] rounded-xl border border-[#E2E8F0] mb-4">
            <button
              type="button"
              onClick={() => setPaymentMethod("card")}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                paymentMethod === "card"
                  ? "bg-white text-[var(--brand-primary)] shadow-xs"
                  : "text-[#6B7A8D] hover:text-[#0B1929]"
              }`}
            >
              <CreditCard size={14} />
              <span>Tarjeta Domiciliada</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("spei")}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                paymentMethod === "spei"
                  ? "bg-white text-[var(--brand-primary)] shadow-xs"
                  : "text-[#6B7A8D] hover:text-[#0B1929]"
              }`}
            >
              <ShieldCheck size={14} />
              <span>Transferencia SPEI</span>
            </button>
          </div>
        )}

        {isUpgradeMidCycle && (
          <div className="my-3 p-3.5 rounded-2xl bg-indigo-50/90 border border-indigo-200 flex items-start gap-2.5 text-xs text-indigo-950">
            <ArrowUpCircle size={17} className="text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Ajuste de Nivel a mitad de ciclo</span>
              <span>
                Ya tienes cubiertos <strong>${alreadyPaidInCycle.toFixed(2)} MXN</strong> en tu ciclo actual. Solo pagas la diferencia de{" "}
                <strong>${totalAmount.toFixed(2)} MXN</strong> para desbloquear el <strong>{planInfo.tierLabel} ({planInfo.rangeLabel})</strong> conservando tu fecha de corte.
              </span>
            </div>
          </div>
        )}

        {/* Resumen del importe a pagar */}
        <div className="my-4 p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">
              {isUpgradeMidCycle
                ? "Diferencia por Upgrade"
                : yaPagado && !hasPendingPayment
                ? `Tarifa ${planInfo.tierLabel} (30 días)`
                : "Total a Pagar (30 días)"}
            </span>
            <span className="text-2xl font-black text-[#0B1929]">
              ${totalAmount.toFixed(2)}{" "}
              <span className="text-xs font-semibold text-[#6B7A8D]">MXN</span>
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">
              {isTrial && !firstClientDate
                ? "Inicio de Ciclo"
                : isUpgradeMidCycle
                ? "Mantiene Vigencia Al"
                : "Vigencia Cubierta Al"}
            </span>
            <span className="text-xs font-bold text-[var(--brand-primary)]">
              {isTrial && !firstClientDate ? "Al registrar 1er paciente" : fechaCorteText}
            </span>
          </div>
        </div>

        {paymentMethod === "card" && activeRates?.domiciliacion_activa ? (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0B1929] flex items-center gap-1.5">
                  <CreditCard size={15} className="text-[var(--brand-primary)]" />
                  <span>
                    {isUpgradeMidCycle
                      ? "Pago con Tarjeta (Diferencia de Nivel)"
                      : "Domiciliación Automática Mensual (Estilo Netflix)"}
                  </span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Activación Instantánea
                </span>
              </div>
              <p className="text-[#6B7A8D] leading-relaxed">
                {isUpgradeMidCycle ? (
                  <>
                    Paga con tarjeta la diferencia exacta de <strong>${totalAmount.toFixed(2)} MXN</strong> y tu{" "}
                    <strong>{planInfo.tierLabel}</strong> se activará al instante sin subir comprobantes.
                  </>
                ) : (
                  <>
                    Domicilia tu tarjeta de crédito o débito para que tu <strong>{planInfo.tierLabel}</strong> se renueve automáticamente cada 30 días sin subir comprobantes. Puedes cambiar de tarjeta o cancelar cuando quieras.
                  </>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={handleDynamicStripeCheckout}
              disabled={stripeLoading}
              className="w-full bg-[#0B1929] hover:bg-[#162942] disabled:opacity-60 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <CreditCard size={18} className="text-emerald-400" />
              <span>
                {stripeLoading
                  ? "Conectando con pasarela bancaria..."
                  : isUpgradeMidCycle
                  ? `Pagar Upgrade con Tarjeta • $${totalAmount.toFixed(2)} MXN`
                  : `Domiciliar Tarjeta • $${totalAmount.toFixed(2)} MXN / 30 días`}
              </span>
              <ExternalLink size={14} className="opacity-75" />
            </button>

            <button
              type="button"
              onClick={handleDynamicStripePortal}
              disabled={stripeLoading}
              className="w-full py-2.5 px-4 rounded-xl border border-[#E2E8F0] bg-white hover:bg-gray-50 text-[#0B1929] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Administrar o Cancelar Tarjeta Domiciliada</span>
              <ExternalLink size={13} className="text-[#6B7A8D]" />
            </button>
          </div>
        ) : (
          <>
            {/* Datos Bancarios con botones de copiado */}
            <div className="space-y-3">
              <div className="p-3.5 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">
                    Banco Receptor
                  </span>
                  <span className="text-sm font-bold text-[#0B1929]">
                    {configPago.banco || <span className="text-slate-400 font-normal italic">Sin configurar</span>}
                  </span>
                </div>
                <span className="text-xs font-semibold text-[#6B7A8D]">SPEI</span>
              </div>

              <div className="p-3.5 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">
                      Beneficiario
                    </span>
                    <span className="text-sm font-bold text-[#0B1929]">
                      {configPago.beneficiario || <span className="text-slate-400 font-normal italic">Sin configurar</span>}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">
                    CLABE Interbancaria (18 dígitos)
                  </span>
                  <span className="text-sm md:text-base font-black font-mono tracking-wider text-[#0B1929] break-all">
                    {formattedClabe || <span className="text-slate-400 font-normal italic text-xs">Sin configurar</span>}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!rawClabe}
                  onClick={() => copyToClipboard(rawClabe, "clabe")}
                  className={`shrink-0 p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    copiedClabe
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-white border-[#E2E8F0] text-[#0B1929] hover:bg-slate-50"
                  }`}
                  title="Copiar CLABE"
                >
                  {copiedClabe ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copiedClabe ? "Copiada" : "Copiar"}</span>
                </button>
              </div>

              <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200/80 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                      Concepto de Transferencia
                    </span>
                    <span className="text-[10px] font-extrabold text-amber-700 bg-amber-200/60 px-1.5 py-0.2 rounded">
                      Obligatorio
                    </span>
                  </div>
                  <span className="text-base font-black font-mono tracking-wider text-amber-900 block mt-0.5">
                    {conceptoStr}
                  </span>
                  <span className="text-[11px] text-amber-700 block mt-0.5">
                    Identifica tu cuenta de forma automática.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(conceptoStr, "concepto")}
                  className={`shrink-0 p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    copiedConcepto
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-white border-amber-300 text-amber-900 hover:bg-amber-100/50"
                  }`}
                  title="Copiar Concepto"
                >
                  {copiedConcepto ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copiedConcepto ? "Copiado" : "Copiar"}</span>
                </button>
              </div>
            </div>

            {/* Botón de carga */}
            <div className="mt-6 pt-5 border-t border-[#F0F4FA]">
              <button
                type="button"
                disabled={uploading || loading}
                onClick={handleUploadClick}
                className="w-full bg-[var(--brand-primary)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload size={18} />
                <span>
                  {uploading
                    ? "Subiendo Comprobante..."
                    : isUpgradeMidCycle
                    ? `Subir Comprobante de Upgrade ($${totalAmount.toFixed(2)} MXN)`
                    : yaPagado && !hasPendingPayment
                    ? "Adelantar Próxima Renovación (30 días)"
                    : "Subir Comprobante de Pago"}
                </span>
              </button>
              <p className="text-[11px] text-center text-[#6B7A8D] mt-2.5 flex items-center justify-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>Formatos admitidos: JPG, PNG o PDF. Validación en menos de 2h.</span>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Tarjeta Modo Multiplataforma (Estilo Netflix para App Nativa en Google Play / App Store)
  const renderNativeMultiplatformCard = () => (
    <div className="bg-white p-5 md:p-7 rounded-none md:rounded-3xl shadow-none md:shadow-sm border-b md:border border-[#E2E8F0] flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-2xl bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0B1929]">
              Resumen de tu Suscripción
            </h3>
            <p className="text-xs text-[#6B7A8D]">
              Estado actual y capacidad de tu cuenta profesional
            </p>
          </div>
        </div>

        <div className="my-5 p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#6B7A8D] font-medium">Nivel asignado:</span>
            <span className="font-bold text-[#0B1929]">{planInfo.tierLabel} ({planInfo.rangeLabel})</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#6B7A8D] font-medium">Pacientes activos:</span>
            <span className="font-bold text-[#0B1929]">
              {activeCount} {maxPatients ? `de ${maxPatients}` : "(Ilimitados)"}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#6B7A8D] font-medium">Estado de vigencia:</span>
            <span className="font-bold text-[var(--brand-primary)]">
              {expirationDate
                ? expirationDate.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })
                : "Acceso de cortesía activo"}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-[#0B1929] space-y-1.5">
        <span className="font-bold block text-slate-800">Administración de Membresía</span>
        <p className="text-[#6B7A8D] leading-relaxed">
          En esta aplicación no es posible contratar ni modificar suscripciones. Para activar o administrar tu membresía, inicia sesión con tu cuenta en el portal web de FLUX desde cualquier navegador.
        </p>
      </div>
    </div>
  );

  const capacityBarMax = maxPatients || Math.max(activeCount, activeRates.tier2_max + 20);
  const capacityPct = Math.min(100, Math.round((activeCount / Math.max(1, capacityBarMax)) * 100));

  return (
    <div className="w-full max-w-5xl mx-auto space-y-0 md:space-y-6 animate-fade-in pb-28 md:pb-8 pt-0 md:pt-0">
      {/* Input de archivo: Exclusivo en versión Web */}
      {!isPlayApp && (
        <input
          type="file"
          id="comprobanteUploadNutri"
          accept="image/*,.pdf"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      )}

      {/* ── BANNER DE ESTADO COMPACTO Y PROFESIONAL ── */}
      <div className="bg-white p-5 md:p-6 rounded-none md:rounded-3xl shadow-none md:shadow-sm border-b md:border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">
            Estado de tu Cuenta Profesional
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <h2 className="text-lg md:text-xl font-bold text-[#0B1929]">
              {hasPendingPayment
                ? "Comprobante en Revisión"
                : isTrial
                ? (firstClientDate ? "Periodo de Prueba Gratuito Activo" : "Bienvenido a FLUX · Acceso de Cortesía")
                : isUpgradeMidCycle
                ? `Upgrade Requerido a ${planInfo.tierLabel}`
                : yaPagado
                ? `${planInfo.tierLabel} Activo`
                : `${planInfo.tierLabel} — Pendiente de Renovación`}
            </h2>
            {yaPagado && !hasPendingPayment && (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Activo"></span>
            )}
          </div>
          <p className="text-xs text-[#6B7A8D] mt-1">
            {hasPendingPayment
              ? "Hemos recibido tu comprobante. Nuestro equipo lo validará a la brevedad."
              : diasRestantesText || `Tienes ${activeCount} paciente${activeCount !== 1 ? "s" : ""} activo${activeCount !== 1 ? "s" : ""} en ${planInfo.tierLabel}.`}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {hasPendingPayment ? (
            <div className="bg-amber-50 text-amber-700 px-3.5 py-2 rounded-xl border border-amber-200 flex items-center gap-1.5 text-xs font-bold">
              <AlertCircle size={15} />
              <span>En Revisión</span>
            </div>
          ) : isTrial ? (
            <div className="bg-blue-50 text-[var(--brand-primary)] px-3.5 py-2 rounded-xl border border-blue-200 flex items-center gap-1.5 text-xs font-bold">
              <Sparkles size={15} className="text-amber-500" />
              <span>Prueba de Cortesía</span>
            </div>
          ) : yaPagado ? (
            <div className="bg-emerald-50 text-emerald-700 px-3.5 py-2 rounded-xl border border-emerald-200 flex items-center gap-1.5 text-xs font-bold">
              <CheckCircle2 size={15} />
              <span>Servicio Activo</span>
            </div>
          ) : (
            <div className="bg-amber-50 text-amber-700 px-3.5 py-2 rounded-xl border border-amber-200 text-xs font-bold flex items-center gap-1.5">
              <Clock size={15} />
              <span>{isUpgradeMidCycle ? "Upgrade Pendiente" : "Renovación Pendiente"}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── BANNER DE CORTESÍA DE 7 DÍAS (APLICA A TITULADOS Y ESTUDIANTES) ── */}
      {isTrial && (
        <div className="mx-4 my-3 md:mx-0 md:my-0 p-4 rounded-2xl md:rounded-3xl bg-amber-50/90 border border-amber-200/80 flex items-start gap-3 shadow-xs">
          <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="text-xs text-amber-900 leading-relaxed">
            <span className="font-bold block text-sm text-amber-950 mb-0.5">
              Acceso de Cortesía Activo
            </span>
            {firstClientDate ? (
              <span>
                Cuentas con 7 días de acceso total sin costo desde el alta de tu primer paciente. Te {trialDaysRemaining === 1 ? "queda" : "quedan"}{" "}
                <strong>{trialDaysRemaining === 1 ? "1 día de prueba" : `${trialDaysRemaining ?? 7} días de prueba`}</strong>.
              </span>
            ) : (
              <span>
                ¡Bienvenido a FLUX! Tu cuenta personal y el modo <strong>Mi Plan</strong> son gratuitos por tiempo indefinido mientras tengas 0 pacientes. Tu prueba gratuita de 7 días comenzará automáticamente cuando registres a tu primer paciente.
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── CUERPO PRINCIPAL ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-6 border-b md:border-b-0 border-[#E2E8F0]">
        {/* Columna Izquierda: Nivel Actual, Escala de Bloques y Pacientes Activos (7 cols) */}
        <div className="lg:col-span-7 space-y-0 lg:space-y-6">
          <div className="bg-white p-5 md:p-7 rounded-none md:rounded-3xl shadow-none md:shadow-sm border-b md:border border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#0B1929] flex items-center gap-2">
                {isEstudiante ? (
                  <GraduationCap size={20} className="text-amber-600" />
                ) : (
                  <BarChart3 size={20} className="text-[var(--brand-primary)]" />
                )}
                <span>Nivel y Capacidad de tu Plan</span>
              </h2>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-[var(--brand-primary)] border border-blue-100">
                {planInfo.tierLabel}
              </span>
            </div>

            {/* Barra de Capacidad de Pacientes Activos */}
            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#0B1929] flex items-center gap-1.5">
                  <Users size={15} className="text-[var(--brand-primary)]" />
                  <span>Cupo de Pacientes Activos</span>
                </span>
                <span className="font-black text-[#0B1929]">
                  {activeCount} {maxPatients ? `/ ${maxPatients} pacientes` : "pacientes (Sin límite)"}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    maxPatients && activeCount >= maxPatients ? "bg-amber-500" : "bg-[var(--brand-primary)]"
                  }`}
                  style={{ width: `${capacityPct}%` }}
                />
              </div>
              <p className="text-[11px] text-[#6B7A8D]">
                {maxPatients
                  ? activeCount < maxPatients
                    ? `Aún puedes tener ${maxPatients - activeCount} paciente${maxPatients - activeCount === 1 ? "" : "s"} activo${maxPatients - activeCount === 1 ? "" : "s"} más dentro de tu ${planInfo.tierLabel}.`
                    : `Has alcanzado el tope de ${maxPatients} pacientes de tu ${planInfo.tierLabel}. Si agregas más pacientes activos, pasarás automáticamente a ${planInfo.nextTierLabel}.`
                  : "Estás en el Nivel 3 con capacidad ilimitada de pacientes activos."}
              </p>
            </div>

            {/* Escala de Bloques Mensuales (Solo mostramos montos en Web para cumplir norma de tienda en Android) */}
            {!isPlayApp && (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    tier: 1,
                    title: "Nivel 1",
                    range: `1 a ${activeRates.tier1_max} pac.`,
                    price: activeRates.nutri_tier1,
                    active: !isEstudiante && currentTier === 1
                  },
                  {
                    tier: 2,
                    title: "Nivel 2",
                    range: `${activeRates.tier1_max + 1} a ${activeRates.tier2_max} pac.`,
                    price: activeRates.nutri_tier2,
                    active: !isEstudiante && currentTier === 2
                  },
                  {
                    tier: 3,
                    title: "Nivel 3",
                    range: `${activeRates.tier2_max + 1}+ pac. (Ilimitado)`,
                    price: activeRates.nutri_tier3,
                    active: !isEstudiante && currentTier === 3
                  }
                ].map(b => (
                  <div
                    key={b.tier}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      b.active
                        ? "bg-blue-50/70 border-[var(--brand-primary)] shadow-2xs"
                        : "bg-white border-[#E2E8F0]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#0B1929]">{b.title}</span>
                      {b.active && (
                        <span className="text-[10px] font-bold text-[var(--brand-primary)] bg-white px-2 py-0.5 rounded-full border border-blue-200">
                          Actual
                        </span>
                      )}
                    </div>
                    <span className="block text-[11px] text-[#6B7A8D] mt-0.5">{b.range}</span>
                    <span className="block text-base font-black text-[#0B1929] mt-2">
                      ${Number(b.price).toFixed(0)}{" "}
                      <span className="text-[10px] font-semibold text-[#6B7A8D]">MXN / 30d</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!isPlayApp && isEstudiante && (
              <div className="mt-4 p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-amber-900 block">
                    Beneficio Nutriólogo Estudiante (Hasta {activeRates.estudiante_max} pacientes activos)
                  </span>
                  <span className="text-[11px] text-amber-800">
                    Tarifa fija preferencial por 30 días naturales con acceso completo a IA, InBody/ISAK y Marca Blanca.
                  </span>
                </div>
                <span className="text-lg font-black text-amber-900 shrink-0 ml-3">
                  ${Number(activeRates.nutri_estudiante).toFixed(0)} MXN
                </span>
              </div>
            )}
          </div>

          {/* Lista de Pacientes Activos en el Ciclo y Resumen del Bloque */}
          <div className="bg-white rounded-none md:rounded-3xl shadow-none md:shadow-sm border-b md:border border-[#E2E8F0] overflow-hidden">
            <div className="p-4 md:p-6 border-b border-[#E2E8F0] flex items-center justify-between gap-3 bg-white">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center shrink-0 border border-blue-100/70 shadow-2xs">
                  <FileText size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base md:text-lg font-bold text-[#0B1929] leading-tight truncate">
                    Pacientes Activos en tu Plan
                  </h2>
                  <p className="text-xs text-[#6B7A8D] mt-0.5">
                    {activeClientsList.length === 0
                      ? "Aún no tienes pacientes activos (0 pacientes = $0 MXN)"
                      : `${activeClientsList.length} paciente${activeClientsList.length !== 1 ? "s" : ""} ocupando cupo en ${planInfo.tierLabel}`}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">
                  {expirationDate ? "Vencimiento" : "Ciclo"}
                </span>
                <span className="text-xs font-bold text-[#0B1929] bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80 inline-block mt-0.5">
                  {expirationDate
                    ? expirationDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
                    : "30 días naturales"}
                </span>
              </div>
            </div>

            {activeClientsList.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#6B7A8D]">
                No tienes pacientes activos en este momento. Puedes usar tu propio plan personal sin ningún costo.
              </div>
            ) : (
              <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto">
                {activeClientsList.map((c, idx) => (
                  <div
                    key={c.id || idx}
                    className="flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-[var(--brand-primary)] font-bold text-xs flex items-center justify-center shrink-0 border border-blue-100">
                        {c.nombre ? c.nombre.slice(0, 2).toUpperCase() : <Users size={14} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#0B1929] truncate">{c.nombre}</p>
                        <p className="text-[10px] text-[#6B7A8D]">
                          Alta: {c.created_at ? new Date(c.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "Reciente"}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                      Activo #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Administrativos patrocinados (Solo visible con montos en Web) */}
            {!isPlayApp && adminLines.length > 0 && (
              <div className="border-t border-[#E2E8F0] bg-amber-50/20 p-4 md:p-6 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Administrativos Premium Patrocinados ({adminLines.length})
                  </span>
                  <span className="text-xs font-bold text-amber-800">
                    +${adminTotal.toFixed(2)} MXN / 30 días
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: En App Nativa muestra Tarjeta Multiplataforma estilo Netflix; en Web muestra Portal SPEI */}
        <div className="lg:col-span-5 space-y-4">
          {isPlayApp ? renderNativeMultiplatformCard() : renderSpeiCard()}
        </div>
      </div>

      {/* ── REGLAS DE SUSCRIPCIÓN ── */}
      <div className="bg-slate-50 border-b md:border border-slate-200/80 rounded-none md:rounded-3xl p-5 md:p-6">
        <h3 className="text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-4 flex items-center gap-2">
          <Info size={16} className="text-[#6B7A8D]" />
          <span>Reglas de Vigencia y Días de Gracia</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="block text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider mb-1">Ciclo Mensual</span>
            <p className="text-sm font-semibold text-[#0B1929]">30 días naturales continuos.</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="block text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider mb-1">Cortesía Inicial</span>
            <p className="text-sm font-bold text-[var(--brand-primary)]">7 días gratis desde tu 1er paciente.</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm">
            <span className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Días de Gracia</span>
            <p className="text-sm font-semibold text-[#0B1929]">2 días adicionales tras vencer.</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm">
            <span className="block text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">Bloqueo Preventivo</span>
            <p className="text-sm font-semibold text-[#0B1929]">Al 3er día sin renovación.</p>
          </div>
        </div>
      </div>

      {/* ── HISTORIAL DE PAGOS (Solo en Portal Web) ── */}
      {!isPlayApp && (
        <div className="bg-white p-5 md:p-7 rounded-none md:rounded-3xl shadow-none md:shadow-sm border-b md:border border-[#E2E8F0]">
          <h3 className="text-base font-bold text-[#0B1929] mb-4">
            Historial de Recibos y Comprobantes
          </h3>
          {loading ? (
            <div className="text-sm text-[#6B7A8D] py-4 text-center">Cargando historial de pagos...</div>
          ) : historial.length === 0 ? (
            <div className="text-xs text-[#6B7A8D] bg-slate-50 p-6 rounded-2xl text-center border border-slate-100">
              No tienes pagos registrados aún.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse hidden md:table">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="py-3 px-4 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Fecha</th>
                    <th className="py-3 px-4 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Vigencia Cubierta</th>
                    <th className="py-3 px-4 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Comprobante</th>
                    <th className="py-3 px-4 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-right">Monto</th>
                    <th className="py-3 px-4 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historial.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 text-xs text-[#0B1929] whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString("es-MX")}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#6B7A8D] whitespace-nowrap">
                        {r.fecha_corte_mes
                          ? new Date(r.fecha_corte_mes.includes("T") ? r.fecha_corte_mes : `${r.fecha_corte_mes}T12:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        {r.comprobante_url && !r.comprobante_url.startsWith("[") ? (
                          <a
                            href={r.comprobante_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--brand-primary)] hover:underline"
                          >
                            <span>Ver comprobante</span>
                            <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span className="text-[#6B7A8D] text-xs">Portal FLUX</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#0B1929] text-right whitespace-nowrap text-sm">
                        ${Number(r.monto).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          r.estado === "aprobado"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : r.estado === "rechazado"
                            ? "bg-red-50 text-red-600 border border-red-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {r.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile View */}
              <div className="md:hidden divide-y divide-slate-100">
                {historial.map(r => (
                  <div key={r.id} className="py-3.5 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-[#0B1929]">${Number(r.monto).toFixed(2)} MXN</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        r.estado === "aprobado"
                          ? "bg-emerald-50 text-emerald-700"
                          : r.estado === "rechazado"
                          ? "bg-red-50 text-red-600"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        {r.estado}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-[#6B7A8D]">
                      <span>{new Date(r.created_at).toLocaleDateString("es-MX")}</span>
                      <span>
                        Vigencia:{" "}
                        {r.fecha_corte_mes
                          ? new Date(r.fecha_corte_mes.includes("T") ? r.fecha_corte_mes : `${r.fecha_corte_mes}T12:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
