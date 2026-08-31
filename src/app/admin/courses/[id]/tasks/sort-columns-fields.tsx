"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import type { SortColumnsConfig, SortColumn, SortColumnsItem } from "@/lib/exercises/types";
import type { ImportableFieldsHandle } from "./importable-fields";

export const SortColumnsFields = forwardRef<
  ImportableFieldsHandle,
  { initialConfig?: Partial<SortColumnsConfig> }
>(function SortColumnsFields({ initialConfig }, ref) {
  const [columns, setColumns] = useState<SortColumn[]>(
    initialConfig?.columns?.length
      ? initialConfig.columns
      : [
          { id: crypto.randomUUID(), label: "" },
          { id: crypto.randomUUID(), label: "" },
        ]
  );
  const [items, setItems] = useState<SortColumnsItem[]>(
    initialConfig?.items?.length ? initialConfig.items : []
  );

  useImperativeHandle(ref, () => ({
    // columnId навмисно порожній — колонку призначає вчитель уже наявним
    // dropdown-ом на кожному елементі нижче ("— колонка —").
    importWords(words) {
      setItems((prev) => [
        ...prev,
        ...words.map((w) => ({ id: crypto.randomUUID(), text: w.word, columnId: "" })),
      ]);
    },
  }));

  function addColumn() {
    setColumns((prev) => [...prev, { id: crypto.randomUUID(), label: "" }]);
  }

  function removeColumn(id: string) {
    setColumns((prev) => prev.filter((c) => c.id !== id));
    setItems((prev) => prev.map((i) => (i.columnId === id ? { ...i, columnId: "" } : i)));
  }

  function updateColumnLabel(id: string, label: string) {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c)));
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: "", columnId: columns[0]?.id ?? "" },
    ]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItemText(id: string, text: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, text } : i)));
  }

  function updateItemColumn(id: string, columnId: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, columnId } : i)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="sort_columns_columns" value={JSON.stringify(columns)} readOnly />
      <input type="hidden" name="sort_columns_items" value={JSON.stringify(items)} readOnly />

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Інструкція для студента
        </label>
        <input
          name="sort_columns_instructions"
          defaultValue={initialConfig?.instructions ?? ""}
          placeholder="напр. Розкладіть слова по колонках"
          className="rounded-md border px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">Колонки</label>
        {columns.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <input
              value={c.label}
              onChange={(e) => updateColumnLabel(c.id, e.target.value)}
              placeholder="Назва колонки"
              className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
            />
            <button
              type="button"
              onClick={() => removeColumn(c.id)}
              className="text-xs text-red-600 hover:underline dark:text-red-400"
            >
              видалити
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addColumn}
          className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + колонка
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Елементи (з правильною колонкою)
        </label>
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <input
              value={item.text}
              onChange={(e) => updateItemText(item.id, e.target.value)}
              placeholder="Текст елементу"
              className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
            />
            <select
              value={item.columnId}
              onChange={(e) => updateItemColumn(item.id, e.target.value)}
              className="rounded-md border px-2 py-1 text-sm"
            >
              <option value="">— колонка —</option>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label || "(без назви)"}
                </option>
              ))}
            </select>
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
    </div>
  );
});
