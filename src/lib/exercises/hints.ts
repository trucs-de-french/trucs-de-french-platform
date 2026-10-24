// Тексти пілюлі-підказки (hint-explanation.tsx, рендериться у короткій
// пілюлі TaskPanelHeader/HintPill, мокап "варіант 1") — одне місце для всіх
// типів із підказками, щоб текст не розходився між компонентами. Ключ —
// тип задачі. Короткі (без "Лампочка..." — сама пілюля вже показує
// лампочку й жирний лейбл "Підказка:" перед цим текстом), під ~45 символів.
export const HINT_EXPLANATIONS: Partial<Record<string, string>> = {
  word_search: "підсвітиться перша літера слова",
  crossword: "відкриється наступна літера слова",
  letter_gaps: "відкриється наступна літера",
  letter_rearrangement: "літера стане на своє місце",
  fill_blank: "відкриється перша літера поля",
  table_fill: "відкриється перша літера поля",
  word_choice: "відповідь українською",
  chronological_order: "підказка до всього завдання",
  multiple_choice: "підказка до запитання",
  reorder: "переклад речення українською",
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
