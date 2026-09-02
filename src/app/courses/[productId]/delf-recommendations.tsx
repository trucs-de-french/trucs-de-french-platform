import { createClient } from "@/lib/supabase/server";
import { sanitizeFillBlank } from "@/lib/exercises/sanitize";
import type { FillBlankConfig } from "@/lib/exercises/types";
import { RemedialExercise } from "./remedial-exercise";

// Ті самі 5 категорій, що вже повертає essay_check (src/lib/delf/check-answer.ts).
const CATEGORIES = ["Grammaire", "Lexique", "Orthographe", "Cohérence", "Registre"] as const;
type Category = (typeof CATEGORIES)[number];

const MAX_EXAMPLES_PER_CATEGORY = 5;

type EssayError = {
  original: string;
  fix: string;
  category: string;
  rule: string;
  explanation: string;
};

type RemedialRow = {
  id: string;
  mistake_id: string;
  category: string;
  review: string;
  config: FillBlankConfig;
  student_answer: unknown;
  score: number | null;
};

// Лише PE (essay_check) — PO ще не має аудіо-інфраструктури, за домовленістю
// не включаємо. По всьому продукту (рівню), не по окремому тесту — загальна
// картина слабких місць корисніша, ніж розрізнена по 30 тестах.
export async function DelfRecommendations({ productId }: { productId: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: essayTasks } = await supabase
    .from("tasks")
    .select("id")
    .eq("product_id", productId)
    .eq("type", "essay_check")
    .returns<{ id: string }[]>();

  const taskIds = (essayTasks ?? []).map((t) => t.id);

  const { data: mistakeRows } =
    taskIds.length > 0
      ? await supabase
          .from("mistakes")
          .select("id, ai_feedback, created_at")
          .eq("user_id", user.id)
          .in("task_id", taskIds)
          .order("created_at", { ascending: false })
          .returns<{ id: string; ai_feedback: unknown; created_at: string }[]>()
      : { data: [] as { id: string; ai_feedback: unknown; created_at: string }[] };

  const mistakeIds = (mistakeRows ?? []).map((m) => m.id);

  // Той самий двозапитовий патерн, що DelfTestGrid — id спершу, .in() потім,
  // а не embedded-фільтр Supabase JS.
  const { data: remedialRows } =
    mistakeIds.length > 0
      ? await supabase
          .from("remedial_exercises")
          .select("id, mistake_id, category, review, config, student_answer, score")
          .eq("user_id", user.id)
          .in("mistake_id", mistakeIds)
          .order("created_at", { ascending: false })
          .limit(30)
          .returns<RemedialRow[]>()
      : { data: [] as RemedialRow[] };

  const byCategory = new Map<Category, EssayError[]>();
  const remedialByCategory = new Map<Category, RemedialRow[]>();
  for (const cat of CATEGORIES) {
    byCategory.set(cat, []);
    remedialByCategory.set(cat, []);
  }

  for (const row of mistakeRows ?? []) {
    const feedback = row.ai_feedback as { errors?: unknown[] } | null;
    if (!feedback || !Array.isArray(feedback.errors)) continue;

    for (const raw of feedback.errors) {
      if (!raw || typeof raw !== "object") continue;
      const err = raw as Partial<EssayError>;
      if (!err.category || !CATEGORIES.includes(err.category as Category)) continue;
      if (!err.original || !err.fix || !err.explanation) continue;

      const list = byCategory.get(err.category as Category)!;
      // mistakeRows уже відсортовані created_at desc, тож перші N — і є
      // "кілька останніх прикладів".
      if (list.length < MAX_EXAMPLES_PER_CATEGORY) {
        list.push(err as EssayError);
      }
    }
  }

  for (const row of remedialRows ?? []) {
    if (!CATEGORIES.includes(row.category as Category)) continue;
    remedialByCategory.get(row.category as Category)!.push(row);
  }

  const nonEmptyCategories = CATEGORIES.filter((c) => (byCategory.get(c) ?? []).length > 0);

  if (nonEmptyCategories.length === 0) {
    return (
      <p className="mt-4 text-neutral-500 dark:text-neutral-400">
        Поки що немає помилок для аналізу — вони з&apos;являться тут після перших спроб есе (PE).
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-6">
      {nonEmptyCategories.map((category) => {
        // Групуємо вправи цієї категорії по mistake_id (одна генерація =
        // один review-текст + 1-2 вправи), щоб review не повторювався перед
        // кожною вправою окремо.
        const batches = new Map<string, RemedialRow[]>();
        for (const row of remedialByCategory.get(category) ?? []) {
          const list = batches.get(row.mistake_id) ?? [];
          list.push(row);
          batches.set(row.mistake_id, list);
        }

        return (
          <section key={category}>
            <h2 className="text-lg font-medium">{category}</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {byCategory.get(category)!.map((err, i) => (
                <li key={i} className="rounded-md border p-3 text-sm">
                  <p>
                    <span className="text-red-600 line-through dark:text-red-400">
                      {err.original}
                    </span>
                    {" → "}
                    <span className="text-green-700 dark:text-green-400">{err.fix}</span>
                  </p>
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400">{err.rule}</p>
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400">{err.explanation}</p>
                </li>
              ))}
            </ul>

            {batches.size > 0 && (
              <div className="mt-3 flex flex-col gap-4">
                {[...batches.values()].map((rows) => (
                  <div key={rows[0].id} className="flex flex-col gap-2">
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                      {rows[0].review}
                    </p>
                    {rows.map((row) => (
                      <RemedialExercise
                        key={row.id}
                        exerciseId={row.id}
                        config={sanitizeFillBlank(row.config)}
                        initialStudentAnswer={
                          Array.isArray(row.student_answer)
                            ? (row.student_answer as string[])
                            : null
                        }
                        initialScore={row.score}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
