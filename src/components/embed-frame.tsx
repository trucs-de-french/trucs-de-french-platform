"use client";

import { Maximize, X } from "lucide-react";
import { useFullscreenWrapper, FULLSCREEN_BUTTON_CLASS } from "@/hooks/use-fullscreen-wrapper";
import { Z_MODAL } from "@/lib/z-layers";
import type { CSSProperties } from "react";
import { useT } from "@/lib/i18n/context";

// Спільна обгортка embed-iframe (Wordwall, власні HTML-ігри з R2 тощо) для
// студентської частини — content-блок сцени, група задач, тип завдання
// embed (раніше буквально скопійований EmbedWithFallback у трьох місцях,
// embed-with-fallback.tsx). Висота на телефоні — через .embed-frame-клас і
// --embed-phone-aspect (globals.css), не inline: раніше фіксована висота
// (height=480px) на вузькому екрані давала дуже вузьку й високу рамку.
// Планшет/комп'ютер лишаються на тій самій фіксованій висоті, що й
// раніше, через --embed-desktop-height нижче.
export function EmbedFrame({ url, height = 480 }: { url: string; height?: number }) {
  const { t } = useT();
  const { wrapperRef, isFullscreen, isPseudoFullscreen, toggle, exitPseudoFullscreen } =
    useFullscreenWrapper();

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={wrapperRef}
        className={`embed-frame overflow-hidden rounded-md border border-gray-200 dark:border-neutral-700 ${
          isPseudoFullscreen ? `embed-frame--pseudo-fullscreen ${Z_MODAL}` : ""
        }`}
        style={{ "--embed-desktop-height": `${height}px` } as CSSProperties}
      >
        <iframe src={url} allow="fullscreen; autoplay" allowFullScreen />
        {isPseudoFullscreen && (
          <button
            type="button"
            onClick={exitPseudoFullscreen}
            aria-label={t("videoPlayer.closeFullscreen")}
            className="absolute right-2 flex h-11 w-11 items-center justify-center text-white before:absolute before:-inset-1"
            style={{ top: "max(0.5rem, env(safe-area-inset-top))" }}
          >
            <X size={24} />
          </button>
        )}
      </div>
      <p className="text-xs text-[#4b4766] dark:text-[var(--text-muted-caption)]">
        {t("scene.embedFallbackNote")}{" "}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-[#3b36c4] hover:text-[#2f2ab0] dark:text-inherit dark:hover:text-inherit"
        >
          {t("scene.followLink")}
        </a>
        .
      </p>
      <button type="button" onClick={toggle} className={FULLSCREEN_BUTTON_CLASS}>
        <span className="glass-bar-badge" aria-hidden="true">
          <Maximize size={16} strokeWidth={2.4} />
        </span>
        {isFullscreen || isPseudoFullscreen ? t("videoPlayer.exitFullscreen") : t("videoPlayer.fullscreen")}
      </button>
    </div>
  );
}
