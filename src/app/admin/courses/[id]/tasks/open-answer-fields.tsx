"use client";

import { useState } from "react";
import type { OpenAnswerConfig } from "@/lib/exercises/types";

export function OpenAnswerFields({
  initialConfig,
}: {
  initialConfig?: Partial<OpenAnswerConfig>;
}) {
  const [answers, setAnswers] = useState<string[]>(
    initialConfig?.answers?.length ? initialConfig.answers : [""]
  );

  function addAnswer() {
    setAnswers((prev) => [...prev, ""]);
  }

  function removeAnswer(i: number) {
    setAnswers((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateAnswer(i: number, value: string) {
    setAnswers((prev) => prev.map((v, idx) => (idx === i ? value : v)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="open_answer_answers" value={JSON.stringify(answers)} readOnly />

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">Питання</label>
        <input
          name="open_answer_question"
          defaultValue={initialConfig?.question ?? ""}
          placeholder="напр. Як буде французькою 'дякую'?"
          className="rounded-md border px-2 py-1.5 text-base font-medium"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Прийнятні відповіді (будь-яка з них зараховується правильною)
        </label>
        {answers.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={a}
              onChange={(e) => updateAnswer(i, e.target.value)}
              placeholder="Варіант відповіді"
              className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
            />
            <button
              type="button"
              onClick={() => removeAnswer(i)}
              className="text-xs text-red-600 hover:underline dark:text-red-400"
            >
              видалити
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addAnswer}
          className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + варіант
        </button>
      </div>
    </div>
  );
}
