"use client";

import { useState } from "react";
import type { OpenAnswerConfig, OpenAnswerQuestion } from "@/lib/exercises/types";
import { InstructionsRichTextField } from "./instructions-rich-text-field";

function emptyQuestion(): OpenAnswerQuestion {
  return { id: crypto.randomUUID(), question: "", answers: [""] };
}

export function OpenAnswerFields({
  initialConfig,
}: {
  initialConfig?: Partial<OpenAnswerConfig>;
}) {
  const [questions, setQuestions] = useState<OpenAnswerQuestion[]>(
    initialConfig?.questions?.length ? initialConfig.questions : [emptyQuestion()]
  );

  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function updateQuestionText(id: string, text: string) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, question: text } : q)));
  }

  function addAnswer(qId: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, answers: [...q.answers, ""] } : q))
    );
  }

  function removeAnswer(qId: string, i: number) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId ? { ...q, answers: q.answers.filter((_, idx) => idx !== i) } : q
      )
    );
  }

  function updateAnswer(qId: string, i: number, value: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? { ...q, answers: q.answers.map((a, idx) => (idx === i ? value : a)) }
          : q
      )
    );
  }

  function updatePoints(qId: string, points: number) {
    setQuestions((prev) => prev.map((q) => (q.id === qId ? { ...q, points } : q)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input
        type="hidden"
        name="open_answer_questions"
        value={JSON.stringify(questions)}
        readOnly
      />

      <InstructionsRichTextField
        name="open_answer_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="open_answer_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      <div className="flex flex-col gap-3">
        {questions.map((q) => (
          <div key={q.id} className="rounded-md border p-2">
            <div className="flex items-center gap-2">
              <input
                value={q.question}
                onChange={(e) => updateQuestionText(q.id, e.target.value)}
                placeholder="напр. Як буде французькою 'дякую'?"
                className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
              />
              <input
                type="number"
                min={0}
                step={0.5}
                value={q.points ?? 1}
                onChange={(e) => updatePoints(q.id, Number(e.target.value))}
                title="Бали за це питання"
                className="w-16 rounded-md border px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => removeQuestion(q.id)}
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                видалити питання
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-1 pl-2">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">
                Прийнятні відповіді (будь-яка з них зараховується правильною)
              </label>
              {q.answers.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={a}
                    onChange={(e) => updateAnswer(q.id, i, e.target.value)}
                    placeholder="Варіант відповіді"
                    className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => removeAnswer(q.id, i)}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    видалити
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addAnswer(q.id)}
                className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
              >
                + варіант
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addQuestion}
          className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + питання
        </button>
      </div>
    </div>
  );
}
