export const generateNutriPDF = (cliente, nutri, dias) => {
  const win = window.open("","_blank");
  if (!win) return;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Plan Nutricional - ${cliente.nombre}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#000;background:#fff;padding:30px;max-width:800px;margin:0 auto}
    .header{text-align:center;border-bottom:3px solid #2D9CDB;padding-bottom:20px;margin-bottom:24px}
    .logo-title{font-size:32px;font-weight:900;color:#05447A;letter-spacing:4px}
    .logo-sub{font-size:12px;color:#2D9CDB;letter-spacing:2px}
    .client-info{background:#f0f8ff;border-left:4px solid #2D9CDB;padding:12px 16px;border-radius:4px;margin-bottom:20px}
    .macros{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
    .macro-box{background:#05447A;color:white;border-radius:10px;padding:14px;text-align:center}
    .macro-val{font-size:24px;font-weight:900}
    .macro-lbl{font-size:11px;opacity:.8}
    .dia{margin-bottom:20px;page-break-inside:avoid}
    .dia-title{background:#2D9CDB;color:white;padding:8px 14px;border-radius:6px 6px 0 0;font-weight:700;font-size:15px}
    table{width:100%;border-collapse:collapse}
    th{background:#e8f4fd;padding:8px 10px;text-align:left;font-size:12px;color:#05447A}
    td{padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;vertical-align:top}
    .footer{text-align:center;margin-top:30px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:14px}
  </style></head><body>
  <div class="header"><div class="logo-title">FLUX</div><div class="logo-sub">- SPORT SUPPLEMENTS - KEEP GOING</div>
  <h2 style="color:#05447A;margin-top:10px;font-size:18px">Plan Nutricional Personalizado</h2></div>
  <div class="client-info"><strong style="font-size:16px">${cliente.nombre}</strong><br>
  <span style="color:#666;font-size:13px">Objetivo: ${cliente.objetivo||"—"}</span>
  <span style="float:right;color:#999;font-size:12px">${new Date().toLocaleDateString("es-MX",{year:"numeric",month:"long",day:"numeric"})}</span></div>
  ${nutri?`<div class="macros">
    <div class="macro-box"><div class="macro-val">${nutri.calorias}</div><div class="macro-lbl">Calorías (kcal)</div></div>
    <div class="macro-box"><div class="macro-val">${nutri.proteina}g</div><div class="macro-lbl">Proteína</div></div>
    <div class="macro-box"><div class="macro-val">${nutri.carbohidratos}g</div><div class="macro-lbl">Carbohidratos</div></div>
    <div class="macro-box"><div class="macro-val">${nutri.grasas}g</div><div class="macro-lbl">Grasas</div></div>
  </div>`:""}
  ${dias.map(d=>`<div class="dia"><div class="dia-title">${d.dia}</div>
  <table><thead><tr><th>Hora</th><th>Comida</th><th>Opción 1</th><th>Opción 2</th><th>Kcal</th><th>P/C/G</th></tr></thead>
  <tbody>${d.comidas.map(c=>`<tr><td>${c.hora||""}</td><td><strong>${c.nombre||""}</strong></td>
  <td>${c.opcion1||""}</td><td>${c.opcion2||""}</td>
  <td>${c.calorias||0}</td><td>${c.proteina||0}/${c.carbohidratos||0}/${c.grasas||0}g</td></tr>`).join("")}
  </tbody></table></div>`).join("")}
  <div class="footer">Plan generado por FLUX Sport Supplements · Keep Going 💪</div>
  </body></html>`;
  win.document.write(html); win.document.close(); setTimeout(()=>win.print(),500);
};
