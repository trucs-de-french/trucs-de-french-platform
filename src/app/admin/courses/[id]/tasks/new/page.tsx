import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createTask } from "@/app/admin/tasks/actions";
import { SubmitButton } from "@/components/submit-button";
import { TaskConfigFields } from "../task-config-fields";
import { collectSceneVocab, type VocabItem } from "@/lib/vocab";
import { BUTTON_PRIMARY_LG } from "@/lib/button-styles";
import { INPUT_BORDER } from "@/lib/input-styles";
import { ADMIN_PAGE_TITLE, BREADCRUMB_LINK, LABEL_TEXT } from "@/lib/typography-styles";

export default async function NewTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sceneId?: string;
    materialId?: string;
    taskGroupId?: string;
    delfSection?: string;
    delfTestNumber?: string;
    anchor?: string;
  }>;
}) {
  const { id: productId } = await params;
  const { sceneId, materialId, taskGroupId, delfSection, delfTestNumber, anchor } = await searchParams;

  const supabase = await createClient();

  // sceneId відсутній у URL, коли завдання створюється через "+ Нова
  // задача" в прикріпленому блоці вправ додаткового content-блоку чи
  // "+ Нова задача в блоці" (обидва передають лише taskGroupId) — але
  // сцена, якій належить група, однозначно відома на сервері (напряму або
  // через scene_content_block). Той самий двоступеневий резолв, що вже й у
  // createTask -> resolveTaskParentPath (admin/tasks/actions.ts), лише в
  // інший бік — тут для sceneVocab, там для шляху редиректу.
  let effectiveSceneId = sceneId ?? null;
  if (!effectiveSceneId && taskGroupId) {
    const { data: group } = await supabase
      .from("task_groups")
      .select("scene_id, scene_content_block_id")
      .eq("id", taskGroupId)
      .single();
    if (group?.scene_id) {
      effectiveSceneId = group.scene_id;
    } else if (group?.scene_content_block_id) {
      const { data: contentBlock } = await supabase
        .from("scene_content_blocks")
        .select("scene_id")
        .eq("id", group.scene_content_block_id)
        .single();
      effectiveSceneId = contentBlock?.scene_id ?? null;
    }
  }

  // Резолвлений через taskGroupId sceneId відсутній у самому URL — сайдбар
  // (CourseSwitcherSidebar) підсвічує активну сцену через useSearchParams()
  // на клієнті, тож без sceneId у query він нізвідки його не візьме.
  // Один зайвий redirect-хоп лише для цього входу (блок без прямого
  // sceneId) — після нього sceneId уже в URL, повторного редіректу не буде.
  if (!sceneId && effectiveSceneId) {
    const params = new URLSearchParams();
    params.set("sceneId", effectiveSceneId);
    if (materialId) params.set("materialId", materialId);
    if (taskGroupId) params.set("taskGroupId", taskGroupId);
    if (delfSection) params.set("delfSection", delfSection);
    if (delfTestNumber) params.set("delfTestNumber", delfTestNumber);
    if (anchor) params.set("anchor", anchor);
    redirect(`/admin/courses/${productId}/tasks/new?${params.toString()}`);
  }

  const [{ data: scenes }, { data: sceneRow }, { data: product }] = await Promise.all([
    supabase.from("scenes").select("id, title").eq("product_id", productId).order("order_index"),
    effectiveSceneId
      ? supabase.from("scenes").select("dialogue").eq("id", effectiveSceneId).single()
      : Promise.resolve({ data: null }),
    supabase.from("products").select("type").eq("id", productId).single(),
  ]);
  const sceneVocab: VocabItem[] = sceneRow
    ? collectSceneVocab((sceneRow.dialogue ?? []) as { vocab?: VocabItem[] }[])
    : [];

  // Контекст, з якого прийшли, відомий одразу з searchParams — вправа,
  // прив'язана до сцени/матеріалу/блоку/DELF-тесту, повертає саме туди, а
  // не на курс. Задача блоку повертається на сторінку самого блоку (не на
  // сцену/матеріал/тест блоку) — там і видно решту його задач.
  const backHref = taskGroupId
    ? `/admin/courses/${productId}/task-groups/${taskGroupId}`
    : sceneId
      ? `/admin/courses/${productId}/scenes/${sceneId}`
      : materialId
        ? `/admin/courses/${productId}/materials/${materialId}`
        : delfTestNumber
          ? `/admin/courses/${productId}/tests/${delfTestNumber}`
          : `/admin/courses/${productId}#tasks`;
  const backLabel = taskGroupId
    ? "← До блоку"
    : sceneId
      ? "← До сцени"
      : materialId
        ? "← До матеріалу"
        : delfTestNumber
          ? "← До тесту"
          : "← До курсу";

  return (
    <div>
      <Link href={backHref} className={BREADCRUMB_LINK}>
        {backLabel}
      </Link>
      <h1 className={`mt-2 ${ADMIN_PAGE_TITLE}`}>Нове завдання</h1>

      <form
        action={createTask}
        className="mt-4 flex flex-col gap-4 rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
      >
        <input type="hidden" name="product_id" value={productId} />
        {sceneId && <input type="hidden" name="scene_id" value={sceneId} />}
        {materialId && <input type="hidden" name="material_id" value={materialId} />}
        {taskGroupId && <input type="hidden" name="task_group_id" value={taskGroupId} />}
        {/* Куди саме повернути скрол після redirect() у createTask — той
            самий блок/секцію, звідки прийшли (SceneBlockList картка,
            секція "Вправи"/"Задачі блоку"/DELF-секція), не просто дефолт
            "верх сторінки". Непрозорий рядок — сервер лише проносить його
            далі, не інтерпретує. */}
        {anchor && <input type="hidden" name="anchor" value={anchor} />}

        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Назва</label>
          <input
            name="title"
            required
            className={`${INPUT_BORDER} px-3 py-2 text-base font-medium`}
          />
        </div>

        <TaskConfigFields
          scenes={scenes ?? []}
          sceneVocab={sceneVocab}
          productType={product?.type}
          materialId={materialId}
          taskGroupId={taskGroupId}
          initialDelfSection={delfSection}
          initialDelfTestNumber={delfTestNumber ? Number(delfTestNumber) : undefined}
        />

        {/* Той самий sticky-трюк, що в SaveForm (sticky=true) — тут окремо,
            бо ця форма редіректить (createTask), а не useActionState. */}
        <div className="sticky bottom-0 -mx-4 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-1px_3px_rgba(0,0,0,0.1)] dark:border-neutral-800 dark:bg-neutral-950">
          <SubmitButton
            pendingChildren="Створюю..."
            className={`self-start ${BUTTON_PRIMARY_LG}`}
          >
            Створити
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
