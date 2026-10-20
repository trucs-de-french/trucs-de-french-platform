"use client";

import { useCallback, useEffect, useState } from "react";

// Картка-слово (WORD_CARD, word-list-layout.ts): p-3.5 = 14px з обох боків.
const CARD_PADDING_PX = 28;
// Грід-обгортка карток (letter-gaps.tsx/letter-rearrangement.tsx): gap-3 = 12px.
const COLUMN_GAP_PX = 12;

// ОДИН фіксований розмір клітинки на обидві вправи — літера-поле-пропуск і
// видима літера letter_gaps, плитка-літера letter_rearrangement — НІКОЛИ не
// змінюється шириною екрана/картки. Значення — РЕАЛЬНО виміряні розміри
// картки "se conduire" (letter-tile-cell/-font/-row-gap, globals.css).
export const FIXED_CELL_PX = 32;
export const FIXED_CELL_GAP_PX = 3.4;

// Поріг переходу на дві колонки — ОДИН і той самий для letter_gaps і
// letter_rearrangement (раніше розійшлися: letter_rearrangement завжди мав
// md:grid-cols-2 = 768px у блоковій гілці, letter_gaps — 768px лише коли
// слів > 10, інакше взагалі 1 колонка; потім обидва тимчасово перейшли на
// 1100px). Стандартний Tailwind `md` (768px) — телефони/планшети в один
// стовпець, ноутбук/десктоп у два. Картка НІКОЛИ не займає весь рядок
// (col-span прибрано повністю) — у 2-колонковому режимі остання непарна
// картка просто лишається в першій клітинці свого рядка (друга порожня),
// стандартна поведінка CSS grid, без додаткового коду.
export const TWO_COLUMN_BREAKPOINT_PX = 768;

// Клас Tailwind-варіанта з тим самим числом — єдине місце, що його задає,
// щоб розмітка (letter-gaps.tsx/letter-rearrangement.tsx) і цей хук не
// розійшлися. md — стандартний Tailwind-брейкпоінт (768px), той самий,
// що й TWO_COLUMN_BREAKPOINT_PX.
export const TWO_COLUMN_GRID_CLASS = "md:grid-cols-2";

// Розбиває n клітинок на рядки по максимум perLine, збалансовано (рядки
// відрізняються не більше ніж на 1 клітинку), а не "жадібно по perLine, а
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
// двоколонкового порогу — звідси й "внутрішня" ширина картки (за
// відрахуванням ЛИШЕ padding картки, half — коли двоколонково, інакше
// full), яка потрібна лише для перенесення рядків ВСЕРЕДИНІ слова
// (perLineFor, letter-gaps.tsx — letter_rearrangement її не викликає, там
// звичайний flex-wrap плиток). Без резерву лампочки: лампочка сидить у
// верхньому правому куті картки, а рядки клітинок/плиток ідуть НИЖЧЕ
// заголовка (word-card-number-row) — резерв під лампочку лишається лише на
// самому заголовку (pr-[52px] у letter-gaps.tsx/letter-rearrangement.tsx),
// рядки клітинок використовують повну внутрішню ширину картки. Сам розмір
// клітинки тут більше НЕ рахується — він завжди FIXED_CELL_PX (CSS,
// globals.css). Жодного "чи картці потрібен повний рядок" тут більше немає —
// картка завжди half-width у 2-колонковому режимі, full-width в
// 1-колонковому, без винятків.
export function useWorkingTileLayout() {
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

  const fullCardInner = Math.max(0, gridWidth - CARD_PADDING_PX);
  const halfCardInner = Math.max(0, (gridWidth - COLUMN_GAP_PX) / 2 - CARD_PADDING_PX);
  const step = FIXED_CELL_PX + FIXED_CELL_GAP_PX;

  const perLineFull = gridWidth > 0 ? Math.max(1, Math.floor((fullCardInner + FIXED_CELL_GAP_PX) / step)) : 1;
  const perLineHalf = gridWidth > 0 ? Math.max(1, Math.floor((halfCardInner + FIXED_CELL_GAP_PX) / step)) : 1;

  // Скільки клітинок влазить в один рядок картки ЦІЄЇ вправи — half, коли
  // вправа зараз у 2-колонковому режимі (кожна картка завжди half-width
  // там), інакше full (1-колонковий режим — кожна картка full-width).
  const perLineFor = useCallback((): number => (twoColumn ? perLineHalf : perLineFull), [twoColumn, perLineHalf, perLineFull]);

  return { gridRef, twoColumn, perLineFor, ready: gridWidth > 0 };
}
