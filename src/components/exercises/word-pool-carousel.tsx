"use client";

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useT } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/t";

// "Варіант 3" карусель мобільного пулу слів (<=640px, globals.css) —
// спільна для image-match.tsx/drag-drop.tsx/sort-columns.tsx (той самий
// .word-pool-carousel/.word-pool-chips трей зі стрілками/лічильником
// "A–B з N"/progress-баром; раніше був лише в image-match.tsx, звідти й
// перенесено БЕЗ зміни хоч одного значення). Поза мобільним брейкпоінтом
// усе нижче невидиме (CSS, globals.css) — верстка/drag-логіка не змінені.
export function useWordPoolCarousel(trackRef: RefObject<HTMLDivElement | null>, chipCount: number) {
  const [state, setState] = useState({
    atStart: true,
    atEnd: true,
    fits: true,
    first: 0,
    last: 0,
    progressWidthPct: 100,
    progressLeftPct: 0,
  });
  const rafRef = useRef<number | null>(null);

  function recompute() {
    const track = trackRef.current;
    if (!track) return;
    const { scrollLeft, scrollWidth, clientWidth } = track;
    const atStart = scrollLeft <= 1;
    const atEnd = scrollLeft + clientWidth >= scrollWidth - 1;
    const fits = scrollWidth <= clientWidth + 1;
    const trackRect = track.getBoundingClientRect();
    let first = 0;
    let last = 0;
    let seen = false;
    Array.from(track.children).forEach((child, idx) => {
      const r = (child as HTMLElement).getBoundingClientRect();
      if (r.width === 0) return;
      const overlap = Math.min(r.right, trackRect.right) - Math.max(r.left, trackRect.left);
      if (overlap / r.width > 0.5) {
        if (!seen) {
          first = idx;
          seen = true;
        }
        last = idx;
      }
    });
    const progressWidthPct = fits ? 100 : (clientWidth / scrollWidth) * 100;
    const progressLeftPct = fits ? 0 : (scrollLeft / scrollWidth) * 100;
    setState({ atStart, atEnd, fits, first, last, progressWidthPct, progressLeftPct });
  }

  function scheduleRecompute() {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      recompute();
    });
  }

  useLayoutEffect(() => {
    recompute();
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(scheduleRecompute);
    observer.observe(track);
    window.addEventListener("resize", scheduleRecompute);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleRecompute);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // chipCount — переобчислити, коли слово забрали з пулу (кількість дітей змінилась)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chipCount]);

  function scrollBy(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return { onScroll: scheduleRecompute, scrollBy, ...state };
}

export type WordPoolCarousel = ReturnType<typeof useWordPoolCarousel>;

// "A–B з N" — той самий текст, що раніше жив лише в image-match.tsx;
// null поза мобільним переносом/коли всі чипи й так влазять (carousel.fits),
// тоді викликач показує свій звичний "N restants"-подібний лейбл замість.
export function poolCarouselLabel(
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
  carousel: Pick<WordPoolCarousel, "fits" | "first" | "last">,
  remaining: number
): string | null {
  return !carousel.fits ? `${carousel.first + 1}–${carousel.last + 1} ${t("pool.of")} ${remaining}` : null;
}

function PoolChevronIcon({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg
      className="word-pool-arrow-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === "prev" ? <polyline points="15 6 9 12 15 18" /> : <polyline points="9 6 15 12 9 18" />}
    </svg>
  );
}

// Трей-доріжка: [стрілка][.word-pool-chips][стрілка] — та сама розмітка/
// класи, що раніше в image-match.tsx, лише track/onScroll/children тепер
// параметризовані, щоб drag-drop.tsx/sort-columns.tsx могли передати свої
// чипи без дублювання цієї обгортки.
export function WordPoolCarouselTrack({
  trackRef,
  carousel,
  children,
}: {
  trackRef: RefObject<HTMLDivElement | null>;
  carousel: WordPoolCarousel;
  children: ReactNode;
}) {
  const { t } = useT();
  return (
    <div className={`word-pool-carousel ${carousel.fits ? "word-pool-carousel--fits" : ""}`}>
      <button
        type="button"
        className="word-pool-arrow word-pool-arrow--prev"
        aria-label={t("pool.scrollPrevAria")}
        aria-disabled={carousel.atStart}
        disabled={carousel.atStart}
        onClick={(e) => {
          // stopPropagation — sort-columns.tsx має onClick=clickPool на
          // батьківському .word-pool (повертає вибраний елемент у пул);
          // без цього тап по стрілці зі скролом випадково спрацював би й
          // як "повернути в пул". image-match.tsx/drag-drop.tsx жодного
          // onClick на .word-pool не мають, тож для них це без ефекту.
          e.stopPropagation();
          carousel.scrollBy(-1);
        }}
      >
        <PoolChevronIcon direction="prev" />
      </button>
      <div className="word-pool-chips" ref={trackRef} onScroll={carousel.onScroll}>
        {children}
      </div>
      <button
        type="button"
        className="word-pool-arrow word-pool-arrow--next"
        aria-label={t("pool.scrollNextAria")}
        aria-disabled={carousel.atEnd}
        disabled={carousel.atEnd}
        onClick={(e) => {
          e.stopPropagation();
          carousel.scrollBy(1);
        }}
      >
        <PoolChevronIcon direction="next" />
      </button>
    </div>
  );
}

// Progress-бар під треком — лише коли не все влазить (carousel.fits===false,
// та сама умова, що раніше inline в image-match.tsx).
export function WordPoolProgress({ carousel }: { carousel: WordPoolCarousel }) {
  if (carousel.fits) return null;
  return (
    <div className="word-pool-progress" aria-hidden="true">
      <div
        className="word-pool-progress-thumb"
        style={{ width: `${carousel.progressWidthPct}%`, left: `${carousel.progressLeftPct}%` }}
      />
    </div>
  );
}
