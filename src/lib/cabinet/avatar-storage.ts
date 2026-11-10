// Мінімальний структурний тип — приймає і сесійний createClient()
// (@supabase/ssr), і createAdminClient() (@supabase/supabase-js,
// service_role) однаково: обидва мають сумісний .storage API, лише
// різний механізм автентифікації/обхід RLS, що для Storage-викликів тут
// значення не має.
type StorageCapableClient = {
  storage: {
    from(bucket: string): {
      list(path: string): Promise<{ data: { name: string }[] | null; error: unknown }>;
      remove(paths: string[]): Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };
};

// Прибирає всі файли в папці користувача (bucket "avatars"), крім
// keepFileName (ім'я БЕЗ userId-префіксу — те, що лежить одразу під
// `${userId}/`). keepFileName=null — прибрати геть усе (студент перейшов
// на маскота/видалив фото, чи акаунт видаляється). Викликати ЛИШЕ ПІСЛЯ
// того, як запис profiles.avatar_url уже успішно оновлено — інакше при
// провалі збереження аватар лишився б зламаним (посилався б на щойно
// видалений файл). Best-effort: провал прибирання НЕ повинен валити сам
// save/видалення акаунта, лише логується.
export async function cleanupAvatarFolder(
  supabase: StorageCapableClient,
  userId: string,
  keepFileName: string | null
): Promise<void> {
  try {
    const { data: files } = await supabase.storage.from("avatars").list(userId);
    if (!files || files.length === 0) return;
    const toRemove = files.filter((f) => f.name !== keepFileName).map((f) => `${userId}/${f.name}`);
    if (toRemove.length === 0) return;
    const { error } = await supabase.storage.from("avatars").remove(toRemove);
    if (error) console.error("[cleanupAvatarFolder] remove failed:", error.message);
  } catch (err) {
    console.error("[cleanupAvatarFolder] unexpected failure:", err);
  }
}
