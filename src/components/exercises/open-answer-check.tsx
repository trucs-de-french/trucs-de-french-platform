"use client";

import { useState } from "react";
import type { OpenAnswerPublic, OpenAnswerDetail } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";

// На відміну від EssayCheckExercise (essay_check, AI/Gemini-перевірка
// розгорнутого тексту), тут коротка відповідь звіряється з фіксованим
// списком прийнятних варіантів — той самий принцип, що для одного пропуску
// у fill_blank, через спільний /api/exercises/check.
export function OpenAnswerCheckExercise({
  taskId,
  config,
}: {
  taskId: string;
  config: OpenAnswerPublic;
}) {
  const [answer, setAnswer] = useState("");
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as OpenAnswerDetail | undefined;

  return (
    <div>
      <p className="mb-2 font-medium">{config.question || DEFAULT_INSTRUCTIONS.open_answer}</p>

      <input
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={!!result}
        className={`w-full rounded-md border px-2 py-1.5 text-sm ${
          detail ? (detail.isCorrect ? "border-green-500 bg-green-50 dark:bg-green-950/30" : "border-red-500 bg-red-50 dark:bg-red-950/30") : ""
        }`}
        placeholder="Ваша відповідь..."
      />

      {detail && !detail.isCorrect && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          Правильно: {detail.correctAnswers.join(" / ")}
        </p>
      )}

      {!result ? (
        <button
          type="button"
          onClick={() => submit(answer)}
          disabled={pending || !answer.trim()}
          className="mt-3 rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          {pending ? "Перевіряю..." : "Перевірити"}
        </button>
      ) : (
        <p
          className={`mt-3 text-sm font-medium ${
            result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {result.correct ? "Правильно! ✓" : "Неправильно"}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
