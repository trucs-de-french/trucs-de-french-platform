"use client";

import { useState } from "react";
import type { FillBlankPublic, FillBlankDetail } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";

export function FillBlankExercise({
  taskId,
  config,
  pointsVisible,
}: {
  taskId: string;
  config: FillBlankPublic;
  pointsVisible: boolean;
}) {
  const segments = config.template.split("{{}}");
  const blankCount = segments.length - 1;
  const [answers, setAnswers] = useState<string[]>(() => Array(blankCount).fill(""));
  // Довідкові бульбашки — суто локальний UI-стан на сесію проходження, не
  // зберігається на сервері й не впливає на перевірку. За ІНДЕКСОМ у
  // wordBank, не за текстом — щоб клік на одне слово не викреслював інше
  // однакове слово, якщо вчитель вписав його двічі.
  const [crossedOut, setCrossedOut] = useState<Set<number>>(new Set());
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as FillBlankDetail | undefined;

  function toggleCrossedOut(i: number) {
    setCrossedOut((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div>
      <p className="mb-2 font-medium">
        {config.instructions ?? DEFAULT_INSTRUCTIONS.fill_blank}
        {/* Бали на ВСЮ вправу (не на пропуск) — до перевірки лише якщо
            pointsVisible, після — завжди. */}
        {(pointsVisible || detail) && (
          <span className="ml-2 text-xs font-normal italic text-neutral-500 dark:text-neutral-400">
            {detail
              ? `${result?.correct ? config.points : 0}/${config.points} балів`
              : `${config.points} ${config.points === 1 ? "бал" : "балів"}`}
          </span>
        )}
      </p>
      <p className="leading-8">
        {segments.map((seg, i) => (
          <span key={i}>
            {seg}
            {i < blankCount && (
              <input
                value={answers[i]}
                onChange={(e) =>
                  setAnswers((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                }
                disabled={!!result}
                className={`mx-1 w-28 rounded border px-2 py-0.5 text-sm ${
                  detail
                    ? detail.blanks[i]?.isCorrect
                      ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                      : "border-red-500 bg-red-50 dark:bg-red-950/30"
                    : ""
                }`}
              />
            )}
          </span>
        ))}
      </p>

      {/* Опційний банк слів-підказок — суто довідковий, клік лише
          викреслює/повертає слово візуально для самого студента, ніяк не
          впливає на answers/submit. */}
      {config.wordBank && config.wordBank.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {config.wordBank.map((word, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleCrossedOut(i)}
              className={`rounded-full border px-3 py-1 text-sm ${
                crossedOut.has(i)
                  ? "text-neutral-400 line-through opacity-60 dark:text-neutral-500"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              {word}
            </button>
          ))}
        </div>
      )}

      {detail && (
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {detail.blanks.map((b, i) =>
            b.isCorrect ? null : (
              <li key={i} className="text-red-600 dark:text-red-400">
                Пропуск {i + 1}: правильно — {b.correctAnswers.join(" / ")}
              </li>
            )
          )}
        </ul>
      )}

      {!result ? (
        <button
          type="button"
          onClick={() => submit(answers)}
          disabled={pending}
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
          {result.correct ? "Правильно! ✓" : `Результат: ${result.score}%`}
          {result.pointsPossible !== undefined && (
            <span className="ml-2 font-normal text-neutral-500 dark:text-neutral-400">
              ({result.pointsEarned} з {result.pointsPossible} балів)
            </span>
          )}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
