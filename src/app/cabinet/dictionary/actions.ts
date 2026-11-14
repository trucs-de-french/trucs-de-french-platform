"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  computeWordKey,
  rowToSavedWord,
  type SavedWord,
  type SavedWordInput,
} from "@/lib/cabinet/saved-words";
import { normalizePartOfSpeech } from "@/lib/vocab-categories";

const MAX_SAVED_WORDS = 1000;

type ActionError = "auth" | "validation" | "limit" | "db" | "not_found";

function trimmedOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

// Довжини відповідають check-обмеженням 0069_saved_words.sql — провал
// тут має дати ту саму відмову, що дав би insert, але з читабельним
// error-кодом замість сирого db-рядка constraint violation.
function validateInput(input: SavedWordInput): ActionError | null {
  const word = input.word.trim();
  if (word.length < 1 || word.length > 80) return "validation";
  if (!["scene", "story", "manual"].includes(input.sourceType)) return "validation";
  if (!["teacher", "own", "ai", "none"].includes(input.translationSource)) return "validation";
  const translation = trimmedOrNull(input.translation);
  if (translation && translation.length > 200) return "validation";
  const note = trimmedOrNull(input.note);
  if (note && note.length > 400) return "validation";
  const contextFr = trimmedOrNull(input.contextFr);
  if (contextFr && contextFr.length > 600) return "validation";
  const contextUk = trimmedOrNull(input.contextUk);
  if (contextUk && contextUk.length > 600) return "validation";
  return null;
}

// Збереження слова зі скрипту/відео (Етап 2 викликає це). Ідемпотентно:
// повторне збереження того самого слова з того самого джерела (унікальний
// індекс saved_words_user_source_word_key) НЕ падає помилкою — повертає
// вже наявний рядок (alreadySaved: true), бо клік на вже збережене слово
// в UI не повинен виглядати як провал.
export async function saveWord(
  input: SavedWordInput
): Promise<{ ok: boolean; id?: string; alreadySaved?: boolean; error?: ActionError }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const validationError = validateInput(input);
  if (validationError) return { ok: false, error: validationError };

  const { count, error: countError } = await supabase
    .from("saved_words")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) return { ok: false, error: "db" };
  if ((count ?? 0) >= MAX_SAVED_WORDS) return { ok: false, error: "limit" };

  const word = input.word.trim();
  const wordKey = computeWordKey(word);
  const sourceId = input.sourceId ?? null;

  const { data, error } = await supabase
    .from("saved_words")
    .insert({
      user_id: user.id,
      source_type: input.sourceType,
      source_id: sourceId,
      product_id: input.productId ?? null,
      source_title: trimmedOrNull(input.sourceTitle),
      vocab_id: input.vocabId ?? null,
      word,
      word_key: wordKey,
      translation: trimmedOrNull(input.translation),
      translation_source: input.translationSource,
      // Єдина точка нормалізації partOfSpeech (легасі-ключі типу
      // "adverbe_locution" -> канонічне значення) — усе, що читає цю
      // колонку далі (dictionary/page.tsx, dictionary-view.tsx), довіряє,
      // що тут уже лежить канонічний PartOfSpeech або null.
      part_of_speech: normalizePartOfSpeech(input.partOfSpeech),
      note: trimmedOrNull(input.note),
      image_url: input.imageUrl ?? null,
      context_fr: trimmedOrNull(input.contextFr),
      context_uk: trimmedOrNull(input.contextUk),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      let existingQuery = supabase
        .from("saved_words")
        .select("id")
        .eq("user_id", user.id)
        .eq("source_type", input.sourceType)
        .eq("word_key", wordKey);
      existingQuery =
        sourceId === null ? existingQuery.is("source_id", null) : existingQuery.eq("source_id", sourceId);
      const { data: existing, error: existingError } = await existingQuery.maybeSingle();
      if (existingError || !existing) return { ok: false, error: "db" };
      return { ok: true, id: existing.id, alreadySaved: true };
    }
    return { ok: false, error: "db" };
  }

  revalidatePath("/cabinet/dictionary");
  return { ok: true, id: data.id, alreadySaved: false };
}

// Інлайн-редагування перекладу з картки (стаб Етапу 1 показує context_uk з
// кнопкою "додайте переклад" — ця дія і є тим збереженням). Порожній
// рядок явно очищає переклад (translation_source повертається до 'none'),
// будь-що інше позначає його як 'own' — студентський, не вчительський.
export async function updateWordTranslation(
  id: string,
  translation: string
): Promise<{ ok: boolean; translation?: string | null; error?: ActionError }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const trimmed = translation.trim();
  if (trimmed.length > 200) return { ok: false, error: "validation" };
  const value = trimmed.length === 0 ? null : trimmed;

  const { data, error } = await supabase
    .from("saved_words")
    .update({ translation: value, translation_source: value === null ? "none" : "own" })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: "db" };
  if (!data) return { ok: false, error: "not_found" };

  revalidatePath("/cabinet/dictionary");
  return { ok: true, translation: value };
}

// Повертає знятий снімок, щоб UI міг запропонувати "Скасувати" (undo =
// saveWord із тими самими полями) без окремого ендпоінта відновлення.
export async function removeWord(
  id: string
): Promise<{ ok: boolean; snapshot?: SavedWord; error?: ActionError }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const { data, error } = await supabase
    .from("saved_words")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: "db" };
  if (!data) return { ok: false, error: "not_found" };

  revalidatePath("/cabinet/dictionary");
  return { ok: true, snapshot: rowToSavedWord(data) };
}
