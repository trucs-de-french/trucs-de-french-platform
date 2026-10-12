"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ReorderPublic, ReorderDetail, ReorderAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { usePracticeCheck } from "./use-practice-check";
import { WHOLE_TASK_ITEM_ID } from "@/lib/exercises/error-review";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { SortableTileRow } from "./sortable-tile-row";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { CompactAudioButton } from "./compact-audio-button";
import { ImageLightbox } from "./image-lightbox";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { STUDENT_BUTTON_PRIMARY, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { WORD_CARD } from "@/lib/exercises/word-list-layout";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";
import { CARD_BLOCK_MAX, splitEvenly } from "@/lib/exercises/exercise-blocks";
import { BlockNavigation } from "./block-navigation";

type SequenceDetail = ReorderDetail["sequences"][number];
type ReorderResult = Extract<GradeResult, { detail: ReorderDetail }>;
type PublicSequence = ReorderPublic["sequences"][number];

// Режим практики "Робота над помилками" (пілот, частина 7, хвиля 3) —
// переробка ЦІЛОГО завдання (whole), на відміну від items-режиму
// (MatchingPracticeProps тощо, onlyItemIds): "елемент" тут один —
// WHOLE_TASK_ITEM_ID (error-review.ts), без розбиття на блоки (CARD_BLOCK_MAX
// нижче застосовується лише у звичайному проходженні, не в практиці —
// завдання повністю, навіть якщо послідовностей > CARD_BLOCK_MAX).
export type ReorderPracticeProps = { whole: true; failedAttempts: Record<string, number> };

// Один ряд плиток у перемішаному порядку — жодного окремого банку чи
// порожніх слотів (на відміну від drag_drop, де банк доречний через текст
// із пропусками). Сам DnD/click-move — у спільному SortableTileRow
// (той самий код, що й letter_rearrangement). Контрольований компонент —
// батько (ReorderExercise) тримає поточний порядок кожної послідовності.
function ReorderSequenceTiles({
  order,
  onChange,
  detail,
  correctOrder,
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
  // Присутній лише коли вчитель увімкнув liveFeedback (ReorderConfig,
  // sanitizeReorder) — правильний текст на кожну позицію, дає живе
  // підсвічування без запиту на сервер (той самий компроміс секретності,
  // що LetterGapsPublicWord.hiddenLetters).
  correctOrder?: string[];
  locked: boolean;
  points: number;
  pointsVisible: boolean;
  hidePoints?: boolean;
  imageUrl?: string;
  audioUrl?: string;
  onOpenImage: (src: string) => void;
}) {
  // Пріоритет: після "Перевірити" — detail (авторитетний серверний
  // результат, той самий, що показує бали); до перевірки — якщо
  // liveFeedback увімкнено, порівнюємо ПОЗИЦІЙНО з correctOrder (той самий
  // принцип, що gradeReorder: studentOrder[i] === correctOrder[i]), наживо,
  // на кожен рендер (order — пропс, змінюється з кожним drag/click-move).
  function tileState(i: number): "correct" | "incorrect" | undefined {
    if (detail) return detail.items[i]?.isCorrect ? "correct" : "incorrect";
    if (correctOrder) return order[i] === correctOrder[i] ? "correct" : "incorrect";
    return undefined;
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
  practice,
}: {
  taskId: string;
  config: ReorderPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  practice?: ReorderPracticeProps;
}) {
  const [orders, setOrders] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(config.sequences.map((s) => [s.id, s.items]))
  );
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // ==== Гілка практики (whole) — незалежна від блоків/single нижче:
  // завжди ВСІ послідовності одразу (config тут уже перемішаний сервером,
  // page.tsx: sanitizeConfigForStudent), без BlockNavigation.
  const isPractice = !!practice;
  const practiceCheck = usePracticeCheck(taskId);
  const [practiceOrders, setPracticeOrders] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(config.sequences.map((s) => [s.id, s.items]))
  );
  const [practiceDetail, setPracticeDetail] = useState<ReorderDetail | undefined>(undefined);
  const [practiceCorrect, setPracticeCorrect] = useState(false);
  const [practiceFailedAttempts, setPracticeFailedAttempts] = useState<Record<string, number>>(
    practice?.failedAttempts ?? {}
  );

  async function submitPractice() {
    const answer: ReorderAnswer = config.sequences.map((s) => ({
      sequenceId: s.id,
      order: practiceOrders[s.id] ?? [],
    }));
    const result = await practiceCheck.check([WHOLE_TASK_ITEM_ID], answer);
    if (!result) return;
    const correct = result.results[0]?.correct ?? false;
    setPracticeCorrect(correct);
    setPracticeDetail(result.detail as ReorderDetail | undefined);
    setPracticeFailedAttempts(result.failedAttempts);
    const attempts = result.failedAttempts[WHOLE_TASK_ITEM_ID] ?? 0;
    if (!correct && attempts >= 2 && !practiceCheck.revealed[WHOLE_TASK_ITEM_ID]) {
      practiceCheck.reveal(WHOLE_TASK_ITEM_ID, false);
    }
  }

  // Картки (послідовності) — поріг блоку CARD_BLOCK_MAX=5, той самий
  // принцип, що word-choice.tsx/multiple-choice.tsx/true-false.tsx
  // (exercise-blocks.ts, перша хвиля card-блоків). ≤5 послідовностей —
  // sequenceBlocks матиме РІВНО один чанк, useBlocks===false, нижче
  // рендериться ТОЧНО той самий код, що й до розбиття на блоки (на
  // наявних даних — до 4 послідовностей — нічого не змінюється).
  const sequenceBlocks = useMemo(() => splitEvenly(config.sequences, CARD_BLOCK_MAX), [config.sequences]);
  const blockCount = sequenceBlocks.length;
  const useBlocks = blockCount > 1;

  // ==== Гілка ≤5 послідовностей (незмінна поведінка) ====
  const router = useRouter();
  const single = useExerciseCheck(taskId);
  const detail = single.result?.detail as ReorderDetail | undefined;
  const singleLocked = !!single.result;

  useEffect(() => {
    if (!useBlocks && single.result) onResult?.(single.result);
  }, [useBlocks, single.result, onResult]);

  function renderSequence(seq: PublicSequence, seqDetail: SequenceDetail | undefined, locked: boolean) {
    return (
      <ReorderSequenceTiles
        key={seq.id}
        order={orders[seq.id] ?? seq.items}
        onChange={(next) => setOrders((prev) => ({ ...prev, [seq.id]: next }))}
        detail={seqDetail}
        correctOrder={seq.correctOrder}
        locked={locked}
        points={seq.points}
        pointsVisible={pointsVisible}
        hidePoints={hidePoints}
        imageUrl={seq.imageUrl}
        audioUrl={seq.audioUrl}
        onOpenImage={setLightboxSrc}
      />
    );
  }

  // ==== Гілка блоків (>5 послідовностей) ====
  const [activeBlock, setActiveBlock] = useState(0);
  const [blockResults, setBlockResults] = useState<Record<number, ReorderResult>>({});
  const [blockPending, setBlockPending] = useState<Record<number, boolean>>({});
  const [blockError, setBlockError] = useState<Record<number, string | null>>({});

  const allBlocksChecked = useBlocks && blockCount > 0 && Object.keys(blockResults).length === blockCount;

  const aggregateResult: ReorderResult | null = useMemo(() => {
    if (!allBlocksChecked) return null;
    const results = Object.values(blockResults);
    const sequences = results.flatMap((r) => r.detail.sequences);
    const allItems = sequences.flatMap((s) => s.items);
    const correctCount = allItems.filter((i) => i.isCorrect).length;
    return {
      correct: allItems.length > 0 && correctCount === allItems.length,
      score: allItems.length > 0 ? Math.round((correctCount / allItems.length) * 100) : 0,
      detail: { sequences },
      pointsEarned: results.reduce((sum, r) => sum + (r.pointsEarned ?? 0), 0),
      pointsPossible: results.reduce((sum, r) => sum + (r.pointsPossible ?? 0), 0),
    };
  }, [allBlocksChecked, blockResults]);

  useEffect(() => {
    if (aggregateResult) onResult?.(aggregateResult);
  }, [aggregateResult, onResult]);

  async function submitBlock(blockIndex: number) {
    const blockSequences = sequenceBlocks[blockIndex];
    const answer = blockSequences.map((s) => ({ sequenceId: s.id, order: orders[s.id] ?? [] }));
    setBlockPending((prev) => ({ ...prev, [blockIndex]: true }));
    setBlockError((prev) => ({ ...prev, [blockIndex]: null }));
    try {
      const res = await fetch("/api/exercises/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, answer, blockIndex }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Помилка перевірки");
      }
      const result = (await res.json()) as ReorderResult;
      setBlockResults((prev) => ({ ...prev, [blockIndex]: result }));
      router.refresh();
    } catch (e) {
      setBlockError((prev) => ({
        ...prev,
        [blockIndex]: e instanceof Error ? e.message : "Помилка перевірки",
      }));
    } finally {
      setBlockPending((prev) => ({ ...prev, [blockIndex]: false }));
    }
  }

  function renderBlock() {
    const blockSequences = sequenceBlocks[activeBlock];
    const blockResult = blockResults[activeBlock];
    const blockDetail = blockResult?.detail;
    const isPending = !!blockPending[activeBlock];
    const errMsg = blockError[activeBlock];

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          {blockSequences.map((seq) =>
            renderSequence(seq, blockDetail?.sequences.find((d) => d.id === seq.id), !!blockResult)
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => submitBlock(activeBlock)}
              disabled={isPending}
              className={STUDENT_BUTTON_PRIMARY}
            >
              {isPending ? "Перевіряю..." : blockResult ? "Перевірити ще раз" : "Перевірити блок"}
            </button>
            {blockResult && (
              <p
                className={`${RESULT_MESSAGE_CLASS} ${
                  blockResult.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {blockResult.correct ? "Правильно! ✓" : `Результат: ${blockResult.score}%`}
                {blockResult.pointsPossible !== undefined && (
                  <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
                    ({blockResult.pointsEarned} з {blockResult.pointsPossible}{" "}
                    {pluralizePoints(blockResult.pointsPossible)})
                  </span>
                )}
              </p>
            )}
          </div>
          {errMsg && <p className="text-sm text-red-600 dark:text-red-400">{errMsg}</p>}
        </div>
      </div>
    );
  }

  if (isPractice) {
    const revealedAnswer = practiceCheck.revealed[WHOLE_TASK_ITEM_ID];
    const attempts = practiceFailedAttempts[WHOLE_TASK_ITEM_ID] ?? 0;
    return (
      <div className={EXERCISE_STACK}>
        {!practiceCorrect && (
          <p className="tap-swap-hint text-sm text-neutral-500 dark:text-neutral-400">
            Торкніться двох слів, щоб поміняти їх місцями
          </p>
        )}

        <div className="flex flex-col gap-3">
          {config.sequences.map((seq) => (
            <ReorderSequenceTiles
              key={seq.id}
              order={practiceOrders[seq.id] ?? seq.items}
              onChange={(next) => {
                setPracticeOrders((prev) => ({ ...prev, [seq.id]: next }));
                // Скидаємо підсвічування з попередньої перевірки — інакше
                // студент бачить застарілі зелені/червоні кольори після
                // того, як переставив слова знову, до наступного "Перевірити".
                setPracticeDetail(undefined);
              }}
              detail={practiceDetail?.sequences.find((d) => d.id === seq.id)}
              correctOrder={seq.correctOrder}
              locked={practiceCorrect}
              points={seq.points}
              pointsVisible={false}
              hidePoints
              imageUrl={seq.imageUrl}
              audioUrl={seq.audioUrl}
              onOpenImage={setLightboxSrc}
            />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {!practiceCorrect && (
            <button
              type="button"
              onClick={submitPractice}
              disabled={practiceCheck.pending}
              className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
            >
              {practiceCheck.pending ? "Перевіряю..." : "Перевірити"}
            </button>
          )}
          {practiceCorrect && (
            <p className={`${RESULT_MESSAGE_CLASS} text-green-600 dark:text-green-400`}>Правильно! ✓</p>
          )}
          {practiceDetail && !practiceCorrect && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-red-600 dark:text-red-400">
                Неправильно, спробуйте ще раз (спроб: {attempts})
              </span>
              {!revealedAnswer && (
                <button
                  type="button"
                  onClick={() => practiceCheck.reveal(WHOLE_TASK_ITEM_ID, true)}
                  disabled={!!practiceCheck.revealPending[WHOLE_TASK_ITEM_ID]}
                  className={STUDENT_BUTTON_SECONDARY_TOUCH}
                >
                  Показати відповідь
                </button>
              )}
            </div>
          )}
          {revealedAnswer && (
            <p className="text-sm italic text-amber-700 dark:text-amber-400">
              Правильний порядок: {revealedAnswer.join("; ")}
            </p>
          )}
          {practiceCheck.error && <p className="text-sm text-red-600 dark:text-red-400">{practiceCheck.error}</p>}
        </div>

        {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      </div>
    );
  }

  return (
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.reorder.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.reorder.subInstruction}
      />

      {!useBlocks ? (
        <>
          {!singleLocked && (
            <p className="tap-swap-hint text-sm text-neutral-500 dark:text-neutral-400">
              Торкніться двох слів, щоб поміняти їх місцями
            </p>
          )}

          <div className="flex flex-col gap-3">
            {config.sequences.map((seq) =>
              renderSequence(seq, detail?.sequences.find((d) => d.id === seq.id), singleLocked)
            )}
          </div>

          <div className="flex flex-col gap-3">
            {!single.result ? (
              <button
                type="button"
                onClick={() =>
                  single.submit(config.sequences.map((s) => ({ sequenceId: s.id, order: orders[s.id] ?? [] })))
                }
                disabled={single.pending}
                className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
              >
                {single.pending ? "Перевіряю..." : "Перевірити"}
              </button>
            ) : (
              <p
                className={`${RESULT_MESSAGE_CLASS} ${
                  single.result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {single.result.correct ? "Правильно! ✓" : `Результат: ${single.result.score}%`}
                {single.result.pointsPossible !== undefined && (
                  <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
                    ({single.result.pointsEarned} з {single.result.pointsPossible}{" "}
                    {pluralizePoints(single.result.pointsPossible)})
                  </span>
                )}
              </p>
            )}
            {single.error && <p className="text-sm text-red-600 dark:text-red-400">{single.error}</p>}
          </div>
        </>
      ) : (
        <>
          {!blockResults[activeBlock] && (
            <p className="tap-swap-hint text-sm text-neutral-500 dark:text-neutral-400">
              Торкніться двох слів, щоб поміняти їх місцями
            </p>
          )}
          <BlockNavigation
            blockCount={blockCount}
            activeBlock={activeBlock}
            onChangeBlock={setActiveBlock}
            isBlockChecked={(i) => i in blockResults}
            summary={aggregateResult}
          >
            {renderBlock()}
          </BlockNavigation>
        </>
      )}

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
