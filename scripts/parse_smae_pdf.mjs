import fs from "fs";
import { PDFParse } from "pdf-parse";

async function testScreenshot() {
  const filePath = "./smae5aed-anaberthaperezlizaur-230905053639-4cb3a022.pdf";
  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });

  try {
    console.log("Rendering page 16 with getScreenshot...");
    const result = await parser.getScreenshot({ partial: [16], desiredWidth: 1600 });
    console.log("Pages rendered:", result.pages.length);
    if (result.pages[0]?.data) {
      fs.writeFileSync("page16_screenshot.png", result.pages[0].data);
      console.log("Saved page16_screenshot.png, size:", result.pages[0].data.length);
    }
  } catch (e) {
    console.error("Screenshot error:", e);
  } finally {
    await parser.destroy();
  }
}

testScreenshot().catch(console.error);







