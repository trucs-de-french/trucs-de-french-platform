import type {
  FillBlankConfig,
  FillBlankPublic,
  MultipleChoiceConfig,
  MultipleChoicePublic,
  TrueFalseConfig,
  TrueFalsePublic,
  MatchingConfig,
  MatchingPublic,
  ListeningConfig,
  ListeningPublic,
  ReorderConfig,
  ReorderPublic,
  DragDropConfig,
  DragDropPublic,
  SortColumnsConfig,
  SortColumnsPublic,
  OpenAnswerConfig,
  OpenAnswerPublic,
  TableFillConfig,
  TableFillPublic,
} from "./types";
import { type GradableTaskType, assertNeverGradableType } from "./gradable-types";

export const BLANK_RE = /\{\{([^}]*)\}\}/g;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function sanitizeFillBlank(config: FillBlankConfig): FillBlankPublic {
  return {
    instructions: config.instructions,
    template: config.template.replace(BLANK_RE, "{{}}"),
  };
}

export function sanitizeMultipleChoice(config: MultipleChoiceConfig): MultipleChoicePublic {
  const correctCount = config.options.filter((o) => o.correct).length;
  return {
    question: config.question,
    display: config.display,
    multiple: correctCount > 1,
    correctCount,
    options: config.options.map(({ id, text }) => ({ id, text })),
  };
}

export function sanitizeTrueFalse(config: TrueFalseConfig): TrueFalsePublic {
  return {
    instructions: config.instructions,
    statements: config.statements.map(({ id, text }) => ({ id, text })),
  };
}

export function sanitizeMatching(config: MatchingConfig): MatchingPublic {
  return {
    instructions: config.instructions,
    left: config.pairs.map((p) => p.left),
    right: shuffle(config.pairs.map((p) => p.right)),
  };
}

export function sanitizeListening(config: ListeningConfig): ListeningPublic {
  return {
    instructions: config.instructions,
    audioUrl: config.audioUrl,
    questions: config.questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options.map(({ id, text }) => ({ id, text })),
    })),
  };
}

export function sanitizeReorder(config: ReorderConfig): ReorderPublic {
  return { instructions: config.instructions, items: shuffle(config.items) };
}

export function sanitizeDragDrop(config: DragDropConfig): DragDropPublic {
  return {
    instructions: config.instructions,
    template: config.template.replace(BLANK_RE, "{{}}"),
    bank: shuffle(config.bank),
  };
}

export function sanitizeSortColumns(config: SortColumnsConfig): SortColumnsPublic {
  return {
    instructions: config.instructions,
    columns: config.columns,
    items: shuffle(config.items.map(({ id, text }) => ({ id, text }))),
  };
}

export function sanitizeOpenAnswer(config: OpenAnswerConfig): OpenAnswerPublic {
  return { question: config.question };
}

export function sanitizeTableFill(config: TableFillConfig): TableFillPublic {
  return {
    instructions: config.instructions,
    columnLabels: config.columnLabels,
    rows: config.rows.map((r) => ({
      id: r.id,
      left: r.leftHidden ? null : r.left,
      right: r.rightHidden ? null : r.right,
    })),
  };
}

export function sanitizeConfigForStudent(
  type: GradableTaskType,
  config: Record<string, unknown>
): Record<string, unknown> {
  switch (type) {
    case "fill_blank":
      return sanitizeFillBlank(config as unknown as FillBlankConfig);
    case "multiple_choice":
      return sanitizeMultipleChoice(config as unknown as MultipleChoiceConfig);
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
    default:
      return assertNeverGradableType(type);
  }
}
