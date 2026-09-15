"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import type { PhoneticsConfig, PhoneticsItem } from "@/lib/exercises/types";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { INPUT_BORDER } from "@/lib/input-styles";

function emptyItem(): PhoneticsItem {
  return { text: "", transcription: "", mediaUrl: "" };
}

// Без ImportableFieldsHandle — навмисно без імпорту лексики: vocab дає лише
// {word, translation}, без транскрипції й медіа, а phonetics про фрази з
// транскрипцією, тож слово-в-слово імпорт більше плутав би, ніж допомагав.
// forwardRef тут лише для TypeSwitchHandle (перенос при зміні типу ↔
// flip_cards), не для імпорту.
export const PhoneticsFields = forwardRef<
  TypeSwitchHandle<PhoneticsConfig>,
  { initialConfig?: Partial<PhoneticsConfig> }
>(function PhoneticsFields({ initialConfig }, ref) {
  const [items, setItems] = useState<PhoneticsItem[]>(
    initialConfig?.items?.length ? initialConfig.items : [emptyItem()]
  );

  useImperativeHandle(ref, () => ({
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      items,
    }),
  }));

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, field: keyof PhoneticsItem, value: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="phonetics_items" value={JSON.stringify(items)} readOnly />

      <InstructionsRichTextField
        name="phonetics_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="phonetics_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-md border border-gray-100 p-2 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            <input
              value={item.text}
              onChange={(e) => updateItem(i, "text", e.target.value)}
              placeholder="Репліка (французькою)"
              className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
            />
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="text-xs text-red-600 hover:underline dark:text-red-400"
            >
              видалити
            </button>
          </div>
          <input
            value={item.transcription}
            onChange={(e) => updateItem(i, "transcription", e.target.value)}
            placeholder="Транскрипція (напр. [ʒə vɛ bjɛ̃])"
            className={`${INPUT_BORDER} px-2 py-2 text-base font-medium font-content`}
          />
          <input
            value={item.mediaUrl ?? ""}
            onChange={(e) => updateItem(i, "mediaUrl", e.target.value)}
            placeholder="Аудіо або відео (URL, необов'язково)"
            className={`${INPUT_BORDER} px-2 py-2 text-xs text-neutral-600 dark:text-neutral-400`}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
      >
        + додати репліку
      </button>
    </div>
  );
});
