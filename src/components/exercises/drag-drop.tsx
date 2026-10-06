"use client";

import { useEffect } from "react";
import type { DragDropPublic, DragDropDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { useTilePlacement } from "./use-tile-placement";
import { bankTileClass, slotClass, stickyPoolClass } from "./tile-styles";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";

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
              <p className="leading-[2.6]">
                {segments.map((seg, i) => (
                  <span key={i}>
                    {seg}
                    {i < blankCount && (
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => clickSlot(offset + i)}
                        {...slotDragProps(offset + i)}
                        {...slotDropProps(offset + i)}
                        aria-pressed={selected !== null && placed[offset + i] === selected}
                        className={`mx-1 inline-flex min-h-11 min-w-[5.5rem] max-w-full select-none items-center justify-center whitespace-normal break-words px-3 py-1.5 align-middle text-base sm:min-w-[6.5rem] ${
                          usedBankIndices.size < config.bank.length ? "scroll-mt-16 sm:scroll-mt-[27vh]" : ""
                        } ${slotClass(
                          sentDetail
                            ? sentDetail.blanks[i]?.isCorrect
                              ? "correct"
                              : "incorrect"
                            : hoveredSlot === offset + i
                              ? "hover"
                              : placed[offset + i] !== null
                                ? "filled"
                                : "empty",
                          {
                            rounded: "lg",
                            emptyBg: "subtle",
                            selectableHint: selected !== null && placed[offset + i] === null,
                          }
                        )} ${
                          selected !== null && placed[offset + i] === selected
                            ? "ring-2 ring-black dark:ring-white"
                            : ""
                        }`}
                      >
                        {placed[offset + i] !== null ? config.bank[placed[offset + i] as number] : ""}
                      </button>
                    )}
                  </span>
                ))}
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
