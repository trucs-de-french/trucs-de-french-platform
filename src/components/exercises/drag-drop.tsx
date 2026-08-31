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
  const segments = config.template.split("{{}}");
  const blankCount = segments.length - 1;
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
  } = useTilePlacement(blankCount, locked);

  return (
    <div>
      <p className="mb-2 font-medium">{config.instructions ?? DEFAULT_INSTRUCTIONS.drag_drop}</p>

      <p className="leading-8">
        {segments.map((seg, i) => (
          <span key={i}>
            {seg}
            {i < blankCount && (
              <span
                onClick={() => clickSlot(i)}
                {...slotDragProps(i)}
                {...slotDropProps(i)}
                className={`mx-1 inline-flex min-h-10 min-w-20 select-none items-center justify-center px-3 py-1.5 align-middle text-sm ${slotClass(
                  detail
                    ? detail.blanks[i]?.isCorrect
                      ? "correct"
                      : "incorrect"
                    : hoveredSlot === i
                      ? "hover"
                      : placed[i] !== null
                        ? "filled"
                        : "empty"
                )} ${
                  selected !== null && placed[i] === selected
                    ? "ring-2 ring-black dark:ring-white"
                    : ""
                }`}
              >
                {placed[i] !== null ? config.bank[placed[i] as number] : ""}
              </span>
            )}
          </span>
        ))}
      </p>

      {detail && (
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {detail.blanks.map((b, i) =>
            b.isCorrect ? null : (
              <li key={i} className="text-red-600 dark:text-red-400">
                Пропуск {i + 1}: правильно — {b.correctAnswers.join(" / ")}
              </li>
            )
          )}
        </ul>
      )}

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
          onClick={() => submit(placed.map((p) => (p !== null ? config.bank[p] : "")))}
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
