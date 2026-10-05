"use client";

import { useEffect, useState, type RefObject } from "react";

// Текст-підказка "сітка ширша за екран — прокрутіть убік" під сіткою
// word_search/crossword (grid-cell-size.ts поруч задає сам розмір
// клітинки — тут лише факт переповнення контейнера). Вимір — лише коли
// блок ВИДИМИЙ (active): прихований через display:none блок (hidden,
// WordSearchExercise/CrosswordExercise) має clientWidth/scrollWidth === 0,
// вимір там або хибний, або марний — тож ResizeObserver підключається й
// від'єднується разом із active, а не живе постійно для кожного блоку.
export function useScrollOverflowHint(ref: RefObject<HTMLElement | null>, active: boolean): boolean {
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;

    function measure() {
      setOverflow(el!.scrollWidth > el!.clientWidth);
    }
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, active]);

  return overflow;
}
