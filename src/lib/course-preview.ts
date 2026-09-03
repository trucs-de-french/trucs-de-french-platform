import { cookies } from "next/headers";

// Куку "Переглянути як студент" (admin/courses/[id]/page.tsx) прив'язано до
// конкретного productId — перегляд іншого курсу без явного натискання кнопки
// на ньому лишається звичайним вчительським доступом.
export const PREVIEW_COOKIE = "admin_preview_course";
const PREVIEW_MAX_AGE = 60 * 60; // 1 год

export const previewCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: PREVIEW_MAX_AGE,
};

export async function getPreviewCourseId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(PREVIEW_COOKIE)?.value ?? null;
}

// Дослівно повторює умову видимості з RLS-політики "products_select"
// (supabase/migrations/0001_init.sql, оновлено в 0027_archive_products.sql):
// (is_published = true and archived_at is null) or is_teacher().
// Тут навмисно перевіряємо лише першу частину — режим перегляду симулює
// ЗАПИСАНОГО студента (enrollment вважається активним), бо саме
// is_published/archived_at — це те, що ця функція мала захистити;
// незаписаний відвідувач не бачить вміст жодного курсу незалежно від цих
// полів, і перевіряти це кнопкою нема сенсу.
// Якщо політику products_select колись зміните — оновіть і цю функцію.
export function isVisibleToEnrolledStudent(product: {
  is_published: boolean;
  archived_at: string | null;
}): boolean {
  return product.is_published === true && product.archived_at === null;
}
