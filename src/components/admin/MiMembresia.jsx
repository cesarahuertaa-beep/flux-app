import React, { useState, useEffect, useMemo } from "react";
import { dbGet, dbPost, storageUpload } from "../../lib/supabase";
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
  Sparkles
} from "lucide-react";
import { getRatesForCutoff } from "../../utils/tarifas";
import {
  isNativePlayApp,
  PLAY_BILLING_PRODUCTS,
  startGooglePlaySubscription,
  openPlayStoreSubscriptions,
  restoreGooglePlayPurchases
} from "../../lib/playBilling";

/**
 * MiMembresia — Pantalla de suscripción para Nutriólogos (Titulados y Estudiantes).
 * Cumple al 100% con las políticas de Google Play Store:
 * - En Android (isPlayApp):
 *     • nutriologo_estudiante: Suscripción oficial de Google Play Billing ($239 MXN/mes).
 *     • nutriologo (titulado): Facturación empresarial por volumen administrada vía Web.
 *       No se muestra información de transferencia bancaria ni subida de comprobantes en Play Store.
 * - En Web (!isPlayApp):
 *     • Se muestran todos los datos SPEI, CLABE con copiado a 1 clic, concepto y subida de comprobantes.
 */
export default function MiMembresia({ clientes, profileId, setMsg, onPaymentUploaded }) {
  const isPlayApp = isNativePlayApp();
  const [perfil, setPerfil] = useState(null);
  const [configPago, setConfigPago] = useState({ clabe: "", banco: "", beneficiario: "" });
  const [rawCfg, setRawCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [patrocinios, setPatrocinios] = useState([]);
  const [copiedClabe, setCopiedClabe] = useState(false);
  const [copiedConcepto, setCopiedConcepto] = useState(false);
  const brand = useBrand();

  const loadData = async () => {
    if (!profileId) return;
    setLoading(true);
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
        const pats = await dbGet(`premium_patrocinado?patrocinador_id=eq.${profileId}&gratis=eq.false&order=activo_desde.asc`);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profileId]);

  const isEstudiante = perfil?.role === "nutriologo_estudiante";

  // Cálculos de fechas, periodos y tarifas
  const {
    desglose,
    adminLines,
    adminTotal,
    patientSubtotal,
    activeCount,
    currentTier,
    currentRate,
    nextTierThreshold,
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
    firstClientDate
  } = useMemo(() => {
    const today = new Date();
    const pendingPayment = historial.some(r => r.estado === "pendiente");

    // ── MODO ESTUDIANTE: Mensualidad fija de 30 días (rolling) ──
    if (isEstudiante) {
      const lastValid = historial.find(r => r.estado === "aprobado" || r.estado === "pendiente");
      let targetCutoff, expDate = null;

      // Calcular primer paciente para el periodo de prueba de 30 días
      const myClients = (clientes || []).filter(c => c.nutriologo_id === profileId && c.objetivo !== "Mi entrenamiento personal");
      let firstClientDateObj = null;
      if (myClients.length > 0) {
        const sorted = [...myClients].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        firstClientDateObj = new Date(sorted[0].created_at);
      }

      let isTrialPeriod = false;
      let trialDaysRemainingCalc = null;

      if (!lastValid) {
        if (!firstClientDateObj) {
          // Aún no registra a su primer paciente: periodo de prueba no ha iniciado (acceso total de cortesía)
          isTrialPeriod = true;
          const d = new Date();
          d.setDate(d.getDate() + 7);
          targetCutoff = d;
          expDate = null;
        } else {
          // El periodo de prueba vence 7 días después del primer paciente (+ 2 días de gracia)
          const trialExp = new Date(firstClientDateObj);
          trialExp.setDate(trialExp.getDate() + 7);
          trialExp.setHours(23, 59, 59, 999);
          const trialGrace = new Date(trialExp);
          trialGrace.setDate(trialGrace.getDate() + 2);

          if (today <= trialGrace) {
            isTrialPeriod = true;
            expDate = trialExp;
            targetCutoff = trialExp;
            const now0 = new Date();
            now0.setHours(0, 0, 0, 0);
            const exp0 = new Date(trialExp);
            exp0.setHours(0, 0, 0, 0);
            trialDaysRemainingCalc = Math.max(0, Math.round((exp0 - now0) / (1000 * 60 * 60 * 24)));
          } else {
            expDate = trialExp;
            const d = new Date();
            d.setDate(d.getDate() + 30);
            targetCutoff = d;
          }
        }
      } else {
        const lastExp = new Date(lastValid.fecha_corte_mes + "T23:59:59");
        const blockDate = new Date(lastExp);
        blockDate.setDate(blockDate.getDate() + 2);
        expDate = lastExp;

        if (today > blockDate) {
          const d = new Date();
          d.setDate(d.getDate() + 30);
          targetCutoff = d;
        } else {
          const d = new Date(lastExp);
          d.setDate(d.getDate() + 30);
          targetCutoff = d;
        }
      }

      const refDate = targetCutoff || (expDate && today >= expDate ? expDate : today);
      const ratesForStudent = getRatesForCutoff(rawCfg, refDate);
      const tarifaEstudiante = Number(ratesForStudent.nutri_estudiante ?? 239);

      let remainingStr = null;
      if (isTrialPeriod) {
        if (!firstClientDateObj) {
          remainingStr = "Prueba de bienvenida activa (7 días de cortesía a partir de tu 1er paciente)";
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
        const target = new Date(expDate);
        target.setHours(0, 0, 0, 0);
        const now0 = new Date();
        now0.setHours(0, 0, 0, 0);
        const days = Math.round((target - now0) / (1000 * 60 * 60 * 24));
        if (days > 1) remainingStr = `Expira en ${days} días`;
        else if (days === 1) remainingStr = "Expira mañana";
        else if (days === 0) remainingStr = "Expira hoy";
        else remainingStr = `En días de gracia (venció hace ${Math.abs(days)} días)`;
      }

      const activePatientsCount = (clientes || []).filter(c => c.nutriologo_id === profileId && c.activo).length;
      const strCorte = targetCutoff.toLocaleDateString("es-MX", { day: "numeric", month: "long" });

      const isStudentPaid = isTrialPeriod || (expDate ? today <= new Date(new Date(expDate).setDate(expDate.getDate() + 2)) : false);

      return {
        desglose: [],
        adminLines: [],
        adminTotal: 0,
        patientSubtotal: tarifaEstudiante,
        activeCount: activePatientsCount,
        currentTier: 1,
        currentRate: tarifaEstudiante,
        nextTierThreshold: null,
        totalAmount: tarifaEstudiante,
        fechaCorteText: strCorte,
        nextCutoff: targetCutoff,
        activeRates: ratesForStudent,
        expirationDate: expDate,
        diasRestantesText: remainingStr,
        yaPagado: isStudentPaid,
        hasPendingPayment: pendingPayment,
        isTrial: isTrialPeriod,
        trialDaysRemaining: trialDaysRemainingCalc,
        firstClientDate: firstClientDateObj
      };
    }

    // ── MODO TITULADO / EGRESADO: Corte mensual el día 10 por volumen de pacientes ──
    const diaCorte = 10; // Fijo global

    // 1. Determinar el último corte que YA PASÓ (o es hoy)
    let lastPassedCutoff = new Date(today.getFullYear(), today.getMonth(), diaCorte);
    if (today.getDate() < diaCorte) {
      lastPassedCutoff = new Date(today.getFullYear(), today.getMonth() - 1, diaCorte);
    }

    // 2. Revisar si ese último corte ya fue pagado
    const lastPassedCutoffStr = lastPassedCutoff.toISOString().split("T")[0];
    let isTitledPaid = historial.some(r =>
      r.fecha_corte_mes === lastPassedCutoffStr &&
      (r.estado === "aprobado" || r.estado === "pendiente")
    );

    // Si no tiene pacientes o el primero entró después del último corte, no debe nada de ese corte
    const myClients = clientes ? clientes.filter(c => c.nutriologo_id === profileId) : [];
    let firstClientDate = null;
    if (myClients.length > 0) {
      firstClientDate = new Date(myClients[0].created_at);
    }

    if (!loading && (!firstClientDate || firstClientDate > lastPassedCutoff)) {
      isTitledPaid = true;
    }

    // 3. Definir la ventana de facturación actual
    let nextCutoffDate, lastCutoffDate;
    if (!isTitledPaid && today >= lastPassedCutoff) {
      // Corte vencido o vigente hoy
      nextCutoffDate = lastPassedCutoff;
      lastCutoffDate = new Date(nextCutoffDate.getFullYear(), nextCutoffDate.getMonth() - 1, diaCorte);
    } else {
      // Ya pagado o nuevo: cobro del siguiente corte
      nextCutoffDate = new Date(lastPassedCutoff.getFullYear(), lastPassedCutoff.getMonth() + 1, diaCorte);
      lastCutoffDate = lastPassedCutoff;
    }

    const ratesForThisCutoff = getRatesForCutoff(rawCfg, nextCutoffDate);

    // Contadores y desglose
    let activePatientsCount = 0;
    const dataList = (clientes || []).filter(c => c.nutriologo_id === profileId).map(c => {
      const isActivo = c.activo;
      const createdAt = new Date(c.created_at || today);
      const deactivatedAt = c.deactivated_at ? new Date(c.deactivated_at) : null;

      let diasCobrar = 0;
      let fechaInicioCobro = lastCutoffDate;
      let fechaFinCobro = nextCutoffDate;

      if (isActivo) {
        activePatientsCount++;
        if (createdAt < lastCutoffDate) {
          diasCobrar = 30;
        } else {
          const diffTime = Math.abs(nextCutoffDate - createdAt);
          diasCobrar = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diasCobrar > 30) diasCobrar = 30;
          fechaInicioCobro = createdAt;
        }
      } else if (deactivatedAt && deactivatedAt > lastCutoffDate) {
        const start = createdAt > lastCutoffDate ? createdAt : lastCutoffDate;
        const diffTime = Math.abs(deactivatedAt - start);
        const diasActivo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diasActivo < 20) {
          diasCobrar = 30;
          fechaFinCobro = nextCutoffDate;
        } else {
          diasCobrar = Math.min(diasActivo, 30);
          fechaInicioCobro = start;
          fechaFinCobro = deactivatedAt;
        }
      }

      const periodoStr = `${fechaInicioCobro.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} al ${fechaFinCobro.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}`;

      return { ...c, diasCobrar, periodoStr };
    }).filter(c => c.diasCobrar > 0);

    // Tiers
    let tier = 1;
    let rate = ratesForThisCutoff.nutri_tier1;
    let threshold = 21;
    if (activePatientsCount >= 21 && activePatientsCount <= 50) {
      tier = 2;
      rate = ratesForThisCutoff.nutri_tier2;
      threshold = 51;
    } else if (activePatientsCount > 50) {
      tier = 3;
      rate = ratesForThisCutoff.nutri_tier3;
      threshold = null;
    }

    // Costos
    let total = 0;
    dataList.forEach(c => {
      c.costoPaciente = (rate / 30) * c.diasCobrar;
      total += c.costoPaciente;
    });

    // Administrativos patrocinados
    const DAY = 1000 * 60 * 60 * 24;
    const adminRate = Number(ratesForThisCutoff.admin_premium ?? 50);
    const adminLinesCalc = [];
    (patrocinios || []).forEach(s => {
      const desde = new Date(s.activo_desde);
      const hasta = s.desactivado_en ? new Date(s.desactivado_en) : null;
      let dias = 0;
      let inicio = lastCutoffDate;
      let fin = nextCutoffDate;
      if (!hasta) {
        if (desde < lastCutoffDate) { dias = 30; }
        else { dias = Math.min(30, Math.ceil(Math.abs(nextCutoffDate - desde) / DAY)); inicio = desde; }
      } else if (hasta > lastCutoffDate) {
        const start = desde > lastCutoffDate ? desde : lastCutoffDate;
        const diasActivo = Math.ceil(Math.abs(hasta - start) / DAY);
        if (diasActivo < 20) { dias = 30; }
        else { dias = Math.min(diasActivo, 30); inicio = start; fin = hasta; }
      }
      if (dias > 0) {
        const periodoStr = `${inicio.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} al ${fin.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}`;
        adminLinesCalc.push({ id: s.id, nombre: s.nombre, diasCobrar: dias, periodoStr, costo: (adminRate / 30) * dias, activo: !s.desactivado_en });
      }
    });
    const adminTotalCalc = adminLinesCalc.reduce((a, l) => a + l.costo, 0);
    const strCorte = nextCutoffDate.toLocaleDateString("es-MX", { day: "numeric", month: "long" });

    return {
      desglose: dataList,
      adminLines: adminLinesCalc,
      adminTotal: adminTotalCalc,
      patientSubtotal: total,
      activeCount: activePatientsCount,
      currentTier: tier,
      currentRate: rate,
      nextTierThreshold: threshold,
      totalAmount: total + adminTotalCalc,
      fechaCorteText: strCorte,
      nextCutoff: nextCutoffDate,
      activeRates: ratesForThisCutoff,
      expirationDate: null,
      diasRestantesText: null,
      yaPagado: isTitledPaid,
      hasPendingPayment: pendingPayment,
      isTrial: false,
      trialDaysRemaining: null,
      firstClientDate: firstClientDate
    };
  }, [clientes, perfil, loading, rawCfg, historial, isEstudiante, profileId, patrocinios]);

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
        monto_admin_premium: adminTotal || 0,
        fecha_corte_mes: nextCutoff.toISOString().split("T")[0],
        comprobante_url: url,
        estado: "pendiente"
      });

      try {
        const superadmins = await dbGet("profiles?role=eq.superadmin");
        const notifs = (superadmins || []).map(admin => ({
          profile_id: admin.id,
          titulo: "Nuevo comprobante de pago",
          mensaje: `El especialista ${perfil?.nombre || "Nutriólogo"} ha subido un comprobante para revisión.`,
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

  // Renderizador de la tarjeta de transferencia SPEI (EXCLUSIVA para versión Web)
  const renderSpeiCard = (customSubtitle) => (
    <div className="bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-[#E2E8F0] flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-2xl bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
            <CreditCard size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0B1929]">
              Datos de Transferencia Bancaria (SPEI)
            </h3>
            <p className="text-xs text-[#6B7A8D]">
              {customSubtitle || "Realiza tu pago vía SPEI y sube tu comprobante para validación."}
            </p>
          </div>
        </div>

        {/* Resumen del importe a pagar */}
        <div className="my-4 p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">
              Total a Pagar
            </span>
            <span className="text-2xl font-black text-[#0B1929]">
              ${totalAmount.toFixed(2)}{" "}
              <span className="text-xs font-semibold text-[#6B7A8D]">MXN</span>
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">
              Corte Facturado
            </span>
            <span className="text-xs font-bold text-[var(--brand-primary)]">
              {fechaCorteText}
            </span>
          </div>
        </div>

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
                Identifica tu pago de forma automática.
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
          <span>{uploading ? "Subiendo Comprobante..." : "Subir Comprobante de Pago"}</span>
        </button>
        <p className="text-[11px] text-center text-[#6B7A8D] mt-2.5 flex items-center justify-center gap-1.5">
          <CheckCircle2 size={13} className="text-emerald-600" />
          <span>Formatos admitidos: JPG, PNG o PDF. Validación manual en menos de 2h.</span>
        </p>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in pb-6">
      {/* Input de archivo: SOLO en Web para no infringir normas de Google Play en Android */}
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
      <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">
            Estado de tu Cuenta
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <h2 className="text-lg md:text-xl font-bold text-[#0B1929]">
              {hasPendingPayment
                ? "Comprobante en Revisión"
                : isEstudiante && isTrial
                ? "Periodo de Prueba Gratuito Activo"
                : isEstudiante
                ? (yaPagado ? "Plan Estudiante Activo" : "Plan Estudiante — Pendiente de Renovación")
                : (yaPagado ? "Servicio Profesional Activo" : "Corte de Facturación Pendiente")}
            </h2>
            {yaPagado && !hasPendingPayment && (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Activo"></span>
            )}
          </div>
          <p className="text-xs text-[#6B7A8D] mt-1">
            {hasPendingPayment
              ? "Hemos recibido tu comprobante. Nuestro equipo lo validará a la brevedad."
              : isEstudiante
              ? (diasRestantesText
                  ? `${diasRestantesText} · ${expirationDate ? `Vencimiento: ${expirationDate.toLocaleDateString("es-MX", { day: "2-digit", month: "long" })}` : `Corte estimado: ${fechaCorteText}`}`
                  : "Mensualidad fija preferencial para estudiantes sin cobro por paciente.")
              : `Tienes ${activeCount} paciente${activeCount !== 1 ? "s" : ""} activo${activeCount !== 1 ? "s" : ""} en Nivel ${currentTier} ($${currentRate}/pac). Próximo corte: ${fechaCorteText}.`}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {hasPendingPayment ? (
            <div className="bg-amber-50 text-amber-700 px-3.5 py-2 rounded-xl border border-amber-200 flex items-center gap-1.5 text-xs font-bold">
              <AlertCircle size={15} />
              <span>En Revisión</span>
            </div>
          ) : isEstudiante && isTrial ? (
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
              <span>Pago Pendiente</span>
            </div>
          )}
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL SEGÚN PERFIL ── */}
      {isEstudiante ? (
        /* ══════════════════════════════════════════════════════════
           PERFIL: NUTRIÓLOGO ESTUDIANTE (Tarifa fija $239 MXN / mes)
           ══════════════════════════════════════════════════════════ */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Columna Izquierda: Plan y Beneficios (5 cols) */}
          <div className="md:col-span-5 bg-gradient-to-br from-[#0B1929] to-[#152336] text-white p-6 md:p-7 rounded-3xl shadow-sm flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-4 border border-white/10">
                <GraduationCap size={13} />
                Tarifa Especial Estudiante
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl md:text-5xl font-black tracking-tight text-white">
                  ${Number(currentRate).toFixed(2)}
                </span>
                <span className="text-sm font-semibold text-slate-300">
                  MXN / mes
                </span>
              </div>
              <p className="text-xs text-slate-300 mb-6">
                Sin contratos forzosos ni límites. Gestiona tus pacientes sin cargos adicionales por volumen.
              </p>

              <ul className="space-y-3">
                {[
                  { icon: <Users size={16} />, text: `Pacientes ilimitados sin costo extra (${activeCount} actualmente)` },
                  { icon: <FileText size={16} />, text: "Expediente clínico, dietas y rutinas completas" },
                  { icon: <BarChart3 size={16} />, text: "Antropometría, somatocarta y evolución visual" },
                  { icon: <ShieldCheck size={16} />, text: "App móvil para tus pacientes incluida" }
                ].map((b, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-xs md:text-sm text-slate-100 font-medium">
                    <span className="text-[var(--brand-primary)] shrink-0 bg-white/10 p-1 rounded-lg">
                      {b.icon}
                    </span>
                    <span>{b.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
              <span>{isTrial ? "Término de Cortesía" : "Próximo Vencimiento"}</span>
              <span className="font-bold text-amber-300">
                {expirationDate
                  ? expirationDate.toLocaleDateString("es-MX", { day: "2-digit", month: "long" })
                  : fechaCorteText}
              </span>
            </div>
          </div>

          {/* Columna Derecha: Método de Pago (7 cols) */}
          <div className="md:col-span-7 space-y-4">
            {isTrial && (
              <div className="p-4 rounded-3xl bg-amber-50/90 border border-amber-200/80 flex items-start gap-3 shadow-xs">
                <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0">
                  <Sparkles size={18} />
                </div>
                <div className="text-xs text-amber-900 leading-relaxed">
                  <span className="font-bold block text-sm text-amber-950 mb-0.5">
                    🎉 Acceso de Cortesía Activo
                  </span>
                  {firstClientDate ? (
                    <span>
                      Cuentas con 7 días de acceso total sin costo. Te quedan{" "}
                      <strong>{trialDaysRemaining ?? 7} días de prueba</strong> antes de tu primera mensualidad de ${Number(currentRate).toFixed(2)} MXN.
                    </span>
                  ) : (
                    <span>
                      ¡Bienvenido a FLUX! Tienes acceso total de cortesía. Tu periodo de prueba de 7 días comenzará de forma automática en cuanto des de alta a tu primer paciente.
                    </span>
                  )}
                  <span className="block mt-1 text-amber-800/90">
                    {isPlayApp
                      ? "Puedes iniciar tu suscripción con antelación para que empiece a cobrarse al terminar tu periodo de prueba."
                      : "No requieres subir ningún pago mientras tu prueba gratuita esté vigente."}
                  </span>
                </div>
              </div>
            )}
            {isPlayApp ? (
              /* Google Play Subscription (Android Oficial — Sin transferencias para cumplir políticas de Google) */
              <div className="bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-[#E2E8F0] flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#0B1929]">
                        Suscripción Google Play
                      </h3>
                      <p className="text-xs text-[#6B7A8D]">
                        Facturación segura integrada con tu cuenta de Google Play Store.
                      </p>
                    </div>
                  </div>

                  <div className="my-5 p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Plan</span>
                      <span className="font-bold text-[#0B1929]">Nutriólogo Estudiante</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Monto Mensual</span>
                      <span className="font-black text-[var(--brand-primary)] text-base">${Number(currentRate).toFixed(2)} MXN</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Vigencia</span>
                      <span className="font-bold text-[#0B1929]">Renovación cada 30 días</span>
                    </div>
                  </div>

                  <p className="text-xs text-[#6B7A8D] leading-relaxed">
                    Las suscripciones se procesan oficialmente mediante <strong>Google Play Billing</strong>. Puedes gestionar o cancelar tu suscripción desde la sección Pagos y Suscripciones de tu cuenta de Google Play.
                  </p>
                </div>

                <div className="mt-6 space-y-3 pt-5 border-t border-[#F0F4FA]">
                  <button
                    type="button"
                    disabled={uploading || loading}
                    onClick={async () => {
                      setUploading(true);
                      try {
                        const res = await startGooglePlaySubscription(
                          PLAY_BILLING_PRODUCTS.NUTRI_ESTUDIANTE,
                          {
                            role: "nutriologo_estudiante",
                            nutriologoId: profileId,
                            nombre: perfil?.nombre,
                            monto: Number(currentRate) || 239
                          }
                        );
                        if (res.status === "purchased") {
                          setMsg(
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              <span>¡Suscripción de estudiante activada con éxito en Google Play!</span>
                            </div>
                          );
                          if (onPaymentUploaded) onPaymentUploaded();
                          loadData();
                        } else if (res.status === "unavailable_in_region_or_review") {
                          setMsg(
                            <div className="flex items-center gap-1.5">
                              <Info className="w-4 h-4 text-blue-500" />
                              <span>La suscripción en Google Play se activará al concluir la revisión en tienda.</span>
                            </div>
                          );
                        }
                      } catch (err) {
                        setMsg(
                          <div className="flex items-center gap-1.5 text-red-500">
                            <AlertCircle className="w-4 h-4" />
                            <span>{err.message}</span>
                          </div>
                        );
                      } finally {
                        setUploading(false);
                      }
                    }}
                    className="w-full bg-[var(--brand-primary)] hover:opacity-90 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CreditCard size={18} />
                    <span>{uploading ? "Conectando con Google Play..." : (isTrial ? "Activar Suscripción Anticipada" : "Suscribirme con Google Play")}</span>
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      disabled={uploading || loading}
                      onClick={async () => {
                        setUploading(true);
                        try {
                          const res = await restoreGooglePlayPurchases({
                            role: "nutriologo_estudiante",
                            nutriologoId: profileId,
                            nombre: perfil?.nombre,
                            monto: Number(currentRate) || 239
                          });
                          if (res.hasActiveEntitlement) {
                            setMsg(
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span>Suscripción restaurada con éxito.</span>
                              </div>
                            );
                            if (onPaymentUploaded) onPaymentUploaded();
                            loadData();
                          } else {
                            setMsg(
                              <div className="flex items-center gap-1.5">
                                <Info className="w-4 h-4 text-blue-500" />
                                <span>No se encontraron compras activas en esta cuenta de Google Play.</span>
                              </div>
                            );
                          }
                        } catch (err) {
                          setMsg(
                            <div className="flex items-center gap-1.5 text-red-500">
                              <AlertCircle className="w-4 h-4" />
                              <span>{err.message}</span>
                            </div>
                          );
                        } finally {
                          setUploading(false);
                        }
                      }}
                      className="text-xs text-[#6B7A8D] hover:text-[var(--brand-primary)] py-1.5 transition-colors cursor-pointer"
                    >
                      Restaurar compras
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* SPEI Transfer Card (Exclusivo versión Web) */
              <div>
                {renderSpeiCard(`Tarifa fija preferencial de $${Number(currentRate).toFixed(2)} MXN para nutriólogos estudiantes.`)}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════
           PERFIL: NUTRIÓLOGO TITULADO / EGRESADO (Volumen dinámico)
           ══════════════════════════════════════════════════════════ */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Izquierda: Nivel, Termómetro y Desglose de Pacientes (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Termómetro de Nivel */}
            <div className="bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-[#E2E8F0]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-[#0B1929] flex items-center gap-2">
                  <BarChart3 size={20} className="text-[var(--brand-primary)]" />
                  <span>Nivel de Suscripción Actual</span>
                </h2>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-[var(--brand-primary)] border border-blue-100">
                  Nivel {currentTier}
                </span>
              </div>

              {/* Termómetro de volumen */}
              <div className="mt-4 px-2">
                <div className="flex justify-between mb-2">
                  {[
                    { label: "Nivel 1", sub: "1-20 pac." },
                    { label: "Nivel 2", sub: "21-50 pac." },
                    { label: "Nivel 3", sub: "51+ pac." }
                  ].map((t, i) => (
                    <div key={i} className="text-center w-20">
                      <span className="block text-xs font-bold text-[#0B1929]">{t.label}</span>
                      <span className="block text-[10px] text-[#6B7A8D]">{t.sub}</span>
                    </div>
                  ))}
                </div>

                <div className="relative h-3 bg-gray-100 rounded-full overflow-visible mx-4">
                  <div
                    className="h-full bg-[var(--brand-primary)] rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min((activeCount / 51) * 100, 100)}%` }}
                  />
                  {[0, 0.39, 1].map((pct, i) => (
                    <div
                      key={i}
                      className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-4 shadow-sm z-10 transition-colors ${
                        activeCount >= [1, 21, 51][i] ? "bg-[var(--brand-primary)] border-white" : "bg-gray-200 border-white"
                      }`}
                      style={{ left: `calc(${pct * 100}% - 10px)` }}
                    />
                  ))}
                </div>

                <div className="flex justify-between mt-3">
                  {[
                    `$${activeRates.nutri_tier1} /pac`,
                    `$${activeRates.nutri_tier2} /pac`,
                    `$${activeRates.nutri_tier3} /pac`
                  ].map((p, i) => (
                    <div key={i} className="text-center w-20">
                      <span className="block text-xs font-bold text-emerald-600">{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 bg-blue-50/60 rounded-2xl p-4 border border-blue-100/80">
                <p className="text-xs md:text-sm text-[#0B1929] leading-relaxed">
                  Actualmente tienes <strong>{activeCount} pacientes activos</strong>. Tu tarifa vigente es de{" "}
                  <strong className="text-[var(--brand-primary)]">${Number(currentRate).toFixed(2)} MXN</strong> por paciente al mes.
                  {nextTierThreshold && (
                    <span className="block text-[var(--brand-primary)] font-semibold mt-1">
                      ¡Agrega {nextTierThreshold - activeCount} pacientes más para desbloquear la tarifa de ${currentTier === 1 ? activeRates.nutri_tier2 : activeRates.nutri_tier3} /pac!
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Desglose para Próximo Corte */}
            <div className="bg-white rounded-3xl shadow-sm border border-[#E2E8F0] overflow-hidden">
              <div className="p-6 border-b border-[#E2E8F0] flex justify-between items-center">
                <h2 className="text-lg font-bold text-[#0B1929] flex items-center gap-2">
                  <FileText size={20} className="text-[var(--brand-primary)]" />
                  <span>Desglose para Próximo Corte</span>
                </h2>
                <span className="text-xs font-bold text-[#6B7A8D] bg-slate-100 px-3 py-1 rounded-full">
                  {fechaCorteText}
                </span>
              </div>

              {/* Tabla Desktop */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse hidden md:table">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-[#E2E8F0]">
                      <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Paciente</th>
                      <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Alta</th>
                      <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Periodo</th>
                      <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Días</th>
                      <th className="py-3 px-6 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider text-right">Costo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {desglose.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-[#6B7A8D] text-sm">
                          No tienes pacientes a facturar en este ciclo.
                        </td>
                      </tr>
                    ) : (
                      desglose.map((c, i) => (
                        <tr key={c.id || i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3.5 px-6 font-semibold text-[#0B1929] text-sm">{c.nombre}</td>
                          <td className="py-3.5 px-6 text-xs text-[#6B7A8D] text-center">
                            {c.created_at ? new Date(c.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "Reciente"}
                          </td>
                          <td className="py-3.5 px-6 text-xs text-[#6B7A8D] text-center font-medium">
                            {c.periodoStr}
                          </td>
                          <td className="py-3.5 px-6 text-xs font-medium text-center text-[#0B1929]">
                            {c.diasCobrar} <span className="text-gray-400 font-normal">/ 30</span>
                          </td>
                          <td className="py-3.5 px-6 font-bold text-[var(--brand-primary)] text-right text-sm">
                            ${c.costoPaciente.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-gray-100">
                  {desglose.length === 0 ? (
                    <div className="py-8 text-center text-[#6B7A8D] text-xs">
                      No tienes pacientes a facturar en este ciclo.
                    </div>
                  ) : (
                    desglose.map((c, i) => (
                      <div key={c.id || i} className="p-4 bg-white space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-sm text-[#0B1929]">{c.nombre}</span>
                          <span className="font-bold text-sm text-[var(--brand-primary)]">${c.costoPaciente.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-[#6B7A8D]">
                          <span>Alta: {c.created_at ? new Date(c.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "Reciente"}</span>
                          <span>Días: {c.diasCobrar}/30</span>
                        </div>
                        <div className="text-[11px] text-[#6B7A8D] bg-gray-50 p-2 rounded-xl text-center">
                          {c.periodoStr}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Administrativos patrocinados */}
                {adminLines.length > 0 && (
                  <div className="border-t border-[#E2E8F0]">
                    <div className="px-6 py-2.5 bg-amber-50/60 text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                      Administrativos Premium Patrocinados
                    </div>
                    <div className="divide-y divide-gray-100">
                      {adminLines.map(l => (
                        <div key={l.id} className="px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="font-semibold text-sm text-[#0B1929]">
                              {l.nombre}
                              {!l.activo && <span className="ml-2 text-[11px] font-medium text-[#6B7A8D]">(dado de baja)</span>}
                            </p>
                            <p className="text-xs text-[#6B7A8D]">{l.periodoStr} · {l.diasCobrar}/30 días</p>
                          </div>
                          <p className="font-bold text-sm text-[var(--brand-primary)]">${l.costo.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Total Summary */}
              <div className="p-6 bg-gray-50/60 border-t border-[#E2E8F0]">
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-xs md:text-sm">
                    <span className="text-[#6B7A8D]">Subtotal pacientes ({activeCount} pac. a ${currentRate} MXN)</span>
                    <span className="font-bold text-[#0B1929]">${patientSubtotal.toFixed(2)}</span>
                  </div>
                  {adminLines.length > 0 && (
                    <div className="flex justify-between items-center text-xs md:text-sm">
                      <span className="text-[#6B7A8D]">Administrativos Premium ({adminLines.length})</span>
                      <span className="font-bold text-[#0B1929]">${adminTotal.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <span className="text-base md:text-lg font-black text-[#0B1929]">Total del Corte</span>
                    <span className="text-xl md:text-2xl font-black text-[var(--brand-primary)]">
                      ${totalAmount.toFixed(2)} <span className="text-xs font-semibold text-[#6B7A8D]">MXN</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha:
              - En Android (isPlayApp): Tarjeta informativa de facturación empresarial (100% compliant con Play Store)
              - En Web (!isPlayApp): Tarjeta completa de transferencia SPEI con subida de comprobante
          */}
          <div className="lg:col-span-5 space-y-4">
            {isPlayApp ? (
              <div className="bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-[#E2E8F0] flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 rounded-2xl bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#0B1929]">
                        Suscripción Profesional por Volumen
                      </h3>
                      <p className="text-xs text-[#6B7A8D]">
                        Facturación mensual para clínicas y especialistas
                      </p>
                    </div>
                  </div>

                  <div className="my-5 p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#6B7A8D] font-medium">Nivel de tarifa:</span>
                      <span className="font-bold text-[#0B1929]">Nivel {currentTier} (${currentRate} MXN / pac)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#6B7A8D] font-medium">Pacientes activos:</span>
                      <span className="font-bold text-[#0B1929]">{activeCount} paciente{activeCount !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#6B7A8D] font-medium">Corte de ciclo:</span>
                      <span className="font-bold text-[#0B1929]">{fechaCorteText}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2.5 border-t border-gray-200">
                      <span className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Total del Periodo:</span>
                      <span className="text-xl font-black text-[var(--brand-primary)]">
                        ${totalAmount.toFixed(2)} <span className="text-xs font-semibold text-[#6B7A8D]">MXN</span>
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#6B7A8D] leading-relaxed mb-4">
                    Tu suscripción opera bajo un modelo dinámico adaptado al tamaño de tu práctica. La gestión, conciliación y comprobantes de tu cuenta se administran a través del portal web de FLUX.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-[#0B1929] space-y-1">
                  <span className="font-bold block text-slate-800">📌 Gestión de tu Cuenta Web</span>
                  <p className="text-[#6B7A8D] leading-relaxed">
                    Para consultar facturas anteriores o conciliar saldos de tu corte, inicia sesión con tu misma cuenta desde cualquier navegador web en tu computadora o dispositivo.
                  </p>
                </div>
              </div>
            ) : (
              renderSpeiCard("Corte mensual con fecha límite de pago al día 10.")
            )}
          </div>
        </div>
      )}

      {/* ── REGLAS DE FACTURACIÓN ── */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6">
        <h3 className="text-xs font-bold text-[#0B1929] uppercase tracking-wider mb-4 flex items-center gap-2">
          <Info size={16} className="text-[#6B7A8D]" />
          <span>Reglas de Facturación y Días de Gracia</span>
        </h3>
        {isEstudiante ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="block text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider mb-1">Duración</span>
              <p className="text-sm font-semibold text-[#0B1929]">30 días desde la fecha de pago.</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="block text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider mb-1">Vencimiento</span>
              <p className="text-sm font-bold text-[var(--brand-primary)]">
                {expirationDate ? expirationDate.toLocaleDateString("es-MX", { day: "2-digit", month: "long" }) : "Pendiente"}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm">
              <span className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Días de Gracia</span>
              <p className="text-sm font-semibold text-[#0B1929]">2 días tras el vencimiento.</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm">
              <span className="block text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">Bloqueo Preventivo</span>
              <p className="text-sm font-semibold text-[#0B1929]">Al 3er día sin renovación.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="block text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider mb-1">Ciclo Mensual</span>
              <p className="text-sm font-semibold text-[#0B1929]">Del día 10 al 10 de cada mes.</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="block text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider mb-1">Límite de Pago</span>
              <p className="text-sm font-bold text-[var(--brand-primary)]">Día 10 del mes en curso.</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm">
              <span className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Días de Gracia</span>
              <p className="text-sm font-semibold text-[#0B1929]">Días 11 y 12 (servicio activo).</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm">
              <span className="block text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">Bloqueo Preventivo</span>
              <p className="text-sm font-semibold text-[#0B1929]">Día 13 si no hay comprobante.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── HISTORIAL DE PAGOS ── */}
      <div className="bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-[#E2E8F0]">
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
                  <th className="py-3 px-4 text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">Mes Facturado</th>
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
                      {r.fecha_corte_mes ? new Date(r.fecha_corte_mes).toLocaleDateString("es-MX", { month: "long", year: "numeric" }) : "—"}
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
                    <span>{r.fecha_corte_mes ? new Date(r.fecha_corte_mes).toLocaleDateString("es-MX", { month: "long", year: "numeric" }) : "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
