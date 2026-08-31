import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gradeAnswer } from "@/lib/exercises/grade";
import { recordTaskAttempt } from "@/lib/progress";
import { isGradableTaskType } from "@/lib/exercises/gradable-types";

export async function POST(request: Request) {
  const body = await request.json();
  const taskId = body.taskId as string | undefined;
  const answer = body.answer;

  if (!taskId || answer === undefined) {
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
    .select("id, type, config")
    .eq("id", taskId)
    .single();

  if (taskError || !task || !isGradableTaskType(task.type)) {
    return NextResponse.json({ error: "Завдання не знайдено" }, { status: 404 });
  }

  const result = gradeAnswer(task.type, (task.config ?? {}) as Record<string, unknown>, answer);

  await recordTaskAttempt(supabase, user.id, task.id, {
    correct: result.correct,
    score: result.score,
    studentAnswer: answer,
    detail: result.detail,
  });

  return NextResponse.json(result);
}
