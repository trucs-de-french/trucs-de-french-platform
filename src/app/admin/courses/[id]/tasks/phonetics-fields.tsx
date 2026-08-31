"use client";

import { useState } from "react";
import type { PhoneticsConfig, PhoneticsItem } from "@/lib/exercises/types";

function emptyItem(): PhoneticsItem {
  return { text: "", transcription: "", mediaUrl: "" };
}

// Без forwardRef/ImportableFieldsHandle — навмисно без імпорту лексики:
// vocab дає лише {word, translation}, без транскрипції й медіа, а
// phonetics про фрази з транскрипцією, тож слово-в-слово імпорт більше
// плутав би, ніж допомагав.
export function PhoneticsFields({
  initialConfig,
}: {
  initialConfig?: Partial<PhoneticsConfig>;
}) {
  const [items, setItems] = useState<PhoneticsItem[]>(
    initialConfig?.items?.length ? initialConfig.items : [emptyItem()]
  );

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

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Інструкція для студента
        </label>
        <input
          name="phonetics_instructions"
          defaultValue={initialConfig?.instructions ?? ""}
          placeholder="напр. Прослухайте й повторіть вимову"
          className="rounded-md border px-2 py-1.5 text-sm"
        />
      </div>

      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-md border p-2">
          <div className="flex items-center gap-2">
            <input
              value={item.text}
              onChange={(e) => updateItem(i, "text", e.target.value)}
              placeholder="Репліка (французькою)"
              className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
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
            className="rounded-md border px-2 py-1 text-base font-medium"
          />
          <input
            value={item.mediaUrl ?? ""}
            onChange={(e) => updateItem(i, "mediaUrl", e.target.value)}
            placeholder="Аудіо або відео (URL, необов'язково)"
            className="rounded-md border px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400"
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
}
