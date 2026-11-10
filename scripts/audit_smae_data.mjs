import fs from "fs";

const raw = JSON.parse(fs.readFileSync("scripts/smae_5ta_edicion_extracted.json", "utf8"));

console.log("=== AUDITORÍA DEL CATÁLOGO EXTRAÍDO ===");
console.log(`Total registros extraídos: ${raw.length}`);

// 1. Nombres extremadamente cortos o sospechosos (ruido OCR)
const noiseItems = raw.filter(x => {
  const n = x.nombre.trim();
  if (n.length < 4) return true;
  // Solo letras sueltas tipo "a A", "a É L"
  if (/^[a-záéíóúüñ\s]{1,4}$/i.test(n) && n.split(/\s+/).every(w => w.length <= 2)) return true;
  // Sin vocales
  if (!/[aeiouáéíóú]/i.test(n)) return true;
  return false;
});

console.log(`\n1. Elementos detectados como ruido OCR (< 4 letras o letras sueltas): ${noiseItems.length}`);
console.log("Muestra de elementos de ruido:", noiseItems.slice(0, 20).map(x => `"${x.nombre}" (${x.grupo_smae})`));

// 2. Gramos base sospechosos o en 30 por defecto
const defaultGrams = raw.filter(x => x.gramos_base === 30 && !x.porcion_1eq.includes("30 g"));
console.log(`\n2. Elementos con gramaje en 30 por defecto: ${defaultGrams.length}`);

// 3. Revisar porción con texto mal formateado o ración sin unidad clara
const defaultPieces = raw.filter(x => x.unidad_base === "ración" || x.unidad_base === "pieza" && !x.porcion_1eq.includes("pieza"));
console.log(`\n3. Elementos con unidad ambigua: ${defaultPieces.length}`);

// 4. Buscar duplicados de nombre dentro del mismo grupo
const byGroup = {};
const duplicates = [];
for (const f of raw) {
  const k = `${f.grupo_smae}__${f.nombre.toLowerCase().trim()}`;
  if (byGroup[k]) {
    duplicates.push(f);
  } else {
    byGroup[k] = true;
  }
}
console.log(`\n4. Nombres duplicados dentro del mismo grupo: ${duplicates.length}`);

// 5. Total de alimentos limpios reales estimados
const cleanFoods = raw.filter(x => {
  const n = x.nombre.trim();
  if (n.length < 4) return false;
  if (/^[a-záéíóúüñ\s]{1,4}$/i.test(n) && n.split(/\s+/).every(w => w.length <= 2)) return false;
  if (!/[aeiouáéíóú]/i.test(n)) return false;
  return true;
});
console.log(`\n5. Alimentos limpios y válidos reales: ${cleanFoods.length}`);
