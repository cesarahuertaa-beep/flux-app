import fs from 'fs';

let file = 'src/utils/pdf.js';
let content = fs.readFileSync(file, 'utf8');

const oldGlobalMacros = /\$\{nutri \? `<div class="macros">\s*<div class="macro-box"><div class="macro-val">\$\{escapeHtml\(nutri\.calorias\)\}<\/div><div class="macro-lbl">Calor.as \(kcal\)<\/div><\/div>\s*<div class="macro-box"><div class="macro-val">\$\{escapeHtml\(nutri\.proteina\)\}g<\/div><div class="macro-lbl">Prote.na<\/div><\/div>\s*<div class="macro-box"><div class="macro-val">\$\{escapeHtml\(nutri\.carbohidratos\)\}g<\/div><div class="macro-lbl">Carbohidratos<\/div><\/div>\s*<div class="macro-box"><div class="macro-val">\$\{escapeHtml\(nutri\.grasas\)\}g<\/div><div class="macro-lbl">Grasas<\/div><\/div>\s*<\/div>` : ""\}/;

content = content.replace(oldGlobalMacros, '');

const oldDiasMap = /\$\{dias\.map\(d => `<div class="dia"><div class="dia-title">\$\{escapeHtml\(d\.dia\)\}<\/div>\s*<table><thead><tr><th>Hora<\/th><th>Comida<\/th><th>Opci.n 1<\/th><th>Opci.n 2<\/th><th>Kcal<\/th><th>P\/C\/G<\/th><\/tr><\/thead>/;

const newDiasMap = `\${dias.map(d => {
    const sumKcal = d.comidas.reduce((s, m) => s + (Number(m.calorias) || 0), 0);
    const sumProt = d.comidas.reduce((s, m) => s + (Number(m.proteina) || 0), 0);
    const sumCarbs = d.comidas.reduce((s, m) => s + (Number(m.carbohidratos) || 0), 0);
    const sumGrasas = d.comidas.reduce((s, m) => s + (Number(m.grasas) || 0), 0);
    let macrosHtml = "";
    if (sumKcal || sumProt || sumCarbs || sumGrasas) {
      macrosHtml = \`<span style="float:right; font-size:12px; color:#555; font-weight:normal;">\${sumKcal} kcal &middot; \${sumProt}g P &middot; \${sumCarbs}g C &middot; \${sumGrasas}g G</span>\`;
    }
    return \`<div class="dia"><div class="dia-title">\${escapeHtml(d.dia)} \${macrosHtml}</div>
  <table><thead><tr><th>Hora</th><th>Comida</th><th>Opci&oacute;n 1</th><th>Opci&oacute;n 2</th><th>Kcal</th><th>P/C/G</th></tr></thead>\`;
  }).join("")}`;

// Wait, the `.join("")` in the original was at the very end of the `.map(d => ...)`.
// Since I am changing the function signature, I will replace the whole map.
const completeOldMap = /\$\{dias\.map\(d => `<div class="dia"><div class="dia-title">\$\{escapeHtml\(d\.dia\)\}<\/div>[\s\S]*?<\/tbody><\/table><\/div>`\)\.join\(""\)\}/;

const completeNewMap = `\${dias.map(d => {
    const sumKcal = d.comidas.reduce((s, m) => s + (Number(m.calorias) || 0), 0);
    const sumProt = d.comidas.reduce((s, m) => s + (Number(m.proteina) || 0), 0);
    const sumCarbs = d.comidas.reduce((s, m) => s + (Number(m.carbohidratos) || 0), 0);
    const sumGrasas = d.comidas.reduce((s, m) => s + (Number(m.grasas) || 0), 0);
    let macrosHtml = "";
    if (sumKcal || sumProt || sumCarbs || sumGrasas) {
      macrosHtml = \`<span style="float:right; font-size:12px; color:#555; font-weight:normal;">\${sumKcal} kcal &middot; \${sumProt}g P &middot; \${sumCarbs}g C &middot; \${sumGrasas}g G</span>\`;
    }
    return \`<div class="dia"><div class="dia-title">\${escapeHtml(d.dia)} \${macrosHtml}</div>
  <table><thead><tr><th>Hora</th><th>Comida</th><th>Opci&oacute;n 1</th><th>Opci&oacute;n 2</th><th>Kcal</th><th>P/C/G</th></tr></thead>
  <tbody>\${d.comidas.map(c => \`<tr><td>\${escapeHtml(c.hora)}</td><td><strong>\${escapeHtml(c.nombre)}</strong></td>
  <td>\${escapeHtml(c.opcion1)}</td><td>\${escapeHtml(c.opcion2)}</td>
  <td>\${escapeHtml(c.calorias||0)}</td><td>\${escapeHtml(c.proteina||0)}/\${escapeHtml(c.carbohidratos||0)}/\${escapeHtml(c.grasas||0)}g</td></tr>\`).join("")}
  </tbody></table></div>\`;
  }).join("")}`;

content = content.replace(completeOldMap, completeNewMap);

fs.writeFileSync(file, content);
