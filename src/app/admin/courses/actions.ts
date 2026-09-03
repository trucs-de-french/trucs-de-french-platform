"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { PREVIEW_COOKIE, previewCookieOptions } from "@/lib/course-preview";
import type { ActionState } from "@/lib/action-state";

export async function createProduct(formData: FormData) {
  const supabase = await createClient();

  const type = formData.get("type") as string;

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      type,
      // level стосується лише DELF — поле рендериться (і, отже, шле щось у
      // formData) лише коли обрано type="delf" (CourseTypeFields), але
      // перевіряємо ще й тут, а не лише довіряємо клієнту.
      level: type === "delf" ? (formData.get("level") as string) || null : null,
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
      // type незмінний після створення (форма його не показує), тож поле
      // level рендериться лише для вже-DELF продуктів — для film-продуктів
      // його просто нема у formData, і сюди пише null (коректно й так).
      level: (formData.get("level") as string) || null,
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

export async function toggleArchive(productId: string, next: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ archived_at: next ? new Date().toISOString() : null })
    .eq("id", productId);

  if (error) {
    redirect(`/admin/courses/${productId}?error=${encodeURIComponent(error.message)}`);
  }
}

// "Переглянути як студент" — прив'язуємо куку до конкретного productId, щоб
// перегляд іншого курсу без явного натискання кнопки на ньому лишався
// звичайним вчительським доступом (детальніше — @/lib/course-preview).
export async function startStudentPreview(productId: string) {
  const cookieStore = await cookies();
  cookieStore.set(PREVIEW_COOKIE, productId, previewCookieOptions);
  redirect(`/courses/${productId}`);
}

export async function endStudentPreview(productId: string) {
  const cookieStore = await cookies();
  cookieStore.delete(PREVIEW_COOKIE);
  redirect(`/admin/courses/${productId}`);
}

// Каскадне безповоротне видалення — уся схема вже on delete cascade
// (products → scenes/tasks/materials → scene_links/games/progress/mistakes),
// тож звичайний DELETE, без окремого RPC. Архівування лишається
// обов'язковим проміжним кроком: сервер сам перевіряє archived_at, а не
// довіряє тому, що кнопка прихована на клієнті.
export async function deleteProductPermanently(productId: string) {
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("archived_at")
    .eq("id", productId)
    .single();

  if (!product?.archived_at) {
    redirect(
      `/admin/courses/${productId}?error=${encodeURIComponent(
        "Видалити назавжди можна лише архівований курс"
      )}`
    );
  }

  const { error } = await supabase.from("products").delete().eq("id", productId);

  if (error) {
    redirect(`/admin/courses/${productId}?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/admin/courses");
}
