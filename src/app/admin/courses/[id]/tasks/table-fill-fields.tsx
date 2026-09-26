"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2 } from "lucide-react";
import type { TableFillConfig, TableFillRow } from "@/lib/exercises/types";
import { buildConfigFromVocab, STRIP_ARTICLES_DEFAULT } from "@/lib/exercises/task-config-builder";
import type { ImportableFieldsHandle } from "./importable-fields";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import { StripArticlesToggle } from "./strip-articles-toggle";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";

function emptyRow(): TableFillRow {
  return { id: crypto.randomUUID(), left: "", right: "", leftHidden: false, rightHidden: true };
}

export const TableFillFields = forwardRef<
  ImportableFieldsHandle & TypeSwitchHandle<TableFillConfig>,
  { initialConfig?: Partial<TableFillConfig> }
>(function TableFillFields({ initialConfig }, ref) {
  const [columnLabels, setColumnLabels] = useState<[string, string]>(
    initialConfig?.columnLabels ?? ["Французька", "Переклад"]
  );
  const [rows, setRows] = useState<TableFillRow[]>(
    initialConfig?.rows?.length ? initialConfig.rows : [emptyRow()]
  );
  const [stripArticles, setStripArticles] = useState(STRIP_ARTICLES_DEFAULT.table_fill ?? false);

  useImperativeHandle(ref, () => ({
    // buildConfigFromVocab (task-config-builder.ts) — За замовчуванням права
    // клітинка (переклад) прихована, ліва (слово) видима — вчитель потім
    // перемикає чекбокси на кожному рядку окремо. TableFillRow не має
    // власного поля під картинку/аудіо, тож переносити тут нічого, окрім
    // left/right.
    importWords(words) {
      const { rows: newRows } = buildConfigFromVocab("table_fill", words, { stripArticles }) as {
        rows: TableFillRow[];
      };
      setRows((prev) => [...prev, ...newRows]);
    },
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      columnLabels,
      rows,
    }),
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
          <label className={LABEL_TEXT}>Назва лівої колонки</label>
          <input
            value={columnLabels[0]}
            onChange={(e) => setColumnLabels(([, right]) => [e.target.value, right])}
            className={`${INPUT_BORDER} px-2 py-2 text-base font-medium`}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className={LABEL_TEXT}>Назва правої колонки</label>
          <input
            value={columnLabels[1]}
            onChange={(e) => setColumnLabels(([left]) => [left, e.target.value])}
            className={`${INPUT_BORDER} px-2 py-2 text-base font-medium`}
          />
        </div>
      </div>

      <p className={HINT_TEXT}>
        Для прихованої клітинки можна вказати кілька допустимих варіантів через &quot;|&quot;,
        напр. chat|chats. Приховані клітинки студент заповнює сам — видимі показуються одразу
        як текст.
      </p>

      <StripArticlesToggle checked={stripArticles} onChange={setStripArticles} />

      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2 rounded-md border border-gray-100 p-2 dark:border-neutral-700">
          <div className="flex flex-1 flex-col gap-1">
            <input
              value={row.left}
              onChange={(e) => updateRow(row.id, "left", e.target.value)}
              placeholder={columnLabels[0]}
              className={`${INPUT_BORDER} px-2 py-2 text-base font-medium font-content`}
            />
            <label className={`flex items-center gap-1 ${LABEL_TEXT}`}>
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
              className={`${INPUT_BORDER} px-2 py-2 text-base font-medium font-content`}
            />
            <label className={`flex items-center gap-1 ${LABEL_TEXT}`}>
              <input
                type="checkbox"
                checked={row.rightHidden}
                onChange={(e) => updateRow(row.id, "rightHidden", e.target.checked)}
              />
              приховати
            </label>
          </div>
          <span className={`self-start ${HINT_TEXT}`}>Бали</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={row.points ?? 1}
            onChange={(e) => updateRowPoints(row.id, Number(e.target.value))}
            title="Бали за весь рядок (зараховуються, лише якщо всі приховані клітинки правильні)"
            className={`${INPUT_BORDER} w-16 self-start px-2 py-2 text-sm`}
          />
          <button
            type="button"
            onClick={() => removeRow(row.id)}
            aria-label="Видалити рядок"
            title="Видалити"
            className="self-start rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
          >
            <Trash2 size={16} />
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
