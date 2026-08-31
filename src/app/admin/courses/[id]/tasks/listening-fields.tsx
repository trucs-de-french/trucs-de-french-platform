"use client";

import { useState } from "react";
import type { ListeningConfig, ListeningQuestion } from "@/lib/exercises/types";

function emptyQuestion(): ListeningQuestion {
  return {
    id: crypto.randomUUID(),
    question: "",
    options: [
      { id: crypto.randomUUID(), text: "", correct: true },
      { id: crypto.randomUUID(), text: "", correct: false },
    ],
  };
}

export function ListeningFields({
  initialConfig,
}: {
  initialConfig?: Partial<ListeningConfig>;
}) {
  const [questions, setQuestions] = useState<ListeningQuestion[]>(
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

  function addOption(qId: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? { ...q, options: [...q.options, { id: crypto.randomUUID(), text: "", correct: false }] }
          : q
      )
    );
  }

  function removeOption(qId: string, oId: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId ? { ...q, options: q.options.filter((o) => o.id !== oId) } : q
      )
    );
  }

  function updateOptionText(qId: string, oId: string, text: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? { ...q, options: q.options.map((o) => (o.id === oId ? { ...o, text } : o)) }
          : q
      )
    );
  }

  function setCorrectOption(qId: string, oId: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? { ...q, options: q.options.map((o) => ({ ...o, correct: o.id === oId })) }
          : q
      )
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="listening_questions" value={JSON.stringify(questions)} readOnly />

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Інструкція для студента
        </label>
        <input
          name="listening_instructions"
          defaultValue={initialConfig?.instructions ?? ""}
          placeholder="напр. Прослухайте аудіо і дайте відповідь на запитання"
          className="rounded-md border px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">URL аудіо/відео</label>
        <input
          name="listening_audio_url"
          defaultValue={initialConfig?.audioUrl ?? ""}
          placeholder="пряме посилання на mp3 або YouTube"
          className="rounded-md border px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Питання (одна правильна відповідь на питання)
        </label>
        {questions.map((q) => (
          <div key={q.id} className="rounded-md border p-2">
            <div className="flex items-center gap-2">
              <input
                value={q.question}
                onChange={(e) => updateQuestionText(q.id, e.target.value)}
                placeholder="Текст питання"
                className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
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
              {q.options.map((o) => (
                <div key={o.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`listening_correct_${q.id}`}
                    checked={o.correct}
                    onChange={() => setCorrectOption(q.id, o.id)}
                    title="Правильна відповідь"
                  />
                  <input
                    value={o.text}
                    onChange={(e) => updateOptionText(q.id, o.id, e.target.value)}
                    placeholder="Варіант відповіді"
                    className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(q.id, o.id)}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    видалити
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addOption(q.id)}
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
