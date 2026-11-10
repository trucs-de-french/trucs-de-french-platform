"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isMascotId } from "@/lib/cabinet/mascots";
import { cleanupAvatarFolder } from "@/lib/cabinet/avatar-storage";
import type { NotificationPrefs } from "@/lib/supabase/profile";

const NAME_MAX_LEN = 40;

function isOwnAvatarUrl(url: string, userId: string): boolean {
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${userId}/`;
  return url.startsWith(base);
}

// Профіль + сповіщення — одна дія під нижню панель "Є незбережені зміни".
// Мова/тема/тижнева ціль/іспит зберігаються одразу своїми діями
// (setCabinetUiLang/useTheme/saveWeeklyGoal/saveExam у cabinet/actions.ts)
// і сюди НЕ входять — лише ім'я, фото/маскот профілю, сповіщення.
export async function saveProfileSettings(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > NAME_MAX_LEN) {
    return { ok: false, error: "name" };
  }

  const mascotRaw = String(formData.get("mascot") ?? "");
  const mascot = mascotRaw && isMascotId(mascotRaw) ? mascotRaw : null;

  const avatarUrlRaw = String(formData.get("avatarUrl") ?? "");
  const avatarUrl = avatarUrlRaw && isOwnAvatarUrl(avatarUrlRaw, user.id) ? avatarUrlRaw : null;

  // Фото й маскот — взаємовиключні (той самий check у 0066_cabinet_
  // settings.sql): фото має пріоритет, якщо клієнт все ж надішле обидва.
  const finalAvatarUrl = avatarUrl;
  const finalMascot = avatarUrl ? null : mascot;

  const notificationPrefs: NotificationPrefs = {
    review: formData.get("notifReview") === "on",
    weekly_goal: formData.get("notifWeeklyGoal") === "on",
    news: formData.get("notifNews") === "on",
  };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: name,
      avatar_url: finalAvatarUrl,
      avatar_mascot: finalMascot,
      notification_prefs: notificationPrefs,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: "db" };

  // Прибирання старих файлів Storage — ЛИШЕ після успішного запису рядка
  // вище (інакше провал запису лишив би аватар зламаним на щойно
  // видалений файл). keepFileName=null, коли фото нема (маскот/видалено)
  // — тоді прибирається геть усе в папці користувача.
  const keepFileName = finalAvatarUrl ? finalAvatarUrl.split("/").pop() ?? null : null;
  await cleanupAvatarFolder(supabase, user.id, keepFileName);

  revalidatePath("/cabinet", "layout");
  return { ok: true };
}

// Лист зміни пароля від Supabase на email поточного користувача — та сама
// адреса, що вже прив'язана до сесії, тож з формою сторонній email сюди
// передати не можна. redirectTo веде на вже існуючий /auth/confirm
// (обробляє token_hash+type з листа підтвердження email тим самим кодом).
export async function requestPasswordReset(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "auth" };

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;

  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${origin}/auth/confirm`,
  });
  if (error) return { ok: false, error: "db" };
  return { ok: true };
}

// Видалення акаунта — лише службовий admin-клієнт (service_role),
// створюється тут і ТІЛЬКИ тут, усередині серверної дії; ключ ніколи не
// йде в бандл клієнта ("use server" на файлі гарантує, що ця функція
// виконується лише на сервері). Викладачів видаляти звідси не можна —
// роль перевіряється саме через профіль, що сесія намагається видалити,
// не через довірений клієнтський прапорець.
export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();
  if (profile?.role !== "student") {
    return { ok: false, error: "role" };
  }

  const admin = createAdminClient();

  // Папка аватара (Storage) не має FK-каскаду до auth.users — прибираємо
  // її тут окремо, best-effort, ДО видалення самого юзера (не критично,
  // якщо порядок інший, але так провал прибирання точно не блокує
  // видалення акаунта, якого студентка й просила).
  await cleanupAvatarFolder(admin, user.id, null);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: "db" };

  await supabase.auth.signOut();
  redirect("/login");
}
