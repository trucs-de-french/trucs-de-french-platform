"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
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

  const { data: block, error } = await supabase
    .from("scene_content_blocks")
    .insert({
      scene_id: sceneId,
      title,
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

export async function deleteSceneContentBlock(
  productId: string,
  sceneId: string,
  blockId: string
) {
  const supabase = await createClient();

  const { error } = await supabase.from("scene_content_blocks").delete().eq("id", blockId);

  const backPath = `/admin/courses/${productId}/scenes/${sceneId}`;
  if (error) {
    redirect(`${backPath}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(backPath);
}
