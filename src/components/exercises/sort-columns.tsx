"use client";

import { useEffect, useState } from "react";
import type { SortColumnsPublic, SortColumnsDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { useColumnSort } from "./use-column-sort";
import { bankTileClass, stickyPoolClass } from "./tile-styles";
import { HintBulb, type HintBulbState } from "./hint-bulb";
import { ANSWER_CARD_DEFAULT } from "./answer-card-style";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";

export function SortColumnsExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
  isDelf,
}: {
  taskId: string;
  config: SortColumnsPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  // Задача належить DELF-тесту — лампочки не рендеряться взагалі (сервер
  // /api/exercises/sort-columns-hint однаково відхилив би запит, якби
  // хтось обійшов UI) — той самий принцип, що letter-rearrangement.tsx.
  isDelf?: boolean;
}) {
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as SortColumnsDetail | undefined;
  const locked = !!result;
  const hintsEnabled = !!config.hintsEnabled && !isDelf;

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

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

  // hintedItemIds — перманентно (для балів: 50% за елемент, де лампочку
  // клікали хоч раз, навіть якщо підсвітку потім зняли). activeHint —
  // ЄДИНА зараз показана підсвітка колонки (новий клік лампочки знімає
  // попередню, "використано" лишається в обох); скидається одразу в
  // handleClickColumn/columnDropPropsWithHint нижче, щойно саме цей
  // елемент кудись покладено — не через ефект (react-hooks/set-state-in-
  // effect), а прямо в обробнику події, що й так призводить до assignTo.
  const [hintedItemIds, setHintedItemIds] = useState<Set<string>>(new Set());
  const [activeHint, setActiveHint] = useState<{ itemId: string; columnId: string } | null>(null);
  const [hintLoading, setHintLoading] = useState<Set<string>>(new Set());

  function clearHintIfPlaced(itemId: string | undefined) {
    if (itemId && activeHint?.itemId === itemId) setActiveHint(null);
  }

  function handleClickColumn(columnId: string) {
    clearHintIfPlaced(selected ?? undefined);
    clickColumn(columnId);
  }

  function columnDropPropsWithHint(columnId: string) {
    const base = columnDropProps(columnId);
    return {
      ...base,
      onDrop: (e: Parameters<typeof base.onDrop>[0]) => {
        clearHintIfPlaced(e.dataTransfer.getData("text/plain"));
        base.onDrop(e);
      },
    };
  }

  async function toggleHint(itemId: string) {
    if (locked || hintLoading.has(itemId)) return;
    if (activeHint?.itemId === itemId) {
      setActiveHint(null);
      return;
    }
    setHintLoading((prev) => new Set(prev).add(itemId));
    try {
      const res = await fetch("/api/exercises/sort-columns-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, itemId }),
      });
      if (!res.ok) return;
      const { columnId } = (await res.json()) as { columnId: string };
      setActiveHint({ itemId, columnId });
      setHintedItemIds((prev) => new Set(prev).add(itemId));
    } finally {
      setHintLoading((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }

  const pool = config.items.filter((i) => !assignment[i.id]);
  const allPlaced = pool.length === 0;
  // scroll-mt (той самий принцип і літеральні значення, що drag-drop.tsx/
  // fill-blank.tsx): клік-вибір не викликає сам по собі scroll, але якщо
  // браузер (напр. фокус/якір) підведе колонку до самого верху, липкий пул
  // не повинен її закрити.
  const scrollMtClass = pool.length > 0 ? "scroll-mt-16 sm:scroll-mt-[27vh]" : "";

  // До перевірки — лише якщо pointsVisible; після — завжди.
  function itemLabel(item: SortColumnsPublic["items"][number]) {
    if (hidePoints) return item.text;
    const d = detail?.items.find((x) => x.id === item.id);
    if (!pointsVisible && !d) return item.text;
    const suffix = d
      ? `${d.isCorrect ? item.points : 0}/${item.points}`
      : `${item.points} ${pluralizePoints(item.points)}`;
    return `${item.text} (${suffix})`;
  }

  function itemClass(id: string) {
    const d = detail?.items.find((x) => x.id === id);
    if (d) {
      return d.isCorrect
        ? "border-green-500 bg-green-50 dark:bg-green-950/30"
        : "border-red-500 bg-red-50 dark:bg-red-950/30";
    }
    return bankTileClass({ selected: selected === id, used: false });
  }

  function bulbState(itemId: string): HintBulbState {
    return hintedItemIds.has(itemId) ? "used" : "available";
  }

  function chip(item: SortColumnsPublic["items"][number]) {
    return (
      <div
        key={item.id}
        role="button"
        tabIndex={locked ? -1 : 0}
        {...itemDragProps(item.id)}
        onClick={(e) => {
          e.stopPropagation();
          clickItem(item.id);
        }}
        onKeyDown={(e) => {
          if (locked) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            clickItem(item.id);
          }
        }}
        className={`inline-flex items-center gap-1.5 ${itemClass(item.id)}`}
      >
        <span>{itemLabel(item)}</span>
        {hintsEnabled && !locked && (
          <HintBulb
            size="sm"
            state={bulbState(item.id)}
            stopPropagation
            disabled={hintLoading.has(item.id)}
            onClick={() => toggleHint(item.id)}
            label={`Підказка: колонка для «${item.text}»`}
          />
        )}
      </div>
    );
  }

  return (
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.sort_columns.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.sort_columns.subInstruction}
      />

      <div {...poolDropProps()} onClick={clickPool} className={stickyPoolClass("drag-drop")}>
        {pool.length === 0 ? (
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            Усі елементи розкладено
          </span>
        ) : (
          pool.map((item) => chip(item))
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2.5">
        {config.columns.map((col) => {
          const columnItems = config.items.filter((i) => assignment[i.id] === col.id);
          const isHinted = activeHint?.columnId === col.id;
          const stateClass =
            dragOverColumn === col.id
              ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
              : isHinted
                ? "border-blue-300 bg-blue-50 ring-2 ring-inset ring-blue-500 dark:border-blue-600 dark:bg-blue-950/30"
                : ANSWER_CARD_DEFAULT;
          // bg-brand/10 + text-brand (без dark:-варіанту) давали ~2.3:1 у
          // темній темі (той самий --color-brand на майже чорному фоні —
          // замалий контраст) — indigo-100/indigo-700 (світла) і
          // indigo-900/40 + indigo-300 (темна) — та сама indigo-шкала, що
          // вже дає badge кольору завдання (task-type-meta.ts:131),
          // ~6.4:1/~7:1 (докладніше — звіт).
          const headerClass = isHinted
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200"
            : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300";
          return (
            <div
              key={col.id}
              {...columnDropPropsWithHint(col.id)}
              onClick={() => handleClickColumn(col.id)}
              className={`overflow-hidden rounded-xl border transition-colors ${stateClass} ${scrollMtClass}`}
            >
              <p
                className={`break-words px-3 py-2 text-center font-heading text-sm font-bold text-balance ${headerClass}`}
              >
                {col.label}
              </p>
              <div
                className={`flex min-h-[6.5rem] flex-wrap gap-1.5 p-2.5 ${
                  columnItems.length === 0 ? "items-center justify-center text-center" : ""
                }`}
              >
                {columnItems.length === 0 ? (
                  <span className="text-xs text-neutral-400 dark:text-neutral-500">
                    Перетягніть слово сюди
                  </span>
                ) : (
                  columnItems.map((item) => chip(item))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {detail && (
        <ul className="flex flex-col gap-1 text-sm">
          {detail.items
            .filter((i) => !i.isCorrect)
            .map((i) => (
              <li key={i.id} className="text-red-600 dark:text-red-400">
                {i.text}: правильна колонка — {i.correctColumnLabel}
              </li>
            ))}
        </ul>
      )}

      <div className="flex flex-col gap-3">
        {!result ? (
          <button
            type="button"
            onClick={() =>
              submit(
                config.items.map((item) => ({
                  itemId: item.id,
                  columnId: assignment[item.id] ?? "",
                  hintUsed: hintedItemIds.has(item.id),
                }))
              )
            }
            disabled={pending || !allPlaced}
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
