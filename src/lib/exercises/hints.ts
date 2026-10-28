import type { MessageKey } from "@/lib/i18n/messages/uk";

// Тексти пілюлі-підказки (hint-explanation.tsx, рендериться у короткій
// пілюлі TaskPanelHeader/HintPill, мокап "варіант 1") — одне місце для всіх
// типів із підказками, щоб текст не розходився між компонентами. Ключ —
// тип задачі, значення — ключ словника i18n (src/lib/i18n/messages/*.ts,
// префікс "hintExplanation."), не сам текст: переклад тепер лежить у
// словниках (uk — джерело правди, та сама формулювання, що тут були раніше).
export const HINT_EXPLANATION_KEYS: Partial<Record<string, MessageKey>> = {
  word_search: "hintExplanation.word_search",
  crossword: "hintExplanation.crossword",
  letter_gaps: "hintExplanation.letter_gaps",
  letter_rearrangement: "hintExplanation.letter_rearrangement",
  fill_blank: "hintExplanation.fill_blank",
  table_fill: "hintExplanation.table_fill",
  word_choice: "hintExplanation.word_choice",
  chronological_order: "hintExplanation.chronological_order",
  multiple_choice: "hintExplanation.multiple_choice",
  reorder: "hintExplanation.reorder",
};

// Пояснення "підказка дає половину балів" тепер одна спільна смужка під
// заголовком "Завдання" (scene-header-bar.tsx/page.tsx сцени) — раніше
// HINTS_REDUCE_POINTS_SUFFIX дублював цю фразу в КОЖНІЙ пілюлі підказки
// (hint-explanation.tsx, includeHalfPointsSuffix), прибрано разом із самим
// параметром.
export function taskHintReducesPoints(type: string, config: Record<string, unknown> | null | undefined): boolean {
  if (!config) return false;
  switch (type) {
    case "fill_blank":
    case "letter_gaps":
    case "letter_rearrangement":
    case "word_search":
    case "crossword":
    case "table_fill":
      // Механізм підказки вбудований у сам тип (не опційні дані завдання) —
      // hintsReducePoints сам вирішує, чи лампочка коштує балів.
      return !!config.hintsReducePoints;
    case "multiple_choice":
      return (
        !!config.hintsReducePoints &&
        Array.isArray(config.items) &&
        (config.items as { hint?: string }[]).some((it) => !!it?.hint)
      );
    case "word_choice":
      return (
        !!config.hintsReducePoints &&
        Array.isArray(config.sentences) &&
        (config.sentences as { hint?: string }[]).some((s) => !!s?.hint)
      );
    case "chronological_order":
      return !!config.hintsReducePoints && !!config.hint;
    case "drag_drop":
      return (
        !!config.hintsReducePoints &&
        Array.isArray(config.sentences) &&
        (config.sentences as { hints?: (string | null)[] }[]).some((s) => s.hints?.some((h) => !!h))
      );
    case "sort_columns":
      // sort_columns немає окремого hintsReducePoints — hintsEnabled сам
      // відмикає й лампочку, і 50%-знижку разом (grade.ts).
      return !!config.hintsEnabled;
    case "reorder":
      return (
        !!config.hintsReducePoints &&
        Array.isArray(config.sequences) &&
        (config.sequences as { hint?: string }[]).some((s) => !!s?.hint)
      );
    default:
      // open_answer (й решта типів без підказки взагалі) ніколи не
      // зменшує бали за підказку — OpenAnswerPublic не має hintsReducePoints.
      return false;
  }
}
