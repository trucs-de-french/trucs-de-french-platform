"use client";

import { X } from "lucide-react";

// Спільна кнопка виходу з fullscreen — embed-frame.tsx/video-frame.tsx/
// video-player.tsx (задача "always-visible top-left X exit button in
// native and pseudo fullscreen"): реальний телефон Android показав, що
// toast браузера ("проведіть пальцем від верхнього краю...") не завжди
// працює (жест недоступний), а наша попередня кнопка (a6f5de7) рендерилась
// лише в псевдо-режимі — у СПРАВЖНЬОМУ Fullscreen API (desktop і мобільний
// однаково) її не було зовсім. Тепер один DOM-вузол, що рендериться (як
// нащадок wrapperRef — елемента, що й справді йде в fullscreen) в ОБОХ
// режимах через isAnyFullscreen (use-fullscreen-wrapper.ts), з виглядом,
// що не залежить від теми сайту (.fullscreen-exit-btn, globals.css) — та
// сама причина, що раніше: кнопка лежить прямо на довільному кадрі гри/
// відео, а не на скляній панелі сайту.
export function FullscreenExitButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="fullscreen-exit-btn">
      <X size={24} strokeWidth={2.5} aria-hidden="true" />
    </button>
  );
}
