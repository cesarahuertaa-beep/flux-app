/**
 * Genera el SQL de carga inicial de los catálogos SMAE a partir de la semilla del repositorio.
 *   node --import ./scripts/register-ext-loader.mjs scripts/generate_smae_seed.mjs
 * Salida: supabase/scripts/seed_smae_alimentos.sql y supabase/scripts/seed_smae_platillos.sql
 * Los INSERT usan ON CONFLICT DO NOTHING: nunca pisan ediciones hechas desde la app.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { INGREDIENTES_CATALOGO } from "../src/lib/ingredientsCatalog.js";
import { RAW_PLATILLOS_SEED } from "../src/lib/seed/platillosSeed.js";
import { calculateSmaeTotals } from "../src/lib/smaeData.js";

const q = (s) => `'${String(s ?? "").replace(/'/g, "''")}'`;
const arr = (a) => `ARRAY[${(a || []).map(q).join(",")}]::text[]`;
const num = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);

const OUT = new URL("../supabase/scripts/", import.meta.url);
mkdirSync(OUT, { recursive: true });

// ── Alimentos ──────────────────────────────────────────────────────────────
const foods = INGREDIENTES_CATALOGO.map((f) => {
  const foto = String(f.foto || "").startsWith("data:") ? "" : f.foto || "";
  return `(${q(f.id)},${q(f.nombre)},${q(f.smaeGroup)},${num(f.cantidadBase, 1)},${q(f.unidadBase)},${num(f.gramosBase, 30)},${q(f.porcion1Eq)},${arr(f.dietTags)},${arr(f.keywords)},${q(foto)})`;
});
writeFileSync(
  new URL("seed_smae_alimentos.sql", OUT),
  `-- Semilla inicial de public.smae_alimentos (${foods.length} alimentos). Generado por scripts/generate_smae_seed.mjs\n` +
    `INSERT INTO public.smae_alimentos (id,nombre,grupo_smae,cantidad_base,unidad_base,gramos_base,porcion_1eq,tags_restriccion,keywords,foto) VALUES\n` +
    foods.join(",\n") +
    `\nON CONFLICT (id) DO NOTHING;\n`
);

// ── Platillos ──────────────────────────────────────────────────────────────
const dishes = RAW_PLATILLOS_SEED.map((d) => {
  const t = calculateSmaeTotals(d.smae_equivalentes || {});
  return `(${q(d.id)},${q(d.nombre)},${q(d.categoria)},${q(d.texto)},${q(d.foto_url)},${q(JSON.stringify(d.smae_equivalentes || {}))}::jsonb,${arr(d.tags_restriccion)},${arr(d.keywords)},${num(t.kcal)},${num(t.proteina)},${num(t.carbohidratos)},${num(t.grasas)})`;
});
writeFileSync(
  new URL("seed_smae_platillos.sql", OUT),
  `-- Semilla inicial de public.biblioteca_platillos (${dishes.length} platillos). Generado por scripts/generate_smae_seed.mjs\n` +
    `INSERT INTO public.biblioteca_platillos (id,nombre,categoria,texto,foto_url,smae_equivalentes,tags_restriccion,keywords,calorias,proteina,carbohidratos,grasas) VALUES\n` +
    dishes.join(",\n") +
    `\nON CONFLICT (id) DO NOTHING;\n`
);

console.log(`OK → ${foods.length} alimentos, ${dishes.length} platillos`);
