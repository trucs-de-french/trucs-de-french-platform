"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2 } from "lucide-react";
import type { FlipCardsConfig, FlipCard } from "@/lib/exercises/types";
import type { ImportableFieldsHandle } from "./importable-fields";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import { FileOrLinkField } from "@/components/file-or-link-field";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { INPUT_BORDER } from "@/lib/input-styles";

function emptyCard(): FlipCard {
  return { front: "", back: "", image_url: "", audio_url: "" };
}

export const FlipCardsFields = forwardRef<
  ImportableFieldsHandle & TypeSwitchHandle<FlipCardsConfig>,
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
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      cards,
    }),
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
        <div key={i} className="flex flex-col gap-1 rounded-md border border-gray-100 p-2 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            <input
              value={card.front}
              onChange={(e) => updateCard(i, "front", e.target.value)}
              placeholder="Перед"
              className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
            />
            <span className="text-neutral-400 dark:text-neutral-500">→</span>
            <input
              value={card.back}
              onChange={(e) => updateCard(i, "back", e.target.value)}
              placeholder="Зад"
              className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
            />
            <button
              type="button"
              onClick={() => removeCard(i)}
              aria-label="Видалити картку"
              title="Видалити"
              className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="flex items-start gap-1">
            <FileOrLinkField
              kind="image"
              mode="controlled"
              value={card.image_url ?? ""}
              onChange={(url) => updateCard(i, "image_url", url)}
              placeholder="Картинка (URL, необов'язково)"
            />
            <ImageOrPlaceholder
              src={card.image_url}
              alt="Прев'ю"
              className="h-12 w-12 shrink-0 rounded object-cover"
            />
          </div>
          <input
            value={card.audio_url ?? ""}
            onChange={(e) => updateCard(i, "audio_url", e.target.value)}
            placeholder="Аудіо (URL, необов'язково)"
            className={`${INPUT_BORDER} ml-0 w-full max-w-md px-2 py-2 text-xs text-neutral-600 dark:text-neutral-400`}
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
