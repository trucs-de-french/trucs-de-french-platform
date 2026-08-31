"use client";

import { useState } from "react";
import type { MultipleChoicePublic, MultipleChoiceDetail } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { SELECTED_OPTION_CLASS } from "./selection-style";

export function MultipleChoiceExercise({
  taskId,
  config,
}: {
  taskId: string;
  config: MultipleChoicePublic;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as MultipleChoiceDetail | undefined;

  function toggle(id: string) {
    if (result) return;
    setSelected((prev) => {
      if (config.multiple) {
        return prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id];
      }
      return [id];
    });
  }

  function optionClass(id: string) {
    if (!detail) {
      return selected.includes(id)
        ? SELECTED_OPTION_CLASS
        : "hover:bg-neutral-50 dark:hover:bg-neutral-800";
    }
    const opt = detail.options.find((o) => o.id === id);
    if (!opt) return "";
    // Той самий принцип, що в true-false.tsx: правильний варіант завжди
    // зелений (обраний він чи ні), а червоним — лише те, що студент обрав
    // помилково.
    if (opt.correct) return "border-green-500 bg-green-50 dark:bg-green-950/30";
    if (opt.selected) return "border-red-500 bg-red-50 dark:bg-red-950/30";
    return "opacity-60";
  }

  return (
    <div>
      {config.display === "buttons" ? (
        <>
          <p className="font-medium">{config.question}</p>
          {/* Без цієї підказки завдання з кількома правильними відповідями
              виглядало ідентично звичайному "оберіть один варіант". */}
          {config.multiple && (
            <p className="text-xs italic text-neutral-500 dark:text-neutral-400">
              {config.correctCount} {config.correctCount >= 5 ? "варіантів" : "варіанти"}
            </p>
          )}
          <div className="mt-2 flex flex-col gap-2">
            {config.options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                disabled={!!result}
                className={`rounded-md border px-3 py-1.5 text-left text-sm transition-none ${optionClass(o.id)}`}
              >
                {o.text}
              </button>
            ))}
          </div>
        </>
      ) : (
        // Дропдаун в одному рядку з текстом речення (напр. "Je suis
        // [Оберіть ▾]"), а не питання окремим рядком і select під ним.
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{config.question}</span>
            <select
              multiple={config.multiple}
              value={config.multiple ? selected : (selected[0] ?? "")}
              onChange={(e) => {
                if (config.multiple) {
                  setSelected(Array.from(e.target.selectedOptions).map((o) => o.value));
                } else {
                  setSelected([e.target.value]);
                }
              }}
              disabled={!!result}
              className={`rounded-md border px-3 py-2 text-sm ${
                selected.length > 0 && selected[0] !== "" ? SELECTED_OPTION_CLASS : ""
              }`}
            >
              {!config.multiple && <option value="">— Оберіть —</option>}
              {config.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.text}
                </option>
              ))}
            </select>
          </div>
          {config.multiple && (
            <p className="mt-1 text-xs italic text-neutral-500 dark:text-neutral-400">
              {config.correctCount} {config.correctCount >= 5 ? "варіантів" : "варіанти"}
            </p>
          )}
        </div>
      )}

      {!result ? (
        <button
          type="button"
          onClick={() => submit(selected)}
          disabled={pending || selected.length === 0}
          className="mt-4 rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          {pending ? "Перевіряю..." : "Перевірити"}
        </button>
      ) : (
        <p
          className={`mt-3 text-sm font-medium ${
            result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {result.correct ? "Правильно! ✓" : `Результат: ${result.score}%`}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
