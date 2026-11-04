"use client";

import { useEffect, useRef, useState } from "react";

// Спільний стиль кнопки "На весь екран" під рамкою (video-frame.tsx,
// video-player.tsx, embed-frame.tsx) — "fullscreen-btn" — єдиний клас-гачок
// для ВСІХ таких кнопок, уся візуальна стилізація (фон/рамка/бейдж/
// світла-темна тема) живе в globals.css (.fullscreen-btn), перемикається
// темою сайту (.dark/.light), не залежить від фону курсу. self-start —
// позиціювання кнопки в flex-col-обгортці викликача (задача "Embedded
// games: move fullscreen button to the left" — раніше self-end; лише
// embed-frame.tsx рендерить цю кнопку напряму в flex-col, тож це єдине
// місце, де self-start/self-end реально зсуває кнопку по горизонталі;
// karaoke.tsx — єдиний інший викликач — рендерить її в
// .scene-fullscreen-btn-row (рядковий flex, justify-content керує
// горизонталлю там, self-start/self-end лише про вертикаль і нічого не
// змінює).
export const FULLSCREEN_BUTTON_CLASS = "fullscreen-btn inline-flex self-start";

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

  // reallyExitPseudoFullscreen — єдине місце, що РЕАЛЬНО вимикає псевдо-
  // режим (знімає body overflow, скидає стан); exitPseudoFullscreen нижче
  // (кнопка/Escape) лише просить браузер про history.back(), а сам вихід
  // відбувається в popstate-слухачі — той самий принцип, що
  // closeFullscreen/onPopState у karaoke.tsx (задача "Fullscreen embed/
  // video: always-visible exit button, Esc and Back to exit"), щоб кнопка
  // "назад"/жест ОС закривали саме псевдо-режим, а не йшли на попередню
  // сторінку сайту.
  function reallyExitPseudoFullscreen() {
    document.body.style.overflow = previousBodyOverflowRef.current;
    setIsPseudoFullscreen(false);
  }

  function enterPseudoFullscreen() {
    previousBodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    try {
      // pushState — щоб системний жест/кнопка "назад" (popstate нижче)
      // закривала псевдо-режим, а не йшла на попередню сторінку сайту.
      window.history.pushState({ pseudoFullscreen: true }, "");
    } catch {
      // SSR/приватний режим без History API — псевдо-режим і так
      // відкриється, просто жест "назад" тоді поведеться як завжди.
    }
    setIsPseudoFullscreen(true);
  }

  // Єдиний спосіб ПОПРОСИТИ закрити (кнопка, Escape) — завжди через
  // history.back(), НЕ напряму reallyExitPseudoFullscreen(): це "споживає"
  // запис історії, доданий enterPseudoFullscreen вище, інакше він лишався
  // б зайвим записом "вперед".
  function exitPseudoFullscreen() {
    if (!isPseudoFullscreenRef.current) return;
    try {
      window.history.back();
    } catch {
      reallyExitPseudoFullscreen();
    }
  }

  useEffect(() => {
    function onPopState() {
      if (isPseudoFullscreenRef.current) reallyExitPseudoFullscreen();
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Задача "always-visible top-left X exit button": одна функція виходу
  // НЕЗАЛЕЖНО від того, який саме режим активний (справжній Fullscreen API
  // чи псевдо) — кнопка-хрестик у embed-frame.tsx/video-frame.tsx/
  // video-player.tsx викликає саме її, не toggle() (toggle() і ВХОДИТЬ у
  // fullscreen, якщо жоден режим не активний — для кнопки виходу це хибна
  // поведінка).
  async function exitAnyFullscreen() {
    if (isFullscreen) {
      await (document.exitFullscreen?.() ??
        (document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen?.());
      return;
    }
    exitPseudoFullscreen();
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

  // isAnyFullscreen — задача "always-visible top-left X exit button": усі
  // три викликачі (embed-frame.tsx/video-frame.tsx/video-player.tsx)
  // показують ту саму кнопку виходу в ОБОХ режимах за єдиною умовою,
  // замість повторювати "isFullscreen || isPseudoFullscreen" у кожному.
  const isAnyFullscreen = isFullscreen || isPseudoFullscreen;

  return {
    wrapperRef,
    isFullscreen,
    isPseudoFullscreen,
    isAnyFullscreen,
    toggle,
    exitPseudoFullscreen,
    exitAnyFullscreen,
  };
}
