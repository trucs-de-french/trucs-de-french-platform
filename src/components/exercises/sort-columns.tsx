"use client";

import type { SortColumnsPublic, SortColumnsDetail } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { useColumnSort } from "./use-column-sort";
import { bankTileClass } from "./tile-styles";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";

export function SortColumnsExercise({
  taskId,
  config,
}: {
  taskId: string;
  config: SortColumnsPublic;
}) {
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as SortColumnsDetail | undefined;
  const locked = !!result;

  const {
    assignment,
    selected,
    dragOverColumn,
    clickItem,
    clickColumn,
    clickPool,
    itemDragProps,
    columnDropProps,
    poolDropProps,
  } = useColumnSort(
    config.items.map((i) => i.id),
    locked
  );

  const pool = config.items.filter((i) => !assignment[i.id]);
  const allPlaced = pool.length === 0;

  function itemClass(id: string) {
    const d = detail?.items.find((x) => x.id === id);
    if (d) {
      return d.isCorrect
        ? "border-green-500 bg-green-50 dark:bg-green-950/30"
        : "border-red-500 bg-red-50 dark:bg-red-950/30";
    }
    return bankTileClass({ selected: selected === id, used: false });
  }

  return (
    <div>
      <p className="mb-2 font-medium">{config.instructions ?? DEFAULT_INSTRUCTIONS.sort_columns}</p>

      <div
        {...poolDropProps()}
        onClick={clickPool}
        className="mb-3 flex min-h-12 flex-wrap gap-2 rounded-md border border-dashed p-2"
      >
        {pool.length === 0 ? (
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            Усі елементи розкладено
          </span>
        ) : (
          pool.map((item) => (
            <button
              key={item.id}
              type="button"
              {...itemDragProps(item.id)}
              onClick={(e) => {
                e.stopPropagation();
                clickItem(item.id);
              }}
              className={itemClass(item.id)}
            >
              {item.text}
            </button>
          ))
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {config.columns.map((col) => {
          const columnItems = config.items.filter((i) => assignment[i.id] === col.id);
          return (
            <div
              key={col.id}
              {...columnDropProps(col.id)}
              onClick={() => clickColumn(col.id)}
              className={`min-h-24 rounded-md border p-2 ${
                dragOverColumn === col.id
                  ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
                  : ""
              }`}
            >
              <p className="mb-1 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                {col.label}
              </p>
              <div className="flex flex-wrap gap-1">
                {columnItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    {...itemDragProps(item.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      clickItem(item.id);
                    }}
                    className={itemClass(item.id)}
                  >
                    {item.text}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {detail && (
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {detail.items
            .filter((i) => !i.isCorrect)
            .map((i) => (
              <li key={i.id} className="text-red-600 dark:text-red-400">
                {i.text}: правильна колонка — {i.correctColumnLabel}
              </li>
            ))}
        </ul>
      )}

      {!result ? (
        <button
          type="button"
          onClick={() =>
            submit(
              config.items.map((item) => ({
                itemId: item.id,
                columnId: assignment[item.id] ?? "",
              }))
            )
          }
          disabled={pending || !allPlaced}
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
