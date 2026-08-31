"use client";

import { useState } from "react";
import type { MultipleChoiceConfig, MultipleChoiceOption } from "@/lib/exercises/types";

export function MultipleChoiceFields({
  initialConfig,
}: {
  initialConfig?: Partial<MultipleChoiceConfig>;
}) {
  const [options, setOptions] = useState<MultipleChoiceOption[]>(
    initialConfig?.options?.length
      ? initialConfig.options
      : [
          { id: crypto.randomUUID(), text: "", correct: true },
          { id: crypto.randomUUID(), text: "", correct: false },
        ]
  );

  function addOption() {
    setOptions((prev) => [...prev, { id: crypto.randomUUID(), text: "", correct: false }]);
  }

  function removeOption(id: string) {
    setOptions((prev) => prev.filter((o) => o.id !== id));
  }

  function updateText(id: string, text: string) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)));
  }

  function toggleCorrect(id: string) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, correct: !o.correct } : o)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="mc_options" value={JSON.stringify(options)} readOnly />

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">Питання</label>
        <textarea
          name="mc_question"
          rows={2}
          defaultValue={initialConfig?.question ?? ""}
          className="rounded-md border px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">Подання</label>
        <select
          name="mc_display"
          defaultValue={initialConfig?.display ?? "buttons"}
          className="rounded-md border px-2 py-1.5 text-sm"
        >
          <option value="buttons">Варіанти видно одразу</option>
          <option value="dropdown">Випадаючий список</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Варіанти (позначте правильні)
        </label>
        {options.map((o) => (
          <div key={o.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={o.correct}
              onChange={() => toggleCorrect(o.id)}
              title="Правильний варіант"
            />
            <input
              value={o.text}
              onChange={(e) => updateText(o.id, e.target.value)}
              placeholder="Текст варіанту"
              className="flex-1 rounded-md border px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => removeOption(o.id)}
              className="text-xs text-red-600 hover:underline dark:text-red-400"
            >
              видалити
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addOption}
          className="mt-1 self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + варіант
        </button>
      </div>
    </div>
  );
}
