import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPracticeItemsTaskType } from "@/lib/exercises/error-review";
import {
  BLANK_RE,
  parseBlankMarker,
  getMultipleChoiceItems,
  getMatchingPairs,
  getTableFillRows,
  getDragDropSentences,
} from "@/lib/exercises/sanitize";
import type {
  FillBlankConfig,
  MultipleChoiceConfig,
  TrueFalseConfig,
  WordChoiceConfig,
  LetterGapsConfig,
  LetterRearrangementConfig,
  MatchingConfig,
  TableFillConfig,
  DragDropConfig,
} from "@/lib/exercises/types";

// Розкриття правильної відповіді в режимі практики — той самий шаблон, що
// /api/exercises/hint (повертає лише ОДИН елемент, не весь config). На
// відміну від hint (перша літера, можна брати нескінченно), тут — повна
// відповідь, доступна лише після 2 невдалих спроб АБО кнопкою
// "Показати відповідь" (fromButton). Розкриття НЕ додає itemId у
// corrected_item_ids — елемент лишається "не виправлений", поки студент
// сам не відповість правильно (practice/check).
export async function POST(request: Request) {
  const body = await request.json();
  const taskId = body.taskId as string | undefined;
  const itemId = body.itemId as string | undefined;
  const fromButton = body.fromButton === true;

  if (!taskId || !itemId) {
    return NextResponse.json({ error: "Поля taskId, itemId обов'язкові" }, { status: 400 });
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

  if (taskError || !task || !isPracticeItemsTaskType(task.type)) {
    return NextResponse.json({ error: "Режим практики недоступний для цього завдання" }, { status: 400 });
  }

  if (!fromButton) {
    const { data: stateRows, error: stateError } = await supabase.rpc("get_mistake_correction_state", {
      p_user_id: user.id,
      p_task_id: taskId,
    });
    if (stateError) throw stateError;
    const failedAttempts = (stateRows?.[0]?.failed_attempts ?? {}) as Record<string, number>;
    if ((failedAttempts[itemId] ?? 0) < 2) {
      return NextResponse.json(
        { error: "Відповідь розкривається після 2 невдалих спроб або кнопкою" },
        { status: 403 }
      );
    }
  }

  // answer — завжди string[] (спільний формат для усіх 5 типів, щоб
  // клієнт (usePracticeCheck) мав один спільний парсинг відповіді).
  if (task.type === "fill_blank") {
    const config = task.config as FillBlankConfig;
    const blankIndex = Number(itemId);
    const matches = [...(config.template ?? "").matchAll(BLANK_RE)];
    const raw = matches[blankIndex]?.[1];
    const first = raw !== undefined ? parseBlankMarker(raw).answers[0] : undefined;
    if (!first) {
      return NextResponse.json({ error: "Некоректний елемент" }, { status: 400 });
    }
    return NextResponse.json({ answer: [first] });
  }

  if (task.type === "true_false") {
    const config = task.config as TrueFalseConfig;
    const statement = config.statements.find((s) => s.id === itemId);
    if (!statement) {
      return NextResponse.json({ error: "Некоректний елемент" }, { status: 400 });
    }
    return NextResponse.json({ answer: [statement.answer ? "Vrai" : "Faux"] });
  }

  if (task.type === "word_choice") {
    const config = task.config as WordChoiceConfig;
    const sentence = config.sentences.find((s) => s.id === itemId);
    if (!sentence) {
      return NextResponse.json({ error: "Некоректний елемент" }, { status: 400 });
    }
    // Кілька правильних варіантів можливі (речення з multiple:true) —
    // усі, не лише перший.
    const correctOptions = sentence.options.filter((o) => o.correct).map((o) => o.text);
    return NextResponse.json({ answer: correctOptions });
  }

  if (task.type === "letter_gaps") {
    const config = task.config as LetterGapsConfig;
    const word = config.words[Number(itemId)];
    if (!word) {
      return NextResponse.json({ error: "Некоректний елемент" }, { status: 400 });
    }
    return NextResponse.json({ answer: [word.word] });
  }

  if (task.type === "letter_rearrangement") {
    const config = task.config as LetterRearrangementConfig;
    const word = config.words[Number(itemId)];
    if (!word) {
      return NextResponse.json({ error: "Некоректний елемент" }, { status: 400 });
    }
    return NextResponse.json({ answer: [word.word] });
  }

  if (task.type === "matching") {
    const config = task.config as MatchingConfig;
    const pair = getMatchingPairs(config).find((p) => p.id === itemId);
    if (!pair) {
      return NextResponse.json({ error: "Некоректний елемент" }, { status: 400 });
    }
    return NextResponse.json({ answer: [pair.right] });
  }

  if (task.type === "table_fill") {
    // Елемент тут РЯДОК (не клітинка) — відповідь може мати 1 чи 2 значення
    // (leftHidden/rightHidden незалежні), у порядку left,right, той самий
    // принцип, що раз rowBlanks у practice/check. Беремо ПЕРШИЙ прийнятний
    // варіант кожної прихованої клітинки (той самий принцип, що
    // fill_blank/parseBlankMarker.answers[0]), без normalize — показуємо як
    // учитель написав, не як сервер звіряє.
    const config = task.config as TableFillConfig;
    const row = getTableFillRows(config).find((r) => r.id === itemId);
    if (!row) {
      return NextResponse.json({ error: "Некоректний елемент" }, { status: 400 });
    }
    const answer: string[] = [];
    if (row.leftHidden) answer.push(row.left.split("|")[0]);
    if (row.rightHidden) answer.push(row.right.split("|")[0]);
    return NextResponse.json({ answer });
  }

  if (task.type === "drag_drop") {
    // Елемент тут РЕЧЕННЯ — може мати кілька пропусків, повертаємо ПЕРШИЙ
    // прийнятний варіант кожного (parseBlankMarker.answers[0]), у порядку
    // пропусків у template (той самий принцип, що table_fill вище).
    const config = task.config as DragDropConfig;
    const sentence = getDragDropSentences(config).find((s) => s.id === itemId);
    if (!sentence) {
      return NextResponse.json({ error: "Некоректний елемент" }, { status: 400 });
    }
    const answer = [...sentence.template.matchAll(BLANK_RE)].map((m) => parseBlankMarker(m[1]).answers[0]);
    return NextResponse.json({ answer });
  }

  // multiple_choice
  const config = task.config as MultipleChoiceConfig;
  const item = getMultipleChoiceItems(config).find((it) => it.id === itemId);
  if (!item) {
    return NextResponse.json({ error: "Некоректний елемент" }, { status: 400 });
  }
  const correctOptions = item.options.filter((o) => o.correct).map((o) => o.text);
  return NextResponse.json({ answer: correctOptions });
}
