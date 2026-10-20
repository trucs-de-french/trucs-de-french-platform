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

  // Guard against re-scoring a block/task that already has a stored result
  // (the client now removes the check button once locked, so this only
  // matters for a stale tab, direct API call, or a second tab on the same
  // task — defense in depth, not the primary enforcement).
  // NOTE: block_progress only stores {pointsEarned, pointsPossible,
  // attempts} per block (0052_block_progress.sql), not the full detail/
  // studentAnswer needed to reconstruct the GradeResult the UI renders —
  // returning the ORIGINAL stored result would need a migration to persist
  // that too. Until then: skip persisting (score/attempts/block_progress/
  // mistakes stay exactly as they were), but still return the freshly
  // computed (deterministic) `result` so the caller has something to
  // render. Left as a known gap rather than writing that migration here.
  const { data: existingProgress } = await supabase
    .from("progress")
    .select("block_progress, attempts")
    .eq("user_id", user.id)
    .eq("task_id", task.id)
    .maybeSingle();

  const alreadyScored =
    blockKey !== null
      ? !!(existingProgress?.block_progress as Record<string, unknown> | null)?.[blockKey]
      : (existingProgress?.attempts ?? 0) > 0;

  if (!alreadyScored) {
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
