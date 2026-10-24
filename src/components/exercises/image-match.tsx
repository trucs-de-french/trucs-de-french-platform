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
import { formatPointsCount } from "@/lib/exercises/format-points";
import { TaskPanelHeader } from "./task-panel-header";
import { BlockTabs } from "./block-navigation";
import { ANSWER_CHIP_BASE, ANSWER_CHIP_DEFAULT } from "./answer-card-style";
import { STUDENT_BUTTON_PRIMARY, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { TaskResult, TaskResultImageWordRows } from "./task-result";
import { useCheckConfirm, CheckConfirmBar } from "./check-confirm";
import {
  IMAGE_MATCH_POOL_LABEL,
  imageMatchRemainingLabel,
  TABLE_FILL_ANSWERS_TOGGLE_LABEL,
} from "@/lib/exercises/default-task-labels";

// Плитки toggle-картки "Правильні відповіді" — мініатюра + номер +
// правильне слово (п.5 задачі "варіант 1").
function buildImageMatchRows(
  detail: ImageMatchDetail
): { number: number; imageUrl: string; word: string }[] {
  return detail.items.map((it, i) => ({ number: i + 1, imageUrl: it.imageUrl, word: it.correctName }));
}

// 6-крапковий "грип" зліва на чипі пулу (мокап "варіант 1") — суто
// декоративна підказка "можна тягнути", прибирається на мобільній липкій
// смужці (.image-match-chip-grip, display:none у @media max-width:767px,
// globals.css), бо спец мокапу "варіант 5" там її не передбачає.
function ChipGripIcon() {
  return (
    <svg className="word-pool-chip-grip" viewBox="0 0 10 14" aria-hidden="true">
      {[2, 7, 12].map((cy) =>
        [2.5, 7.5].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" />)
      )}
    </svg>
  );
}

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
  plaqueText,
  pointsVisible,
  onResult,
  hidePoints,
  practice,
}: {
  taskId: string;
  config: ImageMatchPublic;
  plaqueText?: string;
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
  const checkConfirm = useCheckConfirm();
  const unplacedCount = placed.filter((p) => p === null).length;
  function submitImageMatch() {
    submit(
      config.items.map((item, i) => ({
        itemId: item.id,
        name: placed[i] !== null ? config.bank[placed[i] as number] : "",
      }))
    );
  }

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

  const totalPoints = config.items.reduce((sum, item) => sum + item.points, 0);
  const remaining = config.bank.length - usedBankIndices.size;

  return (
    <div className={EXERCISE_STACK}>
      <BlockTabs plaqueText={plaqueText} />
      <TaskPanelHeader
        pointsText={!hidePoints && !detail && pointsVisible ? formatPointsCount(totalPoints) : undefined}
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.image_match.instruction}
        subInstructionText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.image_match.subInstruction}
      />

      {remaining > 0 ? (
        // .image-match-pool — ОДИН контейнер для трея (десктоп, мокап
        // "варіант 1") і липкої горизонтальної смужки (<768px, "варіант
        // 5") — різниця лише в CSS (@media max-width:767px, globals.css),
        // не в розмітці. Розкладені слова прибираються з пулу насправді
        // (filter за usedBankIndices), не лишаються притемненими.
        <div className="word-pool" {...bankDropProps()}>
          <div className="word-pool-label-row">
            <span className="word-pool-label">{IMAGE_MATCH_POOL_LABEL}</span>
            <span className="word-pool-count">{imageMatchRemainingLabel(remaining)}</span>
          </div>
          <div className="word-pool-chips">
            {config.bank.map((name, bi) =>
              usedBankIndices.has(bi) ? null : (
                <button
                  key={bi}
                  type="button"
                  {...bankDragProps(bi)}
                  onClick={() => clickBank(bi)}
                  disabled={locked}
                  aria-pressed={selected === bi}
                  className={`word-pool-chip ${selected === bi ? "ring-2 ring-black dark:ring-white" : ""}`}
                >
                  <ChipGripIcon />
                  {name}
                </button>
              )
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Усі слова розставлено</p>
      )}

      <div className="image-match-cards">
        {config.items.map((item, i) => {
          const itemDetail = detail?.items[i];
          const slotState = itemDetail
            ? itemDetail.isCorrect
              ? "correct"
              : "incorrect"
            : hoveredSlot === i
              ? "dragover"
              : placed[i] !== null
                ? "filled"
                : "empty";
          const slotStateClass =
            slotState === "correct"
              ? "border-2 border-green-500 bg-green-50 dark:bg-green-950/30"
              : slotState === "incorrect"
                ? "border-2 border-red-500 bg-red-50 dark:bg-red-950/30"
                : slotState === "dragover"
                  ? "image-match-slot--dragover"
                  : slotState === "filled"
                    ? "image-match-slot--filled"
                    : "image-match-slot--empty";
          return (
            <div key={item.id} className="image-match-card glass-item-card">
              <div className="image-match-card-image-wrap">
                <button
                  type="button"
                  onClick={() => setLightboxSrc(item.imageUrl)}
                  aria-label="Показати картинку повністю"
                  className="block w-full cursor-zoom-in"
                >
                  <ImageOrPlaceholder
                    src={item.imageUrl}
                    alt=""
                    className="image-match-card-image"
                    useFocus
                  />
                </button>
                <span className="item-number-badge image-match-card-badge" aria-label={`Картка ${i + 1}`}>
                  {i + 1}
                </span>
              </div>
              <button
                type="button"
                disabled={locked}
                onClick={() => clickSlot(i)}
                {...slotDragProps(i)}
                {...slotDropProps(i)}
                aria-pressed={selected !== null && placed[i] === selected}
                className={`image-match-slot ${slotStateClass} ${
                  selected !== null && placed[i] === selected ? "ring-2 ring-black dark:ring-white" : ""
                }`}
              >
                {placed[i] !== null ? (
                  <span className="image-match-slot-word">{config.bank[placed[i] as number]}</span>
                ) : (
                  <span className="image-match-slot-placeholder">
                    <span className="image-match-slot-placeholder-full">перетягніть слово</span>
                    <span className="image-match-slot-placeholder-short">перетягніть</span>
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {!result ? (
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              onClick={() => checkConfirm.attemptCheck(unplacedCount, submitImageMatch)}
              disabled={pending || config.items.length - unplacedCount === 0}
              className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
            >
              {pending ? "Перевіряю..." : "Перевірити"}
            </button>
            {checkConfirm.confirming && (
              <CheckConfirmBar
                unansweredCount={unplacedCount}
                onConfirm={() => checkConfirm.confirmCheck(submitImageMatch)}
                onCancel={checkConfirm.cancelCheck}
              />
            )}
          </div>
        ) : (
          <TaskResult
            correct={result.correct}
            pointsEarned={result.pointsEarned}
            pointsPossible={result.pointsPossible}
            toggleTitle={TABLE_FILL_ANSWERS_TOGGLE_LABEL}
            toggleCount={detail ? detail.items.length : undefined}
          >
            {detail && <TaskResultImageWordRows rows={buildImageMatchRows(detail)} />}
          </TaskResult>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
