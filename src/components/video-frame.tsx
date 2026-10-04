"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Maximize, X } from "lucide-react";
import { DRIVE_MOBILE_ASPECT } from "@/lib/video";
import { Z_MODAL } from "@/lib/z-layers";

// lock/unlock — чернетковий Screen Orientation API, відсутній у
// стандартних TS DOM-типах (lib.dom.d.ts не описує його), хоча підтримка в
// мобільних браузерах давно є.
type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
};

// Спільна обгортка відео-iframe (Google Drive/YouTube) для студентської
// частини — сторінка сцени, відео-блоки content-блоків. Пропорція й
// повноекранний режим — у video-frame.css-класах (globals.css), не тут:
// сам компонент лише перемикає класи/атрибути.
export function VideoFrame({
  src,
  title,
  provider,
}: {
  src: string;
  title: string;
  provider: "youtube" | "gdrive";
}) {
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
      const fsEl = document.fullscreenElement ?? (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement;
      const active = fsEl === wrapperRef.current;
      setIsFullscreen(active);
      if (active) {
        // try/catch — orientation.lock кидає синхронно на платформах без
        // підтримки (чи поза фактичним fullscreen) замість повернення
        // відхиленого Promise; мовчки ігноруємо в обох випадках.
        try {
          (screen.orientation as ScreenOrientationWithLock | undefined)?.lock?.("landscape").catch(() => {});
        } catch {
          // no-op
        }
      } else {
        try {
          (screen.orientation as ScreenOrientationWithLock | undefined)?.unlock?.();
        } catch {
          // no-op
        }
      }
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
  // заблокованою на НАСТУПНІЙ сторінці.
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

  async function handleToggle() {
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
        await request();
        return; // fullscreenchange-слухач вище сам підхопить isFullscreen
      } catch {
        // Fullscreen API є, але викликав відмову (напр. політика
        // браузера) — падаємо на псевдо-режим нижче.
      }
    }
    enterPseudoFullscreen();
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={wrapperRef}
        className={`video-frame ${provider === "gdrive" ? "video-frame--gdrive" : "video-frame--youtube"} ${
          isPseudoFullscreen ? `video-frame--pseudo-fullscreen ${Z_MODAL}` : ""
        }`}
        style={{ "--drive-mobile-aspect": DRIVE_MOBILE_ASPECT } as CSSProperties}
      >
        <iframe
          src={src}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
          allowFullScreen
        />
        {isPseudoFullscreen && (
          <button
            type="button"
            onClick={exitPseudoFullscreen}
            aria-label="Закрити повний екран"
            className="absolute right-2 flex h-11 w-11 items-center justify-center text-white before:absolute before:-inset-1"
            style={{ top: "max(0.5rem, env(safe-area-inset-top))" }}
          >
            <X size={24} />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex min-h-11 items-center gap-1.5 self-end rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800/70"
      >
        <Maximize size={16} />
        {isFullscreen || isPseudoFullscreen ? "Вийти з повного екрану" : "На весь екран"}
      </button>
    </div>
  );
}
