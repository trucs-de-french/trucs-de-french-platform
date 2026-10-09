import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPracticeItemsTaskType } from "@/lib/exercises/error-review";
import { BLANK_RE, parseBlankMarker, getMultipleChoiceItems } from "@/lib/exercises/sanitize";
import type { FillBlankConfig, MultipleChoiceConfig } from "@/lib/exercises/types";

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

  if (task.type === "fill_blank") {
    const config = task.config as FillBlankConfig;
    const blankIndex = Number(itemId);
    const matches = [...(config.template ?? "").matchAll(BLANK_RE)];
    const raw = matches[blankIndex]?.[1];
    const first = raw !== undefined ? parseBlankMarker(raw).answers[0] : undefined;
    if (!first) {
      return NextResponse.json({ error: "Некоректний елемент" }, { status: 400 });
    }
    // answer — завжди string[] (та сама форма, що multiple_choice нижче),
    // щоб клієнт (usePracticeCheck) мав один спільний формат для обох типів.
    return NextResponse.json({ answer: [first] });
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
