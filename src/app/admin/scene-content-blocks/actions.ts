"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { deleteTaskGroupCore } from "@/app/admin/task-groups/actions";
import type { ActionState } from "@/lib/action-state";

// buildContentFields дубльована з task-groups/actions.ts (той самий шматок
// логіки: content_type -> content_text/media_url/media_provider, з
// перекриттям media_url завантаженим файлом для audio) — навмисна
// дуплікація, не спільний імпорт: два геть різні домени (див. коментар у
// 0036_scene_content_blocks.sql), яким випадково збігається форма полів;
// незалежна еволюція важливіша за DRY тут, той самий принцип, що вже
// задокументований для полів-редакторів у цій кодовій базі.
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

export async function createSceneContentBlock(formData: FormData) {
  const supabase = await createClient();

  const productId = formData.get("product_id") as string;
  const sceneId = formData.get("scene_id") as string;
  const title = (formData.get("title") as string) || null;

  const contentType = (formData.get("content_type") as string) || "text";

  const { data: block, error } = await supabase
    .from("scene_content_blocks")
    .insert({
      scene_id: sceneId,
      title,
      // 'script' стартує з порожнього діалогу, редагованого інлайн одразу
      // після створення (DialogueEditor) — той самий принцип, що 'text'/
      // 'audio'/... стартують з порожніх content_text/media_url.
      dialogue: contentType === "script" ? [] : null,
      ...buildContentFields(formData),
    })
    .select()
    .single();

  if (error || !block) throw error;

  // Реєструємо блок у спільному впорядкуванні сцени (0037) — max(position)+1,
  // той самий принцип, що вже в updateSceneVideo (../scenes/actions.ts).
  const { data: maxRow } = await supabase
    .from("scene_blocks")
    .select("position")
    .eq("scene_id", sceneId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: blockRowError } = await supabase.from("scene_blocks").insert({
    scene_id: sceneId,
    block_type: "content",
    ref_id: block.id,
    position: (maxRow?.position ?? -1) + 1,
  });
  if (blockRowError) throw blockRowError;

  redirect(`/admin/courses/${productId}/scenes/${sceneId}`);
}

export async function updateSceneContentBlock(
  productId: string,
  sceneId: string,
  blockId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();

  const title = (formData.get("title") as string) || null;

  const { error } = await supabase
    .from("scene_content_blocks")
    .update({
      title,
      ...buildContentFields(formData),
    })
    .eq("id", blockId);

  if (error) return { ok: false, error: error.message };

  // Редагування тепер інлайн у SceneBlockList на сторінці сцени (Крок 2) —
  // окремої сторінки /scene-content-blocks/[blockId] більше немає.
  revalidatePath(`/admin/courses/${productId}/scenes/${sceneId}`);

  return { ok: true };
}

// Окрема дія для content_type === 'script' — DialogueEditor сабмітить один
// hidden-інпут "dialogue" (весь масив цілком, як і scenes.dialogue), геть
// іншу форму полів, ніж buildContentFields/ContentBlockFields. Дзеркалить
// updateSceneDialogue (scenes/actions.ts), лише ціль — рядок
// scene_content_blocks, не scenes.
export async function updateScriptContentBlock(
  productId: string,
  sceneId: string,
  blockId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();

  let dialogue: unknown = [];
  try {
    dialogue = JSON.parse((formData.get("dialogue") as string) || "[]");
  } catch {
    dialogue = [];
  }

  const { error } = await supabase
    .from("scene_content_blocks")
    .update({ dialogue })
    .eq("id", blockId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/courses/${productId}/scenes/${sceneId}`);

  return { ok: true };
}

export async function deleteSceneContentBlock(
  productId: string,
  sceneId: string,
  blockId: string
) {
  const supabase = await createClient();
  const backPath = `/admin/courses/${productId}/scenes/${sceneId}`;

  // Прикріплена група вправ (0040) — спершу відкріпити її задачі тим самим
  // ядром, що й кнопка "Видалити вправи блоку" (deleteTaskGroupCore), а не
  // покладатись на ON DELETE CASCADE: інакше вправи знищились би разом із
  // блоком без попередження, хоча сторінка сцени вже попереджає про це
  // текстом підтвердження (для порожньої групи — просто видаляється разом
  // із блоком, попереджати нема про що).
  const { data: group } = await supabase
    .from("task_groups")
    .select("id")
    .eq("scene_content_block_id", blockId)
    .maybeSingle();

  if (group) {
    const result = await deleteTaskGroupCore(supabase, group.id);
    if (!result.ok) {
      redirect(`${backPath}?error=${encodeURIComponent(result.error ?? "Не вдалося прибрати вправи блоку")}`);
    }
  }

  // .select("id") — перевіряє кількість РЕАЛЬНО видалених рядків: без цього
  // RLS міг би мовчки відфільтрувати DELETE (0 рядків, без error), і кнопка
  // виглядала б робочою, хоча блок і далі на місці (мовчазна відмова).
  const { data, error } = await supabase
    .from("scene_content_blocks")
    .delete()
    .eq("id", blockId)
    .select("id");

  if (error) {
    redirect(`${backPath}?error=${encodeURIComponent(error.message)}`);
  }
  if (!data?.length) {
    redirect(`${backPath}?error=${encodeURIComponent("Блок не видалено — можливо, вже видалений або немає прав")}`);
  }

  redirect(backPath);
}
