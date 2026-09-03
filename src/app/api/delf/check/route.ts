import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkEssayAnswer, checkFormulaireAnswer } from "@/lib/delf/check-answer";
import { recordTaskAttempt } from "@/lib/progress";
import type { EssayCheckConfig, EssayFormulaireConfig } from "@/lib/exercises/types";

function isFormulaireConfig(
  config: EssayCheckConfig | EssayFormulaireConfig
): config is EssayFormulaireConfig {
  return config.level === "A1" && config.exerciseNumber === 1;
}

export async function POST(request: Request) {
  const body = await request.json();
  const taskId = body.taskId as string | undefined;
  const answer = body.answer as string | Record<string, string> | undefined;

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
    .select("id, config")
    .eq("id", taskId)
    .eq("type", "essay_check")
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Завдання не знайдено" }, { status: 404 });
  }

  const rawConfig = (task.config ?? {}) as Partial<EssayCheckConfig & EssayFormulaireConfig>;
  // level відсутній у config завдань, створених до цієї фічі — дефолт B1.
  const config = { ...rawConfig, level: rawConfig.level ?? "B1" } as
    | EssayCheckConfig
    | EssayFormulaireConfig;

  if (isFormulaireConfig(config)) {
    if (typeof answer !== "object" || Array.isArray(answer)) {
      return NextResponse.json({ error: "Для формуляра answer має бути об'єктом" }, { status: 400 });
    }

    const result = await checkFormulaireAnswer({
      instructions: config.instructions,
      fields: config.fields,
      studentAnswer: answer,
    });

    await recordTaskAttempt(supabase, user.id, task.id, {
      correct: result.correct,
      score: result.maxScore > 0 ? Math.round((result.totalScore / result.maxScore) * 100) : 0,
      studentAnswer: answer,
      detail: result,
    });

    return NextResponse.json(result);
  }

  if (typeof answer !== "string") {
    return NextResponse.json({ error: "Поле answer має бути текстом" }, { status: 400 });
  }

  const result = await checkEssayAnswer({
    prompt: config.prompt ?? "",
    criteria: config.criteria ?? "",
    studentAnswer: answer,
    level: config.level,
    exerciseNumber: config.exerciseNumber,
  });

  await recordTaskAttempt(supabase, user.id, task.id, {
    correct: result.correct,
    score: Math.round((result.totalScore / result.maxScore) * 100),
    studentAnswer: answer,
    detail: result,
  });

  return NextResponse.json(result);
}
