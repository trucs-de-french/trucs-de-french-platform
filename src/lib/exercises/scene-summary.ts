// Сценовий BILAN — чисті функції (без React/Supabase), той самий принцип,
// що error-review.ts: сторінка сцени (page.tsx) лише збирає дані з БД і
// передає сюди, усю арифметику робить цей файл, юніт-тестовний окремо.
//
// pointsPossible кожного завдання рахується з config НАПРЯМУ, тими самими
// resolveXxxPoints/getXxx-нормалізаторами, що вже й так реалізують
// knowledgeOf "скільки балів можлива ЦЯ вправа" у grade.ts (кожен виклик
// нижче — буквально та сама формула, що там на тій-таки позиції для
// totalPointsPossible/pointsPossible) — БЕЗ виклику gradeAnswer і БЕЗ
// жодної відповіді студента: нам потрібен лише знаменник, а не оцінка
// конкретної спроби, тож saving на виклику grading-коду, не дублювання
// його РЕЗУЛЬТАТУ (оцінки лишаються виключно роботою grade.ts/route.ts).
import {
  resolveFillBlankPoints,
  resolveLetterGapsPoints,
  resolveLetterRearrangementPoints,
  resolveWordChoicePoints,
  resolveWordSearchPoints,
  resolveCrosswordPoints,
  resolveKaraokePoints,
  resolveMultipleChoicePoints,
  getMultipleChoiceItems,
  resolveTrueFalsePoints,
  resolveMatchingPoints,
  getMatchingPairs,
  resolveListeningPoints,
  resolveReorderPoints,
  getReorderSequences,
  resolveDragDropPoints,
  getDragDropSentences,
  resolveSortColumnsPoints,
  resolveOpenAnswerPoints,
  getOpenAnswerQuestions,
  resolveTableFillPoints,
  getTableFillRows,
  resolveImageMatchPoints,
  resolveCheckboxGridPoints,
  resolveChronologicalOrderPoints,
} from "./sanitize";
import { isGradableTaskType } from "./gradable-types";
import type {
  FillBlankConfig,
  LetterGapsConfig,
  LetterRearrangementConfig,
  WordChoiceConfig,
  WordSearchConfig,
  CrosswordConfig,
  KaraokeConfig,
  MultipleChoiceConfig,
  TrueFalseConfig,
  TrueFalseStatement,
  MatchingConfig,
  ListeningConfig,
  ListeningQuestion,
  ReorderConfig,
  DragDropConfig,
  SortColumnsConfig,
  SortColumnsItem,
  OpenAnswerConfig,
  TableFillConfig,
  ImageMatchConfig,
  ImageMatchItem,
  CheckboxGridConfig,
  CheckboxGridRow,
  ChronologicalOrderConfig,
  ChronologicalOrderItem,
} from "./types";

// Повний знаменник балів цієї вправи (знаменник ЦІЛОЇ вправи, не блоку —
// той самий сенс, що totalPointsPossible у grade.ts/GradeResult). 0 для
// негардованого/невідомого типу (не має трапитись, бо виклик-сайт фільтрує
// isGradableTaskType заздалегідь — цей return лишається лише як безпечний
// дефолт, не частина формули).
export function totalPointsPossibleForTask(
  taskType: string,
  config: Record<string, unknown> | null
): number {
  const c = config ?? {};
  switch (taskType) {
    case "fill_blank":
      return resolveFillBlankPoints(c as unknown as FillBlankConfig);
    case "letter_gaps":
      return resolveLetterGapsPoints(c as unknown as LetterGapsConfig);
    case "letter_rearrangement":
      return resolveLetterRearrangementPoints(c as unknown as LetterRearrangementConfig);
    case "word_choice":
      return resolveWordChoicePoints(c as unknown as WordChoiceConfig);
    case "word_search":
      return resolveWordSearchPoints(c as unknown as WordSearchConfig);
    case "crossword":
      return resolveCrosswordPoints(c as unknown as CrosswordConfig);
    case "karaoke": {
      const karaokeConfig = c as unknown as KaraokeConfig;
      const gapCount = (karaokeConfig.lines ?? []).reduce(
        (sum, line) => sum + (line.gapTokenIndices?.length ?? 0),
        0
      );
      return resolveKaraokePoints(karaokeConfig) * gapCount;
    }
    case "multiple_choice":
      return getMultipleChoiceItems(c as unknown as MultipleChoiceConfig).reduce(
        (sum, item) => sum + resolveMultipleChoicePoints(item),
        0
      );
    case "true_false":
      return ((c as unknown as TrueFalseConfig).statements ?? []).reduce(
        (sum: number, s: TrueFalseStatement) => sum + resolveTrueFalsePoints(s),
        0
      );
    case "matching":
      return getMatchingPairs(c as unknown as MatchingConfig).reduce(
        (sum, pair) => sum + resolveMatchingPoints(pair),
        0
      );
    case "listening":
      return ((c as unknown as ListeningConfig).questions ?? []).reduce(
        (sum: number, q: ListeningQuestion) => sum + resolveListeningPoints(q),
        0
      );
    case "reorder":
      return getReorderSequences(c as unknown as ReorderConfig).reduce(
        (sum, seq) => sum + resolveReorderPoints(seq),
        0
      );
    case "drag_drop":
      return getDragDropSentences(c as unknown as DragDropConfig).reduce(
        (sum, sentence) => sum + resolveDragDropPoints(sentence),
        0
      );
    case "sort_columns":
      return ((c as unknown as SortColumnsConfig).items ?? []).reduce(
        (sum: number, item: SortColumnsItem) => sum + resolveSortColumnsPoints(item),
        0
      );
    case "open_answer":
      return getOpenAnswerQuestions(c as unknown as OpenAnswerConfig).reduce(
        (sum, q) => sum + resolveOpenAnswerPoints(q),
        0
      );
    case "table_fill":
      return getTableFillRows(c as unknown as TableFillConfig)
        .filter((row) => row.leftHidden || row.rightHidden)
        .reduce((sum, row) => sum + resolveTableFillPoints(row), 0);
    case "image_match":
      return ((c as unknown as ImageMatchConfig).items ?? []).reduce(
        (sum: number, item: ImageMatchItem) => sum + resolveImageMatchPoints(item),
        0
      );
    case "checkbox_grid":
      return ((c as unknown as CheckboxGridConfig).rows ?? []).reduce(
        (sum: number, row: CheckboxGridRow) => sum + resolveCheckboxGridPoints(row),
        0
      );
    case "chronological_order":
      return ((c as unknown as ChronologicalOrderConfig).items ?? []).reduce(
        (sum: number, item: ChronologicalOrderItem) => sum + resolveChronologicalOrderPoints(item),
        0
      );
    default:
      return 0;
  }
}

export type SceneTaskProgressRow = {
  score: number | null;
  bestScore: number | null;
  blockProgress: Record<string, { pointsEarned?: number; bestPointsEarned?: number }> | null;
};

export type SceneTaskBest = {
  pointsPossible: number;
  pointsEarned: number;
  attempted: boolean;
};

// Бали НАЙКРАЩОЇ спроби завдання — для блокових типів (word_search/
// crossword/matching/table_fill/letter_gaps/letter_rearrangement) напряму
// з block_progress[*].bestPointsEarned (0063_best_attempt.sql; fallback
// pointsEarned для рядків, де найкращу спробу ще не рахували); для решти —
// з best_score (fallback score, якщо рядок створений до 0062) у відсотку
// від pointsPossible, тим самим перетворенням, що RPC record_task_attempt
// робить навпаки (score = round(100*earned/possible)).
export function computeTaskBest(
  taskType: string,
  config: Record<string, unknown> | null,
  progress: SceneTaskProgressRow | undefined
): SceneTaskBest {
  const pointsPossible = totalPointsPossibleForTask(taskType, config);

  if (!progress) {
    return { pointsPossible, pointsEarned: 0, attempted: false };
  }

  if (progress.blockProgress && Object.keys(progress.blockProgress).length > 0) {
    const pointsEarned = Object.values(progress.blockProgress).reduce(
      (sum, block) => sum + (block.bestPointsEarned ?? block.pointsEarned ?? 0),
      0
    );
    return { pointsPossible, pointsEarned, attempted: true };
  }

  const bestPercent = progress.bestScore ?? progress.score ?? 0;
  const pointsEarned = pointsPossible > 0 ? (pointsPossible * bestPercent) / 100 : 0;
  return { pointsPossible, pointsEarned, attempted: true };
}

export type SceneSummaryTaskInput = {
  taskId: string;
  taskType: string;
  config: Record<string, unknown> | null;
  progress: SceneTaskProgressRow | undefined;
};

export type SceneSummaryTask = SceneSummaryTaskInput & {
  pointsPossible: number;
  pointsEarned: number;
  attempted: boolean;
  percent: number;
};

export type SceneSummary = {
  pointsEarned: number;
  pointsPossible: number;
  percent: number;
  allAttempted: boolean;
  allMastered: boolean;
  tasksToRedo: SceneSummaryTask[];
};

// Відсоток, нижче якого завдання потрапляє в "Exercices à refaire" — той
// самий порядок величини, що межа verdict-у "Très bien !" нижче (одна й та
// сама межа навмисно: "ще не Très bien" і "варто повторити" — те саме
// судження). Винесено в константу, щоб легко змінити лише в одному місці.
export const BILAN_REDO_THRESHOLD_PERCENT = 70;

// Межі verdict-у — ЄДИНЕ місце для порогів (задача просить саме це), легко
// змінити. Перевіряються згори вниз, перший, що підходить (percent >= min),
// виграє — порядок елементів масиву важливий.
export const BILAN_VERDICT_THRESHOLDS = [
  { min: 90, label: "Excellent !" },
  { min: BILAN_REDO_THRESHOLD_PERCENT, label: "Très bien !" },
  { min: 50, label: "Bien" },
  { min: 0, label: "À retravailler" },
] as const;

// Вердикт — ЗАВЖДИ французькою (задача: "verdict ALWAYS French, never
// translated"), незалежно від ui_lang продукту — тому НЕ через i18n-словники
// (uk/fr/en.ts вимагають рядок для КОЖНОЇ мови, тут навмисно один і той же
// текст для всіх). frenchNbsp (нерозривний пробіл перед "!") застосовує
// викликач (bilan-card.tsx), не тут — ця функція лише вибирає рядок.
export function bilanVerdict(percent: number): string {
  for (const threshold of BILAN_VERDICT_THRESHOLDS) {
    if (percent >= threshold.min) return threshold.label;
  }
  return BILAN_VERDICT_THRESHOLDS[BILAN_VERDICT_THRESHOLDS.length - 1].label;
}

// null — "не рендерити BILAN взагалі" (задача, крок 3): або в сцені немає
// жодного завдання з балами (possible<=0), або студент іще нічого не здавав
// (жодного progress-рядка серед гардованих завдань).
export function buildSceneSummary(tasks: SceneSummaryTaskInput[]): SceneSummary | null {
  const computed: SceneSummaryTask[] = tasks
    .filter((t) => isGradableTaskType(t.taskType))
    .map((t) => {
      const { pointsPossible, pointsEarned, attempted } = computeTaskBest(
        t.taskType,
        t.config,
        t.progress
      );
      const percent = pointsPossible > 0 ? Math.round((100 * pointsEarned) / pointsPossible) : 0;
      return { ...t, pointsPossible, pointsEarned, attempted, percent };
    });

  const pointsPossible = computed.reduce((sum, t) => sum + t.pointsPossible, 0);
  const pointsEarned = computed.reduce((sum, t) => sum + t.pointsEarned, 0);
  const anyAttempted = computed.some((t) => t.attempted);

  if (pointsPossible <= 0 || !anyAttempted) return null;

  const percent = Math.round((100 * pointsEarned) / pointsPossible);
  const allAttempted = computed.every((t) => t.attempted);

  // Не здане — наприкінці списку (замінює відсоток на "Pas encore fait",
  // не 0%, навмисно не сортується разом із реально низькими відсотками);
  // здане, але нижче порогу — за зростанням відсотка (найгірше спершу).
  const tasksToRedo = computed
    .filter((t) => !t.attempted || t.percent < BILAN_REDO_THRESHOLD_PERCENT)
    .sort((a, b) => {
      if (a.attempted !== b.attempted) return a.attempted ? -1 : 1;
      return a.percent - b.percent;
    });

  return {
    pointsEarned,
    pointsPossible,
    percent,
    allAttempted,
    allMastered: allAttempted && tasksToRedo.length === 0,
    tasksToRedo,
  };
}
