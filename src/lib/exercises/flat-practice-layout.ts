import { FIXED_CELL_PX, FIXED_CELL_GAP_PX } from "@/components/exercises/use-working-tile-layout";
import { CARD_PADDING_PX, COLUMN_GAP_PX } from "@/components/exercises/use-working-tile-layout";

// Сценова сторінка (letter_rearrangement/letter_gaps, флет/інлайн-картка
// "Робота над помилками" error-review-block.tsx, БЕЗ openMode) — "довгі"
// слова (що не влазять в один рядок ПОЛОВИНИ картки на десктопі й
// переносять свої плитки на другий рядок усередині картки — звичайна
// поведінка, як у сцена-вигляду блоків, тиловий col-span тут більше НЕ
// застосовується) сортуються в кінець списку, короткі — на початок,
// обидві групи у вихідному порядку. Порогове значення "довгого" слова —
// статична константа (НЕ useWorkingTileLayout's живий ResizeObserver),
// рахується один раз при імпорті з РЕАЛЬНИХ чисел верстки, задокументованих
// нижче, той самий принцип формули, що useWorkingTileLayout.perLineFor
// (use-working-tile-layout.ts), аби не розійтись із живим вимірюванням на
// реальних ширинах.
//
// Сценова сторінка (src/app/courses/[productId]/scenes/[sceneId]/page.tsx):
// <main className="mx-auto w-full max-w-3xl p-6"> — max-w-3xl = 768px,
// p-6 = 24px з кожного боку.
const SCENE_MAIN_MAX_WIDTH_PX = 768;
const SCENE_MAIN_PADDING_PX = 24;
// GlassBlock (glass-block.tsx) → .glass-block-panel (globals.css):
// padding: 22px 24px 24px — 24px зліва/справа.
const GLASS_PANEL_HORIZONTAL_PADDING_PX = 24;
// ErrorReviewCard, розгорнутий вміст (error-review-block.tsx): "border-t
// ... p-3" — 12px з кожного боку, між карткою-списком і самою вправою.
const ERROR_REVIEW_EXPANDED_PADDING_PX = 12;

// Ширина грід-обгортки карток (gridRef) усередині флет-блоку на десктопі —
// та сама величина, що useWorkingTileLayout міряв би ResizeObserver'ом
// живою, тут — підсумок усіх вкладених відступів вище над одним фіксованим
// max-w-3xl контейнером.
const FLAT_PRACTICE_GRID_WIDTH_PX =
  SCENE_MAIN_MAX_WIDTH_PX -
  2 * SCENE_MAIN_PADDING_PX -
  2 * GLASS_PANEL_HORIZONTAL_PADDING_PX -
  2 * ERROR_REVIEW_EXPANDED_PADDING_PX;
// = 768 - 48 - 48 - 24 = 648

// Внутрішня ширина ПОЛОВИНИ картки у двоколонковому режимі — та сама
// формула, що useWorkingTileLayout.halfCardInner.
const FLAT_PRACTICE_HALF_CARD_INNER_PX = (FLAT_PRACTICE_GRID_WIDTH_PX - COLUMN_GAP_PX) / 2 - CARD_PADDING_PX;
// = (648 - 12) / 2 - 28 = 318 - 28 = 290

const TILE_STEP_PX = FIXED_CELL_PX + FIXED_CELL_GAP_PX;

// Скільки плиток/клітинок влазить в один рядок половини картки на цій
// фіксованій ширині — та сама формула, що useWorkingTileLayout.perLineFor.
// = floor((290 + 3.4) / 35.4) = floor(8.288) = 8.
export const FLAT_PRACTICE_LONG_WORD_THRESHOLD = Math.max(
  1,
  Math.floor((FLAT_PRACTICE_HALF_CARD_INNER_PX + FIXED_CELL_GAP_PX) / TILE_STEP_PX)
);

export type FlatPracticeItemInput<Id> = { id: Id; length: number };
export type FlatPracticeLayoutItem<Id> = { id: Id; displayNumber: number; full: boolean };

// Скільки рядків плиток/клітинок потребує слово такої довжини (1 — "коротке",
// 2+ — "довге") — той самий поріг, що вище, лише як кількість рядків, не
// бінарний прапорець, бо задача "card pairing" розрізняє не просто
// коротке/довге, а РІЗНИЦЮ в рядках між непарним коротким і першим довгим
// (парується лише коли довге має РІВНО на 1 рядок більше, тобто 2 рядки —
// 3+ рядків різниця вже занадто велика, картки в парі виглядали б так само
// нерівномірно, як сама задача описує).
function lineCountFor(length: number): number {
  return Math.max(1, Math.ceil(length / FLAT_PRACTICE_LONG_WORD_THRESHOLD));
}

// Задача "card pairing in the 2-column grid" — раніше (layoutFlatPracticeItems,
// видалено) короткі й довгі просто йшли одним списком (короткі-спочатку,
// довгі-в-кінці) БЕЗ жодної пари/рядка-спану, тож непарна кількість
// коротких просто "перетікала" в один рядок сітки з ПЕРШИМ довгим —
// рівно той самий баг, що скріншот задачі показує (нерівні висоти рядка,
// великий порожній простір під короткою карткою, яку grid розтягнув до
// висоти довгого сусіда). Тепер — явне парування РЯДКАМИ:
// 1. короткі з короткими (у вихідному порядку кожної групи, стабільно);
// 2. довгі з довгими;
// 3. непарна коротка в кінці групи коротких ПАРУЄТЬСЯ з першим довгим
//    ЛИШЕ якщо різниця рядків <= 1 (1 рядок проти 2) — інакше йде сама,
//    на весь рядок (full:true), а довгі парується між собою як завжди;
// 4. непарна довга в кінці групи довгих — сама, на весь рядок.
// displayNumber — наскрізна нумерація В ЦЬОМУУ новому порядку рядків,
// 1-based; id (перевірка/збереження/API) лишається незмінним — порядок
// рендеру й видимі номери міняються, нічого більше.
export function pairPracticeItems<Id>(items: FlatPracticeItemInput<Id>[]): FlatPracticeLayoutItem<Id>[] {
  type Item = FlatPracticeItemInput<Id>;
  const shorts: Item[] = [];
  const longs: Item[] = [];
  for (const item of items) {
    (lineCountFor(item.length) === 1 ? shorts : longs).push(item);
  }

  const rows: { items: Item[]; full: boolean }[] = [];

  for (let i = 0; i + 1 < shorts.length; i += 2) {
    rows.push({ items: [shorts[i], shorts[i + 1]], full: false });
  }

  let remainingLongs = longs;
  if (shorts.length % 2 === 1) {
    const oddShort = shorts[shorts.length - 1];
    const firstLong = remainingLongs[0];
    if (firstLong && lineCountFor(firstLong.length) - 1 <= 1) {
      rows.push({ items: [oddShort, firstLong], full: false });
      remainingLongs = remainingLongs.slice(1);
    } else {
      rows.push({ items: [oddShort], full: true });
    }
  }

  for (let i = 0; i + 1 < remainingLongs.length; i += 2) {
    rows.push({ items: [remainingLongs[i], remainingLongs[i + 1]], full: false });
  }
  if (remainingLongs.length % 2 === 1) {
    rows.push({ items: [remainingLongs[remainingLongs.length - 1]], full: true });
  }

  const ordered: FlatPracticeLayoutItem<Id>[] = [];
  let n = 1;
  for (const row of rows) {
    for (const item of row.items) {
      ordered.push({ id: item.id, displayNumber: n++, full: row.full });
    }
  }
  return ordered;
}
