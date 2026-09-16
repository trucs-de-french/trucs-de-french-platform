import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  firstVocabVariant,
  groupVocabByPartOfSpeech,
  PART_OF_SPEECH_ORDER,
  PART_OF_SPEECH_LABELS_FR,
  PART_OF_SPEECH_COLORS,
  type VocabItem,
} from "@/lib/vocab";

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
const DOT_SIZE = 7;

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

  function ensureSpace(rowsNeeded: number) {
    if (y < MARGIN + ROW_HEIGHT * rowsNeeded) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      drawTableHeader();
    }
  }

  // Кольоровий квадратик — той самий колір, що крапка на студентській
  // сторінці (PART_OF_SPEECH_COLORS.rgb), лише як маленький прямокутник:
  // pdf-lib не читає CSS/Tailwind, потрібне явне число 0–1 на канал.
  function drawColorDot(rgbColor: [number, number, number]) {
    page.drawRectangle({
      x: COL_FR_X,
      y: y + 2,
      width: DOT_SIZE,
      height: DOT_SIZE,
      color: rgb(...rgbColor),
    });
  }

  page.drawText(sceneTitle, { x: MARGIN, y, size: 16, font: bold });
  y -= ROW_HEIGHT * 1.4;
  page.drawText("Словник", { x: MARGIN, y, size: 12, font: regular, color: rgb(0.45, 0.45, 0.45) });
  y -= ROW_HEIGHT * 1.6;

  drawTableHeader();

  const groups = groupVocabByPartOfSpeech(vocab);
  for (const group of groups) {
    ensureSpace(2);
    const label = group.partOfSpeech ? PART_OF_SPEECH_LABELS_FR[group.partOfSpeech] : "Інше";
    if (group.partOfSpeech) {
      drawColorDot(PART_OF_SPEECH_COLORS[group.partOfSpeech].rgb);
      page.drawText(label, { x: COL_FR_X + DOT_SIZE + 5, y, size: 11, font: bold });
    } else {
      page.drawText(label, { x: COL_FR_X, y, size: 11, font: bold });
    }
    y -= ROW_HEIGHT * 0.9;

    for (const item of group.items) {
      ensureSpace(1);
      if (group.partOfSpeech) {
        drawColorDot(PART_OF_SPEECH_COLORS[group.partOfSpeech].rgb);
        page.drawText(firstVocabVariant(item.word), {
          x: COL_FR_X + DOT_SIZE + 5,
          y,
          size: 11,
          font: regular,
          maxWidth: 200 - DOT_SIZE - 5,
        });
      } else {
        page.drawText(firstVocabVariant(item.word), { x: COL_FR_X, y, size: 11, font: regular, maxWidth: 200 });
      }
      page.drawText(item.translation, { x: COL_TR_X, y, size: 11, font: regular, maxWidth: 300 });
      y -= ROW_HEIGHT;
    }
    y -= ROW_HEIGHT * 0.4;
  }

  // Легенда — в кінці документа (простіше структурно, ніж резервувати місце
  // зверху наперед): по колонці кольоровий квадратик + назва категорії.
  ensureSpace(PART_OF_SPEECH_ORDER.length + 1);
  y -= ROW_HEIGHT * 0.3;
  page.drawText("Позначення:", { x: MARGIN, y, size: 10, font: bold, color: rgb(0.45, 0.45, 0.45) });
  y -= ROW_HEIGHT * 0.8;
  for (const pos of PART_OF_SPEECH_ORDER) {
    ensureSpace(1);
    drawColorDot(PART_OF_SPEECH_COLORS[pos].rgb);
    page.drawText(PART_OF_SPEECH_LABELS_FR[pos], {
      x: COL_FR_X + DOT_SIZE + 5,
      y,
      size: 9,
      font: regular,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= ROW_HEIGHT * 0.65;
  }

  return pdfDoc.save();
}
