import {
  BLANK_RE,
  getOpenAnswerQuestions,
  getReorderSequences,
  getDragDropSentences,
  getMultipleChoiceItems,
  resolveTrueFalsePoints,
  resolveOpenAnswerPoints,
  resolveMultipleChoicePoints,
  resolveReorderPoints,
  resolveSortColumnsPoints,
  resolveImageMatchPoints,
  resolveListeningPoints,
  resolveDragDropPoints,
  resolveTableFillPoints,
  getMatchingPairs,
  resolveMatchingPoints,
  resolveFillBlankPoints,
  resolveCheckboxGridPoints,
} from "./sanitize";
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
  DragDropDetail,
  SortColumnsConfig,
  SortColumnsAnswer,
  SortColumnsDetail,
  OpenAnswerConfig,
  OpenAnswerAnswer,
  OpenAnswerDetail,
  TableFillConfig,
  TableFillAnswer,
  TableFillDetail,
  ImageMatchConfig,
  ImageMatchAnswer,
  ImageMatchDetail,
  CheckboxGridConfig,
  CheckboxGridAnswer,
  CheckboxGridDetail,
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
  const correct = correctCount === blanks.length && blanks.length > 0;
  // POINTS — на всю вправу (не на пропуск, підтверджений компроміс, бо
  // template — вільний текст без структурної адресації пропусків):
  // зараховується цілком, лише якщо ВСІ пропуски правильні.
  const points = resolveFillBlankPoints(config);

  return {
    correct,
    score: percentage(correctCount, blanks.length),
    detail: { blanks },
    pointsEarned: correct ? points : 0,
    pointsPossible: points,
  };
}

// Атомарна одиниця часткового заліку — ціле речення (усередині нього нема
// під-структури для розбиття, на відміну від пропусків у drag_drop), той
// самий принцип, що gradeListening.
function gradeMultipleChoice(
  config: MultipleChoiceConfig,
  answer: MultipleChoiceAnswer
): GradeResult {
  const items = getMultipleChoiceItems(config);
  const answerByItem = new Map((answer ?? []).map((a) => [a.itemId, new Set(a.selected)]));

  const itemsDetail: MultipleChoiceDetail["items"] = items.map((item) => {
    const selected = answerByItem.get(item.id) ?? new Set<string>();
    const options = item.options.map((o) => ({
      id: o.id,
      text: o.text,
      correct: o.correct,
      selected: selected.has(o.id),
    }));
    return { id: item.id, options, points: resolveMultipleChoicePoints(item) };
  });

  const fullyCorrect = itemsDetail.filter((it) => it.options.every((o) => o.correct === o.selected));
  const correctCount = fullyCorrect.length;
  const pointsPossible = itemsDetail.reduce((sum, it) => sum + it.points, 0);
  const pointsEarned = fullyCorrect.reduce((sum, it) => sum + it.points, 0);

  return {
    correct: correctCount === itemsDetail.length && itemsDetail.length > 0,
    score: percentage(correctCount, itemsDetail.length),
    detail: { items: itemsDetail },
    pointsEarned,
    pointsPossible,
  };
}

// Пілот системи балів — pointsEarned/pointsPossible рахуються ПОРЯД зі
// score (не замість): score лишається тим самим percentage, що й завжди.
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
      points: resolveTrueFalsePoints(s),
    };
  });

  const correctCount = statements.filter((s) => s.isCorrect).length;
  const pointsPossible = statements.reduce((sum, s) => sum + s.points, 0);
  const pointsEarned = statements
    .filter((s) => s.isCorrect)
    .reduce((sum, s) => sum + s.points, 0);

  return {
    correct: correctCount === statements.length && statements.length > 0,
    score: percentage(correctCount, statements.length),
    detail: { statements },
    pointsEarned,
    pointsPossible,
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

  // POINTS — окремий прохід, зі СПРОТИВНОГО напрямку за studentPairs вище
  // (по config-парах, а не по відповідях студента): для кожної пари з
  // getMatchingPairs (уже з id) перевіряємо, чи вона є серед відповідей
  // студента. Пара — вже атомарна одиниця (без під-структури), тож бали
  // просто по парі, як у true_false/sort_columns.
  const pairPoints: MatchingDetail["pairPoints"] = getMatchingPairs(config).map((p) => ({
    id: p.id,
    left: p.left,
    points: resolveMatchingPoints(p),
    isCorrect: answer.some((a) => a.left === p.left && a.right === p.right),
  }));
  const pointsPossible = pairPoints.reduce((sum, p) => sum + p.points, 0);
  const pointsEarned = pairPoints.filter((p) => p.isCorrect).reduce((sum, p) => sum + p.points, 0);

  return {
    correct: correctCount === config.pairs.length && studentPairs.length === config.pairs.length,
    score: percentage(correctCount, config.pairs.length),
    detail: { correctPairs: config.pairs, studentPairs, pairPoints },
    pointsEarned,
    pointsPossible,
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
      points: resolveListeningPoints(q),
    };
  });

  const fullyCorrect = questions.filter((q) => q.options.every((o) => o.correct === o.selected));
  const correctCount = fullyCorrect.length;
  const pointsPossible = questions.reduce((sum, q) => sum + q.points, 0);
  const pointsEarned = fullyCorrect.reduce((sum, q) => sum + q.points, 0);

  return {
    correct: correctCount === questions.length && questions.length > 0,
    score: percentage(correctCount, questions.length),
    detail: { questions },
    pointsEarned,
    pointsPossible,
  };
}

function gradeReorder(config: ReorderConfig, answer: ReorderAnswer): GradeResult {
  const sequences = getReorderSequences(config);
  const answerBySequence = new Map((answer ?? []).map((a) => [a.sequenceId, a.order]));

  const sequencesDetail: ReorderDetail["sequences"] = sequences.map((seq) => {
    const studentOrder = answerBySequence.get(seq.id) ?? [];
    // Порівняння за позицією, а не пошуком тексту (indexOf) — items можуть
    // містити дублікати (той самий текст двічі), і пошук за значенням
    // завжди знаходить лише перше входження, ігноруючи решту.
    const items = seq.items.map((text, correctIndex) => {
      const studentIndex = correctIndex;
      return { text, correctIndex, studentIndex, isCorrect: studentOrder[correctIndex] === text };
    });
    return { id: seq.id, items, points: resolveReorderPoints(seq) };
  });

  // Атомарна одиниця часткового заліку для SCORE — кожна плитка-позиція
  // через УСІ послідовності разом, а не "послідовність повністю правильна
  // чи ні". POINTS — окремий вимір, свідомо іншої гранулярності: бали
  // послідовності зараховуються, лише якщо вона ВСЯ правильна.
  const allItems = sequencesDetail.flatMap((s) => s.items);
  const correctCount = allItems.filter((i) => i.isCorrect).length;
  const pointsPossible = sequencesDetail.reduce((sum, s) => sum + s.points, 0);
  const pointsEarned = sequencesDetail
    .filter((s) => s.items.every((i) => i.isCorrect))
    .reduce((sum, s) => sum + s.points, 0);

  return {
    correct: correctCount === allItems.length && allItems.length > 0,
    score: percentage(correctCount, allItems.length),
    detail: { sequences: sequencesDetail },
    pointsEarned,
    pointsPossible,
  };
}

// drag_drop — кожне речення перевіряється тим самим алгоритмом, що
// fill_blank (один правильний варіант на пропуск, вбудований у template);
// поле bank на перевірку не впливає. Атомарна одиниця часткового заліку —
// кожен пропуск через УСІ речення разом, не "речення повністю правильне чи
// ні" — той самий принцип, що для reorder.
function gradeDragDrop(config: DragDropConfig, answer: DragDropAnswer): GradeResult {
  const sentences = getDragDropSentences(config);
  const answerBySentence = new Map((answer ?? []).map((a) => [a.sentenceId, a.words]));

  const sentencesDetail: DragDropDetail["sentences"] = sentences.map((s) => {
    const words = answerBySentence.get(s.id) ?? [];
    const fbResult = gradeFillBlank({ template: s.template }, words);
    return {
      id: s.id,
      blanks: (fbResult.detail as FillBlankDetail).blanks,
      points: resolveDragDropPoints(s),
    };
  });

  const allBlanks = sentencesDetail.flatMap((s) => s.blanks);
  const correctCount = allBlanks.filter((b) => b.isCorrect).length;
  // POINTS — окремий вимір, свідомо іншої гранулярності за SCORE (див.
  // reorder): бали речення зараховуються, лише якщо ВОНО повністю
  // правильне (усі пропуски), тоді як score рахує кожен пропуск атомарно
  // через усі речення разом.
  const pointsPossible = sentencesDetail.reduce((sum, s) => sum + s.points, 0);
  const pointsEarned = sentencesDetail
    .filter((s) => s.blanks.every((b) => b.isCorrect))
    .reduce((sum, s) => sum + s.points, 0);

  return {
    correct: correctCount === allBlanks.length && allBlanks.length > 0,
    score: percentage(correctCount, allBlanks.length),
    detail: { sentences: sentencesDetail },
    pointsEarned,
    pointsPossible,
  };
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
      points: resolveSortColumnsPoints(item),
    };
  });

  const correctCount = items.filter((i) => i.isCorrect).length;
  const pointsPossible = items.reduce((sum, i) => sum + i.points, 0);
  const pointsEarned = items.filter((i) => i.isCorrect).reduce((sum, i) => sum + i.points, 0);

  return {
    correct: correctCount === items.length && items.length > 0,
    score: percentage(correctCount, items.length),
    detail: { items },
    pointsEarned,
    pointsPossible,
  };
}

function gradeOpenAnswer(config: OpenAnswerConfig, answer: OpenAnswerAnswer): GradeResult {
  const answerByQuestion = new Map((answer ?? []).map((a) => [a.questionId, a.value]));

  const questions: OpenAnswerDetail["questions"] = getOpenAnswerQuestions(config).map((q) => {
    const accepted = q.answers.map((a) => normalize(a));
    const studentAnswer = answerByQuestion.get(q.id) ?? "";
    return {
      id: q.id,
      question: q.question,
      studentAnswer,
      correctAnswers: q.answers,
      isCorrect: accepted.includes(normalize(studentAnswer)),
      points: resolveOpenAnswerPoints(q),
    };
  });

  const correctCount = questions.filter((q) => q.isCorrect).length;
  const pointsPossible = questions.reduce((sum, q) => sum + q.points, 0);
  const pointsEarned = questions.filter((q) => q.isCorrect).reduce((sum, q) => sum + q.points, 0);

  return {
    correct: correctCount === questions.length && questions.length > 0,
    score: percentage(correctCount, questions.length),
    detail: { questions },
    pointsEarned,
    pointsPossible,
  };
}

function gradeTableFill(config: TableFillConfig, answer: TableFillAnswer): GradeResult {
  const answerMap = new Map(answer.map((a) => [`${a.rowId}:${a.side}`, a.value]));

  const blanks: TableFillDetail["blanks"] = [];
  for (const row of config.rows) {
    const rowPoints = resolveTableFillPoints(row);
    (["left", "right"] as const).forEach((side) => {
      const hidden = side === "left" ? row.leftHidden : row.rightHidden;
      if (!hidden) return;

      const rawValue = side === "left" ? row.left : row.right;
      const accepted = rawValue.split("|").map((s) => normalize(s));
      const studentAnswer = answerMap.get(`${row.id}:${side}`) ?? "";
      const isCorrect = accepted.includes(normalize(studentAnswer));
      blanks.push({
        rowId: row.id,
        side,
        studentAnswer,
        correctAnswers: accepted,
        isCorrect,
        points: rowPoints,
      });
    });
  }

  const correctCount = blanks.filter((b) => b.isCorrect).length;

  // POINTS — на рівні РЯДКА (не клітинки), окремий вимір за score: рядок
  // зараховується цілком, лише якщо ВСІ його приховані клітинки правильні.
  // Рядки без жодної прихованої клітинки взагалі не потрапляють у blanks
  // вище, тому не впливають ні на pointsEarned, ні на pointsPossible.
  const blanksByRow = new Map<string, TableFillDetail["blanks"]>();
  for (const b of blanks) {
    const arr = blanksByRow.get(b.rowId) ?? [];
    arr.push(b);
    blanksByRow.set(b.rowId, arr);
  }
  let pointsPossible = 0;
  let pointsEarned = 0;
  for (const rowBlanks of blanksByRow.values()) {
    pointsPossible += rowBlanks[0].points;
    if (rowBlanks.every((b) => b.isCorrect)) pointsEarned += rowBlanks[0].points;
  }

  return {
    correct: correctCount === blanks.length && blanks.length > 0,
    score: percentage(correctCount, blanks.length),
    detail: { blanks },
    pointsEarned,
    pointsPossible,
  };
}

// checkbox_grid — той самий принцип, що gradeTableFill: плаский список
// клітинок (тут — усі рядок×колонка, не лише "приховані"), score атомарний
// по клітинках, points групуються по рядку (зараховується цілком, лише
// якщо ВСІ клітинки рядка збігаються з очікуваним станом — і хибний
// позитив, і хибний негатив псують рядок).
function gradeCheckboxGrid(config: CheckboxGridConfig, answer: CheckboxGridAnswer): GradeResult {
  const answerByRow = new Map(answer.map((a) => [a.rowId, new Set(a.columnIds)]));

  const cells: CheckboxGridDetail["cells"] = [];
  for (const row of config.rows) {
    const rowPoints = resolveCheckboxGridPoints(row);
    const studentColumnIds = answerByRow.get(row.id) ?? new Set<string>();
    const correctColumnIds = new Set(row.correctColumnIds);
    for (const column of config.columns) {
      const studentChecked = studentColumnIds.has(column.id);
      const correctChecked = correctColumnIds.has(column.id);
      cells.push({
        rowId: row.id,
        columnId: column.id,
        studentChecked,
        correctChecked,
        isCorrect: studentChecked === correctChecked,
        points: rowPoints,
      });
    }
  }

  const correctCount = cells.filter((c) => c.isCorrect).length;

  const cellsByRow = new Map<string, CheckboxGridDetail["cells"]>();
  for (const c of cells) {
    const arr = cellsByRow.get(c.rowId) ?? [];
    arr.push(c);
    cellsByRow.set(c.rowId, arr);
  }
  let pointsPossible = 0;
  let pointsEarned = 0;
  for (const rowCells of cellsByRow.values()) {
    pointsPossible += rowCells[0].points;
    if (rowCells.every((c) => c.isCorrect)) pointsEarned += rowCells[0].points;
  }

  return {
    correct: correctCount === cells.length && cells.length > 0,
    score: percentage(correctCount, cells.length),
    detail: { cells },
    pointsEarned,
    pointsPossible,
  };
}

// Просте порівняння по id (як gradeSortColumns), а не трюк gradeDragDrop
// із синтетичним {{}}-шаблоном — тут рівно один правильний варіант на
// картинку, без pipe-альтернатив, тож текстовий шаблон тільки ускладнив би.
function gradeImageMatch(config: ImageMatchConfig, answer: ImageMatchAnswer): GradeResult {
  const answerByItem = new Map(answer.map((a) => [a.itemId, a.name]));

  const items: ImageMatchDetail["items"] = config.items.map((item) => {
    const studentName = answerByItem.get(item.id) ?? "";
    return {
      id: item.id,
      imageUrl: item.imageUrl,
      correctName: item.name,
      studentName,
      isCorrect: normalize(studentName) === normalize(item.name),
      points: resolveImageMatchPoints(item),
    };
  });

  const correctCount = items.filter((i) => i.isCorrect).length;
  const pointsPossible = items.reduce((sum, i) => sum + i.points, 0);
  const pointsEarned = items.filter((i) => i.isCorrect).reduce((sum, i) => sum + i.points, 0);

  return {
    correct: correctCount === items.length && items.length > 0,
    score: percentage(correctCount, items.length),
    detail: { items },
    pointsEarned,
    pointsPossible,
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
    case "image_match":
      return gradeImageMatch(config as unknown as ImageMatchConfig, answer as ImageMatchAnswer);
    case "checkbox_grid":
      return gradeCheckboxGrid(
        config as unknown as CheckboxGridConfig,
        answer as CheckboxGridAnswer
      );
    default:
      return assertNeverGradableType(type);
  }
}
