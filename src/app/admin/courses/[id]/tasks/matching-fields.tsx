"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import type { MatchingConfig, MatchingPair } from "@/lib/exercises/types";
import type { ImportableFieldsHandle } from "./importable-fields";

export const MatchingFields = forwardRef<
  ImportableFieldsHandle,
  { initialConfig?: Partial<MatchingConfig> }
>(function MatchingFields({ initialConfig }, ref) {
  const [pairs, setPairs] = useState<MatchingPair[]>(
    initialConfig?.pairs?.length ? initialConfig.pairs : [{ left: "", right: "" }]
  );

  useImperativeHandle(ref, () => ({
    importWords(words) {
      setPairs((prev) => {
        // Прибираємо порожню плейсхолдер-пару за замовчуванням, якщо
        // вчитель ще нічого не ввів — інакше лишався б сміттєвий рядок.
        const withoutEmpty = prev.filter((p) => p.left.trim() || p.right.trim());
        return [
          ...withoutEmpty,
          ...words.map((w) => ({ left: w.word, right: w.translation })),
        ];
      });
    },
  }));

  function addPair() {
    setPairs((prev) => [...prev, { left: "", right: "" }]);
  }

  function removePair(i: number) {
    setPairs((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updatePair(i: number, field: "left" | "right", value: string) {
    setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="matching_pairs" value={JSON.stringify(pairs)} readOnly />

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Інструкція для студента
        </label>
        <input
          name="matching_instructions"
          defaultValue={initialConfig?.instructions ?? ""}
          placeholder="напр. З'єднайте слово з перекладом"
          className="rounded-md border px-2 py-1.5 text-sm"
        />
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Уникайте однакового тексту зліва і справа в різних парах — це заважає перевірці.
      </p>

      {pairs.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={p.left}
            onChange={(e) => updatePair(i, "left", e.target.value)}
            placeholder="Лівий елемент"
            className="flex-1 rounded-md border px-2 py-1 text-sm"
          />
          <span className="text-neutral-400 dark:text-neutral-500">→</span>
          <input
            value={p.right}
            onChange={(e) => updatePair(i, "right", e.target.value)}
            placeholder="Правий елемент"
            className="flex-1 rounded-md border px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => removePair(i)}
            className="text-xs text-red-600 hover:underline dark:text-red-400"
          >
            видалити
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addPair}
        className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
      >
        + пара
      </button>
    </div>
  );
});
