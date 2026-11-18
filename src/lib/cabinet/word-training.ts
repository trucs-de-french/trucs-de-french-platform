import { PART_OF_SPEECH_ORDER, type PartOfSpeech } from "@/lib/vocab-categories";
import type { SavedWord } from "@/lib/cabinet/saved-words";
import { QUESTION_TYPES, type QuestionType } from "@/lib/cabinet/word-training-session";

// ЛИШЕ чисті типи й хелпери (без next/headers/@/lib/supabase/server) —
// той самий принцип, що saved-words.ts: і клієнтський майбутній UI (крок
// 3-4), і серверні дії (train/actions.ts) читають звідси, тож жоден
// імпорт сервера не повинен затягуватись у клієнтський бандл.

// "Тренувати мої слова" — фільтр списку слів для тренування. "weak" —
// рахується через isWeak нижче (остання відповідь неправильна ЧИ
// correct/attempts < TRAINING_WEAK_ACCURACY_THRESHOLD), "new" — немає
// жодного рядка статистики (ще не тренували).
export type TrainingFilter = "all" | "new" | "weak";

export const TRAINING_WEAK_ACCURACY_THRESHOLD = 0.6;

export const TRAINING_LIMITS = [10, 20, 30, 40, "all"] as const;
export type TrainingLimit = (typeof TRAINING_LIMITS)[number];

// Легасі id-и типів вправ (крок 2, до об'єднання словників — звіт
// комміту 379d493) — setup-екран колись сам видавав ці рядки в query
// "types", не канонічні QuestionType з word-training-session.ts;
// мапляться нижче, щоб старі збережені посилання/закладки з
// types=flip_cards,... і т.п. й далі працювали.
const LEGACY_TRAINING_TYPE_ALIASES: Record<string, QuestionType> = {
  flip_cards: "cards",
  translation_choice: "choice",
  sentence_gap: "gap",
};

// Валідатори query-параметрів setup/play-екранів (train/page.tsx,
// train/play/page.tsx) — ОДНА точка правди, щоб "Назад" із сесії на
// setup і прямий перехід на /train/play з тим самим query string
// розбирали filter/category/limit/types ОДНАКОВО (раніше обидві
// сторінки тримали власні копії тих самих трьох перевірок).
export function parseTrainingFilterParam(raw: string | null | undefined): TrainingFilter {
  return raw === "new" || raw === "weak" ? raw : "all";
}

export function parseTrainingCategoryParam(raw: string | null | undefined): PartOfSpeech | "none" | "all" {
  if (!raw || raw === "all") return "all";
  if (raw === "none") return "none";
  return (PART_OF_SPEECH_ORDER as readonly string[]).includes(raw) ? (raw as PartOfSpeech) : "all";
}

export function parseTrainingLimitParam(raw: string | null | undefined): TrainingLimit {
  if (raw === "all") return "all";
  const n = Number(raw);
  return (TRAINING_LIMITS as readonly (number | "all")[]).includes(n) ? (n as TrainingLimit) : "all";
}

// "types" — той самий канонічний QuestionType-словник, що buildSession
// (word-training-session.ts) сам використовує, тож setup-перемикачі,
// query-параметр і сесія завжди говорять ОДНОЮ мовою; легасі-назви
// (LEGACY_TRAINING_TYPE_ALIASES вище) мапляться ДО фільтрації.
export function parseTrainingExerciseTypesParam(raw: string | null | undefined): QuestionType[] {
  if (!raw) return QUESTION_TYPES;
  const picked = raw
    .split(",")
    .map((v) => LEGACY_TRAINING_TYPE_ALIASES[v] ?? v)
    .filter((v): v is QuestionType => (QUESTION_TYPES as readonly string[]).includes(v));
  return picked.length > 0 ? picked : QUESTION_TYPES;
}

// Знятий з word_training_stats рядок (camelCase, той самий підхід, що
// SavedWord у saved-words.ts) — attempts/correct завжди накопичувальні
// (upsert у recordTrainingResults, не окремий рядок на спробу).
export type WordTrainingStats = {
  attempts: number;
  correct: number;
  lastCorrect: boolean | null;
  lastTrainedAt: string | null;
};

export type WordClassification = "new" | "weak" | "ok";

export function isWeak(stats: WordTrainingStats | null | undefined): boolean {
  if (!stats || stats.attempts === 0) return false;
  if (stats.lastCorrect === false) return true;
  return stats.correct / stats.attempts < TRAINING_WEAK_ACCURACY_THRESHOLD;
}

// word — лишено в сигнатурі (задача: classifyWord(word, stats?)) на
// випадок майбутніх правил "за самим словом" (довжина, категорія); поки
// класифікація залежить лише від stats.
export function classifyWord(
  word: Pick<SavedWord, "id">,
  stats?: WordTrainingStats | null
): WordClassification {
  if (!stats || stats.attempts === 0) return "new";
  return isWeak(stats) ? "weak" : "ok";
}

export type TrainingOverview = {
  total: number;
  newCount: number;
  weakCount: number;
  // "none" — слова без partOfSpeech (null), той самий принцип, що
  // фільтр категорій на картках словника.
  categoryCounts: Partial<Record<PartOfSpeech | "none", number>>;
};

export function computeTrainingOverview(
  words: SavedWord[],
  statsByWordId: Record<string, WordTrainingStats | undefined>
): TrainingOverview {
  let newCount = 0;
  let weakCount = 0;
  const categoryCounts: Partial<Record<PartOfSpeech | "none", number>> = {};

  for (const w of words) {
    const key = w.partOfSpeech ?? "none";
    categoryCounts[key] = (categoryCounts[key] ?? 0) + 1;

    const classification = classifyWord(w, statsByWordId[w.id]);
    if (classification === "new") newCount++;
    else if (classification === "weak") weakCount++;
  }

  return { total: words.length, newCount, weakCount, categoryCounts };
}

// Fisher-Yates — той самий алгоритм, що приватний shuffle() у
// vocab-quiz-logic.ts (не експортований звідти, тож не переносимо
// залежність — цей модуль навмисно без залежностей від інших exercises).
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export type SelectTrainingWordsOptions = {
  filter: TrainingFilter;
  category?: PartOfSpeech | "none" | "all";
  limit: TrainingLimit;
};

// Чисто: жодного читання БД тут — statsByWordId вже знятий викликачем
// (train/actions.ts). Коли candidates більше за limit — спершу сортуємо
// "довше не тренував(и) першими" (ніколи не треновані, lastTrainedAt
// null, йдуть ПЕРЕД будь-якою датою), беремо перші `limit`, і лише ПОТІМ
// перемішуємо обраний набір — щоб порядок тренування не повторював сам
// "найдовше занедбаний" список щоразу, а відбір все ж був зважений саме
// на занедбаність.
export function selectTrainingWords(
  words: SavedWord[],
  statsByWordId: Record<string, WordTrainingStats | undefined>,
  opts: SelectTrainingWordsOptions
): SavedWord[] {
  const category = opts.category ?? "all";

  const candidates = words.filter((w) => {
    if (category !== "all") {
      const matchesCategory = category === "none" ? w.partOfSpeech === null : w.partOfSpeech === category;
      if (!matchesCategory) return false;
    }
    const stats = statsByWordId[w.id];
    if (opts.filter === "new") return !stats || stats.attempts === 0;
    if (opts.filter === "weak") return isWeak(stats);
    return true;
  });

  if (opts.limit === "all" || candidates.length <= opts.limit) {
    return shuffle(candidates);
  }

  const sorted = [...candidates].sort((a, b) => {
    const at = statsByWordId[a.id]?.lastTrainedAt ?? null;
    const bt = statsByWordId[b.id]?.lastTrainedAt ?? null;
    if (at === bt) return 0;
    if (at === null) return -1;
    if (bt === null) return 1;
    return new Date(at).getTime() - new Date(bt).getTime();
  });

  return shuffle(sorted.slice(0, opts.limit));
}

// "Якщо зіставлення складне — просто вимагай непорожній context_fr" (сама
// задача дозволяє цю спрощену версію): пошук слова В ТОЧНІЙ формі всередині
// context_fr ненадійний (той самий клас проблем, що getTranslatedForms/
// matchVocabInText у vocab.ts — слово може стояти в іншому відмінку/формі,
// з іншим артиклем тощо), тож тут лише перевірка "приклад узагалі є".
export function hasSentenceGapFill(word: Pick<SavedWord, "contextFr">): boolean {
  return !!word.contextFr && word.contextFr.trim().length > 0;
}
