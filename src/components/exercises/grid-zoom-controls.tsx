"use client";

import { Minus, Plus } from "lucide-react";
import { DEFAULT_ZOOM, ZOOM_STEPS } from "./use-grid-zoom";

// Панель масштабу сітки (−/відсоток/+), спільна для word_search і
// crossword (раніше жила лише в crossword.tsx, ЕТАП I). onMouseDown
// preventDefault на кожній кнопці — клік не забирає фокус з активної
// клітинки (кросворд), той самий прийом, що в DiacriticsPopup. Зона
// дотику кожної кнопки — 40×40px (h-10 w-10).
export function GridZoomControls({ zoom, onChange }: { zoom: number; onChange: (zoom: number) => void }) {
  const zoomIndex = ZOOM_STEPS.indexOf(zoom as (typeof ZOOM_STEPS)[number]);
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        aria-label="Зменшити сітку"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onChange(ZOOM_STEPS[Math.max(0, zoomIndex - 1)])}
        disabled={zoomIndex <= 0}
        className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-neutral-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800/70"
      >
        <Minus size={16} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Скинути масштаб"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onChange(DEFAULT_ZOOM)}
        className="flex h-10 min-w-[3.5rem] items-center justify-center rounded-md border border-gray-200 bg-white px-2 font-heading text-sm font-medium text-neutral-700 shadow-sm hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800/70"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        aria-label="Збільшити сітку"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onChange(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, zoomIndex + 1)])}
        disabled={zoomIndex >= ZOOM_STEPS.length - 1}
        className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-neutral-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800/70"
      >
        <Plus size={16} aria-hidden />
      </button>
    </div>
  );
}
