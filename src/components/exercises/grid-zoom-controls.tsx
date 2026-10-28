"use client";

import { Minus, Plus } from "lucide-react";
import { DEFAULT_ZOOM, ZOOM_STEPS } from "./use-grid-zoom";

// Панель масштабу сітки (−/відсоток/+), спільна для word_search і
// crossword. onMouseDown preventDefault на кожній кнопці — клік не забирає
// фокус з активної клітинки (кросворд), той самий прийом, що в
// DiacriticsPopup.
// Мокап "варіант 1" — тепер у правому слоті інфо-рядка TaskPanelHeader
// (task-panel-header.tsx, .task-panel-controls-right), НЕ окремим рядком
// над вправою: 32px-високі кнопки з золотою тонкою рамкою (той самий
// токен rgba(217,183,101,.55), що пілюля-підказка) замість попередніх
// 40×40 сірих — стиль живе тут, у спільному компоненті, а не в CSS-
// оверрайді лише для word_search (.ws-zoom button, видалений із
// globals.css), тож crossword отримує той самий вигляд безкоштовно.
export function GridZoomControls({ zoom, onChange }: { zoom: number; onChange: (zoom: number) => void }) {
  const zoomIndex = ZOOM_STEPS.indexOf(zoom as (typeof ZOOM_STEPS)[number]);
  const buttonClass =
    "flex h-8 w-8 items-center justify-center rounded-md border border-[rgba(217,183,101,0.55)] bg-white text-[#1f1d3a] shadow-[0_1px_2px_rgba(184,144,47,0.12)] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[rgba(243,217,139,0.28)] dark:bg-[var(--dark-surface-fill)] dark:text-[#f6dc8e] dark:hover:bg-[#1e234e]";
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Зменшити сітку"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onChange(ZOOM_STEPS[Math.max(0, zoomIndex - 1)])}
        disabled={zoomIndex <= 0}
        className={buttonClass}
      >
        <Minus size={16} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Скинути масштаб"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onChange(DEFAULT_ZOOM)}
        className={`${buttonClass} w-auto min-w-[3.25rem] px-2 font-heading text-sm font-medium`}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        aria-label="Збільшити сітку"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onChange(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, zoomIndex + 1)])}
        disabled={zoomIndex >= ZOOM_STEPS.length - 1}
        className={buttonClass}
      >
        <Plus size={16} aria-hidden />
      </button>
    </div>
  );
}
