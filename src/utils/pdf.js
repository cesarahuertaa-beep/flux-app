import { escapeHtml, parseFotos } from "./helpers";

// Darkens a hex color by reducing RGB values
const darken = (hex, amt = 60) => {
  const n = parseInt((hex || "#2D9CDB").replace("#", ""), 16);
  const r = Math.max(0, (n >> 16) - amt);
  const g = Math.max(0, ((n >> 8) & 0xff) - amt);
  const b = Math.max(0, (n & 0xff) - amt);
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
};

// Creates a very light tint (mix with white) for backgrounds
const tint = (hex, amt = 230) => {
  const n = parseInt((hex || "#2D9CDB").replace("#", ""), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
};

/** Escapa una URL para uso seguro en atributos src */
const safeUrl = (url) => {
  if (!url) return "";
  // Solo permitir URLs http/https
  if (!/^https?:\/\//i.test(url)) return "";
  return escapeHtml(url);
};

export const generateNutriPDF = (cliente, nutri, dias, brand = {}) => {
  const accent  = brand.color_primario || "#2D9CDB";
  const dark    = darken(accent, 60);
  const light   = tint(accent, 210);
  const nombre  = escapeHtml(brand.nombre_marca || "FLUX Sport Supplements");
  const logoUrl = brand.logo_url && brand.logo_url !== "/flux_logo.jpeg" ? safeUrl(brand.logo_url) : null;

  const win = window.open("", "_blank");
  if (!win) return;

  const clienteNombre  = escapeHtml(cliente.nombre);
  const clienteObjetivo = escapeHtml(cliente.objetivo || "\u2014");
  const fechaHoy = new Date().toLocaleDateString("es-MX",{year:"numeric",month:"long",day:"numeric"});

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Plan Nutricional - ${clienteNombre}</title>
  <style>
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
    ${logoUrl
      ? `<img src="${logoUrl}" class="brand-logo" alt="${nombre}"/>`
      : `<div class="brand-name">${nombre}</div>`
    }
    <div class="brand-sub">Plan Nutricional Personalizado</div>
  </div>
  <div class="client-info"><strong style="font-size:16px">${clienteNombre}</strong><br>
  <span style="color:#666;font-size:13px">Objetivo: ${clienteObjetivo}</span>
  <span style="float:right;color:#999;font-size:12px">${fechaHoy}</span></div>
  ${nutri ? `<div class="macros">
    <div class="macro-box"><div class="macro-val">${escapeHtml(nutri.calorias)}</div><div class="macro-lbl">Calorías (kcal)</div></div>
    <div class="macro-box"><div class="macro-val">${escapeHtml(nutri.proteina)}g</div><div class="macro-lbl">Proteína</div></div>
    <div class="macro-box"><div class="macro-val">${escapeHtml(nutri.carbohidratos)}g</div><div class="macro-lbl">Carbohidratos</div></div>
    <div class="macro-box"><div class="macro-val">${escapeHtml(nutri.grasas)}g</div><div class="macro-lbl">Grasas</div></div>
  </div>` : ""}
  ${dias.map(d => `<div class="dia"><div class="dia-title">${escapeHtml(d.dia)}</div>
  <table><thead><tr><th>Hora</th><th>Comida</th><th>Opción 1</th><th>Opción 2</th><th>Kcal</th><th>P/C/G</th></tr></thead>
  <tbody>${d.comidas.map(c => `<tr><td>${escapeHtml(c.hora)}</td><td><strong>${escapeHtml(c.nombre)}</strong></td>
  <td>${escapeHtml(c.opcion1)}</td><td>${escapeHtml(c.opcion2)}</td>
  <td>${escapeHtml(c.calorias||0)}</td><td>${escapeHtml(c.proteina||0)}/${escapeHtml(c.carbohidratos||0)}/${escapeHtml(c.grasas||0)}g</td></tr>`).join("")}
  </tbody></table></div>`).join("")}
  <div class="footer">Plan generado por ${nombre} · Keep Going 💪</div>
  </body></html>`;

  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
};

export const generateProgresoPDF = (cliente, metricas, brand) => {
  if (!cliente) return;
  const win = window.open("", "_blank");
  if (!win) { alert("Por favor permite las ventanas emergentes (pop-ups) para generar el PDF."); return; }
  
  const logoUrl = brand?.logo_url && brand.logo_url !== "/flux_logo.jpeg" ? safeUrl(brand.logo_url) : null;
  const nombre  = escapeHtml(brand?.nombre_marca || "FLUX");
  const accent  = brand?.color_primario || "#38bdf8";
  const dark    = darken(accent, 60);
  const light   = tint(accent, 210);

  const fmtDate = d => new Date(d + "T12:00:00").toLocaleDateString("es-MX", { year:"numeric", month:"long", day:"numeric" });
  
  const latest = metricas.length > 0 ? metricas[0] : null;
  const clienteNombre = escapeHtml(cliente.nombre);
  const clienteObjetivo = escapeHtml(cliente.objetivo || "\u2014");
  const fechaHoy = new Date().toLocaleDateString("es-MX",{year:"numeric",month:"long",day:"numeric"});

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Progreso_${clienteNombre}</title>
  <style>
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

  ${latest ? `
    <div class="title-sec">Última Evaluación (${fmtDate(latest.fecha)})</div>
    <div class="macros">
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.peso||"--")}</div><div class="macro-lbl">Peso (kg)</div></div>
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.imc||"--")}</div><div class="macro-lbl">IMC</div></div>
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.grasa_pct||"--")}</div><div class="macro-lbl">Grasa (%)</div></div>
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.musculo_pct||"--")}</div><div class="macro-lbl">Músculo (%)</div></div>
    </div>
    <div class="macros" style="grid-template-columns:repeat(4,1fr);margin-bottom:30px">
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.agua_pct||"--")}</div><div class="macro-lbl">Agua (%)</div></div>
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.cintura||"--")}</div><div class="macro-lbl">Cintura (cm)</div></div>
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.glucosa||"--")}</div><div class="macro-lbl">Glucosa (mg/dL)</div></div>
      <div class="macro-box"><div class="macro-val">${escapeHtml(latest.presion_arterial||"--")}</div><div class="macro-lbl">Presión</div></div>
    </div>
  ` : `<div style="text-align:center;padding:40px;color:#999">No hay evaluaciones registradas aún.</div>`}

  ${metricas.length > 0 ? `
    <div class="title-sec">Composición Corporal</div>
    <table>
      <thead><tr>
        <th style="text-align:left">Fecha</th>
        <th>Peso (kg)</th><th>IMC</th><th>Grasa (%)</th><th>Músculo (%)</th><th>Agua (%)</th>
      </tr></thead>
      <tbody>
        ${metricas.map(m => `<tr>
          <td class="date-col">${fmtDate(m.fecha)}</td>
          <td>${escapeHtml(m.peso||"--")}</td><td>${escapeHtml(m.imc||"--")}</td>
          <td>${escapeHtml(m.grasa_pct||"--")}</td><td>${escapeHtml(m.musculo_pct||"--")}</td><td>${escapeHtml(m.agua_pct||"--")}</td>
        </tr>`).join("")}
      </tbody>
    </table>

    <div class="title-sec">Medidas y Clínicos</div>
    <table>
      <thead><tr>
        <th style="text-align:left">Fecha</th>
        <th>Cintura (cm)</th><th>Cadera (cm)</th><th>Glucosa</th><th>Colesterol</th><th>Presión</th>
      </tr></thead>
      <tbody>
        ${metricas.map(m => `<tr>
          <td class="date-col">${fmtDate(m.fecha)}</td>
          <td>${escapeHtml(m.cintura||"--")}</td><td>${escapeHtml(m.cadera||"--")}</td>
          <td>${escapeHtml(m.glucosa||"--")}</td><td>${escapeHtml(m.colesterol||"--")}</td><td>${escapeHtml(m.presion_arterial||"--")}</td>
        </tr>`).join("")}
      </tbody>
    </table>

    ${metricas.some(m => parseFotos(m.fotos).length > 0) ? `
      <div class="title-sec" style="margin-top:40px; border-top:1px solid #ddd; padding-top:30px;">Galería de Progreso</div>
      ${metricas.filter(m => parseFotos(m.fotos).length > 0).map(m => `
        <div style="margin-bottom:20px;">
          <div style="font-weight:700; font-size:14px; margin-bottom:10px; color:${dark};">📅 ${fmtDate(m.fecha)}</div>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            ${parseFotos(m.fotos).map(url => `
              <div style="break-inside: avoid; page-break-inside: avoid;">
                <img src="${safeUrl(url)}" style="max-width:280px; max-height:350px; width:auto; height:auto; display:block; border-radius:8px; border:1px solid #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.05);" alt="Foto progreso"/>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("")}
    ` : ""}
  ` : ""}

  <div class="footer">Reporte generado por ${nombre} · Keep Going 💪</div>
  
  <script>
    // Wait for all images to load before triggering print
    Promise.all(Array.from(document.images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => { img.onload = img.onerror = resolve; });
    })).then(() => {
      setTimeout(() => window.print(), 200);
    });
  </script>
  </body></html>`;

  win.document.write(html);
  win.document.close();
};
