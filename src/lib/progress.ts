import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// essay_check — єдиний тип, чий Detail містить errors[] (жоден інший тип у
// exercises/types.ts цього поля не має) — тож ця перевірка нічого, крім
// essay_check, не зачіпає. Дозволяє писати в mistakes навіть коли
// result.correct === true (напр. 17/25 — зараховано, але 5 граматичних
// помилок усе одно є), інакше вкладка "Рекомендації" не мала б джерела
// даних для таких спроб.
function hasReportableErrors(detail: unknown): boolean {
  if (!detail || typeof detail !== "object") return false;
  const errors = (detail as { errors?: unknown }).errors;
  return Array.isArray(errors) && errors.length > 0;
}

export async function recordTaskAttempt(
  supabase: SupabaseServerClient,
  userId: string,
  taskId: string,
  result: { correct: boolean; score: number; studentAnswer?: unknown; detail?: unknown }
): Promise<{ mistakeId: string | null }> {
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

  if (!result.correct || hasReportableErrors(result.detail)) {
    // .select("id").single() — потрібен id щойно вставленого рядка, щоб
    // essay_check-роут міг прив'язати remedial_exercises.mistake_id саме
    // до ЦІЄЇ спроби, а не шукати її окремим запитом.
    const { data: mistake, error: mistakeError } = await supabase
      .from("mistakes")
      .insert({
        user_id: userId,
        task_id: taskId,
        student_answer:
          typeof result.studentAnswer === "string"
            ? result.studentAnswer
            : JSON.stringify(result.studentAnswer ?? null),
        ai_feedback: result.detail ?? null,
      })
      .select("id")
      .single();
    if (mistakeError) throw mistakeError;
    return { mistakeId: mistake?.id ?? null };
  }

  return { mistakeId: null };
}
