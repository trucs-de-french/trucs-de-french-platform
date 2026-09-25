"use client";

import { useState, type DragEvent } from "react";
import { SELECTED_OPTION_CLASS, LIVE_CORRECT_CLASS, LIVE_INCORRECT_CLASS } from "./selection-style";
import { COMPACT_TILE_SIZE_CLASS } from "@/lib/exercises/word-list-layout";
import { arrayMove, computeInsertIndex, resolveDropSide } from "@/lib/sortable-list";

// Спільна DnD-механіка для reorder (плитки-слова) і letter_rearrangement
// (плитки-літери) — нативний HTML5 drag-and-drop + click-to-select-then-move
// як fallback для тач-пристроїв. Перейменовано з SwappableTileRow: плитка,
// відпущена над іншою, стає РІВНО на її місце (ліва/права половина під
// курсором визначає "до" чи "після"), решта зсувається — не обмін місцями
// парами, як було раніше. Нічого не знає про послідовності/слова/бали/
// підказки — лише "рядок тайлів, які можна переставляти".
export function SortableTileRow({
  items,
  onChange,
  locked,
  tileState,
  compact = false,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  locked: boolean;
  // За ІНДЕКСОМ позиції (не значенням) — коректно для дублікатів (однакові
  // слова/літери можуть повторюватись).
  tileState?: (index: number) => "correct" | "incorrect" | undefined;
  // Менший padding/шрифт для задовгих слів (letter_rearrangement,
  // word-list-layout.ts LONG_WORD_COMPACT_THRESHOLD) — суто презентаційний
  // проп, ніяк не зачіпає drag/click-move логіку вище.
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  // Куди саме стане перетягнута плитка — індекс наведеного елемента +
  // сторона (ліва/права половина під курсором) — не просто "над яким
  // елементом", як раніше dragOverIndex.
  const [dropTarget, setDropTarget] = useState<{ index: number; side: "before" | "after" } | null>(null);

  function move(from: number, to: number) {
    if (locked || from === to) return;
    onChange(arrayMove(items, from, to));
  }

  function clickTile(i: number) {
    if (locked) return;
    if (selected === null) {
      setSelected(i);
    } else if (selected === i) {
      setSelected(null);
    } else {
      // Клік (без лівої/правої половини) — друга плитка займає рівно ту
      // позицію, куди клікнули, той самий arrayMove(items, from, to), що й
      // drag; природний, однозначний результат без потреби в half-детекції
      // для дискретного click-fallback.
      move(selected, i);
      setSelected(null);
    }
  }

  function tileClass(i: number) {
    const state = tileState?.(i);
    const shadow = draggingIndex === i ? "" : "shadow-sm";
    if (state === "correct") return `${shadow} ${LIVE_CORRECT_CLASS}`;
    if (state === "incorrect") return `${shadow} ${LIVE_INCORRECT_CLASS}`;
    if (selected === i) return `${shadow} ${SELECTED_OPTION_CLASS}`;
    return `${shadow} border-gray-200 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-800/70`;
  }

  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {items.map((text, i) => (
        <div key={i} className="relative flex items-stretch">
          {/* Індикатор вставки — тонка вертикальна лінія кольору brand між
              плитками, ліворуч чи праворуч від наведеної, замість
              підсвічування всієї сусідньої плитки (те раніше означало
              "поміняються місцями", тепер лінія точно показує, куди
              встане). */}
          {dropTarget?.index === i && dropTarget.side === "before" && (
            <span className="absolute -left-[5px] top-0 bottom-0 w-0.5 rounded-full bg-brand" aria-hidden />
          )}
          <button
            type="button"
            draggable={!locked}
            onDragStart={(e: DragEvent) => {
              e.dataTransfer.setData("text/plain", String(i));
              e.dataTransfer.effectAllowed = "move";
              setDraggingIndex(i);
            }}
            onDragOver={(e: DragEvent) => {
              e.preventDefault();
              if (draggingIndex === null) return;
              const side = resolveDropSide(
                e.clientX,
                e.clientY,
                e.currentTarget.getBoundingClientRect(),
                "horizontal"
              );
              setDropTarget({ index: i, side });
            }}
            onDragLeave={() =>
              setDropTarget((prev) => (prev?.index === i ? null : prev))
            }
            onDragEnd={() => {
              setDropTarget(null);
              setDraggingIndex(null);
            }}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData("text/plain"));
              if (!Number.isNaN(from) && dropTarget) {
                move(from, computeInsertIndex(from, dropTarget.index, dropTarget.side));
              }
              setDropTarget(null);
            }}
            onClick={() => clickTile(i)}
            disabled={locked}
            className={`cursor-grab select-none whitespace-nowrap rounded-md border text-center transition-shadow active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-70 ${
              compact ? COMPACT_TILE_SIZE_CLASS : "px-3 py-1.5 text-base"
            } ${tileClass(i)}`}
          >
            {text}
          </button>
          {dropTarget?.index === i && dropTarget.side === "after" && (
            <span className="absolute -right-[5px] top-0 bottom-0 w-0.5 rounded-full bg-brand" aria-hidden />
          )}
        </div>
      ))}
    </div>
  );
}
