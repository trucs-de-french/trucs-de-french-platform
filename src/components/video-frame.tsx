"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Maximize, X, Play, ExternalLink } from "lucide-react";
import {
  DRIVE_MOBILE_ASPECT,
  SHOW_OWN_FULLSCREEN_BUTTON_FOR_GDRIVE_MOBILE,
  GDRIVE_TOUCH_MODE,
  getGdriveFileId,
  toGdriveOpenUrl,
} from "@/lib/video";
import { Z_MODAL } from "@/lib/z-layers";

// "Телефон" — не будь-який touch (планшети лишаються на вбудованому
// плеєрі й fullscreen-кнопці, як комп'ютер): дотиковий екран ТА (вузька
// ширина, звичний портрет телефону, ОБО низька висота — той самий
// телефон, повернутий у landscape). useSyncExternalStore, не useState +
// useEffect — matchMedia недоступний під час SSR (getServerSnapshot
// нижче повертає "unknown"), а підписка на "change" самого MediaQueryList
// синхронізує стан і за живого ресайзу/повороту, не лише на монтуванні.
const PHONE_QUERY =
  "(pointer: coarse) and (max-width: 767px), (pointer: coarse) and (max-height: 500px)";

function subscribeIsPhone(onStoreChange: () => void) {
  const mql = window.matchMedia(PHONE_QUERY);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

function getIsPhoneSnapshot(): "phone" | "other" {
  return window.matchMedia(PHONE_QUERY).matches ? "phone" : "other";
}

function getIsPhoneServerSnapshot(): "unknown" {
  return "unknown";
}

// "На весь екран" для iframe-режиму (requestFullscreen на обгортці) —
// спільний стиль, і для звичайної кнопки, і для поster-режиму нижче (той
// самий "у дусі STUDENT_BUTTON_SECONDARY", лише з висотою зони дотику
// ≥44px, якої в самій константі (button-styles.ts) замало).
const SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center gap-1.5 self-end rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800/70";

// Постер замість вбудованого плеєра Drive на телефоні (GDRIVE_TOUCH_MODE
// === "poster", video.ts) — плеєр Drive на телефонах виявився ненадійним
// (подвійне керування, обрізаний кадр, див. попередні коміти); тут —
// лише посилання, що відкривають відео В САМОМУ Google Drive (нова
// вкладка/застосунок), жодного iframe.
function GdrivePoster({ fileId }: { fileId: string }) {
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const openUrl = toGdriveOpenUrl(fileId);
  const openLabel = "Дивитися відео в Google Drive (відкриється в новій вкладці)";

  return (
    <div className="flex flex-col gap-2">
      <div className="video-frame video-frame--gdrive relative bg-gradient-to-b from-black to-neutral-800">
        {/* loading="lazy"/referrerPolicy — Drive інколи відмовляє в
            мініатюрі за referrer; opacity, не умовний рендер after onError —
            щоб НАТИВНА битa іконка картинки НІКОЛИ не блимнула, лише
            градієнт під нею, доки/якщо картинка не завантажилась. */}
        {!thumbFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setThumbLoaded(true)}
            onError={() => setThumbFailed(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity ${
              thumbLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        )}
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={openLabel}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2"
        >
          <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-white shadow-lg">
            <Play size={32} className="ml-0.5 fill-neutral-900 text-neutral-900" />
          </span>
          <span className="text-xs text-white/90">Відео відкриється в Google Drive</span>
        </a>
      </div>
      <a href={openUrl} target="_blank" rel="noopener noreferrer" aria-label={openLabel} className={SECONDARY_BUTTON_CLASS}>
        <ExternalLink size={16} />
        На весь екран
      </a>
    </div>
  );
}

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
  // "unknown" на сервері й на першому клієнтському рендері (гідратація без
  // розбіжності) — лише gdrive реально дивиться на це значення нижче;
  // youtube рендериться як завжди, незалежно від нього.
  const phoneState = useSyncExternalStore(subscribeIsPhone, getIsPhoneSnapshot, getIsPhoneServerSnapshot);
  const isPhone = phoneState === "phone";
  const isDeviceKnown = phoneState !== "unknown";
  // Прапорець-вимикач кнопки повного екрана для iframe-режиму — лише на
  // ТЕЛЕФОНІ (не на планшеті): SHOW_OWN_FULLSCREEN_BUTTON_FOR_GDRIVE_MOBILE
  // стосується ситуації "наш fullscreen ламає плеєр Drive на телефоні",
  // планшет і далі отримує звичну кнопку.
  const hideFullscreenButtonForGdrivePhone =
    provider === "gdrive" && isPhone && !SHOW_OWN_FULLSCREEN_BUTTON_FOR_GDRIVE_MOBILE;
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
  //
  // БЕЗ orientation.lock/unlock (були тут раніше) — примусовий поворот
  // екрана ОДРАЗУ після fullscreenchange збігався за часом із розтягуванням
  // обгортки під нові розміри; на Android (Samsung Chrome) Drive-плеєр
  // усередині iframe встигав намалювати внутрішній макет під СТАРІ
  // (портретні) розміри, тоді отримував нові — і лишав застарілий шар
  // керування поруч із новим (фото користувача: два таймери, обрізаний
  // низ). Студент сам повертає телефон — на звичайному фото/відео-сайті
  // так само.
  useEffect(() => {
    function onFullscreenChange() {
      const fsEl = document.fullscreenElement ?? (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement;
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

  if (provider === "gdrive" && !isDeviceKnown) {
    // Поки не визначили телефон/не телефон — НІ плеєра Drive (щоб
    // даремно не вантажився на телефоні, де за мить все одно
    // заміниться постером), НІ постера (ще не знаємо, чи він потрібен):
    // нейтральний чорний блок у тій самій пропорції, без миготіння й без
    // розбіжності гідратації (сервер рендерить те саме).
    return <div className="video-frame video-frame--gdrive" style={{ "--drive-mobile-aspect": DRIVE_MOBILE_ASPECT } as CSSProperties} />;
  }

  if (provider === "gdrive" && isPhone && GDRIVE_TOUCH_MODE === "poster") {
    const fileId = getGdriveFileId(src);
    if (fileId) return <GdrivePoster fileId={fileId} />;
    // ID не розпарсився — фолбек на звичний iframe нижче, а не порожньо.
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
      {!hideFullscreenButtonForGdrivePhone && (
        <button type="button" onClick={handleToggle} className={SECONDARY_BUTTON_CLASS}>
          <Maximize size={16} />
          {isFullscreen || isPseudoFullscreen ? "Вийти з повного екрану" : "На весь екран"}
        </button>
      )}
    </div>
  );
}
