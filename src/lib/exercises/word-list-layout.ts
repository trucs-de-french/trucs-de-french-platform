// Спільний поріг для letter_gaps/letter_rearrangement: коли слів у вправі
// БІЛЬШЕ за це число, список переходить у дві колонки (на md і ширше — на
// мобільній лишається один стовпець незалежно від кількості). Одна
// константа для обох типів, щоб поріг не розійшовся між ними згодом.
export const TWO_COLUMN_WORD_THRESHOLD = 10;

// Клітинка (поле-пропуск/видима літера letter_gaps, плитка-літера
// letter_rearrangement) має ОДИН розмір на всю вправу — рахується від
// реальної ширини картки (use-working-tile-layout.ts), не від довжини
// власного слова картки (колишній LONG_WORD_COMPACT_THRESHOLD, видалений:
// давав картці з довгим словом дрібніші клітинки, ніж картці з коротким
// словом у тій самій вправі).

// Евристичні пороги "це слово завелике" — ЛИШЕ для показового порядку
// карток (fullFlags → useTwoColumnWordOrder: full-картки не паруються в
// кластеризації висот, clusterCardHeights/orderForTwoColumns вище).
// Фінальний md:col-span (чи влазить картка в половину ширини) рахується
// окремо, за РЕАЛЬНО виміряною шириною (use-working-tile-layout.ts
// computeWorkingSpans) — ці два пороги з ним не пов'язані, лише з порядком
// показу.
export const SINGLE_WORD_SPAN_THRESHOLD = 13;
export const PHRASE_SPAN_THRESHOLD = 18;

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

// maxUnitLength — для компактного режиму (LONG_WORD_COMPACT_THRESHOLD) і
// SINGLE_WORD_SPAN_THRESHOLD; totalLength — для PHRASE_SPAN_THRESHOLD.
export function phraseSizeInfo(items: (string | null)[]): { maxUnitLength: number; totalLength: number } {
  const units = splitPhraseUnits(items);
  return {
    maxUnitLength: units.reduce((max, u) => Math.max(max, u.length), 0),
    totalLength: units.reduce((sum, u) => sum + u.length, 0),
  };
}

// Групування карток за висотою в режимі двох колонок — за РЕАЛЬНО
// заміряною висотою вмісту (use-two-column-word-order.ts), не за
// евристичною оцінкою на основі довжини/наявності підказки/картинки:
// оцінка помилялась (напр. сама наявність підказки давала бонус майже
// всім словам, тож однорядкові слова помилково потрапляли в одну групу з
// дворядковими). "full" (md:col-span-2, дуже довге слово/фраза) — окрема
// група, що НІКОЛИ не парується, той самий критерій, що вже
// SINGLE_WORD_SPAN_THRESHOLD/PHRASE_SPAN_THRESHOLD (needsFullSpan в обох
// компонентах) — тут вона позначається як null.
export const CARD_HEIGHT_CLUSTER_TOLERANCE_PX = 12;

// Кластеризація замірених висот вмісту карток: сортує (висота, індекс) за
// зростанням висоти, відкриває нову групу щоразу, коли висота відхиляється
// від "якоря" (першої, найменшої висоти поточної групи) більш ніж на
// tolerancePx — тобто група покриває суцільний діапазон висот шириною max
// tolerancePx від свого мінімуму, не "ланцюжок" сусідніх відхилень, що міг
// би непомітно розтягнутись на набагато ширший діапазон. full-картки
// (isFull[i] === true) виключаються з кластеризації одразу — group null,
// у пару не йдуть (див. orderForTwoColumns). Повертає групу на кожен
// ВИХІДНИЙ індекс (те саме розташування, що вхідні масиви).
export function clusterCardHeights(
  heights: number[],
  isFull: boolean[],
  tolerancePx: number = CARD_HEIGHT_CLUSTER_TOLERANCE_PX
): (number | null)[] {
  const groups: (number | null)[] = new Array(heights.length).fill(null);
  const candidates = heights
    .map((h, i) => ({ i, h }))
    .filter(({ i }) => !isFull[i])
    .sort((a, b) => a.h - b.h);

  let clusterId = 0;
  let clusterAnchor = -Infinity;
  for (const { i, h } of candidates) {
    if (h - clusterAnchor > tolerancePx) {
      clusterId++;
      clusterAnchor = h;
    }
    groups[i] = clusterId;
  }
  return groups;
}

// Жадібне парування зі збереженням вихідного порядку наскільки можливо:
// іде по словах у вихідному порядку, для кожного ще не розміщеного слова з
// групою (не null) шукає НАСТУПНЕ (далі за вихідним порядком) нерозміщене
// слово ТІЄЇ Ж групи — якщо є, ставить одразу за ним (сусідній елемент
// сітки, той самий рядок у 2-колонковому grid); якщо нема — слово
// лишається самотнім у кінці своєї групи (рядок з порожньою другою
// клітинкою). null (full) НІКОЛИ не парується — завжди на своєму
// вихідному місці; md:col-span-2 сам змушує grid перенести його на новий
// рядок, якщо треба (стандартна поведінка CSS Grid auto-flow: row, БЕЗ
// dense — порядок решти карток після нього не переставляється).
//
// Загальна за типом групи (number від clusterCardHeights, чи будь-яке
// інше порівнюване значення) — сам алгоритм лише порівнює групи на
// рівність, не знає про висоти/пікселі.
//
// Повертає ПОКАЗОВИЙ порядок як масив ВИХІДНИХ індексів — виклик:
// displayOrder.map((originalIndex) => config.words[originalIndex]).
export function orderForTwoColumns<T>(groups: (T | null)[]): number[] {
  const placed = new Array(groups.length).fill(false);
  const order: number[] = [];
  for (let i = 0; i < groups.length; i++) {
    if (placed[i]) continue;
    placed[i] = true;
    order.push(i);
    if (groups[i] === null) continue;
    const partner = groups.findIndex((g, j) => j > i && !placed[j] && g === groups[i]);
    if (partner !== -1) {
      placed[partner] = true;
      order.push(partner);
    }
  }
  return order;
}
