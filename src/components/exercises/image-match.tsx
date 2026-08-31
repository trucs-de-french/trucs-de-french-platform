"use client";

import type { ImageMatchPublic, ImageMatchDetail } from "@/lib/exercises/types";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { useExerciseCheck } from "./use-exercise-check";
import { useTilePlacement } from "./use-tile-placement";
import { bankTileClass, slotClass } from "./tile-styles";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";

export function ImageMatchExercise({
  taskId,
  config,
}: {
  taskId: string;
  config: ImageMatchPublic;
}) {
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as ImageMatchDetail | undefined;
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
  } = useTilePlacement(config.items.length, locked);

  return (
    <div>
      <p className="mb-2 font-medium">{config.instructions ?? DEFAULT_INSTRUCTIONS.image_match}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {config.items.map((item, i) => (
          <div key={item.id} className="flex flex-col gap-1">
            <ImageOrPlaceholder
              src={item.imageUrl}
              alt=""
              className="h-24 w-full rounded-md object-cover"
            />
            <span
              onClick={() => clickSlot(i)}
              {...slotDragProps(i)}
              {...slotDropProps(i)}
              className={`flex min-h-10 select-none items-center justify-center px-2 py-1.5 text-center text-sm ${slotClass(
                detail
                  ? detail.items[i]?.isCorrect
                    ? "correct"
                    : "incorrect"
                  : hoveredSlot === i
                    ? "hover"
                    : placed[i] !== null
                      ? "filled"
                      : "empty"
              )} ${selected !== null && placed[i] === selected ? "ring-2 ring-black dark:ring-white" : ""}`}
            >
              {placed[i] !== null ? config.bank[placed[i] as number] : ""}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex min-h-12 flex-wrap gap-2 rounded-md" {...bankDropProps()}>
        {config.bank.map((name, bi) => (
          <button
            key={bi}
            type="button"
            {...bankDragProps(bi)}
            onClick={() => clickBank(bi)}
            disabled={locked || usedBankIndices.has(bi)}
            className={bankTileClass({ selected: selected === bi, used: usedBankIndices.has(bi) })}
          >
            {name}
          </button>
        ))}
      </div>

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
