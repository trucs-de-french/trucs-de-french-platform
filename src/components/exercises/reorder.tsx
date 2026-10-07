"use client";

import { useState, useEffect } from "react";
import type { ReorderPublic, ReorderDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { SortableTileRow } from "./sortable-tile-row";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { CompactAudioButton } from "./compact-audio-button";
import { ImageLightbox } from "./image-lightbox";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { WORD_CARD } from "@/lib/exercises/word-list-layout";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";

type SequenceDetail = ReorderDetail["sequences"][number];

// Один ряд плиток у перемішаному порядку — жодного окремого банку чи
// порожніх слотів (на відміну від drag_drop, де банк доречний через текст
// із пропусками). Сам DnD/click-move — у спільному SortableTileRow
// (той самий код, що й letter_rearrangement). Контрольований компонент —
// батько (ReorderExercise) тримає поточний порядок кожної послідовності.
function ReorderSequenceTiles({
  order,
  onChange,
  detail,
  locked,
  points,
  pointsVisible,
  hidePoints,
  imageUrl,
  audioUrl,
  onOpenImage,
}: {
  order: string[];
  onChange: (next: string[]) => void;
  detail?: SequenceDetail;
  locked: boolean;
  points: number;
  pointsVisible: boolean;
  hidePoints?: boolean;
  imageUrl?: string;
  audioUrl?: string;
  onOpenImage: (src: string) => void;
}) {
  // detail.items[i].correctIndex === i завжди (масив побудований по
  // позиції) — пряма індексація, не пошук за текстом/studentIndex.
  function tileState(i: number): "correct" | "incorrect" | undefined {
    if (!detail) return undefined;
    return detail.items[i]?.isCorrect ? "correct" : "incorrect";
  }

  // До перевірки — лише якщо pointsVisible; після — завжди. Бали
  // послідовності зараховуються, лише якщо ВСЯ вона правильна (не по
  // окремій плитці, як score) — 0/points, а не часткове.
  const sequenceCorrect = detail?.items.every((i) => i.isCorrect) ?? false;

  // Та сама картка, що слово letter_rearrangement (WORD_CARD) — картинка
  // зліва, вміст (бали/плитки/правильний порядок) у колонці праворуч від
  // неї. Без медіа внутрішній flex-рядок лишається з ОДНИМ дочірнім
  // елементом (content), жодного порожнього місця зліва не з'являється.
  return (
    <div className={`${WORD_CARD} max-md:p-3`}>
      <div className="flex flex-col items-start gap-2.5 md:flex-row md:items-center md:gap-3">
        {(imageUrl || audioUrl) && (
          <div className="flex shrink-0 items-center gap-2">
            {imageUrl && (
              <button
                type="button"
                onClick={() => onOpenImage(imageUrl)}
                aria-label="Показати картинку повністю"
                className="shrink-0 cursor-zoom-in"
              >
                <ImageOrPlaceholder
                  src={imageUrl}
                  alt=""
                  className="h-20 w-20 rounded-lg object-cover md:h-11 md:w-11"
                  useFocus
                />
              </button>
            )}
            {audioUrl && <CompactAudioButton src={audioUrl} />}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2 max-md:w-full">
          {!hidePoints && (pointsVisible || detail) && (
            <p className={SCORE_LABEL_CLASS}>
              {detail
                ? `${sequenceCorrect ? points : 0}/${points} ${pluralizePoints(points)}`
                : `${points} ${pluralizePoints(points)}`}
            </p>
          )}
          <div className="max-md:rounded-lg max-md:bg-neutral-50 max-md:p-2 max-md:dark:bg-neutral-900">
            <SortableTileRow
              items={order}
              onChange={onChange}
              locked={locked}
              tileState={tileState}
              extraContainerClassName="max-md:gap-x-2 max-md:gap-y-1.5"
              extraTileClassName="max-md:min-h-11 touch-manipulation"
            />
          </div>

          {detail && (
            <p className="break-words text-sm text-neutral-600 dark:text-neutral-400 [overflow-wrap:anywhere]">
              Правильний порядок:{" "}
              {[...detail.items]
                .sort((a, b) => a.correctIndex - b.correctIndex)
                .map((i) => i.text)
                .join(" → ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ReorderExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: ReorderPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  const [orders, setOrders] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(config.sequences.map((s) => [s.id, s.items]))
  );
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as ReorderDetail | undefined;
  const locked = !!result;

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  return (
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.reorder.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.reorder.subInstruction}
      />

      {!locked && (
        <p className="tap-swap-hint text-sm text-neutral-500 dark:text-neutral-400">
          Торкніться двох слів, щоб поміняти їх місцями
        </p>
      )}

      <div className="flex flex-col gap-3">
        {config.sequences.map((seq) => (
          <ReorderSequenceTiles
            key={seq.id}
            order={orders[seq.id] ?? seq.items}
            onChange={(next) => setOrders((prev) => ({ ...prev, [seq.id]: next }))}
            detail={detail?.sequences.find((d) => d.id === seq.id)}
            locked={locked}
            points={seq.points}
            pointsVisible={pointsVisible}
            hidePoints={hidePoints}
            imageUrl={seq.imageUrl}
            audioUrl={seq.audioUrl}
            onOpenImage={setLightboxSrc}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {!result ? (
          <button
            type="button"
            onClick={() =>
              submit(config.sequences.map((s) => ({ sequenceId: s.id, order: orders[s.id] ?? [] })))
            }
            disabled={pending}
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
