import type { PartOfSpeech } from "@/lib/vocab-categories";

// Крок 3 "Тренувати мої слова" — чиста (без DB) побудова сесії вправ із
// уже завантажених слів (loadTrainingWords, крок 1-2). Жодних імпортів
// server actions/Supabase тут навмисно немає — клієнтський компонент
// сесії (train-play-view.tsx) викликає buildSession() прямо, без round
// trip на сервер.

export type SessionWord = {
  id: string;
  word: string;
  translation: string | null;
  partOfSpeech: PartOfSpeech | null;
  contextFr: string | null;
  contextUk: string | null;
};

export type QuestionType = "cards" | "choice" | "unscramble" | "gap";

export type CardsQuestion = {
  type: "cards";
  savedWordId: string;
  word: string;
  translation: string;
  contextFr: string | null;
  contextUk: string | null;
};

export type ChoiceQuestion = {
  type: "choice";
  savedWordId: string;
  word: string;
  correctAnswer: string;
  options: string[];
};

export type UnscrambleQuestion = {
  type: "unscramble";
  savedWordId: string;
  word: string;
  translation: string | null;
  answer: string;
  tiles: string[];
};

export type GapQuestion = {
  type: "gap";
  savedWordId: string;
  sentenceBefore: string;
  blankSurface: string;
  sentenceAfter: string;
  correctAnswer: string;
  options: string[];
  contextUk: string | null;
};

export type Question = CardsQuestion | ChoiceQuestion | UnscrambleQuestion | GapQuestion;

export type BuildSessionResult = {
  questions: Question[];
  skippedCount: number;
};

// --- Загальні хелпери -------------------------------------------------

function shuffleWith<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Case+діакритика-нечутливе зведення — для GAP (пошук слова в реченні,
// добір дистракторів за основою), НЕ для unscramble (там відповідь
// звіряється акцент-чутливо, порівнянням рядків напряму, без цієї
// функції). NFD+\p{Diacritic} — той самий прийом, що normalizeForSearch
// у saved-words.ts (пошук словника), тут лише своя копія: цей модуль
// навмисно без жодного імпорту з інших файлів кабінету, щоб лишатись
// чистим і незалежно тестованим.
function foldForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’‘ʼ]/g, "'");
}

// Провідний артикль — той самий список, що задача явно називає для
// unscramble (le/la/les/l'/un/une/des/du), і повторно використовується
// для GAP (шукаємо слово в реченні і З артиклем, і без нього).
const LEADING_ARTICLE_RE = /^(?:les\s+|des\s+|une\s+|un\s+|la\s+|le\s+|du\s+|l['’‘ʼ])/i;

function stripLeadingArticle(word: string): string {
  const stripped = word.replace(LEADING_ARTICLE_RE, "").trim();
  return stripped.length > 0 ? stripped : word.trim();
}

// --- cards / choice -----------------------------------------------------

export function cardsEligible(word: SessionWord): boolean {
  return !!word.translation && word.translation.trim().length > 0;
}

// Нормалізація для звірки "чи це фактично той самий переклад" —
// case/діакритика/пробіли не повинні рятувати дублікат чи саму правильну
// відповідь від виключення (той самий foldForMatch, що GAP вживає для
// звірки форм слова).
function normalizeAnswer(value: string): string {
  return foldForMatch(value.trim());
}

// Переклад може бути "a, b" (кілька прийнятних форм, кома-розділені) —
// якщо чийсь ІНШИЙ дистрактор містить ПРАВИЛЬНУ відповідь як одну зі
// своїх частин, цей дистрактор де-факто теж правильний і не повинен
// пропонуватись як "неправильний" варіант.
function translationParts(value: string): string[] {
  return value
    .split(",")
    .map((p) => normalizeAnswer(p))
    .filter((p) => p.length > 0);
}

// Пріоритет: та ж частина мови (сортування за близькістю довжини до
// правильної відповіді — "якщо легко", без гарантій), потім будь-яка
// інша. Обидві групи йдуть одним списком (samePos спочатку) — цикл
// нижче сам вибирає спершу з samePos, переходячи до otherPos лише якщо
// samePos не вистачає, тож "перевага" не потребує окремого порогу.
function orderByLengthPreference<T extends { translation?: string | null; word: string }>(
  items: T[],
  targetLength: number,
  lengthOf: (item: T) => number,
  rng: () => number
): T[] {
  return shuffleWith(items, rng).sort((a, b) => Math.abs(lengthOf(a) - targetLength) - Math.abs(lengthOf(b) - targetLength));
}

// >= 1 дистрактор (мінімум 2 варіанти разом із правильним) — інакше
// ineligible; до 3 дистракторів (4 варіанти разом), пул — ВЕСЬ переданий
// пул дистракторів (не лише слова цієї сесії — викликач передає більший,
// окремий пул, щоб варіантів завжди було 4, коли сама сесія мала).
export function buildChoiceOptions(word: SessionWord, pool: SessionWord[], rng: () => number): string[] | null {
  if (!cardsEligible(word)) return null;
  const correct = word.translation!.trim();
  const correctKey = normalizeAnswer(correct);

  const candidates = pool.filter((w) => {
    if (w.id === word.id) return false;
    if (!w.translation || !w.translation.trim()) return false;
    const key = normalizeAnswer(w.translation);
    if (key === correctKey) return false;
    if (translationParts(w.translation).includes(correctKey)) return false;
    return true;
  });
  const samePos = candidates.filter((w) => w.partOfSpeech === word.partOfSpeech);
  const otherPos = candidates.filter((w) => w.partOfSpeech !== word.partOfSpeech);
  const ordered = [
    ...orderByLengthPreference(samePos, correct.length, (w) => w.translation!.trim().length, rng),
    ...orderByLengthPreference(otherPos, correct.length, (w) => w.translation!.trim().length, rng),
  ];

  const seen = new Set([correctKey]);
  const distractors: string[] = [];
  for (const w of ordered) {
    const t = w.translation!.trim();
    const key = normalizeAnswer(t);
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(t);
    if (distractors.length === 3) break;
  }
  if (distractors.length === 0) return null;

  return shuffleWith([correct, ...distractors], rng);
}

// --- unscramble -----------------------------------------------------

// Після зняття артикля лишається ОДНЕ просте слово (без пробілів/
// апострофа/дефіса) довжиною 4-14 літер — фрази/скорочення типа "ne...pas"
// чи "qu'il" ineligible, задача прямо вимагає "single word".
export function unscrambleEligible(word: SessionWord): string | null {
  const stripped = stripLeadingArticle(word.word);
  if (/[\s'’‘ʼ-]/.test(stripped)) return null;
  if (stripped.length < 4 || stripped.length > 14) return null;
  return stripped;
}

// Діакритики лишаються як дано (жодного foldForMatch тут) — відповідь
// звіряється акцент-чутливо, тож і самі літери-плитки мають нести
// оригінальні é/è/ê тощо.
export function scrambleWord(word: string, rng: () => number): string[] {
  const letters = Array.from(word);
  let attempt = shuffleWith(letters, rng);
  for (let tries = 0; tries < 10 && attempt.join("") === word; tries++) {
    attempt = shuffleWith(letters, rng);
  }
  return attempt;
}

// --- gap-fill -----------------------------------------------------

// Токен — пробіг літер (лат.+Latin-1 Supplement) із дефісом усередині
// (grand-mère лишається одним токеном) — АПОСТРОФ навмисно НЕ в цьому
// наборі символів: французька елізія (l'/d'/qu'/j'/n'/s'/c'/m'/t') клеїть
// короткий службовий префікс до наступного слова ("L'École" як один
// пробіг символів), і якщо апостроф тримати в токені, "École" ніколи не
// знайдеться окремо — токенізація розриває рядок рівно на апострофі,
// короткий префікс стає своїм (незначущим) токеном, а решта слова —
// окремим токеном, придатним для прямого/stem-збігу нижче. Побудова
// НОВОГО RegExp на кожен виклик (не спільний модульний константний
// об'єкт) — /g-регулярки зберігають lastIndex МІЖ викликами exec(), а
// findGapMatch часто повертається достроково (return усередині while, не
// довівши власний regex до "не знайдено" — природного lastIndex=0); без
// цього наступний виклик на ІНШОМУ тексті продовжив би скан із чужого
// залишкового lastIndex.
function wordTokenRegex(): RegExp {
  return /[A-Za-zÀ-ÖØ-öø-ÿ-]+/gu;
}

export type GapMatch = { start: number; end: number; surface: string };

// Пряме збіжжя (слово чи його безартиклева форма, зведені) МАЄ пріоритет
// над основою — її перевіряємо лише якщо жодного прямого збігу немає.
// Основа — перші 4 літери цілі (задача: "word form sharing a >= 4-letter
// stem"), токен має бути не коротшим за ту саму довжину, щоб дійсно
// поділяти основу, не лише випадково починатись тими самими 4 літерами
// короткого слова.
export function findGapMatch(word: Pick<SessionWord, "word" | "contextFr">): GapMatch | null {
  const text = word.contextFr;
  if (!text) return null;

  const stripped = stripLeadingArticle(word.word);
  const exactTargets = [foldForMatch(word.word), foldForMatch(stripped)].filter((f) => f.length > 0);
  const stem = foldForMatch(stripped).length >= 4 ? foldForMatch(stripped).slice(0, 4) : null;

  let stemHit: GapMatch | null = null;
  const re = wordTokenRegex();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const tokenFold = foldForMatch(m[0]);
    if (exactTargets.includes(tokenFold)) {
      return { start: m.index, end: m.index + m[0].length, surface: m[0] };
    }
    if (!stemHit && stem && tokenFold.length >= 4 && tokenFold.startsWith(stem)) {
      stemHit = { start: m.index, end: m.index + m[0].length, surface: m[0] };
    }
  }
  return stemHit;
}

// Дистрактори — інші слова з ПУЛУ "як є" (.word, не форма з речення) —
// той самий принцип, що choice: та ж частина мови пріоритетна (з
// довжина-перевагою), інакше будь-яке інше слово; мінімум 1 (разом з
// правильним — 2 варіанти), інакше ineligible.
export function buildGapOptions(
  correctSurface: string,
  word: SessionWord,
  pool: SessionWord[],
  rng: () => number
): string[] | null {
  const correctKey = foldForMatch(correctSurface);
  const candidates = pool.filter((w) => w.id !== word.id && w.word.trim() && foldForMatch(w.word.trim()) !== correctKey);
  const samePos = candidates.filter((w) => w.partOfSpeech === word.partOfSpeech);
  const otherPos = candidates.filter((w) => w.partOfSpeech !== word.partOfSpeech);
  const ordered = [
    ...orderByLengthPreference(samePos, correctSurface.length, (w) => w.word.trim().length, rng),
    ...orderByLengthPreference(otherPos, correctSurface.length, (w) => w.word.trim().length, rng),
  ];

  const seen = new Set([correctKey]);
  const distractors: string[] = [];
  for (const w of ordered) {
    const text = w.word.trim();
    const key = foldForMatch(text);
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(text);
    if (distractors.length === 3) break;
  }
  if (distractors.length === 0) return null;

  return shuffleWith([correctSurface, ...distractors], rng);
}

// --- Побудова сесії -----------------------------------------------------

// Канонічний словник і порядок типів вправ — ЄДИНЕ джерело правди
// (експортований, бо setup/play-екрани теж мають на нього посилатись:
// перемикачі setup-екрана, query-параметр "types", валідатор
// parseTrainingExerciseTypesParam у word-training.ts). Раніше setup
// тримав ОКРЕМИЙ словник (TrainingExerciseType: flip_cards/
// translation_choice/sentence_gap) — types-перемикачі майже не впливали
// на сесію, бо лише "unscramble" збігався з тим, що тут очікує
// buildSession.
export const QUESTION_TYPES: QuestionType[] = ["cards", "choice", "unscramble", "gap"];

function buildQuestion(type: QuestionType, word: SessionWord, pool: SessionWord[], rng: () => number): Question | null {
  switch (type) {
    case "cards": {
      if (!cardsEligible(word)) return null;
      return {
        type: "cards",
        savedWordId: word.id,
        word: word.word,
        translation: word.translation!.trim(),
        contextFr: word.contextFr,
        contextUk: word.contextUk,
      };
    }
    case "choice": {
      const options = buildChoiceOptions(word, pool, rng);
      if (!options) return null;
      return {
        type: "choice",
        savedWordId: word.id,
        word: word.word,
        correctAnswer: word.translation!.trim(),
        options,
      };
    }
    case "unscramble": {
      const answer = unscrambleEligible(word);
      if (!answer) return null;
      return {
        type: "unscramble",
        savedWordId: word.id,
        word: word.word,
        translation: word.translation,
        answer,
        tiles: scrambleWord(answer, rng),
      };
    }
    case "gap": {
      const match = findGapMatch(word);
      if (!match) return null;
      const options = buildGapOptions(match.surface, word, pool, rng);
      if (!options) return null;
      return {
        type: "gap",
        savedWordId: word.id,
        sentenceBefore: word.contextFr!.slice(0, match.start),
        blankSurface: match.surface,
        sentenceAfter: word.contextFr!.slice(match.end),
        correctAnswer: match.surface,
        options,
        contextUk: word.contextUk,
      };
    }
  }
}

function isEligible(type: QuestionType, word: SessionWord, pool: SessionWord[], rng: () => number): boolean {
  switch (type) {
    case "cards":
      return cardsEligible(word);
    case "choice":
      return buildChoiceOptions(word, pool, rng) !== null;
    case "unscramble":
      return unscrambleEligible(word) !== null;
    case "gap": {
      const match = findGapMatch(word);
      return !!match && buildGapOptions(match.surface, word, pool, rng) !== null;
    }
  }
}

// Одне питання на слово, у перемішаному порядку (words — уже той самий
// список, що завантажив loadTrainingWords з обраним лімітом — тут немає
// власного limit-параметра, лише перетворення на питання). Тип кожного
// слова — випадковий серед enabledTypes, які ЕЛІГІБЕЛЬНІ саме для нього,
// з балансуванням: завжди береться НАЙМЕНШ використаний дотепер тип серед
// придатних (рівність розв'язується випадково) — так типи розподіляються
// рівномірно, а не просто "першим придатним". Слово без жодного
// придатного увімкненого типу — пропускається (skippedCount++).
// pool — ОКРЕМИЙ, зазвичай значно більший список для дистракторів
// choice/gap (усі слова студента з перекладом, незалежно від
// filter/category/limit самої сесії — завантажується окремо, train/
// actions.ts) — за замовчуванням дорівнює words (стара поведінка: лише
// слова самої сесії), якщо викликач явно не передав більший пул.
// Дистрактори завжди обираються З ЦЬОГО пулу, не з words — слово зі
// слабким/малим words усе ще отримує повні 4 варіанти, якщо пул великий.
export function buildSession(
  words: SessionWord[],
  enabledTypes: QuestionType[],
  rng: () => number = Math.random,
  pool: SessionWord[] = words
): BuildSessionResult {
  const enabled = new Set(enabledTypes);
  const usage: Record<QuestionType, number> = { cards: 0, choice: 0, unscramble: 0, gap: 0 };
  const questions: Question[] = [];
  let skippedCount = 0;

  for (const word of shuffleWith(words, rng)) {
    const eligibleTypes = QUESTION_TYPES.filter((t) => enabled.has(t) && isEligible(t, word, pool, rng));
    if (eligibleTypes.length === 0) {
      skippedCount++;
      continue;
    }
    const minUsage = Math.min(...eligibleTypes.map((t) => usage[t]));
    const tied = eligibleTypes.filter((t) => usage[t] === minUsage);
    const chosen = tied[Math.floor(rng() * tied.length)];
    const question = buildQuestion(chosen, word, pool, rng);
    if (!question) {
      // Не повинно траплятись (isEligible вже перевірив той самий тип) —
      // але якщо так, слово пропускається, а не ламає всю сесію.
      skippedCount++;
      continue;
    }
    usage[chosen]++;
    questions.push(question);
  }

  return { questions, skippedCount };
}

// Скільки слів ОТРИМАЮТЬ питання з принаймні одним з enabledTypes — для
// "Почати · N слів" на setup-екрані: лічильник там раніше рахував лише
// filter+category (candidateCount), ігноруючи, чи слово взагалі
// eligible бодай для ОДНОГО обраного типу вправи — число могло
// показувати, напр., "20 слів", хоча пів із них не мали жодного
// придатного типу й опинилися б у skippedCount під час самої сесії.
// Той самий isEligible, що buildSession використовує для призначення
// типу, тож число завжди узгоджене з тим, що студент реально побачить.
// rng тут фіксований (не Math.random) — не впливає на САМ вердикт
// eligible/ineligible (лише на порядок перемішування дистракторів
// усередині buildChoiceOptions/buildGapOptions, не на їх КІЛЬКІСТЬ),
// але явний детермінізм тут безпечніший і очевидніше чистий для
// SSR-рендеру setup-екрана (жодного Math.random узагалі).
export function countEligibleWords(
  words: SessionWord[],
  enabledTypes: QuestionType[],
  rng: () => number = () => 0.5,
  pool: SessionWord[] = words
): number {
  if (enabledTypes.length === 0) return 0;
  const enabled = new Set(enabledTypes);
  return words.filter((w) => QUESTION_TYPES.some((t) => enabled.has(t) && isEligible(t, w, pool, rng))).length;
}

// --- Крок 4: результати сесії -----------------------------------------

// "Заохочувальне речення" на екрані результатів вибирається з точністю
// (correct/total): <50% — low, 50-79% — mid, >=80% — high. total===0
// (нічого не відповідали — усі слова пропущені) трактується як high, щоб
// не показувати "низьку" точність там, де відповідей не було взагалі.
export type AccuracyBand = "low" | "mid" | "high";

export function accuracyBand(correct: number, total: number): AccuracyBand {
  if (total === 0) return "high";
  const ratio = correct / total;
  if (ratio < 0.5) return "low";
  if (ratio < 0.8) return "mid";
  return "high";
}

// Розбивка "Картки 3/4" по кожному типу вправи, що РЕАЛЬНО з'явився в
// сесії (не всі QUESTION_TYPES) — порядок лишається порядком першої
// появи типу в results, не канонічним QUESTION_TYPES-порядком, тож
// відображає реальний плин сесії для студента.
export type TypeBreakdownEntry = { type: QuestionType; correct: number; total: number };

export function buildTypeBreakdown(
  results: { type: QuestionType; correct: boolean }[]
): TypeBreakdownEntry[] {
  const order: QuestionType[] = [];
  const counts = new Map<QuestionType, { correct: number; total: number }>();
  for (const r of results) {
    let entry = counts.get(r.type);
    if (!entry) {
      entry = { correct: 0, total: 0 };
      counts.set(r.type, entry);
      order.push(r.type);
    }
    entry.total++;
    if (r.correct) entry.correct++;
  }
  return order.map((type) => ({ type, ...counts.get(type)! }));
}

// Унікальні id слів, відповідь на які була неправильна (включно з
// самооцінкою "Ще вчу" у cards, яка рахується тут як і будь-яка інша
// неправильна відповідь) — для списку "Слова для повторення" й для
// побудови раунду "Повторити помилки".
export function wrongSavedWordIds(results: { savedWordId: string; correct: boolean }[]): string[] {
  return [...new Set(results.filter((r) => !r.correct).map((r) => r.savedWordId))];
}

// "Повторити помилки" — новий раунд лише зі слів, відповідь на які була
// неправильна: той самий пул дистракторів (пул не залежить від того,
// які слова самої сесії обрані) лишається чинним, тож викликач просто
// бере words.filter через цей хелпер і передає в buildSession як є.
export function selectWordsByIds<T extends { id: string }>(words: T[], ids: string[]): T[] {
  const idSet = new Set(ids);
  return words.filter((w) => idSet.has(w.id));
}
