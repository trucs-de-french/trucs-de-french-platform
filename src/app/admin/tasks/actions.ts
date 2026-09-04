"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sanitizeCalloutHtml } from "@/lib/sanitize-callout-html";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { createClient } from "@/lib/supabase/server";
import { detectPlatform } from "@/lib/platform";
import type { ActionState } from "@/lib/action-state";

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
    case "open_answer":
      return {
        instructions: (formData.get("open_answer_instructions") as string) || "",
        questions: parseJsonField(formData.get("open_answer_questions")),
      };
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
      return {
        instructions: (formData.get("fill_blank_instructions") as string) || "",
        template: (formData.get("fill_blank_template") as string) || "",
        points: Number(formData.get("fill_blank_points")) || 1,
        // Порожній банк -> wordBank взагалі відсутній у config, а не "[]" —
        // студентський рендер уже й так коректно ховає порожній масив
        // (config.wordBank?.length), але так конфіг чистіший для читання.
        ...(wordBank.length > 0 ? { wordBank } : {}),
      };
    }
    case "multiple_choice":
      return {
        instructions: (formData.get("mc_instructions") as string) || "",
        display: (formData.get("mc_display") as string) || "buttons",
        items: parseJsonField(formData.get("mc_items")),
      };
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
    case "matching":
      return {
        instructions: (formData.get("matching_instructions") as string) || "",
        pairs: parseJsonField(formData.get("matching_pairs")),
      };
    case "listening":
      return {
        instructions: (formData.get("listening_instructions") as string) || "",
        audioUrl: (formData.get("listening_audio_url") as string) || "",
        questions: parseJsonField(formData.get("listening_questions")),
      };
    case "reorder":
      return {
        instructions: (formData.get("reorder_instructions") as string) || "",
        sequences: parseJsonField(formData.get("reorder_sequences")),
      };
    case "drag_drop":
      return {
        instructions: (formData.get("drag_drop_instructions") as string) || "",
        sentences: parseJsonField(formData.get("drag_drop_sentences")),
        bank: parseJsonField(formData.get("drag_drop_bank")),
      };
    case "sort_columns":
      return {
        instructions: (formData.get("sort_columns_instructions") as string) || "",
        columns: parseJsonField(formData.get("sort_columns_columns")),
        items: parseJsonField(formData.get("sort_columns_items")),
      };
    case "flip_cards":
      return {
        instructions: (formData.get("flip_cards_instructions") as string) || "",
        cards: parseJsonField(formData.get("flip_cards_cards")),
      };
    case "callout":
      // Основна санітизація — саме тут, на межі збереження в базу
      // (клієнтська санітизація в CalloutFields — лише для швидкого
      // відгуку, їй не можна довіряти як єдиному захисту).
      return {
        style: (formData.get("callout_style") as string) || "none",
        content: sanitizeCalloutHtml((formData.get("callout_content") as string) || ""),
      };
    case "phonetics":
      return {
        instructions: (formData.get("phonetics_instructions") as string) || "",
        items: parseJsonField(formData.get("phonetics_items")),
      };
    case "table_fill":
      return {
        instructions: (formData.get("table_fill_instructions") as string) || "",
        columnLabels: parseJsonField(formData.get("table_fill_column_labels")),
        rows: parseJsonField(formData.get("table_fill_rows")),
      };
    case "image_match":
      return {
        instructions: (formData.get("image_match_instructions") as string) || "",
        items: parseJsonField(formData.get("image_match_items")),
      };
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

export async function createTask(formData: FormData) {
  const supabase = await createClient();

  const productId = formData.get("product_id") as string;
  const sceneId = (formData.get("scene_id") as string) || null;
  const materialId = (formData.get("material_id") as string) || null;
  const type = formData.get("type") as string;
  const title = formData.get("title") as string;

  // Три можливі скоупи для order_index: у межах сцени, у межах матеріалу,
  // або "вільні" product-level задачі (scene_id і material_id обидва null —
  // напр. DELF entraînement). Одночасно sceneId і materialId не приходять
  // (форма показує лише один hidden-інпут залежно від контексту виклику).
  let scopeQuery = supabase
    .from("tasks")
    .select("order_index")
    .eq("product_id", productId);
  if (sceneId) {
    scopeQuery = scopeQuery.eq("scene_id", sceneId);
  } else if (materialId) {
    scopeQuery = scopeQuery.eq("material_id", materialId);
  } else {
    scopeQuery = scopeQuery.is("scene_id", null).is("material_id", null);
  }

  const { data: last } = await scopeQuery
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      product_id: productId,
      scene_id: sceneId,
      material_id: materialId,
      type,
      title,
      order_index: (last?.order_index ?? 0) + 1,
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
    sceneId
      ? `/admin/courses/${productId}/scenes/${sceneId}`
      : materialId
        ? `/admin/courses/${productId}/materials/${materialId}`
        : `/admin/courses/${productId}`
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
    .select("product_id, scene_id, material_id")
    .eq("id", taskId)
    .single();
  if (!task) return;

  const backPath = task.scene_id
    ? `/admin/courses/${task.product_id}/scenes/${task.scene_id}`
    : task.material_id
      ? `/admin/courses/${task.product_id}/materials/${task.material_id}`
      : `/admin/courses/${task.product_id}`;

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
    .select("id, product_id, scene_id, material_id, order_index")
    .eq("id", taskId)
    .single();
  if (!task) return;

  let query = supabase.from("tasks").select("id, order_index").eq("product_id", task.product_id);
  if (task.scene_id) {
    query = query.eq("scene_id", task.scene_id);
  } else if (task.material_id) {
    query = query.eq("material_id", task.material_id);
  } else {
    query = query.is("scene_id", null).is("material_id", null);
  }

  const { data: neighbor } =
    direction === "up"
      ? await query
          .lt("order_index", task.order_index)
          .order("order_index", { ascending: false })
          .limit(1)
          .maybeSingle()
      : await query
          .gt("order_index", task.order_index)
          .order("order_index", { ascending: true })
          .limit(1)
          .maybeSingle();

  if (!neighbor) return;

  const backPath = task.scene_id
    ? `/admin/courses/${task.product_id}/scenes/${task.scene_id}`
    : task.material_id
      ? `/admin/courses/${task.product_id}/materials/${task.material_id}`
      : `/admin/courses/${task.product_id}`;

  const { data: updated1, error: error1 } = await supabase
    .from("tasks")
    .update({ order_index: neighbor.order_index })
    .eq("id", task.id)
    .select("id");
  const { data: updated2, error: error2 } = await supabase
    .from("tasks")
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
export async function reorderTasks(
  sceneId: string,
  orderedTaskIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const results = await Promise.all(
    orderedTaskIds.map(async (taskId, index) => {
      const { data, error } = await supabase
        .from("tasks")
        .update({ order_index: index })
        .eq("id", taskId)
        .eq("scene_id", sceneId)
        .select("id");
      return { taskId, error, affected: data?.length ?? 0 };
    })
  );

  const dbError = results.find((r) => r.error)?.error;
  if (dbError) {
    console.error(`reorderTasks: помилка запису для сцени ${sceneId}:`, dbError.message);
    return { ok: false, error: dbError.message };
  }

  const missing = results.filter((r) => r.affected === 0);
  if (missing.length > 0) {
    console.error(
      `reorderTasks: 0 рядків оновлено для завдань ${missing
        .map((r) => r.taskId)
        .join(", ")} у сцені ${sceneId}.`
    );
    return { ok: false, error: "Не вдалося зберегти порядок частини завдань" };
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
