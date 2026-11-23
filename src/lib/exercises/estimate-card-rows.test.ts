// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що flat-practice-layout.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/estimate-card-rows.test.ts
//
// Задача "orphan card" — перевіряє САМУ оцінку (letterGapsIsOrphan/
// letterRearrangementIsOrphan) на реальних даних слова/плиток, а не лише
// чисту логіку парування (та тестується окремо, flat-practice-layout.test.ts,
// де orphan/lines задаються напряму без проксі через ці естіматори).
import {
  estimateLetterGapsCardRows,
  estimateLetterRearrangementCardRows,
  letterGapsIsOrphan,
  letterRearrangementIsOrphan,
} from "./estimate-card-rows";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

// --- letter_gaps: будуємо фразу з N видимих "одиниць переносу" (слів) ------
// ширини 11*11=121px кожна (GIVEN_LETTER_WIDTH_PX=11px, 11 видимих літер,
// жодної прихованої — hiddenLetters: [], прогалин/null немає взагалі) —
// дозволяє рахувати пакування вручну (просте додавання, без розбиття на
// силабічні фрагменти, той самий шлях, що звичайний "кілька одиниць на
// рядок" гілка estimateLetterGapsCardRows/letterGapsIsOrphan).

function visibleUnit(n: number): string[] {
  return Array.from({ length: n }, () => "a");
}
function phraseOfUnits(unitLengths: number[]): string[] {
  const chars: string[] = [];
  unitLengths.forEach((n, i) => {
    if (i > 0) chars.push(" ");
    chars.push(...visibleUnit(n));
  });
  return chars;
}

// 3 одиниці по 121px: half-width (300px) пакує по 2 на рядок (2*121+8=250
// <=300), третя НЕ влазить (3*121+16=379>300) -> рядки [2,1], останній
// рядок РІВНО 1 одиниця (сирітка-кандидат); full-width (612px) — усі 3
// влазять в один рядок (379<=612) -> orphan.
{
  const chars = phraseOfUnits([11, 11, 11]);
  assert(estimateLetterGapsCardRows(chars, []) === 2, "letter_gaps: 3 units of 121px need 2 half-width lines");
  assert(letterGapsIsOrphan(chars, []), "letter_gaps: last half-width line holds exactly 1 unit, fits one full-width line -> orphan");
}

// 4 одиниці по 121px: half-width пакує рівно по 2 на рядок ([2,2]) -> останній
// рядок тримає 2 одиниці, НЕ 1 -> не сирітка, незалежно від rows>=2.
{
  const chars = phraseOfUnits([11, 11, 11, 11]);
  assert(estimateLetterGapsCardRows(chars, []) === 2, "letter_gaps: 4 units of 121px need 2 half-width lines");
  assert(!letterGapsIsOrphan(chars, []), "letter_gaps: last half-width line holds 2 units, not 1 -> not orphan, even with 2 lines");
}

// 5 одиниць по 121px: half-width -> [2,2,1] (останній рядок 1 одиниця,
// кандидат), але full-width (612px) НЕ влазить усе в один рядок (5*121+32=
// 637>612, лише 4 влазять) -> rows=2 на full width -> НЕ сирітка (слово
// потребує 2+ рядки навіть при full-width, задача явно вимагає цього винятку).
{
  const chars = phraseOfUnits([11, 11, 11, 11, 11]);
  assert(
    !letterGapsIsOrphan(chars, []),
    "letter_gaps: a word needing 2+ lines even at full width is a normal long card, not an orphan"
  );
}

// Коротка картка (1 одиниця, 1 рядок на half-width вже) — rows<2, ніколи
// не сирітка (немає зайвого рядка, щоб "осиротіти").
{
  const chars = phraseOfUnits([11]);
  assert(estimateLetterGapsCardRows(chars, []) === 1, "letter_gaps: a single short unit is 1 line");
  assert(!letterGapsIsOrphan(chars, []), "letter_gaps: a card that already fits one half-width line is never an orphan");
}

// --- letter_rearrangement: кількість однакових плиток-літер ----------------
// (REFERENCE_ROW_WIDTH_PX=300, FIXED_CELL_PX=32, FIXED_CELL_GAP_PX=3.4 ->
// 8 плиток на half-width рядок, 17 на full-width рядок — обчислено з тих
// самих констант, що й сам estimateLetterRearrangementCardRows/
// letterRearrangementIsOrphan).

// 9 плиток: half -> ceil(9/8)=2 рядки, останній = 9-8=1 плитка (кандидат);
// full -> ceil(9/17)=1 рядок -> сирітка.
{
  assert(estimateLetterRearrangementCardRows(9) === 2, "letter_rearrangement: 9 tiles need 2 half-width lines");
  assert(letterRearrangementIsOrphan(9), "letter_rearrangement: 9 tiles leave exactly 1 on the last half-width line and fit one full-width line -> orphan");
}

// 10 плиток: half -> ceil(10/8)=2 рядки, останній = 10-8=2 плитки (НЕ 1)
// -> не сирітка — та сама картка зі скріншота задачі, одна зайва плитка на
// другому рядку, тепер лишається half-width, оскільки насправді має 2
// повні плитки на останньому рядку за нашою оцінкою (НЕ рівно 1) —
// підтверджує, що правило спрацьовує лише для СПРАВЖНЬОЇ "сирітки".
{
  assert(estimateLetterRearrangementCardRows(10) === 2, "letter_rearrangement: 10 tiles need 2 half-width lines");
}

// 17 плиток: half -> ceil(17/8)=3 рядки, останній = 17-16=1 плитка
// (кандидат); full -> ceil(17/17)=1 рядок -> сирітка, НАВІТЬ попри 3 рядки
// на half-width (orphan залежить лише від "останній рядок=1" і "влазить в
// один рядок на full", не від загальної кількості half-width рядків).
{
  assert(estimateLetterRearrangementCardRows(17) === 3, "letter_rearrangement: 17 tiles need 3 half-width lines");
  assert(letterRearrangementIsOrphan(17), "letter_rearrangement: 17 tiles, last half-width line=1, fits one full-width line -> orphan despite 3 half-width lines");
}

// 18 плиток: half -> ceil(18/8)=3, останній = 18-16=2 (НЕ 1) -> не сирітка.
{
  assert(!letterRearrangementIsOrphan(18), "letter_rearrangement: last half-width line holds 2 tiles, not 1 -> not orphan");
}

// 25 плиток: half -> ceil(25/8)=4, останній = 25-24=1 (кандидат); full ->
// ceil(25/17)=2 (НЕ 1 рядок) -> не сирітка — довге слово, що не влазить в
// один рядок навіть на full-width, лишається звичайною довгою карткою.
{
  assert(!letterRearrangementIsOrphan(25), "letter_rearrangement: a word needing 2+ lines even at full width is a normal long card, not an orphan");
}

// 8 плиток (точно k, без переносу) і 1 плитка — обидва вже short/fit-in-one-line
// (rows<2) -> ніколи сирітка.
{
  assert(estimateLetterRearrangementCardRows(8) === 1, "letter_rearrangement: exactly 8 tiles fit one half-width line");
  assert(!letterRearrangementIsOrphan(8), "letter_rearrangement: a card that already fits one half-width line is never an orphan");
  assert(!letterRearrangementIsOrphan(1), "letter_rearrangement: a single tile is never an orphan");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All estimate-card-rows (orphan detection) tests passed.");
