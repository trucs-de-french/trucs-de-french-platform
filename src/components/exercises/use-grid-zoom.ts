"use client";

import { useState } from "react";

// Спільні ступені зуму для word_search і crossword (раніше — локальний
// ZOOM_STEPS у crossword.tsx, ЕТАП I). Єдине джерело правди для
// GridZoomControls і useGridZoom.
export const ZOOM_STEPS = [1, 1.25, 1.5, 2] as const;

// Стан масштабу сітки, спільний для ВСІХ блоків вправи (тримає
// *Exercise-компонент, не BlockView, — перемикання вкладки блоку не мусить
// скидати зум).
export function useGridZoom() {
  const [zoom, setZoom] = useState<number>(ZOOM_STEPS[0]);
  return { zoom, setZoom };
}

export type ZoomMetrics = { scrollLeft: number; clientWidth: number };

// Після зміни zoom контент сітки міняє розмір — без корекції scrollLeft
// видима частина "стрибає" (скрол лишається тим самим у пікселях, хоча
// контент під ним уже інший). anchor (якщо є — напр. активна клітинка
// кросворда) лишається по центру видимої області; інакше лишається по
// центру той самий ВІДСОТОК ширини контенту, що був до зміни (контент
// масштабується рівномірно на ratio = nextZoom/prevZoom, тож позиція
// центру у відсотках не міняється). ЛИШЕ container.scrollTo — ніякого
// scrollIntoView чи зсуву вікна.
export function keepViewAfterZoom(
  container: HTMLElement,
  prevMetrics: ZoomMetrics,
  prevZoom: number,
  nextZoom: number,
  anchor?: HTMLElement | null
) {
  let newScrollLeft: number;
  if (anchor) {
    const containerRect = container.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const anchorCenterContent = anchorRect.left + anchorRect.width / 2 - containerRect.left + container.scrollLeft;
    newScrollLeft = anchorCenterContent - container.clientWidth / 2;
  } else {
    const ratio = nextZoom / prevZoom;
    newScrollLeft = (prevMetrics.scrollLeft + prevMetrics.clientWidth / 2) * ratio - container.clientWidth / 2;
  }
  const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
  container.scrollTo({ left: Math.max(0, Math.min(newScrollLeft, maxScrollLeft)) });
}
