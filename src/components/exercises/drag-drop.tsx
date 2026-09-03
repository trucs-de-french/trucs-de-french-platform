"use client";

import type { DragDropPublic, DragDropDetail } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { useTilePlacement } from "./use-tile-placement";
import { bankTileClass, slotClass } from "./tile-styles";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";

export function DragDropExercise({
  taskId,
  config,
}: {
  taskId: string;
  config: DragDropPublic;
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
    <div>
      <p className="mb-2 font-medium">{config.instructions ?? DEFAULT_INSTRUCTIONS.drag_drop}</p>

      <div className="flex flex-col gap-3">
        {config.sentences.map((s, si) => {
          const segments = sentenceSegments[si];
          const blankCount = blankCounts[si];
          const offset = offsets[si];
          const sentDetail = detail?.sentences.find((d) => d.id === s.id);

          return (
            <div key={s.id}>
              <p className="leading-8">
                {segments.map((seg, i) => (
                  <span key={i}>
                    {seg}
                    {i < blankCount && (
                      <span
                        onClick={() => clickSlot(offset + i)}
                        {...slotDragProps(offset + i)}
                        {...slotDropProps(offset + i)}
                        className={`mx-1 inline-flex min-h-10 min-w-20 select-none items-center justify-center px-3 py-1.5 align-middle text-sm ${slotClass(
                          sentDetail
                            ? sentDetail.blanks[i]?.isCorrect
                              ? "correct"
                              : "incorrect"
                            : hoveredSlot === offset + i
                              ? "hover"
                              : placed[offset + i] !== null
                                ? "filled"
                                : "empty"
                        )} ${
                          selected !== null && placed[offset + i] === selected
                            ? "ring-2 ring-black dark:ring-white"
                            : ""
                        }`}
                      >
                        {placed[offset + i] !== null ? config.bank[placed[offset + i] as number] : ""}
                      </span>
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

      <div className="mt-3 flex min-h-12 flex-wrap gap-2 rounded-md" {...bankDropProps()}>
        {config.bank.map((word, bi) => (
          <button
            key={bi}
            type="button"
            {...bankDragProps(bi)}
            onClick={() => clickBank(bi)}
            disabled={locked || usedBankIndices.has(bi)}
            className={bankTileClass({ selected: selected === bi, used: usedBankIndices.has(bi) })}
          >
            {word}
          </button>
        ))}
      </div>

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
          className="mt-3 rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          {pending ? "Перевіряю..." : "Перевірити"}
        </button>
      ) : (
        <p
          className={`mt-3 text-sm font-medium ${
            result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {result.correct ? "Правильно! ✓" : `Результат: ${result.score}%`}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
