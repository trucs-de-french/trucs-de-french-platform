import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gradeAnswer } from "@/lib/exercises/grade";
import { recordTaskAttempt } from "@/lib/progress";
import { isGradableTaskType } from "@/lib/exercises/gradable-types";

const DUPLICATE_SUBMIT_WINDOW_MS = 5_000;

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

  // Ключ блоку для поблочного прогресу (P1-фікс, progress.ts) — лише коли
  // grade.ts підтверджує тип БЛОКОВИМ (totalPointsPossible присутній):
  // word_search/crossword уже несуть явний answer.blockIndex (grade.ts сам
  // звужує скоуп за ним); matching/table_fill/letter_gaps/
  // letter_rearrangement не кладуть blockIndex у answer (скоуп там визначає
  // САМ grade.ts за присутніми в answer позиціями) — блокIndex для них іде
  // окремим полем body.blockIndex (submitBlock у відповідному *.tsx), не
  // всередині answer, щоб не чіпати форму відповіді й сам gradeXxx.
  const blockIndexFromAnswer = (answer as { blockIndex?: unknown } | null | undefined)?.blockIndex;
  const rawBlockIndex =
    typeof blockIndexFromAnswer === "number" ? blockIndexFromAnswer : body.blockIndex;
  const blockIndex = typeof rawBlockIndex === "number" ? rawBlockIndex : undefined;
  const blockKey =
    blockIndex !== undefined && result.totalPointsPossible !== undefined ? String(blockIndex) : null;

  // Guard against double-recording the SAME submission (stale tab, direct
  // API call, or a second tab sending the same check within the same
  // click) — narrowed to a short time window on last_attempt_at instead of
  // "a stored entry exists at all": the old version treated any previous
  // attempt (even a 0-point one) as "already scored" and silently dropped
  // every later re-attempt forever, losing progress/best_score/attempts/
  // mistakes/activity_log for every redo. A genuine new attempt more than
  // DUPLICATE_SUBMIT_WINDOW_MS after the last one now always goes through
  // recordTaskAttempt, for both block and non-block tasks.
  const { data: existingProgress } = await supabase
    .from("progress")
    .select("last_attempt_at")
    .eq("user_id", user.id)
    .eq("task_id", task.id)
    .maybeSingle();

  const isDuplicateSubmit =
    !!existingProgress?.last_attempt_at &&
    Date.now() - new Date(existingProgress.last_attempt_at).getTime() < DUPLICATE_SUBMIT_WINDOW_MS;

  if (!isDuplicateSubmit) {
    await recordTaskAttempt(supabase, user.id, task.id, {
      correct: result.correct,
      score: result.score,
      studentAnswer: answer,
      detail: result.detail,
      blockKey,
      blockPointsEarned: result.pointsEarned,
      blockPointsPossible: result.pointsPossible,
      totalPointsPossible: result.totalPointsPossible,
    });
  }

  return NextResponse.json(result);
}
