"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";
import { nextOrderIndex, findNeighbor } from "@/app/admin/task-order";
import { blockDomId } from "@/lib/block-dom-id";
import { generateTaskTitle } from "@/lib/exercises/task-title";
import { buildTaskConfig } from "@/lib/exercises/task-config-builder";
import { TASK_TYPES_WITH_VISIBLE_TITLE } from "@/lib/exercises/task-type-meta";

// Перед додаванням нової мутуючої дії сюди — дивись чеклист
// "redirect() vs revalidatePath() vs {ok,error}" на початку
// ../scenes/actions.ts. Найчастіша причина "зберіглось, але не видно без
// F5" — саме пропущений крок із цього чеклиста.

// task_audio_file_url — приховане поле FileUpload (kind="audio",
// client-side завантаження напряму в R2, вже завершене до сабміту форми) —
// перекриває task_audio_url (текстове поле), якщо файл обрано. Синхронна:
// жодного завантаження на сервері тут більше немає.
function resolveAudioUrl(formData: FormData): string | null {
  const uploadedUrl = (formData.get("task_audio_file_url") as string) || "";
  return uploadedUrl || (formData.get("task_audio_url") as string) || null;
}

// Той самий принцип, що resolveAudioUrl — task_image_file_url (FileUpload
// kind="image") перекриває task_image_url (текстове поле), якщо файл обрано.
function resolveImageUrl(formData: FormData): string | null {
  const uploadedUrl = (formData.get("task_image_file_url") as string) || "";
  return uploadedUrl || (formData.get("task_image_url") as string) || null;
}

// Автоназва — єдине місце для обох сценаріїв (створення й оновлення):
// - назва порожня -> генерується з (нового) config;
// - назва саме та, що generateTaskTitle дала б зі СТАРОГО config
//   (previous) -> вчителька її не міняла руками, перегенеровуємо з нового
//   config, щоб назва не застаріла після редагування слів/речень;
// - будь-яка інша назва -> ручна, не чіпаємо.
// Типи з видимою студенту назвою (TASK_TYPES_WITH_VISIBLE_TITLE —
// link/embed/game) взагалі не проходять через цю функцію — там назва
// лишається обов'язковим/ручним полем, як і раніше (виклик пропускається
// на рівні createTask/updateTask нижче).
function resolveTaskTitle(
  rawTitle: string,
  type: string,
  config: Record<string, unknown>,
  previous?: { title: string; type: string; config: Record<string, unknown> | null }
): string {
  if (TASK_TYPES_WITH_VISIBLE_TITLE.includes(type)) return rawTitle;

  const trimmed = rawTitle.trim();
  if (!trimmed) return generateTaskTitle(type, config);

  if (previous && trimmed === generateTaskTitle(previous.type, previous.config ?? {})) {
    return generateTaskTitle(type, config);
  }

  return rawTitle;
}

async function syncGameRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
  type: string,
  formData: FormData
) {
  if (type !== "game") {
    await supabase.from("games").delete().eq("task_id", taskId);
    return;
  }

  const { error } = await supabase.from("games").upsert({
    task_id: taskId,
    provider: (formData.get("game_provider") as string) || "internal",
    embed_url: (formData.get("game_embed_url") as string) || null,
    game_type: (formData.get("game_type") as string) || null,
  });

  if (error) throw error;
}

// Куди повертатись (редірект) для задачі з даним батьківським контекстом —
// спільна для createTask/moveTask/deleteTask, щоб не тримати ту саму
// 3-4-гілкову логіку в кожній окремо. Задача в блоці (task_group_id) сама
// має null scene_id/material_id (успадковує контекст від групи, див.
// 0031_task_groups.sql), тож для неї доводиться підвантажити батьківський
// контекст самої групи. Повертає й anchor — непрозорий id елемента, куди
// варто прокрутити (не в кожної гілки він є: плоскі сцена/матеріал/DELF-
// сторінки такого якоря на конкретну задачу не мають, лише сторінка блоку).
async function resolveTaskParentPath(
  supabase: Awaited<ReturnType<typeof createClient>>,
  task: {
    product_id: string;
    scene_id: string | null;
    material_id: string | null;
    task_group_id: string | null;
    delf_test_number?: number | null;
  }
): Promise<{ path: string; anchor: string | null }> {
  if (task.scene_id)
    return { path: `/admin/courses/${task.product_id}/scenes/${task.scene_id}`, anchor: null };
  if (task.material_id)
    return { path: `/admin/courses/${task.product_id}/materials/${task.material_id}`, anchor: null };
  if (task.task_group_id) {
    const { data: group } = await supabase
      .from("task_groups")
      .select("scene_id, material_id, delf_test_number, scene_content_block_id")
      .eq("id", task.task_group_id)
      .single();
    // Група, прикріплена до scene_content_block (0040) — керується інлайн
    // на сторінці сцени, не власною сторінкою; резолвимо scene_id через сам
    // content-блок і повертаємо якір на його картку (не на верх сторінки).
    if (group?.scene_content_block_id) {
      const { data: contentBlock } = await supabase
        .from("scene_content_blocks")
        .select("scene_id")
        .eq("id", group.scene_content_block_id)
        .single();
      if (contentBlock?.scene_id) {
        return {
          path: `/admin/courses/${task.product_id}/scenes/${contentBlock.scene_id}`,
          anchor: blockDomId(`content:${group.scene_content_block_id}`),
        };
      }
    }
    // Звичайна група (сцена/матеріал/DELF) має власну сторінку
    // /task-groups/[id] — саме туди, а не на батьківський контекст групи
    // (там і решта задач блоку), той самий принцип, що
    // resolveGroupHomePath у ../task-groups/actions.ts.
    return { path: `/admin/courses/${task.product_id}/task-groups/${task.task_group_id}`, anchor: null };
  }
  if (task.delf_test_number)
    return { path: `/admin/courses/${task.product_id}/tests/${task.delf_test_number}`, anchor: null };
  return { path: `/admin/courses/${task.product_id}`, anchor: null };
}

export async function createTask(formData: FormData) {
  const supabase = await createClient();

  const productId = formData.get("product_id") as string;
  const sceneId = (formData.get("scene_id") as string) || null;
  const materialId = (formData.get("material_id") as string) || null;
  // Задача, прив'язана до блоку (task_groups) — успадковує батьківський
  // контекст від групи, тож власні scene_id/material_id тут null (див.
  // коментар у 0031_task_groups.sql). Подається з форми "Нова задача",
  // відкритої зі сторінки блоку (?taskGroupId=...).
  const taskGroupId = (formData.get("task_group_id") as string) || null;
  const type = formData.get("type") as string;
  const config = buildTaskConfig(type, formData);
  const title = resolveTaskTitle((formData.get("title") as string) ?? "", type, config);
  const delfSection = (formData.get("delf_section") as string) || null;
  const delfTestNumber = formData.get("delf_test_number")
    ? Number(formData.get("delf_test_number"))
    : null;

  const orderIndex = await nextOrderIndex(supabase, {
    productId,
    sceneId,
    materialId,
    taskGroupId,
    delfSection,
    delfTestNumber,
  });

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      product_id: productId,
      scene_id: sceneId,
      material_id: materialId,
      task_group_id: taskGroupId,
      type,
      title,
      order_index: orderIndex,
      config,
      image_url: resolveImageUrl(formData),
      audio_url: resolveAudioUrl(formData),
      // Чекбокс рендериться лише для POINTS_SUPPORTED_TASK_TYPES
      // (TaskConfigFields, isPointsSupportedTaskType) — для решти типів
      // його нема у formData взагалі, тож тут коректно піде false.
      points_visible: formData.get("points_visible") === "true",
      // Присутні у formData лише коли батьківський продукт type='delf'
      // (TaskConfigFields рендерить ці селекти умовно) — для film-задач
      // просто null.
      delf_section: delfSection,
      delf_test_number: delfTestNumber,
    })
    .select()
    .single();

  if (error || !task) throw error;

  await syncGameRow(supabase, task.id, type, formData);

  const parent = await resolveTaskParentPath(supabase, {
    product_id: productId,
    scene_id: sceneId,
    material_id: materialId,
    task_group_id: taskGroupId,
    delf_test_number: delfTestNumber,
  });
  // anchor — непрозорий id блоку/секції, з якої прийшли (див. tasks/new/
  // page.tsx) — приносить redirect() назад саме туди, а не на верх
  // сторінки, і на сторінці сцени зберігає розгорнутим потрібний блок
  // акордеона (sessionStorage-стан у SceneBlockList не скидається окремо,
  // просто елемент з таким id уже опиняється в полі зору). Фолбек на
  // parent.anchor — на випадок, якщо викликач не передав власний (сторінка
  // блоку сама знає свій якір лише для content-block-групи).
  const anchor = (formData.get("anchor") as string) || parent.anchor;
  redirect(anchor ? `${parent.path}#${anchor}` : parent.path);
}

export async function updateTask(
  productId: string,
  taskId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();

  const type = formData.get("type") as string;
  const config = buildTaskConfig(type, formData);

  // Стара назва/тип/config — щоб відрізнити "вчителька лишила автоназву
  // незмінною" (перегенерувати з нового config) від "вчителька вписала
  // щось своє" (не чіпати) — resolveTaskTitle вище.
  const { data: previousTask } = await supabase
    .from("tasks")
    .select("title, type, config")
    .eq("id", taskId)
    .single();

  const title = resolveTaskTitle(
    (formData.get("title") as string) ?? "",
    type,
    config,
    previousTask
      ? { title: previousTask.title, type: previousTask.type, config: previousTask.config }
      : undefined
  );

  const { error } = await supabase
    .from("tasks")
    .update({
      type,
      title,
      config,
      image_url: resolveImageUrl(formData),
      audio_url: resolveAudioUrl(formData),
      points_visible: formData.get("points_visible") === "true",
      delf_section: (formData.get("delf_section") as string) || null,
      delf_test_number: formData.get("delf_test_number")
        ? Number(formData.get("delf_test_number"))
        : null,
    })
    .eq("id", taskId);

  if (error) return { ok: false, error: error.message };

  try {
    await syncGameRow(supabase, taskId, type, formData);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не вдалося зберегти гру" };
  }

  // Без цього — класична "зберіглось у базу, але не видно без F5" (див.
  // чеклист на початку ../scenes/actions.ts, сценарій 1: inline useActionState
  // + SaveForm, без навігації). Без свіжих серверних пропів TaskConfigFields
  // ніколи не перерендериться після сабміту (React пропускає це піддерево,
  // бо children-елемент лишається тим самим об'єктом), тож React 19 не встигає
  // повторно застосувати checked/value поверх свого ж native form.reset()
  // (useActionState скидає неконтрольовані поля форми при кожному сабміті).
  revalidatePath(`/admin/courses/${productId}/tasks/${taskId}`);

  return { ok: true };
}

export async function deleteTask(taskId: string) {
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("product_id, scene_id, material_id, task_group_id, delf_test_number")
    .eq("id", taskId)
    .single();
  if (!task) return;

  const parent = await resolveTaskParentPath(supabase, task);
  const backPath = parent.anchor ? `${parent.path}#${parent.anchor}` : parent.path;

  const { data: deleted, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .select("id");

  if (error || !deleted?.length) {
    redirect(
      `${parent.path}?error=${encodeURIComponent(error?.message ?? "Не вдалося видалити завдання")}${parent.anchor ? `#${parent.anchor}` : ""}`
    );
  }

  redirect(backPath);
}

export async function moveTask(taskId: string, direction: "up" | "down") {
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select(
      "id, product_id, scene_id, material_id, task_group_id, delf_section, delf_test_number, order_index"
    )
    .eq("id", taskId)
    .single();
  if (!task) return;

  // Сусід шукається серед задач І блоків того самого контексту (одна
  // спільна послідовність order_index, див. task-order.ts) — стрілка може
  // перемістити задачу повз сусідній блок, не лише повз іншу задачу.
  const neighbor = await findNeighbor(
    supabase,
    {
      productId: task.product_id,
      sceneId: task.scene_id,
      materialId: task.material_id,
      taskGroupId: task.task_group_id,
      delfSection: task.delf_section,
      delfTestNumber: task.delf_test_number,
    },
    task.order_index,
    direction
  );

  if (!neighbor) return;

  const { path: backPath } = await resolveTaskParentPath(supabase, task);

  const { data: updated1, error: error1 } = await supabase
    .from("tasks")
    .update({ order_index: neighbor.order_index })
    .eq("id", task.id)
    .select("id");
  const { data: updated2, error: error2 } = await supabase
    .from(neighbor.kind === "task" ? "tasks" : "task_groups")
    .update({ order_index: task.order_index })
    .eq("id", neighbor.id)
    .select("id");

  const error = error1 ?? error2;
  if (error || !updated1?.length || !updated2?.length) {
    redirect(
      `${backPath}?error=${encodeURIComponent(error?.message ?? "Не вдалося змінити порядок завдань")}`
    );
  }

  redirect(backPath);
}

// Drag-and-drop усередині групи "Завдання" — доповнює стрілки ↑/↓ (moveTask),
// не замінює їх. Викликається напряму з клієнтського компонента (не через
// <form>), тому — на відміну від moveTask — не редіректить, а повертає
// {ok, error}, щоб клієнт міг відкотити оптимістичний локальний порядок при
// невдачі. Перевіряє error і кількість реально змінених рядків на кожному
// UPDATE — той самий захист, якого спершу бракувало в reorderSceneBlocks.
// Задачі й блоки ділять один спільний перетягуваний список на сторінці
// сцени (TaskDragList) — оновлює order_index в ОБОХ таблицях за наданим
// порядком, а не лише tasks (звідси й генералізована назва замість
// колишньої reorderTasks — єдиний виклик цієї функції, той самий
// TaskDragList, тож нема сенсу тримати дві паралельні версії).
// .eq("scene_id", sceneId) на кожному UPDATE — захист від застарілого/
// підробленого списку id з клієнта: перезаписує лише рядки, що й справді
// належать цій сцені.
export async function reorderSceneRows(
  sceneId: string,
  orderedRows: { id: string; kind: "task" | "task_group" }[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const results = await Promise.all(
    orderedRows.map(async (row, index) => {
      const { data, error } = await supabase
        .from(row.kind === "task" ? "tasks" : "task_groups")
        .update({ order_index: index })
        .eq("id", row.id)
        .eq("scene_id", sceneId)
        .select("id");
      return { id: row.id, error, affected: data?.length ?? 0 };
    })
  );

  const dbError = results.find((r) => r.error)?.error;
  if (dbError) {
    console.error(`reorderSceneRows: помилка запису для сцени ${sceneId}:`, dbError.message);
    return { ok: false, error: dbError.message };
  }

  const missing = results.filter((r) => r.affected === 0);
  if (missing.length > 0) {
    console.error(
      `reorderSceneRows: 0 рядків оновлено для ${missing
        .map((r) => r.id)
        .join(", ")} у сцені ${sceneId}.`
    );
    return { ok: false, error: "Не вдалося зберегти порядок частини списку" };
  }

  return { ok: true };
}

// Той самий принцип, що reorderSceneRows вище (окрема сестринська функція,
// не узагальнення — сцена й DELF-тест ідентифікуються геть по-різному:
// одним id проти пари секція+номер), для сторінки DELF-тесту
// (TestSectionDragList). Кожна секція (CO/CE/PE/PO) — окремий перетягуваний
// список зі своєю незалежною послідовністю order_index (task-order.ts),
// тож викликається per-секція, не на весь тест разом.
// .eq("delf_section", delfSection).eq("delf_test_number", testNumber) на
// кожному UPDATE — той самий захист від застарілого/підробленого списку id
// з клієнта, що вже reorderSceneRows.
export async function reorderTestRows(
  delfSection: string,
  testNumber: number,
  orderedRows: { id: string; kind: "task" | "task_group" }[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const results = await Promise.all(
    orderedRows.map(async (row, index) => {
      const { data, error } = await supabase
        .from(row.kind === "task" ? "tasks" : "task_groups")
        .update({ order_index: index })
        .eq("id", row.id)
        .eq("delf_section", delfSection)
        .eq("delf_test_number", testNumber)
        .select("id");
      return { id: row.id, error, affected: data?.length ?? 0 };
    })
  );

  const dbError = results.find((r) => r.error)?.error;
  if (dbError) {
    console.error(
      `reorderTestRows: помилка запису для тесту ${testNumber} (${delfSection}):`,
      dbError.message
    );
    return { ok: false, error: dbError.message };
  }

  const missing = results.filter((r) => r.affected === 0);
  if (missing.length > 0) {
    console.error(
      `reorderTestRows: 0 рядків оновлено для ${missing
        .map((r) => r.id)
        .join(", ")} у тесті ${testNumber} (${delfSection}).`
    );
    return { ok: false, error: "Не вдалося зберегти порядок частини списку" };
  }

  return { ok: true };
}

// Копіювання з ІНШИМ власником (сцена/DELF-тест/матеріал) — на відміну від
// звичайного дублювання, оригінал лишається незмінним. Один атомарний RPC
// (copy_task, 0025_copy_task.sql), той самий патерн, що duplicate_scene.
export async function copyTask(taskId: string, formData: FormData) {
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("id, product_id")
    .eq("id", taskId)
    .single();
  if (!task) return;

  const destination = formData.get("destination") as string;
  const sceneId = destination === "scene" ? (formData.get("scene_id") as string) || null : null;
  const materialId = destination === "material" ? (formData.get("material_id") as string) || null : null;
  const delfSection = destination === "test" ? (formData.get("delf_section") as string) || null : null;
  const delfTestNumber =
    destination === "test" && formData.get("delf_test_number")
      ? Number(formData.get("delf_test_number"))
      : null;

  const { data: newTaskId, error } = await supabase.rpc("copy_task", {
    p_task_id: taskId,
    p_scene_id: sceneId,
    p_material_id: materialId,
    p_delf_section: delfSection,
    p_delf_test_number: delfTestNumber,
  });

  if (error || !newTaskId) {
    redirect(
      `/admin/courses/${task.product_id}/tasks/${taskId}/copy?error=${encodeURIComponent(
        error?.message ?? "Не вдалося скопіювати завдання"
      )}`
    );
  }

  redirect(
    sceneId
      ? `/admin/courses/${task.product_id}/scenes/${sceneId}`
      : materialId
        ? `/admin/courses/${task.product_id}/materials/${materialId}`
        : `/admin/courses/${task.product_id}`
  );
}
