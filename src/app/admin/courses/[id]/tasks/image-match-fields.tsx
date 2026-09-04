"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import type { ImageMatchConfig, ImageMatchItem } from "@/lib/exercises/types";
import type { ImportableFieldsHandle } from "./importable-fields";
import { InstructionsRichTextField } from "./instructions-rich-text-field";

function emptyItem(): ImageMatchItem {
  return { id: crypto.randomUUID(), imageUrl: "", name: "" };
}

export const ImageMatchFields = forwardRef<
  ImportableFieldsHandle,
  { initialConfig?: Partial<ImageMatchConfig> }
>(function ImageMatchFields({ initialConfig }, ref) {
  const [items, setItems] = useState<ImageMatchItem[]>(
    initialConfig?.items?.length ? initialConfig.items : [emptyItem()]
  );

  useImperativeHandle(ref, () => ({
    // image_url з імпортованого слова (якщо було заповнене в скрипті сцени)
    // одразу підставляється; якщо порожнє (custom-термін) — вчитель дописує
    // URL вручну в самому рядку.
    importWords(words) {
      setItems((prev) => {
        const withoutEmpty = prev.filter((it) => it.imageUrl.trim() || it.name.trim());
        return [
          ...withoutEmpty,
          ...words.map((w) => ({
            id: crypto.randomUUID(),
            imageUrl: w.image_url ?? "",
            name: w.word,
          })),
        ];
      });
    },
  }));

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function updateItem(id: string, field: "imageUrl" | "name", value: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  }

  function updatePoints(id: string, points: number) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, points } : it)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="image_match_items" value={JSON.stringify(items)} readOnly />

      <InstructionsRichTextField
        name="image_match_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="image_match_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 rounded-md border p-2">
          <input
            value={item.imageUrl}
            onChange={(e) => updateItem(item.id, "imageUrl", e.target.value)}
            placeholder="URL зображення"
            className="flex-1 rounded-md border px-2 py-1 text-sm"
          />
          <input
            value={item.name}
            onChange={(e) => updateItem(item.id, "name", e.target.value)}
            placeholder="Правильна назва"
            className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
          />
          <input
            type="number"
            min={0}
            step={0.5}
            value={item.points ?? 1}
            onChange={(e) => updatePoints(item.id, Number(e.target.value))}
            title="Бали за це зображення"
            className="w-16 rounded-md border px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => removeItem(item.id)}
            className="text-xs text-red-600 hover:underline dark:text-red-400"
          >
            видалити
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
      >
        + зображення
      </button>
    </div>
  );
});
