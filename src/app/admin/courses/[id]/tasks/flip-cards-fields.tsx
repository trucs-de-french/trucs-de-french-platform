"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import type { FlipCardsConfig, FlipCard } from "@/lib/exercises/types";
import type { ImportableFieldsHandle } from "./importable-fields";
import { InstructionsRichTextField } from "./instructions-rich-text-field";

function emptyCard(): FlipCard {
  return { front: "", back: "", image_url: "", audio_url: "" };
}

export const FlipCardsFields = forwardRef<
  ImportableFieldsHandle,
  { initialConfig?: Partial<FlipCardsConfig> }
>(function FlipCardsFields({ initialConfig }, ref) {
  const [cards, setCards] = useState<FlipCard[]>(
    initialConfig?.cards?.length ? initialConfig.cards : [emptyCard()]
  );

  useImperativeHandle(ref, () => ({
    importWords(words) {
      setCards((prev) => {
        const withoutEmpty = prev.filter((c) => c.front.trim() || c.back.trim());
        return [
          ...withoutEmpty,
          ...words.map((w) => ({ front: w.word, back: w.translation, image_url: "", audio_url: "" })),
        ];
      });
    },
  }));

  function addCard() {
    setCards((prev) => [...prev, emptyCard()]);
  }

  function removeCard(i: number) {
    setCards((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateCard(i: number, field: keyof FlipCard, value: string) {
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="flip_cards_cards" value={JSON.stringify(cards)} readOnly />

      <InstructionsRichTextField
        name="flip_cards_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="flip_cards_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      {cards.map((card, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-md border p-2">
          <div className="flex items-center gap-2">
            <input
              value={card.front}
              onChange={(e) => updateCard(i, "front", e.target.value)}
              placeholder="Перед"
              className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
            />
            <span className="text-neutral-400 dark:text-neutral-500">→</span>
            <input
              value={card.back}
              onChange={(e) => updateCard(i, "back", e.target.value)}
              placeholder="Зад"
              className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
            />
            <button
              type="button"
              onClick={() => removeCard(i)}
              className="text-xs text-red-600 hover:underline dark:text-red-400"
            >
              видалити
            </button>
          </div>
          <input
            value={card.image_url ?? ""}
            onChange={(e) => updateCard(i, "image_url", e.target.value)}
            placeholder="Картинка (URL, необов'язково)"
            className="ml-0 w-full max-w-md rounded-md border px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400"
          />
          <input
            value={card.audio_url ?? ""}
            onChange={(e) => updateCard(i, "audio_url", e.target.value)}
            placeholder="Аудіо (URL, необов'язково)"
            className="ml-0 w-full max-w-md rounded-md border px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addCard}
        className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
      >
        + картка
      </button>
    </div>
  );
});
