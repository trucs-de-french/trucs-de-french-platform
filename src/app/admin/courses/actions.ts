"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";

export async function createProduct(formData: FormData) {
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      type: formData.get("type") as string,
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || null,
      price: Number(formData.get("price") || 0),
      cover_image_url: (formData.get("cover_image_url") as string) || null,
    })
    .select()
    .single();

  if (error || !product) {
    redirect(`/admin/courses/new?error=${encodeURIComponent(error?.message ?? "Помилка")}`);
  }

  redirect(`/admin/courses/${product.id}`);
}

export async function updateProduct(
  productId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update({
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || null,
      price: Number(formData.get("price") || 0),
      cover_image_url: (formData.get("cover_image_url") as string) || null,
    })
    .eq("id", productId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function togglePublish(productId: string, next: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_published: next })
    .eq("id", productId);

  if (error) {
    redirect(`/admin/courses/${productId}?error=${encodeURIComponent(error.message)}`);
  }
}
