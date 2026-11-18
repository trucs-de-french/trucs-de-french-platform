"use server";

import { createClient } from "@/lib/supabase/server";
import { rowToSavedWord, type SavedWord } from "@/lib/cabinet/saved-words";
import { PART_OF_SPEECH_ORDER, type PartOfSpeech } from "@/lib/vocab-categories";
import {
  buildDistractorPool,
  computeTrainingOverview,
  selectTrainingWords,
  TRAINING_LIMITS,
  type TrainingFilter,
  type TrainingLimit,
  type TrainingOverview,
  type TrainingPoolWord,
  type WordTrainingStats,
} from "@/lib/cabinet/word-training";

// Крок 1 (лише дані, без UI) — нічого в існуючому інтерфейсі ще не
// викликає ці дії. "unavailable" — окремий від "db": міграція
// 0070_word_training_stats.sql ще не застосована (застосовується вручну
// в Supabase SQL Editor, не цим кодом) — Postgres віддає
// undefined_table (42P01), і дії мають тихо повернути це як чекану
// помилку, а не впасти/зламати сторінку словника.
type ActionError = "auth" | "validation" | "db" | "unavailable";

const TRAINING_STATS_TABLE = "word_training_stats";
const MAX_WORDS = 1000;
const MAX_BATCH_RESULTS = 200;

function isUndefinedTableError(error: { code?: string } | null): boolean {
  return error?.code === "42P01";
}

type LoadedOwnWords =
  | { ok: true; words: SavedWord[]; statsByWordId: Record<string, WordTrainingStats> }
  | { ok: false; error: ActionError };

// Спільний зчит для getTrainingOverview/loadTrainingWords — слова
// студента (saved_words, той самий запит, що /cabinet/dictionary) +
// його статистика тренувань, об'єднані за saved_word_id.
async function loadOwnWordsWithStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<LoadedOwnWords> {
  const { data: rows, error: wordsError } = await supabase
    .from("saved_words")
    .select("*")
    .eq("user_id", userId)
    .limit(MAX_WORDS);
  if (wordsError) return { ok: false, error: "db" };
  const words = (rows ?? []).map(rowToSavedWord);

  const { data: statsRows, error: statsError } = await supabase
    .from(TRAINING_STATS_TABLE)
    .select("saved_word_id, attempts, correct, last_correct, last_trained_at")
    .eq("user_id", userId);
  if (statsError) {
    return { ok: false, error: isUndefinedTableError(statsError) ? "unavailable" : "db" };
  }

  const statsByWordId: Record<string, WordTrainingStats> = {};
  for (const row of statsRows ?? []) {
    statsByWordId[row.saved_word_id as string] = {
      attempts: row.attempts as number,
      correct: row.correct as number,
      lastCorrect: row.last_correct as boolean | null,
      lastTrainedAt: row.last_trained_at as string | null,
    };
  }

  return { ok: true, words, statsByWordId };
}

export async function getTrainingOverview(): Promise<
  { ok: true; overview: TrainingOverview } | { ok: false; error: ActionError }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const loaded = await loadOwnWordsWithStats(supabase, user.id);
  if (!loaded.ok) return loaded;

  return { ok: true, overview: computeTrainingOverview(loaded.words, loaded.statsByWordId) };
}

// Сервер не довіряє клієнтським filter/category/limit напряму (той самий
// принцип, що validateInput у ../actions.ts) — будь-що невідоме тихо
// падає до найширшого безпечного значення ("all"), не до помилки: це
// лише ЧИТАННЯ вибірки слів, невалідний параметр найбезпечніше звести до
// "без фільтра".
function validateFilter(raw: string | null | undefined): TrainingFilter {
  return raw === "new" || raw === "weak" ? raw : "all";
}

function validateCategory(raw: string | null | undefined): PartOfSpeech | "none" | "all" {
  if (!raw || raw === "all") return "all";
  if (raw === "none") return "none";
  return (PART_OF_SPEECH_ORDER as readonly string[]).includes(raw) ? (raw as PartOfSpeech) : "all";
}

function validateLimit(raw: number | "all" | null | undefined): TrainingLimit {
  if (raw === "all") return "all";
  return (TRAINING_LIMITS as readonly (number | "all")[]).includes(raw as number) ? (raw as TrainingLimit) : "all";
}

// Лише поля, потрібні вправам кроку 3-4 (flip cards/переклад/анаграма/
// gap-fill) — не весь SavedWord (без wordKey/sourceType/note тощо, вони
// тут не потрібні).
export type TrainingWord = Pick<
  SavedWord,
  "id" | "word" | "translation" | "partOfSpeech" | "contextFr" | "contextUk" | "imageUrl"
>;

export async function loadTrainingWords(input: {
  filter?: TrainingFilter;
  category?: PartOfSpeech | "none" | "all";
  limit?: TrainingLimit;
}): Promise<{ ok: true; words: TrainingWord[]; pool: TrainingPoolWord[] } | { ok: false; error: ActionError }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const loaded = await loadOwnWordsWithStats(supabase, user.id);
  if (!loaded.ok) return loaded;

  const selected = selectTrainingWords(loaded.words, loaded.statsByWordId, {
    filter: validateFilter(input.filter),
    category: validateCategory(input.category),
    limit: validateLimit(input.limit),
  });

  const words: TrainingWord[] = selected.map((w) => ({
    id: w.id,
    word: w.word,
    translation: w.translation,
    partOfSpeech: w.partOfSpeech,
    contextFr: w.contextFr,
    contextUk: w.contextUk,
    imageUrl: w.imageUrl,
  }));

  // Пул дистракторів — з ПОВНОГО loaded.words (до selectTrainingWords),
  // тож незалежний від filter/category/limit, що студент обрав для самої
  // сесії (задача: пул "regardless of the selected filter/category/limit").
  const pool = buildDistractorPool(loaded.words);

  return { ok: true, words, pool };
}

export type TrainingResultInput = { savedWordId: string; correct: boolean };

function validateResults(raw: unknown): TrainingResultInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_BATCH_RESULTS) return null;
  const results: TrainingResultInput[] = [];
  for (const entry of raw) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as { savedWordId?: unknown }).savedWordId !== "string" ||
      (entry as { savedWordId: string }).savedWordId.length === 0 ||
      typeof (entry as { correct?: unknown }).correct !== "boolean"
    ) {
      return null;
    }
    results.push({
      savedWordId: (entry as { savedWordId: string }).savedWordId,
      correct: (entry as { correct: boolean }).correct,
    });
  }
  return results;
}

// Накопичувальний upsert (attempts+1, correct+1 якщо правильно) за один
// батч — ОДИН upsert-запит на весь масив результатів (не цикл insert/
// update на кожне слово), плюс дві звірки ПЕРЕД ним: які saved_word_id
// справді належать цьому студенту (друга перевірка поверх RLS — клієнт
// не повинен змогти тихо завести рядок статистики для чужого слова,
// навіть підмінивши id у запиті), і яка статистика по них уже є (щоб
// порахувати НОВІ attempts/correct, бо supabase-js upsert не підтримує
// SQL-вираз "attempts = attempts + 1" без raw SQL/RPC).
export async function recordTrainingResults(
  results: TrainingResultInput[]
): Promise<{ ok: boolean; error?: ActionError }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const validated = validateResults(results);
  if (!validated) return { ok: false, error: "validation" };

  const wordIds = [...new Set(validated.map((r) => r.savedWordId))];

  const { data: ownedRows, error: ownedError } = await supabase
    .from("saved_words")
    .select("id")
    .eq("user_id", user.id)
    .in("id", wordIds);
  if (ownedError) return { ok: false, error: isUndefinedTableError(ownedError) ? "unavailable" : "db" };
  const ownedIds = new Set((ownedRows ?? []).map((r) => r.id as string));

  const { data: existingRows, error: existingError } = await supabase
    .from(TRAINING_STATS_TABLE)
    .select("saved_word_id, attempts, correct")
    .eq("user_id", user.id)
    .in("saved_word_id", wordIds);
  if (existingError) {
    return { ok: false, error: isUndefinedTableError(existingError) ? "unavailable" : "db" };
  }
  const existingByWordId = new Map(
    (existingRows ?? []).map((r) => [
      r.saved_word_id as string,
      { attempts: r.attempts as number, correct: r.correct as number },
    ])
  );

  const now = new Date().toISOString();
  const upsertRows = validated
    .filter((r) => ownedIds.has(r.savedWordId))
    .map((r) => {
      const existing = existingByWordId.get(r.savedWordId);
      return {
        user_id: user.id,
        saved_word_id: r.savedWordId,
        attempts: (existing?.attempts ?? 0) + 1,
        correct: (existing?.correct ?? 0) + (r.correct ? 1 : 0),
        last_correct: r.correct,
        last_trained_at: now,
      };
    });

  if (upsertRows.length === 0) return { ok: true };

  const { error: upsertError } = await supabase
    .from(TRAINING_STATS_TABLE)
    .upsert(upsertRows, { onConflict: "user_id,saved_word_id" });
  if (upsertError) return { ok: false, error: isUndefinedTableError(upsertError) ? "unavailable" : "db" };

  return { ok: true };
}
