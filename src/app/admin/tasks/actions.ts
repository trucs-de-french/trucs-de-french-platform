"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sanitizeCalloutHtml } from "@/lib/sanitize-callout-html";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { createClient } from "@/lib/supabase/server";
import { detectPlatform } from "@/lib/platform";
import type { ActionState } from "@/lib/action-state";
import { nextOrderIndex, findNeighbor } from "@/app/admin/task-order";

// Перед додаванням нової мутуючої дії сюди — дивись чеклист
// "redirect() vs revalidatePath() vs {ok,error}" на початку
// ../scenes/actions.ts. Найчастіша причина "зберіглось, але не видно без
// F5" — саме пропущений крок із цього чеклиста.

function buildConfig(type: string, formData: FormData): Record<string, unknown> {
  switch (type) {
    case "essay_check": {
      const level = (formData.get("essay_level") as string) || "B1";
      const exerciseNumberRaw = formData.get("essay_exercise_number") as string | null;
      const exerciseNumber = exerciseNumberRaw ? (Number(exerciseNumberRaw) as 1 | 2) : undefined;

      if (level === "A1" && exerciseNumber === 1) {
        return {
          level,
          exerciseNumber,
          instructions: (formData.get("essay_formulaire_instructions") as string) || "",
          fields: parseJsonField(formData.get("essay_formulaire_fields")),
        };
      }

      return {
        prompt: (formData.get("prompt") as string) || "",
        criteria: (formData.get("criteria") as string) || "",
        level,
        exerciseNumber,
      };
    }
    case "open_answer": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("open_answer_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("open_answer_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        questions: parseJsonField(formData.get("open_answer_questions")),
      };
    }
    case "embed":
      return {
        url: (formData.get("embed_url") as string) || "",
        height: Number(formData.get("embed_height")) || 480,
      };
    case "link": {
      const url = (formData.get("link_url") as string) || "";
      const rawPlatform = (formData.get("link_platform") as string) || "auto";
      return {
        url,
        label: (formData.get("link_label") as string) || "",
        platform: rawPlatform === "auto" ? detectPlatform(url) : rawPlatform,
        download: formData.get("link_download") === "true",
      };
    }
    case "fill_blank": {
      const wordBank = parseJsonField(formData.get("fill_blank_word_bank")) as string[];
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("fill_blank_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("fill_blank_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        template: (formData.get("fill_blank_template") as string) || "",
        points: Number(formData.get("fill_blank_points")) || 1,
        // Порожній банк -> wordBank взагалі відсутній у config, а не "[]" —
        // студентський рендер уже й так коректно ховає порожній масив
        // (config.wordBank?.length), але так конфіг чистіший для читання.
        ...(wordBank.length > 0 ? { wordBank } : {}),
      };
    }
    case "multiple_choice": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("mc_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("mc_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        display: (formData.get("mc_display") as string) || "buttons",
        items: parseJsonField(formData.get("mc_items")),
      };
    }
    case "true_false": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("tf_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("tf_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        statements: parseJsonField(formData.get("tf_statements")),
      };
    }
    case "matching": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("matching_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("matching_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        pairs: parseJsonField(formData.get("matching_pairs")),
      };
    }
    case "listening": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("listening_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("listening_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        audioUrl: (formData.get("listening_audio_url") as string) || "",
        questions: parseJsonField(formData.get("listening_questions")),
      };
    }
    case "reorder": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("reorder_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("reorder_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        sequences: parseJsonField(formData.get("reorder_sequences")),
      };
    }
    case "drag_drop": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("drag_drop_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("drag_drop_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        sentences: parseJsonField(formData.get("drag_drop_sentences")),
        bank: parseJsonField(formData.get("drag_drop_bank")),
      };
    }
    case "sort_columns": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("sort_columns_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml(
          (formData.get("sort_columns_instructions") as string) || ""
        ),
        ...(subInstructions ? { subInstructions } : {}),
        columns: parseJsonField(formData.get("sort_columns_columns")),
        items: parseJsonField(formData.get("sort_columns_items")),
      };
    }
    case "flip_cards": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("flip_cards_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml(
          (formData.get("flip_cards_instructions") as string) || ""
        ),
        ...(subInstructions ? { subInstructions } : {}),
        cards: parseJsonField(formData.get("flip_cards_cards")),
      };
    }
    case "callout":
      // Основна санітизація — саме тут, на межі збереження в базу
      // (клієнтська санітизація в CalloutFields — лише для швидкого
      // відгуку, їй не можна довіряти як єдиному захисту).
      return {
        style: (formData.get("callout_style") as string) || "none",
        content: sanitizeCalloutHtml((formData.get("callout_content") as string) || ""),
      };
    case "phonetics": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("phonetics_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("phonetics_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        items: parseJsonField(formData.get("phonetics_items")),
      };
    }
    case "table_fill": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("table_fill_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml(
          (formData.get("table_fill_instructions") as string) || ""
        ),
        ...(subInstructions ? { subInstructions } : {}),
        columnLabels: parseJsonField(formData.get("table_fill_column_labels")),
        rows: parseJsonField(formData.get("table_fill_rows")),
      };
    }
    case "image_match": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("image_match_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml(
          (formData.get("image_match_instructions") as string) || ""
        ),
        ...(subInstructions ? { subInstructions } : {}),
        items: parseJsonField(formData.get("image_match_items")),
      };
    }
    case "checkbox_grid": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("checkbox_grid_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml(
          (formData.get("checkbox_grid_instructions") as string) || ""
        ),
        ...(subInstructions ? { subInstructions } : {}),
        columns: parseJsonField(formData.get("checkbox_grid_columns")),
        rows: parseJsonField(formData.get("checkbox_grid_rows")),
      };
    }
    case "chronological_order": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("chronological_order_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml(
          (formData.get("chronological_order_instructions") as string) || ""
        ),
        ...(subInstructions ? { subInstructions } : {}),
        mode: (formData.get("chronological_order_mode") as string) || "image",
        items: parseJsonField(formData.get("chronological_order_items")),
      };
    }
    case "vocab_quiz":
      return {
        sceneIds: parseJsonField(formData.get("vocab_quiz_scene_ids")),
      };
    default:
      return {};
  }
}

function parseJsonField(value: FormDataEntryValue | null): unknown[] {
  try {
    const parsed = JSON.parse((value as string) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
// спільна для moveTask/deleteTask, щоб не тримати ту саму 3-4-гілкову логіку
// в кожній окремо. Задача в блоці (task_group_id) сама має null scene_id/
// material_id (успадковує контекст від групи, див. 0031_task_groups.sql),
// тож для неї доводиться підвантажити батьківський контекст самої групи —
// адмінської сторінки блоку ще нема (з'явиться в CRUD-етапі), тож у гіршому
// разі повертаємось на флет-список курсу.
async function resolveTaskParentPath(
  supabase: Awaited<ReturnType<typeof createClient>>,
  task: {
    product_id: string;
    scene_id: string | null;
    material_id: string | null;
    task_group_id: string | null;
  }
): Promise<string> {
  if (task.scene_id) return `/admin/courses/${task.product_id}/scenes/${task.scene_id}`;
  if (task.material_id) return `/admin/courses/${task.product_id}/materials/${task.material_id}`;
  if (task.task_group_id) {
    const { data: group } = await supabase
      .from("task_groups")
      .select("scene_id, material_id")
      .eq("id", task.task_group_id)
      .single();
    if (group?.scene_id) return `/admin/courses/${task.product_id}/scenes/${group.scene_id}`;
    if (group?.material_id)
      return `/admin/courses/${task.product_id}/materials/${group.material_id}`;
  }
  return `/admin/courses/${task.product_id}`;
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
  const title = formData.get("title") as string;

  const orderIndex = await nextOrderIndex(supabase, {
    productId,
    sceneId,
    materialId,
    taskGroupId,
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
      config: buildConfig(type, formData),
      image_url: (formData.get("task_image_url") as string) || null,
      audio_url: (formData.get("task_audio_url") as string) || null,
      // Чекбокс рендериться лише для POINTS_SUPPORTED_TASK_TYPES
      // (TaskConfigFields, isPointsSupportedTaskType) — для решти типів
      // його нема у formData взагалі, тож тут коректно піде false.
      points_visible: formData.get("points_visible") === "true",
      // Присутні у formData лише коли батьківський продукт type='delf'
      // (TaskConfigFields рендерить ці селекти умовно) — для film-задач
      // просто null.
      delf_section: (formData.get("delf_section") as string) || null,
      delf_test_number: formData.get("delf_test_number")
        ? Number(formData.get("delf_test_number"))
        : null,
    })
    .select()
    .single();

  if (error || !task) throw error;

  await syncGameRow(supabase, task.id, type, formData);

  redirect(
    await resolveTaskParentPath(supabase, {
      product_id: productId,
      scene_id: sceneId,
      material_id: materialId,
      task_group_id: taskGroupId,
    })
  );
}

export async function updateTask(
  productId: string,
  taskId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();

  const type = formData.get("type") as string;
  const title = formData.get("title") as string;

  const { error } = await supabase
    .from("tasks")
    .update({
      type,
      title,
      config: buildConfig(type, formData),
      image_url: (formData.get("task_image_url") as string) || null,
      audio_url: (formData.get("task_audio_url") as string) || null,
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
    .select("product_id, scene_id, material_id, task_group_id")
    .eq("id", taskId)
    .single();
  if (!task) return;

  const backPath = await resolveTaskParentPath(supabase, task);

  const { data: deleted, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .select("id");

  if (error || !deleted?.length) {
    redirect(
      `${backPath}?error=${encodeURIComponent(error?.message ?? "Не вдалося видалити завдання")}`
    );
  }

  redirect(backPath);
}

export async function moveTask(taskId: string, direction: "up" | "down") {
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("id, product_id, scene_id, material_id, task_group_id, order_index")
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
    },
    task.order_index,
    direction
  );

  if (!neighbor) return;

  const backPath = await resolveTaskParentPath(supabase, task);

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
