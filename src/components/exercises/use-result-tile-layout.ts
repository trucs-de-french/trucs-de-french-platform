"use client";

import { useCallback, useEffect, useState } from "react";

// Картка-слово (WORD_CARD, word-list-layout.ts): p-3.5 = 14px з обох боків.
const CARD_PADDING_PX = 28;
// Грід-обгортка карток (letter-gaps.tsx/letter-rearrangement.tsx): gap-3 = 12px.
const COLUMN_GAP_PX = 12;

// Еталон — РЕАЛЬНА виміряна ширина поля-пропуску letter_gaps у pre-check
// картці "se conduire" (GAP_SIZE_CLASS=h-9 w-8 → 32px, word-list-layout.ts:19).
// Pre-check БОКСИ самі лишаються на цих голих Tailwind-класах (h-9 w-8,
// text-lg) — жодної спільної CSS-змінної з результатом вони НЕ мають, тож
// --cell тут і далі ЗАВЖДИ розходиться з pre-check розміром (так само, як
// і раніше). SCALE — ЄДИНЕ місце, де застосовується множник 0.85 (разом
// із усіма похідними: ширина/висота/шрифт --cell у globals.css рахуються
// ЯК ЧАСТКА від REFERENCE_CELL_PX, тож масштабуються автоматично; проміжки
// між буквами (CELL_GAP_PX) і між словами (globals.css .word-result-tile-row
// column-gap) та радіус рамки (globals.css --tile/--text) масштабовані тим
// самим SCALE окремо, бо вони НЕ виводяться з --cell формулою). Підлога
// (CELL_FLOOR_PX) НЕ масштабується — лишається абсолютним мінімумом 18px,
// як і раніше.
const SCALE = 0.85;
const REFERENCE_CELL_PX = 32 * SCALE;
const CELL_GAP_PX = 4 * SCALE;
const CELL_FLOOR_PX = 18;

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
      ? Math.max(CELL_FLOOR_PX, Math.min(REFERENCE_CELL_PX, (fullCardInner - (n - 1) * CELL_GAP_PX) / n))
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

// Пара "коротких" карток (spanForUnitLength === 1) ділять один рядок
// грід-сітки ЛИШЕ якщо вони СУСІДИ в порядку показу (жодного
// перевпорядкування — номерація карток лишається, як є). Самотня коротка
// картка (наступна — довга, або вона остання в списку) теж іде на всю
// ширину — інакше порожня половина рядка. Результат — масив (1|2) ТІЄЇ Ж
// довжини й порядку, що unitLengths, для прямого використання як
// md:col-span-N по кожній картці видимого списку.
export function computeResultSpans(
  unitLengths: number[],
  spanForUnitLength: (unitLen: number) => 1 | 2
): (1 | 2)[] {
  const isShort = unitLengths.map((u) => spanForUnitLength(u) === 1);
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
