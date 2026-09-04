import { useState, useEffect, useCallback } from "react";
import { dbGet } from "../../lib/supabase";
import { parseFotos } from "../../utils/helpers";
import { Camera, FileText, Activity, CalendarDays, ZoomIn, X, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useBrand } from "../BrandContext";
import { generateProgresoPDF } from "../../utils/pdf";
import { createPortal } from "react-dom";

const fmtDate = (d) => {
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
};

const delta = (curr, prev, key) => {
  if (curr[key] == null || prev[key] == null || curr[key] === "" || prev[key] === "") return null;
  const d = parseFloat(curr[key]) - parseFloat(prev[key]);
  return d === 0 ? null : d;
};

const DISPLAY_KEYS = [
  { key: "peso", label: "Peso", unit: "kg" },
  { key: "grasa_pct", label: "Grasa", unit: "%" },
  { key: "musculo_pct", label: "Músculo", unit: "%" },
  { key: "cintura", label: "Cintura", unit: "cm" },
];

export default function Progreso({ cliente }) {
  const [metricas, setMetricas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);
  const brand = useBrand();

  const loadData = useCallback(async () => {
    if (!cliente?.id) return;
    setLoading(true);
    try {
      const ms = await dbGet(`metricas_progreso?cliente_id=eq.${cliente.id}&order=fecha.desc`);
      setMetricas(ms);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [cliente]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[#6B7A8D]">
        <div className="w-10 h-10 border-4 border-[#F0F4FA] border-t-[var(--brand-primary)] rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Cargando progreso...</p>
      </div>
    );
  }

  if (metricas.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-white m-4 md:m-8 rounded-2xl border border-[#E2E8F0] shadow-sm">
        <div className="w-16 h-16 bg-[#F0F4FA] rounded-full flex items-center justify-center mb-4">
          <Camera size={32} className="text-[#6B7A8D]" />
        </div>
        <h2 className="text-xl font-bold text-[#0B1929] mb-2" style={{ fontFamily: "DM Sans" }}>
          Aún no hay registros
        </h2>
        <p className="text-sm text-[#6B7A8D] max-w-sm">
          No hay fotos ni evaluaciones corporales disponibles en tu historial. Tu nutriólogo subirá tu progreso próximamente.
        </p>
      </div>
    );
  }

  const handleDownloadPDF = () => {
    generateProgresoPDF(cliente, metricas, brand);
  };

  return (
    <div className="h-full flex flex-col">
      {/* ── Header ── */}
      <div className="px-6 md:px-8 pt-6 md:pt-8 pb-6 border-b border-[#F0F4FA] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/50">
        <div>
          <p className="text-[10px] font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">
            Resultados
          </p>
          <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
            Galería Corporal
          </h1>
          {cliente?.nombre && (
            <p className="text-sm text-[#6B7A8D] mt-1">
              Paciente: <span className="text-[var(--brand-primary)] font-medium">{cliente.nombre}</span>
            </p>
          )}
        </div>
        
        <button
          onClick={handleDownloadPDF}
          className="flex items-center justify-center gap-2 bg-white border border-[#E2E8F0] text-[#0B1929] px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors w-full sm:w-auto"
        >
          <FileText size={18} />
          Descargar PDF
        </button>
      </div>

      {/* ── Main Timeline ── */}
      <div className="px-6 md:px-8 flex-1 overflow-y-auto py-8 space-y-12">
        {metricas.map((m, idx) => {
          const prev = metricas[idx + 1];
          const fotos = parseFotos(m.fotos);
          const isLatest = idx === 0;

          return (
            <div key={m.id} className="relative">
              {/* Línea de tiempo (oculta en el último elemento) */}
              {idx !== metricas.length - 1 && (
                <div className="absolute left-5 top-12 bottom-[-48px] w-0.5 bg-[#E2E8F0]" />
              )}
              
              <div className="flex gap-4 md:gap-6">
                {/* Dot */}
                <div className="relative z-10 flex-shrink-0 mt-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm border-2 ${
                    isLatest 
                      ? "bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white" 
                      : "bg-white border-[#E2E8F0] text-[#9BA5B0]"
                  }`}>
                    {isLatest ? <Activity size={18} /> : <CalendarDays size={18} />}
                  </div>
                </div>

                {/* Contenido de la evaluación */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-lg font-bold text-[#0B1929] capitalize tracking-tight" style={{ fontFamily: "DM Sans" }}>
                      {fmtDate(m.fecha)}
                    </h2>
                    {isLatest && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[var(--brand-primary)] text-white text-[10px] font-bold uppercase tracking-widest bg-opacity-90">
                        Actual
                      </span>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden transition-all hover:shadow-md">
                    
                    {/* Grid de Fotos (si hay) */}
                    {fotos.length > 0 && (
                      <div className={`grid gap-0.5 bg-[#E2E8F0] ${
                        fotos.length === 1 ? "grid-cols-1" :
                        fotos.length === 2 ? "grid-cols-2" :
                        "grid-cols-3"
                      }`}>
                        {fotos.map((url, i) => (
                          <div 
                            key={i} 
                            className="relative group aspect-square bg-[#F7F9FC] overflow-hidden cursor-pointer"
                            onClick={() => setLightbox(url)}
                          >
                            <img 
                              src={url} 
                              alt={`Progreso ${i + 1}`} 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-[#0B1929]/30 transition-colors flex items-center justify-center">
                              <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 duration-300" size={32} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tarjetas de Métricas Clave */}
                    <div className="p-5 md:p-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {DISPLAY_KEYS.filter(f => m[f.key] !== null && m[f.key] !== undefined && m[f.key] !== "").map(f => {
                          const val = m[f.key];
                          const d = prev ? delta(m, prev, f.key) : null;
                          // Para peso y grasa, bajar es bueno (verde), subir es malo (rojo). Para músculo, al revés.
                          const reverseColors = f.key === "peso" || f.key === "grasa_pct" || f.key === "cintura";
                          
                          let trendColor = "text-[#9BA5B0] border-[#E2E8F0]";
                          let TrendIcon = Minus;
                          if (d !== null) {
                            if (d < 0) {
                              trendColor = reverseColors ? "text-emerald-600 border-emerald-200" : "text-red-600 border-red-200";
                              TrendIcon = TrendingDown;
                            } else if (d > 0) {
                              trendColor = reverseColors ? "text-red-600 border-red-200" : "text-emerald-600 border-emerald-200";
                              TrendIcon = TrendingUp;
                            }
                          }

                          return (
                            <div key={f.key} className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl p-3 flex flex-col justify-center items-center text-center">
                              <span className="text-[10px] font-bold tracking-widest text-[#6B7A8D] uppercase mb-1">
                                {f.label}
                              </span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
                                  {val}
                                </span>
                                {f.unit && <span className="text-xs text-[#9BA5B0] font-medium">{f.unit}</span>}
                              </div>
                              
                              {/* Delta Badge */}
                              {d !== null ? (
                                <div className={`flex items-center gap-0.5 mt-2 ${trendColor} text-[10px] font-bold bg-white px-1.5 py-0.5 rounded shadow-sm border`}>
                                  <TrendIcon size={12} strokeWidth={3} />
                                  <span>{Math.abs(d).toFixed(1)}</span>
                                </div>
                              ) : (
                                <div className="h-5 mt-2" /> // spacer
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Notas / Observaciones */}
                      {m.notas && (
                        <div className="mt-4 p-4 bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl text-sm text-[#166534] leading-relaxed">
                          <strong className="block text-[10px] font-bold uppercase tracking-widest mb-1 text-[#15803D]">
                            Comentarios del Nutriólogo
                          </strong>
                          {m.notas}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Lightbox ── */}
      {lightbox && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0B1929]/95 backdrop-blur-sm cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setLightbox(null)}
        >
          <img 
            src={lightbox} 
            alt="Fullscreen" 
            className="max-w-[95vw] max-h-[90vh] rounded-xl object-contain shadow-2xl animate-in zoom-in-95 duration-200"
          />
          <button 
            className="absolute top-6 right-6 md:top-8 md:right-8 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors backdrop-blur-md"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
          >
            <X size={24} />
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
