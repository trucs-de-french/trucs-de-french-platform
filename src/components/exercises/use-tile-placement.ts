"use client";

import { useState, type DragEvent } from "react";
import { computeClickSlot, computePlaceAt, computeReturnToBank } from "./tile-placement-logic";

// Логіка "банк слів -> пропуски в тексті" для drag_drop (reorder має свою
// окрему, простішу модель без банку — один ряд плиток, swap напряму).
// Підтримує і нативний drag-and-drop мишею, і клік-клік (банк/слот -> слот)
// як рівноцінну альтернативу — друге потрібне, бо нативний HTML5 drag
// ненадійний на мобільних. Переміщення плитки з одного слота на інший,
// зайнятий — це SWAP, а не вставка з витісненням. Сама логіка переходів
// винесена в tile-placement-logic.ts і протестована окремо від React.
// locked=true (після перевірки) вимикає всю взаємодію.
export function useTilePlacement(slotCount: number, locked: boolean) {
  const [placed, setPlaced] = useState<(number | null)[]>(() => Array(slotCount).fill(null));
  const [selected, setSelected] = useState<number | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);

  const usedBankIndices = new Set(placed.filter((p): p is number => p !== null));

  function placeAt(targetSlot: number, bankIdx: number) {
    if (locked) return;
    setPlaced((prev) => computePlaceAt(prev, targetSlot, bankIdx));
    setSelected(null);
    setHoveredSlot(null);
  }

  function returnToBank(bankIdx: number) {
    if (locked) return;
    setPlaced((prev) => computeReturnToBank(prev, bankIdx));
    setSelected(null);
    setHoveredSlot(null);
  }

  function clickBank(bankIdx: number) {
    if (locked || usedBankIndices.has(bankIdx)) return;
    setSelected((prev) => (prev === bankIdx ? null : bankIdx));
  }

  function clickSlot(slotIdx: number) {
    if (locked) return;
    const result = computeClickSlot(placed, selected, slotIdx);
    setPlaced(result.placed);
    setSelected(result.selected);
  }

  function bankDragProps(bankIdx: number) {
    return {
      draggable: !locked && !usedBankIndices.has(bankIdx),
      onDragStart: (e: DragEvent) => e.dataTransfer.setData("text/plain", String(bankIdx)),
      onDragEnd: () => setHoveredSlot(null),
    };
  }

  function slotDragProps(slotIdx: number) {
    const bankIdx = placed[slotIdx];
    return {
      draggable: !locked && bankIdx !== null,
      onDragStart: (e: DragEvent) => {
        if (bankIdx !== null) e.dataTransfer.setData("text/plain", String(bankIdx));
      },
      onDragEnd: () => setHoveredSlot(null),
    };
  }

  function slotDropProps(slotIdx: number) {
    return {
      onDragOver: (e: DragEvent) => e.preventDefault(),
      onDragEnter: (e: DragEvent) => {
        e.preventDefault();
        setHoveredSlot(slotIdx);
      },
      onDragLeave: () => setHoveredSlot((prev) => (prev === slotIdx ? null : prev)),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        setHoveredSlot(null);
        const bi = Number(e.dataTransfer.getData("text/plain"));
        if (!Number.isNaN(bi)) placeAt(slotIdx, bi);
      },
    };
  }

  // drop-зона на самому банку — щоб можна було перетягнути плитку назад
  function bankDropProps() {
    return {
      onDragOver: (e: DragEvent) => e.preventDefault(),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        const bi = Number(e.dataTransfer.getData("text/plain"));
        if (!Number.isNaN(bi)) returnToBank(bi);
      },
    };
  }

  return {
    placed,
    selected,
    hoveredSlot,
    usedBankIndices,
    clickBank,
    clickSlot,
    bankDragProps,
    slotDragProps,
    slotDropProps,
    bankDropProps,
  };
}
