import fs from "fs";

const raw = JSON.parse(fs.readFileSync("scripts/smae_5ta_edicion_extracted.json", "utf8"));

// 1. Detección de ruido
function isNoise(item) {
  const n = item.nombre.trim();
  const words = n.split(/\s+/);
  if (words.every(w => w.length <= 2) && words.length <= 3) {
    if (n.toLowerCase() === "té" || n.toLowerCase() === "te") return false;
    return true;
  }
  if (!/[aeiouáéíóú]/i.test(n)) return true;
  if (/^[a-z]\s+[A-Z]/i.test(n) && words[0].length === 1 && words[1].length <= 2) return true;
  if (/^(tabla|página|edición|sistema|equivalente|grupo|alimentos|subgrupo)$/i.test(n)) return true;
  return false;
}

// 2. Normalización de unidades
function normalizeUnit(unit, foodName) {
  const u = (unit || "").toLowerCase().trim();
  if (!u) return "pieza";

  // Mapeos conocidos de errores OCR
  if (["edia", "vedia", "feda", "edila", "cdila", "cdia", "ecda", "odia", "redia"].includes(u)) {
    return "cucharadita";
  }
  if (["red", "rep", "reo", "ren", "re"].includes(u)) {
    return "rebanada";
  }
  if (u === "mi") {
    return "ml";
  }
  if (["boslach", "bosach", "iboslach", "bosa", "ibosiach"].includes(u)) {
    return "bolsa";
  }
  if (["taa", "laza"].includes(u)) {
    return "taza";
  }
  if (u === "bara") {
    return "barra";
  }
  if (["ramos", "eramos", "gros", "armo"].includes(u)) {
    return "g";
  }
  if (["dsp", "dsps"].includes(u)) {
    return "disparo";
  }
  if (["cápeul", "cápsulat"].includes(u)) {
    return "cápsula";
  }
  if (["leta", "cata"].includes(u)) {
    return "lata";
  }
  if (["orejón", "orejones"].includes(u)) {
    return "pieza";
  }

  const validUnits = [
    "pieza", "g", "taza", "cucharada", "cucharadita", "rebanada", "lata", "sobre",
    "bolsa", "frasco", "envase", "paquete", "barra", "bolsita", "ml", "bote",
    "hoja", "galleta", "filete", "mitad", "tubo", "raja", "cápsula", "copa", "disparo", "ración"
  ];

  if (validUnits.includes(u)) return u;
  return "pieza";
}

function formatQtyLabel(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return "1";
  if (Math.abs(n - 0.5) < 0.05) return "1/2";
  if (Math.abs(n - 0.25) < 0.05) return "1/4";
  if (Math.abs(n - 0.33) < 0.05) return "1/3";
  if (Math.abs(n - 0.67) < 0.05) return "2/3";
  if (Math.abs(n - 0.75) < 0.05) return "3/4";
  if (Math.abs(n - 1.5) < 0.05) return "1 1/2";
  if (Math.abs(n - 2.5) < 0.05) return "2 1/2";
  return String(n);
}

// 3. Limpiar y reconstruir
const cleaned = [];
const discarded = [];

for (const item of raw) {
  if (isNoise(item)) {
    discarded.push(item);
    continue;
  }

  const cleanU = normalizeUnit(item.unidad_base, item.nombre);
  let gramos = item.gramos_base;
  if (!gramos || gramos <= 0) gramos = 30;

  const qtyLabel = formatQtyLabel(item.cantidad_base);

  // Reconstruir porcion_1eq limpia
  let porcion = "";
  if (cleanU === "g") {
    porcion = `${gramos} g`;
  } else if (cleanU === "ml") {
    porcion = `${qtyLabel} ml`;
  } else {
    porcion = `${qtyLabel} ${cleanU} (${gramos} g)`;
  }

  cleaned.push({
    ...item,
    unidad_base: cleanU,
    gramos_base: gramos,
    porcion_1eq: porcion
  });
}

console.log("Total originales:", raw.length);
console.log("Descartados (ruido OCR):", discarded.length);
console.log("Limpios finales:", cleaned.length);

fs.writeFileSync("scripts/smae_5ta_edicion_extracted.json", JSON.stringify(cleaned, null, 2), "utf8");
fs.writeFileSync("src/lib/seed/smaeFoodsComplete.json", JSON.stringify(cleaned, null, 2), "utf8");
console.log("Archivos JSON actualizados con éxito!");
