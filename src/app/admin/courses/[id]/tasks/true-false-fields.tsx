"use client";

import { useState } from "react";
import type { TrueFalseConfig, TrueFalseStatement } from "@/lib/exercises/types";
import { FormattedTextField } from "./formatted-text-field";

export function TrueFalseFields({
  initialConfig,
}: {
  initialConfig?: Partial<TrueFalseConfig>;
}) {
  const [statements, setStatements] = useState<TrueFalseStatement[]>(
    initialConfig?.statements?.length
      ? initialConfig.statements
      : [{ id: crypto.randomUUID(), text: "", answer: true }]
  );

  function addStatement() {
    setStatements((prev) => [...prev, { id: crypto.randomUUID(), text: "", answer: true }]);
  }

  function removeStatement(id: string) {
    setStatements((prev) => prev.filter((s) => s.id !== id));
  }

  function updateText(id: string, text: string) {
    setStatements((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  }

  function updateAnswer(id: string, answer: boolean) {
    setStatements((prev) => prev.map((s) => (s.id === id ? { ...s, answer } : s)));
  }

  function updatePoints(id: string, points: number) {
    setStatements((prev) => prev.map((s) => (s.id === id ? { ...s, points } : s)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="tf_statements" value={JSON.stringify(statements)} readOnly />

      <FormattedTextField
        name="tf_instructions"
        label="Інструкція для студента"
        defaultValue={initialConfig?.instructions ?? ""}
        placeholder="напр. Оберіть, чи твердження правильне"
      />

      <FormattedTextField
        name="tf_sub_instructions"
        label="Додаткові інструкції (опційно)"
        defaultValue={initialConfig?.subInstructions ?? ""}
        placeholder="Додаткові пояснення для студента"
        multiline
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">Твердження</label>
        {statements.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <input
              value={s.text}
              onChange={(e) => updateText(s.id, e.target.value)}
              placeholder="Текст твердження"
              className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
            />
            <select
              value={String(s.answer)}
              onChange={(e) => updateAnswer(s.id, e.target.value === "true")}
              className="rounded-md border px-2 py-1 text-sm"
            >
              <option value="true">Vrai</option>
              <option value="false">Faux</option>
            </select>
            <input
              type="number"
              min={0}
              step={0.5}
              value={s.points ?? 1}
              onChange={(e) => updatePoints(s.id, Number(e.target.value))}
              title="Бали за це твердження"
              className="w-16 rounded-md border px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => removeStatement(s.id)}
              className="text-xs text-red-600 hover:underline dark:text-red-400"
            >
              видалити
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addStatement}
          className="mt-1 self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + твердження
        </button>
      </div>
    </div>
  );
}
