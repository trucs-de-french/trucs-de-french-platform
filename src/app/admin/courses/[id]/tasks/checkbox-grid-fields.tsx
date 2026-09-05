"use client";

import { useState } from "react";
import type { CheckboxGridConfig, CheckboxGridColumn, CheckboxGridRow } from "@/lib/exercises/types";
import { InstructionsRichTextField } from "./instructions-rich-text-field";

function emptyRow(): CheckboxGridRow {
  return { id: crypto.randomUUID(), label: "", correctColumnIds: [] };
}

export function CheckboxGridFields({
  initialConfig,
}: {
  initialConfig?: Partial<CheckboxGridConfig>;
}) {
  const [columns, setColumns] = useState<CheckboxGridColumn[]>(
    initialConfig?.columns?.length
      ? initialConfig.columns
      : [
          { id: crypto.randomUUID(), label: "Так" },
          { id: crypto.randomUUID(), label: "Ні" },
        ]
  );
  const [rows, setRows] = useState<CheckboxGridRow[]>(
    initialConfig?.rows?.length ? initialConfig.rows : [emptyRow()]
  );

  function addColumn() {
    setColumns((prev) => [...prev, { id: crypto.randomUUID(), label: "" }]);
  }

  function removeColumn(id: string) {
    setColumns((prev) => prev.filter((c) => c.id !== id));
    setRows((prev) =>
      prev.map((r) => ({ ...r, correctColumnIds: r.correctColumnIds.filter((cid) => cid !== id) }))
    );
  }

  function updateColumnLabel(id: string, label: string) {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRowLabel(id: string, label: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, label } : r)));
  }

  function updateRowPoints(id: string, points: number) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, points } : r)));
  }

  function toggleCell(rowId: string, columnId: string, checked: boolean) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const correctColumnIds = checked
          ? [...r.correctColumnIds, columnId]
          : r.correctColumnIds.filter((cid) => cid !== columnId);
        return { ...r, correctColumnIds };
      })
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="checkbox_grid_columns" value={JSON.stringify(columns)} readOnly />
      <input type="hidden" name="checkbox_grid_rows" value={JSON.stringify(rows)} readOnly />

      <InstructionsRichTextField
        name="checkbox_grid_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="checkbox_grid_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

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

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Позначте чекбоксом клітинки, які мають бути правильними для кожного рядка. Студент зможе
        позначати декілька клітинок в одному рядку одночасно.
      </p>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">Рядки</label>
        {rows.map((row) => (
          <div key={row.id} className="flex flex-col gap-2 rounded-md border p-2">
            <div className="flex items-center gap-2">
              <input
                value={row.label}
                onChange={(e) => updateRowLabel(row.id, e.target.value)}
                placeholder="Твердження / питання"
                className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
              />
              <input
                type="number"
                min={0}
                step={0.5}
                value={row.points ?? 1}
                onChange={(e) => updateRowPoints(row.id, Number(e.target.value))}
                title="Бали за весь рядок (зараховуються, лише якщо всі клітинки рядка правильні)"
                className="w-16 rounded-md border px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                видалити
              </button>
            </div>
            <div className="flex flex-wrap gap-3 pl-2">
              {columns.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-1 text-sm text-neutral-700 dark:text-neutral-300"
                >
                  <input
                    type="checkbox"
                    checked={row.correctColumnIds.includes(c.id)}
                    onChange={(e) => toggleCell(row.id, c.id, e.target.checked)}
                  />
                  {c.label || "(без назви)"}
                </label>
              ))}
            </div>
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
    </div>
  );
}
