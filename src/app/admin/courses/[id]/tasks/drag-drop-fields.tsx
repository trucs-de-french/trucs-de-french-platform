"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import type { DragDropConfig } from "@/lib/exercises/types";
import type { ImportableFieldsHandle } from "./importable-fields";

export const DragDropFields = forwardRef<
  ImportableFieldsHandle,
  { initialConfig?: Partial<DragDropConfig> }
>(function DragDropFields({ initialConfig }, ref) {
  const [bank, setBank] = useState<string[]>(
    initialConfig?.bank?.length ? initialConfig.bank : [""]
  );

  useImperativeHandle(ref, () => ({
    // Лише слово (без перекладу) — банк це просто список слів для
    // перетягування; речення з пропуском (template) вчитель пише сам.
    importWords(words) {
      setBank((prev) => {
        const withoutEmpty = prev.filter((w) => w.trim());
        return [...withoutEmpty, ...words.map((w) => w.word)];
      });
    },
  }));

  function addWord() {
    setBank((prev) => [...prev, ""]);
  }

  function removeWord(i: number) {
    setBank((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateWord(i: number, value: string) {
    setBank((prev) => prev.map((v, idx) => (idx === i ? value : v)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="drag_drop_bank" value={JSON.stringify(bank)} readOnly />

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Інструкція для студента
        </label>
        <input
          name="drag_drop_instructions"
          defaultValue={initialConfig?.instructions ?? ""}
          placeholder="напр. Перетягніть слова у пропуски"
          className="rounded-md border px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Текст із пропусками — правильне слово пишіть прямо у {"{{ }}"}, напр. Je{" "}
          {"{{vais}}"} au cinéma (один варіант на пропуск, бо це фіксоване слово з банку).
        </label>
        <textarea
          name="drag_drop_template"
          rows={3}
          defaultValue={initialConfig?.template ?? ""}
          className="rounded-md border px-2 py-1.5 text-base font-medium"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Банк слів (додайте всі правильні +, за бажанням, зайві слова-дистрактори)
        </label>
        {bank.map((word, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={word}
              onChange={(e) => updateWord(i, e.target.value)}
              placeholder="Слово"
              className="flex-1 rounded-md border px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => removeWord(i)}
              className="text-xs text-red-600 hover:underline dark:text-red-400"
            >
              видалити
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addWord}
          className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + слово
        </button>
      </div>
    </div>
  );
});
