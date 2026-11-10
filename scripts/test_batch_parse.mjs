import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";
import fs from "fs";

// Helper to sanitize food names
function cleanFoodName(str) {
  return str
    .replace(/^[^a-zA-ZáéíóúÁÉÍÓÚñÑ]+/, "") // remove leading symbols
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[|—_]+$/, "")
    .trim();
}

// Helper to normalize quantity
function parseQuantity(str) {
  const s = str.trim().toLowerCase();
  if (s.includes("1/4") || s.includes("¼")) return 0.25;
  if (s.includes("1/3") || s.includes("⅓")) return 0.33;
  if (s.includes("1/2") || s.includes("½") || s.match(/\b12\b/)) return 0.5;
  if (s.includes("3/4") || s.includes("¾")) return 0.75;
  if (s.includes("1 1/2") || s.includes("1½")) return 1.5;
  if (s.includes("2 1/2") || s.includes("2½")) return 2.5;
  if (s.includes("3 1/2") || s.includes("3½")) return 3.5;
  const m = s.match(/^(\d+(?:\.\d+)?)/);
  if (m) return parseFloat(m[1]);
  return 1;
}

// Helper to normalize unit
function parseUnit(str) {
  const s = str.toLowerCase();
  if (s.includes("taza")) return "taza";
  if (s.includes("pieza") || s.includes("pza")) return "pieza";
  if (s.includes("gramo") || s.includes(" g") || s.endsWith("g")) return "g";
  if (s.includes("cda") || s.includes("cucharada")) return "cucharada";
  if (s.includes("cdita") || s.includes("cucharadita")) return "cucharadita";
  if (s.includes("rebanada") || s.includes("reb")) return "rebanada";
  if (s.includes("sobre")) return "sobre";
  if (s.includes("lata")) return "lata";
  if (s.includes("vaso")) return "vaso";
  if (s.includes("hoja")) return "hoja";
  if (s.includes("bote")) return "bote";
  if (s.includes("barra")) return "barra";
  return "ración";
}

// Auto-tag clinical restrictions
function inferTags(nombre, grupo) {
  const n = nombre.toLowerCase();
  const tags = new Set();
  
  if (grupo.startsWith("leche_") || /queso|leche|yoghurt|yogurt|crema|mantequilla|reques[oó]n/.test(n)) {
    tags.add("lacteos");
  }
  if ((grupo === "cereales_sg" || grupo === "cereales_cg") && /trigo|avena|cebada|centeno|pan|galleta|pasta|harina|gallet|spaghetti|cereal/.test(n)) {
    tags.add("gluten");
  }
  if (/camar[oó]n|pescado|at[uú]n|salm[oó]n|pulpo|marisco|cangrejo|almeja|trucha|mojarra|huachinango|robalo|sardina|calamar|jaiba|langosta|mejill[oó]n|ostra|surimi/.test(n)) {
    tags.add("mariscos");
  }
  if (/res|cerdo|ternera|chuleta|tocino|bistec|costilla|arrachera|carnitas|cecina|chorizo|longaniza|jam[oó]n|chicharr[oó]n|suadero|barbacoa/.test(n)) {
    tags.add("carne_roja");
  }
  if (/nuez|almendra|cacahuate|pistache|avellana|piñ[oó]n|pepita|ajonjol[ií]|ch[ií]a|semilla/.test(n)) {
    tags.add("nueces");
  }
  if (grupo.startsWith("aoa_")) {
    tags.add("animal_meat");
  }
  return Array.from(tags);
}

// Generate keywords
function generateKeywords(nombre, grupo) {
  const norm = nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const words = norm.split(/[^a-z0-9]+/).filter(w => w.length > 2);
  const set = new Set([...words, grupo]);
  return Array.from(set);
}

async function testSampleExtraction() {
  const dataBuffer = fs.readFileSync("./smae5aed-anaberthaperezlizaur-230905053639-4cb3a022.pdf");
  const parser = new PDFParse({ data: dataBuffer });
  const worker = await createWorker("spa");

  // Test page 16 (Verduras) and page 28 (Frutas)
  for (const p of [16, 28]) {
    console.log(`\n=================== TESTING PAGE ${p} ===================`);
    const screenshot = await parser.getScreenshot({ partial: [p], desiredWidth: 1600 });
    const imgBuffer = screenshot.pages[0].data;

    // Col 1: Alimento
    const colAlimento = await worker.recognize(imgBuffer, {
      rectangle: { top: 340, left: 50, width: 220, height: 750 }
    });
    // Col 2: Cantidad + Unidad
    const colPortion = await worker.recognize(imgBuffer, {
      rectangle: { top: 340, left: 260, width: 140, height: 750 }
    });
    // Col 3: Peso neto
    const colGramos = await worker.recognize(imgBuffer, {
      rectangle: { top: 340, left: 430, width: 60, height: 750 }
    });

    const alimentos = colAlimento.data.text
      .split("\n")
      .map(cleanFoodName)
      .filter(t => t.length > 2);

    const portions = colPortion.data.text
      .split("\n")
      .map(l => l.trim())
      .filter(t => t.length > 1);

    const gramos = colGramos.data.text
      .split("\n")
      .map(l => l.replace(/[^0-9]/g, ""))
      .filter(t => t.length > 0)
      .map(t => parseInt(t, 10));


    console.log(`Parsed: ${alimentos.length} alimentos, ${portions.length} portions, ${gramos.length} grams`);

    for (let i = 0; i < Math.min(alimentos.length, 5); i++) {
      const nom = alimentos[i];
      const rawPortion = portions[i] || "1 pieza";
      const q = parseQuantity(rawPortion);
      const u = parseUnit(rawPortion);
      const g = gramos[i] || 30;
      const grupo = p === 16 ? "verduras" : "frutas";
      const item = {
        id: "smae_" + nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
        nombre: nom,
        grupo_smae: grupo,
        cantidad_base: q,
        unidad_base: u,
        gramos_base: g,
        porcion_1eq: `${rawPortion.replace(/[|;]+/g, "").trim()} (${g} g)`,
        tags_restriccion: inferTags(nom, grupo),
        keywords: generateKeywords(nom, grupo)
      };
      console.log(`[Item ${i + 1}]`, JSON.stringify(item));
    }
  }

  await worker.terminate();
  await parser.destroy();
}

testSampleExtraction().catch(console.error);
