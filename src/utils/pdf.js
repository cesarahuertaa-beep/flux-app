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

export const generateNutriPDF = (cliente, nutri, dias, brand = {}) => {
  const accent  = brand.color_primario || "#2D9CDB";
  const dark    = darken(accent, 60);
  const light   = tint(accent, 210);
  const nombre  = brand.nombre_marca  || "FLUX Sport Supplements";
  const logoUrl = brand.logo_url && brand.logo_url !== "/logo.png" ? brand.logo_url : null;

  const win = window.open("", "_blank");
  if (!win) return;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Plan Nutricional - ${cliente.nombre}</title>
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
  <div class="client-info"><strong style="font-size:16px">${cliente.nombre}</strong><br>
  <span style="color:#666;font-size:13px">Objetivo: ${cliente.objetivo||"\u2014"}</span>
  <span style="float:right;color:#999;font-size:12px">${new Date().toLocaleDateString("es-MX",{year:"numeric",month:"long",day:"numeric"})}</span></div>
  ${nutri ? `<div class="macros">
    <div class="macro-box"><div class="macro-val">${nutri.calorias}</div><div class="macro-lbl">Calorías (kcal)</div></div>
    <div class="macro-box"><div class="macro-val">${nutri.proteina}g</div><div class="macro-lbl">Proteína</div></div>
    <div class="macro-box"><div class="macro-val">${nutri.carbohidratos}g</div><div class="macro-lbl">Carbohidratos</div></div>
    <div class="macro-box"><div class="macro-val">${nutri.grasas}g</div><div class="macro-lbl">Grasas</div></div>
  </div>` : ""}
  ${dias.map(d => `<div class="dia"><div class="dia-title">${d.dia}</div>
  <table><thead><tr><th>Hora</th><th>Comida</th><th>Opción 1</th><th>Opción 2</th><th>Kcal</th><th>P/C/G</th></tr></thead>
  <tbody>${d.comidas.map(c => `<tr><td>${c.hora||""}</td><td><strong>${c.nombre||""}</strong></td>
  <td>${c.opcion1||""}</td><td>${c.opcion2||""}</td>
  <td>${c.calorias||0}</td><td>${c.proteina||0}/${c.carbohidratos||0}/${c.grasas||0}g</td></tr>`).join("")}
  </tbody></table></div>`).join("")}
  <div class="footer">Plan generado por ${nombre} · Keep Going 💪</div>
  </body></html>`;

  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
};
