import React, { useState, useRef, useMemo } from "react";
import {
  Columns,
  SlidersHorizontal,
  Download,
  Calendar,
  Sparkles,
  MoveHorizontal,
  Check,
} from "lucide-react";

const fmtDate = (d) => {
  if (!d) return "";
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export function BeforeAfterComparator({
  photos = [], // Array of { url, fecha, label, peso, grasa_pct }
  brand,
  clienteNombre,
}) {
  // Default: oldest photo as "Before", newest photo as "After"
  const [beforeIdx, setBeforeIdx] = useState(photos.length > 1 ? photos.length - 1 : 0);
  const [afterIdx, setAfterIdx] = useState(0);
  const [mode, setMode] = useState("slider"); // "slider" | "split"
  const [sliderPos, setSliderPos] = useState(50);
  const [activeSelector, setActiveSelector] = useState("before"); // "before" | "after"
  const [exporting, setExporting] = useState(false);

  const containerRef = useRef(null);
  const isDraggingRef = useRef(false);

  const safeBeforeIdx = Math.min(beforeIdx, Math.max(0, photos.length - 1));
  const safeAfterIdx = Math.min(afterIdx, Math.max(0, photos.length - 1));

  const beforeItem = photos[safeBeforeIdx] || photos[photos.length - 1];
  const afterItem = photos[safeAfterIdx] || photos[0];

  const handleMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = (x / rect.width) * 100;
    setSliderPos(Math.max(4, Math.min(96, pct)));
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

  const loadImage = (url) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = url;
    });

  const handleExportImage = async () => {
    if (!beforeItem || !afterItem) return;
    setExporting(true);
    try {
      const [imgBefore, imgAfter] = await Promise.all([
        loadImage(beforeItem.url),
        loadImage(afterItem.url),
      ]);

      const canvas = document.createElement("canvas");
      const W = 1080;
      const H = 1200;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");

      const primaryColor = brand?.color_primario || "#1A6FD4";
      const brandTitle = brand?.nombre_marca || brand?.nombre || "FLUX";

      // Background
      ctx.fillStyle = "#0B1929";
      ctx.fillRect(0, 0, W, H);

      // Top Header
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 36px sans-serif";
      ctx.fillText(brandTitle.toUpperCase(), 50, 72);

      ctx.fillStyle = "#94A3B8";
      ctx.font = "600 22px sans-serif";
      ctx.fillText(
        clienteNombre ? `EVOLUCIÓN FÍSICA • ${clienteNombre.toUpperCase()}` : "COMPARATIVA DE PROGRESO",
        50,
        108
      );

      // Helper to draw object-cover image into rect
      const drawCover = (img, x, y, w, h, radius = 24) => {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, radius);
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

      const cardW = 475;
      const cardH = 920;
      const topY = 145;

      drawCover(imgBefore, 50, topY, cardW, cardH, 28);
      drawCover(imgAfter, 555, topY, cardW, cardH, 28);

      // Badges on images
      const drawBadge = (x, y, title, sub, bg) => {
        ctx.save();
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.roundRect(x, y, 220, sub ? 78 : 52, 16);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText(title, x + 20, y + 33);
        if (sub) {
          ctx.fillStyle = "#E2E8F0";
          ctx.font = "600 18px sans-serif";
          ctx.fillText(sub, x + 20, y + 60);
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

      drawBadge(74, topY + 24, "ANTES", beforeSub, "rgba(11, 25, 41, 0.82)");
      drawBadge(579, topY + 24, "DESPUÉS", afterSub, primaryColor);

      // Footer
      ctx.fillStyle = "#64748B";
      ctx.font = "600 20px sans-serif";
      ctx.fillText("Generado con FLUX Performance & Nutrition", 50, 1135);

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

  if (!photos || photos.length < 2) return null;

  const weightDiff =
    beforeItem?.peso && afterItem?.peso
      ? (parseFloat(afterItem.peso) - parseFloat(beforeItem.peso)).toFixed(1)
      : null;

  const fatDiff =
    beforeItem?.grasa_pct && afterItem?.grasa_pct
      ? (parseFloat(afterItem.grasa_pct) - parseFloat(beforeItem.grasa_pct)).toFixed(1)
      : null;

  return (
    <div className="bg-white rounded-3xl p-5 md:p-7 shadow-sm border border-[#E2E8F0] my-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center">
              <Sparkles size={17} />
            </div>
            <h3 className="text-base md:text-lg font-bold text-[#0B1929]">
              Comparador Antes vs. Después
            </h3>
          </div>
          <p className="text-xs text-[#6B7A8D] mt-0.5">
            Desliza la cortina central o selecciona cualquier par de fotos para comparar tu cambio físico
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="bg-[#F0F4FA] p-1 rounded-xl inline-flex gap-1">
            <button
              onClick={() => setMode("slider")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === "slider"
                  ? "bg-white text-[var(--brand-primary)] shadow-sm"
                  : "text-[#6B7A8D] hover:text-[#0B1929]"
              }`}
            >
              <SlidersHorizontal size={13} /> Cortina
            </button>
            <button
              onClick={() => setMode("split")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === "split"
                  ? "bg-white text-[var(--brand-primary)] shadow-sm"
                  : "text-[#6B7A8D] hover:text-[#0B1929]"
              }`}
            >
              <Columns size={13} /> Lado a Lado
            </button>
          </div>

          <button
            onClick={handleExportImage}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0B1929] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
          >
            <Download size={14} />
            <span className="hidden sm:inline">
              {exporting ? "Generando..." : "Descargar Comparativa"}
            </span>
          </button>
        </div>
      </div>

      {/* Delta badges if metrics exist on the selected photos */}
      {(weightDiff !== null || fatDiff !== null) && (
        <div className="flex flex-wrap gap-2 mb-5">
          {weightDiff !== null && (
            <span className="inline-flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1 rounded-full text-xs font-bold text-[#0B1929]">
              Diferencia Peso:{" "}
              <span className={parseFloat(weightDiff) <= 0 ? "text-emerald-600" : "text-blue-600"}>
                {parseFloat(weightDiff) > 0 ? `+${weightDiff}` : weightDiff} kg
              </span>
            </span>
          )}
          {fatDiff !== null && (
            <span className="inline-flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1 rounded-full text-xs font-bold text-[#0B1929]">
              Diferencia % Grasa:{" "}
              <span className={parseFloat(fatDiff) <= 0 ? "text-emerald-600" : "text-amber-600"}>
                {parseFloat(fatDiff) > 0 ? `+${fatDiff}` : fatDiff}%
              </span>
            </span>
          )}
        </div>
      )}

      {/* Main Comparison Viewport */}
      {mode === "slider" ? (
        <div
          ref={containerRef}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
          className="relative w-full max-w-xl mx-auto aspect-[4/5] sm:aspect-[4/4] rounded-2xl overflow-hidden select-none cursor-ew-resize border border-[#E2E8F0] bg-[#0B1929] shadow-inner touch-none"
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

          {/* Floating Labels */}
          <div className="absolute top-3 left-3 z-10 bg-[#0B1929]/80 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/15 pointer-events-none">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">ANTES</p>
            <p className="text-xs font-bold">
              {beforeItem.fecha ? fmtDate(beforeItem.fecha) : beforeItem.label}
              {beforeItem.peso ? ` • ${beforeItem.peso} kg` : ""}
            </p>
          </div>

          <div className="absolute top-3 right-3 z-10 bg-[var(--brand-primary)]/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/20 pointer-events-none text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">DESPUÉS</p>
            <p className="text-xs font-bold">
              {afterItem.fecha ? fmtDate(afterItem.fecha) : afterItem.label}
              {afterItem.peso ? ` • ${afterItem.peso} kg` : ""}
            </p>
          </div>

          {/* Curtain Divider Line & Handle */}
          <div
            className="absolute top-0 bottom-0 z-20 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,0.6)] pointer-events-none"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white text-[#0B1929] shadow-xl border-2 border-[var(--brand-primary)] flex items-center justify-center">
              <MoveHorizontal size={18} />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:gap-5 max-w-3xl mx-auto">
          <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-[#E2E8F0] bg-[#0B1929]">
            <img src={beforeItem.url} alt="Antes" className="w-full h-full object-cover" />
            <div className="absolute top-3 left-3 bg-[#0B1929]/80 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/15">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">ANTES</p>
              <p className="text-xs font-bold">
                {beforeItem.fecha ? fmtDate(beforeItem.fecha) : beforeItem.label}
                {beforeItem.peso ? ` • ${beforeItem.peso} kg` : ""}
              </p>
            </div>
          </div>
          <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-[#E2E8F0] bg-[#0B1929]">
            <img src={afterItem.url} alt="Después" className="w-full h-full object-cover" />
            <div className="absolute top-3 right-3 bg-[var(--brand-primary)]/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/20 text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                DESPUÉS
              </p>
              <p className="text-xs font-bold">
                {afterItem.fecha ? fmtDate(afterItem.fecha) : afterItem.label}
                {afterItem.peso ? ` • ${afterItem.peso} kg` : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Photo Selector Strip */}
      <div className="mt-6 pt-5 border-t border-[#E2E8F0]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <p className="text-xs font-bold text-[#6B7A8D] uppercase tracking-wider">
            Selecciona qué fotos comparar:
          </p>
          <div className="inline-flex bg-[#F0F4FA] p-1 rounded-xl gap-1 self-start">
            <button
              onClick={() => setActiveSelector("before")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeSelector === "before"
                  ? "bg-[#0B1929] text-white"
                  : "text-[#6B7A8D] hover:text-[#0B1929]"
              }`}
            >
              Elegir Foto "Antes"
            </button>
            <button
              onClick={() => setActiveSelector("after")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeSelector === "after"
                  ? "bg-[var(--brand-primary)] text-white"
                  : "text-[#6B7A8D] hover:text-[#0B1929]"
              }`}
            >
              Elegir Foto "Después"
            </button>
          </div>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-2 scroll-hide">
          {photos.map((p, idx) => {
            const isBefore = idx === safeBeforeIdx;
            const isAfter = idx === safeAfterIdx;
            return (
              <button
                key={idx}
                onClick={() => {
                  if (activeSelector === "before") setBeforeIdx(idx);
                  else setAfterIdx(idx);
                }}
                className={`relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                  isBefore
                    ? "border-[#0B1929] ring-2 ring-[#0B1929]/20"
                    : isAfter
                    ? "border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20"
                    : "border-[#E2E8F0] opacity-75 hover:opacity-100"
                }`}
              >
                <img src={p.url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-black/65 text-white text-[9px] font-bold py-0.5 px-1 truncate">
                  {p.fecha ? fmtDate(p.fecha) : p.label}
                </div>
                {isBefore && (
                  <span className="absolute top-1 left-1 bg-[#0B1929] text-white text-[8px] font-bold px-1.5 py-0.5 rounded">
                    ANTES
                  </span>
                )}
                {isAfter && (
                  <span className="absolute top-1 right-1 bg-[var(--brand-primary)] text-white text-[8px] font-bold px-1.5 py-0.5 rounded">
                    DESP
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
