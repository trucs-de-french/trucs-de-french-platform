"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import type { MatchingConfig, MatchingPair } from "@/lib/exercises/types";
import type { ImportableFieldsHandle } from "./importable-fields";

function emptyPair(): MatchingPair {
  return { id: crypto.randomUUID(), left: "", right: "" };
}

export const MatchingFields = forwardRef<
  ImportableFieldsHandle,
  { initialConfig?: Partial<MatchingConfig> }
>(function MatchingFields({ initialConfig }, ref) {
  // Старі пари (до пілоту балів) не мали id — тут, на відміну від
  // sanitize.ts (getMatchingPairs, стабільний `pair-${index}`), можна
  // згенерувати справжній id саме зараз: після першого збереження цієї
  // форми пара матиме постійний id у БД, "самозцілення" застарілих даних.
  const [pairs, setPairs] = useState<MatchingPair[]>(
    initialConfig?.pairs?.length
      ? initialConfig.pairs.map((p) => ({ ...p, id: p.id ?? crypto.randomUUID() }))
      : [emptyPair()]
  );

  useImperativeHandle(ref, () => ({
    importWords(words) {
      setPairs((prev) => {
        // Прибираємо порожню плейсхолдер-пару за замовчуванням, якщо
        // вчитель ще нічого не ввів — інакше лишався б сміттєвий рядок.
        const withoutEmpty = prev.filter((p) => p.left.trim() || p.right.trim());
        return [
          ...withoutEmpty,
          ...words.map((w) => ({ id: crypto.randomUUID(), left: w.word, right: w.translation })),
        ];
      });
    },
  }));

  function addPair() {
    setPairs((prev) => [...prev, emptyPair()]);
  }

  function removePair(i: number) {
    setPairs((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updatePair(i: number, field: "left" | "right", value: string) {
    setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }

  function updatePoints(i: number, points: number) {
    setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, points } : p)));
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
        <div key={p.id} className="flex items-center gap-2">
          <input
            value={p.left}
            onChange={(e) => updatePair(i, "left", e.target.value)}
            placeholder="Лівий елемент"
            className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
          />
          <span className="text-neutral-400 dark:text-neutral-500">→</span>
          <input
            value={p.right}
            onChange={(e) => updatePair(i, "right", e.target.value)}
            placeholder="Правий елемент"
            className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
          />
          <input
            type="number"
            min={0}
            step={0.5}
            value={p.points ?? 1}
            onChange={(e) => updatePoints(i, Number(e.target.value))}
            title="Бали за цю пару"
            className="w-16 rounded-md border px-2 py-1 text-sm"
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
