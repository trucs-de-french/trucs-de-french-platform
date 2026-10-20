// Картка одного слова — та сама легка рамка/фон, що картки тверджень
// true_false (border-gray-100 там трохи світліший за наш border-gray-200,
// свідомо: тут картка сама по собі є одиницею сітки, а не рядком у списку,
// тож трохи чіткіша межа доречніша). min-w-0 — щоб картка-елемент grid/flex
// могла звужуватись/переносити вміст, а не розпирала сітку своїм
// мінімальним контентом (довге слово/плитки). justify-start (було
// justify-center) — вміст починається з ВЕРХУ картки: коли grid розтягує
// картку до висоти вищого сусіда в тому самому рядку (align-items: stretch
// за замовчуванням у CSS grid), номер+підказка мають лишатись на ОДНІЙ
// висоті в обох картках рядка, а не "спливати" до центру короткої картки;
// на горизонтальне вирівнювання (зліва) не впливає — це вісь flex-col.
export const WORD_CARD =
  "flex min-w-0 flex-col justify-start gap-2 rounded-[14px] dark:rounded-lg border-[1.5px] dark:border glass-chip border-[#dcbd6e] bg-white p-3.5 glass-gap-shadow dark:shadow-sm dark:border-neutral-700 dark:bg-neutral-800";

// Розбиває фразу на "одиниці переносу" за пробілом — сам пробіл ВІДКИДАЄТЬСЯ
// (він стає gap-2 у розкладці, не окремим елементом). Спільна для
// letter_gaps (T = string | null, null — прихована позиція) і
// letter_rearrangement (T = string, готові символи без масок) — обидва
// типи мають лінійний масив "символ на позицію", де пробіл — звичайний
// елемент з таким самим значенням " ".
export function splitPhraseUnits<T extends string | null>(items: T[]): T[][] {
  const units: T[][] = [[]];
  for (const item of items) {
    if (item === " ") {
      units.push([]);
    } else {
      units[units.length - 1].push(item);
    }
  }
  return units.filter((u) => u.length > 0);
}
