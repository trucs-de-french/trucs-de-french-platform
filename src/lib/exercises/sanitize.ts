import type {
  FillBlankConfig,
  FillBlankPublic,
  LetterGapsConfig,
  LetterGapsPublic,
  LetterRearrangementConfig,
  LetterRearrangementPublic,
  MultipleChoiceConfig,
  MultipleChoicePublic,
  MultipleChoiceItem,
  WordChoiceConfig,
  WordChoicePublic,
  WordSearchConfig,
  WordSearchPublic,
  TrueFalseConfig,
  TrueFalsePublic,
  TrueFalseStatement,
  MatchingConfig,
  MatchingPair,
  MatchingPublic,
  ListeningConfig,
  ListeningQuestion,
  ListeningPublic,
  ReorderConfig,
  ReorderPublic,
  ReorderSequence,
  DragDropConfig,
  DragDropPublic,
  DragDropSentence,
  SortColumnsConfig,
  SortColumnsItem,
  SortColumnsPublic,
  OpenAnswerConfig,
  OpenAnswerPublic,
  OpenAnswerQuestion,
  TableFillConfig,
  TableFillRow,
  TableFillPublic,
  ImageMatchConfig,
  ImageMatchItem,
  ImageMatchPublic,
  CheckboxGridConfig,
  CheckboxGridRow,
  CheckboxGridPublic,
  ChronologicalOrderConfig,
  ChronologicalOrderItem,
  ChronologicalOrderPublic,
  CrosswordConfig,
  CrosswordPublic,
} from "./types";
import { type GradableTaskType, assertNeverGradableType } from "./gradable-types";
import { buildCrosswordOpenCells, buildCrosswordCellNumbers, buildCrosswordSolution } from "./crossword-grid";

export const BLANK_RE = /\{\{([^}]*)\}\}/g;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Пілот системи балів, Група B, останній тип (див. resolveTrueFalsePoints)
// — дефолт 1. На відміну від решти resolveXxxPoints, приймає ЦІЛИЙ config,
// не елемент масиву — тут узагалі нема масиву, бали на всю вправу.
export function resolveFillBlankPoints(config: FillBlankConfig): number {
  return config.points ?? 1;
}

export function sanitizeFillBlank(config: FillBlankConfig): FillBlankPublic {
  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    template: config.template.replace(BLANK_RE, "{{}}"),
    points: resolveFillBlankPoints(config),
    // Довідкові бульбашки — пропускаємо як є, не тасуємо (той самий
    // порядок, що вписав вчитель), нема що приховувати.
    wordBank: config.wordBank,
  };
}

export function resolveLetterGapsPoints(config: LetterGapsConfig): number {
  return config.points ?? 1;
}

// Явна маска на рівні символів (null на прихованих позиціях) — не просто
// word+hiddenIndices, бо це віддало б студенту прямий доступ до прихованих
// літер через сам word.
export function sanitizeLetterGaps(config: LetterGapsConfig): LetterGapsPublic {
  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    points: resolveLetterGapsPoints(config),
    words: config.words.map((w) => ({
      chars: w.word.split("").map((c, i) => (w.hiddenIndices.includes(i) ? null : c)),
      hintType: w.hintType,
      hintText: w.hintText,
      imageUrl: w.imageUrl,
      audioUrl: w.audioUrl,
    })),
  };
}

export function resolveLetterRearrangementPoints(config: LetterRearrangementConfig): number {
  return config.points ?? 1;
}

// shuffle() — той самий Fisher-Yates, що вже sanitizeReorder — одне
// перемішування на кожен виклик sanitize (тобто на кожен SSR-рендер
// студентської сторінки), не збережене в БД. Успадковує ту саму властивість
// reorder: теоретично може випадково повернути вже правильний порядок.
export function sanitizeLetterRearrangement(config: LetterRearrangementConfig): LetterRearrangementPublic {
  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    points: resolveLetterRearrangementPoints(config),
    words: config.words.map((w) => ({
      shuffledLetters: shuffle(w.word.split("")),
      hintType: w.hintType,
      hintText: w.hintText,
      imageUrl: w.imageUrl,
      audioUrl: w.audioUrl,
    })),
  };
}

// Стара пласка форма ({question, display, options}, до багатореченнєвої
// версії) — виродковий випадок нової: одне речення без явного id;
// instructions у старих даних не було взагалі, лишається порожнім.
export function getMultipleChoiceItems(config: MultipleChoiceConfig): MultipleChoiceItem[] {
  if (config.items?.length) return config.items;
  const legacy = config as unknown as { question?: string; options?: MultipleChoiceItem["options"] };
  if (legacy.question !== undefined) {
    return [{ id: "legacy", sentence: legacy.question, options: legacy.options ?? [] }];
  }
  return [];
}

// Пілот системи балів (див. resolveTrueFalsePoints) — дефолт 1.
export function resolveMultipleChoicePoints(item: MultipleChoiceItem): number {
  return item.points ?? 1;
}

export function sanitizeMultipleChoice(config: MultipleChoiceConfig): MultipleChoicePublic {
  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    display: config.display,
    items: getMultipleChoiceItems(config).map((item) => {
      const correctCount = item.options.filter((o) => o.correct).length;
      return {
        id: item.id,
        sentence: item.sentence,
        multiple: correctCount > 1,
        correctCount,
        options: item.options.map(({ id, text, imageUrl }) => ({ id, text, imageUrl })),
        points: resolveMultipleChoicePoints(item),
      };
    }),
  };
}

// На всю вправу (як resolveLetterGapsPoints), не на речення — на відміну
// від resolveMultipleChoicePoints.
export function resolveWordChoicePoints(config: WordChoiceConfig): number {
  return config.points ?? 1;
}

// correct ховається з options (як sanitizeMultipleChoice) — без mode-
// специфічної обробки тут: обидва режими (select/cross_out) на клієнті
// бачать той самий набір варіантів, різниться лише спосіб взаємодії.
export function sanitizeWordChoice(config: WordChoiceConfig): WordChoicePublic {
  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    mode: config.mode,
    points: resolveWordChoicePoints(config),
    sentences: config.sentences.map((s) => {
      const correctCount = s.options.filter((o) => o.correct).length;
      return {
        id: s.id,
        sentence: s.sentence,
        multiple: correctCount > 1,
        correctCount,
        options: s.options.map(({ id, text }) => ({ id, text })),
      };
    }),
  };
}

// На кожне слово (як resolveReorderPoints), не на всю вправу — на відміну
// від resolveWordChoicePoints.
// На всю вправу (як resolveLetterGapsPoints), не на слово.
export function resolveWordSearchPoints(config: WordSearchConfig): number {
  return config.points ?? 1;
}

// placements — ЄДИНЕ, що ховається (координати відповідей); grid і words
// передаються як є — не секрет, студент і так бачить усю сітку й список
// слів для пошуку.
export function sanitizeWordSearch(config: WordSearchConfig): WordSearchPublic {
  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    grid: config.grid,
    // translation/imageUrl/audioUrl передаються як є — не секрет, це
    // підказки в легенді (на відміну від placements, який тут відсутній
    // узагалі).
    words: config.words,
    points: resolveWordSearchPoints(config),
  };
}

export function resolveCrosswordPoints(config: CrosswordConfig): number {
  return config.points ?? 1;
}

// На відміну від sanitizeWordSearch (де секрет — лише placements, сітка
// літер видима повністю), тут секрет — САМІ ЛІТЕРИ: openCells/cellNumbers
// синтезуються з placements (форма+номери, без жодної літери), across/down
// будуються групуванням тих самих placements за напрямком, відсортованих
// за вже пораховним number (generateCrosswordGrid). placements студенту не
// передаються взагалі.
export function sanitizeCrossword(config: CrosswordConfig): CrosswordPublic {
  const { placements, gridWidth, gridHeight } = config;
  const byDirection = (direction: "horizontal" | "vertical") =>
    placements
      .filter((p) => p.direction === direction)
      .sort((a, b) => a.number - b.number)
      .map((p) => ({
        number: p.number,
        clue: p.clue,
        clueStyle: p.clueStyle,
        length: p.word.length,
        imageUrl: p.imageUrl,
        audioUrl: p.audioUrl,
      }));

  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    gridWidth,
    gridHeight,
    openCells: buildCrosswordOpenCells(placements, gridWidth, gridHeight),
    cellNumbers: buildCrosswordCellNumbers(placements, gridWidth, gridHeight),
    solution: buildCrosswordSolution(placements, gridWidth, gridHeight),
    across: byDirection("horizontal"),
    down: byDirection("vertical"),
    points: resolveCrosswordPoints(config),
  };
}

// Пілот системи балів (points_visible на tasks) — дефолт 1 бал для
// тверджень без явного значення, щоб наявні задачі й далі мали сенс без
// ретроактивного заповнення. grade.ts викликає цю саму функцію, той самий
// cross-import принцип, що вже є для getOpenAnswerQuestions/BLANK_RE.
export function resolveTrueFalsePoints(statement: TrueFalseStatement): number {
  return statement.points ?? 1;
}

export function sanitizeTrueFalse(config: TrueFalseConfig): TrueFalsePublic {
  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    statements: config.statements.map((s) => ({
      id: s.id,
      text: s.text,
      points: resolveTrueFalsePoints(s),
    })),
  };
}

// Стара форма (пари без id, до пілоту балів) — виродковий випадок нової:
// стабільний синтетичний id за позицією. НЕ рандомний (crypto.randomUUID
// на кожне читання зламав би адресацію балів між рендерами).
export function getMatchingPairs(config: MatchingConfig): (MatchingPair & { id: string })[] {
  return config.pairs.map((p, i) => ({ ...p, id: p.id ?? `pair-${i}` }));
}

// Пілот системи балів, Група B (див. resolveTrueFalsePoints) — дефолт 1.
export function resolveMatchingPoints(pair: MatchingPair): number {
  return pair.points ?? 1;
}

export function sanitizeMatching(config: MatchingConfig): MatchingPublic {
  const pairs = getMatchingPairs(config);
  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    left: config.pairs.map((p) => p.left),
    right: shuffle(config.pairs.map((p) => p.right)),
    // left тут НЕ перемішаний — той самий порядок, що в left[] вище.
    pairs: pairs.map((p) => ({ id: p.id, left: p.left, points: resolveMatchingPoints(p) })),
  };
}

// Пілот системи балів (див. resolveTrueFalsePoints) — дефолт 1.
export function resolveListeningPoints(question: ListeningQuestion): number {
  return question.points ?? 1;
}

export function sanitizeListening(config: ListeningConfig): ListeningPublic {
  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    audioUrl: config.audioUrl,
    questions: config.questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options.map(({ id, text, imageUrl }) => ({ id, text, imageUrl })),
      points: resolveListeningPoints(q),
    })),
  };
}

// Стара пласка форма ({instructions?, items}, до багатопослідовної версії) —
// виродковий випадок нової: одна послідовність без явного id. Той самий
// принцип, що getOpenAnswerQuestions.
export function getReorderSequences(config: ReorderConfig): ReorderSequence[] {
  if (config.sequences?.length) return config.sequences;
  const legacy = config as unknown as { items?: string[] };
  if (legacy.items !== undefined) {
    return [{ id: "legacy", items: legacy.items }];
  }
  return [];
}

// Пілот системи балів (див. resolveTrueFalsePoints) — дефолт 1.
export function resolveReorderPoints(sequence: ReorderSequence): number {
  return sequence.points ?? 1;
}

export function sanitizeReorder(config: ReorderConfig): ReorderPublic {
  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    // shuffle ОКРЕМО на кожну послідовність — інакше плитки з різних речень
    // перемішалися б між собою.
    sequences: getReorderSequences(config).map((s) => ({
      id: s.id,
      items: shuffle(s.items),
      points: resolveReorderPoints(s),
    })),
  };
}

// Стара пласка форма ({instructions?, template, bank}, до багатореченнєвої
// версії) — виродковий випадок нової: одне речення без явного id. bank у
// цій формі вже плаский, нормалізації не потребує.
export function getDragDropSentences(config: DragDropConfig): DragDropSentence[] {
  if (config.sentences?.length) return config.sentences;
  const legacy = config as unknown as { template?: string };
  if (legacy.template !== undefined) {
    return [{ id: "legacy", template: legacy.template }];
  }
  return [];
}

// Пілот системи балів, Група B (див. resolveTrueFalsePoints) — дефолт 1.
export function resolveDragDropPoints(sentence: DragDropSentence): number {
  return sentence.points ?? 1;
}

export function sanitizeDragDrop(config: DragDropConfig): DragDropPublic {
  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    sentences: getDragDropSentences(config).map((s) => ({
      id: s.id,
      template: s.template.replace(BLANK_RE, "{{}}"),
      points: resolveDragDropPoints(s),
    })),
    // Один спільний банк на всю вправу (не по реченню) — свідоме рішення.
    bank: shuffle(config.bank),
  };
}

// Пілот системи балів (див. resolveTrueFalsePoints) — дефолт 1.
export function resolveSortColumnsPoints(item: SortColumnsItem): number {
  return item.points ?? 1;
}

export function sanitizeSortColumns(config: SortColumnsConfig): SortColumnsPublic {
  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    columns: config.columns,
    items: shuffle(
      config.items.map((i) => ({ id: i.id, text: i.text, points: resolveSortColumnsPoints(i) }))
    ),
  };
}

// Стара пласка форма ({question, answers}, до багатопитальної версії) —
// виродковий випадок нової: одне питання без явного id. Нормалізується тут
// (не в БД), і grade.ts, і sanitize.ts викликають цю саму функцію — той самий
// принцип спільного імпорту з sanitize.ts, що вже є для BLANK_RE.
export function getOpenAnswerQuestions(config: OpenAnswerConfig): OpenAnswerQuestion[] {
  if (config.questions?.length) return config.questions;
  const legacy = config as unknown as { question?: string; answers?: string[] };
  if (legacy.question !== undefined) {
    return [{ id: "legacy", question: legacy.question, answers: legacy.answers ?? [] }];
  }
  return [];
}

// Пілот системи балів (див. resolveTrueFalsePoints) — дефолт 1.
export function resolveOpenAnswerPoints(question: OpenAnswerQuestion): number {
  return question.points ?? 1;
}

export function sanitizeOpenAnswer(config: OpenAnswerConfig): OpenAnswerPublic {
  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    questions: getOpenAnswerQuestions(config).map((q) => ({
      id: q.id,
      question: q.question,
      points: resolveOpenAnswerPoints(q),
    })),
  };
}

// Пілот системи балів, Група B (див. resolveTrueFalsePoints) — дефолт 1.
export function resolveTableFillPoints(row: TableFillRow): number {
  return row.points ?? 1;
}

export function sanitizeTableFill(config: TableFillConfig): TableFillPublic {
  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    columnLabels: config.columnLabels,
    rows: config.rows.map((r) => ({
      id: r.id,
      left: r.leftHidden ? null : r.left,
      right: r.rightHidden ? null : r.right,
      points: resolveTableFillPoints(r),
    })),
  };
}

// Пілот системи балів (див. resolveTrueFalsePoints) — дефолт 1.
export function resolveImageMatchPoints(item: ImageMatchItem): number {
  return item.points ?? 1;
}

export function sanitizeImageMatch(config: ImageMatchConfig): ImageMatchPublic {
  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    items: config.items.map((i) => ({
      id: i.id,
      imageUrl: i.imageUrl,
      points: resolveImageMatchPoints(i),
    })),
    bank: shuffle(config.items.map((i) => i.name)),
  };
}

// Той самий пілот, що resolveTrueFalsePoints — дефолт 1. На рівні РЯДКА
// (не клітинки, той самий компроміс, що resolveTableFillPoints).
export function resolveCheckboxGridPoints(row: CheckboxGridRow): number {
  return row.points ?? 1;
}

export function sanitizeCheckboxGrid(config: CheckboxGridConfig): CheckboxGridPublic {
  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    columns: config.columns,
    rows: config.rows.map((r) => ({
      id: r.id,
      label: r.label,
      points: resolveCheckboxGridPoints(r),
    })),
  };
}

// Той самий пілот, що resolveImageMatchPoints — дефолт 1, на рівні елемента
// (тут кожен елемент самодостатній, немає групування по "рядку").
export function resolveChronologicalOrderPoints(item: ChronologicalOrderItem): number {
  return item.points ?? 1;
}

export function sanitizeChronologicalOrder(
  config: ChronologicalOrderConfig
): ChronologicalOrderPublic {
  return {
    instructions: config.instructions,
    subInstructions: config.subInstructions,
    mode: config.mode,
    // Перемішуємо самі елементи (не окремий "банк", як image_match) — тут
    // немає окремого набору відповідей, порядок показу і є тим, що
    // приховує правильну хронологію.
    items: shuffle(
      config.items.map((i) => ({
        id: i.id,
        content: i.content,
        points: resolveChronologicalOrderPoints(i),
      }))
    ),
  };
}

export function sanitizeConfigForStudent(
  type: GradableTaskType,
  config: Record<string, unknown>
): Record<string, unknown> {
  switch (type) {
    case "fill_blank":
      return sanitizeFillBlank(config as unknown as FillBlankConfig);
    case "letter_gaps":
      return sanitizeLetterGaps(config as unknown as LetterGapsConfig);
    case "letter_rearrangement":
      return sanitizeLetterRearrangement(config as unknown as LetterRearrangementConfig);
    case "multiple_choice":
      return sanitizeMultipleChoice(config as unknown as MultipleChoiceConfig);
    case "word_choice":
      return sanitizeWordChoice(config as unknown as WordChoiceConfig);
    case "word_search":
      return sanitizeWordSearch(config as unknown as WordSearchConfig);
    case "crossword":
      return sanitizeCrossword(config as unknown as CrosswordConfig);
    case "true_false":
      return sanitizeTrueFalse(config as unknown as TrueFalseConfig);
    case "matching":
      return sanitizeMatching(config as unknown as MatchingConfig);
    case "listening":
      return sanitizeListening(config as unknown as ListeningConfig);
    case "reorder":
      return sanitizeReorder(config as unknown as ReorderConfig);
    case "drag_drop":
      return sanitizeDragDrop(config as unknown as DragDropConfig);
    case "sort_columns":
      return sanitizeSortColumns(config as unknown as SortColumnsConfig);
    case "open_answer":
      return sanitizeOpenAnswer(config as unknown as OpenAnswerConfig);
    case "table_fill":
      return sanitizeTableFill(config as unknown as TableFillConfig);
    case "checkbox_grid":
      return sanitizeCheckboxGrid(config as unknown as CheckboxGridConfig);
    case "image_match":
      return sanitizeImageMatch(config as unknown as ImageMatchConfig);
    case "chronological_order":
      return sanitizeChronologicalOrder(config as unknown as ChronologicalOrderConfig);
    default:
      return assertNeverGradableType(type);
  }
}
