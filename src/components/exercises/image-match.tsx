"use client";

import { useState, useEffect } from "react";
import type { ImageMatchPublic, ImageMatchDetail, ImageMatchAnswer, GradeResult } from "@/lib/exercises/types";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { ImageLightbox } from "./image-lightbox";
import { useExerciseCheck } from "./use-exercise-check";
import { usePracticeCheck } from "./use-practice-check";
import { useTilePlacement } from "./use-tile-placement";
import { bankTileClass, slotClass, stickyPoolClass } from "./tile-styles";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { TaskPanelHeader } from "./task-panel-header";
import { ANSWER_CHIP_BASE, ANSWER_CHIP_DEFAULT } from "./answer-card-style";
import { STUDENT_BUTTON_PRIMARY, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";

// Режим практики "Робота над помилками" (частина 6, хвиля 1) — той самий
// принцип, що DragDropPracticeProps: config тут УЖЕ звужений сервером
// (page.tsx: sanitizeImageMatchForPractice) до рівно items review.
// remainingItemIds і до назв банку, потрібних САМЕ цим картинкам.
export type ImageMatchPracticeProps = {
  onlyItemIds: string[];
  failedAttempts: Record<string, number>;
};

export function ImageMatchExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
  practice,
}: {
  taskId: string;
  config: ImageMatchPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  practice?: ImageMatchPracticeProps;
}) {
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as ImageMatchDetail | undefined;
  const locked = !!result;
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  const {
    placed,
    selected,
    hoveredSlot,
    usedBankIndices,
    clickBank,
    clickSlot,
    bankDragProps,
    slotDragProps,
    slotDropProps,
    bankDropProps,
  } = useTilePlacement(config.items.length, locked);

  // ==== Гілка практики (onlyItemIds) — незалежна від result/locked вище,
  // той самий принцип, що drag-drop.tsx: той самий useTilePlacement
  // (config.items.length уже звужений сервером до практики), без per-item
  // кольорів (practice/check повертає лише isCorrect на item, а не повний
  // detail) — той самий компроміс, що letter-rearrangement.tsx.
  const isPractice = !!practice;
  const practiceCheck = usePracticeCheck(taskId);
  const [practiceItemResults, setPracticeItemResults] = useState<Record<string, boolean>>({});
  const [practiceFailedAttempts, setPracticeFailedAttempts] = useState<Record<string, number>>(
    practice?.failedAttempts ?? {}
  );
  const onlyItemIdsKey = practice?.onlyItemIds.join(",") ?? "";
  const [prevOnlyItemIdsKey, setPrevOnlyItemIdsKey] = useState(onlyItemIdsKey);
  if (isPractice && onlyItemIdsKey !== prevOnlyItemIdsKey) {
    setPrevOnlyItemIdsKey(onlyItemIdsKey);
    setPracticeItemResults({});
  }

  async function submitPractice() {
    const itemIds = config.items.map((item) => item.id);
    const answer: ImageMatchAnswer = config.items.map((item, i) => ({
      itemId: item.id,
      name: placed[i] !== null ? config.bank[placed[i] as number] : "",
    }));
    const r = await practiceCheck.check(itemIds, answer);
    if (!r) return;
    setPracticeItemResults((prev) => {
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
        {usedBankIndices.size < config.bank.length ? (
          <div className={stickyPoolClass("image-match")} {...bankDropProps()}>
            {config.bank.map((name, bi) => (
              <button
                key={bi}
                type="button"
                {...bankDragProps(bi)}
                onClick={() => clickBank(bi)}
                disabled={usedBankIndices.has(bi)}
                aria-pressed={selected === bi}
                className={`shrink-0 ${bankTileClass({ selected: selected === bi, used: usedBankIndices.has(bi) })}`}
              >
                {name}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Усі слова розставлено</p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {config.items.map((item, i) => {
            const isCorrect = practiceItemResults[item.id];
            const attempts = practiceFailedAttempts[item.id] ?? 0;
            const itemRevealed = practiceCheck.revealed[item.id];
            return (
              <div
                key={item.id}
                className={`flex flex-col items-center gap-1 ${ANSWER_CHIP_BASE} ${ANSWER_CHIP_DEFAULT}`}
              >
                <button
                  type="button"
                  onClick={() => setLightboxSrc(item.imageUrl)}
                  aria-label="Показати картинку повністю"
                  className="w-full cursor-zoom-in"
                >
                  <ImageOrPlaceholder src={item.imageUrl} alt="" className="h-24 w-full rounded-md object-cover" useFocus />
                </button>
                <button
                  type="button"
                  onClick={() => clickSlot(i)}
                  {...slotDragProps(i)}
                  {...slotDropProps(i)}
                  aria-pressed={selected !== null && placed[i] === selected}
                  className={`flex min-h-11 w-full select-none items-center justify-center break-words px-2 py-1.5 text-center text-base sm:min-h-12 ${slotClass(
                    hoveredSlot === i ? "hover" : placed[i] !== null ? "filled" : "empty",
                    { rounded: "lg", emptyBg: "subtle", selectableHint: selected !== null && placed[i] === null }
                  )} ${selected !== null && placed[i] === selected ? "ring-2 ring-black dark:ring-white" : ""}`}
                >
                  {placed[i] !== null ? config.bank[placed[i] as number] : ""}
                </button>
                {isCorrect === true && (
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">Правильно ✓</p>
                )}
                {isCorrect === false && (
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                    <span className="text-red-600 dark:text-red-400">Спроб: {attempts}</span>
                    {!itemRevealed && (
                      <button
                        type="button"
                        onClick={() => practiceCheck.reveal(item.id, true)}
                        disabled={!!practiceCheck.revealPending[item.id]}
                        className={STUDENT_BUTTON_SECONDARY_TOUCH}
                      >
                        Показати відповідь
                      </button>
                    )}
                  </div>
                )}
                {itemRevealed && (
                  <p className="text-xs italic text-amber-700 dark:text-amber-400">{itemRevealed.join(", ")}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={submitPractice}
            disabled={practiceCheck.pending || placed.some((p) => p === null)}
            className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
          >
            {practiceCheck.pending ? "Перевіряю..." : "Перевірити"}
          </button>
          {practiceCheck.error && <p className="text-sm text-red-600 dark:text-red-400">{practiceCheck.error}</p>}
        </div>

        {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      </div>
    );
  }

  return (
    <div className={EXERCISE_STACK}>
      <TaskPanelHeader
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.image_match.instruction}
        subInstructionText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.image_match.subInstruction}
      />

      {usedBankIndices.size < config.bank.length ? (
        // Липкий пул: на мобільних вузький по вертикалі екран, тож один
        // рядок із горизонтальною прокруткою природніший, ніж вертикальний
        // перенос, що з'їдав би багато висоти над картками; від sm: —
        // вистачає місця на перенос рядків, тож вертикальна прокрутка з
        // max-h замість горизонтальної. Непрозорий фон і border-b — той
        // самий тон/рамка, що в EXERCISE_BLOCK_CLASS, щоб не було видно
        // картки, що проїжджають крізь пул під час скролу.
        <div
          className={stickyPoolClass("image-match")}
          {...bankDropProps()}
        >
          {config.bank.map((name, bi) => (
            <button
              key={bi}
              type="button"
              {...bankDragProps(bi)}
              onClick={() => clickBank(bi)}
              disabled={locked || usedBankIndices.has(bi)}
              aria-pressed={selected === bi}
              className={`shrink-0 ${bankTileClass({ selected: selected === bi, used: usedBankIndices.has(bi) })}`}
            >
              {name}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Усі слова розставлено</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {config.items.map((item, i) => {
          const itemDetail = detail?.items[i];
          return (
          <div key={item.id} className={`flex flex-col items-center gap-1 ${ANSWER_CHIP_BASE} ${ANSWER_CHIP_DEFAULT}`}>
            <button
              type="button"
              onClick={() => setLightboxSrc(item.imageUrl)}
              aria-label="Показати картинку повністю"
              className="w-full cursor-zoom-in"
            >
              <ImageOrPlaceholder
                src={item.imageUrl}
                alt=""
                className="h-24 w-full rounded-md object-cover"
                useFocus
              />
            </button>
            {/* До перевірки — лише якщо pointsVisible; після — завжди. */}
            {!hidePoints && (pointsVisible || itemDetail) && (
              <p className={`text-center ${SCORE_LABEL_CLASS}`}>
                {itemDetail
                  ? `${itemDetail.isCorrect ? item.points : 0}/${item.points} ${pluralizePoints(item.points)}`
                  : `${item.points} ${pluralizePoints(item.points)}`}
              </p>
            )}
            <button
              type="button"
              disabled={locked}
              onClick={() => clickSlot(i)}
              {...slotDragProps(i)}
              {...slotDropProps(i)}
              aria-pressed={selected !== null && placed[i] === selected}
              className={`flex min-h-11 w-full select-none items-center justify-center break-words px-2 py-1.5 text-center text-base sm:min-h-12 ${slotClass(
                detail
                  ? detail.items[i]?.isCorrect
                    ? "correct"
                    : "incorrect"
                  : hoveredSlot === i
                    ? "hover"
                    : placed[i] !== null
                      ? "filled"
                      : "empty",
                {
                  rounded: "lg",
                  emptyBg: "subtle",
                  selectableHint: selected !== null && placed[i] === null,
                }
              )} ${selected !== null && placed[i] === selected ? "ring-2 ring-black dark:ring-white" : ""}`}
            >
              {placed[i] !== null ? config.bank[placed[i] as number] : ""}
            </button>
          </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {!result ? (
          <button
            type="button"
            onClick={() =>
              submit(
                config.items.map((item, i) => ({
                  itemId: item.id,
                  name: placed[i] !== null ? config.bank[placed[i] as number] : "",
                }))
              )
            }
            disabled={pending || placed.some((p) => p === null)}
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
