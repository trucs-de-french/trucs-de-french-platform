// Автоматичний вибір hiddenIndices для letter_gaps — опційна дія поруч із
// ручним кліком на символи (LetterGapsWordRow), не заміна: вчителька й далі
// може підправити результат вручну після застосування.
export type LetterHideMode = "default" | "vowels" | "every_second";

// Французькі голосні з діакритикою — той самий перелік, що уточнила
// вчителька (é è ê ë à â î ï ô û ù ü ÿ œ æ), плюс базові a e i o u y.
const FRENCH_VOWELS = new Set([
  "a", "e", "i", "o", "u", "y",
  "é", "è", "ê", "ë", "à", "â", "î", "ï", "ô", "û", "ù", "ü", "ÿ", "œ", "æ",
]);

function isLetter(ch: string): boolean {
  return /\p{L}/u.test(ch);
}

function isVowel(ch: string): boolean {
  return FRENCH_VOWELS.has(ch.toLowerCase());
}

// Правила (уточнені вчителькою):
// - перша літера НІКОЛИ не приховується, у жодному режимі;
// - пробіли/апострофи/дефіси (усе, що не \p{L}) НІКОЛИ не приховуються —
//   лишаються звичайними видимими символами-плитками;
// - у кожному слові — щонайменше один пропуск (якщо взагалі є що ховати) і
//   щонайменше одна видима літера, крім першої (не можна приховати геть усі
//   "ховані" позиції одразу);
// - слова до 3 літер (рахуючи першу) — РІВНО один пропуск, незалежно від
//   режиму;
// - "default" (~40%) — щонайменше 1 позиція після округлення;
// - "vowels" — усі французькі голосні серед "хованих" позицій;
// - "every_second" — 2-га, 4-га, 6-га... літера слова (рахунок від першої,
//   яка сама НІКОЛИ не ховається, тож "друга" літера — це вже перший
//   елемент hideable).
export function computeAutoHiddenIndices(word: string, mode: LetterHideMode): number[] {
  const chars = word.split("");
  const hideable = chars
    .map((ch, i) => ({ ch, i }))
    .filter(({ ch, i }) => i > 0 && isLetter(ch))
    .map(({ i }) => i);

  if (hideable.length === 0) return [];

  const letterCount = chars.filter(isLetter).length;

  let target: number[];
  switch (mode) {
    case "vowels":
      target = hideable.filter((i) => isVowel(chars[i]));
      break;
    case "every_second":
      target = hideable.filter((_, idx) => idx % 2 === 0);
      break;
    case "default":
    default: {
      const count = Math.max(1, Math.round(hideable.length * 0.4));
      const shuffled = [...hideable].sort(() => Math.random() - 0.5);
      target = shuffled.slice(0, count);
      break;
    }
  }

  // Короткі слова — рівно один пропуск. Лише коли є з чого вибирати
  // (hideable.length >= 2) — при РІВНО одній хованій позиції "лишити ще й
  // видиму серед хованих" фізично неможливо, тож нижче це вже й так
  // єдиний можливий варіант.
  if (letterCount <= 3 && hideable.length >= 2) {
    target = target.length > 0 ? [target[0]] : [hideable[0]];
  }

  // Режим не дав жодного збігу (напр. "vowels" на слові без голосних серед
  // hideable) — усе одно потрібен хоча б один пропуск.
  if (target.length === 0) {
    target = [hideable[Math.floor(hideable.length / 2)]];
  }

  // Не приховувати геть усі "ховані" позиції — лишити бодай одну видиму,
  // крім першої літери (неможливо, коли hideable.length === 1 — тоді
  // пріоритет "є хоч один пропуск" переважає).
  if (target.length >= hideable.length && hideable.length > 1) {
    target = target.slice(0, hideable.length - 1);
  }

  return [...new Set(target)].sort((a, b) => a - b);
}
