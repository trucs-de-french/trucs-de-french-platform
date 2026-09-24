"use client";

import { useState, useEffect } from "react";
import type { LetterRearrangementPublic, LetterRearrangementDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { SwappableTileRow } from "./swappable-tile-row";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_INSTRUCTION, EXERCISE_SUBINSTRUCTION } from "@/lib/typography-styles";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP, EXERCISE_LABEL_GAP } from "@/lib/spacing";

export function LetterRearrangementExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: LetterRearrangementPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  const [orders, setOrders] = useState<string[][]>(() =>
    config.words.map((w) => w.shuffledLetters)
  );
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as LetterRearrangementDetail | undefined;
  const locked = !!result;

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  function updateOrder(wordIndex: number, next: string[]) {
    setOrders((prev) => prev.map((o, wi) => (wi === wordIndex ? next : o)));
  }

  return (
    <div className={EXERCISE_STACK}>
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <div
            className={`instruction-text ${EXERCISE_INSTRUCTION}`}
            dangerouslySetInnerHTML={{
              __html: sanitizeInstructionsHtml(
                config.instructions ?? DEFAULT_INSTRUCTIONS.letter_rearrangement
              ),
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
            className={`mt-1 ${EXERCISE_SUBINSTRUCTION}`}
            dangerouslySetInnerHTML={{ __html: sanitizeInstructionsHtml(config.subInstructions) }}
          />
        )}
      </div>

      <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP}`}>
        {config.words.map((word, wi) => {
          const wordDetail = detail?.words[wi];
          // letters[i].correctIndex === i завжди (той самий принцип, що
          // ReorderDetail.items) — пряма індексація, без пошуку.
          function tileState(i: number): "correct" | "incorrect" | undefined {
            if (!wordDetail) return undefined;
            return wordDetail.letters[i]?.isCorrect ? "correct" : "incorrect";
          }

          return (
            <div key={wi} className={`flex flex-col ${EXERCISE_LABEL_GAP}`}>
              {word.imageUrl && (
                <ImageOrPlaceholder
                  src={word.imageUrl}
                  alt=""
                  className="h-20 w-20 rounded object-cover"
                />
              )}
              {word.audioUrl && (
                <audio controls src={word.audioUrl} className="h-8 w-full max-w-xs" />
              )}
              {word.hintText.trim() && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{word.hintText}</p>
              )}
              <SwappableTileRow
                items={orders[wi]}
                onChange={(next) => updateOrder(wi, next)}
                locked={locked}
                tileState={tileState}
              />
              {wordDetail && !wordDetail.isCorrect && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Правильне слово: {wordDetail.letters.map((l) => l.text).join("")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {!result ? (
          <button
            type="button"
            onClick={() => submit(orders)}
            disabled={pending}
            className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
          >
            {pending ? "Перевіряю..." : "Перевірити"}
          </button>
        ) : (
          <p
            className={`text-sm font-medium ${
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
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
