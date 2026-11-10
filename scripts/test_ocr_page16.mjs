import { createWorker } from "tesseract.js";
import { PDFParse } from "pdf-parse";
import fs from "fs";

async function inspectPage16Structure() {
  const dataBuffer = fs.readFileSync("./smae5aed-anaberthaperezlizaur-230905053639-4cb3a022.pdf");
  const parser = new PDFParse({ data: dataBuffer });
  const screenshot = await parser.getScreenshot({ partial: [16], desiredWidth: 2000 });
  const imgBuffer = screenshot.pages[0].data;
  fs.writeFileSync("test_p16_2000.png", imgBuffer);

  const worker = await createWorker("spa");

  // Recognize the left columns (Alimento + Cantidad + Unidad + Peso Bruto + Peso Neto)
  // At width 2000: Height is ~1545
  // Let's check full page HOCR or left half HOCR
  const res = await worker.recognize(imgBuffer, {}, { text: true, hocr: true, tsv: true });
  fs.writeFileSync("test_p16_hocr.html", res.data.hocr || "");
  fs.writeFileSync("test_p16_tsv.txt", res.data.tsv || "");
  console.log("Saved test_p16_hocr.html and test_p16_tsv.txt");

  await worker.terminate();
  await parser.destroy();
}

inspectPage16Structure().catch(console.error);
