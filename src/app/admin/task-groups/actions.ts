"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import type { ActionState } from "@/lib/action-state";
import { nextOrderIndex, findNeighbor, type ParentScope } from "@/app/admin/task-order";

// Перед додаванням нової мутуючої дії сюди — дивись чеклист
// "redirect() vs revalidatePath() vs {ok,error}" на початку
// ../scenes/actions.ts.

type Supa = Awaited<ReturnType<typeof createClient>>;

type GroupParent = { product_id: string; scene_id: string | null; material_id: string | null };

// Куди повертатись для блоку з даним батьківським контекстом — блок сам
// несе scene_id/material_id (на відміну від задачі всередині нього), тож,
// на відміну від resolveTaskParentPath у ../tasks/actions.ts, підвантажувати
// нічого не треба.
function resolveGroupParentPath(group: GroupParent): string {
  if (group.scene_id) return `/admin/courses/${group.product_id}/scenes/${group.scene_id}`;
  if (group.material_id) return `/admin/courses/${group.product_id}/materials/${group.material_id}`;
  return `/admin/courses/${group.product_id}`;
}

// media_audio_file_url — приховане поле AudioFileUpload (client-side
// завантаження напряму в Storage, вже ЗАВЕРШЕНЕ до сабміту форми; тут лише
// читаємо готовий рядок, жодного завантаження на сервері більше немає).
// Якщо заповнене — перекриває text-поле media_url незалежно від того, що
// там вписано (додатковий, не єдиний спосіб — text-поле лишається робочим,
// якщо файл не обрано). media_provider ПРИМУСОВО null у цьому випадку —
// інакше, якщо вчитель раніше лишив селектор платформи на "youtube"/
// "gdrive", а тепер завантажив файл у Storage, TaskGroupBlock спробував би
// вбудувати supabase.co URL як youtube/gdrive iframe.
function buildContentFields(formData: FormData) {
  const contentType = (formData.get("content_type") as string) || "text";
  const uploadedUrl = (formData.get("media_audio_file_url") as string) || "";
  const mediaUrl =
    contentType === "audio" && uploadedUrl
      ? uploadedUrl
      : contentType !== "text"
        ? (formData.get("media_url") as string) || null
        : null;
  const mediaProvider =
    contentType === "audio" && uploadedUrl
      ? null
      : contentType === "video" || contentType === "audio"
        ? (formData.get("media_provider") as string) || null
        : null;

  return {
    content_type: contentType,
    content_text:
      contentType === "text"
        ? sanitizeInstructionsHtml((formData.get("content_text") as string) || "")
        : null,
    media_url: mediaUrl,
    media_provider: mediaProvider,
  };
}

function buildPointsFields(formData: FormData) {
  const pointsMode = (formData.get("points_mode") as string) || "sum";
  const flatPointsRaw = formData.get("flat_points") as string | null;
  return {
    points_mode: pointsMode,
    flat_points: pointsMode === "flat" && flatPointsRaw ? Number(flatPointsRaw) : null,
  };
}

export async function createTaskGroup(formData: FormData) {
  const supabase = await createClient();

  const productId = formData.get("product_id") as string;
  const sceneId = (formData.get("scene_id") as string) || null;
  const materialId = (formData.get("material_id") as string) || null;
  const delfSection = (formData.get("delf_section") as string) || null;
  const delfTestNumber = formData.get("delf_test_number")
    ? Number(formData.get("delf_test_number"))
    : null;
  const title = (formData.get("title") as string) || null;

  const orderIndex = await nextOrderIndex(supabase, {
    productId,
    sceneId,
    materialId,
    taskGroupId: null,
    delfSection,
    delfTestNumber,
  });

  const { data: group, error } = await supabase
    .from("task_groups")
    .insert({
      product_id: productId,
      scene_id: sceneId,
      material_id: materialId,
      delf_section: delfSection,
      delf_test_number: delfTestNumber,
      title,
      order_index: orderIndex,
      ...buildContentFields(formData),
      ...buildPointsFields(formData),
    })
    .select()
    .single();

  if (error || !group) throw error;

  // Не resolveGroupParentPath (батьківський контекст — сцена/матеріал/курс)
  // — після створення блоку вчитель одразу додає в нього задачі, тож
  // лишаємось на сторінці самого нового блоку, а не відкидаємо назад туди,
  // звідки прийшли.
  redirect(`/admin/courses/${group.product_id}/task-groups/${group.id}`);
}

export async function updateTaskGroup(
  productId: string,
  groupId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();

  const title = (formData.get("title") as string) || null;

  const { error } = await supabase
    .from("task_groups")
    .update({
      title,
      ...buildContentFields(formData),
      ...buildPointsFields(formData),
    })
    .eq("id", groupId);

  if (error) return { ok: false, error: error.message };

  // Той самий трюк, що updateTask у ../tasks/actions.ts — без цього форма
  // не підхопить свіжі серверні пропи після сабміту (SaveForm/useActionState).
  revalidatePath(`/admin/courses/${productId}/task-groups/${groupId}`);

  return { ok: true };
}

// Повертає задачу в її батьківський контекст, звідки вона потрапила в блок
// (той самий scene_id/material_id/delf_section/delf_test_number, що на
// самому блоці) — викликається і з detachTask (одна задача), і з
// deleteTaskGroup (усі задачі блоку перед видаленням самого блоку, щоб не
// покладатись на on delete cascade й не губити авторський контент).
async function detachTaskFromGroup(supabase: Supa, taskId: string): Promise<void> {
  const { data: task } = await supabase
    .from("tasks")
    .select("task_group_id")
    .eq("id", taskId)
    .single();
  if (!task?.task_group_id) return;

  const { data: group } = await supabase
    .from("task_groups")
    .select("product_id, scene_id, material_id, delf_section, delf_test_number")
    .eq("id", task.task_group_id)
    .single();
  if (!group) return;

  const scope: ParentScope = {
    productId: group.product_id,
    sceneId: group.scene_id,
    materialId: group.material_id,
    taskGroupId: null,
    delfSection: group.delf_section,
    delfTestNumber: group.delf_test_number,
  };
  const orderIndex = await nextOrderIndex(supabase, scope);

  await supabase
    .from("tasks")
    .update({
      task_group_id: null,
      scene_id: group.scene_id,
      material_id: group.material_id,
      delf_section: group.delf_section,
      delf_test_number: group.delf_test_number,
      order_index: orderIndex,
    })
    .eq("id", taskId);
}

// "Прибрати з блоку" на одній задачі-члені — сама задача лишається, просто
// повертається туди, де живе сам блок (не видаляється, на відміну від
// deleteTask).
export async function detachTask(taskId: string) {
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("product_id, scene_id, material_id, task_group_id")
    .eq("id", taskId)
    .single();
  if (!task) return;

  let backPath = `/admin/courses/${task.product_id}`;
  if (task.task_group_id) {
    const { data: group } = await supabase
      .from("task_groups")
      .select("scene_id, material_id")
      .eq("id", task.task_group_id)
      .single();
    if (group) {
      backPath = resolveGroupParentPath({
        product_id: task.product_id,
        scene_id: group.scene_id,
        material_id: group.material_id,
      });
    }
  }

  await detachTaskFromGroup(supabase, taskId);

  redirect(backPath);
}

// Додати вже наявну "вільну" задачу того самого батьківського контексту до
// блоку — задача переходить під task_group_id, її власні
// scene_id/material_id/delf_section/delf_test_number обнуляються
// (успадковує їх від групи, як і будь-яка інша задача всередині блоку).
// Спільна мутація для обох способів виклику нижче — форми (сторінка
// блоку) і прямого клієнтського виклику (drag-to-attach у TaskDragList).
// Перевіряє error і кількість РЕАЛЬНО оновлених рядків (чекліст
// ../scenes/actions.ts) — оригінальна версія цього не робила, RLS міг би
// мовчки заблокувати запис без жодної помітної ознаки.
async function attachTaskCore(
  supabase: Supa,
  taskId: string,
  taskGroupId: string
): Promise<{ ok: boolean; error?: string; group?: GroupParent }> {
  if (!taskId || !taskGroupId) return { ok: false, error: "Не вказано задачу або блок" };

  const { data: group } = await supabase
    .from("task_groups")
    .select("product_id, scene_id, material_id")
    .eq("id", taskGroupId)
    .single();
  if (!group) return { ok: false, error: "Блок не знайдено" };

  const orderIndex = await nextOrderIndex(supabase, {
    productId: group.product_id,
    sceneId: null,
    materialId: null,
    taskGroupId,
  });

  const { data, error } = await supabase
    .from("tasks")
    .update({
      task_group_id: taskGroupId,
      scene_id: null,
      material_id: null,
      delf_section: null,
      delf_test_number: null,
      order_index: orderIndex,
    })
    .eq("id", taskId)
    .select("id");

  if (error || !data?.length) {
    return { ok: false, error: error?.message ?? "Не вдалося прикріпити задачу до блоку" };
  }

  return { ok: true, group };
}

// Виклик через <form action> (пікер на сторінці блоку) — навігація на ту
// саму сторінку блоку після додавання, той самий сценарій 2 з чекліста
// ../scenes/actions.ts (redirect на ту саму сторінку — досить).
export async function attachTaskToGroup(formData: FormData) {
  const supabase = await createClient();
  const taskId = formData.get("task_id") as string;
  const taskGroupId = formData.get("task_group_id") as string;

  const result = await attachTaskCore(supabase, taskId, taskGroupId);
  if (!result.ok || !result.group) return;

  // Сторінка САМОГО блоку (не resolveGroupParentPath — той веде на
  // батьківський контекст блоку, правильно для detachTask/deleteTaskGroup,
  // де рядок ПОКИДАЄ поточний контекст, але не тут: пікер живе на сторінці
  // блоку, і додавання задачі не повинно нікуди "виносити" вчителя).
  redirect(`/admin/courses/${result.group.product_id}/task-groups/${taskGroupId}`);
}

// Прямий виклик з клієнта (drag-to-attach у TaskDragList на сторінці
// сцени) — сценарій 4 з чекліста: дія викликається НЕ через <form>, тож
// redirect()/revalidatePath() не допоможуть (клієнтський useState їх не
// побачить) — повертає {ok, error}, компонент сам прибирає рядок задачі
// зі свого локального списку (вона й справді покидає плаский список
// сцени, ставши членом блоку).
export async function attachTaskInline(
  taskId: string,
  taskGroupId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const result = await attachTaskCore(supabase, taskId, taskGroupId);
  return { ok: result.ok, error: result.error };
}

// Кнопка "Копіювати" на сторінці блоку (GroupMemberDragList) — фіксоване
// призначення "той самий блок", без пікера scene/material/DELF (на
// відміну від copyTask у ../tasks/actions.ts, який веде на окрему сторінку
// вибору). Викликається напряму з клієнта (GroupMemberDragList керує
// власним members-станом), тож {ok,error}, не redirect — той самий
// сценарій 4 чекліста, що вже attachTaskInline/reorderGroupMembers.
// Повертає щойно створений рядок (id/type/title), щоб компонент одразу
// вставив копію у свій локальний список без перезавантаження сторінки.
export async function copyTaskInGroup(
  taskId: string,
  taskGroupId: string
): Promise<{ ok: boolean; error?: string; task?: { id: string; type: string; title: string } }> {
  const supabase = await createClient();

  const { data: newTaskId, error } = await supabase.rpc("copy_task", {
    p_task_id: taskId,
    p_task_group_id: taskGroupId,
  });
  if (error || !newTaskId) {
    return { ok: false, error: error?.message ?? "Не вдалося скопіювати задачу" };
  }

  const { data: newTask, error: fetchError } = await supabase
    .from("tasks")
    .select("id, type, title")
    .eq("id", newTaskId)
    .single();
  if (fetchError || !newTask) {
    return { ok: false, error: fetchError?.message ?? "Задачу скопійовано, але не вдалося її завантажити" };
  }

  return { ok: true, task: newTask };
}

// Видалення блоку НЕ видаляє його задачі (не покладаємось на схемний
// on delete cascade, який є лише запобіжником) — спершу повертає кожну з
// них у батьківський контекст блоку, той самий шлях, що detachTask.
export async function deleteTaskGroup(groupId: string) {
  const supabase = await createClient();
  const { data: group } = await supabase
    .from("task_groups")
    .select("product_id, scene_id, material_id")
    .eq("id", groupId)
    .single();
  if (!group) return;

  const backPath = resolveGroupParentPath(group);

  const { data: members } = await supabase.from("tasks").select("id").eq("task_group_id", groupId);
  for (const member of members ?? []) {
    await detachTaskFromGroup(supabase, member.id);
  }

  const { error } = await supabase.from("task_groups").delete().eq("id", groupId);
  if (error) {
    redirect(`${backPath}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(backPath);
}

export async function moveTaskGroup(groupId: string, direction: "up" | "down") {
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("task_groups")
    .select("id, product_id, scene_id, material_id, delf_section, delf_test_number, order_index")
    .eq("id", groupId)
    .single();
  if (!group) return;

  const neighbor = await findNeighbor(
    supabase,
    {
      productId: group.product_id,
      sceneId: group.scene_id,
      materialId: group.material_id,
      taskGroupId: null,
      delfSection: group.delf_section,
      delfTestNumber: group.delf_test_number,
    },
    group.order_index,
    direction
  );
  if (!neighbor) return;

  const backPath = resolveGroupParentPath(group);

  const { data: updated1, error: error1 } = await supabase
    .from("task_groups")
    .update({ order_index: neighbor.order_index })
    .eq("id", group.id)
    .select("id");
  const { data: updated2, error: error2 } = await supabase
    .from(neighbor.kind === "task" ? "tasks" : "task_groups")
    .update({ order_index: group.order_index })
    .eq("id", neighbor.id)
    .select("id");

  const error = error1 ?? error2;
  if (error || !updated1?.length || !updated2?.length) {
    redirect(
      `${backPath}?error=${encodeURIComponent(error?.message ?? "Не вдалося змінити порядок блоків")}`
    );
  }

  redirect(backPath);
}

// Drag-and-drop у списку членів блоку (GroupMemberDragList) — той самий
// принцип, що reorderSceneRows на сторінці сцени, але простіше: усередині
// блоку лише задачі (блоки не вкладаються одне в одне), тож без розгалуження
// по таблицях. Викликається напряму з клієнта (не через <form>), тож
// {ok,error}, не redirect — та сама причина, що вже й у reorderSceneRows/
// attachTaskInline (клієнтський useState не побачив би ні redirect, ні
// revalidatePath). .eq("task_group_id", groupId) на кожному UPDATE —
// захист від застарілого/підробленого списку id з клієнта.
export async function reorderGroupMembers(
  groupId: string,
  orderedTaskIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const results = await Promise.all(
    orderedTaskIds.map(async (taskId, index) => {
      const { data, error } = await supabase
        .from("tasks")
        .update({ order_index: index })
        .eq("id", taskId)
        .eq("task_group_id", groupId)
        .select("id");
      return { id: taskId, error, affected: data?.length ?? 0 };
    })
  );

  const dbError = results.find((r) => r.error)?.error;
  if (dbError) {
    console.error(`reorderGroupMembers: помилка запису для блоку ${groupId}:`, dbError.message);
    return { ok: false, error: dbError.message };
  }

  const missing = results.filter((r) => r.affected === 0);
  if (missing.length > 0) {
    console.error(
      `reorderGroupMembers: 0 рядків оновлено для ${missing.map((r) => r.id).join(", ")} у блоці ${groupId}.`
    );
    return { ok: false, error: "Не вдалося зберегти порядок частини списку" };
  }

  return { ok: true };
}
