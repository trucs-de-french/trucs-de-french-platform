import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function recordTaskAttempt(
  supabase: SupabaseServerClient,
  userId: string,
  taskId: string,
  result: { correct: boolean; score: number; studentAnswer?: unknown; detail?: unknown }
) {
  // атомарний upsert на рівні БД (INSERT ... ON CONFLICT DO UPDATE
  // attempts = attempts + 1) — виключає втрату інкременту при
  // паралельних/швидких повторних сабмітах, на відміну від
  // SELECT-потім-UPSERT у коді застосунку
  const { error: progressError } = await supabase.rpc("record_task_attempt", {
    p_user_id: userId,
    p_task_id: taskId,
    p_score: result.score,
  });
  if (progressError) throw progressError;

  if (!result.correct) {
    await supabase.from("mistakes").insert({
      user_id: userId,
      task_id: taskId,
      student_answer:
        typeof result.studentAnswer === "string"
          ? result.studentAnswer
          : JSON.stringify(result.studentAnswer ?? null),
      ai_feedback: result.detail ?? null,
    });
  }
}
