// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що task-display-name.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/exercise-blocks.test.ts
//
// "Робота над помилками", сцена-вигляд (крок 4) — chunk()/EXERCISE_BLOCK_SIZE
// тут стають "знімок-чанкером": error-review-block.tsx заморожує
// remainingItemIds у знімок ОДИН раз при відкритті задачі
// (openMode="scene"), і кожен з 4 типів (letter_rearrangement/letter_gaps/
// matching/table_fill) чанкує САМЕ цей знімок, а не live-список, що
// звужується з кожним router.refresh() після перевірки. Тести нижче
// перевіряють (1) самі порогові приклади із задачі, (2) що чанкування
// знімку не залежить від подальших змін live-списку (чому власне й
// потрібен окремий знімок, а не live remainingItemIds напряму), і (3) що
// елемент лишається у СВОЄМУ блоці незалежно від того, виправлені чи ні
// інші елементи того самого блоку.
import { EXERCISE_BLOCK_SIZE, chunk, chunkMatchingPairs } from "./exercise-blocks";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

function sizes(blocks: unknown[][]): number[] {
  return blocks.map((b) => b.length);
}

// --- Порогові приклади із задачі ---------------------------------------

// matching — ПАРА (2 елементи): chunkMatchingPairs (не голий chunk() з
// EXERCISE_BLOCK_SIZE/2) — задача "unify matching group splitting, no
// singleton rule": групи по 5 пар, а якщо залишок РІВНО 1 — остання пара
// приєднується до ПОПЕРЕДНЬОЇ групи, а не лишається сама. 13 пар: залишок
// 3 (13 = 5+5+3) — без злиття, як і раніше.
{
  const pairs = Array.from({ length: 13 }, (_, i) => `pair-${i}`);
  const blocks = chunkMatchingPairs(pairs);
  assert(
    JSON.stringify(sizes(blocks)) === JSON.stringify([5, 5, 3]),
    "matching: 13 pairs chunk into 5,5,3 (remainder 3, no merge needed)"
  );
}

// matching, флет/інлайн-картка сцени (error-review-block.tsx БЕЗ
// openMode, matching.tsx isPractice) — той самий chunkMatchingPairs, що
// сцена-вигляд блоків вище (ОДИН спільний helper, не дублюючі виклики
// chunk() у кожному місці). 12 пар: залишок 2 — без злиття.
{
  const pairs = Array.from({ length: 12 }, (_, i) => `pair-${i}`);
  const blocks = chunkMatchingPairs(pairs);
  assert(JSON.stringify(sizes(blocks)) === JSON.stringify([5, 5, 2]), "matching flat groups: 12 pairs chunk into 5,5,2");
}

// Сцена-вигляд, фікс "pre-corrected pairs напіввирішені" — 14 wrong pairs
// minus 2 already-corrected leaves 11 remaining (buildErrorReviewEntry.
// remainingItemIds, see error-review.test.ts for the 12-remaining case).
// Задача "unify matching group splitting, no singleton rule" — 11 пар:
// залишок РІВНО 1 (11 = 5+5+1) -> остання одинока пара приєднується до
// ПОПЕРЕДНЬОЇ групи (5,6), а не лишається сама (5,5,1, старе правило).
{
  const pairs = Array.from({ length: 11 }, (_, i) => `pair-${i}`);
  const blocks = chunkMatchingPairs(pairs);
  assert(
    JSON.stringify(sizes(blocks)) === JSON.stringify([5, 6]),
    "matching: 14 wrong minus 2 corrected -> 11 remaining pairs chunk into 5,6 (singleton merges into the previous group)"
  );
}

{
  const pairs = Array.from({ length: 5 }, (_, i) => `pair-${i}`);
  const blocks = chunkMatchingPairs(pairs);
  assert(JSON.stringify(sizes(blocks)) === JSON.stringify([5]), "matching flat groups: 5 pairs stay a single group");
}

{
  const blocks = chunkMatchingPairs([] as string[]);
  assert(blocks.length === 0, "matching flat groups: 0 pairs produce no groups, not a crash");
}

// --- chunkMatchingPairs: every example from the task, explicitly --------

{
  assert(sizes(chunkMatchingPairs(range(1))).join(",") === "1", "1 pair gives one group of 1");
  assert(sizes(chunkMatchingPairs(range(6))).join(",") === "6", "6 pairs gives one group of 6, not 5,1");
  assert(sizes(chunkMatchingPairs(range(10))).join(",") === "5,5", "10 pairs gives 5,5 (remainder 0, no merge)");
  assert(sizes(chunkMatchingPairs(range(16))).join(",") === "5,5,6", "16 pairs gives 5,5,6, not 5,5,5,1");
}

function range(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `pair-${i}`);
}

// letter_gaps/letter_rearrangement/table_fill — ЕЛЕМЕНТ = слово/рядок,
// EXERCISE_BLOCK_SIZE = 10 напряму (без ділення навпіл).
{
  const words = Array.from({ length: 12 }, (_, i) => `word-${i}`);
  const blocks = chunk(words, EXERCISE_BLOCK_SIZE);
  assert(JSON.stringify(sizes(blocks)) === JSON.stringify([10, 2]), "letter_gaps: 12 words chunk into 10,2");
}

{
  const words = Array.from({ length: 10 }, (_, i) => `word-${i}`);
  const blocks = chunk(words, EXERCISE_BLOCK_SIZE);
  assert(blocks.length === 1 && blocks[0].length === 10, "letter_gaps: 10 words stay one block (blockCount<=1)");
}

// --- Стабільність знімку: live-список звужується, знімок — ні -----------

// Знімок береться ОДИН раз при відкритті (error-review-block.tsx,
// ErrorReviewBlock: snapshot.ids = [...freshEntry.remainingItemIds]) —
// подальше "виправлення" елемента лише звужує ЖИВИЙ
// entry.remainingItemIds (симулюємо видаленням з окремого масиву); сам
// знімок (і чанки з нього) залишаються БЕЗ ЗМІН, бо chunk() викликається
// на незалежній копії, а не на live-масиві.
{
  const snapshot = Array.from({ length: 19 }, (_, i) => `word-${i}`); // 19 wrong words at open time
  const blocksBefore = chunk(snapshot, EXERCISE_BLOCK_SIZE);
  assert(JSON.stringify(sizes(blocksBefore)) === JSON.stringify([10, 9]), "letter_rearrangement: 19 words chunk into 10,9");

  // Студент виправляє 5 слів з першого блоку — "жива" модель
  // (entry.remainingItemIds) звужується, знімок — НЕ торкається.
  let live = [...snapshot];
  const fixed = blocksBefore[0].slice(0, 5);
  live = live.filter((id) => !fixed.includes(id));
  assert(live.length === 14, "live remainingItemIds shrinks after corrections");

  // Чанкуємо ТОЙ САМИЙ знімок ще раз (як при наступному router.refresh(),
  // коли компонент перерендерюється з новими entry.remainingItemIds, але
  // snapshot-стейтом, що НЕ оновлюється) — блоки ідентичні до й після.
  const blocksAfter = chunk(snapshot, EXERCISE_BLOCK_SIZE);
  assert(JSON.stringify(blocksBefore) === JSON.stringify(blocksAfter), "snapshot chunking is stable after live-list shrinks");

  // Якби натомість чанкували ЖИВИЙ (звужений) список — блоки зсунулись би
  // (14 елементів -> 10,4, а не 10,9): явно показуємо, ЧОМУ знімок
  // потрібен, а не просто re-chunk live-списку щоразу.
  const blocksFromLive = chunk(live, EXERCISE_BLOCK_SIZE);
  assert(
    JSON.stringify(sizes(blocksFromLive)) !== JSON.stringify(sizes(blocksBefore)),
    "chunking the live (shrinking) list directly would have shifted block boundaries — this is why a snapshot is needed"
  );
}

// --- Елемент лишається у своєму блоці -----------------------------------

{
  const snapshot = Array.from({ length: 13 }, (_, i) => `pair-${i}`);
  const blocks = chunkMatchingPairs(snapshot); // 5,5,3
  const blockIndexOf = (blocksArr: string[][], id: string) => blocksArr.findIndex((b) => b.includes(id));

  const targetId = "pair-7"; // у другому блоці (індекси 5..9)
  const originalBlockIndex = blockIndexOf(blocks, targetId);
  assert(originalBlockIndex === 1, "pair-7 starts in block index 1 (5,5,3 split)");

  // Інші пари ТОГО Ж блоку "виправлені" (видалені з живого списку) —
  // чанкуємо ЗНОВУ З ТОГО Ж ЗНІМКУ (не live) — targetId лишається у
  // блоці 1, та сама позиція, незалежно від того, що сталось із рештою.
  const blocksAgain = chunkMatchingPairs(snapshot);
  assert(
    blockIndexOf(blocksAgain, targetId) === originalBlockIndex,
    "pair-7 stays in the same block across re-chunks of the same snapshot, regardless of other items' correction state"
  );
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
} else {
  console.log("All exercise-blocks (snapshot chunking) tests passed.");
}
