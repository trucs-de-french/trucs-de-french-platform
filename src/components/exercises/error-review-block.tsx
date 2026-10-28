"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { frenchNbsp } from "@/lib/text/french-typography";
import { BUTTON_CHECK } from "@/lib/button-styles";
import { TaskTypeIconBadge } from "@/lib/exercises/task-type-icon-badge";
import { useT } from "@/lib/i18n/context";
import { plural } from "@/lib/i18n/plural";
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
  // Назва картки — та сама, що на плашці типу над вправою (GlassBlock,
  // getTaskBarText): дефолтна французька назва типу або ручний cardTitle
  // вчительки, рахується на сервері з НЕсанітизованого config (cardTitle не
  // проходить sanitizeConfigForStudent), а не з entry.config нижче.
  displayTitle: string;
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

// uk: three-way mod10/mod100 (pluralizePoints-подібне правило); fr/en —
// one/other через Intl.PluralRules (plural() helper).
function pluralizeMistakes(lang: "uk" | "fr" | "en", n: number): string {
  if (lang === "uk") {
    const abs = Math.abs(n);
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod10 === 1 && mod100 !== 11) return "помилка";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "помилки";
    return "помилок";
  }
  return plural(lang, n, lang === "fr" ? { one: "erreur", other: "erreurs" } : { one: "error", other: "errors" });
}

const STATUS_PILL_CLASS: Record<ErrorReviewStatus, string> = {
  not_started:
    "glass-gap-shadow border-[rgba(217,183,101,0.55)] bg-white text-neutral-600 dark:border-[var(--card-field-border)] dark:bg-[var(--card-field-bg)] dark:text-neutral-300",
  partial: "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  done: "border-green-500 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-950/30 dark:text-green-300",
};
const STATUS_PILL_KEY: Record<ErrorReviewStatus, "errReview.notFixed" | "errReview.partiallyFixed" | "errReview.fixed"> = {
  not_started: "errReview.notFixed",
  partial: "errReview.partiallyFixed",
  done: "errReview.fixed",
};

function StatusPill({ status }: { status: ErrorReviewStatus }) {
  const { t } = useT();
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_PILL_CLASS[status]}`}
    >
      {t(STATUS_PILL_KEY[status])}
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
  const { t, lang } = useT();
  const isItems = entry.mode === "items";
  const isWhole = entry.mode === "whole" && isWholePracticeTaskType(entry.taskType);
  const isInteractive = isItems || isWhole;
  const isDone = isInteractive && entry.status === "done";
  const remaining = entry.remainingItemIds.length;

  return (
    <div className="rounded-lg border-[1.5px] dark:border-[1.5px] glass-gold-edge bg-white glass-card-shadow error-review-card-shadow dark:border-[var(--card-border)] dark:bg-[var(--error-review-card-bg)]">
      <div className={`flex flex-wrap items-center gap-3 p-3 ${isDone ? "opacity-60" : ""}`}>
        <span className="item-number-badge" aria-hidden>
          {index + 1}
        </span>
        <TaskTypeIconBadge type={entry.taskType} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading font-medium" title={entry.title}>
            {entry.displayTitle}
            {ordinal !== null && ` · ${ordinal}`}
          </p>
          {!isInteractive && entry.summary && (
            <p className="truncate text-sm text-[var(--text-muted-caption)] dark:text-[var(--card-ink-2)]">{entry.summary}</p>
          )}
          {isInteractive && (
            <p className="text-sm text-[var(--text-muted-caption)] dark:text-[var(--card-ink-2)]">
              {entry.status === "partial"
                ? t("errReview.remainingOfTotal", { n: remaining, total: entry.total })
                : isDone
                  ? t("errReview.allFixed")
                  : `${entry.total} ${pluralizeMistakes(lang, entry.total)}`}
            </p>
          )}
        </div>
        <StatusPill status={isInteractive ? entry.status : "not_started"} />
      </div>

      {isItems && entry.status === "partial" && (
        <div className="px-3 pb-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-[var(--card-field-bg)] dark:shadow-[inset_0_0_0_1px_rgba(130,160,240,.28)]">
            <div
              className="h-full rounded-full bg-brand error-review-progress-fill"
              style={{ width: `${Math.round(((entry.total - remaining) / entry.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {isInteractive && !isDone && (
        <div className="flex items-center gap-2 border-t border-[#e6e6f0] p-3 dark:border-[var(--card-border)]">
          <button
            type="button"
            onClick={onToggleExpanded}
            className={`${BUTTON_CHECK} min-h-11 error-review-fix-button`}
          >
            {expanded ? t("button.collapse") : isWhole ? t("button.retry") : t("button.fixCount", { n: remaining })}
          </button>
        </div>
      )}

      {isDone && (
        <div className="flex items-center gap-2 border-t border-[#e6e6f0] p-3 text-sm text-green-600 dark:border-[var(--card-border)] dark:text-green-400">
          <Check size={16} aria-hidden />
          {t("errReview.allFixedBanner")}
        </div>
      )}

      {expanded && isInteractive && !isDone && entry.config && (
        <div className="border-t border-[#e6e6f0] glass-inset-bg bg-neutral-50 p-3 dark:border-[var(--card-border)] dark:bg-neutral-900/50">
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
  const { t } = useT();
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-heading text-lg font-semibold">{frenchNbsp("Corrigez vos erreurs.")}</h3>
        <p className="text-sm text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
          {t("errReview.reviewHint")}
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
          {frenchNbsp(EMPTY_STATE_TEXT[emptyState])}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {(() => {
            // Кілька карток з ОДНАКОВОЮ фінальною назвою (entry.displayTitle —
            // та сама назва, що на плашці типу над вправою) у блоці —
            // додаємо порядковий номер, щоб картки лишались розрізнюваними.
            // Групуємо саме по назві, а не по taskType, бо кілька типів
            // можуть ділити одну FR-назву (наприклад обидва режими
            // word_choice — "Choix du mot") — вони МАЮТЬ ділити нумерацію,
            // бо на екрані показані під однаковим заголовком.
            const labelOf = (entry: ErrorReviewEntryData) => entry.displayTitle;
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
