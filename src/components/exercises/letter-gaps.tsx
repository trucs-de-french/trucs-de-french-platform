"use client";

import { useState, useEffect } from "react";
import type { LetterGapsPublic, LetterGapsDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";

export function LetterGapsExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: LetterGapsPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  // По слову: рядок відповідей довжиною = кількість прихованих позицій
  // (null-клітин) у цьому слові, у порядку зліва направо.
  const [answers, setAnswers] = useState<string[][]>(() =>
    config.words.map((w) => Array(w.chars.filter((c) => c === null).length).fill(""))
  );
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as LetterGapsDetail | undefined;

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  function updateLetter(wordIndex: number, gapIndex: number, value: string) {
    setAnswers((prev) =>
      prev.map((word, wi) =>
        wi === wordIndex ? word.map((v, gi) => (gi === gapIndex ? value : v)) : word
      )
    );
  }

  return (
    <div>
      <div className="mb-2">
        <div className="flex flex-wrap items-baseline gap-2 font-medium">
          <div
            dangerouslySetInnerHTML={{
              __html: sanitizeInstructionsHtml(config.instructions ?? DEFAULT_INSTRUCTIONS.letter_gaps),
            }}
          />
          {!hidePoints && (pointsVisible || detail) && (
            <span className="text-xs font-normal italic text-neutral-500 dark:text-neutral-400">
              {detail
                ? `${result?.correct ? config.points : 0}/${config.points} ${pluralizePoints(config.points)}`
                : `${config.points} ${pluralizePoints(config.points)}`}
            </span>
          )}
        </div>
        {config.subInstructions && (
          <div
            className="mt-0.5 text-sm font-normal text-neutral-500 dark:text-neutral-400"
            dangerouslySetInnerHTML={{ __html: sanitizeInstructionsHtml(config.subInstructions) }}
          />
        )}
      </div>

      <div className="flex flex-col gap-3">
        {config.words.map((word, wi) => {
          let gapIndex = -1;
          const wordDetail = detail?.words[wi];
          return (
            <div key={wi}>
              {word.imageUrl && (
                <ImageOrPlaceholder
                  src={word.imageUrl}
                  alt=""
                  className="mb-1 h-20 w-20 rounded object-cover"
                />
              )}
              {word.audioUrl && (
                <audio controls src={word.audioUrl} className="mb-1 h-8 w-full max-w-xs" />
              )}
              <p className="text-sm italic text-neutral-500 dark:text-neutral-400">
                {word.hintType === "definition" ? "Визначення: " : "Речення: "}
                {word.hintText}
              </p>
              <p className="leading-8">
                {word.chars.map((char, ci) => {
                  if (char !== null) return <span key={ci}>{char}</span>;
                  gapIndex += 1;
                  const gi = gapIndex;
                  return (
                    <input
                      key={ci}
                      maxLength={1}
                      value={answers[wi][gi]}
                      onChange={(e) => updateLetter(wi, gi, e.target.value)}
                      disabled={!!result}
                      className={`m-0.5 inline-block w-11 rounded-md border px-1 py-1.5 text-center text-base shadow-sm transition-colors ${
                        wordDetail
                          ? wordDetail.isCorrect
                            ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                            : "border-red-500 bg-red-50 dark:bg-red-950/30"
                          : "border-gray-200 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-800/70"
                      }`}
                    />
                  );
                })}
              </p>
            </div>
          );
        })}
      </div>

      {!result ? (
        <button
          type="button"
          onClick={() => submit(answers)}
          disabled={pending}
          className={`mt-3 ${STUDENT_BUTTON_PRIMARY}`}
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
              ({result.pointsEarned} з {result.pointsPossible} {pluralizePoints(result.pointsPossible)})
            </span>
          )}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
