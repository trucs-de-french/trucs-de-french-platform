"use client";

import { useState } from "react";
import type { MultipleChoiceConfig, MultipleChoiceItem } from "@/lib/exercises/types";
import { InstructionsRichTextField } from "./instructions-rich-text-field";

function emptyItem(): MultipleChoiceItem {
  return {
    id: crypto.randomUUID(),
    sentence: "",
    options: [
      { id: crypto.randomUUID(), text: "", correct: true },
      { id: crypto.randomUUID(), text: "", correct: false },
    ],
  };
}

export function MultipleChoiceFields({
  initialConfig,
}: {
  initialConfig?: Partial<MultipleChoiceConfig>;
}) {
  const [display, setDisplay] = useState<"buttons" | "dropdown">(
    initialConfig?.display ?? "buttons"
  );
  const [items, setItems] = useState<MultipleChoiceItem[]>(
    initialConfig?.items?.length ? initialConfig.items : [emptyItem()]
  );

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function updateSentence(id: string, sentence: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, sentence } : it)));
  }

  function addOption(itemId: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, options: [...it.options, { id: crypto.randomUUID(), text: "", correct: false }] }
          : it
      )
    );
  }

  function removeOption(itemId: string, optId: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, options: it.options.filter((o) => o.id !== optId) } : it
      )
    );
  }

  function updateOptionText(itemId: string, optId: string, text: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, options: it.options.map((o) => (o.id === optId ? { ...o, text } : o)) }
          : it
      )
    );
  }

  function updateOptionImageUrl(itemId: string, optId: string, imageUrl: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, options: it.options.map((o) => (o.id === optId ? { ...o, imageUrl } : o)) }
          : it
      )
    );
  }

  function updatePoints(itemId: string, points: number) {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, points } : it)));
  }

  function toggleCorrect(itemId: string, optId: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              options: it.options.map((o) => (o.id === optId ? { ...o, correct: !o.correct } : o)),
            }
          : it
      )
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="mc_items" value={JSON.stringify(items)} readOnly />

      <InstructionsRichTextField
        name="mc_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="mc_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">Подання</label>
        <select
          name="mc_display"
          value={display}
          onChange={(e) => setDisplay(e.target.value as "buttons" | "dropdown")}
          className="rounded-md border px-2 py-1.5 text-sm"
        >
          <option value="buttons">Варіанти видно одразу</option>
          <option value="dropdown">Випадаючий список</option>
        </select>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item, ii) => (
          <div key={item.id} className="rounded-md border p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Речення {ii + 1}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={item.points ?? 1}
                  onChange={(e) => updatePoints(item.id, Number(e.target.value))}
                  title="Бали за це речення"
                  className="w-16 rounded-md border px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  видалити речення
                </button>
              </div>
            </div>
            <textarea
              value={item.sentence}
              onChange={(e) => updateSentence(item.id, e.target.value)}
              rows={2}
              placeholder={
                display === "dropdown"
                  ? "напр. Je {{}} au cinéma. — {{}} позначає, де буде випадаючий список"
                  : "Текст речення"
              }
              className="mt-2 w-full rounded-md border px-2 py-1 text-base font-medium"
            />
            <div className="mt-2 flex flex-col gap-1 pl-2">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">
                Варіанти (позначте правильні)
              </label>
              {item.options.map((o) => (
                <div key={o.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={o.correct}
                    onChange={() => toggleCorrect(item.id, o.id)}
                    title="Правильний варіант"
                  />
                  <input
                    value={o.text}
                    onChange={(e) => updateOptionText(item.id, o.id, e.target.value)}
                    placeholder="Текст варіанту"
                    className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
                  />
                  <input
                    value={o.imageUrl ?? ""}
                    onChange={(e) => updateOptionImageUrl(item.id, o.id, e.target.value)}
                    placeholder="URL картинки (опційно)"
                    className="flex-1 rounded-md border px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(item.id, o.id)}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    видалити
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addOption(item.id)}
                className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
              >
                + варіант
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + речення
        </button>
      </div>
    </div>
  );
}
