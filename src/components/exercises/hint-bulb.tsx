"use client";

import type { MouseEvent } from "react";
import { Check, Lightbulb } from "lucide-react";
import { GOLD_CIRCLE_SIZE, GOLD_CIRCLE_HIT_AREA_PADDING, GOLD_CIRCLE_AVAILABLE, GOLD_CIRCLE_DONE, GOLD_CIRCLE_ON_IMAGE } from "./legend-tile-style";

export type HintBulbState = "available" | "used" | "done";

// Єдиний вигляд лампочки-підказки в усіх студентських вправах (ОДИН розмір,
// 28px золотий гурток — раніше розходилось на 26/22/28/18px між типами
// вправ, "legend"/"goldCircle" варіанти прибрані, лишився один вигляд).
// Зона дотику — padding навколо видимого гуртка на САМІЙ <button> (не
// position:relative + before:-inset-2 на внутрішньому span, як раніше):
// видима форма (28px) і тач-таргет (40px) більше не розділені різними
// елементами, простіше зберегти в синці з caller's absolute-позиціюванням
// (той caller сам керує position через className).
export function HintBulb({
  state,
  as = "button",
  onClick,
  onMouseDown,
  disabled,
  label = "Підказка",
  overImage,
  stopPropagation,
  className = "",
  ariaExpanded,
}: {
  state: HintBulbState;
  as?: "button" | "span";
  onClick?: () => void;
  // Прокидається як є (без обгортки stopPropagation/onClick вище) — лише
  // diacritics-popup.tsx (preventDefault, щоб клік не забирав фокус з
  // поля раніше onClick).
  onMouseDown?: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  label?: string;
  overImage?: boolean;
  stopPropagation?: boolean;
  className?: string;
  // Опційно — лише word_choice передає (розкрита/згорнута бульбашка
  // підказки); undefined для решти викликачів не рендерить атрибут
  // узагалі (React пропускає aria-* з undefined), їхня поведінка не
  // змінюється.
  ariaExpanded?: boolean;
}) {
  const colorClass = state === "done" ? GOLD_CIRCLE_DONE : GOLD_CIRCLE_AVAILABLE;
  const usedClass = state === "used" ? "opacity-60" : "";
  const ringClass = overImage ? GOLD_CIRCLE_ON_IMAGE : "";
  const icon =
    state === "done" ? (
      <Check size={14} strokeWidth={3} aria-hidden />
    ) : (
      <Lightbulb size={16} strokeWidth={2} aria-hidden />
    );

  if (as === "span") {
    return (
      <span aria-hidden className={`${GOLD_CIRCLE_SIZE} ${colorClass} ${ringClass} ${usedClass} ${className}`}>
        {icon}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={ariaExpanded}
      title={label}
      disabled={disabled}
      onMouseDown={onMouseDown}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        onClick?.();
      }}
      className={`${GOLD_CIRCLE_HIT_AREA_PADDING} ${usedClass} ${ringClass} flex shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      <span className={`${GOLD_CIRCLE_SIZE} ${colorClass}`}>{icon}</span>
    </button>
  );
}

// Єдиний бейдж "відповідь із підказкою" (мокап 3) — після перевірки, у
// куті елемента відповіді (поле/слот/клітинка/плитка/картка), замість
// розрізнених текстових маркерів кожного типу вправи ("(з підказкою)"
// амбер-курсивом, чипи word-search тощо). Суто декоративний (не кнопка,
// не HintBulb-варіант — той лишається інтерактивним контролом підказки
// до перевірки), позиціонування (.hint-used-badge, globals.css) — на
// викликачі лежить лише relative-обгортка без overflow:hidden.
export function HintUsedBadge({ halfPoints }: { halfPoints?: boolean }) {
  return (
    <span
      className="hint-used-badge"
      role="img"
      aria-label={halfPoints ? "Відповідь з підказкою, половина балів" : "Відповідь з підказкою"}
      title="Відповідь з підказкою"
    >
      <Lightbulb size={12} strokeWidth={2.5} aria-hidden />
    </span>
  );
}
