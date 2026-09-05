"use client";

import { useState } from "react";
import type { ChronologicalOrderConfig, ChronologicalOrderItem } from "@/lib/exercises/types";
import { InstructionsRichTextField } from "./instructions-rich-text-field";

function emptyItem(): ChronologicalOrderItem {
  return { id: crypto.randomUUID(), content: "" };
}

export function ChronologicalOrderFields({
  initialConfig,
}: {
  initialConfig?: Partial<ChronologicalOrderConfig>;
}) {
  const [mode, setMode] = useState<"image" | "text">(initialConfig?.mode ?? "image");
  const [items, setItems] = useState<ChronologicalOrderItem[]>(
    initialConfig?.items?.length ? initialConfig.items : [emptyItem(), emptyItem()]
  );

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function updateContent(id: string, content: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, content } : it)));
  }

  function updatePoints(id: string, points: number) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, points } : it)));
  }

  // Порядок масиву — правильна хронологія (див. коментар у types.ts), тож
  // тут, на відміну від інших білдерів, переміщення елемента вгору/вниз —
  // це не косметика, а єдиний спосіб задати/виправити правильну відповідь.
  function moveItem(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="chronological_order_mode" value={mode} readOnly />
      <input
        type="hidden"
        name="chronological_order_items"
        value={JSON.stringify(items)}
        readOnly
      />

      <InstructionsRichTextField
        name="chronological_order_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="chronological_order_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">Тип елементів</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "image" | "text")}
          className="w-fit rounded-md border px-2 py-1 text-sm"
        >
          <option value="image">Зображення (URL)</option>
          <option value="text">Текстові твердження</option>
        </select>
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Додайте елементи у ПРАВИЛЬНОМУ хронологічному порядку — саме цей порядок і є правильною
        відповіддю. Студент побачить їх перемішаними, позначеними літерами (A, B, C...), і впише
        число-позицію для кожного. Кнопками ↑/↓ можна виправити порядок, не видаляючи елементи.
      </p>

      {items.map((item, index) => (
        <div key={item.id} className="flex items-center gap-2 rounded-md border p-2">
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => moveItem(index, -1)}
              disabled={index === 0}
              className="px-1 text-xs text-neutral-500 hover:text-black disabled:opacity-30 dark:text-neutral-400 dark:hover:text-white"
              title="Перемістити вище"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => moveItem(index, 1)}
              disabled={index === items.length - 1}
              className="px-1 text-xs text-neutral-500 hover:text-black disabled:opacity-30 dark:text-neutral-400 dark:hover:text-white"
              title="Перемістити нижче"
            >
              ▼
            </button>
          </div>
          <span className="w-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
            {index + 1}
          </span>
          {mode === "image" ? (
            <input
              value={item.content}
              onChange={(e) => updateContent(item.id, e.target.value)}
              placeholder="URL зображення"
              className="flex-1 rounded-md border px-2 py-1 text-sm"
            />
          ) : (
            <input
              value={item.content}
              onChange={(e) => updateContent(item.id, e.target.value)}
              placeholder="Текст твердження"
              className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
            />
          )}
          <input
            type="number"
            min={0}
            step={0.5}
            value={item.points ?? 1}
            onChange={(e) => updatePoints(item.id, Number(e.target.value))}
            title="Бали за цей елемент"
            className="w-16 rounded-md border px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => removeItem(item.id)}
            className="text-xs text-red-600 hover:underline dark:text-red-400"
          >
            видалити
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
      >
        + елемент
      </button>
    </div>
  );
}
