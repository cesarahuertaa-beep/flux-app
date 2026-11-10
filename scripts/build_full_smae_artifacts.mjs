import fs from "fs";

const raw = JSON.parse(fs.readFileSync("scripts/smae_5ta_edicion_extracted.json", "utf8"));
console.log(`Loaded ${raw.length} extracted foods.`);

// Valid official 16 groups
const VALID_GROUPS = new Set([
  "verduras", "frutas", "cereales_sg", "cereales_cg", "leguminosas",
  "aoa_mb", "aoa_b", "aoa_m", "aoa_a", "leche_d", "leche_sd", "leche_e",
  "grasas_sp", "grasas_cp", "azucares_sg", "libres"
]);

const cleaned = [];
for (const f of raw) {
  if (!f.nombre || f.nombre.length < 2) continue;
  if (!VALID_GROUPS.has(f.grupo_smae)) {
    console.warn(`Skipping invalid group ${f.grupo_smae} for ${f.nombre}`);
    continue;
  }
  cleaned.push({
    id: f.id,
    nombre: f.nombre,
    grupo_smae: f.grupo_smae,
    cantidad_base: Number(f.cantidad_base) || 1,
    unidad_base: f.unidad_base || "pieza",
    gramos_base: Math.round(Number(f.gramos_base) || 30),
    porcion_1eq: f.porcion_1eq || `${f.cantidad_base} ${f.unidad_base} (${f.gramos_base} g)`,
    tags_restriccion: Array.isArray(f.tags_restriccion) ? f.tags_restriccion : [],
    keywords: Array.isArray(f.keywords) ? f.keywords : [],
    foto: ""
  });
}

console.log(`Verified ${cleaned.length} valid SMAE foods.`);

// 1. Save to src/lib/seed/smaeFoodsComplete.json
fs.mkdirSync("src/lib/seed", { recursive: true });
fs.writeFileSync("src/lib/seed/smaeFoodsComplete.json", JSON.stringify(cleaned, null, 2));
console.log("Saved src/lib/seed/smaeFoodsComplete.json");

// 2. Generate supabase/scripts/seed_smae_alimentos.sql
const q = (s) => `'${String(s ?? "").replace(/'/g, "''")}'`;
const arr = (a) => `ARRAY[${(a || []).map(q).join(",")}]::text[]`;
const num = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);

const rowsSql = cleaned.map(f => {
  return `(${q(f.id)},${q(f.nombre)},${q(f.grupo_smae)},${num(f.cantidad_base, 1)},${q(f.unidad_base)},${num(f.gramos_base, 30)},${q(f.porcion_1eq)},${arr(f.tags_restriccion)},${arr(f.keywords)},${q(f.foto)})`;
});

// Write in batches of 500 rows for cleaner SQL editor execution
const batchSize = 500;
let sqlContent = `-- ============================================================================\n` +
  `-- FLUX · Catálogo Completo SMAE 5ª Edición (${cleaned.length} alimentos oficiales)\n` +
  `-- Fuente: Sistema Mexicano de Alimentos Equivalentes (5ª Edición Oficial)\n` +
  `-- Generado automáticamente con ON CONFLICT (id) DO UPDATE\n` +
  `-- ============================================================================\n\n`;

for (let i = 0; i < rowsSql.length; i += batchSize) {
  const batch = rowsSql.slice(i, i + batchSize);
  sqlContent += `INSERT INTO public.smae_alimentos (id,nombre,grupo_smae,cantidad_base,unidad_base,gramos_base,porcion_1eq,tags_restriccion,keywords,foto) VALUES\n` +
    batch.join(",\n") +
    `\nON CONFLICT (id) DO UPDATE SET\n` +
    `  nombre = EXCLUDED.nombre,\n` +
    `  grupo_smae = EXCLUDED.grupo_smae,\n` +
    `  cantidad_base = EXCLUDED.cantidad_base,\n` +
    `  unidad_base = EXCLUDED.unidad_base,\n` +
    `  gramos_base = EXCLUDED.gramos_base,\n` +
    `  porcion_1eq = EXCLUDED.porcion_1eq,\n` +
    `  tags_restriccion = EXCLUDED.tags_restriccion,\n` +
    `  keywords = EXCLUDED.keywords,\n` +
    `  updated_at = now();\n\n`;
}

fs.writeFileSync("supabase/scripts/seed_smae_alimentos.sql", sqlContent);
console.log(`Saved supabase/scripts/seed_smae_alimentos.sql (${(sqlContent.length / 1024).toFixed(1)} KB)`);
