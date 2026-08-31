import { createClient } from "@/lib/supabase/server";
import { createTask } from "@/app/admin/tasks/actions";
import { SubmitButton } from "@/components/submit-button";
import { TaskConfigFields } from "../task-config-fields";
import { collectSceneVocab, type VocabItem } from "@/lib/vocab";

export default async function NewTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sceneId?: string }>;
}) {
  const { id: productId } = await params;
  const { sceneId } = await searchParams;

  const supabase = await createClient();
  const [{ data: scenes }, { data: sceneRow }] = await Promise.all([
    supabase.from("scenes").select("id, title").eq("product_id", productId).order("order_index"),
    sceneId
      ? supabase.from("scenes").select("dialogue").eq("id", sceneId).single()
      : Promise.resolve({ data: null }),
  ]);
  const sceneVocab: VocabItem[] = sceneRow
    ? collectSceneVocab((sceneRow.dialogue ?? []) as { vocab?: VocabItem[] }[])
    : [];

  return (
    <div>
      <h1 className="text-xl font-semibold">Нове завдання</h1>

      <form action={createTask} className="mt-4 flex flex-col gap-4 rounded-md border p-4">
        <input type="hidden" name="product_id" value={productId} />
        {sceneId && <input type="hidden" name="scene_id" value={sceneId} />}

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Назва</label>
          <input name="title" required className="rounded-md border px-3 py-2" />
        </div>

        <TaskConfigFields scenes={scenes ?? []} sceneVocab={sceneVocab} />

        <SubmitButton
          pendingChildren="Створюю..."
          className="self-start rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Створити
        </SubmitButton>
      </form>
    </div>
  );
}
