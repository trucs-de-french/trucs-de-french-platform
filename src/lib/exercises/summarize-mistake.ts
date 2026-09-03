// Короткий людський підсумок ai_feedback для віджета "Робота над помилками".
// Розпізнає форму detail з grade.ts для кожного типу; для DELF-заглушки
// ({correct, feedback}) показує її текст; інакше — узагальнено.
export function summarizeMistake(feedback: unknown): string {
  if (!feedback || typeof feedback !== "object") {
    return "Спробуйте ще раз.";
  }

  const f = feedback as Record<string, unknown>;

  if (Array.isArray(f.blanks)) {
    const wrong = (f.blanks as { isCorrect: boolean; correctAnswers: string[] }[]).filter(
      (b) => !b.isCorrect
    );
    return wrong.length
      ? `Правильно: ${wrong.map((b) => b.correctAnswers.join(" / ")).join("; ")}`
      : "Всі пропуски правильні.";
  }

  // drag_drop (багатореченнєва форма): { sentences: [{ blanks: [...] }] } —
  // окремий ключ верхнього рівня від старої пласкої { blanks: [...] } вище,
  // тож стара збережена детальна форма (до цієї фічі) і далі розпізнається
  // тим блоком.
  if (Array.isArray(f.sentences) && f.sentences.length > 0) {
    const sentences = f.sentences as {
      blanks: { isCorrect: boolean; correctAnswers: string[] }[];
    }[];
    const wrong = sentences.flatMap((s) => s.blanks.filter((b) => !b.isCorrect));
    return wrong.length
      ? `Правильно: ${wrong.map((b) => b.correctAnswers.join(" / ")).join("; ")}`
      : "Усі пропуски правильні.";
  }

  if (Array.isArray(f.options)) {
    const missed = (
      f.options as { correct: boolean; selected: boolean; text: string }[]
    ).filter((o) => o.correct !== o.selected);
    return missed.length ? `Правильний варіант: ${missed.map((o) => o.text).join(", ")}` : "";
  }

  if (Array.isArray(f.statements)) {
    const wrong = (
      f.statements as { isCorrect: boolean; text: string; correctAnswer: boolean }[]
    ).filter((s) => !s.isCorrect);
    return wrong.length
      ? wrong.map((s) => `«${s.text}» — ${s.correctAnswer ? "True" : "False"}`).join("; ")
      : "Всі твердження правильні.";
  }

  if (Array.isArray(f.correctPairs)) {
    return `Правильні пари: ${(f.correctPairs as { left: string; right: string }[])
      .map((p) => `${p.left} → ${p.right}`)
      .join(", ")}`;
  }

  if (Array.isArray(f.items) && f.items.length > 0) {
    const items = f.items as Record<string, unknown>[];
    const first = items[0];

    // sort_columns: { text, correctColumnLabel, isCorrect, ... }
    if ("correctColumnLabel" in first) {
      const wrong = (
        items as { text: string; correctColumnLabel: string; isCorrect: boolean }[]
      ).filter((i) => !i.isCorrect);
      return wrong.length
        ? wrong.map((i) => `«${i.text}» → ${i.correctColumnLabel}`).join("; ")
        : "Всі елементи розкладено правильно.";
    }

    // reorder: { text, correctIndex, studentIndex, isCorrect }
    if ("correctIndex" in first) {
      const sorted = [...(items as { text: string; correctIndex: number }[])].sort(
        (a, b) => a.correctIndex - b.correctIndex
      );
      return `Правильний порядок: ${sorted.map((i) => i.text).join(" → ")}`;
    }
  }

  // reorder (багатопослідовна форма): { sequences: [{ items: [...] }] } —
  // окремий ключ верхнього рівня від старої { items: [...] } вище, тож стара
  // збережена детальна форма (до цієї фічі) і далі розпізнається тим блоком.
  if (Array.isArray(f.sequences) && f.sequences.length > 0) {
    const sequences = f.sequences as {
      items: { text: string; correctIndex: number; isCorrect: boolean }[];
    }[];
    const parts = sequences
      .filter((s) => s.items.some((i) => !i.isCorrect))
      .map((s) =>
        [...s.items]
          .sort((a, b) => a.correctIndex - b.correctIndex)
          .map((i) => i.text)
          .join(" → ")
      );
    return parts.length
      ? `Правильний порядок: ${parts.join("; ")}`
      : "Усі елементи розкладено у правильному порядку.";
  }

  if (Array.isArray(f.questions) && f.questions.length > 0) {
    const questions = f.questions as Record<string, unknown>[];
    const first = questions[0];

    // listening: { options: [{correct, selected, text}] }
    if ("options" in first) {
      const wrong = (
        questions as { options: { correct: boolean; selected: boolean; text: string }[] }[]
      ).filter((q) => q.options.some((o) => o.correct !== o.selected));
      return wrong.length
        ? `Неправильних відповідей: ${wrong.length}`
        : "Всі відповіді правильні.";
    }

    // open_answer: { question, correctAnswers, isCorrect }
    if ("correctAnswers" in first) {
      const wrong = (
        questions as { correctAnswers: string[]; isCorrect: boolean }[]
      ).filter((q) => !q.isCorrect);
      return wrong.length
        ? `Правильно: ${wrong.map((q) => q.correctAnswers.join(" / ")).join("; ")}`
        : "Усі питання правильні.";
    }
  }

  if (typeof f.feedback === "string") {
    return f.feedback;
  }

  return "Перегляньте вправу ще раз.";
}
