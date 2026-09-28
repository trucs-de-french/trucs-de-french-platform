// "Розподілити 100 балів" (admin/scenes/actions.ts, SceneStickyActions) —
// два незалежні кроки:
// 1. computeSceneTaskPoints — скільки балів дістає КОЖНА ВПРАВА сцени
//    (task.points_i), пропорційно TASK_TYPE_COMPLEXITY_WEIGHT.
// 2. applyDistributedPoints — як саме target-число записати в config
//    ОДНІЄЇ вправи. Дві архітектурно різні групи типів (див.
//    task-type-meta.ts і types.ts):
//    - Група A (fill_blank/letter_gaps/letter_rearrangement/word_choice/
//      word_search/crossword) — один total у config.points, просто
//      перезаписується.
//    - Група B (усі інші, крім karaoke) — бали НА КОЖНОМУ ЕЛЕМЕНТІ
//      (statements/items/pairs/questions/sequences/sentences/rows), єдиного
//      total-поля немає. Рішення (узгоджено з учителькою): total_i
//      ділиться ПОРІВНУ між елементами вправи, залишок — на ПЕРШИЙ елемент
//      за порядком (той самий принцип округлення, що на рівні задач).
//      Свідомо ІГНОРУЄ попередні ручні ваги елементів — простіше і
//      передбачуваніше для вчительки, ніж пропорційне масштабування.
//    - karaoke (Група C) — бали НА ПРОПУСК (pointsPerGap), не на елемент:
//      pointsPerGap = round(target / кількість пропусків). Реальна сума
//      тому може відхилятись від target на округлення (не на елементах, як
//      скрізь інде) — це притаманне обмеження ставки-на-пропуск, не баг.
import { assertNeverGradableType, type GradableTaskType } from "./gradable-types";
import { TASK_TYPE_COMPLEXITY_WEIGHT } from "./task-type-meta";
import {
  getMultipleChoiceItems,
  getMatchingPairs,
  getReorderSequences,
  getDragDropSentences,
  getOpenAnswerQuestions,
  getTableFillRows,
} from "./sanitize";
import type {
  TrueFalseConfig,
  MultipleChoiceConfig,
  MatchingConfig,
  ListeningConfig,
  ReorderConfig,
  DragDropConfig,
  SortColumnsConfig,
  TableFillConfig,
  CheckboxGridConfig,
  ImageMatchConfig,
  ChronologicalOrderConfig,
  OpenAnswerConfig,
  KaraokeConfig,
} from "./types";

// tasks — ВЖЕ відфільтровані на gradable типи (caller: scenes/actions.ts),
// у порядку "перша за порядком" (прямі задачі сцени, потім задачі в
// блоках — той самий порядок, що вчителька бачить у списку) — саме цей
// порядок вирішує нічию на найбільшу вагу нижче.
export function computeSceneTaskPoints(tasks: { id: string; type: GradableTaskType }[]): Map<string, number> {
  if (tasks.length === 0) return new Map();

  const weights = tasks.map((t) => TASK_TYPE_COMPLEXITY_WEIGHT[t.type]);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const floors = weights.map((w) => Math.floor((100 * w) / totalWeight));
  const distributed = floors.reduce((sum, f) => sum + f, 0);
  const remainder = 100 - distributed;

  // Найбільша вага серед задач сцени; ПЕРША за порядком серед тих, хто її
  // має — findIndex, не reduce з ручним порівнянням, той самий ефект.
  const maxWeight = Math.max(...weights);
  const remainderTargetIndex = weights.findIndex((w) => w === maxWeight);
  floors[remainderTargetIndex] += remainder;

  const result = new Map<string, number>();
  tasks.forEach((t, i) => result.set(t.id, floors[i]));
  return result;
}

// Порівну між елементами масиву, залишок округлення — на ПЕРШИЙ елемент.
// Generic, не per-тип — той самий розподіл для statements/items/pairs/
// questions/sequences/sentences/rows, різниться лише яке поле й геттер
// (легасі-нормалізація) обирає applyDistributedPoints нижче.
function distributeEvenly<T extends { points?: number }>(items: T[], targetPoints: number): T[] {
  if (items.length === 0) return items;
  const base = Math.floor(targetPoints / items.length);
  const remainder = targetPoints - base * items.length;
  return items.map((item, i) => ({ ...item, points: i === 0 ? base + remainder : base }));
}

// Записує targetPoints (з computeSceneTaskPoints) у config ОДНІЄЇ вправи —
// повертає НОВИЙ config (не мутує вхідний), решта полів незмінні. Вичерпний
// switch за GradableTaskType (той самий принцип, що grade.ts/sanitize.ts) —
// новий тип у GRADABLE_TASK_TYPES без гілки тут не дасть скомпілюватись.
export function applyDistributedPoints(
  type: GradableTaskType,
  config: Record<string, unknown>,
  targetPoints: number
): Record<string, unknown> {
  switch (type) {
    // Група A — один total, просто перезаписується.
    case "fill_blank":
    case "letter_gaps":
    case "letter_rearrangement":
    case "word_choice":
    case "word_search":
    case "crossword":
      return { ...config, points: targetPoints };

    // Група B — бали на елементі, немає total-поля; розподіл порівну.
    case "true_false": {
      const c = config as unknown as TrueFalseConfig;
      return { ...c, statements: distributeEvenly(c.statements ?? [], targetPoints) };
    }
    case "multiple_choice": {
      const c = config as unknown as MultipleChoiceConfig;
      return { ...c, items: distributeEvenly(getMultipleChoiceItems(c), targetPoints) };
    }
    case "matching": {
      const c = config as unknown as MatchingConfig;
      return { ...c, pairs: distributeEvenly(getMatchingPairs(c), targetPoints) };
    }
    case "listening": {
      const c = config as unknown as ListeningConfig;
      return { ...c, questions: distributeEvenly(c.questions ?? [], targetPoints) };
    }
    case "reorder": {
      const c = config as unknown as ReorderConfig;
      return { ...c, sequences: distributeEvenly(getReorderSequences(c), targetPoints) };
    }
    case "drag_drop": {
      const c = config as unknown as DragDropConfig;
      return { ...c, sentences: distributeEvenly(getDragDropSentences(c), targetPoints) };
    }
    case "sort_columns": {
      const c = config as unknown as SortColumnsConfig;
      return { ...c, items: distributeEvenly(c.items ?? [], targetPoints) };
    }
    case "table_fill": {
      const c = config as unknown as TableFillConfig;
      return { ...c, rows: distributeEvenly(getTableFillRows(c), targetPoints) };
    }
    case "checkbox_grid": {
      const c = config as unknown as CheckboxGridConfig;
      return { ...c, rows: distributeEvenly(c.rows ?? [], targetPoints) };
    }
    case "image_match": {
      const c = config as unknown as ImageMatchConfig;
      return { ...c, items: distributeEvenly(c.items ?? [], targetPoints) };
    }
    case "chronological_order": {
      const c = config as unknown as ChronologicalOrderConfig;
      return { ...c, items: distributeEvenly(c.items ?? [], targetPoints) };
    }
    case "open_answer": {
      const c = config as unknown as OpenAnswerConfig;
      return { ...c, questions: distributeEvenly(getOpenAnswerQuestions(c), targetPoints) };
    }

    // Група C — ставка на пропуск, не на елемент; порожня вправа (0
    // пропусків) лишається без змін, ставити нема на що.
    case "karaoke": {
      const c = config as unknown as KaraokeConfig;
      const totalGaps = (c.lines ?? []).reduce((sum, l) => sum + (l.gapTokenIndices?.length ?? 0), 0);
      if (totalGaps === 0) return c;
      return { ...c, pointsPerGap: Math.round(targetPoints / totalGaps) };
    }

    default:
      return assertNeverGradableType(type);
  }
}
