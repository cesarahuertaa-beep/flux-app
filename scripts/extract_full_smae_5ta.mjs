import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";
import fs from "fs";

function getSmaeGroupForPage(p) {
  if (p >= 16 && p <= 26) return "verduras";
  if (p >= 28 && p <= 41) return "frutas";
  if (p >= 44 && p <= 70) return "cereales_sg";
  if (p >= 71 && p <= 90) return "cereales_cg";
  if (p >= 92 && p <= 94) return "leguminosas";
  if (p >= 96 && p <= 109) return "aoa_mb";
  if (p >= 110 && p <= 117) return "aoa_b";
  if (p >= 118 && p <= 122) return "aoa_m";
  if (p >= 123 && p <= 131) return "aoa_a";
  if (p >= 134 && p <= 135) return "leche_d";
  if (p === 136) return "leche_sd";
  if (p >= 137 && p <= 143) return "leche_e";
  if (p >= 146 && p <= 154) return "grasas_sp";
  if (p >= 155 && p <= 161) return "grasas_cp";
  if (p >= 164 && p <= 188) return "azucares_sg";
  if ((p >= 190 && p <= 202) || p === 204) return "libres";
  return null;
}

function cleanFoodNameText(str) {
  let s = (str || "")
    .replace(/^[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ]+/, "")
    .replace(/[|—_«»""'']+/g, " ")
    // Clean OCR trademark artifacts (e.g. Kellogg'se -> Kellogg's, All-Bran0 -> All-Bran)
    .replace(/Kellogg's[e0O8]/gi, "Kellogg's")
    .replace(/Keloggs[80O]/gi, "Kellogg's")
    .replace(/All-Bran[0O8]/gi, "All-Bran")
    .replace(/Al-Bran[0O8]/gi, "All-Bran")
    .replace(/Danonino[0O8]/gi, "Danonino")
    .replace(/Activia[e0O8]/gi, "Activia")
    .replace(/Danone[G0O8]/gi, "Danone")
    .replace(/Splenda[0O8]/gi, "Splenda")
    .replace(/Canderel[0O8]/gi, "Canderel")
    .replace(/Yakult[0O8]/gi, "Yakult")
    .replace(/Liconsa Te Nutre[^\wáéíóúñ]*/gi, "Liconsa Te Nutre")
    .replace(/^Algar$/i, "Alga Nori")
    .replace(/^Aquayón/i, "Aguayón")
    .replace(/\bparabeber\b/gi, "para beber")
    .replace(/\bLechematemizada\b/gi, "Leche maternizada")
    .replace(/\bendulzaco\b/gi, "endulzado")
    .replace(/\s+/g, " ")
    .trim();

  // Strip trailing single symbol noise
  s = s.replace(/\s+[|\/\\=\-.:;]+$/, "").trim();
  return s;
}

function cleanQuantity(rawQty, unit) {
  let s = (rawQty || "").trim();
  if (/^121$/.test(s) || /^12$/.test(s)) return { num: 0.5, label: "1/2" };
  if (/^13$/.test(s) || /^131$/.test(s)) return { num: 0.33, label: "1/3" };
  if (/^14$/.test(s) || /^141$/.test(s)) return { num: 0.25, label: "1/4" };
  if (/^34$/.test(s) || /^341$/.test(s)) return { num: 0.75, label: "3/4" };

  const mixedMatch = s.match(/^([2-9])\s*1\/2/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    return { num: whole + 0.5, label: `${whole} 1/2` };
  }

  if (s.includes("1/4") || s.includes("¼")) return { num: 0.25, label: "1/4" };
  if (s.includes("1/3") || s.includes("⅓")) return { num: 0.33, label: "1/3" };
  if (s.includes("3/4") || s.includes("¾")) return { num: 0.75, label: "3/4" };
  if (s.includes("2/3")) return { num: 0.67, label: "2/3" };
  if (s.includes("1/5")) return { num: 0.2, label: "1/5" };
  if (s.includes("1/2") || s.includes("½")) {
    if (/^1\s+1\/2$/.test(s)) return { num: 1.5, label: "1 1/2" };
    return { num: 0.5, label: "1/2" };
  }

  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (m) {
    let val = parseFloat(m[1]);
    if (["taza", "pieza", "rebanada", "cucharada", "cucharadita", "envase", "sobre", "vaso"].includes(unit)) {
      if (val === 11) val = 1;
      if (val === 12) return { num: 0.5, label: "1/2" };
      if (val === 13) return { num: 0.33, label: "1/3" };
      if (val === 14) return { num: 0.25, label: "1/4" };
      if (val === 21) val = 2;
      if (val === 31) val = 3;
      if (val === 41) val = 4;
      if (val > 50 && unit !== "gramos" && unit !== "ml") val = 1;
    }
    return { num: val, label: String(val) };
  }

  return { num: 1, label: "1" };
}

function cleanUnit(rawUnit) {
  const s = (rawUnit || "").toLowerCase().replace(/[^a-záéíóúñ]/g, "");
  if (!s) return "pieza";
  if (s.includes("taza") || s === "tza" || s === "teza" || s === "tato") return "taza";
  if (s.includes("pieza") || s.includes("pza") || s === "pez" || s === "pzaa") return "pieza";
  if (s.includes("gramo") || s === "g" || s === "gr" || s === "grs" || s === "igramos") return "g";
  if (s.includes("mililitro") || s === "ml") return "ml";
  if (s.includes("cucharada") || s === "cda" || s === "cdas" || s === "ceda" || s === "eda" || s === "oda") return "cucharada";
  if (s.includes("cucharadita") || s === "cdita" || s === "cditas" || s === "edita" || s === "cdta") return "cucharadita";
  if (s.includes("rebanada") || s.includes("reb")) return "rebanada";
  if (s.includes("sobre")) return "sobre";
  if (s.includes("lata")) return "lata";
  if (s.includes("vaso")) return "vaso";
  if (s.includes("hoja")) return "hoja";
  if (s.includes("bote")) return "bote";
  if (s.includes("barra")) return "barra";
  if (s.includes("envase")) return "envase";
  if (s.includes("paquete") || s.includes("paq")) return "paquete";
  if (s.includes("bolsa")) return "bolsa";
  if (s.includes("mitad")) return "mitad";
  if (s.includes("filete")) return "filete";
  if (s.includes("bistec")) return "bistec";
  if (s.includes("galleta")) return "galleta";
  if (s.includes("tortilla")) return "tortilla";
  if (s.includes("copa")) return "copa";
  if (s.includes("tarro")) return "tarro";
  if (s.includes("bolita")) return "bolita";
  if (s.includes("cono")) return "cono";
  if (s.includes("paleta")) return "paleta";
  if (s.includes("porcion") || s.includes("porción") || s.includes("racion") || s.includes("ración")) return "ración";
  return s.length <= 12 ? s : "pieza";
}

function cleanWeight(brutoTokens, netoTokens) {
  const allTokens = [...brutoTokens, ...netoTokens]
    .flatMap(t => t.split(/[^0-9.]+/))
    .filter(Boolean);

  let candidate = allTokens.length > 0 ? allTokens[allTokens.length - 1] : "";

  if (/^(\d{2})\1$/.test(candidate)) {
    candidate = candidate.slice(0, 2);
  }
  if (/^1\d{3}$/.test(candidate) && parseInt(candidate, 10) > 600) {
    candidate = candidate.slice(1);
  }
  const num = parseFloat(candidate);
  if (!Number.isFinite(num) || num <= 0 || num > 600) {
    const first = parseFloat(allTokens[0]);
    if (Number.isFinite(first) && first > 0 && first <= 600) return Math.round(first);
    return 30;
  }
  return Math.round(num);
}

function inferTags(nombre, grupo) {
  const n = nombre.toLowerCase();
  const tags = new Set();

  if (grupo.startsWith("leche_") || /queso|leche|yoghurt|yogurt|crema|mantequilla|reques[oó]n|jocoque|panel|oaxaca|manchego|cheddar|suisse|yakult|soful|vitalinea|danon/.test(n)) {
    tags.add("lacteos");
  }
  if ((grupo === "cereales_sg" || grupo === "cereales_cg") && /trigo|avena|cebada|centeno|pan|galleta|pasta|harina|spaghetti|fideo|macarr[oó]n|cereal|bolillo|telera|cuernito|croissant|pastel|hot cake|waffle|bisquet|bagel|dona|churro|pretzel|barra/.test(n)) {
    if (!/sin gluten|ma[ií]z|arroz|amaranto|quinoa|papa|camote|yuca|elote|tortilla de ma[ií]z|tostada de ma[ií]z|totopo|palomitas/.test(n)) {
      tags.add("gluten");
    }
  }
  if (/camar[oó]n|pescado|at[uú]n|salm[oó]n|pulpo|marisco|cangrejo|almeja|trucha|mojarra|huachinango|robalo|sardina|calamar|jaiba|langosta|mejill[oó]n|ostra|ostión|abul[oó]n|surimi|bacalao|mero|sierra|charal|acocil|boquer[oó]n|anchova|anchoa/.test(n)) {
    tags.add("mariscos");
  }
  if (/\bres\b|cerdo|puerco|ternera|chuleta|tocino|bistec|costilla|arrachera|carnitas|cecina|chorizo|longaniza|jam[oó]n|chicharr[oó]n|suadero|barbacoa|carnero|borrego|cordero|cabrito|machaca|moronga|salchicha|alami|pepperoni|mortadela|pastel de carne|h[ií]gado de res|molleja/.test(n)) {
    tags.add("carne_roja");
  }
  if (/nuez|nueces|almendra|cacahuate|pistache|avellana|piñ[oó]n|pepita|ajonjol[ií]|ch[ií]a|semilla|macadamia|castaña|cashew|marañ[oó]n/.test(n)) {
    tags.add("nueces");
  }
  if (grupo.startsWith("aoa_")) {
    tags.add("animal_meat");
  }
  return Array.from(tags);
}

function generateKeywords(nombre, grupo) {
  const norm = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const words = norm.split(/[^a-z0-9]+/).filter(w => w.length > 2);
  const set = new Set([...words, grupo]);
  return Array.from(set);
}

function isHeaderOrNoise(name) {
  const n = name.toLowerCase();
  if (n.length < 2) return true;
  if (/^(alimento|cantidad|sugerida|unidad|peso|bruto|neto|energ[ií]a|prote[ií]na|l[ií]pidos|hidratos|fibra|sistema mexicano)$/i.test(n)) return true;
  // Must contain at least 2 letters
  const letters = n.replace(/[^a-záéíóúüñ]/gi, "");
  if (letters.length < 2) return true;
  return false;
}

function parseTSVPage(tsvText, grupoSmae, pageNum) {
  const lines = tsvText.split("\n");
  const lineGroups = new Map();

  for (const raw of lines) {
    if (!raw.trim()) continue;
    const cols = raw.split("\t");
    const level = parseInt(cols[0], 10);
    if (level !== 5) continue;

    const block = cols[2];
    const par = cols[3];
    const line = cols[4];
    const left = parseInt(cols[6], 10);
    const top = parseInt(cols[7], 10);
    const width = parseInt(cols[8], 10);
    const height = parseInt(cols[9], 10);
    const conf = parseFloat(cols[10]);
    const text = (cols[11] || "").trim();

    if (top < 520 || top > 1435) continue;
    if (left + width < 110 || left > 605) continue;
    if (!text || /^[|=—_\-.:;'"`~]+$/.test(text)) continue;

    const key = `${block}_${par}_${line}`;
    if (!lineGroups.has(key)) {
      lineGroups.set(key, { top, words: [] });
    }
    const grp = lineGroups.get(key);
    if (top < grp.top) grp.top = top;
    grp.words.push({ left, top, width, height, conf, text });
  }

  const sortedLines = Array.from(lineGroups.values()).sort((a, b) => a.top - b.top);
  const parsedRows = [];

  for (const grp of sortedLines) {
    grp.words.sort((a, b) => a.left - b.left);

    const nameWords = [];
    const qtyWords = [];
    const unitWords = [];
    const brutoWords = [];
    const netoWords = [];

    for (const w of grp.words) {
      const cleanW = w.text.replace(/^[|\[(\s—_«"']+|[|\])\s,;:._—»"']+$/g, "");
      if (!cleanW) continue;

      const center = w.left + w.width / 2;
      if (w.left < 328) {
        nameWords.push(cleanW);
      } else if (center < 398) {
        qtyWords.push(cleanW);
      } else if (center < 476) {
        unitWords.push(cleanW);
      } else if (center < 538) {
        brutoWords.push(cleanW);
      } else if (center <= 610) {
        netoWords.push(cleanW);
      }
    }

    const nameStr = cleanFoodNameText(nameWords.join(" "));
    const qtyStr = qtyWords.join(" ").trim();
    const unitStr = unitWords.join(" ").trim();

    if (nameStr && !unitStr && !qtyStr && netoWords.length === 0 && brutoWords.length === 0 && parsedRows.length > 0) {
      const prev = parsedRows[parsedRows.length - 1];
      if (grp.top - prev.top < 55) {
        prev.nombre = cleanFoodNameText(`${prev.nombre} ${nameStr}`);
        prev.porcion_1eq = `${prev.cantidad_label} ${prev.unidad_base === "g" ? "g" : prev.unidad_base} (${prev.gramos_base} g)`;
        continue;
      }
    }

    if (nameStr && !isHeaderOrNoise(nameStr) && (unitStr || qtyStr || netoWords.length > 0 || brutoWords.length > 0)) {
      const unitClean = cleanUnit(unitStr);
      const qObj = cleanQuantity(qtyStr, unitClean);
      const gramos = cleanWeight(brutoWords, netoWords);
      const porcionStr = unitClean === "g"
        ? `${gramos} g`
        : `${qObj.label} ${unitClean} (${gramos} g)`;

      parsedRows.push({
        top: grp.top,
        page: pageNum,
        nombre: nameStr,
        grupo_smae: grupoSmae,
        cantidad_base: qObj.num,
        cantidad_label: qObj.label,
        unidad_base: unitClean,
        gramos_base: gramos,
        porcion_1eq: porcionStr
      });
    }
  }

  return parsedRows;
}

async function runFullExtraction() {
  const tStart = Date.now();
  const dataBuffer = fs.readFileSync("./smae5aed-anaberthaperezlizaur-230905053639-4cb3a022.pdf");
  const parser = new PDFParse({ data: dataBuffer });

  // Collect all content pages
  const targetPages = [];
  for (let p = 16; p <= 204; p++) {
    const grp = getSmaeGroupForPage(p);
    if (grp) targetPages.push({ page: p, group: grp });
  }

  console.log(`Starting extraction of ${targetPages.length} table pages with 3 parallel OCR workers...`);
  const worker1 = await createWorker("spa");
  const worker2 = await createWorker("spa");
  const worker3 = await createWorker("spa");

  const resultsByPage = new Map();
  let completed = 0;

  // Serialize getScreenshot calls on parser to avoid ArrayBuffer transfer race conditions
  let screenshotChain = Promise.resolve();
  function safeGetScreenshot(pageNum) {
    const next = screenshotChain.then(async () => {
      const screenshot = await parser.getScreenshot({ partial: [pageNum], desiredWidth: 2000 });
      return Buffer.from(screenshot.pages[0].data);
    });
    screenshotChain = next.catch(() => {});
    return next;
  }

  async function processQueue(worker, queue) {
    for (const item of queue) {
      try {
        const imgBuffer = await safeGetScreenshot(item.page);
        const res = await worker.recognize(
          imgBuffer,
          { rectangle: { top: 515, left: 45, width: 575, height: 930 } },
          { tsv: true }
        );
        const rows = parseTSVPage(res.data.tsv || "", item.group, item.page);
        resultsByPage.set(item.page, rows);
      } catch (err) {
        console.error(`Error on page ${item.page}:`, err.message);
        resultsByPage.set(item.page, []);
      }
      completed++;
      if (completed % 15 === 0 || completed === targetPages.length) {
        const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
        console.log(`Progress: ${completed}/${targetPages.length} pages (${elapsed}s)...`);
      }
    }
  }

  const q1 = targetPages.filter((_, idx) => idx % 3 === 0);
  const q2 = targetPages.filter((_, idx) => idx % 3 === 1);
  const q3 = targetPages.filter((_, idx) => idx % 3 === 2);

  await Promise.all([
    processQueue(worker1, q1),
    processQueue(worker2, q2),
    processQueue(worker3, q3)
  ]);

  await worker1.terminate();
  await worker2.terminate();
  await worker3.terminate();
  await parser.destroy();


  // Flatten in page order and build final catalog with unique IDs
  const allFoods = [];
  const usedIds = new Set();

  for (const item of targetPages) {
    const pageRows = resultsByPage.get(item.page) || [];
    for (const r of pageRows) {
      if (isHeaderOrNoise(r.nombre)) continue;

      let baseSlug = r.nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 55);

      if (!baseSlug) continue;

      let id = `smae_${baseSlug}`;
      if (usedIds.has(id)) {
        id = `smae_${baseSlug}_${r.grupo_smae}`;
      }
      let counter = 2;
      while (usedIds.has(id)) {
        id = `smae_${baseSlug}_${counter}`;
        counter++;
      }
      usedIds.add(id);

      allFoods.push({
        id,
        nombre: r.nombre,
        grupo_smae: r.grupo_smae,
        cantidad_base: r.cantidad_base,
        unidad_base: r.unidad_base,
        gramos_base: r.gramos_base,
        porcion_1eq: r.porcion_1eq,
        tags_restriccion: inferTags(r.nombre, r.grupo_smae),
        keywords: generateKeywords(r.nombre, r.grupo_smae),
        foto: ""
      });
    }
  }

  fs.writeFileSync("scripts/smae_5ta_edicion_extracted.json", JSON.stringify(allFoods, null, 2));
  const totalSec = ((Date.now() - tStart) / 1000).toFixed(1);
  console.log(`\nDONE! Extracted ${allFoods.length} official foods in ${totalSec}s -> scripts/smae_5ta_edicion_extracted.json`);

  // Print count per group
  const byGroup = {};
  for (const f of allFoods) {
    byGroup[f.grupo_smae] = (byGroup[f.grupo_smae] || 0) + 1;
  }
  console.log("Breakdown by SMAE group:", byGroup);
}

runFullExtraction().catch(console.error);
