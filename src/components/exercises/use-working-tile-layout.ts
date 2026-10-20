"use client";

import { useCallback, useEffect, useState } from "react";

// Картка-слово (WORD_CARD, word-list-layout.ts): p-3.5 = 14px з обох боків.
const CARD_PADDING_PX = 28;
// Грід-обгортка карток (letter-gaps.tsx/letter-rearrangement.tsx): gap-3 = 12px.
const COLUMN_GAP_PX = 12;
// Проміжок між літерами в межах одного слова (.letter-tile-row-gap,
// globals.css) — та сама величина, що раніше статичний gap-1 (4px).
const CELL_GAP_PX = 4;

// Еталон — РЕАЛЬНА виміряна ширина/висота/шрифт поля-пропуску letter_gaps
// у pre-check картці "se conduire" (було GAP_SIZE_CLASS="h-9 w-8"→32×36px,
// GAP_TEXT_CLASS="text-lg"→18px, word-list-layout.ts). letter_rearrangement
// (LETTER_TILE_SIZE_CLASS) виводилась із тих самих чисел, тож їхній
// "еталон" завжди був однаковий — компактний варіант (28×32px, 16px,
// COMPACT_GAP_SIZE_CLASS/COMPACT_LETTER_TEXT_CLASS) теж був спільним.
// Висота/шрифт тут — та сама частка від ширини, що в еталоні (36/32=1.125,
// 18/32=0.5625, .letter-tile-cell/.letter-tile-font у globals.css), тож
// підлога (CELL_FLOOR_PX, колишня ширина компактного варіанта) просто
// масштабує ті самі пропорції, а не вводить нове співвідношення.
const REFERENCE_CELL_PX = 32;
const CELL_FLOOR_PX = 28;

// Пре-чек картка з лампочкою-підказкою резервує pr-[52px] (40px кнопка +
// 12px, word-card-number-row) у контентній колонці — викликач передає 0,
// коли лампочка не рендериться взагалі (isDelf), інакше це число, щоб
// --cell не "стрибав" після перевірки (locked прибирає лампочку, але
// розмір клітинки має лишатись тим самим, що був до перевірки — тому
// резерв рахується від того, чи ЦЯ вправа коли-небудь показує лампочку,
// а не від поточного opts.locked конкретної картки).
export const LAMP_RESERVE_PX = 52;

// Розмір клітинки (letter_gaps поле-пропуск/видима літера,
// letter_rearrangement плитка-літера) рахується ОДИН раз на всю вправу від
// ширини ПОВНОШИРИННОЇ картки (gridRef — грід-обгортка карток), а не від
// довжини ВЛАСНОГО слова картки (колишній LONG_WORD_COMPACT_THRESHOLD):
// інакше картка з довгим словом отримувала дрібніші клітинки, ніж картка з
// коротким словом в тій самій вправі. n — довжина найдовшої одиниці
// переносу (letter_gaps: без пробілів у межах слова; letter_rearrangement:
// усе слово, бо для нього немає внутрішнього групування) по УСІХ словах
// вправи, включно з прихованими блоками.
export function useWorkingTileLayout(n: number, lampReservePx: number) {
  const [gridEl, setGridEl] = useState<HTMLElement | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const gridRef = useCallback((el: HTMLElement | null) => setGridEl(el), []);

  // ResizeObserver сам викликає callback ОДИН раз одразу після observe()
  // (частина спеки) — окремого ручного "початкового" setGridWidth не треба
  // (і він synchronously в ефекті все одно заборонений react-hooks lint).
  useEffect(() => {
    if (!gridEl) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number") setGridWidth(w);
    });
    ro.observe(gridEl);
    return () => ro.disconnect();
  }, [gridEl]);

  const fullCardInner = Math.max(0, gridWidth - CARD_PADDING_PX - lampReservePx);
  const halfCardInner = Math.max(0, (gridWidth - COLUMN_GAP_PX) / 2 - CARD_PADDING_PX - lampReservePx);

  const cell =
    n > 0 && fullCardInner > 0
      ? Math.max(CELL_FLOOR_PX, Math.min(REFERENCE_CELL_PX, (fullCardInner - (n - 1) * CELL_GAP_PX) / n))
      : CELL_FLOOR_PX;

  // Скільки клітинок влазить в ОДИН рядок половинної картки за ПОТОЧНОГО
  // розміру cell — спільна одиниця для spanForFit нижче: letter_gaps
  // дозволяє лише 1 рядок на картку (maxRows=1 — довге слово йде на всю
  // ширину, а не переноситься всередині себе), letter_rearrangement
  // дозволяє 2 рядки в половинній картці (maxRows=2 — плитки вільно
  // переносяться, лише ЗАНАДТО довге слово йде на всю ширину).
  const perHalfRow =
    halfCardInner > 0 ? Math.max(1, Math.floor((halfCardInner + CELL_GAP_PX) / (cell + CELL_GAP_PX))) : 1;

  const spanForFit = useCallback(
    (totalUnits: number, maxRows: number): 1 | 2 => {
      if (totalUnits <= 0) return 1;
      return totalUnits <= perHalfRow * maxRows ? 1 : 2;
    },
    [perHalfRow]
  );

  return { gridRef, cell, spanForFit, ready: gridWidth > 0 };
}

// Пара "коротких" карток (spanForFit(...) === 1) ділять один рядок
// грід-сітки ЛИШЕ якщо вони СУСІДИ в ПОКАЗОВОМУ порядку (displayOrder/
// blockDisplayOrder — порядок карток НЕ перераховується тут, лише
// розставляються span поверх нього). Самотня коротка картка (наступна —
// довга, або вона остання) теж іде на всю ширину — інакше порожня
// половина рядка. unitLengths — у ТОМУ Ж порядку й довжині, що видимий
// список карток.
export function computeWorkingSpans(
  unitLengths: number[],
  maxRows: number,
  spanForFit: (totalUnits: number, maxRows: number) => 1 | 2
): (1 | 2)[] {
  const isShort = unitLengths.map((u) => spanForFit(u, maxRows) === 1);
  const spans: (1 | 2)[] = new Array(unitLengths.length).fill(2);
  let i = 0;
  while (i < unitLengths.length) {
    if (isShort[i] && i + 1 < unitLengths.length && isShort[i + 1]) {
      spans[i] = 1;
      spans[i + 1] = 1;
      i += 2;
    } else {
      spans[i] = 2;
      i += 1;
    }
  }
  return spans;
}
