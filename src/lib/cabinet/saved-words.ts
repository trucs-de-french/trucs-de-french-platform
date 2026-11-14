import { createClient } from "@/lib/supabase/server";
import { normalizeWordForMatch } from "@/lib/vocab-match";
import type { PartOfSpeech } from "@/lib/vocab-categories";

// Типи таблиці public.saved_words (0069_saved_words.sql) — читає і
// src/app/cabinet/dictionary/actions.ts, і (пізніше, Етап 2) компоненти
// збереження слова зі скрипту/відео/vocab-section.tsx.

export type SavedWordSourceType = "scene" | "story" | "manual";
export type SavedWordTranslationSource = "teacher" | "own" | "ai" | "none";

export type SavedWord = {
  id: string;
  userId: string;
  createdAt: string;
  sourceType: SavedWordSourceType;
  sourceId: string | null;
  productId: string | null;
  sourceTitle: string | null;
  vocabId: string | null;
  word: string;
  wordKey: string;
  translation: string | null;
  translationSource: SavedWordTranslationSource;
  partOfSpeech: PartOfSpeech | null;
  note: string | null;
  imageUrl: string | null;
  contextFr: string | null;
  contextUk: string | null;
};

export type SavedWordInput = {
  sourceType: SavedWordSourceType;
  sourceId?: string | null;
  productId?: string | null;
  sourceTitle?: string | null;
  vocabId?: string | null;
  word: string;
  translation?: string | null;
  translationSource: SavedWordTranslationSource;
  partOfSpeech?: PartOfSpeech | null;
  note?: string | null;
  imageUrl?: string | null;
  contextFr?: string | null;
  contextUk?: string | null;
};

// Рядок таблиці як повертає Supabase (snake_case) — лише в цьому файлі,
// назовні завжди йде camelCase SavedWord.
type SavedWordRow = {
  id: string;
  user_id: string;
  created_at: string;
  source_type: SavedWordSourceType;
  source_id: string | null;
  product_id: string | null;
  source_title: string | null;
  vocab_id: string | null;
  word: string;
  word_key: string;
  translation: string | null;
  translation_source: SavedWordTranslationSource;
  part_of_speech: string | null;
  note: string | null;
  image_url: string | null;
  context_fr: string | null;
  context_uk: string | null;
};

export function rowToSavedWord(row: SavedWordRow): SavedWord {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    sourceType: row.source_type,
    sourceId: row.source_id,
    productId: row.product_id,
    sourceTitle: row.source_title,
    vocabId: row.vocab_id,
    word: row.word,
    wordKey: row.word_key,
    translation: row.translation,
    translationSource: row.translation_source,
    partOfSpeech: (row.part_of_speech as PartOfSpeech | null) ?? null,
    note: row.note,
    imageUrl: row.image_url,
    contextFr: row.context_fr,
    contextUk: row.context_uk,
  };
}

// Той самий normalizeWordForMatch, що вже використовують dialogue-line.tsx/
// video-player.tsx для зіставлення слів у тексті — єдина нормалізація
// слова в усьому проєкті, дедуп-ключ саме на ній, а не на власній копії.
export function computeWordKey(word: string): string {
  return normalizeWordForMatch(word);
}

// Для Етапу 2 (кнопка-закладка в скрипті/відео): які word_key студент уже
// зберіг із конкретного джерела — щоб показати "вже збережено" без
// повторного запиту на кожне слово.
export async function listSavedWordKeysForSource(sourceId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from("saved_words")
    .select("word_key")
    .eq("user_id", user.id)
    .eq("source_id", sourceId);

  return new Set((data ?? []).map((row) => (row as { word_key: string }).word_key));
}
