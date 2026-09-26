import type { WordSearchPlacement, WordSearchWord } from "./types";
import { sanitizeWordForGrid } from "./grid-word";

// Лише два вектори — горизонталь праворуч і вертикаль вниз (без діагоналей
// і без реверсу) — точно за описом фічі.
const DIRECTIONS: { row: number; col: number; name: WordSearchPlacement["direction"] }[] = [
  { row: 0, col: 1, name: "horizontal" },
  { row: 1, col: 0, name: "vertical" },
];

const FILLER_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomFiller(): string {
  return FILLER_LETTERS[Math.floor(Math.random() * FILLER_LETTERS.length)];
}

// Розмір — похідний від найдовшого слова й сумарної кількості літер, а не
// фіксований, щоб короткий список не тонув у зайво великій сітці, а
// довгий/об'ємний — не змушував без кінця повторювати спроби розміщення.
// Мінімум 10, про всяк випадок для геть куценьких списків.
function computeGridSize(words: string[]): number {
  const longest = Math.max(0, ...words.map((w) => w.length));
  const totalLetters = words.reduce((sum, w) => sum + w.length, 0);
  return Math.max(10, longest, Math.ceil(Math.sqrt(totalLetters * 2.5)));
}

// Викликається ОДИН РАЗ в адмінці (word-search-fields.tsx), не на кожен
// рендер студентської сторінки — див. коментар при WordSearchConfig у
// types.ts щодо того, чому це принципово (провал розміщення має бути
// видимим вчительці одразу, а не мовчки ламати вправу студенту).
//
// Найдовші слова розміщуються першими (менше вільних позицій для довгих
// слів, тож вигідніше розміщувати їх, поки сітка ще порожня). Клітинка
// придатна, якщо порожня АБО вже містить ТУ САМУ літеру — це дозволяє
// словам перетинатись (як у справжніх філвордах), не лише вимушено
// уникати одне одного.
// Приймає повні WordSearchWord (не string[]) — читає лише .word кожного
// запису для розміщення в сітці; translation/imageUrl/audioUrl на
// генерацію не впливають узагалі (це підказки в легенді, не сітка).
// sanitizeWordForGrid (grid-word.ts) прибирає з .word усе, що не літера
// (пробіл/апостроф/дефіс) — ЛИШЕ для розміщення: сам w.word (легенда)
// лишається недоторканим у config.words, тут читається окремо, лише для
// побудови сітки/placements.
export function generateWordSearchGrid(rawWords: WordSearchWord[]): {
  grid: string[][];
  placements: WordSearchPlacement[];
  failedWords: string[];
} {
  const words = rawWords.map((w) => sanitizeWordForGrid(w.word).toUpperCase()).filter(Boolean);
  const size = computeGridSize(words);
  const grid: (string | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const placements: WordSearchPlacement[] = [];
  const failedWords: string[] = [];

  const sortedByLengthDesc = [...words].sort((a, b) => b.length - a.length);

  for (const word of sortedByLengthDesc) {
    let placed = false;

    for (let attempt = 0; attempt < 200 && !placed; attempt++) {
      const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const maxRow = direction.name === "horizontal" ? size - 1 : size - word.length;
      const maxCol = direction.name === "horizontal" ? size - word.length : size - 1;
      if (maxRow < 0 || maxCol < 0) continue;

      const row = Math.floor(Math.random() * (maxRow + 1));
      const col = Math.floor(Math.random() * (maxCol + 1));

      let fits = true;
      for (let i = 0; i < word.length; i++) {
        const r = row + direction.row * i;
        const c = col + direction.col * i;
        const existing = grid[r][c];
        if (existing !== null && existing !== word[i]) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;

      for (let i = 0; i < word.length; i++) {
        const r = row + direction.row * i;
        const c = col + direction.col * i;
        grid[r][c] = word[i];
      }
      placements.push({ word, row, col, direction: direction.name });
      placed = true;
    }

    if (!placed) failedWords.push(word);
  }

  const filledGrid: string[][] = grid.map((row) => row.map((cell) => cell ?? randomFiller()));

  return { grid: filledGrid, placements, failedWords };
}

// Впорядкований список клітинок одного розміщеного слова — спільна логіка
// для grade.ts (звірка координат) і студентського компонента (не
// потрібна там, бо клієнт не бачить placements, але тип координат той
// самий).
export function placementCells(
  placement: WordSearchPlacement,
  length: number
): { row: number; col: number }[] {
  const delta = placement.direction === "horizontal" ? { row: 0, col: 1 } : { row: 1, col: 0 };
  return Array.from({ length }, (_, i) => ({
    row: placement.row + delta.row * i,
    col: placement.col + delta.col * i,
  }));
}
