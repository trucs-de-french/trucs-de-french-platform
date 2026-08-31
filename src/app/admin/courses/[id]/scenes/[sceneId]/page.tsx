import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  updateSceneTitle,
  updateSceneVideo,
  updateSceneDialogue,
  addLink,
} from "@/app/admin/scenes/actions";
import { SaveForm } from "@/components/save-form";
import { DialogueEditor } from "./dialogue-editor";
import { SceneBlockList } from "./scene-block-list";
import { TaskDragList } from "./task-drag-list";
import { LinkDragList } from "./link-drag-list";

type SceneBlockType = "video" | "script" | "link" | "task";
const DEFAULT_BLOCK_ORDER: SceneBlockType[] = ["video", "script", "link", "task"];
const BLOCK_LABELS: Record<SceneBlockType, string> = {
  video: "Відео",
  script: "Скрипт",
  link: "Практика",
  task: "Завдання",
};

export default async function AdminScenePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; sceneId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: productId, sceneId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: scene } = await supabase
    .from("scenes")
    .select("id, title, video_url, video_provider, dialogue")
    .eq("id", sceneId)
    .eq("product_id", productId)
    .single();

  if (!scene) notFound();

  const [{ data: links }, { data: tasks }, { data: blocks, error: blocksError }] =
    await Promise.all([
      supabase
        .from("scene_links")
        .select("id, platform, url, label")
        .eq("scene_id", sceneId)
        .order("order_index"),
      supabase
        .from("tasks")
        .select("id, type, title, order_index")
        .eq("scene_id", sceneId)
        .order("order_index"),
      supabase
        .from("scene_blocks")
        .select("block_type")
        .eq("scene_id", sceneId)
        .order("position")
        .returns<{ block_type: SceneBlockType }[]>(),
    ]);

  if (blocksError) {
    // раніше ця помилка мовчки ховалась за фолбеком DEFAULT_BLOCK_ORDER —
    // адмінка виглядала робочою, хоча реальний запит увесь час падав.
    console.error(
      `Не вдалося завантажити scene_blocks для сцени ${sceneId}:`,
      blocksError.message
    );
  }

  const blockTypes =
    blocks && blocks.length > 0 ? blocks.map((b) => b.block_type) : [...DEFAULT_BLOCK_ORDER];
  // 'video' може ще не мати рядка в scene_blocks (з'являється лише коли
  // заповнено URL) — але поле для введення URL має бути видиме й
  // перетягувано в адмінці завжди, тому додаємо його в кінець, якщо нема.
  if (!blockTypes.includes("video")) {
    blockTypes.push("video");
  }

  const videoContent = (
    <SaveForm
      key="video"
      action={updateSceneVideo.bind(null, sceneId)}
      className="flex flex-col gap-4"
    >
      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm font-medium">URL відео</label>
          <input
            name="video_url"
            defaultValue={scene.video_url ?? ""}
            className="rounded-md border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Джерело</label>
          <select
            name="video_provider"
            defaultValue={scene.video_provider ?? "youtube"}
            className="rounded-md border px-3 py-2"
          >
            <option value="youtube">YouTube</option>
            <option value="gdrive">Google Drive</option>
          </select>
        </div>
      </div>
    </SaveForm>
  );

  const scriptContent = (
    <SaveForm
      key="script"
      action={updateSceneDialogue.bind(null, sceneId)}
      className="flex flex-col gap-2"
    >
      <DialogueEditor initialDialogue={scene.dialogue ?? []} />
    </SaveForm>
  );

  const linkContent = (
    <div key="link">
      <LinkDragList
        key={links?.map((l) => l.id).join(",") ?? ""}
        sceneId={sceneId}
        initialLinks={links ?? []}
      />

      <SaveForm
        action={addLink.bind(null, sceneId)}
        saveLabel="+ Додати"
        savedLabel="Додано ✓"
        className="mt-3 flex flex-wrap items-end gap-2"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">Платформа</label>
          <select name="platform" className="rounded-md border px-2 py-1.5 text-sm">
            <option value="quizlet">Quizlet</option>
            <option value="wordwall">Wordwall</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">URL</label>
          <input name="url" required className="rounded-md border px-2 py-1.5 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">Мітка</label>
          <input name="label" className="rounded-md border px-2 py-1.5 text-sm" />
        </div>
      </SaveForm>
    </div>
  );

  const taskContent = (
    <div key="task">
      <div className="flex items-center justify-end">
        <Link
          href={`/admin/courses/${productId}/tasks/new?sceneId=${sceneId}`}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          + Нове завдання
        </Link>
      </div>

      <div className="mt-2">
        <TaskDragList
          key={tasks?.map((t) => t.id).join(",") ?? ""}
          sceneId={sceneId}
          productId={productId}
          initialTasks={tasks ?? []}
        />
      </div>
    </div>
  );

  const contentByType: Record<SceneBlockType, React.ReactNode> = {
    video: videoContent,
    script: scriptContent,
    link: linkContent,
    task: taskContent,
  };

  const sceneBlocks = blockTypes.map((type) => ({
    type,
    label: BLOCK_LABELS[type],
  }));

  return (
    <div>
      <Link href={`/admin/courses/${productId}`} className="text-sm underline">
        ← До курсу
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Редагування сцени</h1>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <SaveForm
        action={updateSceneTitle.bind(null, sceneId)}
        saveLabel="Зберегти назву"
        className="mt-4 flex flex-col gap-1 rounded-md border p-4"
      >
        <label className="text-sm font-medium">Назва сцени</label>
        <input
          name="title"
          defaultValue={scene.title}
          required
          className="rounded-md border px-3 py-2"
        />
      </SaveForm>

      <div className="mt-6">
        <SceneBlockList
          key={blockTypes.join(",")}
          sceneId={sceneId}
          initialBlocks={sceneBlocks}
          contentByType={contentByType}
        />
      </div>
    </div>
  );
}
