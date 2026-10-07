"use client";

import { useEffect, useState } from "react";
import type { DragDropPublic, DragDropDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { useTilePlacement } from "./use-tile-placement";
import { bankTileClass, slotClass, stickyPoolClass } from "./tile-styles";
import { HintBulb } from "./hint-bulb";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";
import { frenchNbsp } from "@/lib/text/french-typography";

export function DragDropExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: DragDropPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  // Банк СПІЛЬНИЙ на всю вправу (не по реченню) — тож пропуски всіх речень
  // живуть в одному спільному "слот-просторі" одного useTilePlacement, а не
  // в окремому хуку на речення (інакше кожен виклик знав би про зайнятість
  // банку лише в межах свого речення, і те саме слово можна було б
  // поставити одразу в двох реченнях). sentenceSegments/offsets — мапінг
  // глобальний-індекс-пропуску ↔ (речення, локальна позиція).
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

  return (
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.drag_drop.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.drag_drop.subInstruction}
      />

      {usedBankIndices.size < config.bank.length ? (
        // Липкий пул над реченнями (спільний стиль tile-styles.ts —
        // stickyPoolClass): той самий принцип "видимий під час скролу"/
        // схлопування, що image_match, тут — бо слова, як і там,
        // "розставляються" й зникають з пулу (на відміну від fill_blank,
        // де банк лише довідковий і завжди повний).
        <div className={stickyPoolClass("drag-drop")} {...bankDropProps()}>
          {config.bank.map((word, bi) => (
            <button
              key={bi}
              type="button"
              {...bankDragProps(bi)}
              onClick={() => clickBank(bi)}
              disabled={locked || usedBankIndices.has(bi)}
              aria-pressed={selected === bi}
              className={`shrink-0 ${bankTileClass({ selected: selected === bi, used: usedBankIndices.has(bi) })}`}
            >
              {word}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Усі слова розставлено</p>
      )}

      <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP}`}>
        {config.sentences.map((s, si) => {
          const segments = sentenceSegments[si];
          const blankCount = blankCounts[si];
          const offset = offsets[si];
          const sentDetail = detail?.sentences.find((d) => d.id === s.id);
          // До перевірки — лише якщо pointsVisible; після — завжди. Бали
          // речення зараховуються, лише якщо ВСІ його пропуски правильні
          // (не по окремому пропуску, як score) — 0/points, а не часткове.
          const sentenceCorrect = sentDetail?.blanks.every((b) => b.isCorrect) ?? false;

          return (
            <div key={s.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0 dark:border-neutral-800">
              {!hidePoints && (pointsVisible || sentDetail) && (
                <p className={`mb-1 ${SCORE_LABEL_CLASS}`}>
                  {sentDetail
                    ? `${sentenceCorrect ? s.points : 0}/${s.points} ${pluralizePoints(s.points)}`
                    : `${s.points} ${pluralizePoints(s.points)}`}
                </p>
              )}
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
                          disabled={locked}
                          onClick={() => clickSlot(gi)}
                          {...slotDragProps(gi)}
                          {...slotDropProps(gi)}
                          aria-pressed={selected !== null && placed[gi] === selected}
                          title={!slotFilled && visibleHints.has(gi) ? hint ?? undefined : undefined}
                          className={`mx-1 inline-flex min-h-11 min-w-[5.5rem] max-w-full select-none items-center justify-center whitespace-normal break-words px-3 py-1.5 align-middle text-base sm:min-w-[6.5rem] ${
                            usedBankIndices.size < config.bank.length ? "scroll-mt-16 sm:scroll-mt-[27vh]" : ""
                          } ${slotClass(
                            sentDetail
                              ? sentDetail.blanks[i]?.isCorrect
                                ? "correct"
                                : "incorrect"
                              : hoveredSlot === gi
                                ? "hover"
                                : slotFilled
                                  ? "filled"
                                  : "empty",
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
                            <span className="truncate text-neutral-400 dark:text-neutral-500">{hint}</span>
                          ) : (
                            ""
                          )}
                        </button>
                      )}
                      {/* !inline-flex — той самий принцип, що fill-blank.tsx
                          (LEGEND_BULB_BADGE_SM задає "flex", блоковий бокс,
                          що зламав би перенос рядків у цьому прозовому <p>). */}
                      {i < blankCount && !locked && hint && (
                        <HintBulb
                          size="sm"
                          state={translationHints.has(gi) ? "used" : "available"}
                          label="Підказка: показати переклад слова"
                          onClick={() => toggleTranslationHint(gi)}
                          className="!inline-flex align-middle"
                        />
                      )}
                      {i < blankCount && !locked && visibleHints.has(gi) && hint && slotFilled && (
                        <span className="text-xs italic text-neutral-500 dark:text-neutral-400" title={hint}>
                          ({hint})
                        </span>
                      )}
                      {i < blankCount && sentDetail?.blanks[i]?.hintUsed && (
                        <span className="text-xs italic text-amber-600 dark:text-amber-400">(з підказкою)</span>
                      )}
                    </span>
                  );
                })}
              </p>

              {sentDetail && (
                <ul className="mt-1 flex flex-col gap-1 text-sm">
                  {sentDetail.blanks.map((b, i) =>
                    b.isCorrect ? null : (
                      <li key={i} className="text-red-600 dark:text-red-400">
                        Пропуск {i + 1}: правильно — {b.correctAnswers.join(" / ")}
                      </li>
                    )
                  )}
                </ul>
              )}
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
                config.sentences.map((s, si) => ({
                  sentenceId: s.id,
                  words: Array.from({ length: blankCounts[si] }, (_, i) => {
                    const p = placed[offsets[si] + i];
                    return p !== null ? config.bank[p] : "";
                  }),
                  // Локальний (у межах цього речення) індекс — переводимо з
                  // глобального translationHints тут, у payload, той самий
                  // принцип, що fill-blank.tsx.
                  hintedWords: Array.from({ length: blankCounts[si] }, (_, i) => i).filter((i) =>
                    translationHints.has(offsets[si] + i)
                  ),
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
    </div>
  );
}
