import {
  BLANK_RE,
  getOpenAnswerQuestions,
  getReorderSequences,
  getDragDropSentences,
  getMultipleChoiceItems,
  resolveTrueFalsePoints,
  resolveOpenAnswerPoints,
  resolveMultipleChoicePoints,
  resolveReorderPoints,
  resolveSortColumnsPoints,
  resolveImageMatchPoints,
  resolveListeningPoints,
  resolveDragDropPoints,
  resolveTableFillPoints,
  getTableFillRows,
  getMatchingPairs,
  resolveMatchingPoints,
  resolveFillBlankPoints,
  resolveLetterGapsPoints,
  resolveLetterRearrangementPoints,
  resolveWordChoicePoints,
  resolveWordSearchPoints,
  resolveCheckboxGridPoints,
  resolveChronologicalOrderPoints,
  resolveCrosswordPoints,
  resolveKaraokePoints,
} from "./sanitize";
import { placementCells } from "./word-search-grid";
import { sanitizeWordForGrid } from "./grid-word";
import { EXERCISE_BLOCK_SIZE, chunk } from "./exercise-blocks";
import type {
  FillBlankConfig,
  FillBlankAnswer,
  FillBlankDetail,
  LetterGapsConfig,
  LetterGapsAnswer,
  LetterGapsDetail,
  LetterRearrangementConfig,
  LetterRearrangementAnswer,
  LetterRearrangementDetail,
  MultipleChoiceConfig,
  MultipleChoiceAnswer,
  MultipleChoiceDetail,
  WordChoiceConfig,
  WordChoiceAnswer,
  WordChoiceDetail,
  WordSearchConfig,
  WordSearchAnswer,
  WordSearchDetail,
  CrosswordConfig,
  CrosswordAnswer,
  CrosswordDetail,
  TrueFalseConfig,
  TrueFalseAnswer,
  TrueFalseDetail,
  MatchingConfig,
  MatchingAnswer,
  MatchingDetail,
  ListeningConfig,
  ListeningAnswer,
  ListeningDetail,
  ReorderConfig,
  ReorderAnswer,
  ReorderDetail,
  DragDropConfig,
  DragDropAnswer,
  DragDropDetail,
  SortColumnsConfig,
  SortColumnsAnswer,
  SortColumnsDetail,
  OpenAnswerConfig,
  OpenAnswerAnswer,
  OpenAnswerDetail,
  TableFillConfig,
  TableFillAnswer,
  TableFillDetail,
  ImageMatchConfig,
  ImageMatchAnswer,
  ImageMatchDetail,
  CheckboxGridConfig,
  CheckboxGridAnswer,
  CheckboxGridDetail,
  ChronologicalOrderConfig,
  ChronologicalOrderAnswer,
  ChronologicalOrderDetail,
  KaraokeConfig,
  KaraokeAnswer,
  KaraokeDetail,
  GradeResult,
} from "./types";
import { type GradableTaskType, assertNeverGradableType } from "./gradable-types";

// Порівняння текстових відповідей для ВСІХ типів нижче, що ним користуються
// (fill_blank, letter_gaps, open_answer, table_fill, image_match,
// word_search, crossword, karaoke): регістр і зовнішні пробіли байдужі,
// апостроф будь-якого стилю (типографський ’/‘/ʼ) прирівнюється до
// звичайного "'" (студент фізично не набере ’ з клавіатури), кілька
// пробілів підряд стискаються в один. ДІАКРИТИКА НЕ ПРИБИРАЄТЬСЯ — "café" і
// "cafe" НЕ вважаються однаковим — свідомий вибір (мовна точність), а не
// недогляд. Виключно розширення (усе, що збігалось раніше, збігається й
// далі) — не може зламати жоден наявний тип.
const APOSTROPHE_VARIANTS_RE = /[‘’ʼ]/g;

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(APOSTROPHE_VARIANTS_RE, "'")
    .replace(/\s+/g, " ");
}

function percentage(correctCount: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correctCount / total) * 100);
}

// Спільний розподіл балів з урахуванням підказок — для letter_gaps/
// letter_rearrangement/word_search/crossword, усі 4 з ОДНІЄЮ спільною
// точкою балів на всю вправу (points на конфізі, не на елемент), а не
// частковими per-елемент points, як у "Групі B" інших типів. correct/score
// НЕ залежать від підказок узагалі (isCorrect по кожному елементу лишається
// джерелом правди для проходження/відсотка) — підказки впливають ЛИШЕ на
// цей окремий, опційний шар балів.
//
// hintsReducePoints вимкнено (дефолт, і всі наявні вправи до появи цієї
// фічі) — ЧАСТКОВИЙ залік, пропорційний частці правильних елементів:
// pointsEarned = round(points * correctCount / elements.length). До цього
// тут було "все-або-нічого" (round-цінка інакше не потрібна: за 100%
// correctCount === elements.length, і формула сама дає points без остачі).
// gradeWordChoice (grade.ts, окремо нижче) рахує ту саму частку inline —
// не через цю функцію, бо WordChoiceConfig взагалі не має hintsReducePoints
// (для нього тут ніколи не було другої гілки, яку варто перевикористати).
//
// Увімкнено — points ділиться порівну між елементами (perElement =
// points/count); елемент, де підказку НЕ використовували, дає свою повну
// частку, якщо він correct; елемент із підказкою — половину частки, теж
// лише якщо зрештою correct (сама підказка не "купує" бали за неправильну
// відповідь, лише зменшує їх за правильну). Ця гілка й так завжди була
// частковим заліком — не займана.
function pointsWithHints(
  points: number,
  elements: { isCorrect: boolean; hintUsed: boolean }[],
  hintsReducePoints: boolean
): number {
  if (elements.length === 0) return 0;
  if (!hintsReducePoints) {
    const correctCount = elements.filter((e) => e.isCorrect).length;
    return Math.round((points * correctCount) / elements.length);
  }
  const perElement = points / elements.length;
  return elements.reduce((sum, e) => {
    if (!e.isCorrect) return sum;
    return sum + (e.hintUsed ? perElement * 0.5 : perElement);
  }, 0);
}

// Частка config.points для ОДНОГО блоку (letter_gaps/letter_rearrangement,
// exercise-blocks.ts: блоки по EXERCISE_BLOCK_SIZE слів, коли слів більше)
// — усі блоки, КРІМ ОСТАННЬОГО, отримують свою незалежно округлену
// пропорційну частку (round(total * розмір_блоку / усього_слів)); залишок
// округлення (total - сума округлених часток) іде НА ОСТАННІЙ блок, щоб
// сума pointsPossible по всіх блоках вправи завжди точно дорівнювала
// config.points. Раніше кожен блок рахувався незалежно й округлення могло
// не зійтись (13 слів/100 балів, EXERCISE_BLOCK_SIZE=10: блоки [10,3] —
// round(100*10/13)=77, round(100*3/13)=23, сума 100 — тут якраз зійшлось,
// але для інших N/points — ні, звідси й фікс).
//
// answeredIndices — які САМЕ індекси слів прийшли в answer цього виклику
// (уже відфільтровані вище на "реально присутній масив", не null) —
// співставляється з ТИМ САМИМ чанкуванням, що на клієнті (chunk з
// exercise-blocks.ts, той самий EXERCISE_BLOCK_SIZE), щоб визначити, який
// це блок за порядком і чи він останній. Якщо відповідь не збігається
// ЖОДНИМ повним блоком (нестандартний виклик API напряму, не через UI) —
// фолбек на просту пропорційну частку без гарантії суми, той самий
// розрахунок, що був до цього фіксу.
function blockPointsPossible(totalPoints: number, totalCount: number, answeredIndices: number[]): number {
  if (totalCount === 0) return 0;
  const chunks = chunk(
    Array.from({ length: totalCount }, (_, i) => i),
    EXERCISE_BLOCK_SIZE
  );
  const answeredSet = new Set(answeredIndices);
  const chunkIndex = chunks.findIndex(
    (c) => c.length === answeredIndices.length && c.every((i) => answeredSet.has(i))
  );
  if (chunkIndex === -1) {
    return Math.round((totalPoints * answeredIndices.length) / totalCount);
  }
  if (chunkIndex < chunks.length - 1) {
    return Math.round((totalPoints * chunks[chunkIndex].length) / totalCount);
  }
  const precedingSum = chunks
    .slice(0, chunks.length - 1)
    .reduce((sum, c) => sum + Math.round((totalPoints * c.length) / totalCount), 0);
  return totalPoints - precedingSum;
}

function gradeFillBlank(config: FillBlankConfig, answer: FillBlankAnswer): GradeResult {
  const blanksAcceptable = [...config.template.matchAll(BLANK_RE)].map((m) =>
    m[1].split("|").map((s) => normalize(s))
  );
  const studentAnswers = answer?.answers ?? [];
  const hintedSet = new Set(answer?.hintedBlanks ?? []);

  const blanks: FillBlankDetail["blanks"] = blanksAcceptable.map((accepted, i) => {
    const studentAnswer = studentAnswers[i] ?? "";
    const isCorrect = accepted.includes(normalize(studentAnswer));
    return { studentAnswer, correctAnswers: accepted, isCorrect, hintUsed: hintedSet.has(i) };
  });

  const correctCount = blanks.filter((b) => b.isCorrect).length;
  const correct = correctCount === blanks.length && blanks.length > 0;
  // POINTS — на всю вправу (не на пропуск, підтверджений компроміс, бо
  // template — вільний текст без структурної адресації пропусків):
  // pointsWithHints ділить ці бали пропорційно частці правильних пропусків
  // (елемент — пропуск, як і для detail.blanks вище); з hintsReducePoints —
  // та сама пропорція, лише з додатковою половинною знижкою за підказку.
  const points = resolveFillBlankPoints(config);

  return {
    correct,
    score: percentage(correctCount, blanks.length),
    detail: { blanks },
    pointsEarned: pointsWithHints(points, blanks, !!config.hintsReducePoints),
    pointsPossible: points,
  };
}

// Той самий принцип, що gradeFillBlank: один пул балів на все завдання, а
// не на слово/літеру — pointsWithHints ділить його пропорційно частці
// повністю правильних слів. normalize() — та сама конвенція, що для
// текстових пропусків (регістр/апостроф/пробіли байдужі, діакритика — ні).
function gradeLetterGaps(config: LetterGapsConfig, answer: LetterGapsAnswer): GradeResult {
  const studentLettersByWord = answer?.letters ?? [];
  const hintedSet = new Set(answer?.hintedWordIndices ?? []);
  const words: LetterGapsDetail["words"] = config.words.map((w, wi) => {
    const correctLetters = w.hiddenIndices.map((idx) => w.word[idx]);
    const studentLetters = studentLettersByWord[wi] ?? [];
    const isCorrect = correctLetters.every(
      (c, li) => normalize(c) === normalize(studentLetters[li] ?? "")
    );
    return { studentLetters, correctLetters, isCorrect, hintUsed: hintedSet.has(wi) };
  });

  // Скоуп — за словами, де answer.letters РЕАЛЬНО має масив на цій позиції
  // (не undefined/null): letter-gaps.tsx для вправ >10 слів
  // (exercise-blocks.ts) шле по БЛОКУ — letters лишається позиційним
  // масивом на ВСЮ вправу (config.words.length), лише з "дірками" на
  // позиціях слів поза поточним блоком (JSON перетворює їх на null).
  // detail.words НАВМИСНО лишається повної довжини (нижче, по одному
  // елементу на КОЖНЕ слово, за вихідним wi) — на відміну від matching,
  // тут немає id, лише позиційний індекс, і letter-gaps.tsx читає
  // detail.words[wi] напряму за глобальним wi в обох режимах; звужені
  // лише "рахункові" поля (score/correct/points) нижче. Для ≤10 слів
  // (один "блок" = уся вправа) letter-gaps.tsx ініціалізує answers одразу
  // для ВСІХ слів (dense масив від монтування) — тож кожен
  // studentLettersByWord[wi] завжди справжній масив, скоуп збігається з
  // усіма словами, поведінка НЕ змінюється.
  const answeredIndices = config.words.map((_, wi) => wi).filter((wi) => Array.isArray(studentLettersByWord[wi]));
  const scopedWords = answeredIndices.map((wi) => words[wi]);

  const correctCount = scopedWords.filter((w) => w.isCorrect).length;
  const correct = correctCount === scopedWords.length && scopedWords.length > 0;
  // pointsPossible — частка config.points ЦЬОГО блоку (blockPointsPossible
  // вище): для ≤10 слів — завжди всі слова, тобто весь points, як і
  // раніше; для >10 — залишок округлення йде на ОСТАННІЙ блок, тож сума
  // pointsPossible по всіх блоках вправи завжди точно дорівнює config.points.
  const totalPoints = resolveLetterGapsPoints(config);
  const points = blockPointsPossible(totalPoints, config.words.length, answeredIndices);

  return {
    correct,
    score: percentage(correctCount, scopedWords.length),
    detail: { words },
    pointsEarned: pointsWithHints(points, scopedWords, !!config.hintsReducePoints),
    pointsPossible: points,
  };
}

// Той самий принцип, що gradeReorder: порівняння ПОЗИЦІЙНЕ (studentOrder[i]
// === correctWord[i]), не пошуком значення — коректно для дублікатів літер
// (напр. "chocolat"), без додаткової розмітки identity. Без normalize() —
// на відміну від gradeLetterGaps, студент тут не типить, а лише пересуває
// вже готові плитки з точними символами, регістр не є UX-невизначеністю.
// Один бал на все завдання (як gradeLetterGaps), не на слово.
function gradeLetterRearrangement(
  config: LetterRearrangementConfig,
  answer: LetterRearrangementAnswer
): GradeResult {
  const studentOrderByWord = answer?.words ?? [];
  const hintedSet = new Set(answer?.hintedWordIndices ?? []);
  const words: LetterRearrangementDetail["words"] = config.words.map((w, wi) => {
    const correctWord = w.word.split("");
    const studentOrder = studentOrderByWord[wi] ?? [];
    const letters = correctWord.map((text, correctIndex) => ({
      text,
      correctIndex,
      isCorrect: studentOrder[correctIndex] === text,
    }));
    return { letters, isCorrect: letters.every((l) => l.isCorrect), hintUsed: hintedSet.has(wi) };
  });

  // Той самий скоуп-за-присутністю-масиву й той самий компроміс з
  // detail.words повної довжини, що gradeLetterGaps вище (letter-
  // rearrangement.tsx має ту саму позиційну структуру answer.words, ту саму
  // гарантію dense-масиву для ≤10 слів).
  const answeredIndices = config.words.map((_, wi) => wi).filter((wi) => Array.isArray(studentOrderByWord[wi]));
  const scopedWords = answeredIndices.map((wi) => words[wi]);

  const correctCount = scopedWords.filter((w) => w.isCorrect).length;
  const correct = correctCount === scopedWords.length && scopedWords.length > 0;
  // pointsPossible — той самий blockPointsPossible, що gradeLetterGaps
  // (залишок округлення на останній блок).
  const totalPoints = resolveLetterRearrangementPoints(config);
  const points = blockPointsPossible(totalPoints, config.words.length, answeredIndices);

  return {
    correct,
    score: percentage(correctCount, scopedWords.length),
    detail: { words },
    pointsEarned: pointsWithHints(points, scopedWords, !!config.hintsReducePoints),
    pointsPossible: points,
  };
}

// Атомарна одиниця часткового заліку — ціле речення (усередині нього нема
// під-структури для розбиття, на відміну від пропусків у drag_drop), той
// самий принцип, що gradeListening.
function gradeMultipleChoice(
  config: MultipleChoiceConfig,
  answer: MultipleChoiceAnswer
): GradeResult {
  const items = getMultipleChoiceItems(config);
  const answerByItem = new Map((answer ?? []).map((a) => [a.itemId, new Set(a.selected)]));

  const itemsDetail: MultipleChoiceDetail["items"] = items.map((item) => {
    const selected = answerByItem.get(item.id) ?? new Set<string>();
    const options = item.options.map((o) => ({
      id: o.id,
      text: o.text,
      correct: o.correct,
      selected: selected.has(o.id),
    }));
    return { id: item.id, options, points: resolveMultipleChoicePoints(item) };
  });

  const fullyCorrect = itemsDetail.filter((it) => it.options.every((o) => o.correct === o.selected));
  const correctCount = fullyCorrect.length;
  const pointsPossible = itemsDetail.reduce((sum, it) => sum + it.points, 0);
  const pointsEarned = fullyCorrect.reduce((sum, it) => sum + it.points, 0);

  return {
    correct: correctCount === itemsDetail.length && itemsDetail.length > 0,
    score: percentage(correctCount, itemsDetail.length),
    detail: { items: itemsDetail },
    pointsEarned,
    pointsPossible,
  };
}

// Той самий принцип порівняння, що gradeMultipleChoice (options.every(o =>
// o.correct === o.selected)) — це вже коректно звіряє МНОЖИНИ обраних/
// правильних (не лише один-до-одного), тож підтримка кількох правильних на
// речення не потребує нової логіки, лише Set замість одного id. Працює без
// розгалуження по mode: студентський компонент сам звів обидва режими
// (select/cross_out) до однієї selected[]-форми ще до сабміту. На відміну
// від gradeMultipleChoice — бали НЕ на речення, а на всю вправу (як
// gradeLetterGaps), пропорційно частці правильних речень (round(points *
// correctCount / sentences.length), той самий принцип, що pointsWithHints
// вище) — не через саму pointsWithHints, бо WordChoiceConfig не має
// hintsReducePoints (нема другої гілки, яку тут перевикористовувати).
// score лишається per-речення відсотком (незалежний вимір, та сама частка).
function gradeWordChoice(config: WordChoiceConfig, answer: WordChoiceAnswer): GradeResult {
  const answerBySentence = new Map((answer ?? []).map((a) => [a.sentenceId, new Set(a.selected)]));

  const sentences: WordChoiceDetail["sentences"] = config.sentences.map((s) => {
    const selected = answerBySentence.get(s.id) ?? new Set<string>();
    const options = s.options.map((o) => ({
      id: o.id,
      text: o.text,
      correct: o.correct,
      selected: selected.has(o.id),
    }));
    return { id: s.id, options, isCorrect: options.every((o) => o.correct === o.selected) };
  });

  const correctCount = sentences.filter((s) => s.isCorrect).length;
  const correct = correctCount === sentences.length && sentences.length > 0;
  const points = resolveWordChoicePoints(config);

  return {
    correct,
    score: percentage(correctCount, sentences.length),
    detail: { sentences },
    pointsEarned: sentences.length > 0 ? Math.round((points * correctCount) / sentences.length) : 0,
    pointsPossible: points,
  };
}

function cellsMatch(a: { row: number; col: number }[], b: { row: number; col: number }[]): boolean {
  return a.length === b.length && a.every((c, i) => c.row === b[i].row && c.col === b[i].col);
}

// Координати, не текст/клієнтський вердикт — той самий принцип, що
// gradeReorder (порівняння позиційне, а не пошуком значення). Студент міг
// виділити слово з БУДЬ-ЯКОГО кінця лінії (природний жест — не знає
// наперед, з якого краю "правильний" початок), тож звіряємо з placement
// АБО його реверсом. points — на всю вправу (як gradeLetterGaps), не на
// слово: pointsWithHints ділить його пропорційно частці знайдених слів
// (score — та сама частка, foundCount/words.length, лише у відсотках); found
// у detail лишається per-слово — і для візуального фідбеку/легенди, і як
// вхід у саму пропорцію балів.
function gradeWordSearch(config: WordSearchConfig, answer: WordSearchAnswer): GradeResult {
  const answerByWord = new Map((answer?.found ?? []).map((a) => [a.word, a.cells]));
  const hintedSet = new Set(answer?.hintedWords ?? []);

  const words: WordSearchDetail["words"] = config.words.map((w) => {
    // placement.word завжди ВЕРХНІМ регістром і БЕЗ пробілів/апострофів/
    // дефісів (word-search-grid.ts — генератор нормалізує перед
    // розміщенням у сітці, sanitizeWordForGrid), а w.word лишається таким,
    // як набрала вчителька/як у словнику (легенда показує саме його, з
    // дефісом/апострофом) — без тієї самої нормалізації тут === ніколи не
    // збігався б для будь-якого слова з такими символами, і gradeWordSearch
    // завжди повертав би found: false.
    const placement = config.placements.find((p) => p.word === sanitizeWordForGrid(w.word).toUpperCase());
    const hintUsed = hintedSet.has(w.word);
    if (!placement) return { word: w.word, found: false, hintUsed };

    const target = placementCells(placement, w.word.length);
    const studentCells = answerByWord.get(w.word) ?? [];
    const found = cellsMatch(studentCells, target) || cellsMatch(studentCells, [...target].reverse());
    return { word: w.word, found, hintUsed };
  });

  const foundCount = words.filter((w) => w.found).length;
  const correct = foundCount === words.length && words.length > 0;
  const points = resolveWordSearchPoints(config);

  return {
    correct,
    score: percentage(foundCount, words.length),
    detail: { words },
    pointsEarned: pointsWithHints(
      points,
      words.map((w) => ({ isCorrect: w.found, hintUsed: w.hintUsed })),
      !!config.hintsReducePoints
    ),
    pointsPossible: points,
  };
}

// На відміну від gradeWordSearch (координатна звірка — студент лише
// виділяє вже готові літери), тут студент ТИПИТЬ, тож звірка — по
// нормалізованому тексту (normalize(), як gradeLetterGaps), не по
// координатах. Клітинки СПІЛЬНІ між словами, що перетинаються (answer —
// єдина 2D-мапа клітинка→літера, не масив на слово), тож кожне слово читає
// СВОЇ клітинки (placementCells, той самий генерик, що word_search) із
// цієї спільної мапи — правильність клітинки на перетині автоматично
// узгоджена для обох слів, бо адмінський генератор гарантує однакову
// літеру там (crossword-grid.ts: fits() дозволяє перетин лише з тим самим
// символом). Один бал на все завдання (як gradeWordSearch/gradeLetterGaps).
function gradeCrossword(config: CrosswordConfig, answer: CrosswordAnswer): GradeResult {
  const grid = answer?.grid ?? [];
  const hintedSet = new Set((answer?.hintedWords ?? []).map((h) => `${h.number}-${h.direction}`));
  const words: CrosswordDetail["words"] = config.placements.map((p) => {
    const cells = placementCells(p, p.word.length);
    const studentWord = cells.map(({ row, col }) => grid[row]?.[col] ?? "").join("");
    const isCorrect = normalize(studentWord) === normalize(p.word);
    const hintUsed = hintedSet.has(`${p.number}-${p.direction}`);
    return { number: p.number, direction: p.direction, word: p.word, isCorrect, hintUsed };
  });

  const correctCount = words.filter((w) => w.isCorrect).length;
  const correct = correctCount === words.length && words.length > 0;
  const points = resolveCrosswordPoints(config);

  return {
    correct,
    score: percentage(correctCount, words.length),
    detail: { words },
    pointsEarned: pointsWithHints(points, words, !!config.hintsReducePoints),
    pointsPossible: points,
  };
}

// Пілот системи балів — pointsEarned/pointsPossible рахуються ПОРЯД зі
// score (не замість): score лишається тим самим percentage, що й завжди.
function gradeTrueFalse(config: TrueFalseConfig, answer: TrueFalseAnswer): GradeResult {
  const answerById = new Map(answer.map((a) => [a.id, a.value]));

  const statements: TrueFalseDetail["statements"] = config.statements.map((s) => {
    const studentAnswer = answerById.get(s.id) ?? null;
    return {
      id: s.id,
      text: s.text,
      correctAnswer: s.answer,
      studentAnswer,
      isCorrect: studentAnswer === s.answer,
      points: resolveTrueFalsePoints(s),
    };
  });

  const correctCount = statements.filter((s) => s.isCorrect).length;
  const pointsPossible = statements.reduce((sum, s) => sum + s.points, 0);
  const pointsEarned = statements
    .filter((s) => s.isCorrect)
    .reduce((sum, s) => sum + s.points, 0);

  return {
    correct: correctCount === statements.length && statements.length > 0,
    score: percentage(correctCount, statements.length),
    detail: { statements },
    pointsEarned,
    pointsPossible,
  };
}

function gradeMatching(config: MatchingConfig, answer: MatchingAnswer): GradeResult {
  // getMatchingPairs (sanitize.ts) — ЄДИНЕ спільне джерело, що вже відкидає
  // неповні пари (без лівої чи правої частини): студент ніколи не бачив їх
  // (sanitizeMatching), тож рахувати score/бали проти сирого config.pairs
  // тут означало б вимагати відповідь на пару, якої студент і не міг
  // ввести — score ніколи не досяг би 100%. completePairs замінює
  // config.pairs УСЮДИ нижче (score, correct, detail.correctPairs, бали).
  //
  // Скоуп — за LEFT-значеннями, що реально прийшли в answer, не за ВСІМА
  // completePairs: matching.tsx для вправ >10 елементів ділить пари на
  // блоки (matching-blocks.ts) і "Перевірити" кожного блоку шле лише пари
  // ЦЬОГО блоку — без цього фільтра denominator (score/pointsPossible)
  // завжди був би на всю вправу, і перевірка одного повністю правильного
  // блоку з 3 показувала б лише ~33%. Для ≤10 елементів (один "блок" = уся
  // вправа) кнопка "Перевірити" заблокована, доки заповнені не ВСІ left
  // (matching.tsx), тож answer і так завжди покриває 100% пар — цей фільтр
  // для такого випадку не звужує нічого, і поведінка НЕ змінюється.
  const answeredLefts = new Set(answer.map((a) => a.left));
  const completePairs = getMatchingPairs(config).filter((p) => answeredLefts.has(p.left));

  // Пари не мають id, тому порівнюємо left/right як окремі поля структурно,
  // а не через склеєний рядок — конкатенація неоднозначна, якщо межа між
  // ними зсувається (напр. "a b"+"c" і "a"+"b c" можуть дати той самий ключ).
  const studentPairs: MatchingDetail["studentPairs"] = answer.map((a) => ({
    left: a.left,
    right: a.right,
    isCorrect: completePairs.some((p) => p.left === a.left && p.right === a.right),
  }));

  const correctCount = studentPairs.filter((p) => p.isCorrect).length;

  // POINTS — окремий прохід, зі СПРОТИВНОГО напрямку за studentPairs вище
  // (по config-парах, а не по відповідях студента): для кожної пари з
  // completePairs (уже з id) перевіряємо, чи вона є серед відповідей
  // студента. Пара — вже атомарна одиниця (без під-структури), тож бали
  // просто по парі, як у true_false/sort_columns.
  const pairPoints: MatchingDetail["pairPoints"] = completePairs.map((p) => ({
    id: p.id,
    left: p.left,
    points: resolveMatchingPoints(p),
    isCorrect: answer.some((a) => a.left === p.left && a.right === p.right),
  }));
  const pointsPossible = pairPoints.reduce((sum, p) => sum + p.points, 0);
  const pointsEarned = pairPoints.filter((p) => p.isCorrect).reduce((sum, p) => sum + p.points, 0);

  return {
    correct: correctCount === completePairs.length && studentPairs.length === completePairs.length,
    score: percentage(correctCount, completePairs.length),
    detail: { correctPairs: completePairs, studentPairs, pairPoints },
    pointsEarned,
    pointsPossible,
  };
}

function gradeListening(config: ListeningConfig, answer: ListeningAnswer): GradeResult {
  const answerByQuestion = new Map(answer.map((a) => [a.questionId, a.optionId]));

  const questions: ListeningDetail["questions"] = config.questions.map((q) => {
    const selectedId = answerByQuestion.get(q.id);
    return {
      id: q.id,
      question: q.question,
      options: q.options.map((o) => ({
        id: o.id,
        text: o.text,
        correct: o.correct,
        selected: o.id === selectedId,
      })),
      points: resolveListeningPoints(q),
    };
  });

  const fullyCorrect = questions.filter((q) => q.options.every((o) => o.correct === o.selected));
  const correctCount = fullyCorrect.length;
  const pointsPossible = questions.reduce((sum, q) => sum + q.points, 0);
  const pointsEarned = fullyCorrect.reduce((sum, q) => sum + q.points, 0);

  return {
    correct: correctCount === questions.length && questions.length > 0,
    score: percentage(correctCount, questions.length),
    detail: { questions },
    pointsEarned,
    pointsPossible,
  };
}

function gradeReorder(config: ReorderConfig, answer: ReorderAnswer): GradeResult {
  const sequences = getReorderSequences(config);
  const answerBySequence = new Map((answer ?? []).map((a) => [a.sequenceId, a.order]));

  const sequencesDetail: ReorderDetail["sequences"] = sequences.map((seq) => {
    const studentOrder = answerBySequence.get(seq.id) ?? [];
    // Порівняння за позицією, а не пошуком тексту (indexOf) — items можуть
    // містити дублікати (той самий текст двічі), і пошук за значенням
    // завжди знаходить лише перше входження, ігноруючи решту.
    const items = seq.items.map((text, correctIndex) => {
      const studentIndex = correctIndex;
      return { text, correctIndex, studentIndex, isCorrect: studentOrder[correctIndex] === text };
    });
    return { id: seq.id, items, points: resolveReorderPoints(seq) };
  });

  // Атомарна одиниця часткового заліку для SCORE — кожна плитка-позиція
  // через УСІ послідовності разом, а не "послідовність повністю правильна
  // чи ні". POINTS — окремий вимір, свідомо іншої гранулярності: бали
  // послідовності зараховуються, лише якщо вона ВСЯ правильна.
  const allItems = sequencesDetail.flatMap((s) => s.items);
  const correctCount = allItems.filter((i) => i.isCorrect).length;
  const pointsPossible = sequencesDetail.reduce((sum, s) => sum + s.points, 0);
  const pointsEarned = sequencesDetail
    .filter((s) => s.items.every((i) => i.isCorrect))
    .reduce((sum, s) => sum + s.points, 0);

  return {
    correct: correctCount === allItems.length && allItems.length > 0,
    score: percentage(correctCount, allItems.length),
    detail: { sequences: sequencesDetail },
    pointsEarned,
    pointsPossible,
  };
}

// drag_drop — кожне речення перевіряється тим самим алгоритмом, що
// fill_blank (один правильний варіант на пропуск, вбудований у template);
// поле bank на перевірку не впливає. Атомарна одиниця часткового заліку —
// кожен пропуск через УСІ речення разом, не "речення повністю правильне чи
// ні" — той самий принцип, що для reorder.
function gradeDragDrop(config: DragDropConfig, answer: DragDropAnswer): GradeResult {
  const sentences = getDragDropSentences(config);
  const answerBySentence = new Map((answer ?? []).map((a) => [a.sentenceId, a.words]));

  const sentencesDetail: DragDropDetail["sentences"] = sentences.map((s) => {
    const words = answerBySentence.get(s.id) ?? [];
    const fbResult = gradeFillBlank({ template: s.template }, { answers: words, hintedBlanks: [] });
    return {
      id: s.id,
      blanks: (fbResult.detail as FillBlankDetail).blanks,
      points: resolveDragDropPoints(s),
    };
  });

  const allBlanks = sentencesDetail.flatMap((s) => s.blanks);
  const correctCount = allBlanks.filter((b) => b.isCorrect).length;
  // POINTS — окремий вимір, свідомо іншої гранулярності за SCORE (див.
  // reorder): бали речення зараховуються, лише якщо ВОНО повністю
  // правильне (усі пропуски), тоді як score рахує кожен пропуск атомарно
  // через усі речення разом.
  const pointsPossible = sentencesDetail.reduce((sum, s) => sum + s.points, 0);
  const pointsEarned = sentencesDetail
    .filter((s) => s.blanks.every((b) => b.isCorrect))
    .reduce((sum, s) => sum + s.points, 0);

  return {
    correct: correctCount === allBlanks.length && allBlanks.length > 0,
    score: percentage(correctCount, allBlanks.length),
    detail: { sentences: sentencesDetail },
    pointsEarned,
    pointsPossible,
  };
}

function gradeSortColumns(config: SortColumnsConfig, answer: SortColumnsAnswer): GradeResult {
  const answerByItem = new Map(answer.map((a) => [a.itemId, a.columnId]));
  const labelById = new Map(config.columns.map((c) => [c.id, c.label]));

  const items: SortColumnsDetail["items"] = config.items.map((item) => {
    const studentColumnId = answerByItem.get(item.id) ?? null;
    return {
      id: item.id,
      text: item.text,
      correctColumnId: item.columnId,
      correctColumnLabel: labelById.get(item.columnId) ?? item.columnId,
      studentColumnId,
      isCorrect: studentColumnId === item.columnId,
      points: resolveSortColumnsPoints(item),
    };
  });

  const correctCount = items.filter((i) => i.isCorrect).length;
  const pointsPossible = items.reduce((sum, i) => sum + i.points, 0);
  const pointsEarned = items.filter((i) => i.isCorrect).reduce((sum, i) => sum + i.points, 0);

  return {
    correct: correctCount === items.length && items.length > 0,
    score: percentage(correctCount, items.length),
    detail: { items },
    pointsEarned,
    pointsPossible,
  };
}

function gradeOpenAnswer(config: OpenAnswerConfig, answer: OpenAnswerAnswer): GradeResult {
  const answerByQuestion = new Map((answer ?? []).map((a) => [a.questionId, a.value]));

  const questions: OpenAnswerDetail["questions"] = getOpenAnswerQuestions(config).map((q) => {
    const accepted = q.answers.map((a) => normalize(a));
    const studentAnswer = answerByQuestion.get(q.id) ?? "";
    return {
      id: q.id,
      question: q.question,
      studentAnswer,
      correctAnswers: q.answers,
      isCorrect: accepted.includes(normalize(studentAnswer)),
      points: resolveOpenAnswerPoints(q),
    };
  });

  const correctCount = questions.filter((q) => q.isCorrect).length;
  const pointsPossible = questions.reduce((sum, q) => sum + q.points, 0);
  const pointsEarned = questions.filter((q) => q.isCorrect).reduce((sum, q) => sum + q.points, 0);

  return {
    correct: correctCount === questions.length && questions.length > 0,
    score: percentage(correctCount, questions.length),
    detail: { questions },
    pointsEarned,
    pointsPossible,
  };
}

function gradeTableFill(config: TableFillConfig, answer: TableFillAnswer): GradeResult {
  const answerMap = new Map((answer?.cells ?? []).map((a) => [`${a.rowId}:${a.side}`, a.value]));
  const hintedSet = new Set((answer?.hintedCells ?? []).map((h) => `${h.rowId}:${h.side}`));
  // Скоуп — за rowId, присутніми в answer.cells: table-fill.tsx для вправ
  // >10 рядків (exercise-blocks.ts) шле лише клітинки поточного блоку
  // (кожен рядок блоку — і незаповнені клітинки теж, порожнім рядком, щоб
  // rowId лишався присутнім). Для ≤10 рядків (один "блок" = уся вправа)
  // типове використання (усе видиме заповнено, тоді "Перевірити") і так
  // покриває всі рядки — поведінка НЕ змінюється. Рідкісний випадок
  // дострокового сабміту з дійсно НЕЗАЙМАНОЮ клітинкою (кнопка
  // "Перевірити" тут і раніше не блокувалась на неповноті, на відміну від
  // matching) тепер не рахується в pointsPossible замість "вважається
  // неправильною" — прийнятний компроміс без зміни формату TableFillAnswer.
  const answeredRowIds = new Set((answer?.cells ?? []).map((c) => c.rowId));

  const blanks: TableFillDetail["blanks"] = [];
  // getTableFillRows (sanitize.ts) — рядок без лівої чи правої частини не
  // потрапляє студенту (sanitizeTableFill), тож і тут не повинен впливати
  // на score/бали — той самий принцип, що completePairs у gradeMatching.
  for (const row of getTableFillRows(config)) {
    if (!answeredRowIds.has(row.id)) continue;
    const rowPoints = resolveTableFillPoints(row);
    (["left", "right"] as const).forEach((side) => {
      const hidden = side === "left" ? row.leftHidden : row.rightHidden;
      if (!hidden) return;

      const rawValue = side === "left" ? row.left : row.right;
      const accepted = rawValue.split("|").map((s) => normalize(s));
      const studentAnswer = answerMap.get(`${row.id}:${side}`) ?? "";
      const isCorrect = accepted.includes(normalize(studentAnswer));
      blanks.push({
        rowId: row.id,
        side,
        studentAnswer,
        correctAnswers: accepted,
        isCorrect,
        points: rowPoints,
        hintUsed: hintedSet.has(`${row.id}:${side}`),
      });
    });
  }

  const correctCount = blanks.filter((b) => b.isCorrect).length;

  // POINTS — на рівні РЯДКА (не клітинки), окремий вимір за score: рядок
  // зараховується цілком, лише якщо ВСІ його приховані клітинки правильні.
  // Рядки без жодної прихованої клітинки взагалі не потрапляють у blanks
  // вище, тому не впливають ні на pointsEarned, ні на pointsPossible.
  // hintsReducePoints — "елемент" тут РЯДОК (та сама гранулярність, що
  // points): якщо хоч одна з прихованих клітинок рядка була відкрита
  // підказкою, увесь правильний рядок дає 50%, а не лише та клітинка.
  const blanksByRow = new Map<string, TableFillDetail["blanks"]>();
  for (const b of blanks) {
    const arr = blanksByRow.get(b.rowId) ?? [];
    arr.push(b);
    blanksByRow.set(b.rowId, arr);
  }
  let pointsPossible = 0;
  let pointsEarned = 0;
  for (const rowBlanks of blanksByRow.values()) {
    const rowPoints = rowBlanks[0].points;
    pointsPossible += rowPoints;
    if (!rowBlanks.every((b) => b.isCorrect)) continue;
    const rowHinted = config.hintsReducePoints && rowBlanks.some((b) => b.hintUsed);
    pointsEarned += rowHinted ? rowPoints * 0.5 : rowPoints;
  }

  return {
    correct: correctCount === blanks.length && blanks.length > 0,
    score: percentage(correctCount, blanks.length),
    detail: { blanks },
    pointsEarned,
    pointsPossible,
  };
}

// checkbox_grid — той самий принцип, що gradeTableFill: плаский список
// клітинок (тут — усі рядок×колонка, не лише "приховані"), score атомарний
// по клітинках, points групуються по рядку (зараховується цілком, лише
// якщо ВСІ клітинки рядка збігаються з очікуваним станом — і хибний
// позитив, і хибний негатив псують рядок).
function gradeCheckboxGrid(config: CheckboxGridConfig, answer: CheckboxGridAnswer): GradeResult {
  const answerByRow = new Map(answer.map((a) => [a.rowId, new Set(a.columnIds)]));

  const cells: CheckboxGridDetail["cells"] = [];
  for (const row of config.rows) {
    const rowPoints = resolveCheckboxGridPoints(row);
    const studentColumnIds = answerByRow.get(row.id) ?? new Set<string>();
    const correctColumnIds = new Set(row.correctColumnIds);
    for (const column of config.columns) {
      const studentChecked = studentColumnIds.has(column.id);
      const correctChecked = correctColumnIds.has(column.id);
      cells.push({
        rowId: row.id,
        columnId: column.id,
        studentChecked,
        correctChecked,
        isCorrect: studentChecked === correctChecked,
        points: rowPoints,
      });
    }
  }

  const correctCount = cells.filter((c) => c.isCorrect).length;

  const cellsByRow = new Map<string, CheckboxGridDetail["cells"]>();
  for (const c of cells) {
    const arr = cellsByRow.get(c.rowId) ?? [];
    arr.push(c);
    cellsByRow.set(c.rowId, arr);
  }
  let pointsPossible = 0;
  let pointsEarned = 0;
  for (const rowCells of cellsByRow.values()) {
    pointsPossible += rowCells[0].points;
    if (rowCells.every((c) => c.isCorrect)) pointsEarned += rowCells[0].points;
  }

  return {
    correct: correctCount === cells.length && cells.length > 0,
    score: percentage(correctCount, cells.length),
    detail: { cells },
    pointsEarned,
    pointsPossible,
  };
}

// Просте порівняння по id (як gradeSortColumns), а не трюк gradeDragDrop
// із синтетичним {{}}-шаблоном — тут рівно один правильний варіант на
// картинку, без pipe-альтернатив, тож текстовий шаблон тільки ускладнив би.
function gradeImageMatch(config: ImageMatchConfig, answer: ImageMatchAnswer): GradeResult {
  const answerByItem = new Map(answer.map((a) => [a.itemId, a.name]));

  const items: ImageMatchDetail["items"] = config.items.map((item) => {
    const studentName = answerByItem.get(item.id) ?? "";
    return {
      id: item.id,
      imageUrl: item.imageUrl,
      correctName: item.name,
      studentName,
      isCorrect: normalize(studentName) === normalize(item.name),
      points: resolveImageMatchPoints(item),
    };
  });

  const correctCount = items.filter((i) => i.isCorrect).length;
  const pointsPossible = items.reduce((sum, i) => sum + i.points, 0);
  const pointsEarned = items.filter((i) => i.isCorrect).reduce((sum, i) => sum + i.points, 0);

  return {
    correct: correctCount === items.length && items.length > 0,
    score: percentage(correctCount, items.length),
    detail: { items },
    pointsEarned,
    pointsPossible,
  };
}

// chronological_order — правильна позиція елемента = його індекс у
// config.items (масив УЖЕ в правильному хронологічному порядку, перемішаний
// лише в sanitizeChronologicalOrder для показу). Кожен елемент
// самодостатній, той самий item-рівень, що gradeImageMatch — без
// групування по "рядку", на відміну від table_fill/checkbox_grid.
function gradeChronologicalOrder(
  config: ChronologicalOrderConfig,
  answer: ChronologicalOrderAnswer
): GradeResult {
  const answerByItem = new Map(answer.map((a) => [a.itemId, a.position]));

  const items: ChronologicalOrderDetail["items"] = config.items.map((item, index) => {
    const correctPosition = index + 1;
    const studentPosition = answerByItem.get(item.id) ?? null;
    return {
      id: item.id,
      content: item.content,
      correctPosition,
      studentPosition,
      isCorrect: studentPosition === correctPosition,
      points: resolveChronologicalOrderPoints(item),
    };
  });

  const correctCount = items.filter((i) => i.isCorrect).length;
  const pointsPossible = items.reduce((sum, i) => sum + i.points, 0);
  const pointsEarned = items.filter((i) => i.isCorrect).reduce((sum, i) => sum + i.points, 0);

  return {
    correct: correctCount === items.length && items.length > 0,
    score: percentage(correctCount, items.length),
    detail: { items },
    pointsEarned,
    pointsPossible,
  };
}

// Часткові бали за пропуск (не все-або-нічого, як gradeFillBlank/
// gradeLetterGaps) — той самий принцип, що gradeMatching/gradeImageMatch:
// pointsEarned/pointsPossible — сума по КОЖНОМУ пропуску окремо,
// pointsPerGap (KaraokeConfig.pointsPerGap) — спільний коефіцієнт на всі,
// не масив per-пропуск. normalize() — та сама конвенція, що для інших
// текстових пропусків (регістр/апостроф/пробіли байдужі, діакритика — ні).
function gradeKaraoke(config: KaraokeConfig, answer: KaraokeAnswer): GradeResult {
  const pointsPerGap = resolveKaraokePoints(config);

  const lines: KaraokeDetail["lines"] = config.lines.map((line, li) => {
    const lineAnswers = answer[li] ?? [];
    const gaps = line.gapTokenIndices.map((tokenIndex, gi) => {
      const correctAnswer = line.tokens[tokenIndex];
      const studentAnswer = lineAnswers[gi] ?? "";
      return {
        studentAnswer,
        correctAnswer,
        isCorrect: normalize(studentAnswer) === normalize(correctAnswer),
        points: pointsPerGap,
      };
    });
    // Текст для "Роботи над помилками" — пропуски як "___", tokens уже
    // містить пробіли/пунктуацію окремими елементами, тож join("")
    // відновлює оригінальний рядок один-в-один.
    const text = line.tokens.map((t, i) => (line.gapTokenIndices.includes(i) ? "___" : t)).join("");
    return { text, gaps };
  });

  const allGaps = lines.flatMap((l) => l.gaps);
  const correctCount = allGaps.filter((g) => g.isCorrect).length;
  const pointsPossible = allGaps.reduce((sum, g) => sum + g.points, 0);
  const pointsEarned = allGaps.filter((g) => g.isCorrect).reduce((sum, g) => sum + g.points, 0);

  return {
    correct: correctCount === allGaps.length && allGaps.length > 0,
    score: percentage(correctCount, allGaps.length),
    detail: { lines },
    pointsEarned,
    pointsPossible,
  };
}

export function gradeAnswer(
  type: GradableTaskType,
  config: Record<string, unknown>,
  answer: unknown
): GradeResult {
  switch (type) {
    case "fill_blank":
      return gradeFillBlank(config as unknown as FillBlankConfig, answer as FillBlankAnswer);
    case "letter_gaps":
      return gradeLetterGaps(config as unknown as LetterGapsConfig, answer as LetterGapsAnswer);
    case "letter_rearrangement":
      return gradeLetterRearrangement(
        config as unknown as LetterRearrangementConfig,
        answer as LetterRearrangementAnswer
      );
    case "multiple_choice":
      return gradeMultipleChoice(
        config as unknown as MultipleChoiceConfig,
        answer as MultipleChoiceAnswer
      );
    case "word_choice":
      return gradeWordChoice(config as unknown as WordChoiceConfig, answer as WordChoiceAnswer);
    case "word_search":
      return gradeWordSearch(config as unknown as WordSearchConfig, answer as WordSearchAnswer);
    case "crossword":
      return gradeCrossword(config as unknown as CrosswordConfig, answer as CrosswordAnswer);
    case "true_false":
      return gradeTrueFalse(config as unknown as TrueFalseConfig, answer as TrueFalseAnswer);
    case "matching":
      return gradeMatching(config as unknown as MatchingConfig, answer as MatchingAnswer);
    case "listening":
      return gradeListening(config as unknown as ListeningConfig, answer as ListeningAnswer);
    case "reorder":
      return gradeReorder(config as unknown as ReorderConfig, answer as ReorderAnswer);
    case "drag_drop":
      return gradeDragDrop(config as unknown as DragDropConfig, answer as DragDropAnswer);
    case "sort_columns":
      return gradeSortColumns(config as unknown as SortColumnsConfig, answer as SortColumnsAnswer);
    case "open_answer":
      return gradeOpenAnswer(config as unknown as OpenAnswerConfig, answer as OpenAnswerAnswer);
    case "table_fill":
      return gradeTableFill(config as unknown as TableFillConfig, answer as TableFillAnswer);
    case "image_match":
      return gradeImageMatch(config as unknown as ImageMatchConfig, answer as ImageMatchAnswer);
    case "checkbox_grid":
      return gradeCheckboxGrid(
        config as unknown as CheckboxGridConfig,
        answer as CheckboxGridAnswer
      );
    case "chronological_order":
      return gradeChronologicalOrder(
        config as unknown as ChronologicalOrderConfig,
        answer as ChronologicalOrderAnswer
      );
    case "karaoke":
      return gradeKaraoke(config as unknown as KaraokeConfig, answer as KaraokeAnswer);
    default:
      return assertNeverGradableType(type);
  }
}
