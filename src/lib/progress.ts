import type { createClient } from "@/lib/supabase/server";
import { idsToClearAfterMistake } from "@/lib/exercises/error-review";

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
  // Потрібен лише для idsToClearAfterMistake нижче (яка з ERROR_REVIEW
  // гілок застосовна) — саме збереження прогресу/mistakes від типу
  // завдання не залежить.
  taskType: string,
  result: {
    correct: boolean;
    score: number;
    studentAnswer?: unknown;
    detail?: unknown;
    // Поблочний сабміт (word_search/crossword/matching/table_fill/
    // letter_gaps/letter_rearrangement, route.ts) — лише коли ОБИДВА
    // присутні: blockKey (String(blockIndex)) і totalPointsPossible
    // (grade.ts, повний знаменник вправи). Будь-яке з них відсутнє —
    // старий однопосилковий шлях (0007_atomic_progress_upsert.sql),
    // поведінка НЕ змінюється для жодного іншого типу чи одноблочної
    // вправи.
    blockKey?: string | null;
    blockPointsEarned?: number;
    blockPointsPossible?: number;
    totalPointsPossible?: number;
  }
) {
  if (result.blockKey != null && result.totalPointsPossible !== undefined) {
    // Злиття — на СЕРВЕРІ БД (record_block_task_attempt, 0052_block_progress.sql):
    // читає наявний block_progress, підставляє/оновлює лише ЦЕЙ блок,
    // перераховує суму — під одним row-level lock, тож перевірка іншого
    // блоку паралельно не губиться.
    const { error: progressError } = await supabase.rpc("record_block_task_attempt", {
      p_user_id: userId,
      p_task_id: taskId,
      p_block_key: result.blockKey,
      p_block_points_earned: result.blockPointsEarned ?? 0,
      p_block_points_possible: result.blockPointsPossible ?? 0,
      p_total_points_possible: result.totalPointsPossible,
    });
    if (progressError) throw progressError;
  } else {
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
  }

  if (!result.correct || hasReportableErrors(result.detail)) {
    await supabase.from("mistakes").insert({
      user_id: userId,
      task_id: taskId,
      student_answer:
        typeof result.studentAnswer === "string"
          ? result.studentAnswer
          : JSON.stringify(result.studentAnswer ?? null),
      ai_feedback: result.detail ?? null,
    });

    // "Застарілі виправлення ховають нову помилку" (аудит, Case A) —
    // елементи, що щойно знову стали неправильними, перестають рахуватись
    // "виправленими" (RPC clear_mistake_corrections, 0071; helper —
    // idsToClearAfterMistake, error-review.ts). Best-effort, той самий
    // принцип, що cleanupAvatarFolder (avatar-storage.ts): провал НЕ
    // повинен валити саме збереження спроби (mistakes-рядок вище вже
    // записаний) — лише логується, зокрема коли міграція 0071 ще не
    // застосована (функція в БД відсутня).
    const idsToClear = idsToClearAfterMistake(taskType, result.detail, result.correct);
    if (idsToClear.length > 0) {
      try {
        const { error } = await supabase.rpc("clear_mistake_corrections", {
          p_user_id: userId,
          p_task_id: taskId,
          p_item_ids: idsToClear,
        });
        if (error) console.error("[recordTaskAttempt] clear_mistake_corrections failed:", error.message);
      } catch (err) {
        console.error("[recordTaskAttempt] clear_mistake_corrections unexpected failure:", err);
      }
    }
  }
}
