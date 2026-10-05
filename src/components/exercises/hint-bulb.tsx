"use client";

import type { MouseEvent } from "react";
import { Check, Lightbulb } from "lucide-react";
import {
  LEGEND_BULB_BADGE_MD,
  LEGEND_BULB_BADGE_SM,
  LEGEND_BULB_BADGE_AMBER,
  LEGEND_BULB_BADGE_GREEN,
  LEGEND_BULB_BADGE_ON_IMAGE,
} from "./legend-tile-style";

export type HintBulbSize = "md" | "sm";
export type HintBulbState = "available" | "used" | "done";

// Єдиний вигляд лампочки-підказки в усіх студентських вправах — раніше
// кожна вправа мала власну іконку Lightbulb різного розміру й кольору,
// лише word_search/crossword вже використовували спільний круглий бейдж
// (legend-tile-style.ts). Тут один компонент розв'язує size+state у ці самі
// класи, щоб вигляд не розходився між вправами.
//
// Зона дотику (before:-inset-2) — на ВНУТРІШНЬОМУ span, не на самій
// <button>: якби position:relative сидів прямо на кнопці, він конфліктував
// би з position:absolute, який caller передає через className для кута
// картки (обидва — те саме CSS-property "position", результат залежить від
// порядку в згенерованому Tailwind CSS, не від порядку класів у рядку) і
// міг би зламати абсолютне позиціювання бейджа. Внутрішній span завжди сам
// собі контекст — не залежить від того, яку позицію caller дав кнопці.
export function HintBulb({
  size,
  state,
  as = "button",
  onClick,
  onMouseDown,
  disabled,
  label = "Підказка",
  overImage,
  stopPropagation,
  className = "",
}: {
  size: HintBulbSize;
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
}) {
  const sizeClass = size === "md" ? LEGEND_BULB_BADGE_MD : LEGEND_BULB_BADGE_SM;
  const colorClass = state === "done" ? LEGEND_BULB_BADGE_GREEN : LEGEND_BULB_BADGE_AMBER;
  const usedClass = state === "used" ? "opacity-60" : "";
  const ringClass = overImage ? LEGEND_BULB_BADGE_ON_IMAGE : "";
  const icon =
    state === "done" ? (
      <Check size={size === "md" ? 14 : 13} strokeWidth={3} aria-hidden />
    ) : (
      <Lightbulb size={size === "md" ? 15 : 13} aria-hidden />
    );

  if (as === "span") {
    return (
      <span aria-hidden className={`${sizeClass} ${colorClass} ${usedClass} ${ringClass} ${className}`}>
        {icon}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={onMouseDown}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        onClick?.();
      }}
      className={`${sizeClass} ${colorClass} ${usedClass} ${ringClass} hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 ${className}`}
    >
      <span className="relative flex h-full w-full items-center justify-center before:absolute before:-inset-2">
        {icon}
      </span>
    </button>
  );
}
