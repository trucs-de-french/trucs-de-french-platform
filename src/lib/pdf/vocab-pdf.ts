import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { VocabItem } from "@/lib/vocab";

// PT Sans (OFL) — на відміну від стандартних PDF-шрифтів (Helvetica тощо),
// підтримує і кирилицю (переклад), і французьку латиницю з діакритикою.
// Ліцензія — src/lib/pdf/fonts/OFL.txt.
const FONTS_DIR = path.join(process.cwd(), "src/lib/pdf/fonts");

const PAGE_WIDTH = 595.28; // A4, pt
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const ROW_HEIGHT = 22;
const COL_FR_X = MARGIN;
const COL_TR_X = MARGIN + 220;

async function loadFontBytes(filename: string) {
  return readFile(path.join(FONTS_DIR, filename));
}

export async function buildVocabPdf(vocab: VocabItem[], sceneTitle: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [regularBytes, boldBytes] = await Promise.all([
    loadFontBytes("PTSans-Regular.ttf"),
    loadFontBytes("PTSans-Bold.ttf"),
  ]);
  const regular = await pdfDoc.embedFont(regularBytes);
  const bold = await pdfDoc.embedFont(boldBytes);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function drawTableHeader() {
    page.drawText("Французька", { x: COL_FR_X, y, size: 12, font: bold });
    page.drawText("Переклад", { x: COL_TR_X, y, size: 12, font: bold });
    y -= ROW_HEIGHT * 0.7;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= ROW_HEIGHT * 0.6;
  }

  function startNewPage() {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    drawTableHeader();
  }

  page.drawText(sceneTitle, { x: MARGIN, y, size: 16, font: bold });
  y -= ROW_HEIGHT * 1.4;
  page.drawText("Словник", { x: MARGIN, y, size: 12, font: regular, color: rgb(0.45, 0.45, 0.45) });
  y -= ROW_HEIGHT * 1.6;

  drawTableHeader();

  for (const item of vocab) {
    if (y < MARGIN + ROW_HEIGHT) {
      startNewPage();
    }
    page.drawText(item.word, { x: COL_FR_X, y, size: 11, font: regular, maxWidth: 200 });
    page.drawText(item.translation, { x: COL_TR_X, y, size: 11, font: regular, maxWidth: 300 });
    y -= ROW_HEIGHT;
  }

  return pdfDoc.save();
}
