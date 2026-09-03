import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Фіксований розмір сітки курсу — узгоджено з користувачем ("набір з 30
// повних тестів"). Картки показуються всі 30 одразу, навіть якщо контент
// для якогось номера ще не авторений (клік просто покаже "ще немає задач").
const TOTAL_TESTS = 30;

type CardStatus = "not_started" | "passed" | "failed";

// ТИМЧАСОВА евристика: середній score (0-100) усіх спроб студента в межах
// тесту, поріг 50%. Це НЕ офіційна DELF-агрегація CO/CE/PE/PO у /25 на
// секцію (для цього немає офіційної сітки CO/CE, лише PE) — коли дійдемо до
// реальних Examen-результатів, замінити на правильний розрахунок.
const PASS_THRESHOLD = 50;

export async function DelfTestGrid({ productId }: { productId: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, delf_test_number")
    .eq("product_id", productId)
    .not("delf_test_number", "is", null)
    .is("material_id", null)
    .returns<{ id: string; delf_test_number: number }[]>();

  const taskIds = (tasks ?? []).map((t) => t.id);

  const { data: progressRows } =
    user && taskIds.length > 0
      ? await supabase
          .from("progress")
          .select("task_id, score")
          .eq("user_id", user.id)
          .in("task_id", taskIds)
          .returns<{ task_id: string; score: number | null }[]>()
      : { data: [] as { task_id: string; score: number | null }[] };

  const scoreByTask = new Map((progressRows ?? []).map((p) => [p.task_id, p.score]));

  const scoresByTest = new Map<number, number[]>();
  for (const task of tasks ?? []) {
    if (!scoreByTask.has(task.id)) continue; // ще не спробована
    const scores = scoresByTest.get(task.delf_test_number) ?? [];
    scores.push(scoreByTask.get(task.id) ?? 0);
    scoresByTest.set(task.delf_test_number, scores);
  }

  function statusFor(testNumber: number): { status: CardStatus; avg?: number } {
    const scores = scoresByTest.get(testNumber);
    if (!scores || scores.length === 0) return { status: "not_started" };
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { status: avg >= PASS_THRESHOLD ? "passed" : "failed", avg };
  }

  return (
    <div className="mt-4 grid grid-cols-5 gap-3 sm:grid-cols-6">
      {Array.from({ length: TOTAL_TESTS }, (_, i) => i + 1).map((n) => {
        const { status, avg } = statusFor(n);
        return (
          <Link
            key={n}
            href={`/courses/${productId}/tests/${n}`}
            className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md border text-sm font-medium ${
              status === "passed"
                ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                : status === "failed"
                  ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                  : "border-neutral-300 text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            <span>{n}</span>
            {avg !== undefined && <span className="text-xs font-normal">{Math.round(avg)}%</span>}
          </Link>
        );
      })}
    </div>
  );
}
