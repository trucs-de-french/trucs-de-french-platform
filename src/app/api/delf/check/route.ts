import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkEssayAnswer } from "@/lib/delf/check-answer";
import { recordTaskAttempt } from "@/lib/progress";

type TaskConfig = { prompt?: string; criteria?: string };

export async function POST(request: Request) {
  const body = await request.json();
  const taskId = body.taskId as string | undefined;
  const answer = body.answer as string | undefined;

  if (!taskId || typeof answer !== "string") {
    return NextResponse.json(
      { error: "Поля taskId і answer обов'язкові" },
      { status: 400 }
    );
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
    .select("id, config")
    .eq("id", taskId)
    .eq("type", "essay_check")
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Завдання не знайдено" }, { status: 404 });
  }

  const config = (task.config ?? {}) as TaskConfig;
  const result = await checkEssayAnswer({
    prompt: config.prompt ?? "",
    criteria: config.criteria ?? "",
    studentAnswer: answer,
  });

  await recordTaskAttempt(supabase, user.id, task.id, {
    correct: result.correct,
    score: result.correct ? 100 : 0,
    studentAnswer: answer,
    detail: result,
  });

  return NextResponse.json(result);
}
