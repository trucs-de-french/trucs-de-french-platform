"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import type { TableFillConfig, TableFillRow } from "@/lib/exercises/types";
import type { ImportableFieldsHandle } from "./importable-fields";
import { InstructionsRichTextField } from "./instructions-rich-text-field";

function emptyRow(): TableFillRow {
  return { id: crypto.randomUUID(), left: "", right: "", leftHidden: false, rightHidden: true };
}

export const TableFillFields = forwardRef<
  ImportableFieldsHandle,
  { initialConfig?: Partial<TableFillConfig> }
>(function TableFillFields({ initialConfig }, ref) {
  const [columnLabels, setColumnLabels] = useState<[string, string]>(
    initialConfig?.columnLabels ?? ["Французька", "Переклад"]
  );
  const [rows, setRows] = useState<TableFillRow[]>(
    initialConfig?.rows?.length ? initialConfig.rows : [emptyRow()]
  );

  useImperativeHandle(ref, () => ({
    // За замовчуванням права клітинка (переклад) прихована, ліва (слово)
    // видима — вчитель потім перемикає чекбокси на кожному рядку окремо.
    importWords(words) {
      setRows((prev) => [
        ...prev,
        ...words.map((w) => ({
          id: crypto.randomUUID(),
          left: w.word,
          right: w.translation,
          leftHidden: false,
          rightHidden: true,
        })),
      ]);
    },
  }));

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: string, field: keyof TableFillRow, value: string | boolean) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function updateRowPoints(id: string, points: number) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, points } : r)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="table_fill_column_labels" value={JSON.stringify(columnLabels)} readOnly />
      <input type="hidden" name="table_fill_rows" value={JSON.stringify(rows)} readOnly />

      <InstructionsRichTextField
        name="table_fill_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="table_fill_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">Назва лівої колонки</label>
          <input
            value={columnLabels[0]}
            onChange={(e) => setColumnLabels(([, right]) => [e.target.value, right])}
            className="rounded-md border px-2 py-1 text-base font-medium"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">Назва правої колонки</label>
          <input
            value={columnLabels[1]}
            onChange={(e) => setColumnLabels(([left]) => [left, e.target.value])}
            className="rounded-md border px-2 py-1 text-base font-medium"
          />
        </div>
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Для прихованої клітинки можна вказати кілька допустимих варіантів через &quot;|&quot;,
        напр. chat|chats. Приховані клітинки студент заповнює сам — видимі показуються одразу
        як текст.
      </p>

      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2 rounded-md border p-2">
          <div className="flex flex-1 flex-col gap-1">
            <input
              value={row.left}
              onChange={(e) => updateRow(row.id, "left", e.target.value)}
              placeholder={columnLabels[0]}
              className="rounded-md border px-2 py-1 text-base font-medium"
            />
            <label className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
              <input
                type="checkbox"
                checked={row.leftHidden}
                onChange={(e) => updateRow(row.id, "leftHidden", e.target.checked)}
              />
              приховати
            </label>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <input
              value={row.right}
              onChange={(e) => updateRow(row.id, "right", e.target.value)}
              placeholder={columnLabels[1]}
              className="rounded-md border px-2 py-1 text-base font-medium"
            />
            <label className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
              <input
                type="checkbox"
                checked={row.rightHidden}
                onChange={(e) => updateRow(row.id, "rightHidden", e.target.checked)}
              />
              приховати
            </label>
          </div>
          <input
            type="number"
            min={0}
            step={0.5}
            value={row.points ?? 1}
            onChange={(e) => updateRowPoints(row.id, Number(e.target.value))}
            title="Бали за весь рядок (зараховуються, лише якщо всі приховані клітинки правильні)"
            className="w-16 self-start rounded-md border px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => removeRow(row.id)}
            className="self-start text-xs text-red-600 hover:underline dark:text-red-400"
          >
            видалити
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
      >
        + рядок
      </button>
    </div>
  );
});
