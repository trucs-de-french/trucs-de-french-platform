"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { frenchNbsp } from "@/lib/text/french-typography";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { TaskTypeIconBadge } from "@/lib/exercises/task-type-icon-badge";
import { displayTaskTitle } from "@/lib/exercises/task-title";
import { taskVariantLabel } from "@/lib/exercises/task-type-meta";
import { isWholePracticeTaskType } from "@/lib/exercises/error-review";
import type { ReviewMode, ErrorReviewStatus } from "@/lib/exercises/error-review";
import { MultipleChoiceExercise } from "./multiple-choice";
import { FillBlankExercise } from "./fill-blank";
import { TrueFalseExercise } from "./true-false";
import { WordChoiceExercise } from "./word-choice";
import { LetterGapsExercise } from "./letter-gaps";
import { LetterRearrangementExercise } from "./letter-rearrangement";
import { MatchingExercise } from "./matching";
import { TableFillExercise } from "./table-fill";
import { DragDropExercise } from "./drag-drop";
import { ImageMatchExercise } from "./image-match";
import { ListeningExercise } from "./listening";
import { ReorderExercise } from "./reorder";
import { ChronologicalOrderExercise } from "./chronological-order";
import { SortColumnsExercise } from "./sort-columns";
import { CheckboxGridExercise } from "./checkbox-grid";
import type {
  MultipleChoicePublic,
  FillBlankPublic,
  TrueFalsePublic,
  WordChoicePublic,
  LetterGapsPublic,
  LetterRearrangementPublic,
  MatchingPublic,
  TableFillPublic,
  DragDropPublic,
  ImageMatchPublic,
  ListeningPublic,
  ReorderPublic,
  ChronologicalOrderPublic,
  SortColumnsPublic,
  CheckboxGridPublic,
} from "@/lib/exercises/types";

// Три порожні стани (пілот, частина 2) — розрізняються за тим, чи студент
// уже щось здавав у сцені взагалі (attemptedGradableCount, page.tsx) і чи
// все здане без жодної помилки.
export type ErrorReviewEmptyState = "not_attempted" | "no_errors" | "all_perfect";

const EMPTY_STATE_TEXT: Record<ErrorReviewEmptyState, string> = {
  not_attempted: "Faites d'abord les exercices de cette scène.",
  no_errors: "Aucune erreur pour le moment.",
  all_perfect: "Aucune erreur, excellent travail !",
};

export type ErrorReviewEntryData = {
  taskId: string;
  title: string;
  taskType: string;
  mode: ReviewMode;
  status: ErrorReviewStatus;
  total: number;
  remainingItemIds: string[];
  failedAttempts: Record<string, number>;
  // whole-режим — короткий підсумок через summarizeMistake (React.ReactNode,
  // уже відрендерений на сервері); items-режим — null, короткий опис тут
  // береться з total/remainingItemIds, не з summarizeMistake (інакше
  // правильна відповідь просочилась би в опис ДО розкриття, summarize-
  // mistake.tsx для fill_blank/multiple_choice показує саме correctAnswers).
  summary: React.ReactNode;
  // Санітизований config (sanitizeConfigForStudent) — лише для mode==="items"
  // (multiple_choice/fill_blank), потрібен інлайн-практиці нижче.
  config: Record<string, unknown> | null;
};

// Українська плюралізація "помилка/помилки/помилок" — те саме правило
// mod10/mod100, що pluralizePoints (lib/pluralize-points.ts), інше слово.
function pluralizeMistakes(n: number): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "помилка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "помилки";
  return "помилок";
}

const STATUS_PILL: Record<ErrorReviewStatus, { label: string; className: string }> = {
  not_started: {
    label: "Не виправлено",
    className:
      "glass-gap-shadow border-[rgba(217,183,101,0.55)] bg-white text-neutral-600 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  },
  partial: {
    label: "Частково",
    className:
      "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
  done: {
    label: "Виправлено",
    className:
      "border-green-500 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-950/30 dark:text-green-300",
  },
};

function StatusPill({ status }: { status: ErrorReviewStatus }) {
  const pill = STATUS_PILL[status];
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${pill.className}`}
    >
      {pill.label}
    </span>
  );
}

function ErrorReviewCard({
  entry,
  index,
  ordinal,
  expanded,
  onToggleExpanded,
}: {
  entry: ErrorReviewEntryData;
  index: number;
  // Порядковий номер картки серед карток ТОГО Ж taskType у цьому блоці —
  // null, якщо тип у блоці лише один (номер зайвий, не додається до назви).
  // Рахується в ErrorReviewBlock (там видно всі entries одразу), не тут.
  ordinal: number | null;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const isItems = entry.mode === "items";
  const isWhole = entry.mode === "whole" && isWholePracticeTaskType(entry.taskType);
  const isInteractive = isItems || isWhole;
  const isDone = isInteractive && entry.status === "done";
  const remaining = entry.remainingItemIds.length;

  return (
    <div className="rounded-lg border-[1.5px] dark:border glass-gold-edge border-[#dcbd6e] bg-white glass-card-shadow dark:shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
      <div className={`flex flex-wrap items-center gap-3 p-3 ${isDone ? "opacity-60" : ""}`}>
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-medium text-white"
          aria-hidden
        >
          {index + 1}
        </span>
        <TaskTypeIconBadge type={entry.taskType} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading font-medium" title={entry.title}>
            {displayTaskTitle({ title: entry.title, taskType: entry.taskType, config: entry.config })}
            {ordinal !== null && ` · ${ordinal}`}
          </p>
          {!isInteractive && entry.summary && (
            <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">{entry.summary}</p>
          )}
          {isInteractive && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {entry.status === "partial"
                ? `Лишилось ${remaining} з ${entry.total}`
                : isDone
                  ? "Усі помилки виправлено"
                  : `${entry.total} ${pluralizeMistakes(entry.total)}`}
            </p>
          )}
        </div>
        <StatusPill status={isInteractive ? entry.status : "not_started"} />
      </div>

      {isItems && entry.status === "partial" && (
        <div className="px-3 pb-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.round(((entry.total - remaining) / entry.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {isInteractive && !isDone && (
        <div className="flex items-center gap-2 border-t border-[#e6e6f0] p-3 dark:border-neutral-700">
          <button
            type="button"
            onClick={onToggleExpanded}
            className={`${STUDENT_BUTTON_PRIMARY} min-h-11`}
          >
            {expanded ? "Згорнути" : isWhole ? "Спробувати ще раз" : `Виправити ${remaining}`}
          </button>
        </div>
      )}

      {isDone && (
        <div className="flex items-center gap-2 border-t border-[#e6e6f0] p-3 text-sm text-green-600 dark:border-neutral-700 dark:text-green-400">
          <Check size={16} aria-hidden />
          Усі помилки цього завдання виправлено
        </div>
      )}

      {expanded && isInteractive && !isDone && entry.config && (
        <div className="border-t border-[#e6e6f0] bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900/50">
          {entry.taskType === "multiple_choice" && (
            <MultipleChoiceExercise
              taskId={entry.taskId}
              config={entry.config as unknown as MultipleChoicePublic}
              pointsVisible={false}
              hidePoints
              practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
            />
          )}
          {entry.taskType === "fill_blank" && (
            <FillBlankExercise
              taskId={entry.taskId}
              config={entry.config as unknown as FillBlankPublic}
              pointsVisible={false}
              hidePoints
              practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
            />
          )}
          {entry.taskType === "true_false" && (
            <TrueFalseExercise
              taskId={entry.taskId}
              config={entry.config as unknown as TrueFalsePublic}
              pointsVisible={false}
              hidePoints
              practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
            />
          )}
          {entry.taskType === "word_choice" && (
            <WordChoiceExercise
              taskId={entry.taskId}
              config={entry.config as unknown as WordChoicePublic}
              pointsVisible={false}
              hidePoints
              practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
            />
          )}
          {entry.taskType === "letter_gaps" && (
            <LetterGapsExercise
              taskId={entry.taskId}
              config={entry.config as unknown as LetterGapsPublic}
              pointsVisible={false}
              hidePoints
              practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
            />
          )}
          {entry.taskType === "letter_rearrangement" && (
            <LetterRearrangementExercise
              taskId={entry.taskId}
              config={entry.config as unknown as LetterRearrangementPublic}
              pointsVisible={false}
              hidePoints
              practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
            />
          )}
          {entry.taskType === "matching" && (
            <MatchingExercise
              taskId={entry.taskId}
              config={entry.config as unknown as MatchingPublic}
              pointsVisible={false}
              hidePoints
              practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
            />
          )}
          {entry.taskType === "table_fill" && (
            <TableFillExercise
              taskId={entry.taskId}
              config={entry.config as unknown as TableFillPublic}
              pointsVisible={false}
              hidePoints
              practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
            />
          )}
          {entry.taskType === "drag_drop" && (
            <DragDropExercise
              taskId={entry.taskId}
              config={entry.config as unknown as DragDropPublic}
              pointsVisible={false}
              hidePoints
              practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
            />
          )}
          {entry.taskType === "image_match" && (
            <ImageMatchExercise
              taskId={entry.taskId}
              config={entry.config as unknown as ImageMatchPublic}
              pointsVisible={false}
              hidePoints
              practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
            />
          )}
          {entry.taskType === "listening" && (
            <ListeningExercise
              taskId={entry.taskId}
              config={entry.config as unknown as ListeningPublic}
              pointsVisible={false}
              hidePoints
              practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
            />
          )}
          {entry.taskType === "reorder" && (
            <ReorderExercise
              taskId={entry.taskId}
              config={entry.config as unknown as ReorderPublic}
              pointsVisible={false}
              hidePoints
              practice={{ whole: true, failedAttempts: entry.failedAttempts }}
            />
          )}
          {entry.taskType === "chronological_order" && (
            <ChronologicalOrderExercise
              taskId={entry.taskId}
              config={entry.config as unknown as ChronologicalOrderPublic}
              pointsVisible={false}
              hidePoints
              practice={{ whole: true, failedAttempts: entry.failedAttempts }}
            />
          )}
          {entry.taskType === "sort_columns" && (
            <SortColumnsExercise
              taskId={entry.taskId}
              config={entry.config as unknown as SortColumnsPublic}
              pointsVisible={false}
              hidePoints
              practice={{ whole: true, failedAttempts: entry.failedAttempts }}
            />
          )}
          {entry.taskType === "checkbox_grid" && (
            <CheckboxGridExercise
              taskId={entry.taskId}
              config={entry.config as unknown as CheckboxGridPublic}
              pointsVisible={false}
              hidePoints
              practice={{ whole: true, failedAttempts: entry.failedAttempts }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Блок "Робота над помилками" (пілот, частина 2) — заголовок+список карток
// за узгодженим мокапом. Клієнтський компонент (не серверний JSX, як
// раніше): inline-практика під карткою — локальний expanded-стан (Set
// taskId), сервер (page.tsx) лише постачає серіалізовану модель
// (entries), router.refresh() усередині MultipleChoiceExercise/
// FillBlankExercise (usePracticeCheck) оновлює ці самі пропси без
// перемонтування цього компонента — expanded-стан переживає кожен
// "Перевірити" всередині практики.
export function ErrorReviewBlock({
  entries,
  emptyState,
}: {
  entries: ErrorReviewEntryData[];
  emptyState: ErrorReviewEmptyState;
}) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-heading text-lg font-semibold">{frenchNbsp("Corrigez vos erreurs.")}</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Перегляньте свої помилки й натисніть «Виправити», щоб спробувати ще раз — без втрати балів.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {frenchNbsp(EMPTY_STATE_TEXT[emptyState])}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {(() => {
            // Кілька карток з ОДНАКОВОЮ фінальною назвою (taskVariantLabel,
            // не сирий taskType!) у блоці — додаємо порядковий номер, щоб
            // картки лишались розрізнюваними (displayTaskTitle тепер завжди
            // показує назву типу/варіанта, без довільного title вчителя —
            // див. task-title.ts). Групуємо саме по назві, а не по taskType,
            // бо один taskType (word_choice) може дати ДВІ різні назви
            // ("Вибір правильної форми" / "Вибір зайвого" — mode) — вони НЕ
            // повинні ділити нумерацію між собою.
            const labelOf = (entry: ErrorReviewEntryData) => taskVariantLabel(entry.taskType, entry.config);
            const labelCounts = new Map<string, number>();
            for (const entry of entries) {
              const label = labelOf(entry);
              labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
            }
            const seenSoFar = new Map<string, number>();
            return entries.map((entry, i) => {
              const label = labelOf(entry);
              const seen = (seenSoFar.get(label) ?? 0) + 1;
              seenSoFar.set(label, seen);
              const ordinal = (labelCounts.get(label) ?? 0) > 1 ? seen : null;
              return (
                <ErrorReviewCard
                  key={entry.taskId}
                  entry={entry}
                  index={i}
                  ordinal={ordinal}
                  expanded={expandedTaskId === entry.taskId}
                  onToggleExpanded={() =>
                    setExpandedTaskId((prev) => (prev === entry.taskId ? null : entry.taskId))
                  }
                />
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}
