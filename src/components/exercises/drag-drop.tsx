"use client";

import { useEffect, useMemo, useState } from "react";
import type { DragDropPublic, DragDropDetail, DragDropAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { usePracticeCheck } from "./use-practice-check";
import { useTilePlacement } from "./use-tile-placement";
import { bankTileClass, slotClass, stickyPoolClass } from "./tile-styles";
import { HintBulb, HintUsedBadge } from "./hint-bulb";
import { DEFAULT_INSTRUCTIONS, DEFAULT_TRANSLATION_EN, taskTranslationLine } from "@/lib/exercises/default-instructions";
import { TaskPanelHeader } from "./task-panel-header";
import { BlockTabs } from "./block-navigation";
import { BUTTON_CHECK, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP } from "@/lib/spacing";
import { frenchNbsp } from "@/lib/text/french-typography";
import { TaskResult, RowPointsTab, TaskResultGapRows } from "./task-result";
import { unevenPointsFlags } from "@/lib/exercises/uneven-points";
import { useCheckConfirm, CheckConfirmBar } from "./check-confirm";
import {
  dragPoolLabel,
  poolRemainingLabel,
  dragDropIntruderLabel,
  dragDropSlotPlaceholder,
} from "@/lib/exercises/default-task-labels";
import { useT } from "@/lib/i18n/context";

// Плитки toggle-картки "Правильні відповіді" — одна плитка на РЕЧЕННЯ
// (config.sentences вже цю одиницю й дає, на відміну від fill_blank), з
// усіма словами-відповідями цього речення підсвіченими.
function buildDragDropGapRows(
  sentences: DragDropPublic["sentences"],
  sentenceSegments: string[][],
  detail: DragDropDetail
): { number: number; parts: (string | { word: string })[] }[] {
  return sentences.map((s, si) => {
    const segs = sentenceSegments[si];
    const blanks = detail.sentences.find((d) => d.id === s.id)?.blanks ?? [];
    const parts: (string | { word: string })[] = [];
    segs.forEach((seg, i) => {
      if (seg) parts.push(seg);
      if (i < segs.length - 1) parts.push({ word: blanks[i]?.correctAnswers[0] ?? "" });
    });
    return { number: si + 1, parts };
  });
}

// 6-крапковий "грип" зліва на чипі пулу — той самий, що image-match.tsx
// (ChipGripIcon), продубльований тут же: чипи drag_drop (на відміну від
// fill_blank) лишаються драговані, тож грип їм потрібен, а спільного
// файлу з image-match.tsx компонентів немає (лише спільні CSS-класи
// .word-pool*, tile-styles.ts/globals.css).
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
// принцип, що MatchingPracticeProps: config тут УЖЕ звужений сервером
// (page.tsx: sanitizeDragDropForPractice) до рівно речень
// review.remainingItemIds і до слів банку, потрібних САМЕ цим реченням —
// компонент нижче НЕ фільтрує config сам (bank — спільний секретний пул,
// як right у matching, звужувати могла лише сторона, що знає повний
// config).
export type DragDropPracticeProps = {
  onlyItemIds: string[];
  failedAttempts: Record<string, number>;
};

export function DragDropExercise({
  taskId,
  config,
  plaqueText,
  pointsVisible,
  onResult,
  hidePoints,
  isDelf,
  practice,
}: {
  taskId: string;
  config: DragDropPublic;
  plaqueText?: string;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  // Пілюля балів речення (RowPointsTab) — лише в DELF (showItemPoints);
  // поза DELF лишається видимою лише на реченнях, чиї бали відрізняються
  // від типових у цій вправі (unevenPointsFlags нижче).
  isDelf?: boolean;
  practice?: DragDropPracticeProps;
}) {
  // Банк СПІЛЬНИЙ на всю вправу (не по реченню) — тож пропуски всіх речень
  // живуть в одному спільному "слот-просторі" одного useTilePlacement, а не
  // в окремому хуку на речення (інакше кожен виклик знав би про зайнятість
  // банку лише в межах свого речення, і те саме слово можна було б
  // поставити одразу в двох реченнях). sentenceSegments/offsets — мапінг
  // глобальний-індекс-пропуску ↔ (речення, локальна позиція).
  const { t, lang } = useT();
  const unevenFlags = useMemo(() => unevenPointsFlags(config.sentences.map((s) => s.points)), [config.sentences]);
  const unevenById = useMemo(() => {
    const m = new Map<string, boolean>();
    config.sentences.forEach((s, i) => m.set(s.id, unevenFlags[i]));
    return m;
  }, [config.sentences, unevenFlags]);
  const anyItemPointsShown = isDelf || unevenFlags.some(Boolean);
  const itemsGapClass = anyItemPointsShown ? "gap-[22px]" : EXERCISE_BODY_ITEMS_GAP;
  const sentenceSegments = config.sentences.map((s) => s.template.split("{{}}"));
  const blankCounts = sentenceSegments.map((segs) => segs.length - 1);
  const totalBlanks = blankCounts.reduce((a, b) => a + b, 0);
  const offsets: number[] = [];
  {
    let running = 0;
    for (const c of blankCounts) {
      offsets.push(running);
      running += c;
    }
  }

  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as DragDropDetail | undefined;
  const locked = !!result;

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
  } = useTilePlacement(totalBlanks, locked);
  const checkConfirm = useCheckConfirm();
  const unfilledSlots = placed.filter((p) => p === null).length;
  function submitDragDrop() {
    submit(
      config.sentences.map((s, si) => ({
        sentenceId: s.id,
        words: Array.from({ length: blankCounts[si] }, (_, i) => {
          const p = placed[offsets[si] + i];
          return p !== null ? config.bank[p] : "";
        }),
        hintedWords: Array.from({ length: blankCounts[si] }, (_, i) => i).filter((i) =>
          translationHints.has(offsets[si] + i)
        ),
      }))
    );
  }

  // Підказка-переклад — ГЛОБАЛЬНИЙ індекс пропуску (offset+i, той самий,
  // що вже використовує placed/selected вище), не локальний за реченням:
  // translationHints — монотонний (для балів, grade.ts, DragDropAnswer.
  // hintedWords — переводиться в локальний індекс лише в payload submit()),
  // visibleHints — перемикається кожним кліком лампочки (показати/сховати
  // переклад), окремо від translationHints.
  const [translationHints, setTranslationHints] = useState<Set<number>>(new Set());
  const [visibleHints, setVisibleHints] = useState<Set<number>>(new Set());

  function toggleTranslationHint(gi: number) {
    setTranslationHints((prev) => (prev.has(gi) ? prev : new Set(prev).add(gi)));
    setVisibleHints((prev) => {
      const next = new Set(prev);
      if (next.has(gi)) next.delete(gi);
      else next.add(gi);
      return next;
    });
  }

  // ==== Гілка практики (onlyItemIds) — незалежна від result/locked вище:
  // той самий useTilePlacement (totalBlanks рахується з config.sentences,
  // уже звуженого сервером до практики), без per-blank кольорів (practice/
  // check повертає лише isCorrect на РІВНІ РЕЧЕННЯ, не детейл по пропуску) —
  // той самий компроміс, що letter-rearrangement.tsx (detail: undefined у
  // практиці).
  const isPractice = !!practice;
  const practiceCheck = usePracticeCheck(taskId);
  const [practiceSentenceResults, setPracticeSentenceResults] = useState<Record<string, boolean>>({});
  const [practiceFailedAttempts, setPracticeFailedAttempts] = useState<Record<string, number>>(
    practice?.failedAttempts ?? {}
  );
  const onlyItemIdsKey = practice?.onlyItemIds.join(",") ?? "";
  const [prevOnlyItemIdsKey, setPrevOnlyItemIdsKey] = useState(onlyItemIdsKey);
  if (isPractice && onlyItemIdsKey !== prevOnlyItemIdsKey) {
    setPrevOnlyItemIdsKey(onlyItemIdsKey);
    setPracticeSentenceResults({});
  }

  async function submitPractice() {
    const itemIds = config.sentences.map((s) => s.id);
    const answer: DragDropAnswer = config.sentences.map((s, si) => ({
      sentenceId: s.id,
      words: Array.from({ length: blankCounts[si] }, (_, i) => {
        const p = placed[offsets[si] + i];
        return p !== null ? config.bank[p] : "";
      }),
      hintedWords: Array.from({ length: blankCounts[si] }, (_, i) => i).filter((i) =>
        translationHints.has(offsets[si] + i)
      ),
    }));
    const r = await practiceCheck.check(itemIds, answer);
    if (!r) return;
    setPracticeSentenceResults((prev) => {
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
          <div className={stickyPoolClass("drag-drop")} {...bankDropProps()}>
            {config.bank.map((word, bi) => (
              <button
                key={bi}
                type="button"
                {...bankDragProps(bi)}
                onClick={() => clickBank(bi)}
                disabled={usedBankIndices.has(bi)}
                aria-pressed={selected === bi}
                className={`shrink-0 ${bankTileClass({ selected: selected === bi, used: usedBankIndices.has(bi) })}`}
              >
                {word}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">{t("pool.allWordsPlacedBanner")}</p>
        )}

        <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP}`}>
          {config.sentences.map((s, si) => {
            const segments = sentenceSegments[si];
            const blankCount = blankCounts[si];
            const offset = offsets[si];
            const isCorrect = practiceSentenceResults[s.id];
            const attempts = practiceFailedAttempts[s.id] ?? 0;
            const itemRevealed = practiceCheck.revealed[s.id];

            return (
              <div
                key={s.id}
                className="border-b border-[#e6e6f0] pb-3 last:border-0 last:pb-0 dark:border-neutral-800"
              >
                <p className="break-words leading-[2.6] [overflow-wrap:anywhere]">
                  {segments.map((seg, i) => {
                    const gi = offset + i;
                    const hint = s.hints?.[i];
                    const slotFilled = placed[gi] !== null;
                    return (
                      <span key={i}>
                        {frenchNbsp(seg)}
                        {i < blankCount && (
                          <button
                            type="button"
                            onClick={() => clickSlot(gi)}
                            {...slotDragProps(gi)}
                            {...slotDropProps(gi)}
                            aria-pressed={selected !== null && placed[gi] === selected}
                            title={!slotFilled && visibleHints.has(gi) ? hint ?? undefined : undefined}
                            className={`mx-1 inline-flex min-h-11 min-w-[5.5rem] max-w-full select-none items-center justify-center whitespace-normal break-words px-3 py-1.5 align-middle text-base sm:min-w-[6.5rem] ${slotClass(
                              hoveredSlot === gi ? "hover" : slotFilled ? "filled" : "empty",
                              {
                                rounded: "lg",
                                emptyBg: "subtle",
                                selectableHint: selected !== null && placed[gi] === null,
                              }
                            )} ${selected !== null && placed[gi] === selected ? "ring-2 ring-black dark:ring-white" : ""}`}
                          >
                            {slotFilled ? (
                              config.bank[placed[gi] as number]
                            ) : visibleHints.has(gi) && hint ? (
                              <span className="truncate text-[var(--text-muted-hint)] dark:text-[var(--text-muted-caption)]">{hint}</span>
                            ) : (
                              ""
                            )}
                          </button>
                        )}
                        {i < blankCount && hint && (
                          <HintBulb
                            state={translationHints.has(gi) ? "used" : "available"}
                            label={t("dragdrop.hintTranslation")}
                            onClick={() => toggleTranslationHint(gi)}
                            className="!inline-flex align-middle"
                          />
                        )}
                        {i < blankCount && visibleHints.has(gi) && hint && slotFilled && (
                          <span className="text-xs italic text-[var(--text-muted-hint)] dark:text-[var(--text-muted-caption)]" title={hint}>
                            ({hint})
                          </span>
                        )}
                      </span>
                    );
                  })}
                </p>
                {isCorrect === true && (
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">{t("status.correct")}</p>
                )}
                {isCorrect === false && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-red-600 dark:text-red-400">
                      {t("status.incorrectRetryCount", { n: attempts })}
                    </span>
                    {!itemRevealed && (
                      <button
                        type="button"
                        onClick={() => practiceCheck.reveal(s.id, true)}
                        disabled={!!practiceCheck.revealPending[s.id]}
                        className={STUDENT_BUTTON_SECONDARY_TOUCH}
                      >
                        {t("button.showAnswer")}
                      </button>
                    )}
                  </div>
                )}
                {itemRevealed && (
                  <p className="text-xs italic text-amber-700 dark:text-amber-400">
                    {t("answer.correctAnswerLabel")} {itemRevealed.join(", ")}
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
            disabled={practiceCheck.pending || placed.some((p) => p === null)}
            className={`self-start ${BUTTON_CHECK}`}
          >
            {practiceCheck.pending ? t("button.checking") : t("button.check")}
          </button>
          {practiceCheck.error && <p className="text-sm text-red-600 dark:text-red-400">{practiceCheck.error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={EXERCISE_STACK}>
      <BlockTabs plaqueText={plaqueText} />
      <TaskPanelHeader
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.drag_drop.instruction}
        subInstructionText={taskTranslationLine(config.subInstructions, lang, {
          uk: DEFAULT_INSTRUCTIONS.drag_drop.subInstruction,
          en: DEFAULT_TRANSLATION_EN.drag_drop,
        })}
      />

      {(() => {
        // Зайві слова банку — ті, що лишаться непотрібними, навіть коли всі
        // пропуски заповнені: bank.length - totalBlanks, рахується з даних
        // (DragDropPublic не має окремого поля "intruders"), той самий
        // принцип, що totalBlanks вище. Пілюля рендериться лише коли > 0.
        const intruderCount = config.bank.length - totalBlanks;
        const remaining = config.bank.length - usedBankIndices.size;
        return remaining > 0 ? (
          // Спільний липкий трей (.word-pool*, globals.css) — той самий, що
          // image_match (image-match.tsx) і fill_blank вище. На відміну від
          // fill_blank: чипи тут ДРАГОВАНІ (грип зліва), розставлене слово
          // прибирається з пулу (filter за usedBankIndices), як у image_match.
          <div className="word-pool" {...bankDropProps()}>
            <div className="word-pool-label-row">
              <span className="word-pool-label">{dragPoolLabel(lang)}</span>
              {/* Пілюлі згруповані своїм flex-рядком (gap 8px) — третій
                  елемент (зайві слова) не має ламати .word-pool-label-row
                  (space-between, розраховане на РІВНО два елементи,
                  image_match/fill_blank). */}
              <span className="flex items-center gap-2">
                <span className="word-pool-count">{poolRemainingLabel(lang, remaining)}</span>
                {intruderCount > 0 && (
                  <span className="word-pool-count word-pool-count--intruder">
                    {dragDropIntruderLabel(lang, intruderCount)}
                  </span>
                )}
              </span>
            </div>
            <div className="word-pool-chips">
              {config.bank.map((word, bi) =>
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
                    {word}
                  </button>
                )
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">{t("pool.allWordsPlacedBanner")}</p>
        );
      })()}

      <div className={`flex flex-col ${itemsGapClass} pt-3`}>
        {config.sentences.map((s, si) => {
          const segments = sentenceSegments[si];
          const blankCount = blankCounts[si];
          const offset = offsets[si];
          const sentDetail = detail?.sentences.find((d) => d.id === s.id);
          // До перевірки — лише якщо pointsVisible; після — завжди. Бали
          // речення зараховуються, лише якщо ВСІ його пропуски правильні
          // (не по окремому пропуску, як score) — 0/points, а не часткове.
          const sentenceCorrect = sentDetail?.blanks.every((b) => b.isCorrect) ?? false;

          const showTab = !hidePoints && (isDelf || unevenById.get(s.id)) && (pointsVisible || !!sentDetail);
          return (
            <div key={s.id} className="row-points-tab-wrap">
              {showTab && (
                <RowPointsTab
                  earned={sentDetail ? (sentenceCorrect ? s.points : 0) : undefined}
                  possible={s.points}
                />
              )}
              <div className="drag-drop-row glass-item-card">
              <span className="item-number-badge drag-drop-row-number" aria-label={t("aria.sentence", { n: si + 1 })}>
                {si + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="drag-drop-row-text break-words [overflow-wrap:anywhere]">
                  {segments.map((seg, i) => {
                    const gi = offset + i;
                    const hint = s.hints?.[i];
                    const slotFilled = placed[gi] !== null;
                    const slotStateClass = sentDetail
                      ? sentDetail.blanks[i]?.isCorrect
                        ? "border-2 border-green-500 bg-green-50 dark:border-[var(--correct-border-dark)] dark:bg-[var(--dark-surface-fill)]"
                        : "border-2 border-red-500 bg-red-50 dark:border-[var(--wrong-border-dark)] dark:bg-[var(--dark-surface-fill)]"
                      : hoveredSlot === gi
                        ? "drag-drop-slot--dragover"
                        : slotFilled
                          ? "drag-drop-slot--filled"
                          : "drag-drop-slot--empty";
                    // Лампочка рендериться лише за цією самою умовою нижче
                    // (!locked && !slotFilled && hint) — ширший слот
                    // (.drag-drop-slot--has-lamp, globals.css) має
                    // з'являтись і зникати РАЗОМ із самою лампочкою, щоб
                    // текст ніколи не опинявся під коло.
                    const hasLamp = !locked && !slotFilled && !!hint;
                    return (
                      <span key={i}>
                        {frenchNbsp(seg)}
                        {i < blankCount && (
                          <span className="relative inline-block align-middle">
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() => clickSlot(gi)}
                              {...slotDragProps(gi)}
                              {...slotDropProps(gi)}
                              aria-pressed={selected !== null && placed[gi] === selected}
                              title={!slotFilled && visibleHints.has(gi) ? hint ?? undefined : undefined}
                              className={`drag-drop-slot ${slotStateClass} ${hasLamp ? "drag-drop-slot--has-lamp" : ""} ${
                                usedBankIndices.size < config.bank.length ? "scroll-mt-16 sm:scroll-mt-[27vh]" : ""
                              } ${selected !== null && placed[gi] === selected ? "ring-2 ring-black dark:ring-white" : ""}`}
                            >
                              {slotFilled ? (
                                <span className="drag-drop-slot-word">{config.bank[placed[gi] as number]}</span>
                              ) : visibleHints.has(gi) && hint ? (
                                <span className="truncate text-[var(--text-muted-hint)] dark:text-[var(--text-muted-caption)]">{hint}</span>
                              ) : (
                                <span className="drag-drop-slot-placeholder">{dragDropSlotPlaceholder(lang)}</span>
                              )}
                            </button>
                            {/* Лампочка ВСЕРЕДИНІ слота (мокап "варіант 1") —
                                той самий принцип, що fill-blank.tsx/
                                table-fill.tsx: зникає повністю (не рендериться),
                                щойно слот заповнений — на відміну від старої
                                поведінки (лампочка лишалась видимою й після
                                розстановки слова). */}
                            {hasLamp && (
                              <HintBulb
                                state={translationHints.has(gi) ? "used" : "available"}
                                label={t("dragdrop.hintTranslation")}
                                onClick={() => toggleTranslationHint(gi)}
                                className="drag-drop-slot-lamp"
                              />
                            )}
                            {sentDetail?.blanks[i]?.hintUsed && <HintUsedBadge />}
                          </span>
                        )}
                        {i < blankCount && !locked && visibleHints.has(gi) && hint && slotFilled && (
                          <span className="text-xs italic text-[var(--text-muted-hint)] dark:text-[var(--text-muted-caption)]" title={hint}>
                            ({hint})
                          </span>
                        )}
                      </span>
                    );
                  })}
                </p>
              </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {!result ? (
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              onClick={() => checkConfirm.attemptCheck(unfilledSlots, submitDragDrop)}
              disabled={pending}
              className={`self-start ${BUTTON_CHECK}`}
            >
              {pending ? t("button.checking") : t("button.check")}
            </button>
            {checkConfirm.confirming && (
              <CheckConfirmBar
                unansweredCount={unfilledSlots}
                onConfirm={() => checkConfirm.confirmCheck(submitDragDrop)}
                onCancel={checkConfirm.cancelCheck}
              />
            )}
          </div>
        ) : (
          <TaskResult
            correct={result.correct}
            pointsEarned={result.pointsEarned}
            pointsPossible={result.pointsPossible}
            toggleTitle={t("panel.correctAnswers")}
            toggleCount={detail ? config.sentences.length : undefined}
            hintSummary={{
              hintCount: detail?.sentences.reduce((n, s) => n + s.blanks.filter((b) => b.hintUsed).length, 0) ?? 0,
              reducesPoints: config.hintsReducePoints,
            }}
          >
            {detail && (
              <TaskResultGapRows rows={buildDragDropGapRows(config.sentences, sentenceSegments, detail)} />
            )}
          </TaskResult>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
