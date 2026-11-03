"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/context";

// Дошка "ліва/права колонка + сполучні крапки/лінії" для matching.tsx —
// три місця використання (≤10 елементів, блок >10, практика) ділять цей
// компонент, щоб вигляд/координати крапок рахувались в одному місці.
// Мех pairs/selectedLeft/onClick* повністю лишається на викликачі — тут
// лише верстка карток і SVG-лінії, що читають уже готовий стан.
export type PairDotState = "default" | "selected" | "paired" | "correct" | "incorrect";

type Rect = { x: number; y: number };

const PAIR_COLOR_COUNT = 5;
// ЕТАП V — на мобільному (max-width:640px, globals.css) крапка сидить не
// на краю картки, а в розширеному гутері: 4px зазор від краю колонки +
// половина 16px крапки = 12px офсет від реального r.right/r.left картки.
// На десктопі офсет 0 — крапка лишається рівно на краю картки, як було.
const MOBILE_GUTTER_DOT_OFFSET = 12;

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
  const { t, lang } = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef(new Map<string, HTMLButtonElement>());
  const rightRefs = useRef(new Map<string, HTMLButtonElement>());
  const [leftDots, setLeftDots] = useState<Map<string, Rect>>(new Map());
  const [rightDots, setRightDots] = useState<Map<string, Rect>>(new Map());

  // ЕТАП V — чи зараз мобільна розкладка (max-width:640px, той самий
  // breakpoint, що globals.css): визначає лише X-офсет крапки/лінії нижче
  // (гутер на мобільному ширший і крапка стоїть у ньому, не на краю
  // картки) — та сама умова, що вже використовує use-working-tile-layout.ts
  // для своєї розкладки (matchMedia + addEventListener("change", ...)).
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Індекс пари за порядком появи в pairs — визначає, який з 5 кольорів
  // (matching-pair-0..4, globals.css) дістається картці/крапці/лінії ДО
  // перевірки (мобільний дизайн, ЕТАП V); після "check" колір пари не
  // використовується — стан переходить у correct/incorrect зі своїм
  // кольором, який уже існував.
  const pairColorIndex = useMemo(() => {
    const map = new Map<string, number>();
    Object.keys(pairs).forEach((left, i) => map.set(left, i));
    return map;
  }, [pairs]);

  // Координати крапок рахуються з реальних getBoundingClientRect (не зі
  // стилів/відступів) — єдиний спосіб лишитись приклеєним до картки, коли
  // текст переноситься, висота рядка змінюється чи вікно змінює розмір.
  useLayoutEffect(() => {
    function recompute() {
      const container = containerRef.current;
      if (!container) return;
      const cRect = container.getBoundingClientRect();
      const dotOffset = isMobile ? MOBILE_GUTTER_DOT_OFFSET : 0;
      const nextLeft = new Map<string, Rect>();
      for (const [left, el] of leftRefs.current) {
        const r = el.getBoundingClientRect();
        nextLeft.set(left, { x: r.right - cRect.left + dotOffset, y: r.top + r.height / 2 - cRect.top });
      }
      const nextRight = new Map<string, Rect>();
      for (const [right, el] of rightRefs.current) {
        const r = el.getBoundingClientRect();
        nextRight.set(right, { x: r.left - cRect.left - dotOffset, y: r.top + r.height / 2 - cRect.top });
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
  }, [leftItems, rightItems, pairs, selectedLeft, isMobile]);

  function dotStateForLeft(left: string): PairDotState {
    const status = statusForLeft(left);
    if (status) return status;
    if (selectedLeft === left) return "selected";
    if (pairs[left]) return "paired";
    return "default";
  }

  // Колір рамки/крапки/лінії — не єдиний сигнал правильності: коли пара вже
  // перевірена, картка отримує aria-label "{слово}: Правильно/Неправильно"
  // (перекриває звичайне ім'я кнопки з текстового вмісту) для скрінрідерів,
  // текст картки лишається видимим лише як "{слово}" (без зайвого напису).
  function ariaLabelForState(word: string, state: PairDotState): string | undefined {
    if (state === "correct") return t("matchingBoard.stateCorrect", { word });
    if (state === "incorrect") return t("matchingBoard.stateIncorrect", { word });
    return undefined;
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
    const segments: { key: string; d: string; state: PairDotState; pairIdx: number }[] = [];
    for (const [left, right] of Object.entries(pairs)) {
      const start = leftDots.get(left);
      const end = rightDots.get(right);
      if (!start || !end) continue;
      const dx = (end.x - start.x) / 2;
      segments.push({
        key: `${left}__${right}`,
        d: `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`,
        state: statusForLeft(left) ?? "paired",
        pairIdx: pairColorIndex.get(left) ?? 0,
      });
    }
    return segments;
  }, [pairs, leftDots, rightDots, statusForLeft, pairColorIndex]);

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
        {lines.map((l) => {
          const pairColored = isMobile && l.state === "paired";
          const cls = pairColored
            ? `matching-line matching-line--pair matching-pair-${l.pairIdx % PAIR_COLOR_COUNT}`
            : `matching-line matching-line--${l.state}`;
          return <path key={l.key} d={l.d} className={cls} />;
        })}
        {stub && <path d={stub} className="matching-line-stub" />}
      </svg>

      <div className="matching-columns">
        <div className="matching-column">
          {leftItems.map((left) => {
            const state = dotStateForLeft(left);
            const pairIdx = pairColorIndex.get(left);
            const pairColored = isMobile && state === "paired" && pairIdx !== undefined;
            const pairClass = pairColored ? `matching-pair-${pairIdx % PAIR_COLOR_COUNT} matching-card--pair` : "";
            const dotPairClass = pairColored
              ? `matching-pair-${pairIdx % PAIR_COLOR_COUNT} matching-dot--pair`
              : "";
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
                aria-label={ariaLabelForState(left, state)}
                lang="fr"
                className={`matching-card matching-card--fr matching-card--${state} ${pairClass} min-w-0 chip-text-fit`}
              >
                {left}
                {renderLeftExtra?.(left)}
                <span
                  className={`matching-dot matching-dot--left matching-dot--${state} ${dotPairClass}`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>

        <div className="matching-column">
          {rightItems.map((right) => {
            const state = dotStateForRight(right);
            const pairedLeft = Object.entries(pairs).find(([, r]) => r === right)?.[0];
            const pairIdx = pairedLeft ? pairColorIndex.get(pairedLeft) : undefined;
            const pairColored = isMobile && state === "paired" && pairIdx !== undefined;
            const pairClass = pairColored ? `matching-pair-${pairIdx % PAIR_COLOR_COUNT} matching-card--pair` : "";
            const dotPairClass = pairColored
              ? `matching-pair-${pairIdx % PAIR_COLOR_COUNT} matching-dot--pair`
              : "";
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
                aria-label={ariaLabelForState(right, state)}
                lang={lang}
                className={`matching-card matching-card--uk ${pairClass} min-w-0 chip-text-fit ${
                  usedRights.has(right) ? "opacity-50" : ""
                }`}
              >
                {right}
                <span
                  className={`matching-dot matching-dot--right matching-dot--${state} ${dotPairClass}`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
