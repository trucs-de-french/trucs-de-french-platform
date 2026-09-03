"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeCalloutHtml } from "@/lib/sanitize-callout-html";
import type { ActionState } from "@/lib/action-state";

function normalizeCategory(value: FormDataEntryValue | null): "delf_guide" | "general_tip" | null {
  return value === "delf_guide" || value === "general_tip" ? value : null;
}

// "Лише URL" для PDF — той самий принцип, що для video_url/task_image_url/
// task_audio_url у проєкті: жодного завантаження файлів через Storage.
// file_url і, отже, file_type — nullable: матеріал може бути лише статтею
// (content), лише PDF-посиланням, чи обома одразу.
export async function createMaterial(productId: string, formData: FormData) {
  const supabase = await createClient();

  const fileUrl = (formData.get("file_url") as string) || null;
  const content = (formData.get("content") as string) || null;

  const { error } = await supabase.from("materials").insert({
    product_id: productId,
    title: (formData.get("title") as string) || null,
    category: normalizeCategory(formData.get("category")),
    file_url: fileUrl,
    file_type: fileUrl ? "pdf" : null,
    content: content ? sanitizeCalloutHtml(content) : null,
  });

  if (error) {
    redirect(
      `/admin/courses/${productId}/materials/new?error=${encodeURIComponent(error.message)}`
    );
  }

  redirect(`/admin/courses/${productId}`);
}

export async function updateMaterial(
  materialId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();

  const fileUrl = (formData.get("file_url") as string) || null;
  const content = (formData.get("content") as string) || null;

  const { error } = await supabase
    .from("materials")
    .update({
      title: (formData.get("title") as string) || null,
      category: normalizeCategory(formData.get("category")),
      file_url: fileUrl,
      file_type: fileUrl ? "pdf" : null,
      content: content ? sanitizeCalloutHtml(content) : null,
    })
    .eq("id", materialId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteMaterial(materialId: string, productId: string) {
  const supabase = await createClient();
  await supabase.from("materials").delete().eq("id", materialId);
  redirect(`/admin/courses/${productId}`);
}
