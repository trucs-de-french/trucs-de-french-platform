"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// "Лише URL" — той самий принцип, що для video_url/task_image_url/
// task_audio_url в проєкті: жодного завантаження файлів через Storage.
export async function createMaterial(productId: string, formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.from("materials").insert({
    product_id: productId,
    file_url: (formData.get("file_url") as string) || "",
    file_type: "pdf",
    title: (formData.get("title") as string) || null,
  });

  if (error) {
    redirect(`/admin/courses/${productId}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/admin/courses/${productId}`);
}

export async function deleteMaterial(materialId: string, productId: string) {
  const supabase = await createClient();
  await supabase.from("materials").delete().eq("id", materialId);
  redirect(`/admin/courses/${productId}`);
}
