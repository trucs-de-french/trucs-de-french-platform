import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateTask, deleteTask } from "@/app/admin/tasks/actions";
import { SaveForm } from "@/components/save-form";
import { SubmitButton } from "@/components/submit-button";
import { TaskConfigFields } from "../task-config-fields";
import { collectSceneVocab, type VocabItem } from "@/lib/vocab";

type TaskDetail = {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown> | null;
  image_url: string | null;
  audio_url: string | null;
  scene_id: string | null;
  delf_section: string | null;
  delf_test_number: number | null;
  games: { provider: string; embed_url: string | null; game_type: string | null } | null;
};

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id: productId, taskId } = await params;
  const supabase = await createClient();

  const [{ data: task }, { data: scenes }, { data: product }] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, type, title, config, image_url, audio_url, scene_id, delf_section, delf_test_number, games(provider, embed_url, game_type)"
      )
      .eq("id", taskId)
      .single<TaskDetail>(),
    supabase.from("scenes").select("id, title").eq("product_id", productId).order("order_index"),
    supabase.from("products").select("type").eq("id", productId).single(),
  ]);

  if (!task) notFound();

  const { data: sceneRow } = task.scene_id
    ? await supabase.from("scenes").select("dialogue").eq("id", task.scene_id).single()
    : { data: null };
  const sceneVocab: VocabItem[] = sceneRow
    ? collectSceneVocab((sceneRow.dialogue ?? []) as { vocab?: VocabItem[] }[])
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold">Редагування завдання</h1>

      <SaveForm
        action={updateTask.bind(null, task.id)}
        className="mt-4 flex flex-col gap-4 rounded-md border p-4"
        sticky
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">Назва</label>
          <input
            name="title"
            defaultValue={task.title}
            required
            className="rounded-md border px-3 py-2 text-base font-medium"
          />
        </div>

        <TaskConfigFields
          initialType={task.type}
          initialConfig={task.config ?? {}}
          initialGame={task.games ?? undefined}
          initialImageUrl={task.image_url}
          initialAudioUrl={task.audio_url}
          scenes={scenes ?? []}
          sceneVocab={sceneVocab}
          productType={product?.type}
          initialDelfSection={task.delf_section}
          initialDelfTestNumber={task.delf_test_number}
        />
      </SaveForm>

      <form action={deleteTask.bind(null, task.id)} className="mt-3">
        <SubmitButton
          pendingChildren="Видаляю..."
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
        >
          Видалити завдання
        </SubmitButton>
      </form>
    </div>
  );
}
