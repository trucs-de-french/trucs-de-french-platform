// Розбиття великих вправ на блоки по EXERCISE_BLOCK_SIZE елементів (10),
// коли елементів більше — коли їх ≤10, вправа лишається одним "блоком"
// (useBlocks === false у кожному студентському компоненті), без жодної
// зміни вигляду/поведінки. Спільне джерело порогу й самої нарізки для
// matching.tsx/letter-gaps.tsx/letter-rearrangement.tsx/table-fill.tsx —
// та сама межа має узгоджуватись і в sanitize.ts (де для matching це ще й
// межі шаффлу right, щоб блок не лишився без своїх справжніх відповідей),
// і в студентському компоненті, інакше ліва й права сторони розійдуться.
//
// Що таке "елемент" — рішення КОЖНОГО типу окремо (слово в letter_gaps/
// letter_rearrangement, рядок таблиці в table_fill, ПАРА — тобто 2
// елементи — в matching, звідси ділення EXERCISE_BLOCK_SIZE навпіл лише
// там). Тут — лише спільне число й генерична нарізка масиву.
export const EXERCISE_BLOCK_SIZE = 10;

export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

// Задача "unify matching group splitting, no singleton rule" — ЄДИНЕ
// місце, що ділить пари matching на групи/блоки по 5, скрізь (сцена-вигляд
// блоків matching.tsx, флет/інлайн-групи з пунктирним розділювачем,
// практика openMode="scene", perBlockShuffle у sanitize.ts) — раніше кожне
// з цих місць окремо викликало chunk(pairs, EXERCISE_BLOCK_SIZE/2), що
// лишало залишок РІВНО 1 пару самою в останній групі (11 пар -> 5,5,1):
// картка з ОДНІЄЮ парою виглядала як помилка розмітки, той самий принцип,
// що вже привів до splitEvenly() для карткових типів нижче, але тут —
// простіше правило, не повний рівномірний розподіл: звичайний chunk(5), і
// лише коли ОСТАННЯ група виявилась рівно 1 парою — зливаємо її в
// ПОПЕРЕДНЮ (6 замість 5+1). Залишок 2/3/4 — без змін (5,5,2/5,5,3 і т.д.,
// як і раніше), лише залишок 1 обробляється інакше. n<=5 — один блок
// (навіть n=1), без злиття (нема з чим зливати) — той самий "один блок"
// принцип, що chunk()/splitEvenly() вище.
export function chunkMatchingPairs<T>(pairs: T[]): T[][] {
  const groups = chunk(pairs, 5);
  if (groups.length >= 2 && groups[groups.length - 1].length === 1) {
    const last = groups.pop()!;
    groups[groups.length - 1] = [...groups[groups.length - 1], ...last];
  }
  return groups;
}

// Друга хвиля поблочності — вправи-"картки" (word_choice, multiple_choice,
// true_false, reorder, open_answer), де елемент = ОКРЕМА картка на всю
// ширину (не слово/пара, як вище), тож поріг блоку нижчий (5, не 10) — інакше
// картки одного блоку не влізли б на екран без скролу. Розбиття РІВНОМІРНЕ
// (більші блоки першими), а не "довільний останній залишок" (chunk() вище):
// 11 елементів без цього дало б chunk(11,5) = [5,5,1] — блок із ОДНІЄЮ
// карткою виглядав би як помилка розмітки, а не навігація. Позиційне (як
// chunk) — ключ блоку String(blockIndex), той самий принцип, що matching/
// letter_gaps/table_fill.
export const CARD_BLOCK_MAX = 5;

// k = ceil(n/max) блоків; base = floor(n/k) — розмір КОЖНОГО блоку, якщо б
// розподілити без залишку; remainder = n%k блоків отримують +1 елемент
// (більші блоки ПЕРШИМИ, явна вимога задачі) — сума розмірів завжди точно n.
// n<=max — один блок (уся вправа), useBlocks===false у кожному студентському
// компоненті, без жодної зміни вигляду/поведінки (як і для EXERCISE_BLOCK_SIZE
// вище).
export function splitEvenly<T>(items: T[], maxSize: number): T[][] {
  const n = items.length;
  if (n === 0) return [];
  if (n <= maxSize) return [items];
  const blockCount = Math.ceil(n / maxSize);
  const base = Math.floor(n / blockCount);
  const remainder = n % blockCount;
  const result: T[][] = [];
  let offset = 0;
  for (let i = 0; i < blockCount; i++) {
    const size = i < remainder ? base + 1 : base;
    result.push(items.slice(offset, offset + size));
    offset += size;
  }
  return result;
}
