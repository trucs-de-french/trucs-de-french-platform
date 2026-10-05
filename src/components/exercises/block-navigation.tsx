"use client";

import type { ReactNode } from "react";
import { pluralizePoints } from "@/lib/pluralize-points";
import { STUDENT_BUTTON_SECONDARY_IDLE, STUDENT_BUTTON_SECONDARY_ACTIVE } from "@/lib/button-styles";
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

// Навігація по блоках великої вправи (>10 елементів: matching, letter_gaps,
// letter_rearrangement, table_fill — exercise-blocks.ts) — вкладки "Блок N"
// (вільне перемикання, ✓ на вже перевірених), лічильник "Блок X з N",
// ←Попередній/Наступний→, і підсумковий рядок "Загалом: ..." коли summary
// передано (типово — лише після перевірки ВСІХ блоків, рішення й
// обчислення "усі перевірені чи ні" — на боці кожного студентського
// компонента, не тут). children — вміст АКТИВНОГО блоку (ліва/права
// колонки matching, слова letter_gaps тощо), рендериться МІЖ верхньою
// вкладковою навігацією і нижньою ←/→ — той самий порядок, що був inline
// у matching.tsx до винесення.
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
  // Назва блоку (ЕТАП A/3, word-search.tsx/crossword.tsx) замість "Блок N"
  // на вкладці — опційно, елемент без значення (чи весь масив відсутній,
  // чи порожній рядок/undefined на цій позиції) лишається "Блок N", той
  // самий текст, що завжди був. truncate+title — довга назва не ламає
  // ряд вкладок (wrap лишається на батьківському flex-wrap), повний текст
  // доступний у title-атрибуті/тултипі.
  labels?: (string | undefined)[];
  children: ReactNode;
}) {
  return (
    <>
      {/* Той самий STUDENT_BUTTON_SECONDARY_* принцип, що перемикач
          швидкості аудіо (button-styles.ts): неактивна вкладка — нейтральна
          картка, активна — залита brand. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: blockCount }, (_, i) => {
            // customLabel відсутній (ні для цього типу вправи, ні саме на
            // цій позиції) — рівно ІСНУЮЧА розмітка без жодних додаткових
            // класів/атрибутів (byte-identical для matching/letter_gaps/
            // letter_rearrangement/table_fill, які labels не передають
            // узагалі, і для word_search/crossword без title у блоку).
            const customLabel = labels?.[i];
            return (
              <button
                key={i}
                type="button"
                onClick={() => onChangeBlock(i)}
                title={customLabel || undefined}
                className={`${customLabel ? "max-w-[10rem] truncate" : ""} ${
                  i === activeBlock ? STUDENT_BUTTON_SECONDARY_ACTIVE : STUDENT_BUTTON_SECONDARY_IDLE
                }`}
              >
                {customLabel || `Блок ${i + 1}`}
                {isBlockChecked(i) ? " ✓" : ""}
              </button>
            );
          })}
        </div>
        <span className={SCORE_LABEL_CLASS}>
          Блок {activeBlock + 1} з {blockCount}
        </span>
      </div>

      {children}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChangeBlock(activeBlock - 1)}
          disabled={activeBlock === 0}
          className={`${STUDENT_BUTTON_SECONDARY_IDLE} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          ← Попередній блок
        </button>
        <button
          type="button"
          onClick={() => onChangeBlock(activeBlock + 1)}
          disabled={activeBlock === blockCount - 1}
          className={`${STUDENT_BUTTON_SECONDARY_IDLE} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Наступний блок →
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
