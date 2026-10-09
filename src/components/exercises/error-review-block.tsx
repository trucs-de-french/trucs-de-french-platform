"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { frenchNbsp } from "@/lib/text/french-typography";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { TaskTypeIconBadge } from "@/lib/exercises/task-type-icon-badge";
import type { ReviewMode, ErrorReviewStatus } from "@/lib/exercises/error-review";
import { MultipleChoiceExercise } from "./multiple-choice";
import { FillBlankExercise } from "./fill-blank";
import type { MultipleChoicePublic, FillBlankPublic } from "@/lib/exercises/types";

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
      "border-gray-300 bg-white text-neutral-600 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
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
  expanded,
  onToggleExpanded,
}: {
  entry: ErrorReviewEntryData;
  index: number;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const isItems = entry.mode === "items";
  const isDone = isItems && entry.status === "done";
  const remaining = entry.remainingItemIds.length;

  return (
    <div className="rounded-lg border border-gray-100 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
      <div className={`flex flex-wrap items-center gap-3 p-3 ${isDone ? "opacity-60" : ""}`}>
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-medium text-white"
          aria-hidden
        >
          {index + 1}
        </span>
        <TaskTypeIconBadge type={entry.taskType} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading font-medium">{entry.title}</p>
          {!isItems && entry.summary && (
            <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">{entry.summary}</p>
          )}
          {isItems && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {entry.status === "partial"
                ? `Лишилось ${remaining} з ${entry.total}`
                : isDone
                  ? "Усі помилки виправлено"
                  : `${entry.total} ${pluralizeMistakes(entry.total)}`}
            </p>
          )}
        </div>
        <StatusPill status={isItems ? entry.status : "not_started"} />
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

      {isItems && !isDone && (
        <div className="flex items-center gap-2 border-t border-gray-100 p-3 dark:border-neutral-700">
          <button
            type="button"
            onClick={onToggleExpanded}
            className={`${STUDENT_BUTTON_PRIMARY} min-h-11`}
          >
            {expanded ? "Згорнути" : `Виправити ${remaining}`}
          </button>
        </div>
      )}

      {isDone && (
        <div className="flex items-center gap-2 border-t border-gray-100 p-3 text-sm text-green-600 dark:border-neutral-700 dark:text-green-400">
          <Check size={16} aria-hidden />
          Усі помилки цього завдання виправлено
        </div>
      )}

      {expanded && isItems && !isDone && entry.config && (
        <div className="border-t border-gray-100 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900/50">
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
          {entries.map((entry, i) => (
            <ErrorReviewCard
              key={entry.taskId}
              entry={entry}
              index={i}
              expanded={expandedTaskId === entry.taskId}
              onToggleExpanded={() =>
                setExpandedTaskId((prev) => (prev === entry.taskId ? null : entry.taskId))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
