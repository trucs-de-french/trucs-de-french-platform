"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { PREVIEW_COOKIE, previewCookieOptions } from "@/lib/course-preview";
import type { ActionState } from "@/lib/action-state";
import { validateR2ImageUrl, validateHexColor } from "@/lib/validate-r2-url";
import { CEFR_LEVELS, normalizeUiLang } from "@/lib/ui/product-lang";

// Чіпи рівнів шлють лише значення з CEFR_LEVELS, але formData завжди
// довільний текст з мережі — фільтруємо, а не довіряємо клієнту (той самий
// принцип, що вже є для level/type нижче).
function extractLevels(formData: FormData): string[] {
  const allowed = new Set<string>(CEFR_LEVELS);
  return formData
    .getAll("levels")
    .filter((v): v is string => typeof v === "string" && allowed.has(v));
}

// Той самий принцип, що resolveAudioUrl/resolveImageUrl у
// admin/tasks/actions.ts — cover_image_file_url (FileUpload kind="image")
// перекриває cover_image_url (текстове поле), якщо файл обрано.
function resolveCoverImageUrl(formData: FormData): string | null {
  const uploadedUrl = (formData.get("cover_image_file_url") as string) || "";
  return uploadedUrl || (formData.get("cover_image_url") as string) || null;
}

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
      levels: extractLevels(formData),
      ui_lang: normalizeUiLang(formData.get("ui_lang")),
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || null,
      price: Number(formData.get("price") || 0),
      cover_image_url: resolveCoverImageUrl(formData),
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
      cover_image_url: resolveCoverImageUrl(formData),
      // type незмінний після створення (форма його не показує), тож поле
      // level рендериться лише для вже-DELF продуктів — для film-продуктів
      // його просто нема у formData, і сюди пише null (коректно й так).
      level: (formData.get("level") as string) || null,
      levels: extractLevels(formData),
      ui_lang: normalizeUiLang(formData.get("ui_lang")),
    })
    .eq("id", productId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Фон студентських сторінок сцени — ОДИН на курс (не на сцену), окрема
// форма/дія від updateProduct вище: інше смислове групування (вигляд
// сторінки сцени, не дані курсу), і щоб збереження назви/ціни не залежало
// від валідності URL картинок. Валідація ТУТ (перед записом) — та сама
// функція, що і при рендері (scene-background.tsx): жодному значенню з
// формди не довіряємо напряму, навіть щойно завантаженому через FileUpload
// (FileUpload сам пише лише R2-урл, але сервер усе одно перевіряє origin/
// розширення/відсутність query, а не просто "непорожній рядок").
export async function updateProductBackground(
  productId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();

  const desktopRaw = (formData.get("background_desktop_url") as string) || "";
  const mobileRaw = (formData.get("background_mobile_url") as string) || "";
  const colorRaw = (formData.get("background_fill_color") as string) || "";

  const desktopUrl = desktopRaw ? validateR2ImageUrl(desktopRaw) : null;
  if (desktopRaw && !desktopUrl) {
    return { ok: false, error: "Картинка фону для комп'ютера — недійсне посилання." };
  }
  const mobileUrl = mobileRaw ? validateR2ImageUrl(mobileRaw) : null;
  if (mobileRaw && !mobileUrl) {
    return { ok: false, error: "Банер фону для телефона/планшета — недійсне посилання." };
  }
  const fillColor = colorRaw ? validateHexColor(colorRaw) : null;
  if (colorRaw && !fillColor) {
    return { ok: false, error: "Колір заливки має бути у форматі #RRGGBB." };
  }

  const { error } = await supabase
    .from("products")
    .update({
      background_desktop_url: desktopUrl,
      background_mobile_url: mobileUrl,
      background_fill_color: fillColor,
    })
    .eq("id", productId);

  if (error) return { ok: false, error: error.message };

  // layout — а не конкретна сторінка: оновлює ВСІ сцени курсу одразу
  // (фон курсовий, не посценний), без потреби знати/перелічувати sceneId.
  revalidatePath(`/courses/${productId}`, "layout");

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
// Усі місця виклику прив'язують ОБИДВА параметри через .bind() (навіть
// коли path не потрібен — тоді явно undefined) — <form action={fn}>
// дописує FormData ще одним аргументом при виклику; якби path лишався
// неприв'язаним, FormData потрапила б саме туди.
export async function startStudentPreview(productId: string, path?: string) {
  const cookieStore = await cookies();
  cookieStore.set(PREVIEW_COOKIE, productId, previewCookieOptions);
  redirect(path ?? `/courses/${productId}`);
}

// Без redirect — для прямого виклику з клієнтського компонента (не через
// <form action>), коли навігацію (напр. відкриття нової вкладки без втрати
// поточної сторінки) веде сам клієнт, а не сервер-екшн.
export async function setStudentPreviewCookie(productId: string) {
  const cookieStore = await cookies();
  cookieStore.set(PREVIEW_COOKIE, productId, previewCookieOptions);
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
