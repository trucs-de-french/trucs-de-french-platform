"use client";

import { useEffect, useRef, useState } from "react";

// Спільний стиль кнопки "На весь екран" під рамкою (video-frame.tsx,
// embed-frame.tsx) — у дусі STUDENT_BUTTON_SECONDARY (button-styles.ts),
// лише з min-h-11 (зона дотику ≥44px, якої в самій константі замало).
export const FULLSCREEN_BUTTON_CLASS =
  "inline-flex min-h-11 items-center gap-1.5 self-end rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800/70";

// Спільна логіка повного екрана для iframe-обгорток студентської частини
// (video-frame.tsx, embed-frame.tsx) — винесена з video-frame.tsx, щоб не
// дублювати: справжній Fullscreen API на самій обгортці (wrapperRef) з
// webkit-фолбеком (iPad Safari) і ручним псевдо-режимом (fixed inset-0),
// коли Fullscreen API недоступний (iPhone Safari) або відмовив.
//
// БЕЗ orientation.lock/unlock — примусовий поворот екрана одразу після
// fullscreenchange збігався за часом із розтягуванням обгортки під нові
// розміри й лишав застарілий шар керування плеєра на Android (Samsung
// Chrome, бачили на відео). Студент сам повертає телефон.
export function useFullscreenWrapper() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  // Попереднє значення body.style.overflow — повертаємо ТОЧНО його при
  // виході з псевдо-режиму (не просто ""), на випадок якщо щось інше на
  // сторінці вже його виставляло.
  const previousBodyOverflowRef = useRef("");
  const isPseudoFullscreenRef = useRef(false);

  useEffect(() => {
    isPseudoFullscreenRef.current = isPseudoFullscreen;
  }, [isPseudoFullscreen]);

  // Синхронізація зі справжнім Fullscreen API — у т.ч. коли студент вийшов
  // системним жестом/кнопкою "назад", а не нашою кнопкою.
  useEffect(() => {
    function onFullscreenChange() {
      const fsEl =
        document.fullscreenElement ??
        (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement;
      setIsFullscreen(fsEl === wrapperRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, []);

  // Esc для псевдо-режиму — справжній Fullscreen API сам обробляє Esc
  // (fullscreenchange вище те підхопить), це лише для ручного фолбеку.
  useEffect(() => {
    if (!isPseudoFullscreen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") exitPseudoFullscreen();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isPseudoFullscreen]);

  // Розмонтування посеред псевдо-режиму (навігація студента геть зі
  // сторінки) — повернути прокрутку сторінки, інакше вона лишиться
  // заблокованою на наступній сторінці.
  useEffect(() => {
    return () => {
      if (isPseudoFullscreenRef.current) {
        document.body.style.overflow = previousBodyOverflowRef.current;
      }
    };
  }, []);

  function enterPseudoFullscreen() {
    previousBodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setIsPseudoFullscreen(true);
  }

  function exitPseudoFullscreen() {
    document.body.style.overflow = previousBodyOverflowRef.current;
    setIsPseudoFullscreen(false);
  }

  async function toggle() {
    if (isFullscreen) {
      await (document.exitFullscreen?.() ??
        (document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen?.());
      return;
    }
    if (isPseudoFullscreen) {
      exitPseudoFullscreen();
      return;
    }

    const el = wrapperRef.current;
    const elWithWebkit = el as (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> }) | null;
    const request = el?.requestFullscreen?.bind(el) ?? elWithWebkit?.webkitRequestFullscreen?.bind(elWithWebkit);
    if (request) {
      try {
        // navigationUI: "hide" — просимо браузер не показувати власну
        // підказку "Esc, щоб вийти" над нашим iframe; не всі браузери
        // приймають опції (TypeError синхронно) — тоді пробуємо звичний
        // виклик нижче, без опцій.
        try {
          await request({ navigationUI: "hide" });
        } catch {
          await request();
        }
        return; // fullscreenchange-слухач вище сам підхопить isFullscreen
      } catch {
        // Fullscreen API є, але викликав відмову (напр. політика
        // браузера) — падаємо на псевдо-режим нижче.
      }
    }
    enterPseudoFullscreen();
  }

  return { wrapperRef, isFullscreen, isPseudoFullscreen, toggle, exitPseudoFullscreen };
}
