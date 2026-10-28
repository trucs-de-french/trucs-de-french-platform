"use client";

import { useEffect, useState } from "react";
import type { SortColumnsPublic, SortColumnsDetail, SortColumnsAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { usePracticeCheck } from "./use-practice-check";
import { WHOLE_TASK_ITEM_ID } from "@/lib/exercises/error-review";
import { useColumnSort } from "./use-column-sort";
import { HintBulb, HintUsedBadge, type HintBulbState } from "./hint-bulb";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { ANSWER_CHIP_DEFAULT } from "./answer-card-style";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { formatPointsCount } from "@/lib/exercises/format-points";
import { TaskPanelHeader } from "./task-panel-header";
import { BlockTabs } from "./block-navigation";
import { BUTTON_CHECK, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS } from "./score-style";
import { TaskResult } from "./task-result";
import { useCheckConfirm, CheckConfirmBar } from "./check-confirm";
import {
  IMAGE_MATCH_POOL_LABEL,
  sortColumnsPoolCountLabel,
  TABLE_FILL_ANSWERS_TOGGLE_LABEL,
} from "@/lib/exercises/default-task-labels";

// Статус-іконки чипів колонок після перевірки (.sort-columns-chip--correct/
// --wrong, globals.css) — колір сам по собі недостатній (п. "icons must not
// rely on color alone"), тож галочка/хрестик завжди йдуть разом із кольором.
function CorrectIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="sort-columns-chip-icon">
      <path d="M2.5 7.5 5.5 10.5 11.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function WrongIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="sort-columns-chip-icon">
      <path d="M3 3 11 11M11 3 3 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 6-крапковий "грип" зліва на чипі пулу — той самий, що в drag-drop.tsx/
// image-match.tsx (.word-pool-chip-grip), продубльований тут же: спільного
// файлу з компонентами цих типів немає (лише спільні CSS-класи .word-pool*,
// tile-styles.ts/globals.css).
function ChipGripIcon() {
  return (
    <svg className="word-pool-chip-grip" viewBox="0 0 10 14" aria-hidden="true">
      {[2, 7, 12].map((cy) =>
        [2.5, 7.5].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" />)
      )}
    </svg>
  );
}

// Режим практики "Робота над помилками" (пілот, частина 7, хвиля 3) — той
// самий принцип whole, що ReorderPracticeProps/ChronologicalOrderPracticeProps.
export type SortColumnsPracticeProps = { whole: true; failedAttempts: Record<string, number> };

export function SortColumnsExercise({
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
  config: SortColumnsPublic;
  plaqueText?: string;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  // Задача належить DELF-тесту — лампочки не рендеряться взагалі (сервер
  // /api/exercises/sort-columns-hint однаково відхилив би запит, якби
  // хтось обійшов UI) — той самий принцип, що letter-rearrangement.tsx.
  isDelf?: boolean;
  practice?: SortColumnsPracticeProps;
}) {
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const singleDetail = result?.detail as SortColumnsDetail | undefined;
  const checkConfirm = useCheckConfirm();
  function submitSort() {
    submit(
      config.items.map((item) => ({
        itemId: item.id,
        columnId: assignment[item.id] ?? "",
        hintUsed: hintedItemIds.has(item.id),
      }))
    );
  }

  // ==== Гілка практики (whole, частина 7, хвиля 3) — ЦІЛЕ завдання як один
  // елемент (WHOLE_TASK_ITEM_ID), той самий принцип, що reorder.tsx/
  // chronological-order.tsx. Без підказок/балів у практиці (задача).
  const isPractice = !!practice;
  const practiceCheck = usePracticeCheck(taskId);
  const [practiceDetail, setPracticeDetail] = useState<SortColumnsDetail | undefined>(undefined);
  const [practiceCorrect, setPracticeCorrect] = useState(false);
  const [practiceFailedAttempts, setPracticeFailedAttempts] = useState<Record<string, number>>(
    practice?.failedAttempts ?? {}
  );

  const detail = isPractice ? practiceDetail : singleDetail;
  const locked = isPractice ? practiceCorrect : !!result;
  const hintsEnabled = !!config.hintsEnabled && !isDelf && !isPractice;

  useEffect(() => {
    if (!isPractice && result) onResult?.(result);
  }, [isPractice, result, onResult]);

  async function submitPractice() {
    const answer: SortColumnsAnswer = config.items.map((item) => ({
      itemId: item.id,
      columnId: assignment[item.id] ?? "",
    }));
    const r = await practiceCheck.check([WHOLE_TASK_ITEM_ID], answer);
    if (!r) return;
    const correct = r.results[0]?.correct ?? false;
    setPracticeCorrect(correct);
    setPracticeDetail(r.detail as SortColumnsDetail | undefined);
    setPracticeFailedAttempts(r.failedAttempts);
    const attempts = r.failedAttempts[WHOLE_TASK_ITEM_ID] ?? 0;
    if (!correct && attempts >= 2 && !practiceCheck.revealed[WHOLE_TASK_ITEM_ID]) {
      practiceCheck.reveal(WHOLE_TASK_ITEM_ID, false);
    }
  }

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

  // Пілюля "N балів" у заголовку панелі — той самий принцип, що pooled-
  // score вправи з одним блоком (fill-blank.tsx тощо): без балів/пілюлі в
  // практиці (та сама умова, що й решта балів у цьому файлі).
  const totalPoints = config.items.reduce((sum, item) => sum + item.points, 0);
  const pointsText =
    !hidePoints && !isPractice && !result && pointsVisible ? formatPointsCount(totalPoints) : undefined;
  // scroll-mt (той самий принцип і літеральні значення, що drag-drop.tsx/
  // fill-blank.tsx): клік-вибір не викликає сам по собі scroll, але якщо
  // браузер (напр. фокус/якір) підведе колонку до самого верху, липкий пул
  // не повинен її закрити.
  const scrollMtClass = pool.length > 0 ? "scroll-mt-16 sm:scroll-mt-[27vh]" : "";

  // .sort-columns-placed-chip (globals.css) — ЛИШЕ метрики/шрифт/радіус/
  // висота, РІВНО ті самі значення, що .word-pool-chip (одна точка правди
  // для розміру), без власних кольорів — колір/рамку/фон додає кожен стан
  // своїми класами тут: та сама gold/lavender рамка bankTileClass, що й
  // раніше (нейтральний), SELECTED_OPTION_CLASS (вибраний, та сама синя
  // підсвітка, що завжди була тут — НЕ ring пулу), sort-columns-chip--
  // correct/--wrong (після перевірки). Кольори/фон НЕ торкались — лише
  // розмір тепер спільний із пулом.
  function itemClass(id: string) {
    const d = detail?.items.find((x) => x.id === id);
    if (d) {
      return `sort-columns-placed-chip ${d.isCorrect ? "sort-columns-chip--correct" : "sort-columns-chip--wrong"}`;
    }
    if (selected === id) {
      return `sort-columns-placed-chip glass-gap-shadow dark:shadow-sm ${SELECTED_OPTION_CLASS}`;
    }
    return "sort-columns-placed-chip glass-chip glass-chip-hover glass-gap-shadow dark:shadow-sm bg-white hover:bg-neutral-50 dark:border-[var(--card-border)] dark:bg-[var(--card-bg)] dark:hover:bg-[var(--card-hover-bg)] dark:hover:border-[var(--card-hover-border)]";
  }

  function bulbState(itemId: string): HintBulbState {
    return hintedItemIds.has(itemId) ? "used" : "available";
  }

  function chip(item: SortColumnsPublic["items"][number]) {
    const d = detail?.items.find((x) => x.id === item.id);
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
        className={itemClass(item.id)}
      >
        <ChipGripIcon />
        {d && (d.isCorrect ? <CorrectIcon /> : <WrongIcon />)}
        <span className="min-w-0 break-words [overflow-wrap:anywhere]">{item.text}</span>
        {locked && d?.hintUsed && <HintUsedBadge />}
        {hintsEnabled && !locked && (
          <HintBulb
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

  // Чип пулу БЕЗ статусу перевірки — chip() тепер теж на .sort-columns-
  // placed-chip (ті самі метрики, що .word-pool-chip нижче), тож для вже
  // перевіреного, але ще непоставленого елемента (часткова здача) просто
  // делегуємо в chip(item): та сама зелена/червона рамка (.sort-columns-
  // chip--correct/--wrong), той самий розмір/шрифт, що й тут.
  function poolChip(item: SortColumnsPublic["items"][number]) {
    if (detail?.items.find((x) => x.id === item.id)) return chip(item);
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
        className={`word-pool-chip ${selected === item.id ? "ring-2 ring-black dark:ring-white" : ""}`}
      >
        <ChipGripIcon />
        <span className="min-w-0 break-words [overflow-wrap:anywhere]">{item.text}</span>
        {hintsEnabled && !locked && (
          <HintBulb
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
      <BlockTabs plaqueText={plaqueText} />
      <TaskPanelHeader
        pointsText={pointsText}
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.sort_columns.instruction}
        subInstructionText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.sort_columns.subInstruction}
      />

      <div className="word-pool" {...poolDropProps()} onClick={clickPool}>
        <div className="word-pool-label-row">
          <span className="word-pool-label">{IMAGE_MATCH_POOL_LABEL}</span>
          <span className="word-pool-count">{sortColumnsPoolCountLabel(pool.length)}</span>
        </div>
        <div className="word-pool-chips">{pool.map((item) => poolChip(item))}</div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2.5">
        {config.columns.map((col) => {
          const columnItems = config.items.filter((i) => assignment[i.id] === col.id);
          const isHinted = activeHint?.columnId === col.id;
          const stateClass =
            dragOverColumn === col.id
              ? "border-blue-400 bg-blue-50 dark:border-[#7f9cf0] dark:bg-blue-950/30"
              : isHinted
                ? "border-blue-300 bg-blue-50 ring-2 ring-inset ring-blue-500 dark:border-blue-600 dark:bg-blue-950/30"
                : `${ANSWER_CHIP_DEFAULT} sort-columns-dropzone`;
          // bg-brand/10 + text-brand (без dark:-варіанту) давали ~2.3:1 у
          // темній темі (той самий --color-brand на майже чорному фоні —
          // замалий контраст) — indigo-100/indigo-700 (світла) і
          // indigo-900/40 + indigo-300 (темна) — та сама indigo-шкала, що
          // вже дає badge кольору завдання (task-type-meta.ts:131),
          // ~6.4:1/~7:1 (докладніше — звіт).
          const headerClass = isHinted
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200"
            : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-[#f3d98b]";
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
                className={`flex min-h-[6.5rem] flex-wrap gap-2 p-2.5 ${
                  columnItems.length === 0 ? "items-center justify-center text-center" : ""
                }`}
              >
                {columnItems.length === 0 ? (
                  <span className="text-xs text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
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

      {isPractice ? (
        <div className="flex flex-col gap-2">
          {!practiceCorrect && (
            <button
              type="button"
              onClick={submitPractice}
              disabled={practiceCheck.pending || !allPlaced}
              className={`self-start ${BUTTON_CHECK}`}
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
                Неправильно, спробуйте ще раз (спроб: {practiceFailedAttempts[WHOLE_TASK_ITEM_ID] ?? 0})
              </span>
              {!practiceCheck.revealed[WHOLE_TASK_ITEM_ID] && (
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
          {practiceCheck.revealed[WHOLE_TASK_ITEM_ID] && (
            <ul className="flex flex-col gap-0.5 text-sm italic text-amber-700 dark:text-amber-400">
              {practiceCheck.revealed[WHOLE_TASK_ITEM_ID].map((pair) => {
                const [itemId, columnId] = pair.split(":");
                const item = config.items.find((i) => i.id === itemId);
                const column = config.columns.find((c) => c.id === columnId);
                return (
                  <li key={pair}>
                    {item?.text ?? itemId} → {column?.label ?? columnId}
                  </li>
                );
              })}
            </ul>
          )}
          {practiceCheck.error && <p className="text-sm text-red-600 dark:text-red-400">{practiceCheck.error}</p>}
        </div>
      ) : (
      <div className="flex flex-col gap-3">
        {!result ? (
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              onClick={() => checkConfirm.attemptCheck(pool.length, submitSort)}
              disabled={pending}
              className={`self-start ${BUTTON_CHECK}`}
            >
              {pending ? "Перевіряю..." : "Перевірити"}
            </button>
            {checkConfirm.confirming && (
              <CheckConfirmBar
                unansweredCount={pool.length}
                onConfirm={() => checkConfirm.confirmCheck(submitSort)}
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
            toggleCount={singleDetail ? config.items.length : undefined}
            hintSummary={{
              hintCount: singleDetail?.items.filter((it) => it.hintUsed).length ?? 0,
              reducesPoints: config.hintsEnabled,
            }}
          >
            {singleDetail && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-4">
                {config.columns.map((col) => (
                  <div key={col.id} className="flex flex-col gap-2">
                    <span className="sort-columns-answer-title">{col.label}</span>
                    {config.items
                      .filter((item) => singleDetail.items.find((d) => d.id === item.id)?.correctColumnId === col.id)
                      .map((item) => (
                        <span key={item.id} className="sort-columns-answer-card">
                          {item.text}
                        </span>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </TaskResult>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
      )}
    </div>
  );
}
