import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { copyTask } from "@/app/admin/tasks/actions";
import { SubmitButton } from "@/components/submit-button";
import { CopyTaskDestinationFields } from "./copy-task-destination-fields";

export default async function CopyTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; taskId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: productId, taskId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: task }, { data: product }] = await Promise.all([
    supabase.from("tasks").select("id, title").eq("id", taskId).single(),
    supabase.from("products").select("type").eq("id", productId).single(),
  ]);

  if (!task || !product) notFound();

  const isFilm = product.type === "film";

  const [{ data: scenes }, { data: materials }] = await Promise.all([
    isFilm
      ? supabase.from("scenes").select("id, title").eq("product_id", productId).order("order_index")
      : Promise.resolve({ data: null }),
    !isFilm
      ? supabase
          .from("materials")
          .select("id, title")
          .eq("product_id", productId)
          .eq("category", "general_tip")
          .order("uploaded_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Копіювати завдання «{task.title}»</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Оригінал лишиться незмінним — створюється копія з обраним власником.
      </p>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      {isFilm && (!scenes || scenes.length === 0) ? (
        <p className="mt-4 text-neutral-500 dark:text-neutral-400">
          У цьому курсі ще немає сцен — нема куди копіювати.
        </p>
      ) : (
        <form
          action={copyTask.bind(null, taskId)}
          className="mt-4 flex flex-col gap-4 rounded-md border p-4"
        >
          {isFilm ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">Сцена</label>
              <input type="hidden" name="destination" value="scene" />
              <select name="scene_id" required className="rounded-md border px-2 py-1.5 text-sm">
                {scenes!.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <CopyTaskDestinationFields materials={materials ?? []} />
          )}

          <SubmitButton
            pendingChildren="Копіюю..."
            className="self-start rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            Копіювати
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
