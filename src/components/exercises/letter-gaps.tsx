"use client";

import { useState, useEffect } from "react";
import type { LetterGapsPublic, LetterGapsDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { DiacriticsPopup, useDiacriticsPopup } from "./diacritics-popup";
import { EXERCISE_INSTRUCTION, EXERCISE_SUBINSTRUCTION } from "@/lib/typography-styles";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP, EXERCISE_LABEL_GAP } from "@/lib/spacing";

type CharGroup = { type: "letters"; text: string } | { type: "gap" };

// Сусідні видимі літери без пропуску між ними ("b"+"e" у "be") — в ОДИН
// <span>, а не по одному на символ, щоб вони стояли впритул, як звичайне
// слово, а не розсувались через gap-1 контейнера. Пропуски (null) свідомо
// НЕ об'єднуються між собою — кожен лишається окремим полем уводу, як і
// раніше (одна прихована літера = один <input>).
function groupChars(chars: (string | null)[]): CharGroup[] {
  const groups: CharGroup[] = [];
  for (const char of chars) {
    if (char === null) {
      groups.push({ type: "gap" });
      continue;
    }
    const last = groups[groups.length - 1];
    if (last?.type === "letters") {
      last.text += char;
    } else {
      groups.push({ type: "letters", text: char });
    }
  }
  return groups;
}

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
  const diacritics = useDiacriticsPopup<string>();
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
    <div className={EXERCISE_STACK}>
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <div
            className={`instruction-text ${EXERCISE_INSTRUCTION}`}
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
            className={`mt-1 ${EXERCISE_SUBINSTRUCTION}`}
            dangerouslySetInnerHTML={{ __html: sanitizeInstructionsHtml(config.subInstructions) }}
          />
        )}
      </div>

      <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP}`}>
        {config.words.map((word, wi) => {
          let gapIndex = -1;
          const wordDetail = detail?.words[wi];
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
              <div className="flex flex-wrap items-center gap-1">
                {groupChars(word.chars).map((group, ci) => {
                  if (group.type === "letters")
                    return (
                      <span key={ci} className="font-heading text-lg font-medium">
                        {group.text}
                      </span>
                    );
                  gapIndex += 1;
                  const gi = gapIndex;
                  return (
                    <input
                      key={ci}
                      ref={diacritics.fieldRef(`${wi},${gi}`)}
                      maxLength={1}
                      value={answers[wi][gi]}
                      onChange={(e) => updateLetter(wi, gi, e.target.value)}
                      onFocus={() => diacritics.onFocus(`${wi},${gi}`)}
                      onBlur={diacritics.onBlur}
                      disabled={!!result}
                      // font-heading font-medium text-lg прямо на input —
                      // не лише для вирівнювання з видимими літерами, а й
                      // тому, що глобальне input{font-family:var(--font-heading)}
                      // (globals.css) саме по собі дає ЛИШЕ шрифт, не вагу/
                      // розмір — ті все одно треба задавати явно тут.
                      className={`h-9 w-8 rounded-md border text-center font-heading text-lg font-medium shadow-sm transition-colors ${
                        wordDetail
                          ? wordDetail.isCorrect
                            ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                            : "border-red-500 bg-red-50 dark:bg-red-950/30"
                          : "border-gray-200 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-800/70"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {diacritics.rect && !result && diacritics.activeKey && (
        <DiacriticsPopup
          rect={diacritics.rect}
          onPick={(ch) => {
            const [wi, gi] = diacritics.activeKey!.split(",").map(Number);
            updateLetter(wi, gi, ch);
          }}
        />
      )}

      <div className="flex flex-col gap-3">
        {!result ? (
          <button
            type="button"
            onClick={() => submit(answers)}
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
