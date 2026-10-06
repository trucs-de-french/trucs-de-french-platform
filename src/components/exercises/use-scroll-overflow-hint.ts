"use client";

import { useEffect, useState, type RefObject } from "react";

// Текст-підказка "сітка ширша за екран — прокрутіть убік" під сіткою
// word_search/crossword (сам розмір клітинки задає --cw у globals.css,
// спільний для обох — ЕТАП J; тут лише факт переповнення контейнера).
// ResizeObserver сам реагує й на зміну зуму (ЕТАП I/J) — розмір контейнера змінюється, вимір автоматично
// оновлюється без жодних додаткових залежностей. Вимір — лише коли
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
      // clientWidth === 0 — транзитний вимір (шар ще не отримав розкладку
      // цього кадру, чи батьківський контейнер тимчасово нульової
      // ширини) — scrollWidth > 0 проти такого clientWidth завжди хибно
      // показав би "переповнення", хоча насправді ще просто нема
      // валідного виміру; ігноруємо кадр, лишаємо попереднє значення.
      if (el!.clientWidth === 0) return;
      setOverflow(el!.scrollWidth > el!.clientWidth);
    }
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // Контейнер (el) сам має фіксовану ширину (max-w-full) — його ВЛАСНИЙ
    // розмір не змінюється, коли росте лише ВМІСТ усередині (zoom
    // кросворда, ЕТАП I: --cw росте, а сам scrollRef — ні). ResizeObserver
    // на el сам по собі такого не ловить (він реагує на зміну РОЗМІРУ
    // спостережуваного елемента, не на його overflow), тож додатково
    // спостерігаємо за першим прямим нащадком (та сама "лише сітка, без
    // сусідніх елементів" обгортка, що вже є і в word-search.tsx, і в
    // crossword.tsx) — САМЕ її розмір росте разом зі вмістом.
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [ref, active]);

  return overflow;
}
