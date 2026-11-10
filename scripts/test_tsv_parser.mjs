import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";
import fs from "fs";

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
    if (["taza", "pieza", "rebanada", "cucharada", "cucharadita"].includes(unit)) {
      if (val === 11) val = 1;
      if (val === 12) return { num: 0.5, label: "1/2" };
      if (val === 14) return { num: 0.25, label: "1/4" };
      if (val === 21) val = 2;
      if (val === 31) val = 3;
      if (val === 41) val = 4;
    }
    return { num: val, label: String(val) };
  }

  return { num: 1, label: "1" };
}

function cleanUnit(rawUnit) {
  const s = (rawUnit || "").toLowerCase().replace(/[^a-záéíóúñ]/g, "");
  if (!s) return "pieza";
  if (s.includes("taza") || s === "tza" || s === "teza") return "taza";
  if (s.includes("pieza") || s.includes("pza") || s === "pez") return "pieza";
  if (s.includes("gramo") || s === "g" || s === "gr") return "gramos";
  if (s.includes("cucharada") || s === "cda" || s === "cdas" || s === "ceda") return "cucharada";
  if (s.includes("cucharadita") || s === "cdita" || s === "cditas") return "cucharadita";
  if (s.includes("rebanada") || s.includes("reb")) return "rebanada";
  if (s.includes("sobre")) return "sobre";
  if (s.includes("lata")) return "lata";
  if (s.includes("vaso")) return "vaso";
  if (s.includes("hoja")) return "hoja";
  if (s.includes("bote")) return "bote";
  if (s.includes("barra")) return "barra";
  if (s.includes("paquete") || s.includes("paq")) return "paquete";
  if (s.includes("bolsa")) return "bolsa";
  if (s.includes("mitad")) return "mitad";
  if (s.includes("filete")) return "filete";
  if (s.includes("bistec")) return "bistec";
  if (s.includes("galleta")) return "galleta";
  if (s.includes("tortilla")) return "tortilla";
  if (s.includes("copa")) return "copa";
  if (s.includes("tarro")) return "tarro";
  return s;
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

function parseTSVPage(tsvText) {
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

    if (top < 525 || top > 1430) continue;
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

    const nameStr = nameWords.join(" ").replace(/^[^a-zA-ZáéíóúÁÉÍÓÚñÑ]+/, "").replace(/\s+/g, " ").trim();
    const qtyStr = qtyWords.join(" ").trim();
    const unitStr = unitWords.join(" ").trim();

    if (nameStr && !unitStr && !qtyStr && netoWords.length === 0 && brutoWords.length === 0 && parsedRows.length > 0) {
      const prev = parsedRows[parsedRows.length - 1];
      if (grp.top - prev.top < 55) {
        prev.nombre = `${prev.nombre} ${nameStr}`.replace(/\s+/g, " ").trim();
        continue;
      }
    }

    if (nameStr && nameStr.length >= 2 && (unitStr || qtyStr || netoWords.length > 0 || brutoWords.length > 0)) {
      const unitClean = cleanUnit(unitStr);
      const qObj = cleanQuantity(qtyStr, unitClean);
      const gramos = cleanWeight(brutoWords, netoWords);

      parsedRows.push({
        top: grp.top,
        nombre: nameStr,
        cantidad_base: qObj.num,
        unidad_base: unitClean,
        gramos_base: gramos,
        porcion_1eq: `${qObj.label} ${unitClean} (${gramos} g)`
      });
    }
  }

  return parsedRows;
}

async function verifyMultiPages() {
  const dataBuffer = fs.readFileSync("./smae5aed-anaberthaperezlizaur-230905053639-4cb3a022.pdf");
  const parser = new PDFParse({ data: dataBuffer });
  const worker = await createWorker("spa");

  for (const p of [133, 134, 135, 136, 137, 138]) {
    const t0 = Date.now();
    const screenshot = await parser.getScreenshot({ partial: [p], desiredWidth: 2000 });
    const imgBuffer = screenshot.pages[0].data;

    const res = await worker.recognize(
      imgBuffer,
      { rectangle: { top: 515, left: 45, width: 575, height: 930 } },
      { tsv: true }
    );
    const rows = parseTSVPage(res.data.tsv || "");
    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    console.log(`\n=== PAGE ${p} (${rows.length} alimentos extracted in ${elapsed}s) ===`);
    rows.slice(0, 8).forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.nombre.padEnd(32, " ")} -> ${r.porcion_1eq}`);
    });
  }

  await worker.terminate();
  await parser.destroy();
}

verifyMultiPages().catch(console.error);
