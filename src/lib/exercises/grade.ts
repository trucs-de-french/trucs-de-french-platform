import { BLANK_RE } from "./sanitize";
import type {
  FillBlankConfig,
  FillBlankAnswer,
  FillBlankDetail,
  MultipleChoiceConfig,
  MultipleChoiceAnswer,
  MultipleChoiceDetail,
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
  SortColumnsConfig,
  SortColumnsAnswer,
  SortColumnsDetail,
  OpenAnswerConfig,
  OpenAnswerAnswer,
  OpenAnswerDetail,
  TableFillConfig,
  TableFillAnswer,
  TableFillDetail,
  GradeResult,
} from "./types";
import { type GradableTaskType, assertNeverGradableType } from "./gradable-types";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function percentage(correctCount: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correctCount / total) * 100);
}

function gradeFillBlank(config: FillBlankConfig, answer: FillBlankAnswer): GradeResult {
  const blanksAcceptable = [...config.template.matchAll(BLANK_RE)].map((m) =>
    m[1].split("|").map((s) => normalize(s))
  );

  const blanks: FillBlankDetail["blanks"] = blanksAcceptable.map((accepted, i) => {
    const studentAnswer = answer[i] ?? "";
    const isCorrect = accepted.includes(normalize(studentAnswer));
    return { studentAnswer, correctAnswers: accepted, isCorrect };
  });

  const correctCount = blanks.filter((b) => b.isCorrect).length;
  return {
    correct: correctCount === blanks.length && blanks.length > 0,
    score: percentage(correctCount, blanks.length),
    detail: { blanks },
  };
}

function gradeMultipleChoice(
  config: MultipleChoiceConfig,
  answer: MultipleChoiceAnswer
): GradeResult {
  const selected = new Set(answer);
  const options: MultipleChoiceDetail["options"] = config.options.map((o) => ({
    id: o.id,
    text: o.text,
    correct: o.correct,
    selected: selected.has(o.id),
  }));

  const isCorrect = options.every((o) => o.correct === o.selected);
  return {
    correct: isCorrect,
    score: isCorrect ? 100 : 0,
    detail: { options },
  };
}

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
    };
  });

  const correctCount = statements.filter((s) => s.isCorrect).length;
  return {
    correct: correctCount === statements.length && statements.length > 0,
    score: percentage(correctCount, statements.length),
    detail: { statements },
  };
}

function gradeMatching(config: MatchingConfig, answer: MatchingAnswer): GradeResult {
  // Пари не мають id, тому порівнюємо left/right як окремі поля структурно,
  // а не через склеєний рядок — конкатенація неоднозначна, якщо межа між
  // ними зсувається (напр. "a b"+"c" і "a"+"b c" можуть дати той самий ключ).
  const studentPairs: MatchingDetail["studentPairs"] = answer.map((a) => ({
    left: a.left,
    right: a.right,
    isCorrect: config.pairs.some((p) => p.left === a.left && p.right === a.right),
  }));

  const correctCount = studentPairs.filter((p) => p.isCorrect).length;
  return {
    correct: correctCount === config.pairs.length && studentPairs.length === config.pairs.length,
    score: percentage(correctCount, config.pairs.length),
    detail: { correctPairs: config.pairs, studentPairs },
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
    };
  });

  const correctCount = questions.filter((q) => q.options.every((o) => o.correct === o.selected))
    .length;
  return {
    correct: correctCount === questions.length && questions.length > 0,
    score: percentage(correctCount, questions.length),
    detail: { questions },
  };
}

function gradeReorder(config: ReorderConfig, answer: ReorderAnswer): GradeResult {
  // Порівняння за позицією, а не пошуком тексту (answer.indexOf) — items
  // можуть містити дублікати (той самий текст двічі), і пошук за значенням
  // завжди знаходить лише перше входження, ігноруючи решту.
  const items: ReorderDetail["items"] = config.items.map((text, correctIndex) => {
    const studentIndex = correctIndex;
    return { text, correctIndex, studentIndex, isCorrect: answer[correctIndex] === text };
  });

  const correctCount = items.filter((i) => i.isCorrect).length;
  return {
    correct: correctCount === items.length && items.length > 0,
    score: percentage(correctCount, items.length),
    detail: { items },
  };
}

// drag_drop — той самий алгоритм, що fill_blank (один правильний варіант на
// пропуск, вбудований у template); поле bank на перевірку не впливає.
function gradeDragDrop(config: DragDropConfig, answer: DragDropAnswer): GradeResult {
  return gradeFillBlank({ template: config.template }, answer);
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
    };
  });

  const correctCount = items.filter((i) => i.isCorrect).length;
  return {
    correct: correctCount === items.length && items.length > 0,
    score: percentage(correctCount, items.length),
    detail: { items },
  };
}

function gradeOpenAnswer(config: OpenAnswerConfig, answer: OpenAnswerAnswer): GradeResult {
  const accepted = config.answers.map((a) => normalize(a));
  const studentAnswer = answer ?? "";
  const isCorrect = accepted.includes(normalize(studentAnswer));

  const detail: OpenAnswerDetail = {
    studentAnswer,
    correctAnswers: config.answers,
    isCorrect,
  };
  return {
    correct: isCorrect,
    score: isCorrect ? 100 : 0,
    detail,
  };
}

function gradeTableFill(config: TableFillConfig, answer: TableFillAnswer): GradeResult {
  const answerMap = new Map(answer.map((a) => [`${a.rowId}:${a.side}`, a.value]));

  const blanks: TableFillDetail["blanks"] = [];
  for (const row of config.rows) {
    (["left", "right"] as const).forEach((side) => {
      const hidden = side === "left" ? row.leftHidden : row.rightHidden;
      if (!hidden) return;

      const rawValue = side === "left" ? row.left : row.right;
      const accepted = rawValue.split("|").map((s) => normalize(s));
      const studentAnswer = answerMap.get(`${row.id}:${side}`) ?? "";
      const isCorrect = accepted.includes(normalize(studentAnswer));
      blanks.push({ rowId: row.id, side, studentAnswer, correctAnswers: accepted, isCorrect });
    });
  }

  const correctCount = blanks.filter((b) => b.isCorrect).length;
  return {
    correct: correctCount === blanks.length && blanks.length > 0,
    score: percentage(correctCount, blanks.length),
    detail: { blanks },
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
    case "multiple_choice":
      return gradeMultipleChoice(
        config as unknown as MultipleChoiceConfig,
        answer as MultipleChoiceAnswer
      );
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
    default:
      return assertNeverGradableType(type);
  }
}
