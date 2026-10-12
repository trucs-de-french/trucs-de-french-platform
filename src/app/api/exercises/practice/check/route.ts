import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gradeAnswer } from "@/lib/exercises/grade";
import {
  isPracticeItemsTaskType,
  isWholePracticeTaskType,
  aggregateWrongItems,
  WHOLE_TASK_ITEM_ID,
  type ErrorReviewStatus,
} from "@/lib/exercises/error-review";
import type {
  MultipleChoiceDetail,
  FillBlankDetail,
  TrueFalseDetail,
  WordChoiceDetail,
  LetterGapsDetail,
  LetterRearrangementDetail,
  MatchingDetail,
  TableFillDetail,
  DragDropDetail,
  ImageMatchDetail,
  ListeningDetail,
} from "@/lib/exercises/types";

// Режим практики "Робота над помилками" — переробка ЛИШЕ неправильних
// елементів, БЕЗ балів: на відміну від /api/exercises/check, НЕ викликає
// recordTaskAttempt — progress/mistakes/block_progress і attempts не
// змінюються, оновлюється лише public.mistake_corrections (RPC
// save_mistake_correction, 0054). gradeAnswer() тут лише ЧИТАЄ правильність
// обраних елементів, її повертане pointsEarned/Possible відкидається.
export async function POST(request: Request) {
  const body = await request.json();
  const taskId = body.taskId as string | undefined;
  const itemIds = body.itemIds as string[] | undefined;
  const answer = body.answer;

  if (!taskId || !Array.isArray(itemIds) || itemIds.length === 0 || answer === undefined) {
    return NextResponse.json({ error: "Поля taskId, itemIds, answer обов'язкові" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Потрібна авторизація" }, { status: 401 });
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, type, config")
    .eq("id", taskId)
    .single();

  if (taskError || !task || !(isPracticeItemsTaskType(task.type) || isWholePracticeTaskType(task.type))) {
    return NextResponse.json({ error: "Режим практики недоступний для цього завдання" }, { status: 400 });
  }
  const isWhole = isWholePracticeTaskType(task.type);

  // whole-режим (частина 7, хвиля 3) — "елемент" тут ЗАВЖДИ весь
  // WHOLE_TASK_ITEM_ID, саму присутність завдання в "Роботі над помилками"
  // (page.tsx: score !== 100) уже достатньо вважати помилкою — на відміну
  // від items-режиму, тут не потрібен запит mistakes/aggregateWrongItems.
  const wrongItemIds = isWhole
    ? new Set([WHOLE_TASK_ITEM_ID])
    : new Set(
        await (async () => {
          const { data: mistakeRows } = await supabase
            .from("mistakes")
            .select("ai_feedback, created_at")
            .eq("user_id", user.id)
            .eq("task_id", taskId);
          return aggregateWrongItems(
            (mistakeRows ?? []).map((m) => ({ createdAt: m.created_at, detail: m.ai_feedback })),
            task.type
          );
        })()
      );

  if (!itemIds.every((id) => wrongItemIds.has(id))) {
    return NextResponse.json({ error: "itemIds мають бути підмножиною помилок цього завдання" }, { status: 400 });
  }

  const config = (task.config ?? {}) as Record<string, unknown>;
  const graded = gradeAnswer(task.type, config, answer);

  // Оцінка по кожному itemId — ТА САМА grade-логіка, що звичайна перевірка
  // (gradeAnswer вище, без дублювання): тут лише витягуємо isCorrect
  // потрібного елемента з уже готового detail, форма якого своя для
  // кожного типу (items/blanks/statements/sentences/words).
  let results: { itemId: string; correct: boolean }[];
  switch (task.type) {
    case "multiple_choice": {
      const detail = graded.detail as MultipleChoiceDetail;
      results = itemIds.map((itemId) => {
        const item = detail.items.find((it) => it.id === itemId);
        return { itemId, correct: !!item && item.options.every((o) => o.correct === o.selected) };
      });
      break;
    }
    case "fill_blank": {
      // позиційний (blankIndex як рядок), gradeAnswer рахує ВСІ пропуски
      // завжди (template — вільний текст без явних id) — беремо лише
      // запитані позиції.
      const detail = graded.detail as FillBlankDetail;
      results = itemIds.map((itemId) => {
        const blank = detail.blanks[Number(itemId)];
        return { itemId, correct: !!blank?.isCorrect };
      });
      break;
    }
    case "true_false": {
      const detail = graded.detail as TrueFalseDetail;
      results = itemIds.map((itemId) => {
        const s = detail.statements.find((x) => x.id === itemId);
        return { itemId, correct: !!s?.isCorrect };
      });
      break;
    }
    case "word_choice": {
      const detail = graded.detail as WordChoiceDetail;
      results = itemIds.map((itemId) => {
        const s = detail.sentences.find((x) => x.id === itemId);
        return { itemId, correct: !!s?.isCorrect };
      });
      break;
    }
    case "letter_gaps": {
      // позиційний (wordIndex як рядок), той самий принцип, що fill_blank —
      // detail.words завжди повної довжини (gradeLetterGaps), беремо лише
      // запитані позиції.
      const detail = graded.detail as LetterGapsDetail;
      results = itemIds.map((itemId) => {
        const w = detail.words[Number(itemId)];
        return { itemId, correct: !!w?.isCorrect };
      });
      break;
    }
    case "letter_rearrangement": {
      // позиційний (wordIndex як рядок), той самий принцип, що letter_gaps.
      const detail = graded.detail as LetterRearrangementDetail;
      results = itemIds.map((itemId) => {
        const w = detail.words[Number(itemId)];
        return { itemId, correct: !!w?.isCorrect };
      });
      break;
    }
    case "matching": {
      // За pairPoints.id (стабільний синтетичний id пари, sanitize.ts:
      // getMatchingPairs) — detail.pairPoints уже скоуплений на пари, що
      // прийшли в answer (gradeMatching: completePairs/answeredLefts), тож
      // тут лише шукаємо запитані itemIds серед них.
      const detail = graded.detail as MatchingDetail;
      results = itemIds.map((itemId) => {
        const p = detail.pairPoints.find((pp) => pp.id === itemId);
        return { itemId, correct: !!p?.isCorrect };
      });
      break;
    }
    case "table_fill": {
      // За rowId (елемент тут РЯДОК, не клітинка) — рядок правильний лише
      // якщо ВСІ його blanks (1 чи 2 приховані клітинки) правильні, той
      // самий принцип, що гранулярність points/mistakeItemIds (error-
      // review.ts).
      const detail = graded.detail as TableFillDetail;
      results = itemIds.map((itemId) => {
        const rowBlanks = detail.blanks.filter((b) => b.rowId === itemId);
        return { itemId, correct: rowBlanks.length > 0 && rowBlanks.every((b) => b.isCorrect) };
      });
      break;
    }
    case "drag_drop": {
      // За sentenceId — елемент тут РЕЧЕННЯ, правильне лише якщо ВСІ його
      // пропуски правильні (той самий принцип, що table_fill/рядок вище).
      const detail = graded.detail as DragDropDetail;
      results = itemIds.map((itemId) => {
        const s = detail.sentences.find((x) => x.id === itemId);
        return { itemId, correct: !!s && s.blanks.every((b) => b.isCorrect) };
      });
      break;
    }
    case "image_match": {
      // За item.id — простий item-рівень (без групування, той самий
      // принцип, що gradeChronologicalOrder).
      const detail = graded.detail as ImageMatchDetail;
      results = itemIds.map((itemId) => {
        const it = detail.items.find((x) => x.id === itemId);
        return { itemId, correct: !!it?.isCorrect };
      });
      break;
    }
    case "listening": {
      const detail = graded.detail as ListeningDetail;
      results = itemIds.map((itemId) => {
        const q = detail.questions.find((x) => x.id === itemId);
        return { itemId, correct: !!q && q.options.every((o) => o.correct === o.selected) };
      });
      break;
    }
    // whole-режим (частина 7, хвиля 3) — один результат на весь taskType:
    // "правильно" = graded.correct (gradeReorder/gradeChronologicalOrder/
    // gradeSortColumns/gradeCheckboxGrid уже рахують це як "усі елементи на
    // 100%", часткові бали теж "неправильно"). Увесь WHOLE_MODE_TASK_TYPES
    // (error-review.ts) тепер тут — reorder/chronological_order/
    // sort_columns/checkbox_grid (частина 7, хвиля 3, завершено).
    case "reorder":
    case "chronological_order":
    case "sort_columns":
    case "checkbox_grid":
      results = [{ itemId: WHOLE_TASK_ITEM_ID, correct: graded.correct }];
      break;
    default: {
      const never: never = task.type;
      throw new Error(`practice/check: непідтримуваний тип "${never}"`);
    }
  }

  const { data: stateRows, error: stateError } = await supabase.rpc("get_mistake_correction_state", {
    p_user_id: user.id,
    p_task_id: taskId,
  });
  if (stateError) throw stateError;

  const state = stateRows?.[0] as { corrected_item_ids: string[]; failed_attempts: Record<string, number> } | undefined;
  const correctedSet = new Set(state?.corrected_item_ids ?? []);
  const failedAttempts: Record<string, number> = { ...(state?.failed_attempts ?? {}) };

  for (const r of results) {
    if (r.correct) {
      correctedSet.add(r.itemId);
      // Виправлення (частина 3, фікс A) — лічильник невдалих спроб
      // очищається ЗАВЖДИ, коли елемент щойно став правильним: раніше
      // multiple_choice/fill_blank лишали старе число в failed_attempts
      // навіть для вже виправленого елемента (непослідовно між типами,
      // і взагалі зайве — елемент більше не в remainingItemIds).
      delete failedAttempts[r.itemId];
    } else {
      failedAttempts[r.itemId] = (failedAttempts[r.itemId] ?? 0) + 1;
    }
  }

  const { error: saveError } = await supabase.rpc("save_mistake_correction", {
    p_user_id: user.id,
    p_task_id: taskId,
    p_corrected_item_ids: [...correctedSet],
    p_failed_attempts: failedAttempts,
  });
  if (saveError) throw saveError;

  const remainingItemIds = [...wrongItemIds].filter((id) => !correctedSet.has(id));
  const status: ErrorReviewStatus =
    wrongItemIds.size > 0 && remainingItemIds.length === 0
      ? "done"
      : correctedSet.size > 0
        ? "partial"
        : "not_started";

  // detail — додаткове поле (частина 7, хвиля 3), ігнорується items-режимом
  // (results уже несуть усе потрібне для нього): whole-режиму потрібен
  // ПОВНИЙ detail gradeAnswer (не лише isCorrect на WHOLE_TASK_ITEM_ID), щоб
  // компонент показав, які саме плитки/клітинки/елементи неправильні — той
  // самий вигляд, що й звичайна перевірка (/api/exercises/check).
  return NextResponse.json({ results, remainingItemIds, failedAttempts, status, detail: graded.detail });
}
