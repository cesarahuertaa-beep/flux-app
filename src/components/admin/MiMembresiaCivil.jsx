import React, { useState, useEffect, useMemo } from "react";
import { dbGet, dbPost, storageUpload } from "../../lib/supabase";
import {
  CreditCard,
  Upload,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Dumbbell,
  BarChart2,
  AlertCircle,
  Info,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  RefreshCw
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
 * MiMembresiaCivil — Pantalla de suscripción para Atletas Independientes.
 * Diseño moderno, profesional y homologado para web y Android.
 */
export default function MiMembresiaCivil({ clienteData, setMsg }) {
  const isPlayApp = isNativePlayApp();
  const [configPago, setConfigPago] = useState({ clabe: "", banco: "", beneficiario: "" });
  const [rawCfg, setRawCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [origen, setOrigen] = useState(clienteData?.premium_origen || null);
  const [patrocinador, setPatrocinador] = useState("");
  const [copiedClabe, setCopiedClabe] = useState(false);
  const [copiedConcepto, setCopiedConcepto] = useState(false);

  // Cálculos de fecha de vencimiento (Rolling 30 days)
  const { targetCutoff, expirationDate } = useMemo(() => {
    const today = new Date();
    const lastValid = historial.find((r) => r.estado === "aprobado" || r.estado === "pendiente");

    if (!lastValid) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return { targetCutoff: d, expirationDate: null };
    }

    const lastExp = new Date(lastValid.fecha_corte_mes + "T23:59:59");
    const blockDate = new Date(lastExp);
    blockDate.setDate(blockDate.getDate() + 2);

    if (today > blockDate) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return { targetCutoff: d, expirationDate: lastExp };
    } else {
      const d = new Date(lastExp);
      d.setDate(d.getDate() + 30);
      return { targetCutoff: d, expirationDate: lastExp };
    }
  }, [historial]);

  const TARIFA = useMemo(() => {
    const referenceDate = expirationDate && new Date() >= expirationDate ? expirationDate : new Date();
    const rates = getRatesForCutoff(rawCfg, referenceDate);
    return Number(rates.civil_premium ?? 75);
  }, [rawCfg, expirationDate]);

  const isPremium = clienteData?.plan_tipo === "premium";
  const hasPendingPayment = historial.some((r) => r.estado === "pendiente");

  const diasRestantesText = useMemo(() => {
    if (!isPremium || !expirationDate) return null;
    const target = new Date(expirationDate);
    target.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((target - today) / (1000 * 60 * 60 * 24));

    if (days > 1) return `Expira en ${days} días`;
    if (days === 1) return `Expira mañana`;
    if (days === 0) return `Expira hoy`;
    if (days < 0) return `En días de gracia (venció hace ${Math.abs(days)} días)`;
    return null;
  }, [expirationDate, isPremium]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cfg, recibos] = await Promise.all([
        dbGet("configuracion_plataforma?id=eq.1"),
        dbGet(`recibos_pago_civil?cliente_id=eq.${clienteData.id}&order=created_at.desc`)
      ]);
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
        const fresh = await dbGet(`clientes?id=eq.${clienteData.id}&select=premium_origen`);
        const o = fresh?.[0]?.premium_origen || null;
        setOrigen(o);
        if (o === "patrocinado" && clienteData.auth_id) {
          const pat = await dbGet(`premium_patrocinado?miembro_profile_id=eq.${clienteData.auth_id}&desactivado_en=is.null`);
          if (pat?.[0]) {
            const prof = await dbGet(`profiles?id=eq.${pat[0].patrocinador_id}&select=nombre,nombre_marca`);
            setPatrocinador(prof?.[0]?.nombre_marca || prof?.[0]?.nombre || "tu nutriólogo");
          }
        }
      } catch (e) {
        console.warn("premium_origen:", e);
      }
    } catch (e) {
      console.error("Error cargando config de pago:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [clienteData.id]);

  const handleUploadClick = () => {
    document.getElementById("comprobanteUploadCivil").click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setMsg("Subiendo comprobante...");

    try {
      const ext = file.name.split(".").pop();
      const path = `civil_${clienteData.id}_${Date.now()}.${ext}`;
      const url = await storageUpload("comprobantes", path, file);

      const reciboRes = await dbPost("recibos_pago_civil", {
        cliente_id: clienteData.id,
        monto: TARIFA,
        fecha_corte_mes: targetCutoff.toISOString().split("T")[0],
        comprobante_url: url,
        estado: "pendiente"
      });

      // Notificar superadmins
      try {
        const superadmins = await dbGet("profiles?role=eq.superadmin");
        for (const admin of superadmins) {
          await dbPost(
            "notificaciones",
            {
              profile_id: admin.id,
              titulo: "Pago de Atleta Independiente",
              mensaje: `El atleta ${clienteData.nombre} ha subido su comprobante.`,
              tipo: "pago",
              link_url: "pagos",
              entidad_id: reciboRes[0]?.id
            },
            { headers: { Prefer: "return=minimal" } }
          );
        }
      } catch (e) {}

      setMsg(
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-green-500" /> Comprobante subido. Lo revisaremos en menos de 24 horas.
        </div>
      );
      loadData();
    } catch (error) {
      console.error(error);
      setMsg(
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-red-500" /> Error al subir: {error.message}
        </div>
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

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

  const conceptoStr = `FLX-${clienteData?.id ? String(clienteData.id).substring(0, 6).toUpperCase() : "ATLETA"}`;

  // ── CASO: Premium Incluido (Staff o Patrocinado por Nutriólogo) ──
  if (origen === "staff" || origen === "patrocinado") {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6 pb-6">
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-[#E2E8F0]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#F0F4FA]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Cortesía Institucional</span>
              </div>
              <h2 className="text-xl font-bold text-[#0B1929]">Tu Membresía Atleta</h2>
              <p className="text-sm text-[#6B7A8D] mt-1">
                {origen === "staff"
                  ? "Tu cuenta Premium está 100% bonificada por ser miembro del Staff de FLUX."
                  : `Tu cuenta Premium es cortesía de tu nutriólogo (${patrocinador || "Especialista"}).`}
              </p>
            </div>
            <div className="bg-emerald-50 text-emerald-700 px-4 py-2.5 rounded-2xl border border-emerald-200 flex items-center gap-2 font-bold whitespace-nowrap self-start sm:self-auto">
              <CheckCircle2 size={18} />
              <span>Premium Activo</span>
            </div>
          </div>

          <div className="pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7A8D] mb-4">Beneficios Activos Incluidos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: <Dumbbell size={16} />, text: "Constructor de rutinas y ejercicios ilimitado" },
                { icon: <FileText size={16} />, text: "Planeación nutricional y cálculo de macros" },
                { icon: <BarChart2 size={16} />, text: "Seguimiento de peso, grasa y somatocarta" },
                { icon: <ShieldCheck size={16} />, text: "Modo Atleta con cronómetro inteligente" }
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-[var(--brand-primary)] shrink-0">{b.icon}</span>
                  <span className="text-xs font-semibold text-[#0B1929]">{b.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-6">
      <input
        type="file"
        id="comprobanteUploadCivil"
        accept="image/*,.pdf"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* ── BANNER DE ESTADO COMPACTO Y ELEGANTE ── */}
      <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">
            Estado Actual
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <h2 className="text-lg md:text-xl font-bold text-[#0B1929]">
              {hasPendingPayment
                ? "Comprobante en Revisión"
                : isPremium
                ? "Atleta Premium Activo"
                : "Plan Estándar (Gratuito)"}
            </h2>
            {isPremium && (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Activo"></span>
            )}
          </div>
          <p className="text-xs text-[#6B7A8D] mt-1">
            {hasPendingPayment
              ? "Hemos recibido tu comprobante. Nuestro equipo lo validará en breve."
              : isPremium
              ? `Tu acceso está vigente hasta el ${expirationDate ? expirationDate.toLocaleDateString("es-MX", { day: "2-digit", month: "long" }) : "próximo mes"}.`
              : "Desbloquea el constructor ilimitado de rutinas, macros y cronómetro pro."}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {hasPendingPayment ? (
            <div className="bg-amber-50 text-amber-700 px-3.5 py-2 rounded-xl border border-amber-200 flex items-center gap-1.5 text-xs font-bold">
              <AlertCircle size={15} />
              <span>En Revisión</span>
            </div>
          ) : isPremium ? (
            <div className="flex flex-col items-end gap-1">
              <div className="bg-emerald-50 text-emerald-700 px-3.5 py-2 rounded-xl border border-emerald-200 flex items-center gap-1.5 text-xs font-bold">
                <CheckCircle2 size={15} />
                <span>Premium</span>
              </div>
              {diasRestantesText && (
                <span className="text-[11px] font-semibold text-[#6B7A8D]">
                  {diasRestantesText}
                </span>
              )}
            </div>
          ) : (
            <div className="bg-slate-100 text-[#6B7A8D] px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold">
              Estándar
            </div>
          )}
        </div>
      </div>

      {/* ── TARJETA PRINCIPAL: PLAN Y FACTURACIÓN ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Columna Izquierda: Beneficios del Plan (5 cols) */}
        <div className="md:col-span-5 bg-gradient-to-br from-[#0B1929] to-[#152336] text-white p-6 md:p-7 rounded-3xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-4 border border-white/10">
              <Sparkles size={12} />
              Membresía Atleta Pro
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl md:text-5xl font-black tracking-tight text-white">
                ${TARIFA}
              </span>
              <span className="text-sm font-semibold text-slate-300">
                MXN / mes
              </span>
            </div>
            <p className="text-xs text-slate-300 mb-6">
              Sin contratos forzosos. Renueva cada 30 días o cancela cuando quieras.
            </p>

            <ul className="space-y-3">
              {[
                { icon: <Dumbbell size={16} />, text: "Constructor de rutinas sin límites" },
                { icon: <FileText size={16} />, text: "Cálculo nutricional y biblioteca de comidas" },
                { icon: <BarChart2 size={16} />, text: "Seguimiento de peso, grasa y somatocarta" },
                { icon: <ShieldCheck size={16} />, text: "Modo Atleta con cronómetro y descanso" }
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

          <div className="pt-6 mt-6 border-t border-white/10 text-[11px] text-slate-300">
            Garantía de rendimiento FLUX • Control total de tu preparación.
          </div>
        </div>

        {/* Columna Derecha: Método de Pago (7 cols) */}
        <div className="md:col-span-7 bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-[#E2E8F0] flex flex-col justify-between">
          {isPlayApp ? (
            /* ── FACTURACIÓN GOOGLE PLAY (ANDROID) ── */
            <div className="flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0B1929]">
                      Suscripción Google Play
                    </h3>
                    <p className="text-xs text-[#6B7A8D]">
                      Procesada con la seguridad oficial de Google Play Store
                    </p>
                  </div>
                </div>

                <div className="my-5 p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#6B7A8D] font-medium">Producto:</span>
                    <span className="font-bold text-[#0B1929]">FLUX Atleta Independiente</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#6B7A8D] font-medium">Tarifa mensual:</span>
                    <span className="font-bold text-[var(--brand-primary)]">${Number(TARIFA).toFixed(2)} MXN</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#6B7A8D] font-medium">Renovación:</span>
                    <span className="font-bold text-[#0B1929]">Automática cada 30 días</span>
                  </div>
                </div>

                <p className="text-[11px] text-[#6B7A8D] leading-relaxed mb-6">
                  Puedes cancelar o modificar el método de pago en cualquier momento desde la sección <strong>Pagos y Suscripciones</strong> de tu cuenta de Google.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  disabled={uploading || loading}
                  onClick={async () => {
                    if (isPremium) {
                      openPlayStoreSubscriptions(PLAY_BILLING_PRODUCTS.CIVIL_PREMIUM);
                      return;
                    }
                    setUploading(true);
                    try {
                      const res = await startGooglePlaySubscription(PLAY_BILLING_PRODUCTS.CIVIL_PREMIUM, {
                        role: "civil",
                        clienteId: clienteData?.id,
                        nombre: clienteData?.nombre
                      });
                      if (res.status === "purchased") {
                        setMsg(
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-green-500" /> ¡Suscripción activada con éxito en Google Play!
                          </div>
                        );
                        loadData();
                      } else if (res.status === "unavailable_in_region_or_review") {
                        setMsg(
                          <div className="flex items-center gap-1.5">
                            <Info className="w-4 h-4 text-blue-500" /> La suscripción se activará tan pronto como concluya la revisión de Google Play.
                          </div>
                        );
                      }
                    } catch (err) {
                      setMsg(
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-red-500" /> {err.message}
                        </div>
                      );
                    } finally {
                      setUploading(false);
                    }
                  }}
                  className="w-full bg-[var(--brand-primary)] hover:opacity-95 text-white font-bold py-3.5 px-4 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                >
                  <CreditCard size={17} />
                  <span>
                    {uploading
                      ? "Conectando con Google Play..."
                      : isPremium
                      ? "Administrar Suscripción en Google Play"
                      : `Suscribirme con Google Play • $${TARIFA} MXN`}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={uploading || loading}
                  onClick={async () => {
                    setUploading(true);
                    try {
                      const res = await restoreGooglePlayPurchases({
                        role: "civil",
                        clienteId: clienteData?.id,
                        nombre: clienteData?.nombre
                      });
                      if (res.hasActiveEntitlement) {
                        setMsg(
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-green-500" /> Suscripción restaurada con éxito.
                          </div>
                        );
                        loadData();
                      } else {
                        setMsg(
                          <div className="flex items-center gap-1.5">
                            <Info className="w-4 h-4 text-blue-500" /> No se encontraron compras activas en esta cuenta de Google Play.
                          </div>
                        );
                      }
                    } catch (err) {
                      setMsg(
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-red-500" /> {err.message}
                        </div>
                      );
                    } finally {
                      setUploading(false);
                    }
                  }}
                  className="w-full text-center text-xs font-semibold text-[#6B7A8D] hover:text-[var(--brand-primary)] py-1.5 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={13} />
                  <span>¿Ya tienes una suscripción? Restaurar compras</span>
                </button>
              </div>
            </div>
          ) : (
            /* ── TRANSFERENCIA SPEI (WEB / DESKTOP) ── */
            <div className="flex flex-col justify-between h-full space-y-5">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0B1929]">
                      Transferencia Bancaria SPEI
                    </h3>
                    <p className="text-xs text-[#6B7A8D]">
                      Transfiere y sube tu comprobante para validación en menos de 24h
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  {/* Beneficiario */}
                  <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">
                      Beneficiario
                    </span>
                    <span className="font-bold text-[#0B1929] text-sm">
                      {configPago.beneficiario || "FLUX Sport S.A."}
                    </span>
                  </div>

                  {/* Banco y CLABE */}
                  <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">
                        CLABE ({configPago.banco || "Banco"})
                      </span>
                      <span className="font-mono font-bold text-[#0B1929] text-sm">
                        {configPago.clabe || "Sin configurar"}
                      </span>
                    </div>
                    {configPago.clabe && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(configPago.clabe, "clabe")}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-[var(--brand-primary)] text-xs font-bold hover:bg-blue-50 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedClabe ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                        <span>{copiedClabe ? "Copiado" : "Copiar"}</span>
                      </button>
                    )}
                  </div>

                  {/* Concepto obligatorio */}
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                        Concepto Obligatorio
                      </span>
                      <span className="font-mono font-black text-amber-900 text-sm">
                        {conceptoStr}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(conceptoStr, "concepto")}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedConcepto ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      <span>{copiedConcepto ? "Copiado" : "Copiar"}</span>
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleUploadClick}
                disabled={uploading || loading}
                className="w-full bg-[var(--brand-primary)] hover:opacity-95 text-white font-bold py-3.5 px-4 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm mt-3"
              >
                <Upload size={17} />
                <span>
                  {uploading
                    ? "Subiendo comprobante..."
                    : hasPendingPayment
                    ? "Subir Nuevo Comprobante"
                    : `Subir Comprobante • $${Number(TARIFA).toFixed(2)} MXN`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── REGLAS DE MEMBRESÍA ── */}
      <div className="bg-white border border-[#E2E8F0] rounded-3xl p-5 md:p-6 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7A8D] mb-4 flex items-center gap-1.5">
          <Info size={14} />
          Reglas de Tu Suscripción
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#E2E8F0]">
            <span className="block text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider">Duración</span>
            <p className="text-xs font-bold text-[#0B1929] mt-0.5">30 días continuos</p>
          </div>
          <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#E2E8F0]">
            <span className="block text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider">Vencimiento</span>
            <p className="text-xs font-bold text-[var(--brand-primary)] mt-0.5">
              {expirationDate ? expirationDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "Pendiente"}
            </p>
          </div>
          <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-emerald-100">
            <span className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Días de Gracia</span>
            <p className="text-xs font-bold text-emerald-700 mt-0.5">2 días adicionales</p>
          </div>
          <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-red-100">
            <span className="block text-[10px] font-bold text-red-600 uppercase tracking-wider">Sin Pago</span>
            <p className="text-xs font-bold text-red-600 mt-0.5">Vuelve a Estándar</p>
          </div>
        </div>
      </div>

      {/* ── HISTORIAL DE PAGOS ── */}
      <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-[#E2E8F0]">
        <h3 className="text-base font-bold text-[#0B1929] mb-4">
          Historial de Pagos
        </h3>
        {loading ? (
          <div className="text-xs text-[#6B7A8D] py-4 text-center">Cargando historial...</div>
        ) : historial.length === 0 ? (
          <div className="text-xs text-[#6B7A8D] bg-[#F8FAFC] p-4 rounded-2xl text-center border border-[#E2E8F0]">
            No tienes pagos registrados aún.
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop Table */}
            <table className="w-full text-left border-collapse hidden sm:table">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="py-2.5 px-4 text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider">Fecha</th>
                  <th className="py-2.5 px-4 text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider">Periodo Válido</th>
                  <th className="py-2.5 px-4 text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider text-right">Monto</th>
                  <th className="py-2.5 px-4 text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4FA]">
                {historial.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 text-xs font-medium text-[#0B1929] whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString("es-MX")}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#6B7A8D] whitespace-nowrap">
                      {r.fecha_corte_mes
                        ? new Date(r.fecha_corte_mes).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="py-3 px-4 font-bold text-xs text-[#0B1929] text-right whitespace-nowrap">
                      ${Number(r.monto).toFixed(2)} MXN
                    </td>
                    <td className="py-3 px-4 flex justify-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          r.estado === "aprobado"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : r.estado === "rechazado"
                            ? "bg-red-50 text-red-600 border border-red-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {r.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="sm:hidden divide-y divide-[#F0F4FA]">
              {historial.map((r) => (
                <div key={r.id} className="py-3 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-[#0B1929]">${Number(r.monto).toFixed(2)} MXN</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        r.estado === "aprobado"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : r.estado === "rechazado"
                          ? "bg-red-50 text-red-600 border border-red-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {r.estado}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-[#6B7A8D]">
                    <span>{new Date(r.created_at).toLocaleDateString("es-MX")}</span>
                    <span>
                      Hasta: {r.fecha_corte_mes ? new Date(r.fecha_corte_mes).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—"}
                    </span>
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
