"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2 } from "lucide-react";
import type { MatchingConfig, MatchingPair } from "@/lib/exercises/types";
import { buildConfigFromVocab } from "@/lib/exercises/task-config-builder";
import type { ImportableFieldsHandle } from "./importable-fields";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import { INPUT_BORDER } from "@/lib/input-styles";
import { HINT_TEXT } from "@/lib/typography-styles";

function emptyPair(): MatchingPair {
  return { id: crypto.randomUUID(), left: "", right: "" };
}

export const MatchingFields = forwardRef<
  ImportableFieldsHandle & TypeSwitchHandle<MatchingConfig>,
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
    // buildConfigFromVocab (task-config-builder.ts) — MatchingPair не має
    // власного поля під картинку/аудіо, тож переносити тут нічого, окрім
    // left/right (те саме мапування, що раніше було inline).
    importWords(words) {
      const { pairs: newPairs } = buildConfigFromVocab("matching", words) as { pairs: MatchingPair[] };
      setPairs((prev) => {
        // Прибираємо порожню плейсхолдер-пару за замовчуванням, якщо
        // вчитель ще нічого не ввів — інакше лишався б сміттєвий рядок.
        const withoutEmpty = prev.filter((p) => p.left.trim() || p.right.trim());
        return [...withoutEmpty, ...newPairs];
      });
    },
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      pairs,
    }),
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

      <InstructionsRichTextField
        name="matching_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="matching_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      <p className={HINT_TEXT}>
        Уникайте однакового тексту зліва і справа в різних парах — це заважає перевірці.
      </p>

      {pairs.map((p, i) => (
        <div key={p.id} className="flex items-center gap-2">
          <input
            value={p.left}
            onChange={(e) => updatePair(i, "left", e.target.value)}
            placeholder="Лівий елемент"
            className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
          />
          <span className="text-neutral-400 dark:text-neutral-500">→</span>
          <input
            value={p.right}
            onChange={(e) => updatePair(i, "right", e.target.value)}
            placeholder="Правий елемент"
            className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
          />
          <span className={HINT_TEXT}>Бали</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={p.points ?? 1}
            onChange={(e) => updatePoints(i, Number(e.target.value))}
            title="Бали за цю пару"
            className={`${INPUT_BORDER} w-16 px-2 py-2 text-sm`}
          />
          <button
            type="button"
            onClick={() => removePair(i)}
            aria-label="Видалити пару"
            title="Видалити"
            className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
          >
            <Trash2 size={16} />
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
