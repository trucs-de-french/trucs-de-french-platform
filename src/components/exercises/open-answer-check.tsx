"use client";

import { useState, useEffect } from "react";
import type { OpenAnswerPublic, OpenAnswerDetail, GradeResult } from "@/lib/exercises/types";
import { HintBulb } from "./hint-bulb";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { DiacriticsPopup, useDiacriticsPopup, insertAtCursor, focusAndSetCursor } from "./diacritics-popup";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { CompactAudioButton } from "./compact-audio-button";
import { ImageLightbox } from "./image-lightbox";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP } from "@/lib/spacing";
import { frenchNbsp } from "@/lib/text/french-typography";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";

// На відміну від EssayCheckExercise (essay_check, AI/Gemini-перевірка
// розгорнутого тексту), тут коротка відповідь звіряється з фіксованим
// списком прийнятних варіантів — той самий принцип, що для одного пропуску
// у fill_blank, через спільний /api/exercises/check. Кілька питань під
// однією вправою — та сама модель, що listening.tsx.
export function OpenAnswerCheckExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: OpenAnswerPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hintShown, setHintShown] = useState<Set<string>>(new Set());
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const diacritics = useDiacriticsPopup<string>();
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as OpenAnswerDetail | undefined;

  function showHint(id: string) {
    setHintShown((prev) => new Set(prev).add(id));
  }

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  const allAnswered = config.questions.every((q) => answers[q.id]?.trim());

  return (
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.open_answer.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.open_answer.subInstruction}
      />

      <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP}`}>
        {config.questions.map((q) => {
          const qDetail = detail?.questions.find((d) => d.id === q.id);
          const hintVisible = hintShown.has(q.id);
          return (
            <div key={q.id}>
              <div className="flex items-start gap-3">
                {(q.imageUrl || q.audioUrl) && (
                  <div className="flex shrink-0 items-center gap-2">
                    {q.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setLightboxSrc(q.imageUrl!)}
                        aria-label="Показати картинку повністю"
                        className="shrink-0 cursor-zoom-in"
                      >
                        <ImageOrPlaceholder
                          src={q.imageUrl}
                          alt=""
                          className="h-11 w-11 rounded-lg object-cover"
                          useFocus
                        />
                      </button>
                    )}
                    {q.audioUrl && <CompactAudioButton src={q.audioUrl} />}
                  </div>
                )}
                <p className="min-w-0 flex-1 break-words font-medium [overflow-wrap:anywhere]">
                  {frenchNbsp(q.question)}
                  {/* До перевірки — лише якщо pointsVisible; після — завжди. */}
                  {!hidePoints && (pointsVisible || qDetail) && (
                    <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
                      {qDetail
                        ? `${qDetail.isCorrect ? qDetail.points : 0}/${qDetail.points} ${pluralizePoints(qDetail.points)}`
                        : `${q.points} ${pluralizePoints(q.points)}`}
                    </span>
                  )}
                  {q.hint && !result && (
                    <HintBulb
                      size="sm"
                      state={hintVisible ? "used" : "available"}
                      onClick={() => showHint(q.id)}
                      className="ml-1.5 align-middle"
                    />
                  )}
                </p>
              </div>
              {q.hint && hintVisible && (
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{q.hint}</p>
              )}
              {/* px-4 py-2.5 — та сама компактність, що картка твердження
                  true_false; bg-white на невідповідженому стані — як у
                  карток відповідей (ANSWER_CARD_DEFAULT) — INPUT_BORDER
                  (input-styles.ts) тут не використовується взагалі, тож
                  правити нічого спільного не довелось. */}
              <input
                ref={diacritics.fieldRef(q.id)}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                onFocus={() => diacritics.onFocus(q.id)}
                onBlur={diacritics.onBlur}
                disabled={!!result}
                className={`mt-1 w-full rounded-md border px-4 py-2.5 text-base ${
                  qDetail
                    ? qDetail.isCorrect
                      ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                      : "border-red-500 bg-red-50 dark:bg-red-950/30"
                    : "border-gray-300 bg-white dark:border-neutral-600 dark:bg-neutral-800"
                }`}
                placeholder="Ваша відповідь..."
              />
              {qDetail && !qDetail.isCorrect && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  Правильно: {qDetail.correctAnswers.join(" / ")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {diacritics.rect && !result && diacritics.activeKey && (
        <DiacriticsPopup
          rect={diacritics.rect}
          onPick={(ch) => {
            const id = diacritics.activeKey!;
            const el = diacritics.getElement(id);
            const { value, cursor } = insertAtCursor(el, answers[id] ?? "", ch);
            setAnswers((prev) => ({ ...prev, [id]: value }));
            focusAndSetCursor(el, cursor);
          }}
        />
      )}

      <div className="flex flex-col gap-3">
        {!result ? (
          <button
            type="button"
            onClick={() =>
              submit(
                config.questions.map((q) => ({
                  questionId: q.id,
                  value: answers[q.id] ?? "",
                  hintUsed: hintShown.has(q.id),
                }))
              )
            }
            disabled={pending || !allAnswered}
            className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
          >
            {pending ? "Перевіряю..." : "Перевірити"}
          </button>
        ) : (
          <p
            className={`${RESULT_MESSAGE_CLASS} ${
              result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {result.correct ? "Правильно! ✓" : `Результат: ${result.score}%`}
            {result.pointsPossible !== undefined && (
              <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
                ({result.pointsEarned} з {result.pointsPossible} {pluralizePoints(result.pointsPossible)})
              </span>
            )}
          </p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
