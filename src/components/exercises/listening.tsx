"use client";

import { useState, useEffect } from "react";
import type { ListeningPublic, ListeningDetail, ListeningAnswer, GradeResult } from "@/lib/exercises/types";
import { isYouTubeUrl, isGdriveUrl, toEmbedUrl } from "@/lib/video";
import { VideoFrame } from "@/components/video-frame";
import { useExerciseCheck } from "./use-exercise-check";
import { usePracticeCheck } from "./use-practice-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { AudioPlayer } from "@/components/audio-player";
import { GdriveAudioPlayer } from "@/components/gdrive-audio-player";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { ImageZoomBadge } from "./image-zoom-badge";
import { ImageLightbox } from "./image-lightbox";
import { ANSWER_CARD_BASE, ANSWER_CARD_DEFAULT } from "./answer-card-style";
import { frenchNbsp } from "@/lib/text/french-typography";
import { STUDENT_BUTTON_PRIMARY, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";

// Режим практики "Робота над помилками" (частина 6, хвиля 1) — той самий
// принцип, що TableFillPracticeProps: елемент тут question.id (стабільний,
// самодостатній — options власні, без спільного секретного пулу, як
// matching/drag_drop/image_match), тож компонент фільтрує повний
// санітизований config САМ (той самий принцип, що letter-rearrangement.tsx),
// без серверного ForPractice-звуження.
export type ListeningPracticeProps = {
  onlyItemIds: string[];
  failedAttempts: Record<string, number>;
};

export function ListeningExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
  practice,
}: {
  taskId: string;
  config: ListeningPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  practice?: ListeningPracticeProps;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as ListeningDetail | undefined;
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  const allAnswered = config.questions.every((q) => answers[q.id]);

  // ==== Гілка практики (onlyItemIds) — незалежна від result/allAnswered
  // вище: той самий принцип, що table-fill.tsx — плаский список лише
  // помилкових питань, один спільний "Перевірити" на всі показані.
  const isPractice = !!practice;
  const practiceQuestions = isPractice
    ? config.questions.filter((q) => practice!.onlyItemIds.includes(q.id))
    : [];
  const practiceCheck = usePracticeCheck(taskId);
  const [practiceResults, setPracticeResults] = useState<Record<string, boolean>>({});
  const [practiceFailedAttempts, setPracticeFailedAttempts] = useState<Record<string, number>>(
    practice?.failedAttempts ?? {}
  );
  const onlyItemIdsKey = practice?.onlyItemIds.join(",") ?? "";
  const [prevOnlyItemIdsKey, setPrevOnlyItemIdsKey] = useState(onlyItemIdsKey);
  if (isPractice && onlyItemIdsKey !== prevOnlyItemIdsKey) {
    setPrevOnlyItemIdsKey(onlyItemIdsKey);
    setPracticeResults({});
  }
  const practiceAllAnswered = practiceQuestions.every((q) => answers[q.id]);

  async function submitPractice() {
    const itemIds = practiceQuestions.map((q) => q.id);
    const answer: ListeningAnswer = practiceQuestions.map((q) => ({ questionId: q.id, optionId: answers[q.id] }));
    const r = await practiceCheck.check(itemIds, answer);
    if (!r) return;
    setPracticeResults((prev) => {
      const next = { ...prev };
      for (const x of r.results) next[x.itemId] = x.correct;
      return next;
    });
    setPracticeFailedAttempts(r.failedAttempts);
    for (const x of r.results) {
      if (!x.correct && (r.failedAttempts[x.itemId] ?? 0) >= 2 && !practiceCheck.revealed[x.itemId]) {
        practiceCheck.reveal(x.itemId, false);
      }
    }
  }

  if (isPractice) {
    return (
      <div className={EXERCISE_STACK}>
        {isYouTubeUrl(config.audioUrl) ? (
          <VideoFrame src={toEmbedUrl(config.audioUrl, "youtube")} title="Відео" provider="youtube" />
        ) : isGdriveUrl(config.audioUrl) ? (
          <GdriveAudioPlayer url={config.audioUrl} />
        ) : (
          <AudioPlayer src={config.audioUrl} />
        )}

        <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP}`}>
          {practiceQuestions.map((q) => {
            const isCorrect = practiceResults[q.id];
            const attempts = practiceFailedAttempts[q.id] ?? 0;
            const itemRevealed = practiceCheck.revealed[q.id];
            return (
              <div key={q.id} className="min-w-0">
                <p className="break-words font-medium [overflow-wrap:anywhere]">{frenchNbsp(q.question)}</p>
                <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {q.options.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                      className={`${ANSWER_CARD_BASE} min-w-0 break-words [overflow-wrap:anywhere] ${
                        answers[q.id] === o.id ? SELECTED_OPTION_CLASS : ANSWER_CARD_DEFAULT
                      }`}
                    >
                      {o.text}
                    </button>
                  ))}
                </div>
                {isCorrect === true && (
                  <p className="mt-1 text-xs font-medium text-green-600 dark:text-green-400">Правильно ✓</p>
                )}
                {isCorrect === false && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-red-600 dark:text-red-400">
                      Неправильно, спробуйте ще раз (спроб: {attempts})
                    </span>
                    {!itemRevealed && (
                      <button
                        type="button"
                        onClick={() => practiceCheck.reveal(q.id, true)}
                        disabled={!!practiceCheck.revealPending[q.id]}
                        className={STUDENT_BUTTON_SECONDARY_TOUCH}
                      >
                        Показати відповідь
                      </button>
                    )}
                  </div>
                )}
                {itemRevealed && (
                  <p className="mt-1 text-xs italic text-amber-700 dark:text-amber-400">
                    Правильна відповідь: {itemRevealed.join(", ")}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={submitPractice}
            disabled={practiceCheck.pending || !practiceAllAnswered}
            className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
          >
            {practiceCheck.pending ? "Перевіряю..." : "Перевірити"}
          </button>
          {practiceCheck.error && <p className="text-sm text-red-600 dark:text-red-400">{practiceCheck.error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.listening.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.listening.subInstruction}
      />

      {isYouTubeUrl(config.audioUrl) ? (
        <VideoFrame src={toEmbedUrl(config.audioUrl, "youtube")} title="Відео" provider="youtube" />
      ) : isGdriveUrl(config.audioUrl) ? (
        <GdriveAudioPlayer url={config.audioUrl} />
      ) : (
        <AudioPlayer src={config.audioUrl} />
      )}

      <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP}`}>
        {config.questions.map((q) => {
          const qDetail = detail?.questions.find((d) => d.id === q.id);
          return (
            <div key={q.id} className="min-w-0">
              <p className="break-words font-medium [overflow-wrap:anywhere]">
                {frenchNbsp(q.question)}
                {/* До перевірки — лише якщо pointsVisible; після — завжди. */}
                {!hidePoints && (pointsVisible || qDetail) && (
                  <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
                    {qDetail
                      ? `${qDetail.options.every((o) => o.correct === o.selected) ? q.points : 0}/${q.points} ${pluralizePoints(q.points)}`
                      : `${q.points} ${pluralizePoints(q.points)}`}
                  </span>
                )}
              </p>
              {/* grid, не суворо один стовпчик — на вузькому екрані природно
                  переходить в один стовпчик (вертикально), на широкому —
                  кілька поруч (горизонтально). */}
              <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                {q.options.map((o) => {
                  const od = qDetail?.options.find((x) => x.id === o.id);
                  const cls = od
                    ? od.correct && od.selected
                      ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                      : od.correct && !od.selected
                        ? "border-green-500 border-dashed"
                        : !od.correct && od.selected
                          ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                          : "opacity-60"
                    : answers[q.id] === o.id
                      ? SELECTED_OPTION_CLASS
                      : ANSWER_CARD_DEFAULT;

                  if (o.imageUrl) {
                    // Той самий принцип, що в multiple-choice.tsx: підсвічення
                    // йде на маленький квадратик-чекбокс, а не на всю кнопку.
                    const indicator = !od
                      ? {
                          mark: answers[q.id] === o.id ? "✓" : "",
                          className:
                            answers[q.id] === o.id
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-neutral-300 dark:border-neutral-600",
                        }
                      : od.correct
                        ? { mark: "✓", className: "border-green-600 bg-green-600 text-white" }
                        : od.selected
                          ? { mark: "✕", className: "border-red-600 bg-red-600 text-white" }
                          : { mark: "", className: "border-neutral-300 opacity-60 dark:border-neutral-600" };
                    return (
                      <button
                        key={o.id}
                        type="button"
                        disabled={!!result}
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                        className={`relative ${ANSWER_CARD_BASE} ${ANSWER_CARD_DEFAULT}`}
                      >
                        <ImageZoomBadge onOpen={() => setLightboxSrc(o.imageUrl!)} />
                        <ImageOrPlaceholder
                          src={o.imageUrl}
                          alt={o.text || ""}
                          className="mx-auto h-20 w-20 rounded object-cover"
                          useFocus
                        />
                        <div className="mt-1 flex items-center justify-center gap-1.5">
                          <span
                            aria-hidden
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none ${indicator.className}`}
                          >
                            {indicator.mark}
                          </span>
                          {o.text && <span>{o.text}</span>}
                        </div>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={o.id}
                      type="button"
                      disabled={!!result}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                      className={`${ANSWER_CARD_BASE} min-w-0 break-words [overflow-wrap:anywhere] ${cls}`}
                    >
                      {o.text}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {!result ? (
          <button
            type="button"
            onClick={() =>
              submit(config.questions.map((q) => ({ questionId: q.id, optionId: answers[q.id] })))
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
