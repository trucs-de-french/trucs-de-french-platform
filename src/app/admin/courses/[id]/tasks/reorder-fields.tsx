"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import type { ReorderConfig } from "@/lib/exercises/types";
import type { ImportableFieldsHandle } from "./importable-fields";

export const ReorderFields = forwardRef<
  ImportableFieldsHandle,
  { initialConfig?: Partial<ReorderConfig> }
>(function ReorderFields({ initialConfig }, ref) {
  const [items, setItems] = useState<string[]>(
    initialConfig?.items?.length ? initialConfig.items : ["", ""]
  );

  useImperativeHandle(ref, () => ({
    // Лише слово — правильний порядок вчитель виставляє сам кнопками ↑/↓
    // нижче (імпортовані слова додаються в кінець списку).
    importWords(words) {
      setItems((prev) => {
        const withoutEmpty = prev.filter((w) => w.trim());
        return [...withoutEmpty, ...words.map((w) => w.word)];
      });
    },
  }));

  function addItem() {
    setItems((prev) => [...prev, ""]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, value: string) {
    setItems((prev) => prev.map((v, idx) => (idx === i ? value : v)));
  }

  function move(i: number, dir: -1 | 1) {
    setItems((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="reorder_items" value={JSON.stringify(items)} readOnly />

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Інструкція для студента
        </label>
        <input
          name="reorder_instructions"
          defaultValue={initialConfig?.instructions ?? ""}
          placeholder="напр. Розкладіть речення у правильному порядку"
          className="rounded-md border px-2 py-1.5 text-sm"
        />
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Порядок елементів у списку нижче — це і є правильна відповідь. Студенту список
        покажеться перемішаним.
      </p>

      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 text-xs text-neutral-400 dark:text-neutral-500">{i + 1}.</span>
          <input
            value={item}
            onChange={(e) => updateItem(i, e.target.value)}
            placeholder="Елемент"
            className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
          />
          <button
            type="button"
            onClick={() => move(i, -1)}
            disabled={i === 0}
            className="rounded border px-2 py-0.5 text-xs disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => move(i, 1)}
            disabled={i === items.length - 1}
            className="rounded border px-2 py-0.5 text-xs disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => removeItem(i)}
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
});
