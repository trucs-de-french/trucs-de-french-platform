"use client";

import { type ReactNode } from "react";
import { Eye } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { dotsFilledCount, type PracticeAttemptFooterState } from "@/lib/exercises/error-review";

// Задача "unify attempt/status footer" — ОДИН спільний компонент для
// рядка-статусу практики (крапки спроб + "Не вдалося · спроба N" +
// компактна пілюля "Відповідь"), раніше продубльований інлайн у кожному
// з 15 типів (деякі — з власним форматом "Спроб: N" червоним текстом,
// власним розміром/місцем пілюлі). Той самий .practice-attempt-footer/
// .practice-attempt-dots/.practice-attempt-dot/.practice-attempt-label/
// .practice-reveal-pill (globals.css), що вже був у letter_gaps/
// letter_rearrangement/table_fill — лише тепер ОДНЕ місце в коді, а не
// N копій однакового JSX.
//
// state — practiceAttemptFooterState(isCorrect, itemRevealed)
// (error-review.ts), рахується ВИКЛИКАЧЕМ (кожен тип сам знає свої
// isCorrect/itemRevealed), не тут:
// - "idle"/"correct" без correctLabel — нічого (картка сама показує
//   правильність кольором; letter_gaps/letter_rearrangement/
//   table_fill сцена-вигляд).
// - "correct" із correctLabel — зелений рядок (та сама верстка, що вже
//   була в table_fill/image_match/multiple_choice/drag_drop/
//   word_choice/true_false, text-green-600, БЕЗ розділової лінії
//   footer — цей рядок завжди лишався самостійним <p>, не частиною
//   .practice-attempt-footer).
// - "failed" — крапки+текст+пілюля (чи лише крапки+текст, якщо
//   onReveal не передано — сцена-вигляд letter_gaps/
//   letter_rearrangement/table_fill: там відповідь розкриває зовнішня
//   панель "Правильні відповіді", не ця пілюля).
// - "revealed" — children (розкрита відповідь), розмітка різна на тип
//   (просте слово/пара/речення-з-підсвіченим-словом), тож лишається на
//   відповідальності викликача, передається як children.
export function PracticeAttemptFooter({
  state,
  failedAttempts,
  onReveal,
  revealDisabled,
  correctLabel,
  children,
}: {
  state: PracticeAttemptFooterState;
  failedAttempts: number;
  onReveal?: () => void;
  revealDisabled?: boolean;
  correctLabel?: string;
  children?: ReactNode;
}) {
  const { t } = useT();

  if (state === "correct") {
    return correctLabel ? (
      <p className="text-xs font-medium text-green-600 dark:text-green-400">{correctLabel}</p>
    ) : null;
  }

  if (state === "revealed") {
    return children ? <>{children}</> : null;
  }

  if (state !== "failed") return null;

  return (
    <div className="practice-attempt-footer">
      <span className="practice-attempt-dots" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`practice-attempt-dot ${i < dotsFilledCount(failedAttempts) ? "practice-attempt-dot--filled" : ""}`}
          />
        ))}
      </span>
      <span className="practice-attempt-label">{t("status.failedAttemptShort", { n: failedAttempts })}</span>
      {onReveal && (
        <button
          type="button"
          onClick={onReveal}
          disabled={!!revealDisabled}
          aria-label={t("button.showAnswer")}
          className="practice-reveal-pill"
        >
          <Eye size={16} aria-hidden="true" />
          {t("button.answerShort")}
        </button>
      )}
    </div>
  );
}
