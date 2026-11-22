"use client";

import { useEffect, useRef, useState } from "react";
import { Check, List } from "lucide-react";
import { frenchNbsp } from "@/lib/text/french-typography";
import { BUTTON_CHECK } from "@/lib/button-styles";
import { TaskTypeIconBadge } from "@/lib/exercises/task-type-icon-badge";
import { useT } from "@/lib/i18n/context";
import { plural } from "@/lib/i18n/plural";
import { pluralizeExercisesNominative } from "@/lib/pluralize-exercises";
import { isWholePracticeTaskType, deriveMistakesChips } from "@/lib/exercises/error-review";
import type { ReviewMode, ErrorReviewStatus } from "@/lib/exercises/error-review";
import { GlassBlock } from "@/components/glass-block";
import { EXERCISE_STACK } from "@/lib/spacing";
import { TaskPanelHeader } from "./task-panel-header";
import { DEFAULT_INSTRUCTIONS, DEFAULT_TRANSLATION_EN, taskTranslationLine } from "@/lib/exercises/default-instructions";
import type { TaskTypeKey } from "@/lib/exercises/default-task-labels";
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

// Чипи-перемикач вправ (редизайн навігації, мистейки-сторінка) — активний
// чип показує "N · назва", обрізану приблизно до 14 символів, щоб довга
// назва типу не розтягувала рядок чипів; повна назва лишається в
// title/aria-label чипа (never truncated there).
function truncateChipLabel(text: string, max = 14): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
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
      className={`error-review-status-pill shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_PILL_CLASS[status]}`}
    >
      {t(STATUS_PILL_KEY[status])}
    </span>
  );
}

// Три прапорці, що й картка (ErrorReviewCard), і сцена-вигляд відкритої
// задачі (ErrorReviewOpenedTask нижче) рахують ОДНАКОВО з entry — єдине
// місце цієї логіки, щоб обидва рендери не розійшлись.
function errorReviewFlags(entry: ErrorReviewEntryData) {
  const isItems = entry.mode === "items";
  const isWhole = entry.mode === "whole" && isWholePracticeTaskType(entry.taskType);
  const isInteractive = isItems || isWhole;
  const isDone = isInteractive && entry.status === "done";
  return { isItems, isWhole, isInteractive, isDone, remaining: entry.remainingItemIds.length };
}

// Типи, що в сцена-вигляді (openMode="scene") отримують справжні блоки
// (плашка+заголовок+BlockTabs+BlockNavigation, той самий поріг/chunk, що
// звичайна вправа сцени) — крок 4. Решта практико-підтримуваних типів тут
// НЕ зачіпаються (лишаються пласким списком, лише з плашкою/заголовком
// від кроку 3) — наступні кроки.
const SCENE_BLOCKABLE_TASK_TYPES = new Set([
  "letter_rearrangement",
  "letter_gaps",
  "matching",
  "table_fill",
]);

// Сама вправа режиму практики (перероблка лише неправильних елементів/
// цілого завдання, той самий компонент, що сцена) — єдине місце цього
// перемикача за типом, спільне для інлайн-розгортання картки
// (ErrorReviewCard) і сцена-вигляду відкритої задачі (ErrorReviewOpenedTask).
// plaqueText — лише сцена-вигляд передає (getTaskBarText-назва, та сама,
// що плашка на сторінці сцени): кожен з 15 компонентів нижче вже приймає
// цей пропс і сам малює BlockTabs/плашку як ПЕРШИЙ елемент свого дерева
// (той самий механізм, що ExerciseCard/сторінка сцени), тож інлайн-виклик
// (plaqueText не передано) лишається БЕЗ жодної плашки, як і раніше.
//
// snapshotIds — лише сцена-вигляд передає (ErrorReviewBlock, ЗАМОРОЖЕНИЙ
// знімок помилок на момент відкриття задачі, крок 4) — для 4 chunk-based
// типів (SCENE_BLOCKABLE_TASK_TYPES) замінює ЖИВИЙ entry.remainingItemIds
// на цей знімок (стабільне членство блоку на всю сесію) і додає `scene`
// (correctedItemIds — підмножина знімку, вже виправлена ПІСЛЯ нього,
// показується "вирішеною" в своєму блоці замість зникнення). Інші 11
// типів і далі отримують live entry.remainingItemIds без змін — наступні
// кроки.
function ErrorReviewPractice({
  entry,
  plaqueText,
  snapshotIds,
}: {
  entry: ErrorReviewEntryData;
  plaqueText?: string;
  snapshotIds?: string[];
}) {
  const { lang } = useT();
  if (!entry.config) return null;
  const isSceneBlockable = !!snapshotIds && SCENE_BLOCKABLE_TASK_TYPES.has(entry.taskType);
  const onlyItemIds = isSceneBlockable ? snapshotIds! : entry.remainingItemIds;
  // matching — виняток: entry.config.pairs (sanitizeMatchingForPractice,
  // wrongItemIds, НЕ remainingItemIds — sanitize.ts) уже сам є СТАБІЛЬНИМ
  // на всю історію завдання (не лише на цю сесію) пулом, з якого
  // matching.tsx чанкує блоки НАПРЯМУ (не через знімок, config.left/right
  // мають лишатись позиційно узгодженими з тим, що реально прочанкував
  // сервер) — тож "вирішені" тут мають рахуватись від УСЬОГО config.pairs,
  // а не лише від знімку цієї сесії, інакше пара, виправлена в
  // ПОПЕРЕДНІЙ сесії (до цього відкриття — не входить у знімок), знову
  // зʼявилась би в блоці як "ще не виправлена". Інші 3 типи — від знімку
  // (їхній config НЕ скоуплений за id, тож лише знімок визначає і членство
  // блоку, і що вважати "цією сесією виправленим").
  const scene = isSceneBlockable
    ? {
        correctedItemIds:
          entry.taskType === "matching"
            ? ((entry.config as unknown as { pairs?: { id: string }[] }).pairs ?? [])
                .map((p) => p.id)
                .filter((id) => !entry.remainingItemIds.includes(id))
            : snapshotIds!.filter((id) => !entry.remainingItemIds.includes(id)),
      }
    : undefined;
  // Рядок інструкції (FR-жирна/UK-сіра, слайш, роздільник — той самий
  // TaskPanelHeader, що сторінка сцени) — для типів, чия ВЛАСНА гілка тут
  // (switch нижче) НЕ рендерить TaskPanelHeader сама: флет-режим
  // (!isSceneBlockable — snapshotIds не передано, isSceneBlockable
  // завжди false) для УСІХ 15 типів, і сцена-вигляд (openMode="scene")
  // для 11 типів ПОЗА SCENE_BLOCKABLE_TASK_TYPES (вони й у сцена-вигляді
  // й далі йдуть тим самим флет-шляхом усередині свого компонента —
  // немає власної гілки isSceneMode). Для 4 SCENE_BLOCKABLE_TASK_TYPES у
  // сцена-вигляді (isSceneBlockable===true) — НЕ рендериться тут: їхня
  // власна гілка (letter-rearrangement.tsx/letter-gaps.tsx/matching.tsx/
  // table-fill.tsx, isPractice && isSceneMode) уже сама малює
  // TaskPanelHeader — дублювати означало б два заголовки поспіль.
  const renderExercise = () => {
  switch (entry.taskType) {
    case "multiple_choice":
      return (
        <MultipleChoiceExercise
          taskId={entry.taskId}
          config={entry.config as unknown as MultipleChoicePublic}
          pointsVisible={false}
          hidePoints
          plaqueText={plaqueText}
          practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
        />
      );
    case "fill_blank":
      return (
        <FillBlankExercise
          taskId={entry.taskId}
          config={entry.config as unknown as FillBlankPublic}
          pointsVisible={false}
          hidePoints
          plaqueText={plaqueText}
          practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
        />
      );
    case "true_false":
      return (
        <TrueFalseExercise
          taskId={entry.taskId}
          config={entry.config as unknown as TrueFalsePublic}
          pointsVisible={false}
          hidePoints
          plaqueText={plaqueText}
          practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
        />
      );
    case "word_choice":
      return (
        <WordChoiceExercise
          taskId={entry.taskId}
          config={entry.config as unknown as WordChoicePublic}
          pointsVisible={false}
          hidePoints
          plaqueText={plaqueText}
          practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
        />
      );
    case "letter_gaps":
      return (
        <LetterGapsExercise
          taskId={entry.taskId}
          config={entry.config as unknown as LetterGapsPublic}
          pointsVisible={false}
          hidePoints
          plaqueText={plaqueText}
          practice={{ onlyItemIds, failedAttempts: entry.failedAttempts, scene }}
        />
      );
    case "letter_rearrangement":
      return (
        <LetterRearrangementExercise
          taskId={entry.taskId}
          config={entry.config as unknown as LetterRearrangementPublic}
          pointsVisible={false}
          hidePoints
          plaqueText={plaqueText}
          practice={{ onlyItemIds, failedAttempts: entry.failedAttempts, scene }}
        />
      );
    case "matching":
      return (
        <MatchingExercise
          taskId={entry.taskId}
          config={entry.config as unknown as MatchingPublic}
          pointsVisible={false}
          hidePoints
          plaqueText={plaqueText}
          practice={{ onlyItemIds, failedAttempts: entry.failedAttempts, scene }}
        />
      );
    case "table_fill":
      return (
        <TableFillExercise
          taskId={entry.taskId}
          config={entry.config as unknown as TableFillPublic}
          pointsVisible={false}
          hidePoints
          plaqueText={plaqueText}
          practice={{ onlyItemIds, failedAttempts: entry.failedAttempts, scene }}
        />
      );
    case "drag_drop":
      return (
        <DragDropExercise
          taskId={entry.taskId}
          config={entry.config as unknown as DragDropPublic}
          pointsVisible={false}
          hidePoints
          plaqueText={plaqueText}
          practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
        />
      );
    case "image_match":
      return (
        <ImageMatchExercise
          taskId={entry.taskId}
          config={entry.config as unknown as ImageMatchPublic}
          pointsVisible={false}
          hidePoints
          plaqueText={plaqueText}
          practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
        />
      );
    case "listening":
      return (
        <ListeningExercise
          taskId={entry.taskId}
          config={entry.config as unknown as ListeningPublic}
          pointsVisible={false}
          hidePoints
          plaqueText={plaqueText}
          practice={{ onlyItemIds: entry.remainingItemIds, failedAttempts: entry.failedAttempts }}
        />
      );
    case "reorder":
      return (
        <ReorderExercise
          taskId={entry.taskId}
          config={entry.config as unknown as ReorderPublic}
          pointsVisible={false}
          hidePoints
          plaqueText={plaqueText}
          practice={{ whole: true, failedAttempts: entry.failedAttempts }}
        />
      );
    case "chronological_order":
      return (
        <ChronologicalOrderExercise
          taskId={entry.taskId}
          config={entry.config as unknown as ChronologicalOrderPublic}
          pointsVisible={false}
          hidePoints
          plaqueText={plaqueText}
          practice={{ whole: true, failedAttempts: entry.failedAttempts }}
        />
      );
    case "sort_columns":
      return (
        <SortColumnsExercise
          taskId={entry.taskId}
          config={entry.config as unknown as SortColumnsPublic}
          pointsVisible={false}
          hidePoints
          plaqueText={plaqueText}
          practice={{ whole: true, failedAttempts: entry.failedAttempts }}
        />
      );
    case "checkbox_grid":
      return (
        <CheckboxGridExercise
          taskId={entry.taskId}
          config={entry.config as unknown as CheckboxGridPublic}
          pointsVisible={false}
          hidePoints
          plaqueText={plaqueText}
          practice={{ whole: true, failedAttempts: entry.failedAttempts }}
        />
      );
    default:
      return null;
  }
  };

  const exerciseNode = renderExercise();
  // 4 SCENE_BLOCKABLE_TASK_TYPES у сцена-вигляді вже малюють свій власний
  // TaskPanelHeader (вище) — не додаємо другий.
  if (isSceneBlockable) return exerciseNode;

  const instructionDefaults = DEFAULT_INSTRUCTIONS[entry.taskType];
  const configForHeader = entry.config as {
    instructions?: string;
    subInstructions?: string;
    subInstructionsEn?: string;
  };
  return (
    <>
      <TaskPanelHeader
        instructionText={configForHeader.instructions ?? instructionDefaults?.instruction}
        subInstructionText={taskTranslationLine(
          { uk: configForHeader.subInstructions, en: configForHeader.subInstructionsEn },
          lang,
          { uk: instructionDefaults?.subInstruction ?? "", en: DEFAULT_TRANSLATION_EN[entry.taskType as TaskTypeKey] }
        )}
      />
      {exerciseNode}
    </>
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
  const { isItems, isWhole, isInteractive, isDone, remaining } = errorReviewFlags(entry);

  return (
    <div className="rounded-lg border-[1.5px] dark:border-[1.5px] glass-gold-edge bg-white glass-card-shadow error-review-card-shadow dark:border-[var(--card-border)] dark:bg-[var(--error-review-card-bg)]">
      <div className={`error-review-row flex flex-wrap items-center gap-3 p-3 ${isDone ? "opacity-60" : ""}`}>
        <span className="item-number-badge" aria-hidden>
          {index + 1}
        </span>
        <TaskTypeIconBadge type={entry.taskType} size="sm" />
        <div className="error-review-text-col min-w-0 flex-1">
          <p
            className="error-review-title truncate font-heading font-medium"
            // title-атрибут (hover/truncated-текст) дзеркалить ВІДОБРАЖЕНУ
            // назву (ніколи сирий entry.title — студент не повинен бачити
            // автогенерований tasks.title з "хвостом" навіть на hover).
            title={`${entry.displayTitle}${ordinal !== null ? ` · ${ordinal}` : ""}`}
          >
            {entry.displayTitle}
            {ordinal !== null && ` · ${ordinal}`}
          </p>
          {!isInteractive && entry.summary && (
            <p className="error-review-subtitle truncate text-sm text-[var(--text-muted-caption)] dark:text-[var(--card-ink-2)]">{entry.summary}</p>
          )}
          {isInteractive && (
            <p className="error-review-subtitle text-sm text-[var(--text-muted-caption)] dark:text-[var(--card-ink-2)]">
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
          <ErrorReviewPractice entry={entry} />
        </div>
      )}
    </div>
  );
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Сцена-вигляд ВІДКРИТОЇ задачі (openMode="scene", ErrorReviewBlock нижче)
// — та сама вправа (ErrorReviewPractice), але з plaqueText (назва типу у
// плашці, як на сторінці сцени) і БЕЗ картки-списку навколо (викликач
// ховає список цілком, доки щось відкрито). Завдання "done" — лише банер
// (та сама розмітка, що в ErrorReviewCard), без плашки: вправа з
// onlyItemIds:[] (усе вже виправлено) не монтується взагалі, щоб не
// годувати 15 різних компонентів порожнім списком елементів.
function ErrorReviewOpenedTask({ entry, snapshotIds }: { entry: ErrorReviewEntryData; snapshotIds: string[] }) {
  const { t } = useT();
  const { isDone } = errorReviewFlags(entry);

  if (isDone) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <Check size={16} aria-hidden />
        {t("errReview.allFixedBanner")}
      </div>
    );
  }

  return <ErrorReviewPractice entry={entry} plaqueText={entry.displayTitle} snapshotIds={snapshotIds} />;
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
  initialExpandedTaskId,
  openMode,
}: {
  entries: ErrorReviewEntryData[];
  emptyState: ErrorReviewEmptyState;
  // Прийшли з /cabinet/mistakes ("Виправити") через ?fix=<taskId> — картка
  // цього taskId розгортається вже на першому рендері, без додаткового
  // кліку. null/undefined/taskId, якого немає серед entries, — звичайна
  // поведінка (нічого не розгорнуто).
  initialExpandedTaskId?: string | null;
  // "scene" — мистейки-сторінка (/cabinet/mistakes/[sceneId]): коли
  // якась задача відкрита (expandedTaskId), список ховається ЦІЛКОМ і
  // замінюється сцена-виглядом ЦІЄЇ задачі (плашка типу + біла панель,
  // ErrorReviewOpenedTask) із бек-лінком над панеллю — замість інлайн-
  // розгортання картки (яке лишається для undefined/дефолту нижче). Сама
  // панель (GlassBlock+EXERCISE_STACK) тепер рендериться ЦИМ компонентом
  // (а не викликачем) для ОБОХ станів ("scene"), щоб список і відкрита
  // задача мали рівно ОДНУ панель, без вкладеності. undefined (сценова
  // сторінка, error_correction-задача) — жодних змін, той самий інлайн-
  // вигляд і БЕЗ власної GlassBlock-обгортки (сценова сторінка обгортає
  // сама, scenes/[sceneId]/page.tsx).
  openMode?: "scene";
}) {
  const { t, lang } = useT();
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(initialExpandedTaskId ?? null);
  // Чипи-перемикач вправ (openMode="scene", мистейки-сторінка, редизайн
  // навігації) — ПОРЯДОК чипів захоплюється ОДИН раз на монтуванні (той
  // самий принцип, що snapshot нижче для remainingItemIds): entries, що
  // приходять router.refresh()-ом пізніше, можуть втратити задачу
  // (повністю виправлена, зникла з live-списку) — номер/позиція чипа від
  // цього не зсувається, лише його СТАТУС (deriveMistakesChips,
  // error-review.ts, рахує зі свіжих entries щоразу під час рендеру).
  const [capturedTaskOrder] = useState<string[]>(() => entries.map((e) => e.taskId));
  const activeChipRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeChipRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [expandedTaskId]);

  // Знімок помилок "на момент відкриття задачі" (openMode="scene", крок 4
  // — стабільне членство блоку) — "запам'ятай інформацію з попереднього
  // рендеру" (React-паттерн, той самий, що lastHintText у task-panel-
  // header.tsx): prevExpandedTaskId ловить КОЖЕН перехід expandedTaskId
  // (null→A, A→null, A→null→A знову), а не лише "інший taskId" — інакше
  // повторне відкриття ТІЄЇ Ж задачі після повернення до списку не взяло
  // би новий знімок (вимога "reset при поверненні до списку і повторному
  // відкритті"). Залежить лише від entries/expandedTaskId у момент самого
  // переходу — router.refresh() (що й далі оновлює entries.remainingItemIds
  // живцем) НЕ перетирає вже взятий знімок, бо prevExpandedTaskId вже
  // дорівнює expandedTaskId й умова більше не спрацьовує.
  const [snapshot, setSnapshot] = useState<{ taskId: string; ids: string[] } | null>(null);
  const [prevExpandedTaskId, setPrevExpandedTaskId] = useState<string | null>(expandedTaskId);
  if (expandedTaskId !== prevExpandedTaskId) {
    setPrevExpandedTaskId(expandedTaskId);
    if (expandedTaskId) {
      const freshEntry = entries.find((e) => e.taskId === expandedTaskId);
      setSnapshot({ taskId: expandedTaskId, ids: freshEntry ? [...freshEntry.remainingItemIds] : [] });
    }
  }

  const listContent = (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-heading text-lg font-semibold max-[640px]:leading-[1.3]">{frenchNbsp("Corrigez vos erreurs.")}</h3>
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

  if (openMode === "scene") {
    const openEntry = expandedTaskId ? entries.find((e) => e.taskId === expandedTaskId) ?? null : null;

    if (openEntry) {
      // Редизайн навігації (мистейки-сторінка) — чипи-перемикач замінюють
      // старий круглий бек-лінк "До списку вправ". Перший чип ("Усі
      // вправи") повертає до списку — та сама дія, що старий бек-лінк
      // мав. Наступні чипи — по одному на capturedTaskOrder (стабільний
      // порядок, захоплений на монтуванні), статус deriveMistakesChips
      // зі свіжих entries. Клік на "unfixed" чип напряму перемикає
      // expandedTaskId на ІНШИЙ taskId (не через null) — та сама умова
      // "expandedTaskId !== prevExpandedTaskId" (нижче, вище в цьому
      // файлі) вже бере НОВИЙ знімок remainingItemIds для щойно обраної
      // задачі на цьому самому переході, без додаткового коду.
      function scrollToExerciseTop() {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      }
      function handleSelectChip(taskId: string) {
        setExpandedTaskId(taskId);
        scrollToExerciseTop();
      }
      function handleBackToList() {
        setExpandedTaskId(null);
        scrollToExerciseTop();
      }
      const chips = deriveMistakesChips(capturedTaskOrder, entries, openEntry.taskId);
      const entryByTaskId = new Map(entries.map((e) => [e.taskId, e]));
      const remainingCount = entries.filter((e) => e.status !== "done").length;
      const remainingWord =
        lang === "uk"
          ? pluralizeExercisesNominative(remainingCount)
          : plural(lang, remainingCount, lang === "fr" ? { one: "exercice", other: "exercices" } : { one: "exercise", other: "exercises" });
      return (
        <>
          <p className="mistakes-chip-remaining">
            {t("cabinet.mistakes.scene.remainingExercises", { n: remainingCount, word: remainingWord })}
          </p>
          <div className="mistakes-chip-row-wrap">
            <div
              className="mistakes-chip-row"
              tabIndex={0}
              aria-label={t("cabinet.mistakes.scene.exerciseChipsRowAria")}
            >
              <button type="button" onClick={handleBackToList} className="mistakes-chip mistakes-chip--all">
                <List size={14} aria-hidden="true" />
                {t("cabinet.mistakes.scene.allExercises")}
              </button>
              {chips.map((chip) => {
                const chipEntry = entryByTaskId.get(chip.taskId);
                const fullName = chipEntry?.displayTitle ?? "";
                const ariaLabel = t("cabinet.mistakes.scene.exerciseChipLabel", { n: chip.index, name: fullName });
                if (chip.status === "fixed") {
                  return (
                    <button
                      key={chip.taskId}
                      type="button"
                      aria-disabled="true"
                      title={fullName}
                      aria-label={ariaLabel}
                      className="mistakes-chip mistakes-chip--fixed"
                    >
                      <Check size={12} aria-hidden="true" />
                      {chip.index}
                    </button>
                  );
                }
                const isCurrent = chip.status === "current";
                return (
                  <button
                    key={chip.taskId}
                    ref={isCurrent ? activeChipRef : undefined}
                    type="button"
                    onClick={() => handleSelectChip(chip.taskId)}
                    title={fullName}
                    aria-label={ariaLabel}
                    aria-current={isCurrent ? "true" : undefined}
                    className={`mistakes-chip ${isCurrent ? "mistakes-chip--current" : "mistakes-chip--unfixed"}`}
                  >
                    {isCurrent ? `${chip.index} · ${truncateChipLabel(fullName)}` : chip.index}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mistakes-scene-panel-gap">
            <GlassBlock>
              <div className={EXERCISE_STACK}>
                <ErrorReviewOpenedTask
                  entry={openEntry}
                  snapshotIds={snapshot?.taskId === openEntry.taskId ? snapshot.ids : openEntry.remainingItemIds}
                />
              </div>
            </GlassBlock>
          </div>
        </>
      );
    }

    return (
      <GlassBlock>
        <div className={EXERCISE_STACK}>{listContent}</div>
      </GlassBlock>
    );
  }

  return listContent;
}
