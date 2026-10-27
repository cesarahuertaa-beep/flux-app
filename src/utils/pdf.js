import { escapeHtml, parseFotos } from "./helpers";
import { registerBackAction } from "../lib/backButtonHandler";
import { enrichMetrica, getMetodoLabel } from "../lib/bodyComposition";

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
  if (!/^https?:\/\//i.test(url)) return "";
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
  const accent = brand.color_primario || "#2D9CDB";
  const dark = darken(accent, 60);
  const light = tint(accent, 210);
  const nombre = escapeHtml(brand.nombre_marca || "FLUX Sport Supplements");
  const logoUrl = brand.logo_url && brand.logo_url !== "/flux_logo.jpeg" ? safeUrl(brand.logo_url) : null;

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
      return `<div class="dia"><div class="dia-title">${escapeHtml(d.dia || d.nombre || "Día")} ${macrosHtml}</div>
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
  const logoUrl = brand?.logo_url && brand.logo_url !== "/flux_logo.jpeg" ? safeUrl(brand.logo_url) : null;
  const nombre = escapeHtml(brand?.nombre_marca || "FLUX");
  const accent = brand?.color_primario || "#38bdf8";
  const dark = darken(accent, 60);
  const light = tint(accent, 210);

  const fmtDate = (d) =>
    new Date(d + "T12:00:00").toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const latest = metricas.length > 0 ? metricas[0] : null;
  const clienteNombre = escapeHtml(cliente.nombre || "Paciente");
  const clienteObjetivo = escapeHtml(cliente.objetivo || "\u2014");
  const fechaHoy = new Date().toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Progreso_${clienteNombre}</title>
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
    .title-sec {
      font-size: 14px;
      font-weight: 700;
      color: ${dark};
      margin-top: 20px;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      page-break-inside: avoid;
      break-inside: avoid;
      page-break-after: avoid;
      break-after: avoid;
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
    .macro-lbl { font-size: 10px; opacity: .85; margin-top: 2px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
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
      padding: 8px;
      text-align: center;
      font-size: 11px;
      color: ${dark};
      border: 1px solid #e2e8f0;
      font-weight: 700;
    }
    td {
      padding: 7px 8px;
      border: 1px solid #e2e8f0;
      font-size: 11px;
      text-align: center;
      vertical-align: middle;
    }
    .date-col { font-weight: 700; text-align: left; }
    .photo-group {
      page-break-inside: avoid;
      break-inside: avoid;
      margin-bottom: 16px;
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
    ${logoUrl ? `<img src="${logoUrl}" class="brand-logo" alt="${nombre}"/>` : `<div class="brand-name">${nombre}</div>`}
    <div class="brand-sub">Reporte de Progreso y Evaluaciones</div>
  </div>
  
  <div class="client-info">
    <strong style="font-size:16px">${clienteNombre}</strong><br>
    <span style="color:#666;font-size:13px">Objetivo: ${clienteObjetivo}</span>
    <span style="float:right;color:#999;font-size:12px">Generado: ${fechaHoy}</span>
  </div>

  ${
    latest
      ? `
    <div class="title-sec">Última Evaluación (${fmtDate(latest.fecha)} · ${escapeHtml(getMetodoLabel(latest.metodo))})</div>
    <div class="macros">
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.peso || "--")}</div><div class="macro-lbl">Peso (kg)</div></div>
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.imc || "--")}</div><div class="macro-lbl">IMC</div></div>
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.grasa_pct || "--")}</div><div class="macro-lbl">Grasa (%)</div></div>
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.masa_libre_grasa || latest.musculo_pct || "--")}</div><div class="macro-lbl">${latest.masa_libre_grasa ? "Masa Magra MLG (kg)" : "Músculo (%)"}</div></div>
    </div>
    <div class="macros" style="grid-template-columns:repeat(4,1fr);margin-bottom:30px">
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.icc || latest.agua_pct || "--")}</div><div class="macro-lbl">${latest.icc ? "ICC" : "Agua (%)"}</div></div>
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.cintura || "--")}</div><div class="macro-lbl">Cintura (cm)</div></div>
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.glucosa || "--")}</div><div class="macro-lbl">Glucosa (mg/dL)</div></div>
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.presion_arterial || "--")}</div><div class="macro-lbl">Presión</div></div>
    </div>
  `
      : `<div style="text-align:center;padding:40px;color:#999">No hay evaluaciones registradas aún.</div>`
  }

  ${
    metricas.length > 0
      ? `
    <div class="title-sec">Composición Corporal</div>
    <table>
      <thead><tr>
        <th style="text-align:left">Fecha</th>
        <th>Protocolo</th><th>Peso (kg)</th><th>IMC</th><th>Grasa (%)</th><th>MLG (kg)</th><th>Músculo (%)</th>
      </tr></thead>
      <tbody>
        ${metricas
          .map(
            (m) => `<tr>
          <td class="date-col">${fmtDate(m.fecha)}</td>
          <td>${escapeHtml(getMetodoLabel(m.metodo))}</td>
          <td>${escapeHtml(m.peso || "--")}</td><td>${escapeHtml(m.imc || "--")}</td>
          <td>${escapeHtml(m.grasa_pct || "--")}</td><td>${escapeHtml(m.masa_libre_grasa || "--")}</td><td>${escapeHtml(m.musculo_pct || "--")}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>

    <div class="title-sec">Medidas y Clínicos</div>
    <table>
      <thead><tr>
        <th style="text-align:left">Fecha</th>
        <th>Cintura (cm)</th><th>Cadera (cm)</th><th>ICC / ICE</th><th>Glucosa</th><th>Colesterol</th><th>Presión</th>
      </tr></thead>
      <tbody>
        ${metricas
          .map(
            (m) => `<tr>
          <td class="date-col">${fmtDate(m.fecha)}</td>
          <td>${escapeHtml(m.cintura || "--")}</td><td>${escapeHtml(m.cadera || "--")}</td>
          <td>${escapeHtml(m.icc || "--")} / ${escapeHtml(m.ice || "--")}</td>
          <td>${escapeHtml(m.glucosa || "--")}</td><td>${escapeHtml(m.colesterol || "--")}</td><td>${escapeHtml(m.presion_arterial || "--")}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>

    ${
      metricas.some((m) => parseFotos(m.fotos).length > 0)
        ? `
      <div class="title-sec" style="margin-top:40px; border-top:1px solid #ddd; padding-top:30px;">Galería de Progreso</div>
      ${metricas
        .filter((m) => parseFotos(m.fotos).length > 0)
        .map(
          (m) => `
        <div class="photo-group" style="margin-bottom:20px;">
          <div style="font-weight:700; font-size:14px; margin-bottom:10px; color:${dark};">📅 ${fmtDate(m.fecha)}</div>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            ${parseFotos(m.fotos)
              .map(
                (url) => `
              <div class="photo-item" style="break-inside: avoid; page-break-inside: avoid;">
                <img src="${safeUrl(url)}" style="max-width:280px; max-height:350px; width:auto; height:auto; display:block; border-radius:8px; border:1px solid #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.05);" alt="Foto progreso"/>
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

  <div class="footer">Reporte generado por ${nombre} · Keep Going 💪</div>
  ${FLUX_PAGINATION_SCRIPT}
  </body></html>`;

  const cleanClient = String(cliente.nombre || "Paciente").replace(/[^a-zA-Z0-9_\-]/g, "_");
  openPdfPreviewModal({
    html,
    title: `Reporte de Progreso — ${cliente.nombre || "Paciente"}`,
    fileName: `Reporte_Progreso_${cleanClient}`,
    accent,
  });
};
