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
export type FlatPracticeLayoutItem<Id> = { id: Id; displayNumber: number };

// Слово "довге" (не влазить в один рядок половини картки на десктопі) —
// length (кількість плиток letter_rearrangement / кількість символів
// chars.length letter_gaps, включно з видимими літерами) понад порогове
// значення вище. Короткі — спочатку, у вихідному порядку; довгі — в кінці,
// теж у вихідному порядку (Array.prototype.filter гарантовано стабільний,
// жодного явного сортування не потрібно), в ОДНІЙ і тій самій сітці —
// жодного col-span: непарна кількість коротких одразу продовжується
// першим довгим в тому самому рядку, без порожньої клітинки. Номери карток
// (displayNumber) рахуються заново в цьому відображуваному порядку,
// 1-based — id (використовується для перевірки/збереження/API) лишається
// незмінним.
export function layoutFlatPracticeItems<Id>(items: FlatPracticeItemInput<Id>[]): FlatPracticeLayoutItem<Id>[] {
  const isLong = (item: FlatPracticeItemInput<Id>) => item.length > FLAT_PRACTICE_LONG_WORD_THRESHOLD;
  const ordered = [...items.filter((item) => !isLong(item)), ...items.filter(isLong)];
  return ordered.map((item, i) => ({ id: item.id, displayNumber: i + 1 }));
}
