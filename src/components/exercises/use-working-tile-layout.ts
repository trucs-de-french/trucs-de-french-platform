"use client";

import { useCallback, useEffect, useState } from "react";

// Картка-слово (WORD_CARD, word-list-layout.ts): p-3.5 = 14px з обох боків.
const CARD_PADDING_PX = 28;
// Грід-обгортка карток (letter-gaps.tsx/letter-rearrangement.tsx): gap-3 = 12px.
const COLUMN_GAP_PX = 12;

// ОДИН фіксований розмір клітинки на обидві вправи — літера-поле-пропуск і
// видима літера letter_gaps, плитка-літера letter_rearrangement — НІКОЛИ не
// змінюється шириною екрана/картки (на відміну від попередньої версії,
// де --cell рахувався від виміряної ширини з підлогою 28px). Значення —
// РЕАЛЬНО виміряні розміри картки "se conduire" (letter-tile-cell/-font/
// -row-gap, globals.css) до ВСІХ попередніх адаптивних версій.
export const FIXED_CELL_PX = 32;
export const FIXED_CELL_GAP_PX = 3.4;

// Пре-чек картка з лампочкою-підказкою резервує pr-[52px] (40px кнопка +
// 12px, word-card-number-row) у контентній колонці — викликач передає 0,
// коли лампочка не рендериться взагалі (isDelf), інакше це число, щоб
// розрахунок не "стрибав" після перевірки (locked прибирає лампочку, але
// розмір клітинки й так фіксований — резерв тут потрібен лише для
// коректного підрахунку, скільки клітинок влазить в рядок).
export const LAMP_RESERVE_PX = 52;

// Поріг переходу на дві колонки — ШИРИНА грід-обгортки карток (не кількість
// слів у вправі, як було раніше TWO_COLUMN_WORD_THRESHOLD). Вибір числа:
// половина картки (ширина_обгортки - COLUMN_GAP_PX)/2 - CARD_PADDING_PX -
// LAMP_RESERVE_PX має вмістити 11-клітинкову групу (найдовше слово в
// "наших" тестових даних, напр. "ingratitude") за FIXED_CELL_PX/
// FIXED_CELL_GAP_PX: 11*32 + 10*3.4 = 386px потрібно всередині половини
// картки ⇒ (W-12)/2-28-52 >= 386 ⇒ W >= 2*(386+28+52)+12 = 944px. 1100px —
// кругле число з запасом (944px — точний мінімум; 1100 лишає ~78px запасу
// на типові поля сторінки й гарантує, що межа 1099/1100 з ТЗ дає
// передбачуваний, легко перевірюваний результат незалежно від того,
// скільки саме padding додає конкретна сторінка-обгортка).
export const TWO_COLUMN_BREAKPOINT_PX = 1100;

// Клас Tailwind-варіанта з тим самим числом — єдине місце, що його задає,
// щоб розмітка (letter-gaps.tsx/letter-rearrangement.tsx) і цей хук не
// розійшлися.
export const TWO_COLUMN_GRID_CLASS = "min-[1100px]:grid-cols-2";
export const TWO_COLUMN_SPAN_CLASS = "min-[1100px]:col-span-2";

// Розбиває n клітинок на рядки по максимум perLine, збалансовано (рядки
// відрізняються не більше ніж на 1 клітинку), а не "жадібно по перLine, а
// залишок на останній рядок" — жадібний варіант міг дати рядок з ОДНІЄЮ
// клітинкою (11 клітинок / 7 на рядок → [7, 1]). Збалансований розподіл
// гарантує мінімум 2 клітинки на рядок, щойно rows>=2 і perLine>=2 (приклад
// 11/7 → [6, 5]), чого вимагає ТЗ ("не лишати 1 клітинку саму на рядку").
export function chunkIntoRows(n: number, perLine: number): number[] {
  if (perLine <= 0 || n <= perLine) return [n];
  const rows = Math.ceil(n / perLine);
  const base = Math.floor(n / rows);
  const rem = n - base * rows;
  return Array.from({ length: rows }, (_, i) => base + (i < rem ? 1 : 0));
}

// Вимірює ширину грід-обгортки карток (gridRef) і стежить за медіа-запитом
// двоколонкового порогу — звідси й half-card/full-card "внутрішня" ширина
// (за відрахуванням padding картки й резерву лампочки), яка потрібна лише
// для вирішення (а) чи влазить найдовша група картки в половину рядка
// (spanForFit/computeWorkingSpans нижче — те саме "чи картці потрібен
// повний рядок", що раніше) і (б) скільки клітинок фіксованого розміру
// влазить у рядок картки для переносу ВСЕРЕДИНІ слова (perLineFor,
// letter-gaps.tsx). Сам розмір клітинки більше НЕ рахується тут — він
// завжди FIXED_CELL_PX (CSS, globals.css).
export function useWorkingTileLayout(lampReservePx: number) {
  const [gridEl, setGridEl] = useState<HTMLElement | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const gridRef = useCallback((el: HTMLElement | null) => setGridEl(el), []);

  useEffect(() => {
    if (!gridEl) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number") setGridWidth(w);
    });
    ro.observe(gridEl);
    return () => ro.disconnect();
  }, [gridEl]);

  const [twoColumn, setTwoColumn] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${TWO_COLUMN_BREAKPOINT_PX}px)`);
    const update = () => setTwoColumn(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const fullCardInner = Math.max(0, gridWidth - CARD_PADDING_PX - lampReservePx);
  const halfCardInner = Math.max(0, (gridWidth - COLUMN_GAP_PX) / 2 - CARD_PADDING_PX - lampReservePx);
  const step = FIXED_CELL_PX + FIXED_CELL_GAP_PX;

  const perLineFull = gridWidth > 0 ? Math.max(1, Math.floor((fullCardInner + FIXED_CELL_GAP_PX) / step)) : 1;
  const perLineHalf = gridWidth > 0 ? Math.max(1, Math.floor((halfCardInner + FIXED_CELL_GAP_PX) / step)) : 1;

  const spanForFit = useCallback(
    (totalUnits: number, maxRows: number): 1 | 2 => {
      if (totalUnits <= 0) return 1;
      return totalUnits <= perLineHalf * maxRows ? 1 : 2;
    },
    [perLineHalf]
  );

  // Скільки клітинок влазить в один рядок КОНКРЕТНОЇ картки — full-span
  // картка (2) завжди бере повну ширину (повний рядок, і в одноколонковому
  // режимі теж: !twoColumn означає "кожна картка — повна ширина незалежно
  // від обчисленого span", бо колонок в принципі нема).
  const perLineFor = useCallback(
    (span: 1 | 2): number => (!twoColumn || span === 2 ? perLineFull : perLineHalf),
    [twoColumn, perLineFull, perLineHalf]
  );

  return { gridRef, twoColumn, spanForFit, perLineFor, ready: gridWidth > 0 };
}

// Пара "коротких" карток (spanForFit(...) === 1) ділять один рядок
// грід-сітки ЛИШЕ якщо вони СУСІДИ в ПОКАЗОВОМУ порядку (displayOrder/
// blockDisplayOrder — порядок карток НЕ перераховується тут, лише
// розставляються span поверх нього). Самотня коротка картка (наступна —
// довга, або вона остання) теж іде на всю ширину — інакше порожня
// половина рядка. unitLengths — у ТОМУ Ж порядку й довжині, що видимий
// список карток. Нижче 1100px-порогу span-класи (TWO_COLUMN_SPAN_CLASS)
// просто не мають ефекту (grid-cols:1) — тож рахувати їх можна завжди,
// без додаткової умови на twoColumn.
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
