import { escapeHtml, parseFotos } from "./helpers";
import { registerBackAction } from "../lib/backButtonHandler";
import { parseDiaMetadata } from "../lib/mealOptions";
import {
  enrichMetrica,
  getMetodoLabel,
  getGoalPresetInfo,
  getActivityFactorInfo,
  classifyIMC,
  classifyICC,
  normalizeSexo,
  calcEdadFromBirthdate,
} from "../lib/bodyComposition";

// Darkens a hex color by reducing RGB values
const darken = (hex, amt = 60) => {
  const n = parseInt((hex || "#2D9CDB").replace("#", ""), 16);
  const r = Math.max(0, (n >> 16) - amt);
  const g = Math.max(0, ((n >> 8) & 0xff) - amt);
  const b = Math.max(0, (n & 0xff) - amt);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

// Creates a very light tint (mix with white) for backgrounds
const tint = (hex, amt = 230) => {
  const n = parseInt((hex || "#2D9CDB").replace("#", ""), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

/** Escapa una URL para uso seguro en atributos src */
const safeUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("/")) {
    return typeof window !== "undefined" && window.location?.origin
      ? `${window.location.origin}${url}`
      : url;
  }
  if (!/^https?:\/\//i.test(url) && !url.startsWith("data:")) return "";
  return escapeHtml(url);
};

const FLUX_PAGINATION_SCRIPT = `
<script>
(function() {
  function paginateDocument() {
    var PAGE_HEIGHT = 1131; // Relación A4 exacta a 800px de ancho (800 * 297 / 210 = 1131.4)
    var MARGIN_TOP = 48;    // Margen superior limpio para páginas >= 1
    var MARGIN_BOTTOM = 56; // Margen inferior limpio para todas las páginas
    var USABLE_HEIGHT = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM; // 1027px

    // Limpiar espaciadores previos si se re-ejecuta
    var oldSpacers = document.querySelectorAll('.flux-page-spacer');
    for (var i = 0; i < oldSpacers.length; i++) {
      oldSpacers[i].remove();
    }

    function createSpacer(height) {
      var sp = document.createElement('div');
      sp.className = 'flux-page-spacer';
      sp.style.cssText = 'height:' + Math.max(1, Math.round(height)) + 'px;width:100%;display:block;margin:0;padding:0;border:none;background:transparent;clear:both;';
      return sp;
    }

    function getElementBounds(el) {
      var rect = el.getBoundingClientRect();
      var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      var top = rect.top + scrollY;
      var height = rect.height || el.offsetHeight || 0;
      return { top: top, height: height, bottom: top + height };
    }

    function splitTableAtRow(table, splitRow, spacerHeight) {
      var newTable = table.cloneNode(false);
      var thead = table.querySelector('thead');
      if (thead) {
        newTable.appendChild(thead.cloneNode(true));
      }
      var tbody = document.createElement('tbody');
      newTable.appendChild(tbody);

      var curr = splitRow;
      var rowsToMove = [];
      while (curr) {
        rowsToMove.push(curr);
        curr = curr.nextElementSibling;
      }
      for (var r = 0; r < rowsToMove.length; r++) {
        tbody.appendChild(rowsToMove[r]);
      }

      var spacer = createSpacer(spacerHeight);
      if (table.nextSibling) {
        table.parentNode.insertBefore(spacer, table.nextSibling);
        table.parentNode.insertBefore(newTable, spacer.nextSibling);
      } else {
        table.parentNode.appendChild(spacer);
        table.parentNode.appendChild(newTable);
      }
      return newTable;
    }

    var sections = Array.from(document.body.children);

    for (var s = 0; s < sections.length; s++) {
      var sec = sections[s];
      if (sec.classList.contains('flux-page-spacer')) continue;
      if (sec.tagName === 'SCRIPT' || sec.tagName === 'STYLE') continue;

      var b = getElementBounds(sec);
      if (b.height <= 0) continue;

      var page = Math.floor(b.top / PAGE_HEIGHT);
      var safeBottom = (page + 1) * PAGE_HEIGHT - MARGIN_BOTTOM;

      var isHeader = sec.classList.contains('title-sec') || sec.classList.contains('dia-title');
      if (isHeader) {
        var nextSec = sec.nextElementSibling;
        while (nextSec && (nextSec.classList.contains('flux-page-spacer') || nextSec.tagName === 'SCRIPT')) {
          nextSec = nextSec.nextElementSibling;
        }
        if (b.bottom > safeBottom || (b.bottom + 80) > safeBottom) {
          var targetTop = (page + 1) * PAGE_HEIGHT + MARGIN_TOP;
          var spHeight = targetTop - b.top;
          if (spHeight > 0) {
            sec.parentNode.insertBefore(createSpacer(spHeight), sec);
            b = getElementBounds(sec);
            page = Math.floor(b.top / PAGE_HEIGHT);
            safeBottom = (page + 1) * PAGE_HEIGHT - MARGIN_BOTTOM;
          }
        }
        continue;
      }

      if (b.bottom <= safeBottom) {
        continue;
      }

      // Si sobrepasa el límite seguro
      if (b.height <= USABLE_HEIGHT) {
        var targetTop = (page + 1) * PAGE_HEIGHT + MARGIN_TOP;
        var spHeight = targetTop - b.top;
        if (spHeight > 0) {
          sec.parentNode.insertBefore(createSpacer(spHeight), sec);
        }
      } else {
        var targetTable = sec.tagName === 'TABLE' ? sec : sec.querySelector('table');
        if (targetTable) {
          var rows = Array.from(targetTable.querySelectorAll('tbody tr'));
          if (rows.length === 0) {
            rows = Array.from(targetTable.querySelectorAll('tr')).filter(function(r) { return !r.closest('thead'); });
          }

          for (var rIdx = 0; rIdx < rows.length; rIdx++) {
            var row = rows[rIdx];
            var rb = getElementBounds(row);
            var rPage = Math.floor(rb.top / PAGE_HEIGHT);
            var rSafeBottom = (rPage + 1) * PAGE_HEIGHT - MARGIN_BOTTOM;

            if (rb.bottom > rSafeBottom) {
              var rTargetTop = (rPage + 1) * PAGE_HEIGHT + MARGIN_TOP;
              var rowSpHeight = rTargetTop - rb.top;
              if (rowSpHeight > 0) {
                var newT = splitTableAtRow(targetTable, row, rowSpHeight);
                targetTable = newT;
                rows = Array.from(targetTable.querySelectorAll('tbody tr'));
                rIdx = -1;
              }
            }
          }
        } else {
          var targetTop = (page + 1) * PAGE_HEIGHT + MARGIN_TOP;
          var spHeight = targetTop - b.top;
          if (spHeight > 0) {
            sec.parentNode.insertBefore(createSpacer(spHeight), sec);
          }
        }
      }
    }

    var maxB = 0;
    var all = document.body.querySelectorAll('*');
    for (var k = 0; k < all.length; k++) {
      var item = all[k];
      if (item.classList.contains('flux-page-spacer')) continue;
      var ib = getElementBounds(item);
      if (ib.bottom > maxB) maxB = ib.bottom;
    }

    var totalPages = Math.max(1, Math.ceil((maxB + 20) / PAGE_HEIGHT));
    var exactHeight = totalPages * PAGE_HEIGHT;
    document.body.style.minHeight = exactHeight + 'px';
    document.body.style.height = exactHeight + 'px';
    document.body.style.boxSizing = 'border-box';
    document.body.setAttribute('data-flux-pages', totalPages);
  }

  function init() {
    var imgs = Array.from(document.images);
    if (imgs.length === 0) {
      paginateDocument();
      return;
    }
    var pending = imgs.length;
    function imgDone() {
      pending--;
      if (pending <= 0) {
        paginateDocument();
      }
    }
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].complete) {
        pending--;
      } else {
        imgs[i].addEventListener('load', imgDone);
        imgs[i].addEventListener('error', imgDone);
      }
    }
    if (pending <= 0) {
      paginateDocument();
    } else {
      setTimeout(paginateDocument, 400);
    }
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
    document.addEventListener('DOMContentLoaded', init);
  }
})();
</script>
`;

/**
 * Abre un visor interactivo de Vista Previa de PDF dentro de la app
 * con soporte para:
 * - Botón Atrás físico de Android y botón "Volver" en pantalla
 * - Ajuste automático al ancho de pantalla móvil + botón de Zoom (Ajustar / 100%)
 * - Botón "Compartir" nativo (WhatsApp, Telegram, Gmail, Drive, etc.) generando archivo .pdf real
 * - Botón "Guardar / Imprimir" nativo en Android (PrintManager) e impresión directa en PWA/Web
 */
const openPdfPreviewModal = ({ html, title, fileName, accent = "#1A6FD4" }) => {
  if (typeof document === "undefined") return;

  const existing = document.getElementById("flux-pdf-preview-modal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "flux-pdf-preview-modal";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 99990;
    background: #E2E8F0;
    display: flex;
    flex-direction: column;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    color: #0B1929;
    user-select: none;
  `;

  // Top Header Bar
  const topBar = document.createElement("div");
  topBar.style.cssText = `
    background: #FFFFFF;
    border-bottom: 1px solid #E2E8F0;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    box-shadow: 0 2px 8px rgba(11, 25, 41, 0.05);
    flex-shrink: 0;
    z-index: 10;
  `;

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #F0F4FA;
    color: #0B1929;
    border: 1px solid #E2E8F0;
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    flex-shrink: 0;
  `;
  backBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m15 18-6-6 6-6"/>
    </svg>
    <span>Volver</span>
  `;

  const titleEl = document.createElement("div");
  titleEl.style.cssText = `
    font-size: 13px;
    font-weight: 700;
    color: #0B1929;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
    text-align: center;
  `;
  titleEl.textContent = title || "Vista previa de PDF";

  const actionsWrap = document.createElement("div");
  actionsWrap.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  `;

  // Share button
  const shareBtn = document.createElement("button");
  shareBtn.type = "button";
  shareBtn.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #FFFFFF;
    color: #0B1929;
    border: 1px solid #CBD5E1;
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  `;
  const shareDefaultHtml = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
    <span>Compartir</span>
  `;
  shareBtn.innerHTML = shareDefaultHtml;

  // Save / Print button
  const printBtn = document.createElement("button");
  printBtn.type = "button";
  printBtn.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: ${accent};
    color: #FFFFFF;
    border: none;
    border-radius: 10px;
    padding: 8px 13px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  `;
  printBtn.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    <span>Guardar PDF</span>
  `;

  actionsWrap.appendChild(shareBtn);
  actionsWrap.appendChild(printBtn);

  topBar.appendChild(backBtn);
  topBar.appendChild(titleEl);
  topBar.appendChild(actionsWrap);

  // Scrollable Viewport
  const scrollArea = document.createElement("div");
  scrollArea.style.cssText = `
    flex: 1;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    padding: 14px 12px 76px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
  `;

  // Scale Wrapper so 800px document fits mobile screens cleanly without broken zoom
  const DOC_WIDTH = 800;
  let docHeight = 1131;
  let zoomMode = "fit"; // "fit" | "full"

  const scaleHolder = document.createElement("div");
  scaleHolder.style.cssText = `
    position: relative;
    transition: width 0.18s ease, height 0.18s ease;
    margin: 0 auto;
  `;

  const paperCard = document.createElement("div");
  paperCard.style.cssText = `
    width: ${DOC_WIDTH}px;
    background: #FFFFFF;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(11, 25, 41, 0.12);
    overflow: hidden;
    transform-origin: top left;
    transition: transform 0.18s ease;
  `;

  const iframe = document.createElement("iframe");
  iframe.style.cssText = `
    width: ${DOC_WIDTH}px;
    height: ${docHeight}px;
    border: none;
    display: block;
    background: #FFFFFF;
  `;
  iframe.setAttribute("sandbox", "allow-same-origin allow-modals");
  iframe.srcdoc = html;

  paperCard.appendChild(iframe);
  scaleHolder.appendChild(paperCard);
  scrollArea.appendChild(scaleHolder);

  // Floating Zoom Pill at Bottom
  const zoomPill = document.createElement("button");
  zoomPill.type = "button";
  zoomPill.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
    background: rgba(11, 25, 41, 0.88);
    color: #FFFFFF;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
    backdrop-filter: blur(8px);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  `;

  const updateZoomLabel = () => {
    zoomPill.innerHTML =
      zoomMode === "fit"
        ? `<span>🔍 Ver tamaño 100%</span>`
        : `<span>📐 Ajustar a pantalla</span>`;
  };
  updateZoomLabel();

  const applyScale = () => {
    const availW = Math.max(280, (scrollArea.clientWidth || window.innerWidth) - 24);
    const fitScale = Math.min(1, availW / DOC_WIDTH);
    const scale = zoomMode === "fit" ? fitScale : 1;

    paperCard.style.transform = `scale(${scale})`;
    scaleHolder.style.width = `${Math.round(DOC_WIDTH * scale)}px`;
    scaleHolder.style.height = `${Math.round(docHeight * scale)}px`;

    // Hide zoom toggle on wide desktop screens where fitScale is already 1
    zoomPill.style.display = fitScale < 0.98 ? "inline-flex" : "none";
  };

  const measureIframeHeight = () => {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc && doc.body) {
        const h = Math.max(
          doc.body.scrollHeight || 0,
          doc.documentElement?.scrollHeight || 0,
          600
        );
        docHeight = h + 20;
        iframe.style.height = `${docHeight}px`;
        applyScale();
      }
    } catch {}
  };

  iframe.addEventListener("load", () => {
    measureIframeHeight();
    // Re-measure when any images inside the document finish loading
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        Array.from(doc.images || []).forEach((img) => {
          if (!img.complete) {
            img.addEventListener("load", measureIframeHeight);
            img.addEventListener("error", measureIframeHeight);
          }
        });
      }
    } catch {}
    setTimeout(measureIframeHeight, 350);
  });

  zoomPill.addEventListener("click", () => {
    zoomMode = zoomMode === "fit" ? "full" : "fit";
    updateZoomLabel();
    applyScale();
  });

  const onResize = () => applyScale();
  window.addEventListener("resize", onResize);

  const onShareDone = () => {
    shareBtn.disabled = false;
    shareBtn.style.opacity = "1";
    shareBtn.innerHTML = shareDefaultHtml;
  };
  window.addEventListener("flux:pdf-share-done", onShareDone);

  let unregisterBack = null;
  const closeModal = () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("flux:pdf-share-done", onShareDone);
    if (unregisterBack) {
      const fn = unregisterBack;
      unregisterBack = null;
      fn();
    }
    overlay.remove();
  };

  unregisterBack = registerBackAction(() => {
    closeModal();
  }, 90);

  backBtn.addEventListener("click", closeModal);

  // Trigger Print / Save PDF
  const handlePrintOrSave = () => {
    if (typeof window !== "undefined" && window.FluxPdfNative && typeof window.FluxPdfNative.printHtml === "function") {
      window.FluxPdfNative.printHtml(html, fileName || "FLUX_Documento");
      return;
    }
    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        return;
      }
    } catch {}
  };

  printBtn.addEventListener("click", handlePrintOrSave);

  // Trigger Native Share Sheet (Android Intent.ACTION_SEND or Web Share API)
  shareBtn.addEventListener("click", async () => {
    if (typeof window !== "undefined" && window.FluxPdfNative && typeof window.FluxPdfNative.shareHtmlAsPdf === "function") {
      shareBtn.disabled = true;
      shareBtn.style.opacity = "0.7";
      shareBtn.innerHTML = `<span>Preparando PDF...</span>`;
      let htmlToShare = html;
      try {
        const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
        if (doc && doc.documentElement && doc.body && doc.body.getAttribute("data-flux-pages")) {
          htmlToShare = "<!DOCTYPE html>" + doc.documentElement.outerHTML;
        }
      } catch (err) {}
      window.FluxPdfNative.shareHtmlAsPdf(htmlToShare, fileName || "FLUX_Documento");
      // Safety fallback timeout in case event is missed
      setTimeout(onShareDone, 6000);
      return;
    }

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: title || "Reporte FLUX",
          text: `${title || "Reporte FLUX"}`,
        });
        return;
      } catch (e) {
        if (e?.name === "AbortError") return;
      }
    }

    // Fallback on desktop browsers without native file share: open print/save PDF dialog
    handlePrintOrSave();
  });

  overlay.appendChild(topBar);
  overlay.appendChild(scrollArea);
  overlay.appendChild(zoomPill);
  document.body.appendChild(overlay);

  applyScale();
};

export const generateNutriPDF = (cliente, nutri, dias, brand = {}) => {
  if (!cliente) return;
  const accent = brand.color_primario || "#1A6FD4";
  const dark = darken(accent, 60);
  const light = tint(accent, 210);
  const nombre = escapeHtml(brand.nombre_marca || "FLUX Sport Supplements");
  const logoUrl = brand.logo_url ? safeUrl(brand.logo_url) : null;

  const clienteNombre = escapeHtml(cliente.nombre || "Paciente");
  const clienteObjetivo = escapeHtml(cliente.objetivo || "\u2014");
  const fechaHoy = new Date().toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Plan Nutricional - ${clienteNombre}</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page {
      size: A4 portrait;
      margin: 14mm 12mm 16mm 12mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0B1929;
      background: #fff;
      padding: 24px 20px;
      margin: 0 auto;
      max-width: 800px;
      line-height: 1.45;
    }
    @media print {
      body {
        padding: 0;
        margin: 0;
        max-width: 100%;
        height: auto !important;
        min-height: 0 !important;
      }
      .flux-page-spacer {
        display: none !important;
        height: 0 !important;
      }
    }
    .flux-page-spacer {
      width: 100%;
      display: block;
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      clear: both;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid ${accent};
      padding-bottom: 16px;
      margin-bottom: 20px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .brand-logo { max-height: 75px; max-width: 220px; object-fit: contain; margin-bottom: 6px; }
    .brand-name { font-size: 28px; font-weight: 900; color: ${dark}; letter-spacing: 3px; }
    .brand-sub { font-size: 11px; color: ${accent}; letter-spacing: 2px; margin-top: 2px; text-transform: uppercase; }
    .client-info {
      background: ${light};
      border-left: 4px solid ${accent};
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 20px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .macros {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .macro-box {
      background: ${dark};
      color: white;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .macro-val { font-size: 20px; font-weight: 900; }
    .macro-lbl { font-size: 10px; opacity: .85; }
    .dia {
      margin-bottom: 18px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .dia-title {
      background: ${accent};
      color: white;
      padding: 8px 12px;
      border-radius: 6px 6px 0 0;
      font-weight: 700;
      font-size: 13px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
    }
    thead {
      display: table-header-group;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    th {
      background: ${light};
      padding: 8px 10px;
      text-align: left;
      font-size: 11px;
      color: ${dark};
      font-weight: 700;
      border-bottom: 1px solid rgba(0,0,0,0.06);
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 11px;
      vertical-align: top;
      line-height: 1.4;
    }
    .footer {
      text-align: center;
      margin-top: 24px;
      font-size: 11px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
  </style></head><body>
  <div class="header">
    ${
      logoUrl
        ? `<img src="${logoUrl}" class="brand-logo" alt="${nombre}"/>`
        : `<div class="brand-name">${nombre}</div>`
    }
    <div class="brand-sub">Plan Nutricional Personalizado</div>
  </div>
  <div class="client-info"><strong style="font-size:16px">${clienteNombre}</strong><br>
  <span style="color:#666;font-size:13px">Objetivo: ${clienteObjetivo}</span>
  <span style="float:right;color:#999;font-size:12px">${fechaHoy}</span></div>
  ${
    nutri && (Number(nutri.calorias) > 0 || Number(nutri.proteina) > 0 || Number(nutri.carbohidratos) > 0 || Number(nutri.grasas) > 0)
      ? `<div class="macros">
    <div class="macro-box"><div class="macro-val">${escapeHtml(nutri.calorias || 0)}</div><div class="macro-lbl">Calor&iacute;as (kcal)</div></div>
    <div class="macro-box"><div class="macro-val">${escapeHtml(nutri.proteina || 0)}g</div><div class="macro-lbl">Prote&iacute;na</div></div>
    <div class="macro-box"><div class="macro-val">${escapeHtml(nutri.carbohidratos || 0)}g</div><div class="macro-lbl">Carbohidratos</div></div>
    <div class="macro-box"><div class="macro-val">${escapeHtml(nutri.grasas || 0)}g</div><div class="macro-lbl">Grasas</div></div>
  </div>`
      : ""
  }
  ${(dias || [])
    .map((d) => {
      const comidas = d.comidas || [];
      const sumKcal = comidas.reduce((s, m) => s + (Number(m.calorias) || 0), 0);
      const sumProt = comidas.reduce((s, m) => s + (Number(m.proteina) || 0), 0);
      const sumCarbs = comidas.reduce((s, m) => s + (Number(m.carbohidratos) || 0), 0);
      const sumGrasas = comidas.reduce((s, m) => s + (Number(m.grasas) || 0), 0);
      let macrosHtml = "";
      if (sumKcal || sumProt || sumCarbs || sumGrasas) {
        macrosHtml = `<span style="float:right; font-size:12px; color:#fff; opacity:0.92; font-weight:normal;">${sumKcal} kcal &middot; ${sumProt}g P &middot; ${sumCarbs}g C &middot; ${sumGrasas}g G</span>`;
      }
      const meta = parseDiaMetadata(d.dia || d.nombre || "");
      const cleanTitle = meta.titulo
        ? `${meta.dayCode && meta.dayCode !== "S/D" ? `${meta.dayCode} - ` : ""}${meta.titulo}`
        : (d.dia || d.nombre || "Día").split("|")[0];
      const extraDetails = [
        meta.agua ? `Agua: ${meta.agua} L` : "",
        meta.suplementos ? `Suplementación: ${meta.suplementos}` : ""
      ].filter(Boolean).join(" &middot; ");

      return `<div class="dia"><div class="dia-title">${escapeHtml(cleanTitle)} ${macrosHtml}</div>
      ${extraDetails ? `<div style="font-size:11px; color:#6B7A8D; margin-top:3px; margin-bottom:8px; font-weight:500;">${escapeHtml(extraDetails)}</div>` : ""}
  <table><thead><tr><th>Hora</th><th>Comida</th><th>Opci&oacute;n 1</th><th>Opci&oacute;n 2</th><th>Kcal</th><th>P/C/G</th></tr></thead>
  <tbody>${comidas
    .map(
      (c) => `<tr><td>${escapeHtml(c.hora)}</td><td><strong>${escapeHtml(c.nombre)}</strong></td>
  <td>${escapeHtml(c.opcion1)}</td><td>${escapeHtml(c.opcion2)}</td>
  <td>${escapeHtml(c.calorias || 0)}</td><td>${escapeHtml(c.proteina || 0)}/${escapeHtml(c.carbohidratos || 0)}/${escapeHtml(c.grasas || 0)}g</td></tr>`
    )
    .join("")}
  </tbody></table></div>`;
    })
    .join("")}
  <div class="footer">Plan generado por ${nombre} · Keep Going 💪</div>
  ${FLUX_PAGINATION_SCRIPT}
  </body></html>`;

  const cleanClient = String(cliente.nombre || "Paciente").replace(/[^a-zA-Z0-9_\-]/g, "_");
  openPdfPreviewModal({
    html,
    title: `Plan Nutricional — ${cliente.nombre || "Paciente"}`,
    fileName: `Plan_Nutricional_${cleanClient}`,
    accent,
  });
};

export const generateProgresoPDF = (cliente, rawMetricas = [], brand = {}) => {
  if (!cliente) return;

  const metricas = (rawMetricas || []).map((m) => enrichMetrica(m, cliente));
  const logoUrl = brand?.logo_url ? safeUrl(brand.logo_url) : null;
  const nombre = escapeHtml(brand?.nombre_marca || "FLUX Sport Supplements");
  const accent = brand?.color_primario || "#1A6FD4";
  const dark = darken(accent, 60);
  const light = tint(accent, 220);

  const fmtDate = (d) => {
    if (!d) return "—";
    try {
      return new Date(d + "T12:00:00").toLocaleDateString("es-MX", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return d;
    }
  };

  const latest = metricas.length > 0 ? metricas[0] : null;
  const prev = metricas.length > 1 ? metricas[1] : null;
  const clienteNombre = escapeHtml(cliente.nombre || "Paciente");
  const clienteObjetivo = escapeHtml(cliente.objetivo || "—");
  const clienteSexo = normalizeSexo(cliente?.genero || cliente?.sexo || latest?.sexo || "M");
  const clienteEdad = calcEdadFromBirthdate(cliente?.fecha_nacimiento, latest?.edad ? Number(latest.edad) : null);
  const fechaHoy = new Date().toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Helper para renderizar semáforo de puntos 1-5
  const renderDots = (val, max = 5, filledColor = accent) => {
    const v = parseInt(val, 10) || 0;
    let s = "";
    for (let i = 1; i <= max; i++) {
      s += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin:0 1.5px;background:${i <= v ? filledColor : '#E2E8F0'};vertical-align:middle;"></span>`;
    }
    return `<span style="margin-left:5px;display:inline-flex;align-items:center;">${s}</span>`;
  };

  // 1. Datos de Prescripción Energética y Macronutrientes
  const prescMode = latest?.prescription_mode || (latest?.ai_audit_result ? "ia" : latest?.manual_macros ? "manual" : "matematico");
  const aiAudit = latest?.ai_audit_result;
  const manualMacros = latest?.manual_macros;
  const prescMacros = latest?.prescribed_macros;

  const targetKcal = prescMacros?.targetKcal || aiAudit?.targetKcal || manualMacros?.targetKcal || latest?.targetKcal || null;
  const targetTmb = prescMacros?.tmb || latest?.tmb || null;
  const targetGet = prescMacros?.get || latest?.get || null;
  const fafVal = latest?.eval_faf || prescMacros?.faf || null;
  const fafInfo = getActivityFactorInfo(fafVal);
  const goalPreset = getGoalPresetInfo(latest?.eval_objetivo);

  const protG = prescMacros?.proteinG || prescMacros?.proteinasG || aiAudit?.proteinG || aiAudit?.proteinasG || manualMacros?.proteinG || manualMacros?.proteinasG || latest?.proteinas_g || null;
  const carbG = prescMacros?.carbsG || prescMacros?.carbosG || aiAudit?.carbsG || aiAudit?.carbosG || manualMacros?.carbsG || manualMacros?.carbosG || latest?.carbos_g || null;
  const fatG = prescMacros?.fatsG || prescMacros?.grasasG || aiAudit?.fatsG || aiAudit?.grasasG || manualMacros?.fatsG || manualMacros?.grasasG || latest?.grasas_g || null;
  const aguaMl = prescMacros?.aguaMl || aiAudit?.aguaMl || null;
  const aguaL = aguaMl ? (Number(aguaMl) / 1000).toFixed(1) : null;

  const pesoNum = parseFloat(latest?.peso) || 0;
  const protGKg = prescMacros?.protGKg || (pesoNum > 0 && protG ? (Number(protG) / pesoNum).toFixed(1) : null);
  const carbGKg = prescMacros?.carbGKg || (pesoNum > 0 && carbG ? (Number(carbG) / pesoNum).toFixed(1) : null);
  const fatGKg = prescMacros?.fatGKg || (pesoNum > 0 && fatG ? (Number(fatG) / pesoNum).toFixed(1) : null);

  const totalMacroKcal = (protG ? Number(protG) * 4 : 0) + (carbG ? Number(carbG) * 4 : 0) + (fatG ? Number(fatG) * 9 : 0);
  const protPct = prescMacros?.proteinasPct || (totalMacroKcal > 0 && protG ? Math.round(((Number(protG) * 4) / totalMacroKcal) * 100) : null);
  const carbPct = prescMacros?.carbosPct || (totalMacroKcal > 0 && carbG ? Math.round(((Number(carbG) * 4) / totalMacroKcal) * 100) : null);
  const fatPct = prescMacros?.grasasPct || (totalMacroKcal > 0 && fatG ? Math.round(((Number(fatG) * 9) / totalMacroKcal) * 100) : null);

  // 2. Check-in de Seguimiento Clínico
  const hasCheckin = Boolean(
    latest?.checkin_energia ||
    latest?.checkin_saciedad ||
    latest?.checkin_digestion ||
    latest?.checkin_descanso ||
    latest?.nivel_estres ||
    latest?.checkin_observaciones ||
    latest?.checkin_ajustes
  );

  // 3. Estilo de Vida y Hábitos
  const hasHabits = Boolean(
    latest?.horas_sueno ||
    latest?.consumo_agua_estimado ||
    latest?.preferencias_alimentos ||
    latest?.aversiones_alimentos ||
    latest?.r24h_desayuno ||
    latest?.r24h_colacion_m ||
    latest?.r24h_comida ||
    latest?.r24h_colacion_v ||
    latest?.r24h_cena ||
    latest?.r24h_picoteos
  );

  // 4. Métricas y Clasificaciones
  const imcInfo = classifyIMC(latest?.imc);
  const iccInfo = classifyICC(latest?.icc, clienteSexo);
  const metodoLabel = getMetodoLabel(latest?.metodo_evaluacion || latest?.metodo || "basico");
  const isPlicometria = String(latest?.metodo_evaluacion || latest?.metodo || "").includes("plicometria") || String(latest?.metodo_evaluacion || latest?.metodo || "") === "manual";
  const isInBody = String(latest?.metodo_evaluacion || latest?.metodo || "") === "inbody";

  const has4Masas = Boolean(latest?.calc_masa_grasa && latest?.calc_masa_muscular && latest?.calc_masa_osea);
  const hasSomatotipo = Boolean(latest?.somatotipo_endo && latest?.somatotipo_meso && latest?.somatotipo_ecto);
  const hasPliegues = Boolean(
    latest?.pliegue_triceps ||
    latest?.pliegue_subescapular ||
    latest?.pliegue_biceps ||
    latest?.pliegue_cresta_iliaca ||
    latest?.pliegue_supraespinal ||
    latest?.pliegue_abdominal ||
    latest?.pliegue_muslo ||
    latest?.pliegue_pantorrilla ||
    latest?.sum_pliegues
  );
  const hasDiametros = Boolean(latest?.diametro_muneca || latest?.diametro_codo || latest?.diametro_rodilla);
  const hasCircunferencias = Boolean(
    latest?.cintura ||
    latest?.cadera ||
    latest?.cuello ||
    latest?.pecho ||
    latest?.brazo_relajado ||
    latest?.brazo_contraido ||
    latest?.muslo ||
    latest?.pantorrilla
  );
  const hasClinicos = Boolean(latest?.glucosa || latest?.colesterol || latest?.trigliceridos || latest?.presion_arterial);

  const delta = (curr, prevVal) => {
    const c = parseFloat(curr);
    const p = parseFloat(prevVal);
    if (isNaN(c) || isNaN(p)) return null;
    return c - p;
  };

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Expediente_Evaluacion_${clienteNombre}</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 14mm 12mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0B1929;
      background: #fff;
      padding: 16px 14px;
      margin: 0 auto;
      max-width: 820px;
      line-height: 1.4;
      font-size: 11px;
    }
    @media print {
      body {
        padding: 0;
        margin: 0;
        max-width: 100%;
        height: auto !important;
        min-height: 0 !important;
      }
      .flux-page-spacer {
        display: none !important;
        height: 0 !important;
      }
    }
    .flux-page-spacer {
      width: 100%;
      display: block;
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      clear: both;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid ${accent};
      padding-bottom: 12px;
      margin-bottom: 14px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .brand-logo { max-height: 60px; max-width: 200px; object-fit: contain; }
    .brand-name { font-size: 22px; font-weight: 900; color: ${dark}; letter-spacing: 2px; }
    .brand-sub { font-size: 10px; color: ${accent}; letter-spacing: 1.5px; margin-top: 2px; text-transform: uppercase; font-weight: 700; }
    .header-right { text-align: right; }
    .doc-folio { font-size: 11px; font-weight: 800; color: ${dark}; letter-spacing: 0.5px; }
    .doc-date { font-size: 10px; color: #64748B; margin-top: 2px; }

    .client-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-left: 4px solid ${accent};
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .client-col { flex: 1; }
    .client-name { font-size: 15px; font-weight: 800; color: #0B1929; margin-bottom: 2px; }
    .client-detail { font-size: 11px; color: #64748B; line-height: 1.45; }
    .client-detail strong { color: #0B1929; }

    .title-sec {
      font-size: 12px;
      font-weight: 800;
      color: ${dark};
      margin-top: 16px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 4px;
      page-break-inside: avoid;
      break-inside: avoid;
      page-break-after: avoid;
      break-after: avoid;
    }

    .badge {
      display: inline-block;
      font-size: 9.5px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 5px;
      text-transform: none;
      letter-spacing: 0;
      vertical-align: middle;
    }
    .badge-ia { background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE; }
    .badge-manual { background: #FEF3C7; color: #B45309; border: 1px solid #FDE68A; }
    .badge-math { background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }
    .badge-goal { background: #F0FDF4; color: #15803D; border: 1px solid #BBF7D0; }
    .badge-faf { background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A; }

    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; page-break-inside: avoid; break-inside: avoid; }
    .grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 10px; page-break-inside: avoid; break-inside: avoid; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; page-break-inside: avoid; break-inside: avoid; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 10px; page-break-inside: avoid; break-inside: avoid; }

    .metric-card {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 7px;
      padding: 8px 10px;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .metric-card.accent-bg {
      background: ${dark};
      color: white;
      border-color: ${dark};
    }
    .metric-card.accent-bg .metric-val { color: white; }
    .metric-card.accent-bg .metric-lbl { color: rgba(255,255,255,0.85); }
    .metric-val { font-size: 17px; font-weight: 900; color: #0B1929; line-height: 1.2; }
    .metric-lbl { font-size: 9.5px; color: #64748B; text-transform: uppercase; font-weight: 700; margin-top: 2px; }
    .metric-sub { font-size: 9px; color: #94A3B8; margin-top: 1px; }

    .clinical-box {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 7px;
      padding: 9px 12px;
      margin-bottom: 10px;
      font-size: 10.5px;
      line-height: 1.45;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .clinical-box.ia-box {
      background: #F5F7FF;
      border: 1px solid #D5DDFF;
      border-left: 3.5px solid #4F46E5;
    }
    .clinical-box-title { font-weight: 800; color: #0B1929; margin-bottom: 3px; font-size: 11px; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 10.5px;
      page-break-inside: auto;
    }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    th {
      background: ${light};
      color: ${dark};
      font-weight: 800;
      text-transform: uppercase;
      font-size: 9.5px;
      letter-spacing: 0.5px;
      padding: 6px 8px;
      border: 1px solid #E2E8F0;
      text-align: center;
    }
    td {
      padding: 5.5px 8px;
      border: 1px solid #E2E8F0;
      text-align: center;
      vertical-align: middle;
      color: #0B1929;
    }
    .td-left { text-align: left; }
    .td-bold { font-weight: 700; }

    .delta-pos { color: #16A34A; font-weight: 700; font-size: 9.5px; }
    .delta-neg { color: #DC2626; font-weight: 700; font-size: 9.5px; }

    .photo-group {
      page-break-inside: avoid;
      break-inside: avoid;
      margin-bottom: 14px;
    }
    .footer {
      text-align: center;
      margin-top: 22px;
      font-size: 9.5px;
      color: #94A3B8;
      border-top: 1px solid #E2E8F0;
      padding-top: 10px;
      page-break-inside: avoid;
      break-inside: avoid;
      line-height: 1.4;
    }
  </style></head><body>

  <!-- HEADER -->
  <div class="header">
    <div>
      ${logoUrl ? `<img src="${logoUrl}" class="brand-logo" alt="${nombre}"/>` : `<div class="brand-name">${nombre}</div>`}
      <div class="brand-sub">Expediente Clínico & Reporte de Evaluación Antropométrica</div>
    </div>
    <div class="header-right">
      <div class="doc-folio">EXP-${cliente?.id ? String(cliente.id).slice(0, 8).toUpperCase() : "FLUX"}</div>
      <div class="doc-date">Emisión: <strong>${fechaHoy}</strong></div>
    </div>
  </div>

  <!-- FICHA CLÍNICA DEL PACIENTE -->
  <div class="client-card">
    <div class="client-col">
      <div class="client-name">${clienteNombre}</div>
      <div class="client-detail">
        <strong>Sexo:</strong> ${clienteSexo === "F" ? "Femenino" : "Masculino"} &nbsp;•&nbsp;
        <strong>Edad:</strong> ${clienteEdad ? `${clienteEdad} años` : "—"} &nbsp;•&nbsp;
        <strong>Estatura:</strong> ${latest?.estatura ? `${latest.estatura} cm` : "—"}
      </div>
    </div>
    <div class="client-col" style="text-align:right;">
      <div class="client-detail"><strong>Objetivo General:</strong> ${clienteObjetivo}</div>
      <div class="client-detail">
        <strong>Protocolo:</strong> ${metodoLabel} &nbsp;•&nbsp;
        <strong>Última Evaluación:</strong> ${fmtDate(latest?.fecha)}
      </div>
    </div>
  </div>

  ${
    latest
      ? `
    <!-- 1. PRESCRIPCIÓN ENERGÉTICA Y MACRONUTRIENTES -->
    <div class="title-sec">
      <span>Prescripción Energética y Macronutrientes</span>
      <span>
        <span class="badge ${prescMode === "ia" ? "badge-ia" : prescMode === "manual" ? "badge-manual" : "badge-math"}">
          ${prescMode === "ia" ? "✨ Auditado por IA Clínica" : prescMode === "manual" ? "✏️ Prescripción Manual" : "🔢 Fórmula Matemática"}
        </span>
        ${goalPreset ? `<span class="badge badge-goal">${goalPreset.title} (${goalPreset.pct > 0 ? `+${goalPreset.pct}%` : `${goalPreset.pct}%`})</span>` : ""}
        ${fafInfo ? `<span class="badge badge-faf">FAF ${fafInfo.value} (${fafInfo.label})</span>` : ""}
      </span>
    </div>

    <!-- BALANCE ENERGÉTICO -->
    <div class="grid-4">
      <div class="metric-card">
        <div class="metric-val">${targetTmb ? `${targetTmb}` : "—"} <span style="font-size:10px;font-weight:normal">kcal</span></div>
        <div class="metric-lbl">TMB (Tasa Basal)</div>
        <div class="metric-sub">Metabolismo en reposo</div>
      </div>
      <div class="metric-card">
        <div class="metric-val">${targetGet ? `${targetGet}` : "—"} <span style="font-size:10px;font-weight:normal">kcal</span></div>
        <div class="metric-lbl">GET (Gasto Total)</div>
        <div class="metric-sub">TMB × Factor actividad</div>
      </div>
      <div class="metric-card accent-bg">
        <div class="metric-val">${targetKcal ? `${targetKcal}` : "—"} <span style="font-size:10px;font-weight:normal">kcal</span></div>
        <div class="metric-lbl">Calorías Meta / Día</div>
        <div class="metric-sub">${goalPreset ? goalPreset.desc : "Pauta prescrita"}</div>
      </div>
      <div class="metric-card">
        <div class="metric-val">${aguaL ? `${aguaL} L` : "—"}</div>
        <div class="metric-lbl">Hidratación Sugerida</div>
        <div class="metric-sub">Líquidos base diarios</div>
      </div>
    </div>

    <!-- MACRONUTRIENTES -->
    <div class="grid-3">
      <div class="metric-card" style="border-top:3px solid #3B82F6">
        <div class="metric-val" style="color:#1D4ED8">${protG ? `${protG} g` : "—"}</div>
        <div class="metric-lbl">Proteínas ${protPct ? `(${protPct}%)` : ""}</div>
        <div class="metric-sub">${protGKg ? `${protGKg} g/kg peso corporal` : "Aporte estructural"}</div>
      </div>
      <div class="metric-card" style="border-top:3px solid #10B981">
        <div class="metric-val" style="color:#047857">${carbG ? `${carbG} g` : "—"}</div>
        <div class="metric-lbl">Carbohidratos ${carbPct ? `(${carbPct}%)` : ""}</div>
        <div class="metric-sub">${carbGKg ? `${carbGKg} g/kg peso corporal` : "Energía glucolítica"}</div>
      </div>
      <div class="metric-card" style="border-top:3px solid #F59E0B">
        <div class="metric-val" style="color:#B45309">${fatG ? `${fatG} g` : "—"}</div>
        <div class="metric-lbl">Grasas Saludables ${fatPct ? `(${fatPct}%)` : ""}</div>
        <div class="metric-sub">${fatGKg ? `${fatGKg} g/kg peso corporal` : "Soporte hormonal"}</div>
      </div>
    </div>

    <!-- DICTAMEN DE AUDITORÍA IA / CRITERIO CLÍNICO -->
    ${
      (aiAudit?.analisisClinico || aiAudit?.criterioClinico || aiAudit?.justificacionFisiologica || prescMacros?.analisisClinico)
        ? `
      <div class="clinical-box ia-box">
        <div class="clinical-box-title" style="color:#4338CA;display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <span>✨ Dictamen Clínico de la Prescripción Auditada por Inteligencia Artificial</span>
          ${(aiAudit?.badgeMotivo || prescMacros?.badgeMotivo) ? `<span style="font-size:9px;background:#EEF2FF;color:#4338CA;padding:2px 8px;border-radius:6px;border:1px solid #C7D2FE;font-weight:700;">${escapeHtml(aiAudit?.badgeMotivo || prescMacros?.badgeMotivo)}</span>` : ""}
        </div>
        <div style="color:#1E1B4B;margin-bottom:4px;line-height:1.45;">
          ${escapeHtml(aiAudit?.analisisClinico || prescMacros?.analisisClinico || aiAudit?.criterioClinico || aiAudit?.justificacionFisiologica)}
        </div>
        ${
          aiAudit?.estrategiaMenu || prescMacros?.estrategiaMenu
            ? `<div style="font-size:10px;color:#3730A3;margin-top:4px;"><strong>Estrategia de menú sugerida:</strong> ${escapeHtml(aiAudit?.estrategiaMenu || prescMacros?.estrategiaMenu)}</div>`
            : ""
        }
        ${
          aiAudit?.ajusteKcal
            ? `<div style="font-size:10px;color:#4338CA;font-weight:700;margin-top:2px;">Ajuste calórico aplicado: ${escapeHtml(aiAudit.ajusteKcal)}</div>`
            : ""
        }
        ${
          aiAudit?.enfoqueEntrenamiento
            ? `<div style="font-size:10px;color:#0B1929;margin-top:2px;"><strong>Directriz de entrenamiento:</strong> ${escapeHtml(aiAudit.enfoqueEntrenamiento)}</div>`
            : ""
        }
      </div>
    `
        : ""
    }

    <!-- 2. CHECK-IN DE SEGUIMIENTO CLÍNICO -->
    ${
      hasCheckin
        ? `
      <div class="title-sec">
        <span>Check-in de Seguimiento Clínico y Biofeedback</span>
        <span style="font-size:9.5px;color:#64748B;font-weight:normal">Escala 1 a 5</span>
      </div>
      <div class="grid-5">
        <div class="metric-card">
          <div class="metric-val" style="font-size:15px">
            ${latest.checkin_energia || "—"}/5
            ${latest.checkin_energia ? renderDots(latest.checkin_energia, 5, "#EAB308") : ""}
          </div>
          <div class="metric-lbl">⚡ Energía</div>
        </div>
        <div class="metric-card">
          <div class="metric-val" style="font-size:15px">
            ${latest.checkin_saciedad || "—"}/5
            ${latest.checkin_saciedad ? renderDots(latest.checkin_saciedad, 5, "#10B981") : ""}
          </div>
          <div class="metric-lbl">🍽️ Saciedad</div>
        </div>
        <div class="metric-card">
          <div class="metric-val" style="font-size:15px">
            ${latest.checkin_digestion || "—"}/5
            ${latest.checkin_digestion ? renderDots(latest.checkin_digestion, 5, "#8B5CF6") : ""}
          </div>
          <div class="metric-lbl">🩺 Digestión</div>
        </div>
        <div class="metric-card">
          <div class="metric-val" style="font-size:15px">
            ${latest.checkin_descanso || "—"}/5
            ${latest.checkin_descanso ? renderDots(latest.checkin_descanso, 5, "#6366F1") : ""}
          </div>
          <div class="metric-lbl">🌙 Sueño</div>
        </div>
        <div class="metric-card">
          <div class="metric-val" style="font-size:15px;color:${Number(latest.nivel_estres) >= 4 ? "#DC2626" : Number(latest.nivel_estres) === 3 ? "#D97706" : "#2563EB"}">
            ${latest.nivel_estres || "—"}/5
            ${latest.nivel_estres ? renderDots(latest.nivel_estres, 5, Number(latest.nivel_estres) >= 4 ? "#DC2626" : Number(latest.nivel_estres) === 3 ? "#D97706" : "#2563EB") : ""}
          </div>
          <div class="metric-lbl">⚠️ Estrés</div>
        </div>
      </div>
      ${
        latest.checkin_observaciones
          ? `
        <div class="clinical-box" style="margin-top:-2px">
          <strong>Sensaciones y Estado Físico:</strong> ${escapeHtml(latest.checkin_observaciones)}
        </div>
      `
          : ""
      }
      ${
        latest.checkin_ajustes
          ? `
        <div class="clinical-box" style="border-left:3.5px solid ${accent};margin-top:-2px">
          <strong style="color:${dark}">Ajustes de Menú Solicitados:</strong> ${escapeHtml(latest.checkin_ajustes)}
        </div>
      `
          : ""
      }
    `
        : ""
    }

    <!-- 3. HÁBITOS, PREFERENCIAS Y RECORDATORIO 24H -->
    ${
      hasHabits
        ? `
      <div class="title-sec">
        <span>Estilo de Vida, Preferencias y Hábitos</span>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        ${latest.horas_sueno ? `<div class="badge" style="background:#F1F5F9;color:#0B1929;border:1px solid #CBD5E1">🕒 <strong>Sueño diario:</strong> ${latest.horas_sueno} hrs/noche</div>` : ""}
        ${latest.consumo_agua_estimado ? `<div class="badge" style="background:#F1F5F9;color:#0B1929;border:1px solid #CBD5E1">💧 <strong>Consumo de agua:</strong> ${latest.consumo_agua_estimado}</div>` : ""}
        ${latest.dias_ejercicio_actual ? `<div class="badge" style="background:#F1F5F9;color:#0B1929;border:1px solid #CBD5E1">🏋️ <strong>Días de entrenamiento previos:</strong> ${latest.dias_ejercicio_actual} d/sem</div>` : ""}
      </div>
      <div class="grid-2">
        ${
          latest.preferencias_alimentos
            ? `
          <div class="clinical-box" style="background:#F0FDF4;border-color:#BBF7D0;color:#166534">
            <strong>Alimentos Favoritos / Preferencias:</strong><br>${escapeHtml(latest.preferencias_alimentos)}
          </div>
        `
            : "<div></div>"
        }
        ${
          latest.aversiones_alimentos
            ? `
          <div class="clinical-box" style="background:#FFF1F2;border-color:#FECDD3;color:#9F1239">
            <strong>Alimentos que Rechaza / Alergias:</strong><br>${escapeHtml(latest.aversiones_alimentos)}
          </div>
        `
            : "<div></div>"
        }
      </div>
      ${
        Boolean(latest.r24h_desayuno || latest.r24h_comida || latest.r24h_cena || latest.r24h_colacion_m || latest.r24h_colacion_v || latest.r24h_picoteos)
          ? `
        <div class="clinical-box" style="background:#FFFFFF;border:1px solid #E2E8F0;">
          <strong style="color:${dark};display:block;margin-bottom:4px;">Recordatorio de 24 Horas Previo (R24H):</strong>
          <div style="font-size:10px;line-height:1.6;color:#334155;">
            ${latest.r24h_desayuno ? `• <strong>Desayuno:</strong> ${escapeHtml(latest.r24h_desayuno)}<br>` : ""}
            ${latest.r24h_colacion_m ? `• <strong>Colación Matutina:</strong> ${escapeHtml(latest.r24h_colacion_m)}<br>` : ""}
            ${latest.r24h_comida ? `• <strong>Comida:</strong> ${escapeHtml(latest.r24h_comida)}<br>` : ""}
            ${latest.r24h_colacion_v ? `• <strong>Colación Vespertina:</strong> ${escapeHtml(latest.r24h_colacion_v)}<br>` : ""}
            ${latest.r24h_cena ? `• <strong>Cena:</strong> ${escapeHtml(latest.r24h_cena)}<br>` : ""}
            ${latest.r24h_picoteos ? `• <strong>Picoteos / Extras:</strong> ${escapeHtml(latest.r24h_picoteos)}<br>` : ""}
          </div>
        </div>
      `
          : ""
      }
    `
        : ""
    }

    <!-- 4. COMPOSICIÓN CORPORAL Y ANTROPOMETRÍA -->
    <div class="title-sec">
      <span>Composición Corporal · ${metodoLabel}</span>
      <span style="font-size:9.5px;color:#64748B;font-weight:normal">${fmtDate(latest.fecha)}</span>
    </div>

    <!-- TARJETAS PRINCIPALES -->
    <div class="grid-5">
      <div class="metric-card">
        <div class="metric-val">${latest.peso || "—"} <span style="font-size:10px;font-weight:normal">kg</span></div>
        <div class="metric-lbl">Peso Corporal</div>
        <div class="metric-sub">${prev && delta(latest.peso, prev.peso) !== null ? `<span class="${delta(latest.peso, prev.peso) > 0 ? "delta-neg" : "delta-pos"}">${delta(latest.peso, prev.peso) > 0 ? "+" : ""}${delta(latest.peso, prev.peso).toFixed(1)} kg</span>` : "Registro actual"}</div>
      </div>
      <div class="metric-card">
        <div class="metric-val">${latest.imc || "—"}</div>
        <div class="metric-lbl">IMC (kg/m²)</div>
        <div class="metric-sub">${imcInfo ? imcInfo.label : "Índice Quetelet"}</div>
      </div>
      <div class="metric-card">
        <div class="metric-val">${latest.grasa_pct ? `${latest.grasa_pct}%` : "—"}</div>
        <div class="metric-lbl">Grasa Corporal</div>
        <div class="metric-sub">${latest.calc_masa_grasa ? `${latest.calc_masa_grasa} kg grasa` : "Porcentaje"}</div>
      </div>
      <div class="metric-card">
        <div class="metric-val">${latest.masa_libre_grasa ? `${latest.masa_libre_grasa} kg` : "—"}</div>
        <div class="metric-lbl">Masa Magra (MLG)</div>
        <div class="metric-sub">Peso libre de grasa</div>
      </div>
      <div class="metric-card">
        <div class="metric-val">${latest.calc_masa_muscular ? `${latest.calc_masa_muscular} kg` : latest.musculo_pct ? `${latest.musculo_pct}%` : "—"}</div>
        <div class="metric-lbl">Masa Muscular</div>
        <div class="metric-sub">${latest.musculo_pct ? `${latest.musculo_pct}% del peso` : "Tejido contráctil"}</div>
      </div>
    </div>

    <!-- ISAK 4 COMPONENTES & SOMATOTIPO (SI CORRESPONDE) -->
    ${
      has4Masas || hasSomatotipo
        ? `
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:7px;padding:9px 12px;margin-bottom:10px;">
        <div style="font-weight:800;color:${dark};font-size:10.5px;margin-bottom:6px;text-transform:uppercase;">
          Fraccionamiento en 4 Masas (ISAK / Matiegka) y Somatotipo Heath-Carter
        </div>
        <div class="grid-4" style="margin-bottom:6px;">
          <div style="background:#fff;border:1px solid #E2E8F0;border-radius:6px;padding:6px;text-align:center;">
            <div style="font-weight:800;font-size:13px;color:#DC2626">${latest.calc_masa_grasa || "—"} kg</div>
            <div style="font-size:9px;color:#64748B;font-weight:700">Masa Grasa</div>
          </div>
          <div style="background:#fff;border:1px solid #E2E8F0;border-radius:6px;padding:6px;text-align:center;">
            <div style="font-weight:800;font-size:13px;color:#2563EB">${latest.calc_masa_muscular || "—"} kg</div>
            <div style="font-size:9px;color:#64748B;font-weight:700">Masa Muscular (Matiegka)</div>
          </div>
          <div style="background:#fff;border:1px solid #E2E8F0;border-radius:6px;padding:6px;text-align:center;">
            <div style="font-weight:800;font-size:13px;color:#475569">${latest.calc_masa_osea || "—"} kg</div>
            <div style="font-size:9px;color:#64748B;font-weight:700">Masa Ósea (Rocha)</div>
          </div>
          <div style="background:#fff;border:1px solid #E2E8F0;border-radius:6px;padding:6px;text-align:center;">
            <div style="font-weight:800;font-size:13px;color:#D97706">${latest.calc_masa_residual || "—"} kg</div>
            <div style="font-size:9px;color:#64748B;font-weight:700">Masa Residual (Wurch)</div>
          </div>
        </div>
        ${
          hasSomatotipo
            ? `
          <div style="display:flex;gap:12px;font-size:10px;justify-content:center;background:#fff;border:1px solid #E2E8F0;border-radius:6px;padding:5px;">
            <span><strong>Endomorfia (Adiposidad):</strong> ${latest.somatotipo_endo}</span>
            <span>•</span>
            <span><strong>Mesomorfia (Muscularidad):</strong> ${latest.somatotipo_meso}</span>
            <span>•</span>
            <span><strong>Ectomorfia (Linealidad):</strong> ${latest.somatotipo_ecto}</span>
          </div>
        `
            : ""
        }
      </div>
    `
        : ""
    }

    <!-- TABLA DE CIRCUNFERENCIAS Y PLIEGUES -->
    ${
      hasCircunferencias || hasPliegues || hasDiametros
        ? `
      <table>
        <thead>
          <tr>
            <th colspan="4" style="background:#F1F5F9;text-align:left;color:#0B1929">Circunferencias Corporales (cm) & Riesgo</th>
            <th colspan="4" style="background:#F1F5F9;text-align:left;color:#0B1929">Pliegues Cutáneos (mm) & Diámetros</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="td-left"><strong>Cintura:</strong> ${latest.cintura ? `${latest.cintura} cm` : "—"}</td>
            <td class="td-left"><strong>Cadera:</strong> ${latest.cadera ? `${latest.cadera} cm` : "—"}</td>
            <td class="td-left"><strong>ICC:</strong> ${latest.icc || "—"} ${iccInfo ? `(${iccInfo.label})` : ""}</td>
            <td class="td-left"><strong>ICE:</strong> ${latest.ice || "—"}</td>
            <td class="td-left"><strong>Tríceps:</strong> ${latest.pliegue_triceps ? `${latest.pliegue_triceps} mm` : "—"}</td>
            <td class="td-left"><strong>Subescapular:</strong> ${latest.pliegue_subescapular ? `${latest.pliegue_subescapular} mm` : "—"}</td>
            <td class="td-left"><strong>Bíceps:</strong> ${latest.pliegue_biceps ? `${latest.pliegue_biceps} mm` : "—"}</td>
            <td class="td-left"><strong>Cresta Ilíaca:</strong> ${latest.pliegue_cresta_iliaca ? `${latest.pliegue_cresta_iliaca} mm` : "—"}</td>
          </tr>
          <tr>
            <td class="td-left"><strong>Cuello:</strong> ${latest.cuello ? `${latest.cuello} cm` : "—"}</td>
            <td class="td-left"><strong>Pecho:</strong> ${latest.pecho ? `${latest.pecho} cm` : "—"}</td>
            <td class="td-left"><strong>Brazo Relajado:</strong> ${latest.brazo_relajado ? `${latest.brazo_relajado} cm` : "—"}</td>
            <td class="td-left"><strong>Brazo Flex:</strong> ${latest.brazo_contraido ? `${latest.brazo_contraido} cm` : "—"}</td>
            <td class="td-left"><strong>Supraespinal:</strong> ${latest.pliegue_supraespinal ? `${latest.pliegue_supraespinal} mm` : "—"}</td>
            <td class="td-left"><strong>Abdominal:</strong> ${latest.pliegue_abdominal ? `${latest.pliegue_abdominal} mm` : "—"}</td>
            <td class="td-left"><strong>Muslo Ant.:</strong> ${latest.pliegue_muslo ? `${latest.pliegue_muslo} mm` : "—"}</td>
            <td class="td-left"><strong>Pantorrilla:</strong> ${latest.pliegue_pantorrilla ? `${latest.pliegue_pantorrilla} mm` : "—"}</td>
          </tr>
          <tr>
            <td class="td-left"><strong>Muslo:</strong> ${latest.muslo ? `${latest.muslo} cm` : "—"}</td>
            <td class="td-left"><strong>Pantorrilla:</strong> ${latest.pantorrilla ? `${latest.pantorrilla} cm` : "—"}</td>
            <td class="td-left" colspan="2"></td>
            <td class="td-left" colspan="2"><strong>Sumatoria Σ Pliegues:</strong> ${latest.sum_pliegues ? `${latest.sum_pliegues} mm` : "—"}</td>
            <td class="td-left" colspan="2"><strong>Diám. Muñeca/Codo/Rod.:</strong> ${[latest.diametro_muneca, latest.diametro_codo, latest.diametro_rodilla].filter(Boolean).join(" / ") || "—"} cm</td>
          </tr>
        </tbody>
      </table>
    `
        : ""
    }

    <!-- CLÍNICOS Y NOTAS -->
    ${
      hasClinicos || latest.notas
        ? `
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        ${latest.glucosa ? `<div class="badge" style="background:#FFFBEB;color:#B45309;border:1px solid #FDE68A">Glucosa: ${latest.glucosa} mg/dL</div>` : ""}
        ${latest.colesterol ? `<div class="badge" style="background:#FFFBEB;color:#B45309;border:1px solid #FDE68A">Colesterol: ${latest.colesterol} mg/dL</div>` : ""}
        ${latest.trigliceridos ? `<div class="badge" style="background:#FFFBEB;color:#B45309;border:1px solid #FDE68A">Triglicéridos: ${latest.trigliceridos} mg/dL</div>` : ""}
        ${latest.presion_arterial ? `<div class="badge" style="background:#FFFBEB;color:#B45309;border:1px solid #FDE68A">Presión Arterial: ${latest.presion_arterial} mmHg</div>` : ""}
      </div>
      ${
        latest.notas
          ? `
        <div class="clinical-box" style="margin-top:-4px">
          <strong>Notas del Especialista:</strong> ${escapeHtml(latest.notas)}
        </div>
      `
          : ""
      }
    `
        : ""
    }
  `
      : `<div style="text-align:center;padding:40px;color:#999">No hay evaluaciones registradas aún.</div>`
  }

  <!-- 5. HISTORIAL DE PROGRESO Y EVOLUCIÓN TEMPORAL -->
  ${
    metricas.length > 0
      ? `
    <div class="title-sec">
      <span>Historial Comparativo y Evolución Temporal</span>
      <span style="font-size:9.5px;color:#64748B;font-weight:normal">${metricas.length} registro(s)</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="text-align:left">Fecha</th>
          <th>Protocolo</th>
          <th>Peso (kg)</th>
          <th>IMC</th>
          <th>Grasa (%)</th>
          <th>Masa Magra (kg)</th>
          <th>Cintura (cm)</th>
          <th>Prescripción</th>
        </tr>
      </thead>
      <tbody>
        ${metricas
          .map((m, i) => {
            const nextM = metricas[i + 1] || null;
            const dPeso = nextM ? delta(m.peso, nextM.peso) : null;
            const dGrasa = nextM ? delta(m.grasa_pct, nextM.grasa_pct) : null;
            const pKcal = m.prescribed_macros?.targetKcal || m.ai_audit_result?.targetKcal || m.manual_macros?.targetKcal || m.targetKcal || null;
            const pMode = m.prescription_mode || (m.ai_audit_result ? "IA" : "Mat.");
            return `<tr>
            <td class="td-left td-bold">${fmtDate(m.fecha)}</td>
            <td>${escapeHtml(getMetodoLabel(m.metodo_evaluacion || m.metodo))}</td>
            <td>
              ${m.peso || "—"}
              ${dPeso !== null ? `<br><span class="${dPeso > 0 ? "delta-neg" : "delta-pos"}">${dPeso > 0 ? "+" : ""}${dPeso.toFixed(1)}</span>` : ""}
            </td>
            <td>${m.imc || "—"}</td>
            <td>
              ${m.grasa_pct ? `${m.grasa_pct}%` : "—"}
              ${dGrasa !== null ? `<br><span class="${dGrasa > 0 ? "delta-neg" : "delta-pos"}">${dGrasa > 0 ? "+" : ""}${dGrasa.toFixed(1)}%</span>` : ""}
            </td>
            <td>${m.masa_libre_grasa ? `${m.masa_libre_grasa}` : "—"}</td>
            <td>${m.cintura ? `${m.cintura}` : "—"}</td>
            <td>${pKcal ? `${pKcal} kcal (${pMode})` : "—"}</td>
          </tr>`;
          })
          .join("")}
      </tbody>
    </table>

    <!-- 6. GALERÍA DE PROGRESO FOTOGRÁFICO -->
    ${
      metricas.some((m) => parseFotos(m.fotos).length > 0)
        ? `
      <div class="title-sec">Registro Fotográfico de Control</div>
      ${metricas
        .filter((m) => parseFotos(m.fotos).length > 0)
        .map(
          (m) => `
        <div class="photo-group">
          <div style="font-weight:800; font-size:11px; margin-bottom:8px; color:${dark};">📅 ${fmtDate(m.fecha)}</div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            ${parseFotos(m.fotos)
              .map(
                (url) => `
              <div style="break-inside:avoid;page-break-inside:avoid;">
                <img src="${safeUrl(url)}" style="max-width:240px; max-height:300px; width:auto; height:auto; display:block; border-radius:6px; border:1px solid #CBD5E1; box-shadow: 0 1px 3px rgba(0,0,0,0.06);" alt="Foto progreso"/>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
        )
        .join("")}
    `
        : ""
    }
  `
      : ""
  }

  <!-- FOOTER -->
  <div class="footer">
    Documento generado electrónicamente por la plataforma FLUX para <strong>${clienteNombre}</strong>.<br>
    Información estrictamente confidencial para fines de asesoría nutricional y seguimiento deportivo · ${nombre}
  </div>

  ${FLUX_PAGINATION_SCRIPT}
  </body></html>`;

  const cleanClient = String(cliente.nombre || "Paciente").replace(/[^a-zA-Z0-9_\-]/g, "_");
  openPdfPreviewModal({
    html,
    title: `Expediente de Evaluación — ${cliente.nombre || "Paciente"}`,
    fileName: `Expediente_Evaluacion_${cleanClient}`,
    accent,
  });
};
