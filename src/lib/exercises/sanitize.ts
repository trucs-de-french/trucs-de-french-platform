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
  ReorderSequence,
  DragDropConfig,
  DragDropPublic,
  DragDropSentence,
  SortColumnsConfig,
  SortColumnsPublic,
  OpenAnswerConfig,
  OpenAnswerPublic,
  OpenAnswerQuestion,
  TableFillConfig,
  TableFillPublic,
  ImageMatchConfig,
  ImageMatchPublic,
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

export function sanitizeReorder(config: ReorderConfig): ReorderPublic {
  return {
    instructions: config.instructions,
    // shuffle ОКРЕМО на кожну послідовність — інакше плитки з різних речень
    // перемішалися б між собою.
    sequences: getReorderSequences(config).map((s) => ({ id: s.id, items: shuffle(s.items) })),
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

export function sanitizeDragDrop(config: DragDropConfig): DragDropPublic {
  return {
    instructions: config.instructions,
    sentences: getDragDropSentences(config).map((s) => ({
      id: s.id,
      template: s.template.replace(BLANK_RE, "{{}}"),
    })),
    // Один спільний банк на всю вправу (не по реченню) — свідоме рішення.
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

export function sanitizeOpenAnswer(config: OpenAnswerConfig): OpenAnswerPublic {
  return {
    instructions: config.instructions,
    questions: getOpenAnswerQuestions(config).map(({ id, question }) => ({ id, question })),
  };
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

export function sanitizeImageMatch(config: ImageMatchConfig): ImageMatchPublic {
  return {
    instructions: config.instructions,
    items: config.items.map(({ id, imageUrl }) => ({ id, imageUrl })),
    bank: shuffle(config.items.map((i) => i.name)),
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
    case "image_match":
      return sanitizeImageMatch(config as unknown as ImageMatchConfig);
    default:
      return assertNeverGradableType(type);
  }
}
