import Link from "next/link";
import { Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateTask, deleteTask } from "@/app/admin/tasks/actions";
import { SaveForm } from "@/components/save-form";
import { SubmitButton } from "@/components/submit-button";
import { TaskConfigFields } from "../task-config-fields";
import { collectSceneVocab, type VocabItem } from "@/lib/vocab";
import { blockDomId } from "@/lib/block-dom-id";
import { BUTTON_DANGER } from "@/lib/button-styles";
import { ADMIN_PAGE_TITLE, BREADCRUMB_LINK } from "@/lib/typography-styles";

type TaskDetail = {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown> | null;
  image_url: string | null;
  audio_url: string | null;
  scene_id: string | null;
  material_id: string | null;
  task_group_id: string | null;
  delf_section: string | null;
  delf_test_number: number | null;
  points_visible: boolean;
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
        "id, type, title, config, image_url, audio_url, scene_id, material_id, task_group_id, delf_section, delf_test_number, points_visible, games(provider, embed_url, game_type)"
      )
      .eq("id", taskId)
      .single<TaskDetail>(),
    supabase.from("scenes").select("id, title").eq("product_id", productId).order("order_index"),
    supabase.from("products").select("type").eq("id", productId).single(),
  ]);

  if (!task) notFound();

  // Задача в блоці (task_group_id) сама має null scene_id/material_id
  // (успадковує контекст від групи, 0031_task_groups.sql) — доводиться
  // підвантажити батьківський контекст самої групи, той самий принцип, що
  // resolveTaskParentPath (../../tasks/actions.ts).
  let group: {
    scene_id: string | null;
    material_id: string | null;
    delf_test_number: number | null;
    scene_content_block_id: string | null;
  } | null = null;
  if (task.task_group_id) {
    const { data } = await supabase
      .from("task_groups")
      .select("scene_id, material_id, delf_test_number, scene_content_block_id")
      .eq("id", task.task_group_id)
      .single();
    group = data ?? null;
  }

  // Група, прикріплена до scene_content_block (0040) — керується інлайн на
  // сторінці сцени, не власною сторінкою; резолвимо scene_id через сам
  // content-блок і повертаємо якорем на його картку.
  let contentBlockSceneId: string | null = null;
  if (group?.scene_content_block_id) {
    const { data: contentBlock } = await supabase
      .from("scene_content_blocks")
      .select("scene_id")
      .eq("id", group.scene_content_block_id)
      .single();
    contentBlockSceneId = contentBlock?.scene_id ?? null;
  }

  // Сцена вправи — власна (task.scene_id) АБО, для вправи блоку, сцена
  // самої групи (group.scene_id) чи, для групи, прикріпленої до content-
  // блоку, сцена ЦЬОГО блоку (contentBlockSceneId) — словник читається
  // звідти так само, як для звичайної вправи сцени. Для блоку в матеріалі/
  // DELF (group.material_id/group.delf_test_number) сцени взагалі немає —
  // effectiveSceneId лишається null, словник порожній, як і раніше.
  const effectiveSceneId = task.scene_id ?? contentBlockSceneId ?? group?.scene_id ?? null;
  const { data: sceneRow } = effectiveSceneId
    ? await supabase.from("scenes").select("dialogue").eq("id", effectiveSceneId).single()
    : { data: null };
  const sceneVocab: VocabItem[] = sceneRow
    ? collectSceneVocab((sceneRow.dialogue ?? []) as { vocab?: VocabItem[] }[])
    : [];

  // Вправа, прив'язана до сцени/матеріалу, повертає саме туди, а не на
  // курс — той самий розподіл, що й на сторінці створення завдання. Вправа
  // звичайного блоку повертається на сторінку самого блоку (там і решта
  // його задач); вправа блоку, прикріпленого до content-блоку, повертається
  // на сторінку сцени, якорем на саму картку (blockDomId, той самий, що
  // "+ Нова задача"/detachTask).
  const backHref =
    contentBlockSceneId && group?.scene_content_block_id
      ? `/admin/courses/${productId}/scenes/${contentBlockSceneId}#${blockDomId(`content:${group.scene_content_block_id}`)}`
      : task.task_group_id
        ? `/admin/courses/${productId}/task-groups/${task.task_group_id}`
        : task.scene_id
          ? `/admin/courses/${productId}/scenes/${task.scene_id}`
          : task.material_id
            ? `/admin/courses/${productId}/materials/${task.material_id}`
            : task.delf_test_number
              ? `/admin/courses/${productId}/tests/${task.delf_test_number}`
              : `/admin/courses/${productId}#tasks`;
  const backLabel = task.task_group_id
    ? "← До блоку"
    : task.scene_id
      ? "← До сцени"
      : task.material_id
        ? "← До матеріалу"
        : task.delf_test_number
          ? "← До тесту"
          : "← До курсу";

  // Студентська сторінка, де ця вправа реально відображається — той самий
  // розподіл, що й backHref, але веде на публічну сторону (scenes/materials
  // спільні з backHref, DELF — окремо: сторінка тесту фільтрує задачі за
  // product_id+delf_test_number, а не delf_section, тож URL будується з
  // номера тесту). Задача блоку веде на сторінку батьківського контексту
  // ГРУПИ (не власну сторінку задачі — такої немає для студента), якорем на
  // сам блок (#group-{id}, той самий, що вже task-groups/[groupId]/page.tsx).
  // null — коли для задачі взагалі немає валідного студентського місця
  // (задача-сирота без номера DELF-тесту).
  const studentHref = task.task_group_id
    ? effectiveSceneId
      ? `/courses/${productId}/scenes/${effectiveSceneId}#group-${task.task_group_id}`
      : group?.material_id
        ? `/courses/${productId}/materials/${group.material_id}#group-${task.task_group_id}`
        : group?.delf_test_number
          ? `/courses/${productId}/tests/${group.delf_test_number}#group-${task.task_group_id}`
          : null
    : task.scene_id
      ? `/courses/${productId}/scenes/${task.scene_id}`
      : task.material_id
        ? `/courses/${productId}/materials/${task.material_id}`
        : task.delf_test_number
          ? `/courses/${productId}/tests/${task.delf_test_number}`
          : null;

  return (
    <div>
      <Link href={backHref} className={BREADCRUMB_LINK}>
        {backLabel}
      </Link>
      <h1 className={`mt-2 ${ADMIN_PAGE_TITLE}`}>Редагування завдання</h1>

      <SaveForm
        action={updateTask.bind(null, productId, task.id)}
        className="mt-4 flex flex-col gap-4 rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
        sticky
        backLink={{ href: backHref, label: backLabel }}
        previewLink={studentHref ? { productId, href: studentHref } : undefined}
      >
        <TaskConfigFields
          initialTitle={task.title}
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
          materialId={task.material_id}
          initialPointsVisible={task.points_visible}
        />
      </SaveForm>

      <form action={deleteTask.bind(null, task.id)} className="mt-3">
        <SubmitButton
          pendingChildren="Видаляю..."
          className={`inline-flex items-center gap-1.5 ${BUTTON_DANGER}`}
        >
          <Trash2 size={16} />
          Видалити завдання
        </SubmitButton>
      </form>
    </div>
  );
}
