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

// Навігація по блоках великої вправи (>10 елементів: matching, letter_gaps,
// letter_rearrangement, table_fill, word_search, crossword та інші
// gradable-типи — exercise-blocks.ts) — сегментований прогрес-бар угорі
// (пряме перемикання кліком на сегмент, той самий onChangeBlock, що й
// раніше), ←/→ знизу. children — вміст АКТИВНОГО блоку (ліва/права колонки
// matching, слова letter_gaps тощо, або всі блоки одразу, приховані класом
// "hidden" — word_search/crossword), рендериться МІЖ прогрес-баром і
// нижнім рядком ←/→ — той самий порядок, що був і до рестайлу.
//
// Кнопка "Перевірити блок" НЕ рендериться тут — вона й сьогодні лишається
// всередині children (кожен виклик-сайт малює її сам, одразу при своєму
// контенті блоку): у word_search.tsx/crossword.tsx всі блоки змонтовані
// одночасно, кожен ЗІ СВОЄЮ власною кнопкою/станом (приховані лише class
// hidden, не умовним рендером — власний стан блоку не можна втрачати при
// перемиканні), тож єдиного "активного" button угорі БЕЗ структурної
// переробки цих двох типів вивести неможливо. Щоб не переробляти механіку
// двох типів вправ заради суто презентаційної задачі, кнопка лишається на
// місці й лише перефарбовується (className на кожному виклик-сайті) —
// найменша зміна, що дає новий вигляд рядка ←/→ знизу.
export function BlockNavigation({
  blockCount,
  activeBlock,
  onChangeBlock,
  isBlockChecked,
  summary,
  labels,
  children,
}: {
  blockCount: number;
  activeBlock: number;
  onChangeBlock: (index: number) => void;
  isBlockChecked: (index: number) => boolean;
  summary?: BlockNavigationSummary | null;
  // Назва блоку (ЕТАП A/3, word-search.tsx/crossword.tsx) — у новому
  // дизайні прогрес-заголовок завжди "Блок N з M" (однаковий текст для
  // всіх типів вправ, без винятків), тож custom-назва більше не
  // відображається візуально; лишається доступною лише в aria-label
  // сегмента (не губимо інформацію для читачів з скрінрідером).
  labels?: (string | undefined)[];
  children: ReactNode;
}) {
  // Один блок — навігація не рендериться взагалі (той самий принцип, що й
  // раніше: виклик-сайти й сьогодні обходять BlockNavigation для плоского
  // списку без блоків; цей захист — лише додаткова гарантія на рівні самого
  // компонента).
  if (blockCount <= 1) {
    return <>{children}</>;
  }

  const isFirst = activeBlock === 0;
  const isLast = activeBlock === blockCount - 1;
  // Вужчий проміжок між сегментами, коли їх багато (>8) — щоб вузький
  // телефонний екран не змушував сегменти звужуватись нижче комфортного
  // tap-розміру (min-width: 14px на самому сегменті, CSS).
  const segmentGap = blockCount > 8 ? 4 : 6;

  return (
    <>
      <div>
        <p className="exercise-block-progress-label">
          <span className="exercise-block-progress-current">Блок {activeBlock + 1}</span>
          <span className="exercise-block-progress-total"> з {blockCount}</span>
        </p>
        <div className="exercise-block-segments" style={{ gap: `${segmentGap}px` }}>
          {Array.from({ length: blockCount }, (_, i) => {
            const customLabel = labels?.[i];
            const baseLabel = customLabel ? `Блок ${i + 1}: ${customLabel}` : `Блок ${i + 1}`;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onChangeBlock(i)}
                aria-label={isBlockChecked(i) ? `${baseLabel}, перевірено` : baseLabel}
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
      </div>

      {children}

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
