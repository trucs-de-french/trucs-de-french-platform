"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

// Дошка "ліва/права колонка + сполучні крапки/лінії" для matching.tsx —
// три місця використання (≤10 елементів, блок >10, практика) ділять цей
// компонент, щоб вигляд/координати крапок рахувались в одному місці.
// Мех pairs/selectedLeft/onClick* повністю лишається на викликачі — тут
// лише верстка карток і SVG-лінії, що читають уже готовий стан.
export type PairDotState = "default" | "selected" | "paired" | "correct" | "incorrect";

type Rect = { x: number; y: number };

export function MatchingBoard({
  leftItems,
  rightItems,
  pairs,
  selectedLeft,
  onClickLeft,
  onClickRight,
  disabled,
  statusForLeft,
  usedRights,
  renderLeftExtra,
}: {
  leftItems: string[];
  rightItems: string[];
  pairs: Record<string, string>;
  selectedLeft: string | null;
  onClickLeft: (left: string) => void;
  onClickRight: (right: string) => void;
  disabled: boolean;
  statusForLeft: (left: string) => "correct" | "incorrect" | undefined;
  usedRights: Set<string>;
  renderLeftExtra?: (left: string) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef(new Map<string, HTMLButtonElement>());
  const rightRefs = useRef(new Map<string, HTMLButtonElement>());
  const [leftDots, setLeftDots] = useState<Map<string, Rect>>(new Map());
  const [rightDots, setRightDots] = useState<Map<string, Rect>>(new Map());

  // Координати крапок рахуються з реальних getBoundingClientRect (не зі
  // стилів/відступів) — єдиний спосіб лишитись приклеєним до картки, коли
  // текст переноситься, висота рядка змінюється чи вікно змінює розмір.
  useLayoutEffect(() => {
    function recompute() {
      const container = containerRef.current;
      if (!container) return;
      const cRect = container.getBoundingClientRect();
      const nextLeft = new Map<string, Rect>();
      for (const [left, el] of leftRefs.current) {
        const r = el.getBoundingClientRect();
        nextLeft.set(left, { x: r.right - cRect.left, y: r.top + r.height / 2 - cRect.top });
      }
      const nextRight = new Map<string, Rect>();
      for (const [right, el] of rightRefs.current) {
        const r = el.getBoundingClientRect();
        nextRight.set(right, { x: r.left - cRect.left, y: r.top + r.height / 2 - cRect.top });
      }
      setLeftDots(nextLeft);
      setRightDots(nextRight);
    }

    recompute();
    const observer = new ResizeObserver(recompute);
    if (containerRef.current) observer.observe(containerRef.current);
    for (const el of leftRefs.current.values()) observer.observe(el);
    for (const el of rightRefs.current.values()) observer.observe(el);
    window.addEventListener("resize", recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [leftItems, rightItems, pairs, selectedLeft]);

  function dotStateForLeft(left: string): PairDotState {
    const status = statusForLeft(left);
    if (status) return status;
    if (selectedLeft === left) return "selected";
    if (pairs[left]) return "paired";
    return "default";
  }

  function dotStateForRight(right: string): PairDotState {
    const left = Object.entries(pairs).find(([, r]) => r === right)?.[0];
    if (left) {
      const status = statusForLeft(left);
      if (status) return status;
      return "paired";
    }
    return "default";
  }

  const lines = useMemo(() => {
    const segments: { key: string; d: string; state: PairDotState }[] = [];
    for (const [left, right] of Object.entries(pairs)) {
      const start = leftDots.get(left);
      const end = rightDots.get(right);
      if (!start || !end) continue;
      const dx = (end.x - start.x) / 2;
      segments.push({
        key: `${left}__${right}`,
        d: `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`,
        state: statusForLeft(left) ?? "paired",
      });
    }
    return segments;
  }, [pairs, leftDots, rightDots, statusForLeft]);

  const stub = useMemo(() => {
    if (!selectedLeft) return null;
    const start = leftDots.get(selectedLeft);
    if (!start) return null;
    const endX = start.x + 60;
    return `M ${start.x} ${start.y} L ${endX} ${start.y}`;
  }, [selectedLeft, leftDots]);

  return (
    <div ref={containerRef} className="matching-board">
      <svg className="matching-lines" aria-hidden="true">
        {lines.map((l) => (
          <path key={l.key} d={l.d} className={`matching-line matching-line--${l.state}`} />
        ))}
        {stub && <path d={stub} className="matching-line-stub" />}
      </svg>

      <div className="matching-columns">
        <div className="matching-column">
          {leftItems.map((left) => {
            const state = dotStateForLeft(left);
            return (
              <button
                key={left}
                type="button"
                ref={(el) => {
                  if (el) leftRefs.current.set(left, el);
                  else leftRefs.current.delete(left);
                }}
                onClick={() => onClickLeft(left)}
                disabled={disabled}
                className={`matching-card matching-card--fr matching-card--${state} min-w-0 break-words [overflow-wrap:anywhere]`}
              >
                {left}
                {renderLeftExtra?.(left)}
                <span className={`matching-dot matching-dot--left matching-dot--${state}`} aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <div className="matching-column">
          {rightItems.map((right) => {
            const state = dotStateForRight(right);
            return (
              <button
                key={right}
                type="button"
                ref={(el) => {
                  if (el) rightRefs.current.set(right, el);
                  else rightRefs.current.delete(right);
                }}
                onClick={() => onClickRight(right)}
                disabled={disabled}
                className={`matching-card matching-card--uk min-w-0 break-words [overflow-wrap:anywhere] ${
                  usedRights.has(right) ? "opacity-50" : ""
                }`}
              >
                {right}
                <span className={`matching-dot matching-dot--right matching-dot--${state}`} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
