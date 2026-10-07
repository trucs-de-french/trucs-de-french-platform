import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { frenchNbsp } from "@/lib/text/french-typography";

// mode ("image" | "text") НЕ зберігається в самому detail (ChronologicalOrderDetail
// містить лише content: string, агностичний до режиму) — тож розрізняємо
// евристично за формою значення. mode єдиний на всю вправу (не по елементу),
// тож досить перевірити перший елемент послідовності.
function looksLikeImageUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

// Короткий людський підсумок ai_feedback для віджета "Робота над помилками".
// Розпізнає форму detail з grade.ts для кожного типу; для DELF-заглушки
// ({correct, feedback}) показує її текст; інакше — узагальнено. Повертає
// React.ReactNode (не string) — chronological_order у image-режимі показує
// мініатюри замість сирого URL-тексту, решта гілок і далі повертають
// звичайний рядок (валідний ReactNode).
export function summarizeMistake(feedback: unknown): React.ReactNode {
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
  // тим блоком. word_choice має ТОЙ САМИЙ верхній ключ "sentences"
  // (WordChoiceDetail), але інша форма елемента (options, не blanks) —
  // перевіряємо форму ПЕРШОГО елемента перед тим, як вважати це drag_drop,
  // той самий принцип розрізнення, що вже нижче для f.items/f.questions.
  // Третьої форми під цим самим ключем в жодному Detail-типі немає
  // (звірено з types.ts: лише ці два типи мають top-level "sentences").
  if (Array.isArray(f.sentences) && f.sentences.length > 0) {
    const first = f.sentences[0] as Record<string, unknown>;

    // word_choice: { sentences: [{ id, options: [{correct, selected, text}], isCorrect }] } —
    // той самий принцип підсумку, що multiple_choice нижче (f.items з
    // "options" у кожному елементі): кількість речень із хоч одним
    // неправильно обраним/невибраним варіантом, без перелічення самих
    // варіантів (sentence — ціле речення з кількома пропусками-кнопками,
    // не один текстовий пропуск, конкретний "правильний варіант" тут
    // менш однозначний, ніж для f.options нижче).
    if ("options" in first) {
      const sentences = f.sentences as {
        options: { correct: boolean; selected: boolean; text: string }[];
      }[];
      const wrong = sentences.filter((s) => s.options.some((o) => o.correct !== o.selected));
      return wrong.length ? `Неправильних речень: ${wrong.length}` : "Усі речення правильні.";
    }

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
      ? wrong.map((s) => `«${frenchNbsp(s.text)}» — ${s.correctAnswer ? "Vrai" : "Faux"}`).join("; ")
      : "Всі твердження правильні.";
  }

  if (Array.isArray(f.correctPairs)) {
    return `Правильні пари: ${(f.correctPairs as { left: string; right: string }[])
      .map((p) => `${p.left} → ${p.right}`)
      .join(", ")}`;
  }

  // checkbox_grid: { cells: [{ rowId, columnId, studentChecked, correctChecked, isCorrect, points }] } —
  // клітинки не несуть людських підписів (лише id рядка/колонки), тож
  // підсумок — кількість, як і для інших "мережевих" форм (options/questions) нижче.
  if (Array.isArray(f.cells)) {
    const wrong = (f.cells as { isCorrect: boolean }[]).filter((c) => !c.isCorrect);
    return wrong.length
      ? `Неправильних клітинок: ${wrong.length}`
      : "Усі клітинки позначено правильно.";
  }

  if (Array.isArray(f.items) && f.items.length > 0) {
    const items = f.items as Record<string, unknown>[];
    const first = items[0];

    // chronological_order: { content, correctPosition, studentPosition, isCorrect } —
    // content у режимі "image" — URL зображення, не текст для показу як є
    // (той самий недолік, який щойно виправлено тут же для reorder-подібних
    // гілок, попереджено одразу).
    if ("correctPosition" in first) {
      const sorted = [
        ...(items as { content: string; correctPosition: number }[]),
      ].sort((a, b) => a.correctPosition - b.correctPosition);

      if (sorted.length > 0 && looksLikeImageUrl(sorted[0].content)) {
        return (
          <span className="inline-flex flex-wrap items-center gap-1 align-middle">
            Правильний порядок:
            {sorted.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                {i > 0 && <span aria-hidden>→</span>}
                <ImageOrPlaceholder
                  src={item.content}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded object-cover"
                  useFocus
                />
              </span>
            ))}
          </span>
        );
      }

      return `Правильний порядок: ${sorted.map((i) => i.content).join(" → ")}`;
    }

    // sort_columns: { text, correctColumnLabel, isCorrect, ... }
    if ("correctColumnLabel" in first) {
      const wrong = (
        items as { text: string; correctColumnLabel: string; isCorrect: boolean }[]
      ).filter((i) => !i.isCorrect);
      return wrong.length
        ? wrong.map((i) => `«${i.text}» → ${i.correctColumnLabel}`).join("; ")
        : "Всі елементи розкладено правильно.";
    }

    // reorder (стара однопослідовна форма): { text, correctIndex, studentIndex, isCorrect } —
    // items тут завжди звичайний текст (ReorderSequence.items: string[] у
    // types.ts — жодного image-режиму в reorder немає, на відміну від
    // chronological_order вище), тож URL-евристика тут не потрібна.
    if ("correctIndex" in first) {
      const sorted = [...(items as { text: string; correctIndex: number }[])].sort(
        (a, b) => a.correctIndex - b.correctIndex
      );
      return `Правильний порядок: ${sorted.map((i) => i.text).join(" → ")}`;
    }

    // multiple_choice (багатореченнєва форма): { options: [{correct, selected, text}] }
    if ("options" in first) {
      const wrong = (
        items as { options: { correct: boolean; selected: boolean; text: string }[] }[]
      ).filter((it) => it.options.some((o) => o.correct !== o.selected));
      return wrong.length ? `Неправильних відповідей: ${wrong.length}` : "Всі відповіді правильні.";
    }
  }

  // reorder (багатопослідовна форма): { sequences: [{ items: [...] }] } —
  // окремий ключ верхнього рівня від старої { items: [...] } вище, тож стара
  // збережена детальна форма (до цієї фічі) і далі розпізнається тим блоком.
  // Той самий принцип, що й вище — items тут завжди текст, без image-режиму.
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
