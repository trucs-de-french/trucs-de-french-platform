"use client";

import { useEffect, useState } from "react";

// Спільні ступені зуму для word_search і crossword (раніше — локальний
// ZOOM_STEPS у crossword.tsx, ЕТАП I). Єдине джерело правди для
// GridZoomControls і useGridZoom. 1 (100%) — стандартний крок, НЕ перший
// елемент масиву (нижче додані кроки зменшення 0.65/0.8) — початковий зум
// і кнопка "Скинути" мусять орієнтуватись на значення 1, а не на
// ZOOM_STEPS[0].
export const ZOOM_STEPS = [0.65, 0.8, 1, 1.25, 1.5, 2] as const;
export const DEFAULT_ZOOM: (typeof ZOOM_STEPS)[number] = 1;

// ЕТАП — мобільний pinch-to-zoom (crossword.tsx/word-search.tsx,
// use-pinch-zoom.ts): межі зуму для pinch — ті самі ZOOM_STEPS, що й
// +/−-кнопки (найменший/найбільший крок), лише БЕЗ прив'язки до самих
// дискретних кроків — під час жесту zoom лишається плавним числом.
// Перенесено сюди (було нижче файлу) — useGridZoom нижче посилається на
// MAX_ZOOM для мобільного maxZoom, читабельніше мати обидва визначення
// ПЕРЕД першим використанням, а не покладатись на порядок виконання модуля.
export const MIN_ZOOM: number = ZOOM_STEPS[0];
export const MAX_ZOOM: number = ZOOM_STEPS[ZOOM_STEPS.length - 1];

// Задача "прибрати режим 200% на десктопі" — кнопки +/− і сам зум лишаються
// на десктопі (тут нічого не ховається, на відміну від попередньої,
// скасованої спроби), але 200% (ZOOM_STEPS[5]) на ширших за 640px екранах
// недосяжний: найбільший крок СТРОГО менший за 2 — 1.5 (ZOOM_STEPS[4]).
// Мобільний (≤640px, той самий поріг, що й pinch/слайдер) лишає повний
// діапазон до 200% без змін.
export const DESKTOP_MAX_ZOOM: (typeof ZOOM_STEPS)[number] = 1.5;

// Той самий breakpoint-хук, що use-pinch-zoom.ts/grid-scroll-slider.tsx
// (max-width:640px, mq.matches одразу + addEventListener("change")) —
// окрема копія тут НАВМИСНО (той самий принцип, що вже обрано в
// grid-scroll-slider.tsx, коментар там): use-pinch-zoom.ts САМЕ імпортує
// MIN_ZOOM/MAX_ZOOM звідси — імпорт у зворотному напрямку зробив би цикл.
function useIsMobileZoomViewport(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

// Стан масштабу сітки, спільний для ВСІХ блоків вправи (тримає
// *Exercise-компонент, не BlockView, — перемикання вкладки блоку не мусить
// скидати зум). maxZoom — DESKTOP_MAX_ZOOM на >640px, повний MAX_ZOOM (200%)
// на мобільному; викликачі (GridZoomControls) отримують це значення, щоб
// "+" дизейблилась рівно на межі, а не лише на старому MAX_ZOOM.
export function useGridZoom() {
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const isMobileZoom = useIsMobileZoomViewport();
  const maxZoom = isMobileZoom ? MAX_ZOOM : DESKTOP_MAX_ZOOM;

  // Перетин межі (desktop<->mobile) — значення, що перевищує АКТУАЛЬНИЙ
  // максимум (напр. 200%, виставлені на мобільному, потім вікно розширили
  // за 640px без перезавантаження), притискається до цього максимуму, а
  // НЕ скидається на 100%: менші значення (120%, 140%) лишаються як є,
  // псевдо-"збережене" значення не губиться повністю, лише обрізається.
  // queueMicrotask — той самий прийом, що вже в save-form.tsx/video-
  // player.tsx: react-hooks/set-state-in-effect забороняє прямий
  // синхронний setState() у тілі ефекту.
  useEffect(() => {
    queueMicrotask(() => {
      setZoom((z) => Math.min(z, maxZoom));
    });
  }, [maxZoom]);

  return { zoom, setZoom, maxZoom };
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

export type PinchFocal = { contentX: number; contentY: number; startZoom: number };

// Контентна точка під серединою двох пальців у МОМЕНТ початку жесту
// (scrollLeft/Top контейнера + зсув середини пальців від його rect) —
// фіксується один раз на весь жест; наступні кадри лише масштабують це
// число (startPinchFocal нижче НЕ викликається повторно), бо ratio
// nextZoom/startZoom рахується від того самого старту (без накопичення
// похибки за кадр).
export function startPinchFocal(container: HTMLElement, midX: number, midY: number, startZoom: number): PinchFocal {
  const rect = container.getBoundingClientRect();
  return {
    contentX: container.scrollLeft + (midX - rect.left),
    contentY: container.scrollTop + (midY - rect.top),
    startZoom,
  };
}

// Застосовується лише з ЕФЕКТУ, залежного від [zoom] (той самий, що й
// keepViewAfterZoom вище) — тобто ПІСЛЯ того, як --zoom реально
// застосувався в DOM і scrollWidth/scrollHeight вже нові; синхронний
// виклик прямо з pointermove-хендлера рахував би на старому розмірі
// контенту (newZoom ще не відрендерився).
export function applyPinchFocal(container: HTMLElement, focal: PinchFocal, nextZoom: number, midX: number, midY: number) {
  const rect = container.getBoundingClientRect();
  const ratio = nextZoom / focal.startZoom;
  const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
  const newScrollLeft = focal.contentX * ratio - (midX - rect.left);
  const newScrollTop = focal.contentY * ratio - (midY - rect.top);
  container.scrollTo({
    left: Math.max(0, Math.min(newScrollLeft, maxScrollLeft)),
    top: Math.max(0, Math.min(newScrollTop, maxScrollTop)),
  });
}
