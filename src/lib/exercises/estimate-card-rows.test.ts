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

// 3 одиниці по 121px: half-width (330px, перекалібровано — див.
// estimate-card-rows.ts) пакує по 2 на рядок (2*121+8=250<=330), третя НЕ
// влазить (3*121+16=379>330) -> рядки [2,1], останній рядок РІВНО 1
// одиниця (сирітка-кандидат); full-width (672px) — усі 3 влазять в один
// рядок (379<=672) -> orphan.
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

// 7 одиниць по 121px: half-width пакує по 2 на рядок -> [2,2,2,1] (останній
// рядок 1 одиниця, кандидат); full-width (672px) влазить РІВНО 5 одиниць
// на рядок (129*5-8=637<=672, 129*6-8=766>672) -> [5,2] -> rows=2 на full
// width -> НЕ сирітка (слово потребує 2+ рядки навіть при full-width,
// задача явно вимагає цього винятку).
{
  const chars = phraseOfUnits([11, 11, 11, 11, 11, 11, 11]);
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
// Задача "orphan detection did not fire" — калібрувальні числа ПРЯМО зі
// скріншота: 9 плиток влазять в один half-width рядок (card 5), 10 плиток
// переносять РІВНО 1 плитку на другий рядок (card 3/4, "часто"/"якийсь"),
// 10 плиток влазять в один рядок на full-width. REFERENCE_ROW_WIDTH_PX=330
// (estimate-card-rows.ts), FIXED_CELL_PX=32, FIXED_CELL_GAP_PX=3.4 -> 9
// плиток на half-width рядок (floor((330+3.4)/35.4)=9), 19 на full-width
// рядок (FULL_ROW_WIDTH_PX=672, floor((672+3.4)/35.4)=19) — обчислено з
// тих самих констант, що й сам estimateLetterRearrangementCardRows/
// letterRearrangementIsOrphan, а не довільно підібрані тестом.

// 9 плиток: half -> ceil(9/9)=1 рядок (уже влазить, НЕ потребує переносу)
// -> rows<2, ніколи сирітка — "нормальна" картка (чи то коротка, чи то
// звичайний непарний залишок, залежно від сусідів), саме той випадок, що
// скріншот показує для card 5 (НЕ orphan, НЕ full-width).
{
  assert(estimateLetterRearrangementCardRows(9) === 1, "letter_rearrangement: 9 tiles fit one half-width line (card 5 on the screenshot)");
  assert(!letterRearrangementIsOrphan(9), "letter_rearrangement: 9 tiles already fit one half-width line -> normal, never orphan");
}

// 10 плиток: half -> ceil(10/9)=2 рядки, останній = 10-9=1 плитка (РІВНО
// 1 — точно "card 3"/"card 4" зі скріншота, що раніше лишались парними з
// сиротою-плиткою на другому рядку); full -> ceil(10/19)=1 рядок -> усе
// слово влазить в один рядок, якщо дати йому обидві колонки -> orphan.
{
  assert(estimateLetterRearrangementCardRows(10) === 2, "letter_rearrangement: 10 tiles need 2 half-width lines, last holds exactly 1 tile");
  assert(letterRearrangementIsOrphan(10), "letter_rearrangement: 10 tiles -> orphan (this was the missed detection from the screenshot)");
}

// 11+ плиток, що все одно потребують 2+ рядки НАВІТЬ на full-width (НЕ
// сирітка, попри кандидатську умову на half-width) — найменше таке число
// при k_half=9/k_full=19: 28 плиток (9*3+1=28, half last=1 candidate;
// ceil(28/19)=2, full НЕ влазить в один рядок) — "11+" з умови задачі —
// звичайна довга картка, парується як завжди, НЕ стає окремим full-width
// рядком лише тому, що на half-width виглядала кандидатом.
{
  assert(estimateLetterRearrangementCardRows(28) === 4, "letter_rearrangement: 28 tiles need 4 half-width lines, last holding exactly 1 tile");
  assert(
    !letterRearrangementIsOrphan(28),
    "letter_rearrangement: a word needing 2+ lines even at full width (28 tiles) is a normal long card, not an orphan"
  );
}

// 11 плиток: half -> ceil(11/9)=2, останній = 11-9=2 (НЕ 1) -> не навіть
// кандидат — підтверджує, що правило спрацьовує лише для СПРАВЖНЬОЇ
// "сирітки" (рівно 1 на останньому рядку), не для будь-якого непарного
// залишку.
{
  assert(!letterRearrangementIsOrphan(11), "letter_rearrangement: last half-width line holds 2 tiles, not 1 -> not orphan");
}

// 1 плитка — вже short/fit-in-one-line (rows<2) -> ніколи сирітка.
{
  assert(!letterRearrangementIsOrphan(1), "letter_rearrangement: a single tile is never an orphan");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All estimate-card-rows (orphan detection) tests passed.");
