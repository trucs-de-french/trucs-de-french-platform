"use client";

import type { ReactNode } from "react";
import { pluralizePoints } from "@/lib/pluralize-points";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";

// Спільний підсумок для рядка "Загалом" — навмисно НЕ повний GradeResult
// (той несе ще й detail, типізований по-різному для кожного gradable-типу,
// тут не потрібен): лише 4 поля, які реально показує рядок.
export type BlockNavigationSummary = {
  correct: boolean;
  score: number;
  pointsEarned?: number;
  pointsPossible?: number;
};

// Понад цю кількість блоків — сегменти (min-width: 14px кожен, CSS)
// перестають бути комфортними для пальця на вузькому екрані: прогрес-
// заголовок перемикається на один суцільний трек (BlockProgressHeader
// нижче), пряме перемикання лишається лише через ←/→.
const MANY_BLOCKS_THRESHOLD = 12;

function ChevronIcon({ direction, size }: { direction: "left" | "right"; size: number }) {
  const d = direction === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7 3.5 12.5 9 7 14.5";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

// Сама смужка прогресу (сегментований бар або, за великої кількості
// блоків, суцільний трек) — БЕЗ підпису "{label} N з M" (той текст тепер
// малює TaskPanelHeader, task-panel-header.tsx, у своєму рядку 1, зліва
// від цієї смужки, одним спільним заголовком зони над картками для
// ВСІХ типів вправ, не лише block-навігованих). Раніше ця смужка і
// підпис складали один компонент (BlockProgressHeader) з власним
// розміщенням прямо над {children} у BlockNavigation — тепер виклик-сайти
// самі розміщують TaskPanelHeader (із цим компонентом усередині) над усім
// блоком вправи, а BlockNavigation нижче лише складає children + футер.
export function BlockSegments({
  blockCount,
  activeBlock,
  onChangeBlock,
  isBlockChecked,
  labels,
  label = "Блок",
}: {
  blockCount: number;
  activeBlock: number;
  onChangeBlock: (index: number) => void;
  // Відсутній — жодна позиція не вважається "перевіреною" (flip-cards не
  // має оцінювання взагалі).
  isBlockChecked?: (index: number) => boolean;
  // Назва блоку (ЕТАП A/3, word-search.tsx/crossword.tsx) — лишається
  // доступною лише в aria-label сегмента (не губимо інформацію для
  // читачів з скрінрідером), візуально не відображається.
  labels?: (string | undefined)[];
  // "Блок" (типово, gradable-вправи) / "Сторінка" (flip-cards.tsx) — йде
  // лише в aria-valuetext/aria-label нижче, видимий підпис малює
  // TaskPanelHeader.
  label?: string;
}) {
  if (blockCount <= 1) return null;

  if (blockCount > MANY_BLOCKS_THRESHOLD) {
    const pct = ((activeBlock + 1) / blockCount) * 100;
    return (
      <div
        className="exercise-block-track"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={blockCount}
        aria-valuenow={activeBlock + 1}
        aria-valuetext={`${label} ${activeBlock + 1} з ${blockCount}`}
      >
        <div className="exercise-block-track-fill" style={{ width: `${pct}%` }} />
      </div>
    );
  }

  // Вужчий проміжок між сегментами, коли їх багато (>8) — щоб вузький
  // телефонний екран не змушував сегменти звужуватись нижче комфортного
  // tap-розміру (min-width: 14px на самому сегменті, CSS).
  const segmentGap = blockCount > 8 ? 4 : 6;

  return (
    <div className="exercise-block-segments" style={{ gap: `${segmentGap}px` }}>
      {Array.from({ length: blockCount }, (_, i) => {
        const customLabel = labels?.[i];
        const baseLabel = customLabel ? `${label} ${i + 1}: ${customLabel}` : `${label} ${i + 1}`;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChangeBlock(i)}
            aria-label={isBlockChecked?.(i) ? `${baseLabel}, перевірено` : baseLabel}
            aria-current={i === activeBlock ? "step" : undefined}
            className="exercise-block-segment"
          >
            <span
              className="exercise-block-segment-bar"
              style={{
                background: i <= activeBlock ? "linear-gradient(90deg, #5a55e6, #3b36c4)" : "#dcdbf3",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

// Нижній рядок ←/→ — без кнопки перевірки (вона лишається там, де
// малювалась і раніше, коментар у BlockNavigation нижче; flip-cards
// взагалі не оцінюється, тож кнопки перевірки там нема й не було).
export function BlockNavFooter({
  blockCount,
  activeBlock,
  onChangeBlock,
}: {
  blockCount: number;
  activeBlock: number;
  onChangeBlock: (index: number) => void;
}) {
  if (blockCount <= 1) return null;

  const isFirst = activeBlock === 0;
  const isLast = activeBlock === blockCount - 1;

  return (
    <div className="exercise-block-actions">
      <button
        type="button"
        onClick={() => onChangeBlock(activeBlock - 1)}
        disabled={isFirst}
        aria-label="Попередній блок"
        className="exercise-block-prev-btn"
      >
        <ChevronIcon direction="left" size={20} />
      </button>
      <button
        type="button"
        onClick={() => onChangeBlock(activeBlock + 1)}
        disabled={isLast}
        aria-label="Наступний блок"
        className="exercise-block-next-btn"
      >
        Далі
        <ChevronIcon direction="right" size={18} />
      </button>
    </div>
  );
}

// Навігація по блоках великої вправи (>10 елементів: matching, letter_gaps,
// letter_rearrangement, table_fill, word_search, crossword та інші
// gradable-типи — exercise-blocks.ts) — складає children + BlockNavFooter
// РАЗОМ в ОДНІЙ обгортці (div без власного flex/gap): виклик-сайт сидить
// усередині EXERCISE_STACK (flex flex-col gap-4 md:gap-6, spacing.ts) —
// якби ці дві частини були окремими дітьми ТІЄЇ Ж flex-обгортки, gap-4/
// gap-6 самого EXERCISE_STACK додавався б ПОВЕРХ margin-top самого футера
// (22px, CSS). Один спільний div без gap прибирає цей подвійний відступ.
// Прогрес-смужку (BlockSegments) більше НЕ малює цей компонент — виклик-
// сайт малює її сам усередині TaskPanelHeader (task-panel-header.tsx), НАД
// усім цим компонентом, разом із підписом "{label} N з M" і пілюлею балів.
//
// Кнопка "Перевірити блок" НЕ рендериться тут — вона й сьогодні лишається
// всередині children (кожен виклик-сайт малює її сам, одразу при своєму
// контенті блоку): у word_search.tsx/crossword.tsx всі блоки змонтовані
// одночасно, кожен ЗІ СВОЄЮ власною кнопкою/станом (приховані лише class
// hidden, не умовним рендером — власний стан блоку не можна втрачати при
// перемиканні), тож єдиного "активного" button угорі БЕЗ структурної
// переробки цих двох типів вивести неможливо. Щоб не переробляти механіку
// двох типів вправ заради суто презентаційної задачі, кнопка лишається на
// місці й лише перефарбовується (className на кожному виклик-сайті).
export function BlockNavigation({
  blockCount,
  activeBlock,
  onChangeBlock,
  summary,
  children,
}: {
  blockCount: number;
  activeBlock: number;
  onChangeBlock: (index: number) => void;
  summary?: BlockNavigationSummary | null;
  children: ReactNode;
}) {
  // Один блок — навігація не рендериться взагалі (той самий принцип, що й
  // раніше: виклик-сайти й сьогодні обходять BlockNavigation для плоского
  // списку без блоків; цей захист — лише додаткова гарантія на рівні самого
  // компонента).
  if (blockCount <= 1) {
    return <>{children}</>;
  }

  return (
    <>
      <div>
        {children}
        <BlockNavFooter blockCount={blockCount} activeBlock={activeBlock} onChangeBlock={onChangeBlock} />
      </div>

      {summary && (
        <p
          className={`${RESULT_MESSAGE_CLASS} ${
            summary.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          Загалом: {summary.correct ? "Правильно! ✓" : `${summary.score}%`}
          {summary.pointsPossible !== undefined && (
            <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
              ({summary.pointsEarned} з {summary.pointsPossible} {pluralizePoints(summary.pointsPossible)})
            </span>
          )}
        </p>
      )}
    </>
  );
}
