"use client";

import { useState, type DragEvent } from "react";
import { SELECTED_OPTION_CLASS } from "./selection-style";

// Спільна DnD-механіка для reorder (плитки-слова) і letter_rearrangement
// (плитки-літери) — нативний HTML5 drag-and-drop + click-to-select-then-swap
// як fallback для тач-пристроїв. Нічого не знає про послідовності/слова/
// бали/підказки — лише "рядок тайлів, якими можна мінятись місцями".
export function SwappableTileRow({
  items,
  onChange,
  locked,
  tileState,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  locked: boolean;
  // За ІНДЕКСОМ позиції (не значенням) — коректно для дублікатів (однакові
  // слова/літери можуть повторюватись).
  tileState?: (index: number) => "correct" | "incorrect" | undefined;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // Тінь на плитці ЛИШЕ в стані спокою — під час активного перетягування
  // (сама плитка, не сусідня) тінь прибирається, щоб не заважати
  // відчуттю "хапальності" (браузер і так додає власний drag-образ).
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  function swap(i: number, j: number) {
    if (locked || i === j) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function clickTile(i: number) {
    if (locked) return;
    if (selected === null) {
      setSelected(i);
    } else if (selected === i) {
      setSelected(null);
    } else {
      swap(selected, i);
      setSelected(null);
    }
  }

  function tileClass(i: number) {
    const state = tileState?.(i);
    const shadow = draggingIndex === i ? "" : "shadow-sm";
    if (state === "correct") return `${shadow} border-green-500 bg-green-50 dark:bg-green-950/30`;
    if (state === "incorrect") return `${shadow} border-red-500 bg-red-50 dark:bg-red-950/30`;
    if (selected === i) return `${shadow} ${SELECTED_OPTION_CLASS}`;
    if (dragOverIndex === i) return `${shadow} border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30`;
    return `${shadow} border-gray-200 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-800/70`;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((text, i) => (
        <button
          key={i}
          type="button"
          draggable={!locked}
          onDragStart={(e: DragEvent) => {
            e.dataTransfer.setData("text/plain", String(i));
            setDraggingIndex(i);
          }}
          onDragOver={(e: DragEvent) => e.preventDefault()}
          onDragEnter={(e: DragEvent) => {
            e.preventDefault();
            setDragOverIndex(i);
          }}
          onDragLeave={() => setDragOverIndex((prev) => (prev === i ? null : prev))}
          onDragEnd={() => {
            setDragOverIndex(null);
            setDraggingIndex(null);
          }}
          onDrop={(e: DragEvent) => {
            e.preventDefault();
            setDragOverIndex(null);
            const from = Number(e.dataTransfer.getData("text/plain"));
            if (!Number.isNaN(from)) swap(from, i);
          }}
          onClick={() => clickTile(i)}
          disabled={locked}
          className={`cursor-grab select-none rounded-md border px-3 py-1.5 text-center text-sm transition-shadow active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-70 ${tileClass(i)}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
