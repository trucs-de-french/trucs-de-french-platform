"use client";

import { useCallback, useEffect, useState } from "react";

// Картка-слово (WORD_CARD, word-list-layout.ts): p-3.5 = 14px з обох боків.
const CARD_PADDING_PX = 28;
// Грід-обгортка карток (letter-gaps.tsx/letter-rearrangement.tsx): gap-3 = 12px.
const COLUMN_GAP_PX = 12;
const CELL_GAP_PX = 4;
const CELL_FLOOR_PX = 18;
const CELL_CAP_PX = 40;

// Розмір плитки результату (WordResultRows) рахується ОДИН раз на всю
// вправу від ширини ПОВНОШИРИННОЇ картки (тієї, що займає ОБИДВІ колонки
// грід-сітки), а не від половинної ширини колонки — інакше (старий підхід,
// container query на самій .word-result-tile-row) коротке слово в
// двоколонковій картці діставало ВТРИЧІ меншу плитку, ніж те саме слово в
// одноколонковій/повношириннiй картці, бо --cell рахувався від ширини
// контейнера КОЖНОЇ картки окремо через cqw. Тепер --cell — ЄДИНЕ число на
// всю вправу (letter-gaps.tsx/letter-rearrangement.tsx передають його як
// inline-style "--cell" на EXERCISE_STACK, поруч із вже наявним "--n"), а
// кожна картка окремо вирішує, чи влізає її НАЙДОВША група слова в
// ПОЛОВИННУ ширину (spanForUnitLength) — якщо ні, картка розтягується на
// обидві колонки (md:col-span-2), а не плитка зменшується.
//
// ResizeObserver на самій грід-обгортці (gridRef) — ширина має
// перераховуватись при зміні viewport/розкладки, звичайний useState тут
// недостатній (ширина елемента невідома до першого рендеру в DOM).
export function useResultTileLayout(n: number) {
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

  const fullCardInner = Math.max(0, gridWidth - CARD_PADDING_PX);
  const halfCardInner = Math.max(0, (gridWidth - COLUMN_GAP_PX) / 2 - CARD_PADDING_PX);
  const cell =
    n > 0 && fullCardInner > 0
      ? Math.max(CELL_FLOOR_PX, Math.min(CELL_CAP_PX, (fullCardInner - (n - 1) * CELL_GAP_PX) / n))
      : CELL_FLOOR_PX;

  // unitLen — довжина НАЙДОВШОЇ групи (слова) САМЕ ЦІЄЇ картки (не --n,
  // спільного на всю вправу) — картка з коротким словом лишається в одній
  // колонці, навіть якщо сусідня картка з довгим словом на всю ширину.
  const spanForUnitLength = useCallback(
    (unitLen: number): 1 | 2 => {
      if (unitLen <= 0 || halfCardInner <= 0) return 1;
      const needed = unitLen * cell + Math.max(0, unitLen - 1) * CELL_GAP_PX;
      return needed > halfCardInner ? 2 : 1;
    },
    [cell, halfCardInner]
  );

  return { gridRef, cell, spanForUnitLength, ready: gridWidth > 0 };
}
