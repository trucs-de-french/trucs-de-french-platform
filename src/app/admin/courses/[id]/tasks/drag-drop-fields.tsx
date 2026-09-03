"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import type { DragDropConfig, DragDropSentence } from "@/lib/exercises/types";
import type { ImportableFieldsHandle } from "./importable-fields";

function emptySentence(): DragDropSentence {
  return { id: crypto.randomUUID(), template: "" };
}

export const DragDropFields = forwardRef<
  ImportableFieldsHandle,
  { initialConfig?: Partial<DragDropConfig> }
>(function DragDropFields({ initialConfig }, ref) {
  const [sentences, setSentences] = useState<DragDropSentence[]>(
    initialConfig?.sentences?.length ? initialConfig.sentences : [emptySentence()]
  );
  const [bank, setBank] = useState<string[]>(
    initialConfig?.bank?.length ? initialConfig.bank : [""]
  );

  useImperativeHandle(ref, () => ({
    // Банк спільний на всю вправу — імпортовані слова просто додаються в
    // кінець, без питання "куди саме" (на відміну від reorder).
    importWords(words) {
      setBank((prev) => {
        const withoutEmpty = prev.filter((w) => w.trim());
        return [...withoutEmpty, ...words.map((w) => w.word)];
      });
    },
  }));

  function addSentence() {
    setSentences((prev) => [...prev, emptySentence()]);
  }

  function removeSentence(id: string) {
    setSentences((prev) => prev.filter((s) => s.id !== id));
  }

  function updateSentence(id: string, template: string) {
    setSentences((prev) => prev.map((s) => (s.id === id ? { ...s, template } : s)));
  }

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
      <input type="hidden" name="drag_drop_sentences" value={JSON.stringify(sentences)} readOnly />
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

      <div className="flex flex-col gap-2">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Речення з пропусками — правильне слово пишіть прямо у {"{{ }}"}, напр. Je{" "}
          {"{{vais}}"} au cinéma (один варіант на пропуск, бо це фіксоване слово з банку).
        </label>
        {sentences.map((s, si) => (
          <div key={s.id} className="flex items-start gap-2">
            <span className="mt-1.5 w-5 text-xs text-neutral-400 dark:text-neutral-500">
              {si + 1}.
            </span>
            <textarea
              value={s.template}
              onChange={(e) => updateSentence(s.id, e.target.value)}
              rows={2}
              className="flex-1 rounded-md border px-2 py-1.5 text-base font-medium"
            />
            <button
              type="button"
              onClick={() => removeSentence(s.id)}
              className="mt-1.5 text-xs text-red-600 hover:underline dark:text-red-400"
            >
              видалити
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addSentence}
          className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + речення
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Банк слів (спільний на всі речення вище — додайте всі правильні +, за бажанням,
          зайві слова-дистрактори)
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
