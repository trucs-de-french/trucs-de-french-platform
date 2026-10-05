// Вибір виду підказки слова — спільний для легенди філворду (word-search.tsx)
// і підказок кросворду (crossword.tsx), щоб блоковий clueMode (WordSearchBlock/
// CrosswordBlock.clueMode, types.ts, ЕТАП A/3) не дублював цю логіку в
// обох файлах.
//
// - "short" — завжди компактний текст, картинка НЕ показується, навіть
//   якщо в слова є imageUrl (сам clueMode це вирішує для ВСЬОГО блоку).
// - "long" — завжди текстова картка (картинка, якщо є, лишається видимою
//   всередині картки — так само, як і зараз для clueStyle "long").
// - "image" — картка-картинка, якщо imageUrl є; інакше фолбек на текстову
//   картку цього ж слова (підказка не зникає).
// - undefined — те саме рішення, що й ІСНУЮЧА (до ЕТАПУ A) логіка без
//   явного режиму: картинка є → картка-картинка; "довга"
//   підказка(clueStyle "long") чи аудіо (без картинки) → текстова картка;
//   інакше — компактний текст. Production-код (word-search.tsx/
//   crossword.tsx) усе одно лишає свою ІСНУЮЧУ гілку буквально без змін
//   для mode===undefined (байтова відповідність), ця гілка тут — лише щоб
//   функція мала повну, тестовану відповідність старій поведінці
//   (скриптова перевірка етапу A), а не бо production її викликає.
export type ClueView = "text-compact" | "text-card" | "image-card";
export type ClueMode = "short" | "long" | "image";

export function resolveClueView(
  mode: ClueMode | undefined,
  word: { imageUrl?: string; clueStyle?: "short" | "long"; audioUrl?: string }
): ClueView {
  if (mode === undefined) {
    if (word.imageUrl) return "image-card";
    if (word.clueStyle === "long" || word.audioUrl) return "text-card";
    return "text-compact";
  }
  if (mode === "short") return "text-compact";
  if (mode === "long") return "text-card";
  return word.imageUrl ? "image-card" : "text-card";
}
