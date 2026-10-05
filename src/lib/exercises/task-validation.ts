// Перевірка ПОВНОТИ конфігурації вправи — окремо від sanitize.ts (яке
// готує вже ІСНУЮЧУ конфігурацію для студента) і grade.ts (яке рахує бали
// за вже здану відповідь): тут немає жодної відповіді студента, лише
// питання "чи вчителька дозаповнила все, що потрібно для роботи вправи".
// Чиста функція (без "use client"/"use server") — використовується і в
// браузері (task-config-fields.tsx, живий список проблем при редагуванні),
// і на сервері (списки задач в адмінці — жовта іконка ⚠ біля неповної
// вправи). Жодна проблема тут НІКОЛИ не блокує збереження — лише
// попереджає (task-config-fields.tsx показує підтвердження, не забороняє).
//
// path — структурний ідентифікатор елемента (`pairs[1].right`,
// `words[2]`, `videoUrl`) для програмної підсвітки конкретного поля там,
// де вона підключена; message — готове речення українською для панелі
// проблем/підказки ⚠, вже включає позицію елемента для читача.
//
// severity — два рівні, споживачі (task-config-fields.tsx, списки задач)
// реагують по-різному:
// - "error" — справді не заповнено (порожня сторона пари, немає пропуску,
//   не позначено правильну відповідь, сітка застаріла тощо): жовта панель
//   "Не заповнено (N)", підтвердження при збереженні, іконка ⚠ у списках.
// - "hint" — порада, не помилка (порожня інструкція — студент і так
//   побачить дефолтну; рекомендована, не жорстка, межа кількості слів):
//   тихий сірий текст у формі, НІКОЛИ не впливає на підтвердження чи ⚠.
import { sanitizeWordForGrid } from "./grid-word";
import { normalizeWordSearchConfig, normalizeCrosswordConfig, BLOCK_MAX_COLS, BLOCK_MAX_ROWS } from "./grid-blocks";
import { placementCells } from "./word-search-grid";
import type { WordSearchConfig, CrosswordConfig, CrosswordPlacement } from "./types";

export type ConfigProblem = { path: string; message: string; severity: "error" | "hint" };

type Config = Record<string, unknown>;

// Та сама нормалізація, що генератори сітки (sanitizeWordForGrid+upper,
// word-search-grid.ts/crossword-grid.ts) — обов'язково ТА САМА, інакше
// порівняння з placements/gridSourceWords (уже нормалізованими генератором)
// ніколи не збіглося б навіть для щойно згенерованої, незміненої сітки
// (звідси й був хибний "Сітка застаріла" — старий код порівнював сирі
// config.words напряму з нормалізованими placements).
function normalizeGridWord(raw: unknown): string {
  return typeof raw === "string" ? sanitizeWordForGrid(raw).toUpperCase() : "";
}

// "Сітка застаріла" — три випадки:
// 1. gridSourceWords є (нова вправа) — порівнюємо як МУЛЬТИМНОЖИНИ
//    (сортований масив, не Set): дублікати важать (два однакових слова —
//    інший стан, ніж одне), але порядок уведення — ні (перестановка рядків
//    без реальної зміни набору не має вважатись "застарілою", генератор і
//    так сортує за довжиною, не за порядком форми).
// 2. gridSourceWords немає (стара вправа, збережена до появи цього поля) —
//    єдине, що можна перевірити чесно: чи ЗНИКЛО зі списку слово, яке
//    справді розміщене в сітці (placements) — Set-порівняння в
//    ОДНОСТОРОННЬОМУ напрямку. НОВЕ слово, якого ще нема в placements, не
//    вважається ознакою застарілості — воно могло просто не вміститися
//    (те саме, що й для нових вправ: неуспішне розміщення — не
//    "застарілість").
// 3. Сітку ще не генерували взагалі — окрема, вища за пріоритетом
//    перевірка (grid.length===0/placements.length===0), gridStaleness сюди
//    не викликається.
function isGridStale(currentWords: string[], gridSourceWords: unknown, placedWords: string[]): boolean {
  if (Array.isArray(gridSourceWords)) {
    const source = (gridSourceWords as unknown[]).map(normalizeGridWord).filter(Boolean).sort();
    const current = currentWords.slice().sort();
    return source.length !== current.length || source.some((w, i) => w !== current[i]);
  }
  const currentSet = new Set(currentWords);
  return placedWords.some((w) => !currentSet.has(w));
}

// Слово без жодного перетину з іншим словом цього ж блоку — похідне
// напряму з уже збережених placements (без повторної генерації): клітинка,
// яку займає ЛИШЕ одне слово, ніким не поділяється, тому воно ізольоване.
// Той самий сенс, що generateCrosswordGrid.isolatedWords, але рахується тут
// заново з persisted-даних (ефемерне попередження адмінки після генерації
// не зберігається в config) — для блока, відкритого повторно, без нового
// запуску генератора.
// Експортовано для block-editing.ts (ЕТАП B/3) — конструктор показує те
// саме попередження "без перетинів" одразу після перегенерації блоку
// (generateBlockGrid), без повторної реалізації.
export function findIsolatedCrosswordWords(placements: CrosswordPlacement[]): string[] {
  const cellOwners = new Map<string, number>();
  placements.forEach((p) => {
    placementCells(p, p.word.length).forEach(({ row, col }) => {
      const key = `${row},${col}`;
      cellOwners.set(key, (cellOwners.get(key) ?? 0) + 1);
    });
  });
  return placements
    .filter((p) => placementCells(p, p.word.length).every(({ row, col }) => (cellOwners.get(`${row},${col}`) ?? 0) <= 1))
    .map((p) => p.word);
}

// Слова зі списку, яких НЕМА в жодному блоці (мультимножина-різниця,
// порядок появи в currentWords) — конструктор (ЕТАП B/3) лишає такі слова
// в "Нерозподілені", доки вчителька не призначить їм блок чи не розподілить
// автоматично.
function multisetExtra(currentWords: string[], blockKeys: string[]): string[] {
  const remaining = [...blockKeys];
  const extra: string[] = [];
  for (const k of currentWords) {
    const idx = remaining.indexOf(k);
    if (idx === -1) extra.push(k);
    else remaining.splice(idx, 1);
  }
  return extra;
}

// Спільна перевірка для ≥2 блоків (word_search/crossword) — якщо кожне
// слово списку входить у якийсь блок (нерозподілених нема) і жоден блок не
// посилається на зникле слово, повідомлення конкретне ("є нерозподілені
// слова (N)"); інакше — загальне ("Склад слів змінився").
function pushBlockCompositionProblems(
  currentWords: string[],
  allBlockKeys: string[],
  path: string,
  problems: ConfigProblem[]
) {
  const unassigned = multisetExtra(currentWords, allBlockKeys);
  const orphanedInBlocks = multisetExtra(allBlockKeys, currentWords);
  if (unassigned.length === 0 && orphanedInBlocks.length === 0) return;
  if (orphanedInBlocks.length === 0) {
    problems.push({
      path,
      message: `Є нерозподілені слова (${unassigned.length}) — додайте в блок або розподіліть автоматично`,
      severity: "error",
    });
  } else {
    problems.push({ path, message: "Склад слів змінився — перегенеруйте", severity: "error" });
  }
}

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

// М'яке зауваження — порожня інструкція не заважає вправі працювати
// (студентські компоненти й так підставляють DEFAULT_INSTRUCTIONS), тому
// формулювання навмисно нейтральне, не "помилка".
function checkInstructions(config: Config, problems: ConfigProblem[]) {
  if (isBlank(config.instructions)) {
    problems.push({ path: "instructions", message: "Інструкція порожня — використається типова за замовчуванням", severity: "hint" });
  }
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function validateTaskConfig(type: string, config: Config): ConfigProblem[] {
  const problems: ConfigProblem[] = [];

  switch (type) {
    case "fill_blank": {
      checkInstructions(config, problems);
      const template = typeof config.template === "string" ? config.template : "";
      if (template.trim().length === 0) {
        problems.push({ path: "template", message: "Немає тексту вправи", severity: "error" });
      } else if (!template.includes("{{")) {
        problems.push({ path: "template", message: "Немає жодного пропуску — додайте {{...}} у тексті", severity: "error" });
      }
      break;
    }

    case "letter_gaps": {
      checkInstructions(config, problems);
      const words = asArray(config.words) as { word?: string; hiddenIndices?: number[] }[];
      if (words.length === 0) problems.push({ path: "words", message: "Немає жодного слова", severity: "error" });
      words.forEach((w, i) => {
        if (isBlank(w.word)) problems.push({ path: `words[${i}].word`, message: `Слово ${i + 1}: порожнє`, severity: "error" });
        else if (!Array.isArray(w.hiddenIndices) || w.hiddenIndices.length === 0) {
          problems.push({ path: `words[${i}].hiddenIndices`, message: `Слово ${i + 1}: не приховано жодної літери`, severity: "error" });
        }
      });
      break;
    }

    case "letter_rearrangement": {
      checkInstructions(config, problems);
      const words = asArray(config.words) as { word?: string }[];
      if (words.length === 0) problems.push({ path: "words", message: "Немає жодного слова", severity: "error" });
      words.forEach((w, i) => {
        const word = typeof w.word === "string" ? w.word.trim() : "";
        if (word.length === 0) problems.push({ path: `words[${i}].word`, message: `Слово ${i + 1}: порожнє`, severity: "error" });
        else if (word.length < 2)
          problems.push({ path: `words[${i}].word`, message: `Слово ${i + 1}: закоротке (потрібно мінімум 2 літери)`, severity: "error" });
      });
      break;
    }

    case "multiple_choice": {
      checkInstructions(config, problems);
      const items = asArray(config.items) as { sentence?: string; options?: { text?: string; correct?: boolean }[] }[];
      if (items.length === 0) problems.push({ path: "items", message: "Немає жодного питання", severity: "error" });
      items.forEach((item, i) => {
        if (isBlank(item.sentence)) problems.push({ path: `items[${i}].sentence`, message: `Питання ${i + 1}: порожнє речення`, severity: "error" });
        const options = asArray(item.options) as { text?: string; correct?: boolean }[];
        if (options.length < 2) {
          problems.push({ path: `items[${i}].options`, message: `Питання ${i + 1}: менше 2 варіантів відповіді`, severity: "error" });
        } else if (!options.some((o) => o.correct)) {
          problems.push({ path: `items[${i}].options`, message: `Питання ${i + 1}: не позначено правильну відповідь`, severity: "error" });
        }
        options.forEach((o, oi) => {
          if (isBlank(o.text))
            problems.push({ path: `items[${i}].options[${oi}].text`, message: `Питання ${i + 1}, варіант ${oi + 1}: порожній текст`, severity: "error" });
        });
      });
      break;
    }

    case "word_choice": {
      checkInstructions(config, problems);
      const sentences = asArray(config.sentences) as { sentence?: string; options?: { text?: string; correct?: boolean }[] }[];
      if (sentences.length === 0) problems.push({ path: "sentences", message: "Немає жодного речення", severity: "error" });
      sentences.forEach((s, i) => {
        const sentence = typeof s.sentence === "string" ? s.sentence : "";
        if (sentence.trim().length === 0) problems.push({ path: `sentences[${i}].sentence`, message: `Речення ${i + 1}: порожнє`, severity: "error" });
        else if (!sentence.includes("{{"))
          problems.push({ path: `sentences[${i}].sentence`, message: `Речення ${i + 1}: немає пропуску {{}}`, severity: "error" });
        const options = asArray(s.options) as { text?: string; correct?: boolean }[];
        if (options.length < 2) problems.push({ path: `sentences[${i}].options`, message: `Речення ${i + 1}: менше 2 варіантів`, severity: "error" });
        else if (!options.some((o) => o.correct))
          problems.push({ path: `sentences[${i}].options`, message: `Речення ${i + 1}: не позначено правильний варіант`, severity: "error" });
      });
      break;
    }

    case "word_search": {
      checkInstructions(config, problems);
      const words = asArray(config.words) as { word?: string }[];
      if (words.length === 0) problems.push({ path: "words", message: "Немає жодного слова", severity: "error" });
      words.forEach((w, i) => {
        if (isBlank(w.word)) problems.push({ path: `words[${i}].word`, message: `Слово ${i + 1}: порожнє`, severity: "error" });
      });
      // normalizeWordSearchConfig (grid-blocks.ts) — для вправи з ОДНИМ
      // блоком (усі наявні до етапу 2, і будь-яка без явного config.blocks)
      // blocks[0] — рівно ТІ САМІ значення, що раніше top-level grid/
      // placements/gridSourceWords, поведінка тотожна попередній (гілка
      // "wsBlocks.length === 1" нижче). Кілька блоків (етап 2,
      // split-into-blocks.ts) — окрема, простіша звірка: мультимножина
      // слів списку мусить збігатись з об'єднанням wordKeys усіх блоків,
      // без застарілого fallback на placements (gridSourceWords завжди є —
      // ці блоки завжди пишуться новим кодом).
      const normalizedWs = normalizeWordSearchConfig(config as unknown as WordSearchConfig);
      const wsBlocks = normalizedWs.blocks;
      if (wsBlocks.length === 0) {
        problems.push({ path: "grid", message: "Сітку ще не згенеровано", severity: "error" });
      } else {
        const currentWords = words.map((w) => normalizeGridWord(w.word)).filter(Boolean);
        wsBlocks.forEach((b, i) => {
          if (b.grid.length === 0) {
            problems.push({ path: `blocks[${i}]`, message: `Блок ${i + 1}: немає сітки`, severity: "error" });
          } else if (b.grid.length > BLOCK_MAX_COLS) {
            problems.push({
              path: `blocks[${i}]`,
              message: `Блок ${i + 1}: сітка ${b.grid.length}×${b.grid.length} — ширша за екран телефона, прокручуватиметься вбік`,
              severity: "hint",
            });
          }
        });
        if (wsBlocks.length === 1) {
          const wsBlock = wsBlocks[0];
          const placedWords = wsBlock.placements.map((p) => normalizeGridWord(p.word)).filter(Boolean);
          if (isGridStale(currentWords, wsBlock.gridSourceWords, placedWords)) {
            problems.push({ path: "grid", message: "Сітка застаріла для поточного списку слів — перегенеруйте сітку", severity: "error" });
          }
        } else {
          pushBlockCompositionProblems(currentWords, wsBlocks.flatMap((b) => b.wordKeys), "grid", problems);
        }
      }
      break;
    }

    case "crossword": {
      checkInstructions(config, problems);
      const words = asArray(config.words) as { word?: string; clue?: string; imageUrl?: string }[];
      if (words.length === 0) problems.push({ path: "words", message: "Немає жодного слова", severity: "error" });
      words.forEach((w, i) => {
        if (isBlank(w.word)) problems.push({ path: `words[${i}].word`, message: `Слово ${i + 1}: порожнє`, severity: "error" });
        if (isBlank(w.clue) && isBlank(w.imageUrl)) {
          problems.push({ path: `words[${i}].clue`, message: `Слово ${i + 1}: немає підказки (тексту чи картинки)`, severity: "error" });
        }
      });
      // Той самий принцип, що word_search вище.
      const normalizedCw = normalizeCrosswordConfig(config as unknown as CrosswordConfig);
      const cwBlocks = normalizedCw.blocks;
      if (cwBlocks.length === 0) {
        problems.push({ path: "placements", message: "Сітку ще не згенеровано", severity: "error" });
      } else {
        const currentWords = words.map((w) => normalizeGridWord(w.word)).filter(Boolean);
        cwBlocks.forEach((b, i) => {
          if (b.placements.length === 0 || b.gridWidth === 0 || b.gridHeight === 0) {
            problems.push({ path: `blocks[${i}]`, message: `Блок ${i + 1}: немає сітки`, severity: "error" });
            return;
          }
          if (b.gridWidth > BLOCK_MAX_COLS || b.gridHeight > BLOCK_MAX_ROWS) {
            problems.push({
              path: `blocks[${i}]`,
              message: `Блок ${i + 1}: сітка ${b.gridWidth}×${b.gridHeight} — більша за рекомендований розмір`,
              severity: "hint",
            });
          }
          findIsolatedCrosswordWords(b.placements).forEach((word) => {
            problems.push({
              path: `blocks[${i}]`,
              message: `Блок ${i + 1}: слово "${word}" розміщено без перетинів з іншими`,
              severity: "hint",
            });
          });
        });
        if (cwBlocks.length === 1) {
          const cwBlock = cwBlocks[0];
          const placedWords = cwBlock.placements.map((p) => normalizeGridWord(p.word)).filter(Boolean);
          if (isGridStale(currentWords, cwBlock.gridSourceWords, placedWords)) {
            problems.push({ path: "placements", message: "Сітка застаріла для поточного списку слів — перегенеруйте сітку", severity: "error" });
          }
        } else {
          pushBlockCompositionProblems(currentWords, cwBlocks.flatMap((b) => b.wordKeys), "placements", problems);
        }
      }
      break;
    }

    case "true_false": {
      checkInstructions(config, problems);
      const statements = asArray(config.statements) as { text?: string; answer?: unknown }[];
      if (statements.length === 0) problems.push({ path: "statements", message: "Немає жодного твердження", severity: "error" });
      statements.forEach((s, i) => {
        if (isBlank(s.text)) problems.push({ path: `statements[${i}].text`, message: `Твердження ${i + 1}: порожній текст`, severity: "error" });
        if (s.answer !== true && s.answer !== false) {
          problems.push({ path: `statements[${i}].answer`, message: `Твердження ${i + 1}: не обрано Vrai/Faux`, severity: "error" });
        }
      });
      break;
    }

    case "matching": {
      checkInstructions(config, problems);
      const pairs = asArray(config.pairs) as { left?: string; right?: string }[];
      if (pairs.length === 0) problems.push({ path: "pairs", message: "Немає жодної пари", severity: "error" });
      pairs.forEach((p, i) => {
        if (isBlank(p.left) || isBlank(p.right)) {
          problems.push({ path: `pairs[${i}]`, message: `Пара ${i + 1}: не заповнена ліва або права частина`, severity: "error" });
        }
      });
      break;
    }

    case "listening": {
      checkInstructions(config, problems);
      if (isBlank(config.audioUrl)) problems.push({ path: "audioUrl", message: "Немає аудіо", severity: "error" });
      const questions = asArray(config.questions) as { question?: string; options?: { text?: string; correct?: boolean }[] }[];
      if (questions.length === 0) problems.push({ path: "questions", message: "Немає жодного питання", severity: "error" });
      questions.forEach((q, i) => {
        if (isBlank(q.question)) problems.push({ path: `questions[${i}].question`, message: `Питання ${i + 1}: порожнє`, severity: "error" });
        const options = asArray(q.options) as { text?: string; correct?: boolean }[];
        if (options.length < 2) problems.push({ path: `questions[${i}].options`, message: `Питання ${i + 1}: менше 2 варіантів`, severity: "error" });
        else if (!options.some((o) => o.correct))
          problems.push({ path: `questions[${i}].options`, message: `Питання ${i + 1}: не позначено правильну відповідь`, severity: "error" });
      });
      break;
    }

    case "reorder": {
      checkInstructions(config, problems);
      const sequences = asArray(config.sequences) as { items?: string[] }[];
      if (sequences.length === 0) problems.push({ path: "sequences", message: "Немає жодної послідовності", severity: "error" });
      sequences.forEach((seq, i) => {
        const items = asArray(seq.items) as string[];
        if (items.length < 2) problems.push({ path: `sequences[${i}].items`, message: `Послідовність ${i + 1}: менше 2 елементів`, severity: "error" });
        if (items.some((it) => isBlank(it)))
          problems.push({ path: `sequences[${i}].items`, message: `Послідовність ${i + 1}: є порожній елемент`, severity: "error" });
      });
      break;
    }

    case "drag_drop": {
      checkInstructions(config, problems);
      const sentences = asArray(config.sentences) as { template?: string }[];
      if (sentences.length === 0) problems.push({ path: "sentences", message: "Немає жодного речення", severity: "error" });
      let anyGap = false;
      sentences.forEach((s, i) => {
        const template = typeof s.template === "string" ? s.template : "";
        if (template.trim().length === 0) problems.push({ path: `sentences[${i}].template`, message: `Речення ${i + 1}: порожнє`, severity: "error" });
        else if (template.includes("{{")) anyGap = true;
      });
      if (sentences.length > 0 && !anyGap) problems.push({ path: "sentences", message: "Немає жодного пропуску {{}}", severity: "error" });
      const bank = asArray(config.bank) as string[];
      if (bank.length === 0) problems.push({ path: "bank", message: "Немає банку слів", severity: "error" });
      break;
    }

    case "sort_columns": {
      checkInstructions(config, problems);
      const columns = asArray(config.columns) as { id?: string; label?: string }[];
      const items = asArray(config.items) as { text?: string; columnId?: string }[];
      if (columns.length < 2) problems.push({ path: "columns", message: "Потрібно мінімум 2 колонки", severity: "error" });
      if (items.length === 0) problems.push({ path: "items", message: "Немає жодного елемента", severity: "error" });
      items.forEach((it, i) => {
        if (isBlank(it.text)) problems.push({ path: `items[${i}].text`, message: `Елемент ${i + 1}: порожній текст`, severity: "error" });
        if (isBlank(it.columnId)) problems.push({ path: `items[${i}].columnId`, message: `Елемент ${i + 1}: не призначено колонку`, severity: "error" });
      });
      break;
    }

    case "table_fill": {
      checkInstructions(config, problems);
      const rows = asArray(config.rows) as { left?: string; right?: string; leftHidden?: boolean; rightHidden?: boolean }[];
      if (rows.length === 0) problems.push({ path: "rows", message: "Немає жодного рядка", severity: "error" });
      rows.forEach((r, i) => {
        if (isBlank(r.left) || isBlank(r.right)) {
          problems.push({ path: `rows[${i}]`, message: `Рядок ${i + 1}: не заповнена ліва або права частина`, severity: "error" });
        } else if (!r.leftHidden && !r.rightHidden) {
          problems.push({ path: `rows[${i}]`, message: `Рядок ${i + 1}: немає прихованої клітинки — нема чого перевіряти`, severity: "error" });
        }
      });
      break;
    }

    case "image_match": {
      checkInstructions(config, problems);
      const items = asArray(config.items) as { imageUrl?: string; name?: string }[];
      if (items.length === 0) problems.push({ path: "items", message: "Немає жодного елемента", severity: "error" });
      items.forEach((it, i) => {
        if (isBlank(it.imageUrl)) problems.push({ path: `items[${i}].imageUrl`, message: `Елемент ${i + 1}: немає картинки`, severity: "error" });
        if (isBlank(it.name)) problems.push({ path: `items[${i}].name`, message: `Елемент ${i + 1}: немає назви`, severity: "error" });
      });
      break;
    }

    case "checkbox_grid": {
      checkInstructions(config, problems);
      const columns = asArray(config.columns) as { label?: string }[];
      const rows = asArray(config.rows) as { label?: string; correctColumnIds?: string[] }[];
      if (columns.length === 0) problems.push({ path: "columns", message: "Немає жодної колонки", severity: "error" });
      if (rows.length === 0) problems.push({ path: "rows", message: "Немає жодного рядка", severity: "error" });
      rows.forEach((r, i) => {
        if (isBlank(r.label)) problems.push({ path: `rows[${i}].label`, message: `Рядок ${i + 1}: порожній текст`, severity: "error" });
        if (!Array.isArray(r.correctColumnIds) || r.correctColumnIds.length === 0) {
          problems.push({ path: `rows[${i}].correctColumnIds`, message: `Рядок ${i + 1}: не позначено жодної правильної колонки`, severity: "error" });
        }
      });
      break;
    }

    case "chronological_order": {
      checkInstructions(config, problems);
      const items = asArray(config.items) as { content?: string; text?: string }[];
      if (items.length < 2) problems.push({ path: "items", message: "Потрібно мінімум 2 елементи", severity: "error" });
      items.forEach((it, i) => {
        if (isBlank(it.content)) problems.push({ path: `items[${i}].content`, message: `Елемент ${i + 1}: порожній`, severity: "error" });
        if (config.mode === "mixed" && isBlank(it.text)) {
          problems.push({ path: `items[${i}].text`, message: `Елемент ${i + 1}: порожній підпис`, severity: "error" });
        }
      });
      break;
    }

    case "karaoke": {
      checkInstructions(config, problems);
      if (isBlank(config.videoUrl)) problems.push({ path: "videoUrl", message: "Немає відео", severity: "error" });
      const lines = asArray(config.lines) as { start?: number; gapTokenIndices?: number[] }[];
      if (lines.length === 0) {
        problems.push({ path: "lines", message: "Немає жодного рядка тексту", severity: "error" });
      } else {
        if (!lines.some((l) => Array.isArray(l.gapTokenIndices) && l.gapTokenIndices.length > 0)) {
          problems.push({ path: "lines", message: "Немає жодного пропуску", severity: "error" });
        }
        if (lines.every((l) => !l.start)) {
          problems.push({ path: "lines", message: "Час не розмічено — усі рядки на 0:00", severity: "error" });
        }
      }
      break;
    }

    case "open_answer": {
      checkInstructions(config, problems);
      const questions = asArray(config.questions) as { question?: string; answers?: string[] }[];
      if (questions.length === 0) problems.push({ path: "questions", message: "Немає жодного питання", severity: "error" });
      questions.forEach((q, i) => {
        if (isBlank(q.question)) problems.push({ path: `questions[${i}].question`, message: `Питання ${i + 1}: порожнє`, severity: "error" });
        const answers = asArray(q.answers) as string[];
        if (answers.length === 0 || answers.every((a) => isBlank(a))) {
          problems.push({ path: `questions[${i}].answers`, message: `Питання ${i + 1}: немає жодної правильної відповіді`, severity: "error" });
        }
      });
      break;
    }

    case "essay_check": {
      if (config.level === "A1" && config.exerciseNumber === 1) {
        // Формуляр (EssayFormulaireConfig) — окрема форма без prompt/criteria.
        checkInstructions(config, problems);
        const fields = asArray(config.fields) as { label?: string }[];
        if (fields.length === 0) problems.push({ path: "fields", message: "Немає жодного поля формуляра", severity: "error" });
        fields.forEach((f, i) => {
          if (isBlank(f.label)) problems.push({ path: `fields[${i}].label`, message: `Поле ${i + 1}: порожня назва`, severity: "error" });
        });
        break;
      }
      if (isBlank(config.prompt)) problems.push({ path: "prompt", message: "Немає завдання (consigne)", severity: "error" });
      if (isBlank(config.criteria)) problems.push({ path: "criteria", message: "Немає критеріїв оцінювання", severity: "error" });
      break;
    }

    case "flip_cards": {
      checkInstructions(config, problems);
      const cards = asArray(config.cards) as { front?: string; back?: string }[];
      if (cards.length === 0) problems.push({ path: "cards", message: "Немає жодної картки", severity: "error" });
      cards.forEach((c, i) => {
        if (isBlank(c.front) || isBlank(c.back)) {
          problems.push({ path: `cards[${i}]`, message: `Картка ${i + 1}: не заповнена лицьова або зворотна сторона`, severity: "error" });
        }
      });
      break;
    }

    case "phonetics": {
      checkInstructions(config, problems);
      const items = asArray(config.items) as { text?: string; transcription?: string }[];
      if (items.length === 0) problems.push({ path: "items", message: "Немає жодної репліки", severity: "error" });
      items.forEach((it, i) => {
        if (isBlank(it.text)) problems.push({ path: `items[${i}].text`, message: `Репліка ${i + 1}: немає тексту`, severity: "error" });
        if (isBlank(it.transcription))
          problems.push({ path: `items[${i}].transcription`, message: `Репліка ${i + 1}: немає транскрипції`, severity: "error" });
      });
      break;
    }

    case "callout": {
      const content = typeof config.content === "string" ? config.content.replace(/<[^>]*>/g, "").trim() : "";
      if (content.length === 0) problems.push({ path: "content", message: "Порожній вміст", severity: "error" });
      break;
    }

    case "embed": {
      if (isBlank(config.url)) problems.push({ path: "url", message: "Немає посилання", severity: "error" });
      break;
    }

    case "link": {
      if (isBlank(config.url)) problems.push({ path: "url", message: "Немає посилання", severity: "error" });
      break;
    }

    case "vocab_quiz": {
      const sceneIds = asArray(config.sceneIds) as string[];
      if (sceneIds.length === 0) problems.push({ path: "sceneIds", message: "Не обрано жодної сцени-джерела лексики", severity: "error" });
      break;
    }

    // error_correction/game/ai_examiner — без власної конфігурації, яку
    // заповнює вчителька в цій формі (error_correction обчислюється з даних
    // сцени, game більше не створюється, ai_examiner ще не має форми) —
    // нічого перевіряти.
    default:
      break;
  }

  return problems;
}

// Спільна крапка виклику для confirm-перед-збереженням — SaveForm
// (validateBeforeSubmit="task-config") і TaskCreateForm (нове завдання)
// обидва читають ЖИВУ FormData форми в момент сабміту (уже остаточний DOM
// у той момент, жодних rAF-затримок не потрібно, на відміну від
// live-прев'ю автоназви в task-config-fields.tsx). null — немає ПОМИЛОК
// (severity "error"), сабміт іде без підтвердження; hint-и підтвердження
// ніколи не викликають.
export function confirmMessageForTaskConfig(
  formData: FormData,
  buildConfig: (type: string, formData: FormData) => Config
): string | null {
  const type = formData.get("type") as string | null;
  if (!type) return null;
  const config = buildConfig(type, formData);
  const errors = validateTaskConfig(type, config).filter((p) => p.severity === "error");
  return errors.length > 0 ? `Є незаповнені поля (${errors.length}). Зберегти все одно?` : null;
}
