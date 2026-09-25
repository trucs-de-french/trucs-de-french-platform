import Link from "next/link";
import { Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  updateSceneTitle,
  updateSceneVideo,
  updateSceneDialogue,
  addLink,
} from "@/app/admin/scenes/actions";
import {
  updateSceneContentBlock,
  updateScriptContentBlock,
  deleteSceneContentBlock,
} from "@/app/admin/scene-content-blocks/actions";
import {
  attachTaskGroupToContentBlock,
  attachTaskToGroup,
  deleteTaskGroup,
} from "@/app/admin/task-groups/actions";
import { fetchGroupMemberTasks, resolveGroupMaxPoints } from "@/app/admin/block-points";
import { SaveForm } from "@/components/save-form";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmForm } from "@/components/confirm-form";
import { DialogueEditor } from "./dialogue-editor";
import { DialogueStateProvider } from "./dialogue-state";
import { VocabTable } from "./vocab-table";
import { SceneBlockList } from "./scene-block-list";
import { blockDomId } from "@/lib/block-dom-id";
import { SceneStickyActions } from "./scene-sticky-actions";
import { TaskDragList } from "./task-drag-list";
import { LinkDragList } from "./link-drag-list";
import { AddLinkForm } from "./add-link-form";
import { GroupMemberDragList } from "../../task-groups/group-member-drag-list";
import { ContentBlockFields } from "../../scene-content-blocks/content-block-fields";
import { BUTTON_SECONDARY, BUTTON_DANGER } from "@/lib/button-styles";
import { INPUT_BORDER } from "@/lib/input-styles";
import { ADMIN_PAGE_TITLE, BREADCRUMB_LINK, LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";
import { pluralizePoints } from "@/lib/pluralize-points";

// Українська плюралізація "вправу/вправи/вправ" (знахідний відмінок —
// "прикріплено N вправ(у)") для тексту підтвердження видалення content-
// блоку з прикріпленими вправами — той самий mod10/mod100 принцип, що вже
// pluralizePoints, лише для іншого слова, не варте окремого спільного файлу
// заради єдиного місця вжитку.
function pluralizeExercisesAccusative(n: number): "вправу" | "вправи" | "вправ" {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "вправу";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "вправи";
  return "вправ";
}

type SceneBlockType = "video" | "script" | "link" | "task" | "vocab";
const DEFAULT_BLOCK_ORDER: SceneBlockType[] = ["video", "script", "vocab", "link", "task"];
const BLOCK_LABELS: Record<SceneBlockType, string> = {
  video: "Відео",
  script: "Скрипт",
  link: "Практика",
  task: "Завдання",
  vocab: "Вокабуляр",
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

  const [
    { data: links },
    { data: tasks },
    { data: taskGroups },
    { data: blocks, error: blocksError },
    { data: contentBlocks },
  ] = await Promise.all([
    supabase
      .from("scene_links")
      .select("id, platform, url, label")
      .eq("scene_id", sceneId)
      .order("order_index"),
    supabase
      .from("tasks")
      .select("id, type, title, config, order_index")
      .eq("scene_id", sceneId)
      .order("order_index"),
    supabase
      .from("task_groups")
      .select("id, title, content_type, points_mode, flat_points, order_index")
      .eq("scene_id", sceneId)
      .order("order_index"),
    supabase
      .from("scene_blocks")
      .select("block_type, ref_id")
      .eq("scene_id", sceneId)
      .order("position")
      .returns<{ block_type: SceneBlockType | "content"; ref_id: string | null }[]>(),
    // Крок 2: сам порядок (включно з довільними content-блоками) визначає
    // scene_blocks вище, ref_id -> id тут; order за created_at — лише для
    // фолбек-гілки нижче (коли scene_blocks порожній/впав).
    supabase
      .from("scene_content_blocks")
      .select("id, title, content_type, content_text, media_url, media_provider, dialogue")
      .eq("scene_id", sceneId)
      .order("created_at"),
  ]);

  if (blocksError) {
    // раніше ця помилка мовчки ховалась за фолбеком DEFAULT_BLOCK_ORDER —
    // адмінка виглядала робочою, хоча реальний запит увесь час падав.
    console.error(
      `Не вдалося завантажити scene_blocks для сцени ${sceneId}:`,
      blocksError.message
    );
  }

  // Максимум балів блоку (для бейджа поруч із назвою) — той самий принцип,
  // що на флет-списку курсу й сторінці матеріалу.
  const memberTasksByGroup = await fetchGroupMemberTasks(
    supabase,
    (taskGroups ?? []).map((g) => g.id)
  );

  // Задачі й блоки ділять одну спільну послідовність order_index у межах
  // сцени (task-order.ts) — зливаємо їх в один список для TaskDragList,
  // той самий принцип, що вже на флет-списку курсу й сторінці матеріалу
  // (admin/courses/[id]/page.tsx, materials/[materialId]/page.tsx).
  type SceneRow =
    | {
        kind: "task";
        id: string;
        type: string;
        title: string;
        config: Record<string, unknown> | null;
        order_index: number;
      }
    | {
        kind: "group";
        id: string;
        title: string | null;
        content_type: string;
        order_index: number;
        maxPoints: number;
      };
  const sceneRows: SceneRow[] = [
    ...(tasks ?? []).map((t): SceneRow => ({ kind: "task", ...t })),
    ...(taskGroups ?? []).map(
      (g): SceneRow => ({
        kind: "group",
        ...g,
        maxPoints: resolveGroupMaxPoints(g, memberTasksByGroup[g.id] ?? []),
      })
    ),
  ].sort((a, b) => a.order_index - b.order_index);

  const contentBlocksById = new Map((contentBlocks ?? []).map((b) => [b.id, b]));

  // Посилання для додаткових блоків типу 'links' — не в тому самому запиті,
  // що фіксована Практика (content_block_id null): той самий принцип
  // пакетного підвантаження, що вже groupMembers/membersByGroup вище.
  const linksBlockIds = (contentBlocks ?? [])
    .filter((b) => b.content_type === "links")
    .map((b) => b.id);
  const { data: blockLinks } =
    linksBlockIds.length > 0
      ? await supabase
          .from("scene_links")
          .select("id, platform, url, label, content_block_id")
          .in("content_block_id", linksBlockIds)
          .order("order_index")
      : { data: null };
  const linksByBlockId = new Map<string, NonNullable<typeof blockLinks>>();
  for (const link of blockLinks ?? []) {
    if (!link.content_block_id) continue;
    const arr = linksByBlockId.get(link.content_block_id) ?? [];
    arr.push(link);
    linksByBlockId.set(link.content_block_id, arr);
  }

  // Опційно прикріплений набір вправ (0040) — будь-який content-блок може
  // мати щонайбільше один такий task_group (unique partial index), той
  // самий батьківський домен, що вже задачі "Завдання", лише інше
  // батьківство (scene_content_block_id, не scene_id).
  const contentBlockIds = (contentBlocks ?? []).map((b) => b.id);
  const { data: attachedGroups } =
    contentBlockIds.length > 0
      ? await supabase
          .from("task_groups")
          .select("id, scene_content_block_id, points_mode, flat_points")
          .in("scene_content_block_id", contentBlockIds)
      : { data: null };
  const attachedGroupByContentBlockId = new Map(
    (attachedGroups ?? [])
      .filter((g) => g.scene_content_block_id)
      .map((g) => [g.scene_content_block_id as string, g])
  );
  // Одним запитом — і повний список членів (id/type/title, для
  // GroupMemberDragList), і дані для resolveGroupMaxPoints (type/config) —
  // не fetchGroupMemberTasks (block-points.ts), той вибирає лише
  // type/config, без id/title, тут потрібні обидва набори полів разом.
  const attachedGroupIds = (attachedGroups ?? []).map((g) => g.id);
  const { data: attachedGroupMembers } =
    attachedGroupIds.length > 0
      ? await supabase
          .from("tasks")
          .select("id, type, title, config, task_group_id")
          .in("task_group_id", attachedGroupIds)
          .order("order_index")
      : { data: null };
  const membersByAttachedGroupId = new Map<
    string,
    { id: string; type: string; title: string; config: Record<string, unknown> | null }[]
  >();
  for (const m of attachedGroupMembers ?? []) {
    if (!m.task_group_id) continue;
    const arr = membersByAttachedGroupId.get(m.task_group_id) ?? [];
    arr.push({ id: m.id, type: m.type, title: m.title, config: m.config });
    membersByAttachedGroupId.set(m.task_group_id, arr);
  }
  // Кандидати "+ Наявна задача" для будь-якого прикріпленого блоку — вільні
  // задачі ЦІЄЇ Ж сцени (той самий список, що вже sceneRows нижче будує з
  // tasks); окремого запиту не треба.
  const freeSceneTaskCandidates = (tasks ?? []).map((t) => ({ id: t.id, type: t.type, title: t.title }));

  type BlockEntry = { type: string; refId: string | null; label: string; contentType?: string };

  const orderedBlockRows: { block_type: SceneBlockType | "content"; ref_id: string | null }[] =
    blocks && blocks.length > 0
      ? blocks
      : DEFAULT_BLOCK_ORDER.map((type) => ({ block_type: type, ref_id: null }));

  const sceneBlocks: BlockEntry[] = orderedBlockRows.map((row) => {
    if (row.block_type === "content") {
      const content = row.ref_id ? contentBlocksById.get(row.ref_id) : undefined;
      return {
        type: "content",
        refId: row.ref_id,
        label: content?.title || "Додатковий блок",
        contentType: content?.content_type,
      };
    }
    return { type: row.block_type, refId: null, label: BLOCK_LABELS[row.block_type] };
  });

  // 'video' може ще не мати рядка в scene_blocks (з'являється лише коли
  // заповнено URL) — але поле для введення URL має бути видиме й
  // перетягувано в адмінці завжди, тому додаємо його в кінець, якщо нема.
  if (!sceneBlocks.some((b) => b.type === "video")) {
    sceneBlocks.push({ type: "video", refId: null, label: "Відео" });
  }

  const videoContent = (
    <SaveForm
      key="video"
      id="scene-video-form"
      action={updateSceneVideo.bind(null, sceneId)}
      className="flex flex-col gap-4"
      saveButtonStyle="secondary"
    >
      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <label className={LABEL_TEXT}>URL відео</label>
          <input
            name="video_url"
            defaultValue={scene.video_url ?? ""}
            className={`${INPUT_BORDER} px-3 py-2`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Джерело</label>
          <select
            name="video_provider"
            defaultValue={scene.video_provider ?? "youtube"}
            className={`${INPUT_BORDER} px-3 py-2`}
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
      id="scene-script-form"
      action={updateSceneDialogue.bind(null, sceneId)}
      saveLabel="Зберегти скрипт і вокабуляр"
      className="flex flex-col gap-2"
      saveButtonStyle="secondary"
    >
      <DialogueEditor />
    </SaveForm>
  );

  // Немає власної форми/кнопки збереження: мутує ТОЙ САМИЙ lines-стан, що
  // й DialogueEditor вище (спільний DialogueStateProvider навколо
  // SceneBlockList нижче) — зберігається разом зі "Скрипт", без другого
  // незалежного знімка dialogue, що міг би мовчки перезаписати перший.
  const vocabContent = (
    <div key="vocab" className="flex flex-col gap-2">
      <VocabTable />
      <p className={HINT_TEXT}>Зберігається разом зі &quot;Скрипт&quot;.</p>
    </div>
  );

  const linkContent = (
    <div key="link">
      <LinkDragList
        key={links?.map((l) => l.id).join(",") ?? ""}
        sceneId={sceneId}
        initialLinks={links ?? []}
      />

      <div className="mt-3">
        <AddLinkForm action={addLink.bind(null, sceneId, null)} />
      </div>
    </div>
  );

  const taskContent = (
    <div key="task">
      <div className="flex items-center justify-end gap-2">
        <Link
          href={`/admin/courses/${productId}/task-groups/new?sceneId=${sceneId}`}
          className={BUTTON_SECONDARY}
        >
          + Блок
        </Link>
        <Link
          href={`/admin/courses/${productId}/tasks/new?sceneId=${sceneId}&anchor=${blockDomId("task")}`}
          className={BUTTON_SECONDARY}
        >
          + Нове завдання
        </Link>
      </div>

      <div className="mt-2">
        <TaskDragList
          key={sceneRows.map((r) => r.id).join(",")}
          sceneId={sceneId}
          productId={productId}
          initialRows={sceneRows}
        />
      </div>
    </div>
  );

  const contentByKey: Record<string, React.ReactNode> = {
    video: videoContent,
    script: scriptContent,
    link: linkContent,
    task: taskContent,
    vocab: vocabContent,
  };

  // Інлайн-редагування контент-блоку прямо в SceneBlockList (Крок 2) — та
  // сама форма полів, що на своїй окремій сторінці не так давно, просто
  // рендериться тут, у своєї картки в спільному drag-списку. 'script'/
  // 'links' — геть інший редактор (DialogueEditor/LinkDragList), не
  // ContentBlockFields — фактичний вміст лежить не в content_text/media_url.
  for (const block of sceneBlocks) {
    if (block.type !== "content" || !block.refId) continue;
    const content = contentBlocksById.get(block.refId);
    if (!content) continue;

    let editor: React.ReactNode;
    if (content.content_type === "script") {
      editor = (
        <SaveForm
          action={updateScriptContentBlock.bind(null, productId, sceneId, block.refId)}
          className="flex flex-col gap-2"
          saveButtonStyle="secondary"
        >
          {/* Незалежний dialogue цього конкретного додаткового блоку — своя
              окрема ізоляція, НЕ спільна з "Вокабуляром" (той агрегує лише
              scene.dialogue, не dialogue додаткових script-блоків). */}
          <DialogueStateProvider initialDialogue={content.dialogue ?? []}>
            <DialogueEditor />
          </DialogueStateProvider>
        </SaveForm>
      );
    } else if (content.content_type === "links") {
      editor = (
        <div>
          <LinkDragList
            key={(linksByBlockId.get(block.refId) ?? []).map((l) => l.id).join(",")}
            sceneId={sceneId}
            initialLinks={linksByBlockId.get(block.refId) ?? []}
          />
          <div className="mt-3">
            <AddLinkForm action={addLink.bind(null, sceneId, block.refId)} />
          </div>
        </div>
      );
    } else {
      editor = (
        <SaveForm
          action={updateSceneContentBlock.bind(null, productId, sceneId, block.refId)}
          className="flex flex-col gap-4"
          saveButtonStyle="secondary"
        >
          <ContentBlockFields initialBlock={content} />
        </SaveForm>
      );
    }

    // Опційний прикріплений набір вправ (0040) — будь-який тип content-
    // блоку може мати щонайбільше один такий task_group.
    const attachedGroup = attachedGroupByContentBlockId.get(block.refId);
    const exercisesSection = attachedGroup ? (
      <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 dark:border-neutral-700">
        <div className="flex items-center justify-between">
          <span className={`uppercase ${HINT_TEXT}`}>
            Вправи блоку
            {(() => {
              const maxPoints = resolveGroupMaxPoints(
                attachedGroup,
                membersByAttachedGroupId.get(attachedGroup.id) ?? []
              );
              return maxPoints > 0 ? ` · ${maxPoints} ${pluralizePoints(maxPoints)}` : "";
            })()}
          </span>
          <Link
            href={`/admin/courses/${productId}/tasks/new?taskGroupId=${attachedGroup.id}&anchor=${blockDomId(`content:${block.refId}`)}`}
            className={BUTTON_SECONDARY}
          >
            + Нова задача
          </Link>
        </div>

        <GroupMemberDragList
          key={(membersByAttachedGroupId.get(attachedGroup.id) ?? []).map((t) => t.id).join(",")}
          groupId={attachedGroup.id}
          productId={productId}
          initialMembers={membersByAttachedGroupId.get(attachedGroup.id) ?? []}
          sceneId={sceneId}
        />

        {freeSceneTaskCandidates.length > 0 && (
          <form action={attachTaskToGroup} className="flex items-center gap-2">
            <input type="hidden" name="task_group_id" value={attachedGroup.id} />
            <select
              name="task_id"
              required
              defaultValue=""
              className={`${INPUT_BORDER} flex-1 px-2 py-2 text-sm`}
            >
              <option value="" disabled>
                — обрати наявну задачу сцени —
              </option>
              {freeSceneTaskCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.type}] {c.title}
                </option>
              ))}
            </select>
            <SubmitButton pendingChildren="Додаю..." className={BUTTON_SECONDARY}>
              Додати до блоку
            </SubmitButton>
          </form>
        )}

        <ConfirmForm
          action={deleteTaskGroup.bind(null, attachedGroup.id)}
          message="Вправи блоку буде відкріплено — вони НЕ видаляться, повернуться у звичайний список Завдань сцени. Продовжити?"
        >
          <SubmitButton pendingChildren="..." className="self-start text-sm text-red-600 hover:underline dark:text-red-400">
            Видалити вправи блоку
          </SubmitButton>
        </ConfirmForm>
      </div>
    ) : (
      <form
        action={attachTaskGroupToContentBlock.bind(null, productId, sceneId, block.refId)}
        className="border-t border-gray-100 pt-3 dark:border-neutral-700"
      >
        <SubmitButton pendingChildren="Додаю..." className={BUTTON_SECONDARY}>
          + Додати вправи до цього блоку
        </SubmitButton>
      </form>
    );

    // Скільки вправ прикріплено (якщо є група) — попереджаємо в тексті
    // підтвердження ЛИШЕ коли є що відкріпляти; для порожньої групи (чи
    // взагалі без групи) звичайний текст без згадки вправ — деталь про
    // "видаляться разом" тут зайва, порожню групу дійсно видаляє каскад.
    const attachedMemberCount = attachedGroup
      ? (membersByAttachedGroupId.get(attachedGroup.id) ?? []).length
      : 0;
    const deleteBlockMessage =
      attachedMemberCount > 0
        ? `До блоку прикріплено ${attachedMemberCount} ${pluralizeExercisesAccusative(attachedMemberCount)} — вони НЕ видаляться, повернуться у звичайний список завдань сцени. Видалити блок? Цю дію не можна скасувати.`
        : "Видалити цей блок? Цю дію не можна скасувати.";

    contentByKey[`content:${block.refId}`] = (
      <div className="flex flex-col gap-3">
        {editor}
        {exercisesSection}
        <ConfirmForm
          action={deleteSceneContentBlock.bind(null, productId, sceneId, block.refId)}
          message={deleteBlockMessage}
        >
          <SubmitButton
            pendingChildren="Видаляю..."
            className={`inline-flex items-center gap-1.5 self-start ${BUTTON_DANGER}`}
          >
            <Trash2 size={16} />
            Видалити блок
          </SubmitButton>
        </ConfirmForm>
      </div>
    );
  }

  return (
    <div>
      <Link href={`/admin/courses/${productId}`} className={BREADCRUMB_LINK}>
        ← До курсу
      </Link>
      <h1 className={`mt-2 ${ADMIN_PAGE_TITLE}`}>Редагування сцени</h1>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <SaveForm
        id="scene-title-form"
        action={updateSceneTitle.bind(null, sceneId)}
        saveLabel="Зберегти назву"
        saveButtonStyle="secondary"
        className="mt-4 flex flex-col gap-1 rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
      >
        <label className={LABEL_TEXT}>Назва сцени</label>
        <input
          name="title"
          defaultValue={scene.title}
          required
          className={`${INPUT_BORDER} px-3 py-2`}
        />
      </SaveForm>

      <div className="mt-6">
        <DialogueStateProvider initialDialogue={scene.dialogue ?? []}>
          <SceneBlockList
            key={sceneBlocks.map((b) => b.refId ?? b.type).join(",")}
            sceneId={sceneId}
            initialBlocks={sceneBlocks}
            contentByKey={contentByKey}
          />
        </DialogueStateProvider>
      </div>

      <div className="mt-2">
        <Link
          href={`/admin/courses/${productId}/scene-content-blocks/new?sceneId=${sceneId}`}
          className={BUTTON_SECONDARY}
        >
          + Додати блок
        </Link>
      </div>

      <SceneStickyActions productId={productId} sceneId={sceneId} />
    </div>
  );
}
