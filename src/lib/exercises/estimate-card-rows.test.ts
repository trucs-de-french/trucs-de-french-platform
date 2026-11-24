// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що flat-practice-layout.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/estimate-card-rows.test.ts
//
// Задача "simplification of the card layout for letter practice" —
// перевіряє (1) саму ЗБАЛАНСОВАНУ упаковку (packBalancedRowCounts/
// forcedBreakIndexFor) на ЧИСТИХ числових прикладах (п.6 задачі: overflow
// 1/2/3, точне влучання, 2 повні рядки+1, 3 рядки), (2) letter_rearrangement
// на РЕАЛЬНИХ кількостях тайлів зі скріншотів/задачі (9/10/11/12/19/20/28),
// (3) letter_gaps і для фраз (кілька одиниць переносу) і для одного
// завеликого слова (власне розбиття на силабічні фрагменти, та сама
// функція, що тести syllable-split.test.ts) — усі числа нижче ПЕРЕВІРЕНІ
// запуском pure-функцій (не придумані вручну): REFERENCE_ROW_WIDTH_PX=330,
// FIXED_CELL_PX=32, FIXED_CELL_GAP_PX=3.4 (use-working-tile-layout.ts) ->
// k=9 тайлів на half-width рядок.
import {
  packBalancedRowCounts,
  forcedBreakIndexFor,
  breakIndicesForCounts,
  estimateLetterRearrangementCardRows,
  letterGapsPracticeLayout,
  letterRearrangementPracticeLayout,
  REFERENCE_ROW_WIDTH_PX,
} from "./estimate-card-rows";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

// --- packBalancedRowCounts / forcedBreakIndexFor: чисті числові приклади --
// k=3 тайли на рядок (itemWidth=10, rowWidth=30, gap=0 — зручні округлі
// числа для ручної перевірки, той самий метод, що реальні FIXED_CELL_PX/
// FIXED_CELL_GAP_PX/REFERENCE_ROW_WIDTH_PX, лише менші).

function uniform(n: number, w = 10): number[] {
  return Array.from({ length: n }, () => w);
}

{
  // Точне влучання (n=3, рівно 1 повний рядок) — жодного другого рядка,
  // жодного фіксу.
  assert(JSON.stringify(packBalancedRowCounts(uniform(3), 30, 0)) === "[3]", "exact fit (n=3,k=3): one full line, no fix");
  assert(forcedBreakIndexFor(uniform(3), 30, 0) === null, "exact fit: no forced break needed");

  // Точне влучання (n=6, рівно 2 повні рядки) — та сама відсутність фіксу.
  assert(
    JSON.stringify(packBalancedRowCounts(uniform(6), 30, 0)) === "[3,3]",
    "exact fit (n=6,k=3): two full lines, no fix"
  );

  // overflow 1 (n=4): природно [3,1] -> фікс -> [2,2], розрив після індексу
  // 1 (n-3=1): "10 tiles become 8+2, not 9+1" — та сама логіка, менший
  // масштаб.
  assert(JSON.stringify(packBalancedRowCounts(uniform(4), 30, 0)) === "[2,2]", "overflow 1 (n=4,k=3): fixed to [2,2], not [3,1]");
  assert(forcedBreakIndexFor(uniform(4), 30, 0) === 1, "overflow 1: forced break after index 1 (n-3=1)");

  // overflow 2 (n=5): природно [3,2] — останній рядок УЖЕ 2, жодного
  // фіксу не потрібно.
  assert(JSON.stringify(packBalancedRowCounts(uniform(5), 30, 0)) === "[3,2]", "overflow 2 (n=5,k=3): natural [3,2] needs no fix");
  assert(forcedBreakIndexFor(uniform(5), 30, 0) === null, "overflow 2: no forced break needed (natural last line already has 2)");

  // overflow 3 (n=9): природно 3 повних рядки [3,3,3] — жодного фіксу.
  assert(JSON.stringify(packBalancedRowCounts(uniform(9), 30, 0)) === "[3,3,3]", "n=9,k=3: three full lines, no fix needed");

  // 2 повних рядки + 1 (n=7, 3 рядки): природно [3,3,1] -> фікс -> [3,2,2],
  // розрив після індексу n-3=4 (після 5-го тайла: рядки 1-3 лишаються
  // природними [3], фікс торкається лише ДВОХ останніх рядків).
  assert(
    JSON.stringify(packBalancedRowCounts(uniform(7), 30, 0)) === "[3,2,2]",
    "2 full lines plus 1 (n=7,k=3): fixed to [3,2,2], not [3,3,1]"
  );
  assert(forcedBreakIndexFor(uniform(7), 30, 0) === 4, "n=7: forced break after index 4 (n-3=4)");

  // Одинока картка (n=1) — завжди один рядок, жодного фіксу (немає чого
  // "осиротити").
  assert(JSON.stringify(packBalancedRowCounts(uniform(1), 30, 0)) === "[1]", "n=1: single line, trivially no fix");
  assert(forcedBreakIndexFor(uniform(1), 30, 0) === null, "n=1: no forced break possible or needed");

  // Порожній вхід — не крашиться.
  assert(JSON.stringify(packBalancedRowCounts([], 30, 0)) === "[1]", "empty input produces one (empty) line, not a crash");
}

// --- захист: попередній рядок, що сам має рівно 1 тайл, НЕ позичає ---------
// (інакше фікс лише перенісся б на рядок раніше, той самий баг).

{
  // k=1 (rowWidth=itemWidth, тайли завеликі, щоб ділити рядок із кимось):
  // n=2 природно [1,1] — "позичити" з попереднього рядка (теж 1) зробило
  // б ЙОГО самого осиротілим — фікс НЕ застосовується, лишається [1,1].
  assert(JSON.stringify(packBalancedRowCounts(uniform(2), 10, 0)) === "[1,1]", "guard: previous line with only 1 item is never drained (stays [1,1])");
  assert(forcedBreakIndexFor(uniform(2), 10, 0) === null, "guard: no forced break when the previous line can't safely lend");
}

// --- letter_rearrangement: РЕАЛЬНІ кількості тайлів (задача/скріншоти) ----
// REFERENCE_ROW_WIDTH_PX=330 -> k=9 (floor((330+3.4)/35.4)=9) — перевірено
// запуском, не довільний вибір.

// 9 тайлів ("взуття") — уже влазить в один рядок -> short, жодного розриву.
{
  assert(estimateLetterRearrangementCardRows(9) === 1, "letter_rearrangement: 9 tiles ('взуття') fit one line");
  const r = letterRearrangementPracticeLayout(9, REFERENCE_ROW_WIDTH_PX);
  assert(r.cardClass === "short" && r.forcedBreakAfterIndex === null, "letter_rearrangement: 9 tiles -> short, no break");
  assert(r.lines === 1, "letter_rearrangement: 9 tiles -> lines=1 (exposed for pairPracticeItems' mixed-pair tie-break)");
}

// 10 тайлів ("часто"/"якийсь"/"дозвіл, шкільний бланк"/"прихистити") —
// природно [9,1] (сирота) -> фікс -> [8,2], розрив після індексу 7.
{
  const r = letterRearrangementPracticeLayout(10, REFERENCE_ROW_WIDTH_PX);
  assert(r.cardClass === "long", "letter_rearrangement: 10 tiles -> long (2 lines)");
  assert(r.forcedBreakAfterIndex === 7, "letter_rearrangement: 10 tiles -> forced break after tile index 7 (8+2 split, not 9+1)");
}

// 11 тайлів ("невдячність") — природно [9,2], останній рядок УЖЕ 2 ->
// жодного розриву не потрібно.
{
  const r = letterRearrangementPracticeLayout(11, REFERENCE_ROW_WIDTH_PX);
  assert(r.cardClass === "long", "letter_rearrangement: 11 tiles -> long (2 lines)");
  assert(r.forcedBreakAfterIndex === null, "letter_rearrangement: 11 tiles -> natural [9,2] already fine, no forced break");
}

// 12 тайлів — природно [9,3], жодного розриву.
{
  const r = letterRearrangementPracticeLayout(12, REFERENCE_ROW_WIDTH_PX);
  assert(r.cardClass === "long" && r.forcedBreakAfterIndex === null, "letter_rearrangement: 12 tiles -> long [9,3], no break needed");
}

// 19 тайлів (3 рядки) — природно [9,9,1] -> фікс -> [9,8,2], розрив після
// індексу 16.
{
  const r = letterRearrangementPracticeLayout(19, REFERENCE_ROW_WIDTH_PX);
  assert(r.cardClass === "long", "letter_rearrangement: 19 tiles -> long (3 lines)");
  assert(r.forcedBreakAfterIndex === 16, "letter_rearrangement: 19 tiles -> forced break after index 16 ([9,8,2], not [9,9,1])");
}

// 20 тайлів — природно [9,9,2], останній рядок УЖЕ 2 -> жодного розриву.
{
  const r = letterRearrangementPracticeLayout(20, REFERENCE_ROW_WIDTH_PX);
  assert(r.cardClass === "long" && r.forcedBreakAfterIndex === null, "letter_rearrangement: 20 tiles -> [9,9,2], no break needed");
}

// 28 тайлів — природно [9,9,9,1] -> фікс -> [9,9,8,2], розрив після 25.
{
  const r = letterRearrangementPracticeLayout(28, REFERENCE_ROW_WIDTH_PX);
  assert(r.cardClass === "long", "letter_rearrangement: 28 tiles -> long (4 lines)");
  assert(r.forcedBreakAfterIndex === 25, "letter_rearrangement: 28 tiles -> forced break after index 25 ([9,9,8,2], not [9,9,9,1])");
}

// 1 тайл — короткий тривіально.
{
  const r = letterRearrangementPracticeLayout(1, REFERENCE_ROW_WIDTH_PX);
  assert(r.cardClass === "short" && r.forcedBreakAfterIndex === null, "letter_rearrangement: 1 tile -> short");
}

// --- breakIndicesForCounts: чиста функція, числові приклади (п.6 задачі) --

{
  assert(JSON.stringify(breakIndicesForCounts([3])) === "[]", "exact fit (one line): no break needed");
  assert(JSON.stringify(breakIndicesForCounts([])) === "[]", "empty counts: no break, not a crash");
  assert(JSON.stringify(breakIndicesForCounts([2, 1])) === "[1]", "two lines [2,1]: one break, after index 1 (end of line 1)");
  assert(
    JSON.stringify(breakIndicesForCounts([2, 2, 2, 1])) === "[1,3,5]",
    "four lines [2,2,2,1] (three or more word groups): a break after EVERY line boundary except the last"
  );
}

// --- letter_gaps: пакування слово-груп (задача "pack word groups greedily
// on a line") — ЖАДІБНЕ, БЕЗ фіксу "останній рядок не 1 елемент" (самотнє
// слово в кінці фрази — нормальний перенос тексту, не помилка розмітки,
// на відміну від ОДНОГО силабічного фрагмента довгого слова нижче).
// Розриви — на КОЖНІЙ межі рядка (breakIndicesForCounts), не лише
// останній: природний inline-block перенос спирається на
// GIVEN_LETTER_WIDTH_PX (наближення, не точний CSS-розмір), тож явний
// розрив потрібен на будь-якій межі для гарантії "оцінка == рендер".

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
// Фраза з ПРИХОВАНИХ одиниць (кожна літера — gap-клітинка 32px, а не
// 11px видима) — ЄДИНИЙ спосіб отримати реалістичну ширину слова при
// РЕАЛЬНІЙ half-колонковій ширині (~560px, задача): видимі літери (11px)
// дають мізерну суму навіть для довгих фраз, не демонструють перенос
// взагалі.
function hiddenUnit(n: number): (string | null)[] {
  return Array.from({ length: n }, () => null);
}
function phraseOfHiddenUnits(unitLens: number[]): { chars: (string | null)[]; hiddenLetters: string[] } {
  const chars: (string | null)[] = [];
  const hiddenLetters: string[] = [];
  unitLens.forEach((n, i) => {
    if (i > 0) chars.push(" ");
    chars.push(...hiddenUnit(n));
    for (let k = 0; k < n; k++) hiddenLetters.push(String.fromCharCode(97 + ((hiddenLetters.length + k) % 26)));
  });
  return { chars, hiddenLetters };
}

// "vider une assiette" (задача, скріншот) — РЕКОНСТРУЙОВАНО прихованими
// одиницями довжини 5/3/8 (vider/une/assiette), ширина half-колонки
// ~560px (задача: "about ... far below the half-column inner width of
// about 560px"): vider=5*32+4*3.4=173.6px; une=3*32+2*3.4=102.8px;
// assiette=8*32+7*3.4=279.8px. vider+8(gap)+une=284.4<=560 -> та сама
// лінія; +8+assiette=572.2>560 -> переноситься. Результат: 2 рядки
// ("vider une" / "assiette"), розрив ПІСЛЯ одиниці 1 (une) — точно "vider
// une" на одному рядку, "assiette" саме, БЕЗ фіксу (звичайний перенос
// тексту, не помилка).
{
  const { chars, hiddenLetters } = phraseOfHiddenUnits([5, 3, 8]);
  const r = letterGapsPracticeLayout(chars, hiddenLetters, 560);
  assert(r.cardClass === "long" && r.lines === 2, "'vider une assiette': 2 lines (vider une / assiette)");
  assert(
    JSON.stringify(r.forcedBreaks) === JSON.stringify([{ kind: "afterUnit", unitIndex: 1 }]),
    "'vider une assiette': forced break after unit 1 ('une'), keeping 'vider une' together on line 1"
  );
}

// "une ingratitude"/"un orphelin"-style — артикль (4 приховані літери,
// 138.2px) + іменник (12 прихованих літер, 421.4px): 138.2+8+421.4=
// 567.6px > 560px — НЕ влазять РАЗОМ на одній лінії (article does not
// fit after the word) -> 2 рядки, кожен з 1 одиницею — БЕЗ фіксу
// (звичайний перенос, не "сирота"), з ЯВНИМ розривом (на відміну від
// попередньої версії, що поклалась би на природний перенос тут).
{
  const { chars, hiddenLetters } = phraseOfHiddenUnits([4, 12]);
  const r = letterGapsPracticeLayout(chars, hiddenLetters, 560);
  assert(r.cardClass === "long" && r.lines === 2, "article+noun that don't fit together: 2 lines, one word each");
  assert(
    JSON.stringify(r.forcedBreaks) === JSON.stringify([{ kind: "afterUnit", unitIndex: 0 }]),
    "article+noun: forced break after unit 0 (the article), since combined width (567.6px) exceeds the 560px row"
  );
}

// "faire un bisou"-style (картка 10, задача: "must be consistent with its
// real width") — три короткі одиниці (5/2/5 прихованих літер кожна,
// 173.6/67.4/173.6px): усе разом 173.6+8+67.4+8+173.6=430.6px <= 560px ->
// влазить в ОДИН рядок -> short, жодного розриву — той самий алгоритм,
// просто інша фраза, демонструючи консистентність незалежно від
// конкретних слів.
{
  const { chars, hiddenLetters } = phraseOfHiddenUnits([5, 2, 5]);
  const r = letterGapsPracticeLayout(chars, hiddenLetters, 560);
  assert(r.cardClass === "short" && r.lines === 1, "'faire un bisou'-style: all three word groups fit on one line -> short");
  assert(JSON.stringify(r.forcedBreaks) === "[]", "'faire un bisou'-style: no forced break needed (fits one line)");
}

// Три й більше слово-групи, що ВЖЕ природно діляться рівномірно (4 одиниці
// по 121px видимих літер -> [2,2]) — задача вимагає ЯВНИЙ розрив НАВІТЬ
// тут (не лише коли природний перенос дав би "сироту"): природний перенос
// спирається на наближену ширину символу, явний розрив на КОЖНІЙ межі
// гарантує оцінку===рендер завжди, не лише у "проблемних" випадках.
{
  const chars = phraseOfUnits([11, 11, 11, 11]);
  const r = letterGapsPracticeLayout(chars, [], REFERENCE_ROW_WIDTH_PX);
  assert(r.cardClass === "long" && r.lines === 2, "4 units already balanced [2,2]: still long, 2 lines");
  assert(
    JSON.stringify(r.forcedBreaks) === JSON.stringify([{ kind: "afterUnit", unitIndex: 1 }]),
    "4 units [2,2]: an EXPLICIT break is still inserted at the (already-natural) boundary, for estimate/render consistency"
  );
}

// Сім одиниць по 121px видимих літер — природно [2,2,2,1] (4 рядки) —
// задача: "three or more word groups" — розрив на КОЖНІЙ з трьох меж, не
// лише одна (на відміну від letter_rearrangement/one-oversized-word,
// де лишається рівно ОДИН розрив — там природний перенос і оцінка вже
// узгоджені на всіх межах окрім потенційно останньої).
{
  const chars = phraseOfUnits([11, 11, 11, 11, 11, 11, 11]);
  const r = letterGapsPracticeLayout(chars, [], REFERENCE_ROW_WIDTH_PX);
  assert(r.cardClass === "long" && r.lines === 4, "7 units -> 4 lines [2,2,2,1], no balance fix applied to a lone last word");
  assert(
    JSON.stringify(r.forcedBreaks) ===
      JSON.stringify([
        { kind: "afterUnit", unitIndex: 1 },
        { kind: "afterUnit", unitIndex: 3 },
        { kind: "afterUnit", unitIndex: 5 },
      ]),
    "7 units: three explicit breaks, one at every line boundary (1, 3, 5), none merging the lone 7th unit into line 3"
  );
}

// Одна коротка одиниця — вже влазить в один рядок -> short, жодного
// розриву (rows<2, немає меж узагалі).
{
  const chars = phraseOfUnits([11]);
  const r = letterGapsPracticeLayout(chars, [], REFERENCE_ROW_WIDTH_PX);
  assert(r.cardClass === "short" && r.lines === 1 && JSON.stringify(r.forcedBreaks) === "[]", "letter_gaps: a single short unit -> short, no break");
}

// --- letter_gaps: ОДНЕ завелике слово (без пробілів), власний розрив між --
// --- силабічними фрагментами (той самий splitIntoSyllableChunks, що ------
// --- syllable-split.test.ts) — НЕЗМІННО з попередньої задачі (задача
// --- "pack word groups greedily on a line" стосується ЛИШЕ слово-груп
// --- вище, не внутрішнього розбиття ОДНОГО завеликого слова): ОДИН
// --- фікс/розрив, forcedBreakIndexFor, той самий, що раніше. -------------

function allHiddenWord(word: string): { chars: (string | null)[]; hiddenLetters: string[] } {
  return { chars: Array.from({ length: word.length }, () => null), hiddenLetters: word.split("") };
}

// "developpement" (13 літер, усі приховані -> 13 клітинок-пропусків по
// 32px) -> splitIntoSyllableChunks дає фрагменти de,ve,lop,pe,ment
// (довжини 2,2,3,2,4) -> природна упаковка half-width (330px) -> [4,1]
// (de+ve+lop+pe на рядку 1, "ment" самотнє на рядку 2) -> фікс -> [3,2],
// розрив після фрагмента 2 ("lop") — рядок 2 стає "pe"+"ment" (2
// фрагменти), не один "ment", що виглядав би "самотньою літерою, нема до
// чого прив'язаною".
{
  const { chars, hiddenLetters } = allHiddenWord("developpement");
  const r = letterGapsPracticeLayout(chars, hiddenLetters, REFERENCE_ROW_WIDTH_PX);
  assert(r.cardClass === "long", "letter_gaps: 'developpement' (all hidden) -> long");
  assert(
    JSON.stringify(r.forcedBreaks) === JSON.stringify([{ kind: "afterChunk", unitIndex: 0, chunkIndex: 2 }]),
    "letter_gaps: 'developpement' -> forced break inside the word, after its 3rd syllable chunk ('lop'), not leaving 'ment' alone"
  );
}

// "anticonstitutionnellement" (26 літер, усі приховані) -> 9 фрагментів —
// природна упаковка вже НЕ лишає останній рядок з 1 фрагментом (довший
// текст, більше фрагментів природно розподіляється рівномірніше) —
// жодного розриву не потрібно, той самий принцип, що letter_rearrangement
// n=11/12/20 вище (довший текст не завжди потребує фіксу).
{
  const { chars, hiddenLetters } = allHiddenWord("anticonstitutionnellement");
  const r = letterGapsPracticeLayout(chars, hiddenLetters, REFERENCE_ROW_WIDTH_PX);
  assert(r.cardClass === "long", "letter_gaps: 'anticonstitutionnellement' (all hidden) -> long");
  assert(JSON.stringify(r.forcedBreaks) === "[]", "letter_gaps: 'anticonstitutionnellement' -> natural packing already avoids a lone last chunk");
}

// Порожня фраза (оборонний випадок, не очікується в реальних даних) — не
// крашиться.
{
  const r = letterGapsPracticeLayout([], [], REFERENCE_ROW_WIDTH_PX);
  assert(r.cardClass === "short" && JSON.stringify(r.forcedBreaks) === "[]", "letter_gaps: empty phrase is treated as short, no crash");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All estimate-card-rows (balanced wrap) tests passed.");
