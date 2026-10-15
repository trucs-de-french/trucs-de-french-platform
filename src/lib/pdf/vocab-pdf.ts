import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { firstVocabVariant, groupVocabByPartOfSpeech, type VocabItem } from "@/lib/vocab";
import { PART_OF_SPEECH_LABELS_FR, PART_OF_SPEECH_COLORS } from "@/lib/vocab-categories";
import { pluralizeWords } from "@/lib/pluralize-words";
import { categoryPalette, type CategoryPalette, type Rgb255 } from "@/lib/vocab-palette";

// PT Sans (OFL) — на відміну від стандартних PDF-шрифтів (Helvetica тощо),
// підтримує і кирилицю (переклад), і французьку латиницю з діакритикою.
// Lora/Nunito (шрифти сайту) НЕ мають файлів у репозиторії (next/font/google
// підвантажує їх під час збірки сайту, не як статичні .ttf) — PT Sans
// лишається найближчим наявним еквівалентом для ОБОХ ролей (слово/переклад),
// Regular і Bold замінюють відповідно 400/600 зі студентської таблиці.
// Ліцензія — src/lib/pdf/fonts/OFL.txt.
const FONTS_DIR = path.join(process.cwd(), "src/lib/pdf/fonts");

const PAGE_WIDTH = 595.28; // A4, pt
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const COL_GAP = 16;
const COL_WIDTH = (CONTENT_WIDTH - COL_GAP) / 2;
const COL_FR_X = MARGIN;
const COL_TR_X = MARGIN + COL_WIDTH + COL_GAP;

const FR_SIZE = 11;
const TR_SIZE = 10.5;
const ROW_PAD = 4;
const LINE_LEADING = 1.3;
const ROW_SEPARATOR_COLOR = hexToRgb01("#ececf3");
const TR_TEXT_COLOR = hexToRgb01("#6b6a80");
const FR_TEXT_COLOR = hexToRgb01("#1f1d3a");

const PILL_FONT_SIZE = 9;
const PILL_PAD_X = 8;
const PILL_HEIGHT = 14;
const PILL_RADIUS = PILL_HEIGHT / 2;
const PILL_LETTER_SPACING = 0.4;
const CATEGORY_LINE_THICKNESS = 1;
const CATEGORY_GAP_TOP = 18; // перед пігулкою НЕ першої категорії
const CATEGORY_GAP_BOTTOM = 7; // після пігулки, до першого рядка слів

const LEGEND_FONT_SIZE = 8;
const LEGEND_PAD_X = 7;
const LEGEND_CHIP_HEIGHT = 14;
const LEGEND_GAP_X = 6;
const LEGEND_GAP_Y = 6;
const LEGEND_BG_OPACITY = 0.14;

function hexToRgb01(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function rgb255To01(rgb255: Rgb255): [number, number, number] {
  return [rgb255[0] / 255, rgb255[1] / 255, rgb255[2] / 255];
}

async function loadFontBytes(filename: string) {
  return readFile(path.join(FONTS_DIR, filename));
}

// Заокруглений прямокутник (пігулка/чип) — SVG-шлях у локальних координатах
// (0,0) = верхній лівий кут, вісь Y вниз (звичайна SVG-умовність). pdf-lib
// сам інвертує Y під час малювання (drawSvgPath: scale(1,-1) після
// translate(x,y)) — переданий сюди (x,y) стає ВЕРХНІМ ЛІВИМ кутом
// прямокутника в PDF-координатах, перевірено рендером (render-check нижче).
function roundedRectPath(w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `M ${rr},0`,
    `H ${w - rr}`,
    `A ${rr},${rr} 0 0 1 ${w},${rr}`,
    `V ${h - rr}`,
    `A ${rr},${rr} 0 0 1 ${w - rr},${h}`,
    `H ${rr}`,
    `A ${rr},${rr} 0 0 1 0,${h - rr}`,
    `V ${rr}`,
    `A ${rr},${rr} 0 0 1 ${rr},0`,
    "Z",
  ].join(" ");
}

// Рядок тексту з ручним міжлітерним інтервалом (pdf-lib 1.17 не має
// характер-спейсингу в drawText) — лише для великих/жирних пігулок-
// заголовків категорій, де "letter-spacing: 0.07em" студентської сторінки
// помітний; переклад/слова нижче цього не потребують.
function spacedTextWidth(font: PDFFont, text: string, size: number, spacing: number): number {
  let width = 0;
  for (const ch of text) width += font.widthOfTextAtSize(ch, size) + spacing;
  return text.length > 0 ? width - spacing : 0;
}

function drawSpacedText(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb>; spacing: number }
) {
  let x = opts.x;
  for (const ch of text) {
    page.drawText(ch, { x, y: opts.y, size: opts.size, font: opts.font, color: opts.color });
    x += opts.font.widthOfTextAtSize(ch, opts.size) + opts.spacing;
  }
}

// Перенесення слів по словах у межах maxWidth — ТІЛЬКИ щоб ЗАЗДАЛЕГІДЬ
// дізнатись, скільки рядків (висоти) займе клітинка, перш ніж вирішувати,
// чи влізе рядок на поточну сторінку (ensureSpace нижче) — саме малювання
// рядків тексту робить окремий викли drawText на кожен елемент масиву.
function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
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

  function newPage() {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  // Переконується, що залишилось principal МІСЦЕ (у pt) до нижньої межі
  // (MARGIN) для наступного блоку — інакше починає нову сторінку. Рядки
  // НІКОЛИ не розрізаються між сторінками (кожен рядок перевіряється
  // цілою своєю висотою, перш ніж малюватись).
  function ensureSpace(height: number) {
    if (y - height < MARGIN) newPage();
  }

  function drawPillHeading(label: string, palette: CategoryPalette, count: number) {
    const upperLabel = label.toUpperCase();
    const textWidth = spacedTextWidth(bold, upperLabel, PILL_FONT_SIZE, PILL_LETTER_SPACING);
    const pillWidth = textWidth + PILL_PAD_X * 2;
    const pillTopY = y;
    const [pr, pg, pb] = rgb255To01(palette.pillRgb255);
    page.drawSvgPath(roundedRectPath(pillWidth, PILL_HEIGHT, PILL_RADIUS), {
      x: COL_FR_X,
      y: pillTopY,
      color: rgb(pr, pg, pb),
    });
    // Базова лінія тексту в пігулці — емпіричний відступ (0.27*size) від
    // верху, перевірений рендером (render-check нижче): видимо центрований
    // для PT Sans Bold на 9pt у боксі висотою 14pt.
    drawSpacedText(page, upperLabel, {
      x: COL_FR_X + PILL_PAD_X,
      y: pillTopY - PILL_HEIGHT / 2 - PILL_FONT_SIZE * 0.32,
      size: PILL_FONT_SIZE,
      font: bold,
      color: rgb(1, 1, 1),
      spacing: PILL_LETTER_SPACING,
    });

    // Лінія-"хвіст" від пігулки до правого краю колонки, тим самим
    // кольором категорії (твердий тонкий штрих — найближчий pdf-lib-
    // еквівалент градієнтної лінії студентської сторінки, pdf-lib 1.17
    // не вміє градієнтні штрихи/заливки).
    const lineStartX = COL_FR_X + pillWidth + 8;
    const [lr, lg, lb] = rgb255To01(palette.rgb255);
    const countLabel = `${count} ${pluralizeWords(count)}`;
    const countWidth = bold.widthOfTextAtSize(countLabel, PILL_FONT_SIZE);
    const lineEndX = PAGE_WIDTH - MARGIN - countWidth - 8;
    if (lineEndX > lineStartX) {
      page.drawLine({
        start: { x: lineStartX, y: pillTopY - PILL_HEIGHT / 2 },
        end: { x: lineEndX, y: pillTopY - PILL_HEIGHT / 2 },
        thickness: CATEGORY_LINE_THICKNESS,
        color: rgb(lr, lg, lb),
      });
    }

    const [tr, tg, tb] = rgb255To01(palette.textRgb255);
    page.drawText(countLabel, {
      x: PAGE_WIDTH - MARGIN - countWidth,
      y: pillTopY - PILL_HEIGHT / 2 - PILL_FONT_SIZE * 0.32,
      size: PILL_FONT_SIZE,
      font: bold,
      color: rgb(tr, tg, tb),
    });

    y -= PILL_HEIGHT;
  }

  function rowHeight(frLines: string[], trLines: string[]): number {
    const frHeight = frLines.length * FR_SIZE * LINE_LEADING;
    const trHeight = trLines.length * TR_SIZE * LINE_LEADING;
    return Math.max(frHeight, trHeight) + ROW_PAD * 2;
  }

  function drawRow(item: VocabItem, isLast: boolean) {
    const frLines = wrapText(bold, firstVocabVariant(item.word), FR_SIZE, COL_WIDTH);
    const trLines = wrapText(regular, item.translation, TR_SIZE, COL_WIDTH);
    const height = rowHeight(frLines, trLines);
    ensureSpace(height);

    const topY = y - ROW_PAD;
    frLines.forEach((line, i) => {
      page.drawText(line, {
        x: COL_FR_X,
        y: topY - (i + 1) * FR_SIZE * LINE_LEADING + FR_SIZE * (LINE_LEADING - 1),
        size: FR_SIZE,
        font: bold,
        color: rgb(...FR_TEXT_COLOR),
      });
    });
    trLines.forEach((line, i) => {
      page.drawText(line, {
        x: COL_TR_X,
        y: topY - (i + 1) * TR_SIZE * LINE_LEADING + TR_SIZE * (LINE_LEADING - 1),
        size: TR_SIZE,
        font: regular,
        color: rgb(...TR_TEXT_COLOR),
      });
    });

    y -= height;
    if (!isLast) {
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 0.5,
        color: rgb(...ROW_SEPARATOR_COLOR),
      });
    }
  }

  // --- Заголовок (без змін — лише слово-список нижче підлягає рестайлу) ---
  page.drawText(sceneTitle, { x: MARGIN, y, size: 16, font: bold });
  y -= 16 * 1.4;
  page.drawText("Словник", { x: MARGIN, y, size: 12, font: regular, color: rgb(0.45, 0.45, 0.45) });
  y -= 12 * 1.8;

  // --- Легенда — тоновані чипи, центровані, можуть переноситись на кілька
  // рядків (той самий порядок категорій, що на студентській сторінці; лише
  // категорії, присутні в groups нижче — порожні категорії не рендеряться,
  // той самий принцип, що студентська сторінка). ---
  const groups = groupVocabByPartOfSpeech(vocab);
  const legendEntries = groups
    .filter((g) => g.partOfSpeech !== null)
    .map((g) => {
      const pos = g.partOfSpeech!;
      const label = PART_OF_SPEECH_LABELS_FR[pos];
      const palette = categoryPalette(PART_OF_SPEECH_COLORS[pos].rgb);
      const width = regular.widthOfTextAtSize(label, LEGEND_FONT_SIZE) + LEGEND_PAD_X * 2;
      return { label, palette, width };
    });

  if (legendEntries.length > 0) {
    type LegendLine = typeof legendEntries;
    const lines: LegendLine[] = [];
    let current: LegendLine = [];
    let currentWidth = 0;
    for (const entry of legendEntries) {
      const addedWidth = current.length > 0 ? LEGEND_GAP_X + entry.width : entry.width;
      if (currentWidth + addedWidth > CONTENT_WIDTH && current.length > 0) {
        lines.push(current);
        current = [entry];
        currentWidth = entry.width;
      } else {
        current.push(entry);
        currentWidth += addedWidth;
      }
    }
    if (current.length > 0) lines.push(current);

    ensureSpace(lines.length * (LEGEND_CHIP_HEIGHT + LEGEND_GAP_Y));
    for (const line of lines) {
      const lineWidth = line.reduce((sum, e, i) => sum + e.width + (i > 0 ? LEGEND_GAP_X : 0), 0);
      let x = MARGIN + (CONTENT_WIDTH - lineWidth) / 2;
      const topY = y;
      for (const entry of line) {
        const [br, bg, bb] = rgb255To01(entry.palette.rgb255);
        page.drawRectangle({
          x,
          y: topY - LEGEND_CHIP_HEIGHT,
          width: entry.width,
          height: LEGEND_CHIP_HEIGHT,
          color: rgb(br, bg, bb),
          opacity: LEGEND_BG_OPACITY,
        });
        const [tr, tg, tb] = rgb255To01(entry.palette.textRgb255);
        page.drawText(entry.label, {
          x: x + LEGEND_PAD_X,
          y: topY - LEGEND_CHIP_HEIGHT / 2 - LEGEND_FONT_SIZE * 0.32,
          size: LEGEND_FONT_SIZE,
          font: regular,
          color: rgb(tr, tg, tb),
        });
        x += entry.width + LEGEND_GAP_X;
      }
      y -= LEGEND_CHIP_HEIGHT + LEGEND_GAP_Y;
    }
  }

  // --- Категорії та рядки слів (порядок/вміст — точно як groupVocabByPartOfSpeech,
  // та сама функція, що й студентська сторінка; порожні категорії вже
  // відфільтровані нею самою). ---
  groups.forEach((group, groupIndex) => {
    const label = group.partOfSpeech ? PART_OF_SPEECH_LABELS_FR[group.partOfSpeech] : "Інше";
    const palette = categoryPalette(group.partOfSpeech ? PART_OF_SPEECH_COLORS[group.partOfSpeech].rgb : [0.42, 0.447, 0.502]);

    // Пігулку категорії не лишаємо саму на дні сторінки — разом із нею
    // мають влізти хоча б перші 2 її рядки (інакше вся трійка переїжджає
    // на наступну сторінку).
    const previewRows = group.items.slice(0, 2);
    const previewHeight = previewRows.reduce(
      (sum, item) =>
        sum + rowHeight(wrapText(bold, firstVocabVariant(item.word), FR_SIZE, COL_WIDTH), wrapText(regular, item.translation, TR_SIZE, COL_WIDTH)),
      0
    );
    const neededWithHeading = (groupIndex > 0 ? CATEGORY_GAP_TOP : 0) + PILL_HEIGHT + CATEGORY_GAP_BOTTOM + previewHeight;
    ensureSpace(neededWithHeading);

    if (groupIndex > 0) y -= CATEGORY_GAP_TOP;
    drawPillHeading(label, palette, group.items.length);
    y -= CATEGORY_GAP_BOTTOM;

    group.items.forEach((item, i) => {
      drawRow(item, i === group.items.length - 1);
    });
  });

  return pdfDoc.save();
}
