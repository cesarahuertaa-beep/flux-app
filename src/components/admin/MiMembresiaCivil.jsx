import React, { useState, useEffect } from "react";
import { dbGet, dbPost, storageUpload } from "../../lib/supabase";
import { CreditCard, Upload, CheckCircle2, FileText, ShieldCheck, Dumbbell, BarChart2, AlertCircle } from "lucide-react";

/**
 * MiMembresiaCivil — Pantalla de membresía para usuarios Civil Premium.
 * Tarifa fija: $75 MXN/mes. Sin cálculos de prorrateo.
 * Reutiliza la estructura visual de MiMembresia.jsx.
 */
export default function MiMembresiaCivil({ clienteData, setMsg }) {
  const [configPago, setConfigPago] = useState({ clabe: "", banco: "", beneficiario: "" });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const TARIFA = 75;

  useEffect(() => {
    async function loadData() {
      try {
        const cfg = await dbGet("configuracion_plataforma?id=eq.1");
        if (cfg && cfg.length > 0) setConfigPago({
          clabe: cfg[0].clabe || "",
          banco: cfg[0].banco || "",
          beneficiario: cfg[0].beneficiario || ""
        });
      } catch (e) {
        console.error("Error cargando config de pago:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleUploadClick = () => {
    document.getElementById("comprobanteUploadCivil").click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setMsg("Subiendo comprobante...");

    try {
      const ext = file.name.split('.').pop();
      const path = `civil_${clienteData.id}_${Date.now()}.${ext}`;
      const url = await storageUpload('comprobantes', path, file);

      const today = new Date();
      const nextCutoff = new Date(today.getFullYear(), today.getMonth() + 1, 10)
        .toISOString().split('T')[0];

      await dbPost('recibos_pago_civil', {
        cliente_id: clienteData.id,
        monto: TARIFA,
        fecha_corte_mes: nextCutoff,
        comprobante_url: url,
        estado: 'pendiente'
      });

      setMsg(<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Comprobante subido. Lo revisaremos en menos de 24 horas.</div>);
    } catch (error) {
      console.error(error);
      if (error.message?.includes('relation "recibos_pago_civil" does not exist')) {
        setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> Error: La base de datos aún no está configurada para recibir pagos civiles. Contacta a soporte.</div>);
      } else {
        setMsg(<div className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-red-500" /> Error al subir: {error.message}</div>);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-fade-in pb-10">
      <input
        type="file"
        id="comprobanteUploadCivil"
        accept="image/*,.pdf"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Banner de Estado */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0] flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1929]">Tu Membresía Civil Premium</h2>
          <p className="text-[#6B7A8D] mt-1">Acceso completo al constructor de planes y modo atleta.</p>
        </div>
        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-200 flex items-center gap-2 font-bold whitespace-nowrap">
          <CheckCircle2 size={18} />
          Servicio Activo
        </div>
      </div>

      {/* Tarjeta de precio y beneficios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Precio */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[var(--brand-primary)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand-primary)]/10 flex items-center justify-center">
              <CreditCard size={20} className="text-[var(--brand-primary)]" />
            </div>
            <h3 className="text-lg font-bold text-[#0B1929]">Plan Mensual</h3>
          </div>
          <div className="text-5xl font-extrabold text-[#0B1929] mb-1">
            $75
          </div>
          <div className="text-[#6B7A8D] text-sm mb-6">MXN / mes · Sin contrato</div>
          <ul className="space-y-3">
            {[
              { icon: <Dumbbell size={15} />, text: "Constructor de rutinas ilimitado" },
              { icon: <FileText size={15} />, text: "Planeación nutricional propia" },
              { icon: <BarChart2 size={15} />, text: "Seguimiento de progreso y métricas" },
              { icon: <ShieldCheck size={15} />, text: "Modo Atleta con cronómetro" }
            ].map((b, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm text-[#0B1929] font-medium">
                <span className="text-[var(--brand-primary)]">{b.icon}</span>
                {b.text}
              </li>
            ))}
          </ul>
        </div>

        {/* Pago por SPEI */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Upload size={20} className="text-[var(--brand-primary)]" />
            </div>
            <h3 className="text-lg font-bold text-[#0B1929]">Pago por SPEI</h3>
          </div>

          {loading ? (
            <div className="text-[#6B7A8D] text-sm">Cargando datos de pago...</div>
          ) : (
            <div className="space-y-3 text-sm mb-6">
              <div className="bg-[#F0F4FA] rounded-xl p-3">
                <span className="text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider">Beneficiario</span>
                <p className="font-bold text-[#0B1929] mt-0.5">{configPago.beneficiario || "FLUX Sport S.A."}</p>
              </div>
              <div className="bg-[#F0F4FA] rounded-xl p-3">
                <span className="text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider">Banco</span>
                <p className="font-bold text-[#0B1929] mt-0.5">{configPago.banco || "—"}</p>
              </div>
              <div className="bg-[#F0F4FA] rounded-xl p-3">
                <span className="text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider">CLABE</span>
                <p className="font-bold text-[#0B1929] mt-0.5 font-mono tracking-wider">{configPago.clabe || "—"}</p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                Transfiere <strong>$75.00 MXN</strong> y sube tu comprobante. Tu acceso se renueva por 30 días desde la confirmación.
              </div>
            </div>
          )}

          <button
            onClick={handleUploadClick}
            disabled={uploading}
            className="w-full bg-[var(--brand-primary)] text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Upload size={16} />
            {uploading ? "Subiendo..." : "Subir Comprobante de Pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
