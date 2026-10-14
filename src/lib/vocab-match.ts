import type { VocabItem } from "./vocab";

// Спільний модуль для зіставлення vocab[].word/translatedForm у довільному
// тексті — раніше ця логіка (regex з найдовшим варіантом першим,
// обережність до порожніх слів) жила лише в dialogue-line.tsx; тепер нею
// користується й video-player.tsx (клікабельні слова в субтитрах, Крок 2
// глосарію). Поведінка для dialogue-line.tsx НЕ змінюється.

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Пряма '  і три криві варіанти (праве/ліве curly, modifier letter apostrophe)
// — трапляються в текстах залежно від того, хто й де друкував (l'ordre /
// l’ordre). Порівняння слів ігнорує, який саме символ використано; діакритики
// (é, è, ê...) лишаються значущими — НЕ чіпаємо.
const APOSTROPHE_CLASS = "['’‘ʼ]";

function toRegexAlternative(value: string): string {
  return escapeRegExp(value).replace(/['’‘ʼ]/g, APOSTROPHE_CLASS);
}

// Для порівняння (не для регулярки й не для відображення) — той самий набір
// апострофів зводиться до прямого ', регістр ігнорується.
export function normalizeWordForMatch(word: string): string {
  return word.trim().toLowerCase().replace(/[’‘ʼ]/g, "'");
}

// Спільний будівник для обох напрямків підсвітки — оригінал (за word) і
// переклад (за translatedForm) — принцип "найдовший варіант першим" (щоб
// довша фраза не "з'їдалась" коротшим словом, що є її частиною).
//
// Порожні/пробільні слова відфільтровуються ТУТ, а не покладаються на
// виклик уже відфільтрувати — порожній рядок у альтернативах регулярки
// (напр. vocab-запис {word: ""}, залишений ненавмисно) дає ПОРОЖНЮ групу
// захоплення (new RegExp("()")), яка матчить нульової довжини рядок УСЮДИ
// (між кожною парою символів) — text.split на такому regex розбиває
// репліку по одній літері. null — сигнал викликачу, що підсвічувати нічого.
export function buildHighlightRegex(words: string[]): RegExp | null {
  const meaningful = words.map((w) => w.trim()).filter((w) => w.length > 0);
  if (meaningful.length === 0) return null;
  const alternatives = [...meaningful].sort((a, b) => b.length - a.length).map(toRegexAlternative);
  return new RegExp(`(${alternatives.join("|")})`, "giu");
}

// Кілька варіантів одного слова через кому в полі word (напр. "signer,
// signe") — вчителька вписує їх вручну, кожен варіант підсвічується
// незалежно, якщо трапляється в тексті репліки.
export function splitVariants(word: string): string[] {
  return word
    .split(",")
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

export function buildVocabRegex(vocab: VocabItem[]): RegExp | null {
  return buildHighlightRegex(vocab.flatMap((v) => splitVariants(v.word)));
}

// Зворотне зіставлення "варіант -> VocabItem", щоб клік на підсвічений
// фрагмент показував переклад ТОГО item, якому цей варіант належить (а не
// завжди першого item зі списку). Якщо два items випадково діляться
// однаковим варіантом — виграє перший за порядком масиву (map.has не дає
// перезаписати), детерміновано, без падіння. Ключ — normalizeWordForMatch,
// щоб матч із іншим символом апострофа все одно знайшов той самий item.
export function buildVariantMap<T extends VocabItem>(vocab: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const v of vocab) {
    for (const variant of splitVariants(v.word)) {
      const key = normalizeWordForMatch(variant);
      if (!map.has(key)) map.set(key, v);
    }
  }
  return map;
}

export type VocabMatchPart<T extends VocabItem = VocabItem> =
  | { type: "text"; text: string }
  | { type: "match"; text: string; item: T };

// Токенізація тексту репліки за vocab[].word — викликачу лишається тільки
// відрендерити кожну частину (plain text чи клікабельне слово). Той самий
// порядок частин, що дає text.split(regex): непарні індекси — завжди
// збіги завдяки групі захоплення в регулярці. Generic — щоб додаткові поля
// викликача (напр. VideoVocabItem.example, vocab.ts) не губились у "match".
export function matchVocabInText<T extends VocabItem>(text: string, vocab: T[]): VocabMatchPart<T>[] {
  const meaningful = vocab.filter((v) => v.word.trim());
  const regex = buildVocabRegex(meaningful);
  if (!regex) return [{ type: "text", text }];

  const variantMap = buildVariantMap(meaningful);
  return text.split(regex).map((part) => {
    const match = part ? variantMap.get(normalizeWordForMatch(part)) : undefined;
    return match ? { type: "match", text: part, item: match } : { type: "text", text: part };
  });
}

// Те саме для перекладеної репліки — зіставлення за translatedForm, не word.
export function matchTranslatedFormInText<T extends VocabItem>(text: string, vocab: T[]): VocabMatchPart<T>[] {
  const withForm = vocab.filter((v) => v.translatedForm?.trim());
  const regex = buildHighlightRegex(withForm.map((v) => v.translatedForm as string));
  if (!regex) return [{ type: "text", text }];

  return text.split(regex).map((part) => {
    const match = part
      ? withForm.find((v) => normalizeWordForMatch(v.translatedForm as string) === normalizeWordForMatch(part))
      : undefined;
    return match ? { type: "match", text: part, item: match } : { type: "text", text: part };
  });
}
