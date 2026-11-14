import { normalizeWordForMatch } from "@/lib/vocab-match";
import type { PartOfSpeech } from "@/lib/vocab-categories";

// ЛИШЕ чисті типи й хелпери без побічних ефектів — жодного імпорту
// next/headers/@/lib/supabase/server тут навмисно: цей файл імпортують і
// клієнтські компоненти (SavedWordsProvider, dictionary-view.tsx), а
// Next.js бандлить МОДУЛЬ цілком, не лише використаний експорт — один
// імпорт createClient на верхньому рівні файла затягнув би next/headers у
// клієнтський бандл для всіх, хто бере звідси хоч computeWordKey.
// Серверні функції (listSavedWordsForSource) — окремо, у
// saved-words.server.ts (import "server-only").

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

// partOfSpeech — СИРИЙ рядок (не PartOfSpeech): джерело цього поля —
// VocabItem.partOfSpeech, яке саме може бути легасі-ключем
// ("adverbe_locution") чи довільним порожнім значенням. Єдина точка
// нормалізації — normalizePartOfSpeech усередині saveWord
// (src/app/cabinet/dictionary/actions.ts), щоб у БД завжди лежало те саме
// канонічне значення, яке потім без додаткової обробки читає
// /cabinet/dictionary (rowToSavedWord просто кастить його в PartOfSpeech).
export type SavedWordInput = {
  sourceType: SavedWordSourceType;
  sourceId?: string | null;
  productId?: string | null;
  sourceTitle?: string | null;
  vocabId?: string | null;
  word: string;
  translation?: string | null;
  translationSource: SavedWordTranslationSource;
  partOfSpeech?: string | null;
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

// Провідний артикль — ЛИШЕ для дедуп-ключа (ніколи для відображеного
// слова): таблиця "Вокабуляр" зберігає слово З артиклем ("un formulaire"),
// а бульбашка/панель звичайного слова зі скрипту — без нього, точно як
// воно написане в самій репліці ("formulaire"). Без цього кроку те саме
// реальне слово, збережене з двох різних місць, створювало б ДВА різних
// рядки saved_words (різні word_key) замість того, щоб друге збереження
// розпізнавалось як "уже збережено". "de la" — двослівний, перевіряється
// першим; l' — без пробілу після (l'ordre, не l' ordre).
const LEADING_ARTICLE_RE = /^(?:de la\s+|les\s+|des\s+|une\s+|un\s+|la\s+|le\s+|du\s+|l['’‘ʼ])/i;

function stripLeadingArticle(normalized: string): string {
  const stripped = normalized.replace(LEADING_ARTICLE_RE, "");
  return stripped.length > 0 ? stripped : normalized;
}

// Той самий normalizeWordForMatch, що вже використовують dialogue-line.tsx/
// video-player.tsx для зіставлення слів у тексті — єдина нормалізація
// слова в усьому проєкті, дедуп-ключ рахується ПОВЕРХ неї (стрип артикля),
// не власною копією.
export function computeWordKey(word: string): string {
  return stripLeadingArticle(normalizeWordForMatch(word));
}

export type SavedWordSourceEntry = {
  wordKey: string;
  id: string;
  translation: string | null;
  // Для панелі звичайного слова (dialogue-line.tsx) — показати ЗБЕРЕЖЕНУ
  // частину мови як read-only лейбл, коли слово вже збережене. Вже
  // канонічне значення (0069_saved_words.sql + normalizePartOfSpeech
  // усередині saveWord), читається напряму, без повторної нормалізації.
  partOfSpeech: PartOfSpeech | null;
};

// --- Приклад-речення для context_fr/context_uk (не вся репліка) --------
//
// Раніше saveWord отримував ЦІЛУ репліку як контекст — для довгих реплік
// (кілька речень) це давало невідповідний/задовгий приклад. Нижче — чисті
// хелпери (жодних серверних імпортів), що виокремлюють лише РЕЧЕННЯ з
// клікнутим словом за його символьним офсетом у рядку (не текстовим
// пошуком — слово могло повторюватись у різних реченнях).

// Скорочення, після яких крапка НЕ означає кінець речення.
const ABBREVIATIONS = new Set(["M", "Mme", "Mlle", "Mr", "Mrs", "Dr", "St", "Ste", "Pr", "Mgr", "etc"]);

// Закривні лапки/дужки одразу після розділового знаку лишаються частиною
// того самого речення (напр. «Non ! »).
const SENTENCE_CLOSERS = new Set(['"', "'", "’", "”", "»", ")", "]", "}"]);

function isTerminatorChar(ch: string | undefined): boolean {
  return ch === "." || ch === "!" || ch === "?" || ch === "…";
}

type SentenceRange = { text: string; start: number; end: number };

// Розбиває РЯДОК повністю (без втрати символів) на суміжні діапазони — на
// відміну від .filter(Boolean) після trim(), кожен символ вхідного тексту
// належить рівно одному діапазону, тож offset клікнутого слова завжди
// потрапляє в один з них (потрібно для extractSentence/extractAlignedContext
// нижче).
function splitSentenceRanges(text: string): SentenceRange[] {
  const ranges: SentenceRange[] = [];
  const n = text.length;
  let start = 0;
  let i = 0;

  while (i < n) {
    if (!isTerminatorChar(text[i])) {
      i++;
      continue;
    }

    let j = i;
    while (j < n && isTerminatorChar(text[j])) j++;
    const run = text.slice(i, j);
    const isSingleDot = run === ".";

    // Десятковий дріб (3.14) — крапка між цифрами, не кінець речення.
    if (isSingleDot && /[0-9]/.test(text[i - 1] ?? "") && /[0-9]/.test(text[j] ?? "")) {
      i = j;
      continue;
    }

    // Скорочення типу "M.", "Dr." — слово безпосередньо перед крапкою.
    if (isSingleDot) {
      const before = text.slice(0, i).match(/([A-Za-zÀ-ÖØ-öø-ÿ]+)$/);
      if (before && ABBREVIATIONS.has(before[1])) {
        i = j;
        continue;
      }
    }

    // Три крапки/« … » перед малою літерою — пауза всередині речення, не
    // його кінець (напр. "attends... je sais pas").
    const isEllipsis = run === "…" || /^\.{3,}$/.test(run);
    if (isEllipsis) {
      const rest = text.slice(j).match(/^\s*(\S)/);
      if (rest && /[a-zà-ÿ]/.test(rest[1])) {
        i = j;
        continue;
      }
    }

    // Закривні лапки/дужки — зокрема французькі « » пишуться з пробілом
    // перед закривною лапкою ("Non ! »") — тож пробіл(и) перед закривним
    // знаком теж належать цьому реченню, якщо після них таки йде закривний
    // символ (інакше пробіл — звичайний роздільник слів, не чіпаємо).
    let k = j;
    for (;;) {
      if (k < n && SENTENCE_CLOSERS.has(text[k])) {
        k++;
        continue;
      }
      if (k < n && /\s/.test(text[k])) {
        let p = k;
        while (p < n && /\s/.test(text[p])) p++;
        if (p < n && SENTENCE_CLOSERS.has(text[p])) {
          k = p + 1;
          continue;
        }
      }
      break;
    }

    // Межа речення лише якщо після розділового знака (+ закривних лапок)
    // йде пробіл або кінець рядка — інакше це не була справжня межа,
    // продовжуємо шукати далі.
    if (k >= n || /\s/.test(text[k])) {
      ranges.push({ text: text.slice(start, k), start, end: k });
      while (k < n && /\s/.test(text[k])) k++;
      start = k;
      i = k;
      continue;
    }

    i = j;
  }

  if (start < n || ranges.length === 0) {
    ranges.push({ text: text.slice(start, n), start, end: n });
  }

  return ranges;
}

// Для зовнішнього використання (вирівнювання кількості речень FR/UK) —
// самі трим(нуті)і текстові речення, без діапазонів.
export function splitIntoSentences(text: string): string[] {
  return splitSentenceRanges(text)
    .map((r) => r.text.trim())
    .filter((s) => s.length > 0);
}

// ~200 символів — щоб приклад лишався в межах лімітів БД (600) і не
// займав увесь рядок; обрізає на межі слова, додає "…".
const MAX_CONTEXT_LENGTH = 200;

function capContext(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_CONTEXT_LENGTH) return trimmed;
  const slice = trimmed.slice(0, MAX_CONTEXT_LENGTH);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trim()}…`;
}

// Повертає речення, що містить символ за офсетом offset у text (не
// текстовий пошук — одне й те саме слово може повторюватись у кількох
// реченнях репліки). word — опційний резервний текстовий пошук, лише якщо
// офсет не вдалось розв'язати (напр. розбіжність даних); якщо й він не
// знайшов речення — повертається весь рядок.
export function extractSentence(text: string, offset: number, word?: string): string {
  const ranges = splitSentenceRanges(text);
  if (ranges.length <= 1) return capContext(text);

  let match = ranges.find((r) => offset >= r.start && offset < r.end);
  if (!match && word) {
    match = ranges.find((r) => r.text.includes(word));
  }
  return capContext(match ? match.text : text);
}

// FR+UK разом: FR завжди через extractSentence вище. UK — переклад, межі
// речень можуть не збігатись 1:1 із FR, тож речення з тим самим ІНДЕКСОМ
// береться лише коли кількість речень FR і UK однакова; інакше краще
// показати цілий (коректний) переклад, ніж хибний фрагмент.
export function extractAlignedContext(
  textFr: string,
  offsetFr: number,
  textUk: string | null,
  word?: string
): { contextFr: string; contextUk: string | null } {
  const contextFr = extractSentence(textFr, offsetFr, word);
  if (!textUk || !textUk.trim()) return { contextFr, contextUk: null };

  const frRanges = splitSentenceRanges(textFr);
  const ukSentences = splitIntoSentences(textUk);
  const frIndex = frRanges.findIndex((r) => offsetFr >= r.start && offsetFr < r.end);

  if (frIndex !== -1 && frRanges.length === ukSentences.length) {
    return { contextFr, contextUk: ukSentences[frIndex] };
  }
  return { contextFr, contextUk: textUk.trim() };
}
