"use client";

import { useState, type DragEvent } from "react";

// Модель "багато елементів -> кілька колонок" (на відміну від
// useTilePlacement, де рівно один елемент на позицію зі swap). Тут кілька
// елементів можуть спокійно співіснувати в одній колонці, тому переміщення —
// це просте перепризначення, без обміну місцями.
export function useColumnSort(itemIds: string[], locked: boolean) {
  const [assignment, setAssignment] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(itemIds.map((id) => [id, null]))
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  function assignTo(itemId: string, columnId: string | null) {
    if (locked) return;
    setAssignment((prev) => ({ ...prev, [itemId]: columnId }));
    setSelected(null);
    setDragOverColumn(null);
  }

  function clickItem(itemId: string) {
    if (locked) return;
    setSelected((prev) => (prev === itemId ? null : itemId));
  }

  function clickColumn(columnId: string) {
    if (locked || selected === null) return;
    assignTo(selected, columnId);
  }

  function clickPool() {
    if (locked || selected === null) return;
    assignTo(selected, null);
  }

  function itemDragProps(itemId: string) {
    return {
      draggable: !locked,
      onDragStart: (e: DragEvent) => e.dataTransfer.setData("text/plain", itemId),
      onDragEnd: () => setDragOverColumn(null),
    };
  }

  function columnDropProps(columnId: string) {
    return {
      onDragOver: (e: DragEvent) => e.preventDefault(),
      onDragEnter: (e: DragEvent) => {
        e.preventDefault();
        setDragOverColumn(columnId);
      },
      onDragLeave: () => setDragOverColumn((prev) => (prev === columnId ? null : prev)),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        const itemId = e.dataTransfer.getData("text/plain");
        if (itemId) assignTo(itemId, columnId);
      },
    };
  }

  function poolDropProps() {
    return {
      onDragOver: (e: DragEvent) => e.preventDefault(),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        const itemId = e.dataTransfer.getData("text/plain");
        if (itemId) assignTo(itemId, null);
      },
    };
  }

  return {
    assignment,
    selected,
    dragOverColumn,
    clickItem,
    clickColumn,
    clickPool,
    itemDragProps,
    columnDropProps,
    poolDropProps,
  };
}
