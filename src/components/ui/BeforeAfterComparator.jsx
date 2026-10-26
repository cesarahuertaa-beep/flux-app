import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  Columns,
  SlidersHorizontal,
  Layers,
  Download,
  Calendar,
  Sparkles,
  MoveHorizontal,
  ArrowLeftRight,
  Check,
  X,
  Scale,
  Clock,
  ChevronDown,
  Info,
} from "lucide-react";

const fmtDate = (d) => {
  if (!d) return "";
  try {
    const date = new Date(d + "T12:00:00");
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
};

const getDaysDiff = (d1, d2) => {
  if (!d1 || !d2) return null;
  try {
    const t1 = new Date(d1 + "T12:00:00").getTime();
    const t2 = new Date(d2 + "T12:00:00").getTime();
    if (isNaN(t1) || isNaN(t2)) return null;
    const diff = Math.round(Math.abs(t2 - t1) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Mismo día";
    if (diff === 1) return "1 día de diferencia";
    if (diff < 30) return `${diff} días de diferencia`;
    const months = Math.round(diff / 30);
    return `${months} ${months === 1 ? "mes" : "meses"} de diferencia (${diff} días)`;
  } catch {
    return null;
  }
};

export function BeforeAfterComparator({
  photos = [], // Array of { url, fecha, label, peso, grasa_pct, type }
  brand,
  clienteNombre,
  initialBeforeIdx,
  initialAfterIdx,
  onClose,
}) {
  // Sort photos chronologically if they have dates, but keep given order as fallback
  // Typically photos are passed newest-first or oldest-first
  // Default: oldest photo as "Before", newest photo as "After"
  const defaultBefore = initialBeforeIdx ?? (photos.length > 1 ? photos.length - 1 : 0);
  const defaultAfter = initialAfterIdx ?? 0;

  const [beforeIdx, setBeforeIdx] = useState(defaultBefore);
  const [afterIdx, setAfterIdx] = useState(defaultAfter);
  const [mode, setMode] = useState("slider"); // "slider" | "split" | "fade"
  const [sliderPos, setSliderPos] = useState(50);
  const [fadeOpacity, setFadeOpacity] = useState(50);
  const [pickingSlot, setPickingSlot] = useState(null); // "before" | "after" | null
  const [exporting, setExporting] = useState(false);

  const containerRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Sync if external props change
  useEffect(() => {
    if (initialBeforeIdx !== undefined) setBeforeIdx(initialBeforeIdx);
  }, [initialBeforeIdx]);

  useEffect(() => {
    if (initialAfterIdx !== undefined) setAfterIdx(initialAfterIdx);
  }, [initialAfterIdx]);

  const safeBeforeIdx = Math.max(0, Math.min(beforeIdx, photos.length - 1));
  const safeAfterIdx = Math.max(0, Math.min(afterIdx, photos.length - 1));

  const beforeItem = photos[safeBeforeIdx] || photos[photos.length - 1] || {};
  const afterItem = photos[safeAfterIdx] || photos[0] || {};

  // Slider drag controls
  const handleMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = (x / rect.width) * 100;
    setSliderPos(Math.max(2, Math.min(98, pct)));
  };

  const onPointerDown = (e) => {
    isDraggingRef.current = true;
    handleMove(e.clientX ?? e.touches?.[0]?.clientX ?? 0);
  };

  const onPointerMove = (e) => {
    if (!isDraggingRef.current) return;
    handleMove(e.clientX ?? e.touches?.[0]?.clientX ?? 0);
  };

  const onPointerUp = () => {
    isDraggingRef.current = false;
  };

  // Preset handlers
  const handleSwap = () => {
    const temp = beforeIdx;
    setBeforeIdx(afterIdx);
    setAfterIdx(temp);
  };

  const handlePresetFirstVsLast = () => {
    setBeforeIdx(photos.length - 1);
    setAfterIdx(0);
  };

  const handlePresetRecent = () => {
    if (photos.length >= 2) {
      setBeforeIdx(1);
      setAfterIdx(0);
    }
  };

  const loadImage = (url) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = url;
    });

  const handleExportImage = async () => {
    if (!beforeItem?.url || !afterItem?.url) return;
    setExporting(true);
    try {
      const [imgBefore, imgAfter] = await Promise.all([
        loadImage(beforeItem.url),
        loadImage(afterItem.url),
      ]);

      const canvas = document.createElement("canvas");
      const W = 1080;
      const H = 1350; // 4:5 Instagram Portrait ratio
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");

      const primaryColor = brand?.color_primario || "#1A6FD4";
      const brandTitle = brand?.nombre_marca || brand?.nombre || "FLUX";

      // Background - elegant light cream/white with soft frame
      ctx.fillStyle = "#0B1929";
      ctx.fillRect(0, 0, W, H);

      // Top Header bar
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 38px 'DM Sans', sans-serif";
      ctx.fillText(brandTitle.toUpperCase(), 60, 85);

      ctx.fillStyle = "#94A3B8";
      ctx.font = "600 22px 'DM Sans', sans-serif";
      const subtitle = clienteNombre
        ? `EVOLUCIÓN FÍSICA • ${clienteNombre.toUpperCase()}`
        : "COMPARATIVA DE PROGRESO";
      ctx.fillText(subtitle, 60, 122);

      // Helper to draw rounded cover image
      const drawCover = (img, x, y, w, h, radius = 24) => {
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, w, h, radius);
        } else {
          ctx.rect(x, y, w, h);
        }
        ctx.clip();

        const imgRatio = img.width / img.height;
        const boxRatio = w / h;
        let drawW = w,
          drawH = h,
          offsetX = x,
          offsetY = y;
        if (imgRatio > boxRatio) {
          drawW = h * imgRatio;
          offsetX = x - (drawW - w) / 2;
        } else {
          drawH = w / imgRatio;
          offsetY = y - (drawH - h) / 2;
        }
        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        ctx.restore();
      };

      const cardW = 460;
      const cardH = 980;
      const topY = 160;

      // Draw Before and After images
      drawCover(imgBefore, 60, topY, cardW, cardH, 24);
      drawCover(imgAfter, 560, topY, cardW, cardH, 24);

      // Badges over photos
      const drawBadge = (x, y, title, sub, bg, titleColor = "#FFFFFF") => {
        ctx.save();
        ctx.fillStyle = bg;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, 240, sub ? 80 : 54, 16);
        } else {
          ctx.rect(x, y, 240, sub ? 80 : 54);
        }
        ctx.fill();

        ctx.fillStyle = titleColor;
        ctx.font = "bold 22px 'DM Sans', sans-serif";
        ctx.fillText(title, x + 20, y + 34);
        if (sub) {
          ctx.fillStyle = "#E2E8F0";
          ctx.font = "600 17px 'DM Sans', sans-serif";
          ctx.fillText(sub, x + 20, y + 62);
        }
        ctx.restore();
      };

      const beforeSub = [
        beforeItem.fecha ? fmtDate(beforeItem.fecha) : beforeItem.label,
        beforeItem.peso ? `${beforeItem.peso} kg` : null,
      ]
        .filter(Boolean)
        .join(" • ");

      const afterSub = [
        afterItem.fecha ? fmtDate(afterItem.fecha) : afterItem.label,
        afterItem.peso ? `${afterItem.peso} kg` : null,
      ]
        .filter(Boolean)
        .join(" • ");

      drawBadge(84, topY + 24, "ANTES", beforeSub, "rgba(11, 25, 41, 0.85)");
      drawBadge(584, topY + 24, "DESPUÉS", afterSub, primaryColor);

      // Footer
      ctx.fillStyle = "#64748B";
      ctx.font = "600 20px 'DM Sans', sans-serif";
      ctx.fillText("Generado con FLUX • Rendimiento y Nutrición", 60, 1280);

      if (beforeItem.peso && afterItem.peso) {
        const diff = (parseFloat(afterItem.peso) - parseFloat(beforeItem.peso)).toFixed(1);
        const diffText = parseFloat(diff) <= 0 ? `${diff} kg` : `+${diff} kg`;
        ctx.fillStyle = parseFloat(diff) <= 0 ? "#10B981" : "#3B82F6";
        ctx.font = "bold 20px 'DM Sans', sans-serif";
        ctx.fillText(`Diferencia neta: ${diffText}`, 740, 1280);
      }

      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `Comparativa_${(clienteNombre || "Progreso").replace(/\s+/g, "_")}.png`;
      a.click();
    } catch (err) {
      console.warn("No se pudo exportar canvas directamente:", err);
      window.open(afterItem.url, "_blank");
    }
    setExporting(false);
  };

  if (!photos || photos.length < 2) {
    return (
      <div className="bg-white rounded-3xl p-6 text-center border border-[#E2E8F0] shadow-sm my-6">
        <Sparkles className="w-8 h-8 text-[var(--brand-primary)] mx-auto mb-2 opacity-50" />
        <h4 className="text-sm font-bold text-[#0B1929]">Se requieren al menos 2 fotos</h4>
        <p className="text-xs text-[#6B7A8D] mt-1 max-w-sm mx-auto">
          Para realizar una comparativa visual de tu evolución física, necesitas al menos dos fotos registradas.
        </p>
      </div>
    );
  }

  const weightDiff =
    beforeItem?.peso && afterItem?.peso
      ? (parseFloat(afterItem.peso) - parseFloat(beforeItem.peso)).toFixed(1)
      : null;

  const fatDiff =
    beforeItem?.grasa_pct && afterItem?.grasa_pct
      ? (parseFloat(afterItem.grasa_pct) - parseFloat(beforeItem.grasa_pct)).toFixed(1)
      : null;

  const timeDiff = getDaysDiff(beforeItem?.fecha, afterItem?.fecha);

  return (
    <div className="bg-white rounded-3xl p-5 md:p-7 shadow-sm border border-[#E2E8F0] my-6 transition-all">
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
              <Sparkles size={17} />
            </div>
            <h3 className="text-base md:text-lg font-bold text-[#0B1929]">
              Comparador de Evolución Física
            </h3>
          </div>
          <p className="text-xs text-[#6B7A8D] mt-1">
            Compara cualquier par de fotos de tu proceso: desliza la cortina, visualízalas lado a lado o desvanece la opacidad
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Comparison Mode Selector */}
          <div className="bg-[#F0F4FA] p-1 rounded-xl inline-flex gap-1">
            <button
              onClick={() => setMode("slider")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === "slider"
                  ? "bg-white text-[var(--brand-primary)] shadow-sm"
                  : "text-[#6B7A8D] hover:text-[#0B1929]"
              }`}
              title="Cortina deslizable"
            >
              <SlidersHorizontal size={13} />
              <span>Cortina</span>
            </button>
            <button
              onClick={() => setMode("split")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === "split"
                  ? "bg-white text-[var(--brand-primary)] shadow-sm"
                  : "text-[#6B7A8D] hover:text-[#0B1929]"
              }`}
              title="Lado a lado"
            >
              <Columns size={13} />
              <span>Lado a Lado</span>
            </button>
            <button
              onClick={() => setMode("fade")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === "fade"
                  ? "bg-white text-[var(--brand-primary)] shadow-sm"
                  : "text-[#6B7A8D] hover:text-[#0B1929]"
              }`}
              title="Superposición con transparencia"
            >
              <Layers size={13} />
              <span>Desvanecer</span>
            </button>
          </div>

          {/* Export PNG */}
          <button
            onClick={handleExportImage}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0B1929] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 shrink-0 shadow-sm"
          >
            <Download size={14} />
            <span className="hidden sm:inline">
              {exporting ? "Generando..." : "Descargar"}
            </span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-[#6B7A8D] hover:text-[#0B1929] rounded-xl hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* ── PHOTO SELECTION CONTROLLER SLOTS ── */}
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3.5 mb-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* SLOT ANTES */}
          <div
            onClick={() => setPickingSlot("before")}
            className="w-full md:flex-1 bg-white border border-[#E2E8F0] rounded-xl p-2.5 flex items-center justify-between gap-3 cursor-pointer hover:border-[var(--brand-primary)]/50 hover:shadow-xs transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-gray-100 border border-[#E2E8F0] relative">
                <img
                  src={beforeItem.url}
                  alt="Antes"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <span className="absolute bottom-0 inset-x-0 bg-[#0B1929]/80 text-[8px] font-bold text-white text-center py-0.5">
                  ANTES
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">
                  Foto Inicial
                </span>
                <p className="text-xs md:text-sm font-bold text-[#0B1929] truncate">
                  {beforeItem.fecha ? fmtDate(beforeItem.fecha) : beforeItem.label || "Sin fecha"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#6B7A8D]">
                  {beforeItem.peso && <span>{beforeItem.peso} kg</span>}
                  {beforeItem.grasa_pct && <span>• {beforeItem.grasa_pct}% grasa</span>}
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-2.5 py-1 rounded-lg shrink-0 group-hover:bg-[var(--brand-primary)] group-hover:text-white transition-colors">
              Cambiar
            </span>
          </div>

          {/* SWAP BUTTON */}
          <button
            onClick={handleSwap}
            title="Invertir Fotos"
            className="w-9 h-9 rounded-full bg-white border border-[#E2E8F0] shadow-sm flex items-center justify-center text-[#6B7A8D] hover:text-[var(--brand-primary)] hover:border-[var(--brand-primary)] transition-all cursor-pointer shrink-0"
          >
            <ArrowLeftRight size={15} />
          </button>

          {/* SLOT DESPUÉS */}
          <div
            onClick={() => setPickingSlot("after")}
            className="w-full md:flex-1 bg-white border border-[#E2E8F0] rounded-xl p-2.5 flex items-center justify-between gap-3 cursor-pointer hover:border-[var(--brand-primary)]/50 hover:shadow-xs transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-gray-100 border border-[#E2E8F0] relative">
                <img
                  src={afterItem.url}
                  alt="Después"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <span className="absolute bottom-0 inset-x-0 bg-[var(--brand-primary)] text-[8px] font-bold text-white text-center py-0.5">
                  DESPUÉS
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-primary)] font-bold block">
                  Foto Comparativa
                </span>
                <p className="text-xs md:text-sm font-bold text-[#0B1929] truncate">
                  {afterItem.fecha ? fmtDate(afterItem.fecha) : afterItem.label || "Sin fecha"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#6B7A8D]">
                  {afterItem.peso && <span>{afterItem.peso} kg</span>}
                  {afterItem.grasa_pct && <span>• {afterItem.grasa_pct}% grasa</span>}
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-2.5 py-1 rounded-lg shrink-0 group-hover:bg-[var(--brand-primary)] group-hover:text-white transition-colors">
              Cambiar
            </span>
          </div>
        </div>

        {/* Quick Presets row */}
        <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[#E2E8F0]/80">
          <span className="text-[11px] font-semibold text-[#6B7A8D]">Atajos rápidos:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={handlePresetFirstVsLast}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border border-[#E2E8F0] text-[#0B1929] hover:bg-gray-50 transition-colors cursor-pointer"
            >
              ⭐ Inicio vs. Actual
            </button>
            {photos.length > 2 && (
              <button
                onClick={handlePresetRecent}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border border-[#E2E8F0] text-[#0B1929] hover:bg-gray-50 transition-colors cursor-pointer"
              >
                📅 Último Mes
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── METRICS COMPARISON BADGES ── */}
      {(weightDiff !== null || fatDiff !== null || timeDiff) && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {timeDiff && (
            <span className="inline-flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1 rounded-full text-xs font-bold text-[#0B1929]">
              <Clock size={12} className="text-[#6B7A8D]" />
              {timeDiff}
            </span>
          )}
          {weightDiff !== null && (
            <span className="inline-flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1 rounded-full text-xs font-bold text-[#0B1929]">
              <Scale size={12} className="text-[#6B7A8D]" />
              Diferencia Peso:{" "}
              <span
                className={
                  parseFloat(weightDiff) <= 0 ? "text-emerald-600 font-black" : "text-blue-600 font-black"
                }
              >
                {parseFloat(weightDiff) > 0 ? `+${weightDiff}` : weightDiff} kg
              </span>
            </span>
          )}
          {fatDiff !== null && (
            <span className="inline-flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1 rounded-full text-xs font-bold text-[#0B1929]">
              Diferencia Grasa:{" "}
              <span
                className={
                  parseFloat(fatDiff) <= 0 ? "text-emerald-600 font-black" : "text-amber-600 font-black"
                }
              >
                {parseFloat(fatDiff) > 0 ? `+${fatDiff}` : fatDiff}%
              </span>
            </span>
          )}
        </div>
      )}

      {/* ── MAIN COMPARISON VIEWPORT ── */}
      {mode === "slider" && (
        <div
          ref={containerRef}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
          className="relative w-full max-w-xl mx-auto aspect-[4/5] rounded-3xl overflow-hidden select-none cursor-ew-resize border border-[#E2E8F0] bg-[#0B1929] shadow-lg touch-none"
        >
          {/* AFTER Image (Full Base Layer) */}
          <img
            src={afterItem.url}
            alt="Después"
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />

          {/* BEFORE Image (Clipped Left Layer) */}
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
          >
            <img
              src={beforeItem.url}
              alt="Antes"
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>

          {/* Floating Badges */}
          <div className="absolute top-4 left-4 z-10 bg-[#0B1929]/80 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/15 pointer-events-none shadow-md">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">ANTES</p>
            <p className="text-xs font-bold">
              {beforeItem.fecha ? fmtDate(beforeItem.fecha) : beforeItem.label}
              {beforeItem.peso ? ` • ${beforeItem.peso} kg` : ""}
            </p>
          </div>

          <div className="absolute top-4 right-4 z-10 bg-[var(--brand-primary)]/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/20 pointer-events-none text-right shadow-md">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">DESPUÉS</p>
            <p className="text-xs font-bold">
              {afterItem.fecha ? fmtDate(afterItem.fecha) : afterItem.label}
              {afterItem.peso ? ` • ${afterItem.peso} kg` : ""}
            </p>
          </div>

          {/* Divider Line & Interactive Handle */}
          <div
            className="absolute top-0 bottom-0 z-20 w-0.5 bg-white shadow-[0_0_14px_rgba(0,0,0,0.7)] pointer-events-none"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white text-[#0B1929] shadow-2xl border-2 border-[var(--brand-primary)] flex items-center justify-center transition-transform hover:scale-110">
              <MoveHorizontal size={18} className="text-[var(--brand-primary)]" />
            </div>
          </div>
        </div>
      )}

      {mode === "split" && (
        <div className="grid grid-cols-2 gap-3 md:gap-5 max-w-3xl mx-auto">
          {/* Card Antes */}
          <div className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-[#E2E8F0] bg-[#0B1929] shadow-md group">
            <img src={beforeItem.url} alt="Antes" className="w-full h-full object-cover" />
            <div className="absolute top-3 left-3 bg-[#0B1929]/80 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/15">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">ANTES</p>
              <p className="text-xs font-bold">
                {beforeItem.fecha ? fmtDate(beforeItem.fecha) : beforeItem.label}
                {beforeItem.peso ? ` • ${beforeItem.peso} kg` : ""}
              </p>
            </div>
          </div>

          {/* Card Después */}
          <div className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-[#E2E8F0] bg-[#0B1929] shadow-md group">
            <img src={afterItem.url} alt="Después" className="w-full h-full object-cover" />
            <div className="absolute top-3 right-3 bg-[var(--brand-primary)]/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/20 text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">DESPUÉS</p>
              <p className="text-xs font-bold">
                {afterItem.fecha ? fmtDate(afterItem.fecha) : afterItem.label}
                {afterItem.peso ? ` • ${afterItem.peso} kg` : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {mode === "fade" && (
        <div className="max-w-xl mx-auto">
          <div className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-[#E2E8F0] bg-[#0B1929] shadow-lg">
            {/* Base: BEFORE */}
            <img
              src={beforeItem.url}
              alt="Antes"
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Overlay: AFTER with dynamic opacity */}
            <img
              src={afterItem.url}
              alt="Después"
              style={{ opacity: fadeOpacity / 100 }}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-75"
            />

            {/* Badges */}
            <div className="absolute top-4 left-4 z-10 bg-[#0B1929]/80 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/15">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">ANTES</p>
              <p className="text-xs font-bold">
                {beforeItem.fecha ? fmtDate(beforeItem.fecha) : beforeItem.label}
              </p>
            </div>

            <div className="absolute top-4 right-4 z-10 bg-[var(--brand-primary)]/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/20 text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">DESPUÉS</p>
              <p className="text-xs font-bold">
                {afterItem.fecha ? fmtDate(afterItem.fecha) : afterItem.label}
              </p>
            </div>
          </div>

          {/* Opacity slider bar */}
          <div className="mt-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs font-bold mb-2">
              <span className="text-[#0B1929]">Antes (0%)</span>
              <span className="text-[var(--brand-primary)]">Transparencia: {fadeOpacity}%</span>
              <span className="text-[#0B1929]">Después (100%)</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={fadeOpacity}
              onChange={(e) => setFadeOpacity(Number(e.target.value))}
              className="w-full accent-[var(--brand-primary)] cursor-pointer"
            />
            <p className="text-[11px] text-[#6B7A8D] text-center mt-2">
              Desliza para ver la transformación corporal superpuesta en el mismo ángulo
            </p>
          </div>
        </div>
      )}

      {/* ── PHOTO PICKER MODAL (DRAWER) ── */}
      {pickingSlot && (
        <div
          className="fixed inset-0 z-[120] bg-[#0B1929]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setPickingSlot(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-[#E2E8F0] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#F0F4FA] flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-[#0B1929]">
                  Seleccionar Foto {pickingSlot === "before" ? '"Antes"' : '"Después"'}
                </h4>
                <p className="text-xs text-[#6B7A8D] mt-0.5">
                  Toca una foto para asignarla a la ranura de comparación
                </p>
              </div>
              <button
                onClick={() => setPickingSlot(null)}
                className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#0B1929] flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Photos Grid */}
            <div className="p-6 overflow-y-auto max-h-[60vh] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((p, idx) => {
                const isSelected =
                  pickingSlot === "before" ? idx === safeBeforeIdx : idx === safeAfterIdx;
                const isOpposite =
                  pickingSlot === "before" ? idx === safeAfterIdx : idx === safeBeforeIdx;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (pickingSlot === "before") {
                        setBeforeIdx(idx);
                      } else {
                        setAfterIdx(idx);
                      }
                      setPickingSlot(null);
                    }}
                    className={`relative aspect-[4/5] rounded-2xl overflow-hidden cursor-pointer border-2 transition-all group ${
                      isSelected
                        ? "border-[var(--brand-primary)] ring-4 ring-[var(--brand-primary)]/15 scale-[1.02]"
                        : "border-[#E2E8F0] hover:border-gray-400"
                    }`}
                  >
                    <img
                      src={p.url}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2 text-white">
                      <p className="text-xs font-bold truncate">
                        {p.fecha ? fmtDate(p.fecha) : p.label}
                      </p>
                      {p.peso && (
                        <p className="text-[10px] text-slate-300 font-semibold">{p.peso} kg</p>
                      )}
                    </div>

                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center shadow-md">
                        <Check size={14} />
                      </div>
                    )}

                    {isOpposite && (
                      <span className="absolute top-2 left-2 bg-[#0B1929]/80 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-md">
                        {pickingSlot === "before" ? "En 'Después'" : "En 'Antes'"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-[#F8FAFC] border-t border-[#F0F4FA] flex justify-end">
              <button
                onClick={() => setPickingSlot(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#6B7A8D] hover:text-[#0B1929] bg-white border border-[#E2E8F0]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
