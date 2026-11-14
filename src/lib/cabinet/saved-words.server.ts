import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SavedWordSourceEntry } from "./saved-words";

// Усе, що торкається Supabase server-клієнта (next/headers), живе ЛИШЕ
// тут — import "server-only" провалює збірку з чітким повідомленням,
// якщо якийсь клієнтський файл раптом імпортує цей модуль напряму
// (замість чистого saved-words.ts чи серверних дій у actions.ts).

// Для SavedWordsProvider (сторінка сцени) — які слова студент уже зберіг
// із конкретного джерела, з id (щоб "Прибрати" міг видалити рядок без
// додаткового запиту) і поточним перекладом (щоб показати його одразу,
// без повторного читання з БД).
export async function listSavedWordsForSource(sourceId: string): Promise<SavedWordSourceEntry[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("saved_words")
    .select("id, word_key, translation")
    .eq("user_id", user.id)
    .eq("source_id", sourceId);

  return (data ?? []).map((row) => {
    const r = row as { id: string; word_key: string; translation: string | null };
    return { id: r.id, wordKey: r.word_key, translation: r.translation };
  });
}
