import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "task-audio";

// Спільний для task_groups (media_audio_file) і tasks (task_audio_file) —
// завантажує файл із форми в Storage, повертає публічний URL. RLS на
// storage.objects (0033_task_audio_storage.sql) сама вимагає is_teacher(),
// тож окремої перевірки ролі тут не треба — той самий принцип, що security
// invoker у RPC цього проєкту.
//
// url: null (не помилка) — коли поле порожнє/файл не обрано, щоб виклики
// могли просто "якщо url є — використати, інакше лишити текстове поле URL
// без змін" без окремої гілки на "нічого не сталось".
export async function uploadAudioFile(
  supabase: SupabaseClient,
  formData: FormData,
  fieldName: string
): Promise<{ url: string | null; error?: string }> {
  const file = formData.get(fieldName);
  if (!(file instanceof File) || file.size === 0) return { url: null };

  const ext = file.name.split(".").pop() || "mp3";
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "audio/mpeg" });
  if (error) return { url: null, error: error.message };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
