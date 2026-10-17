"use client";

import { useId, useState, type ReactNode } from "react";
import { formatPoints } from "@/lib/exercises/format-points";

// Спільний блок результату (мокап "пілюля балів + статус-чіп + toggle") —
// замінює колишній рядок "Результат: N%" / "Правильно! ✓" + окрему пілюлю
// балів, що раніше копіювались у 19 файлах вправ. Дані (score/pointsEarned/
// pointsPossible/correct) лишаються тими самими GradeResult-полями, що й
// раніше — цей компонент лише інакше їх показує.
function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#f6dc8e" aria-hidden="true">
      <path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`task-result-toggle-chevron ${open ? "task-result-toggle-chevron--open" : ""}`}
    >
      <path d="M5 7.5 10 12.5 15 7.5" />
    </svg>
  );
}

function statusTone(correct: boolean, pointsEarned?: number, pointsPossible?: number) {
  if (pointsEarned !== undefined && pointsPossible !== undefined && pointsPossible > 0) {
    if (pointsEarned <= 0) return { tone: "error" as const, label: "Є помилки" };
    if (pointsEarned < pointsPossible) return { tone: "warn" as const, label: "Майже!" };
    return { tone: "success" as const, label: "Правильно! ✓" };
  }
  return correct
    ? { tone: "success" as const, label: "Правильно! ✓" }
    : { tone: "error" as const, label: "Є помилки" };
}

export function TaskResult({
  correct,
  pointsEarned,
  pointsPossible,
  children,
  toggleTitle,
  toggleCount,
  className,
}: {
  correct: boolean;
  pointsEarned?: number;
  pointsPossible?: number;
  children?: ReactNode;
  toggleTitle?: string;
  toggleCount?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { tone, label } = statusTone(correct, pointsEarned, pointsPossible);
  const showToggle = !!children && !correct;

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`.trim()}>
      <div className="task-result-row">
        {pointsPossible !== undefined && (
          <span className="task-result-points-pill">
            <StarIcon />
            {formatPoints(pointsEarned ?? 0, pointsPossible)}
          </span>
        )}
        <span className={`task-result-chip task-result-chip--${tone}`} role="status">
          {label}
        </span>
      </div>

      {showToggle && (
        <div className="task-result-card">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
            className="task-result-toggle-header"
          >
            <span className="task-result-toggle-title">
              <span className="task-result-toggle-title-main">{toggleTitle}</span>
              {toggleCount !== undefined && (
                <span className="task-result-toggle-title-sub">цього блоку · {toggleCount}</span>
              )}
            </span>
            <span className="task-result-toggle-action">
              {open ? "Сховати" : "Показати"}
              <ChevronIcon open={open} />
            </span>
          </button>
          {open && (
            <div id={panelId} className="task-result-toggle-panel">
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Рядок пар "Правильні пари" (matching.tsx) — єдиний тип, що сьогодні має
// змістовний block-result reveal (correctPairs), тож єдиний, що отримує
// плитки замість звичайного списку (решта типів — лише per-item practice-
// reveal, окрема фіча, не чіпається цією задачею).
function PairArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="task-result-pair-arrow"
    >
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

export function TaskResultPairRows({ pairs }: { pairs: { left: string; right: string }[] }) {
  return (
    <div className="task-result-pair-rows">
      {pairs.map((p, i) => (
        <div key={i} className="task-result-pair-row">
          <span className="task-result-pair-chip task-result-pair-chip--fr">{p.left}</span>
          <PairArrowIcon />
          <span className="task-result-pair-chip task-result-pair-chip--uk">{p.right}</span>
        </div>
      ))}
    </div>
  );
}

// Плитки "Правильні відповіді" (table-fill.tsx) — той самий принцип
// плитки, що TaskResultPairRows вище (однакові fr/uk чипи й стрілка), але з
// номером рядка зліва (та сама нумерація, що в самій таблиці) і без
// правильно/неправильно студента (таблиця вже це показує) — лише те, яка з
// двох клітинок була прихованою (answer), підсвічене зеленою рамкою/фоном.
function AnswerChip({
  side,
  value,
  isAnswer,
}: {
  side: "left" | "right";
  value: string;
  isAnswer: boolean;
}) {
  return (
    <span
      className={`task-result-pair-chip ${side === "left" ? "task-result-pair-chip--fr" : "task-result-pair-chip--uk"} ${
        isAnswer ? "task-result-answer-chip--emphasis" : ""
      }`}
    >
      {value}
    </span>
  );
}

export function TaskResultAnswerRows({
  rows,
}: {
  rows: { number: number; left: string; leftIsAnswer: boolean; right: string; rightIsAnswer: boolean }[];
}) {
  return (
    <div className="task-result-answer-grid">
      {rows.map((r) => (
        <div key={r.number} className="task-result-answer-row">
          <span className="task-result-answer-num" aria-hidden="true">
            {r.number}
          </span>
          <AnswerChip side="left" value={r.left} isAnswer={r.leftIsAnswer} />
          <PairArrowIcon />
          <AnswerChip side="right" value={r.right} isAnswer={r.rightIsAnswer} />
        </div>
      ))}
    </div>
  );
}

// Пілюля-рядок "0/1" замість колишнього тексту "0/1 бал" (п.6 задачі) —
// лише код-пара, без слова "бал": рядкам сітки/таблиці потрібна вузька
// пілюля, що ніколи не переносить рядок. earned/possible — вже готові
// рядки (викликач сам форматує, напр. checkbox-grid.tsx коми замість крапки
// для дробових часток) — компонент лише розфарбовує, не форматує числа.
export function RowScorePill({
  earned,
  possible,
  full,
}: {
  earned: string | number;
  possible: string | number;
  full: boolean;
}) {
  return (
    <span className={`task-result-row-pill ${full ? "task-result-row-pill--correct" : "task-result-row-pill--wrong"}`}>
      {earned}/{possible}
    </span>
  );
}
