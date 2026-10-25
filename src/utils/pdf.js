import { escapeHtml, parseFotos } from "./helpers";
import { registerBackAction } from "../lib/backButtonHandler";

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
      window.FluxPdfNative.shareHtmlAsPdf(html, fileName || "FLUX_Documento");
      // Safety fallback timeout in case event is missed
      setTimeout(onShareDone, 5000);
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
    body{font-family:Arial,sans-serif;color:#000;background:#fff;padding:30px;max-width:800px;margin:0 auto}
    .header{text-align:center;border-bottom:3px solid ${accent};padding-bottom:20px;margin-bottom:24px}
    .brand-logo{max-height:80px;max-width:240px;object-fit:contain;margin-bottom:6px}
    .brand-name{font-size:32px;font-weight:900;color:${dark};letter-spacing:4px}
    .brand-sub{font-size:12px;color:${accent};letter-spacing:2px;margin-top:2px}
    .client-info{background:${light};border-left:4px solid ${accent};padding:12px 16px;border-radius:4px;margin-bottom:20px}
    .macros{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
    .macro-box{background:${dark};color:white;border-radius:10px;padding:14px;text-align:center}
    .macro-val{font-size:24px;font-weight:900}
    .macro-lbl{font-size:11px;opacity:.8}
    .dia{margin-bottom:20px;page-break-inside:avoid}
    .dia-title{background:${accent};color:white;padding:8px 14px;border-radius:6px 6px 0 0;font-weight:700;font-size:15px}
    table{width:100%;border-collapse:collapse}
    th{background:${light};padding:8px 10px;text-align:left;font-size:12px;color:${dark}}
    td{padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;vertical-align:top}
    .footer{text-align:center;margin-top:30px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:14px}
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
  </body></html>`;

  const cleanClient = String(cliente.nombre || "Paciente").replace(/[^a-zA-Z0-9_\-]/g, "_");
  openPdfPreviewModal({
    html,
    title: `Plan Nutricional — ${cliente.nombre || "Paciente"}`,
    fileName: `Plan_Nutricional_${cleanClient}`,
    accent,
  });
};

export const generateProgresoPDF = (cliente, metricas = [], brand = {}) => {
  if (!cliente) return;

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
    body{font-family:Arial,sans-serif;color:#000;background:#fff;padding:30px;max-width:800px;margin:0 auto}
    .header{text-align:center;border-bottom:3px solid ${accent};padding-bottom:20px;margin-bottom:24px}
    .brand-logo{max-height:80px;max-width:240px;object-fit:contain;margin-bottom:6px}
    .brand-name{font-size:32px;font-weight:900;color:${dark};letter-spacing:4px}
    .brand-sub{font-size:12px;color:${accent};letter-spacing:2px;margin-top:2px}
    .client-info{background:${light};border-left:4px solid ${accent};padding:12px 16px;border-radius:4px;margin-bottom:24px}
    .title-sec{font-size:16px;font-weight:700;color:${dark};margin-bottom:12px;text-transform:uppercase;letter-spacing:1px}
    .macros{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:30px}
    .macro-box{background:${dark};color:white;border-radius:10px;padding:14px;text-align:center}
    .macro-val{font-size:24px;font-weight:900}
    .macro-lbl{font-size:11px;opacity:.8;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-bottom:30px}
    th{background:${light};padding:10px;text-align:center;font-size:12px;color:${dark};border:1px solid #ddd}
    td{padding:10px;border:1px solid #ddd;font-size:12px;text-align:center;vertical-align:middle}
    .date-col{font-weight:700;text-align:left}
    .footer{text-align:center;margin-top:40px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:14px}
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
    <div class="title-sec">Última Evaluación (${fmtDate(latest.fecha)})</div>
    <div class="macros">
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.peso || "--")}</div><div class="macro-lbl">Peso (kg)</div></div>
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.imc || "--")}</div><div class="macro-lbl">IMC</div></div>
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.grasa_pct || "--")}</div><div class="macro-lbl">Grasa (%)</div></div>
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.musculo_pct || "--")}</div><div class="macro-lbl">Músculo (%)</div></div>
    </div>
    <div class="macros" style="grid-template-columns:repeat(4,1fr);margin-bottom:30px">
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.agua_pct || "--")}</div><div class="macro-lbl">Agua (%)</div></div>
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
        <th>Peso (kg)</th><th>IMC</th><th>Grasa (%)</th><th>Músculo (%)</th><th>Agua (%)</th>
      </tr></thead>
      <tbody>
        ${metricas
          .map(
            (m) => `<tr>
          <td class="date-col">${fmtDate(m.fecha)}</td>
          <td>${escapeHtml(m.peso || "--")}</td><td>${escapeHtml(m.imc || "--")}</td>
          <td>${escapeHtml(m.grasa_pct || "--")}</td><td>${escapeHtml(m.musculo_pct || "--")}</td><td>${escapeHtml(m.agua_pct || "--")}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>

    <div class="title-sec">Medidas y Clínicos</div>
    <table>
      <thead><tr>
        <th style="text-align:left">Fecha</th>
        <th>Cintura (cm)</th><th>Cadera (cm)</th><th>Glucosa</th><th>Colesterol</th><th>Presión</th>
      </tr></thead>
      <tbody>
        ${metricas
          .map(
            (m) => `<tr>
          <td class="date-col">${fmtDate(m.fecha)}</td>
          <td>${escapeHtml(m.cintura || "--")}</td><td>${escapeHtml(m.cadera || "--")}</td>
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
        <div style="margin-bottom:20px;">
          <div style="font-weight:700; font-size:14px; margin-bottom:10px; color:${dark};">📅 ${fmtDate(m.fecha)}</div>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            ${parseFotos(m.fotos)
              .map(
                (url) => `
              <div style="break-inside: avoid; page-break-inside: avoid;">
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
  </body></html>`;

  const cleanClient = String(cliente.nombre || "Paciente").replace(/[^a-zA-Z0-9_\-]/g, "_");
  openPdfPreviewModal({
    html,
    title: `Reporte de Progreso — ${cliente.nombre || "Paciente"}`,
    fileName: `Reporte_Progreso_${cleanClient}`,
    accent,
  });
};
