"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clusterCardHeights, orderForTwoColumns } from "@/lib/exercises/word-list-layout";

function identity(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

function waitForImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

// Чекає, поки шрифти (next/font, font-display: swap — до завершення
// завантаження текст рендериться fallback-шрифтом з ІНШИМИ метриками, тож
// заміряна висота не відповідає фінальному вигляду) і всі картинки-
// підказки цього списку довантажаться (або впадуть з помилкою). Лише
// ПІСЛЯ цього заміряна висота вмісту картки стабільна.
async function waitUntilMeasurable(imageUrls: (string | null | undefined)[]): Promise<void> {
  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  const images = imageUrls.filter((u): u is string => !!u).map(waitForImage);
  await Promise.all([fontsReady, ...images]);
}

// Спільний для letter_gaps/letter_rearrangement хук: групує картки слів за
// РЕАЛЬНО заміряною висотою вмісту (не евристичною оцінкою) і парує
// однакові за висотою картки в один рядок 2-колонкового grid.
//
// Потік:
// 1. Перший рендер — displayOrder = вихідний порядок, ready = false
//    (opacity-0, але картки вже в DOM і займають місце — є що міряти).
// 2. useEffect чекає document.fonts.ready і завантаження (чи помилку)
//    усіх картинок-підказок (waitUntilMeasurable) — ЛИШЕ ПІСЛЯ цього
//    міряє contentRef кожної картки (текстова колонка, БЕЗ картинки —
//    setContentRef ставиться саме на неї в компоненті-виклику) і виставляє
//    displayOrder.
// 3. requestAnimationFrame ПІСЛЯ вимірювання — ready = true, з'являється
//    кадр з opacity-100, transition-opacity відпрацьовує плавне появлення.
// 4. ResizeObserver на кожній картці — будь-яка подальша зміна висоти
//    вмісту (шрифт усе ж догрузився пізніше, зміна ширини вікна змінила
//    перенос слів) перераховує порядок, ПОКИ студент ще нічого не вводив
//    (markInteracted). Після взаємодії — порядок фіксується назавжди.
export function useTwoColumnWordOrder({
  wordCount,
  fullFlags,
  imageUrls,
  enabled,
}: {
  wordCount: number;
  // fullFlags[originalIndex] — та сама умова, що вже md:col-span-2
  // (SINGLE_WORD_SPAN_THRESHOLD/PHRASE_SPAN_THRESHOLD) в обох компонентах;
  // масив (не callback), щоб не переприв'язувати ефекти на кожен рендер
  // через мінливу ідентичність inline-функції в компоненті-виклику.
  fullFlags: boolean[];
  // imageUrls[originalIndex] — картинка-підказка цього слова, якщо є;
  // вимірювання чекає завантаження ВСІХ них (waitUntilMeasurable).
  imageUrls: (string | null | undefined)[];
  // Групування має сенс лише в режимі двох колонок (words.length >
  // TWO_COLUMN_WORD_THRESHOLD) — інакше одразу готово, без виміру/фейду.
  enabled: boolean;
}) {
  const [displayOrder, setDisplayOrder] = useState<number[]>(() => identity(wordCount));
  const [ready, setReady] = useState(!enabled);
  const contentRefs = useRef<(HTMLElement | null)[]>([]);
  const interactedRef = useRef(false);

  const setContentRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      contentRefs.current[index] = el;
    },
    []
  );

  const markInteracted = useCallback(() => {
    interactedRef.current = true;
  }, []);

  // Округлення до цілого пікселя — getBoundingClientRect повертає float,
  // сирий суб-піксельний шум інакше міг би розбити дві по суті однакові
  // картки на різні кластери.
  const measureAndReorder = useCallback(() => {
    if (!enabled) return null;
    const heights = contentRefs.current.map((el) =>
      el ? Math.round(el.getBoundingClientRect().height) : null
    );
    // Вимірювання не відбулося (відсутній ref на якійсь картці) —
    // показуємо вихідний порядок, а не частково порахований.
    if (heights.length !== wordCount || heights.some((h) => h === null)) {
      setDisplayOrder(identity(wordCount));
      return null;
    }
    const groups = clusterCardHeights(heights as number[], fullFlags);
    setDisplayOrder(orderForTwoColumns(groups));
    return { heights: heights as number[], groups };
  }, [enabled, wordCount, fullFlags]);

  // Початкове вимірювання — лише після готовності шрифтів/картинок. Коли
  // !enabled, ready вже true з початкового useState(!enabled) — тут просто
  // нічого не робимо (без зайвого setState в тілі ефекту).
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      await waitUntilMeasurable(imageUrls);
      if (cancelled) return;
      measureAndReorder();
      requestAnimationFrame(() => {
        if (!cancelled) setReady(true);
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordCount]);

  // ResizeObserver — будь-яка зміна висоти вмісту картки (пізній font-swap,
  // картинка з'явилась запізно, зміна ширини вікна змінила перенос слів)
  // перераховує порядок, поки студент ще нічого не вводив/не перетягував.
  // Дебаунс 150ms — щоб не перераховувати на кожен окремий кадр під час
  // активного ресайзу вікна (ResizeObserver може відстрілювати часто).
  useEffect(() => {
    if (!enabled) return;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (interactedRef.current) return;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => measureAndReorder(), 150);
    });
    contentRefs.current.forEach((el) => el && observer.observe(el));
    return () => {
      if (timeout) clearTimeout(timeout);
      observer.disconnect();
    };
  }, [enabled, measureAndReorder]);

  return { displayOrder, ready, setContentRef, markInteracted };
}
