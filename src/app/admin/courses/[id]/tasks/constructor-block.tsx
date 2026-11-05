"use client";

import type { ReactNode } from "react";

// Один із чотирьох кольорових блоків конструктора задачі (мокап
// "Конструктор завдання: 4 кольорові блоки") — спільна презентаційна
// обгортка: кольорова картка + заголовок (номер-гурток + назва + опис),
// без власного стану. Поля ВСЕРЕДИНІ (children) лишаються тими самими
// компонентами з тими самими name= — цей компонент лише розкладає вже
// готову розмітку в новий вигляд, нічого не читає й не пише в FormData.
export type ConstructorBlockTone = "basic" | "instruction" | "points" | "content";

const TONE_STYLES: Record<ConstructorBlockTone, { card: string; chip: string }> = {
  basic: {
    card: "bg-[#eceefd] border-[#cfd3f5] dark:bg-[rgba(91,86,230,0.12)] dark:border-[rgba(133,128,240,0.35)]",
    chip: "bg-[#4b46da] dark:bg-[#8683f0]",
  },
  instruction: {
    card: "bg-[#e6f5ea] border-[#bfe3c9] dark:bg-[rgba(47,155,87,0.12)] dark:border-[rgba(63,184,113,0.35)]",
    chip: "bg-[#2f9b57] dark:bg-[#3fb871]",
  },
  points: {
    card: "bg-[#fdf1d4] border-[#ecd9a0] dark:bg-[rgba(184,134,11,0.12)] dark:border-[rgba(224,170,62,0.35)]",
    chip: "bg-[#b8860b] dark:bg-[#e0aa3e]",
  },
  content: {
    card: "bg-[#e4f1fa] border-[#bcd8ec] dark:bg-[rgba(40,120,181,0.12)] dark:border-[rgba(78,168,224,0.35)]",
    chip: "bg-[#2878b5] dark:bg-[#4ea8e0]",
  },
};

export function ConstructorBlock({
  n,
  title,
  description,
  tone,
  children,
  className = "",
}: {
  n: 1 | 2 | 3 | 4;
  title: string;
  description: string;
  tone: ConstructorBlockTone;
  children: ReactNode;
  className?: string;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <section
      className={`flex flex-col gap-[18px] rounded-[20px] border-[1.5px] p-4 pt-6 sm:px-7 sm:pb-7 ${styles.card} ${className}`}
    >
      <header className="flex items-start gap-3">
        <span
          className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${styles.chip}`}
        >
          {n}
        </span>
        <div className="flex min-w-0 flex-col">
          <h3 className="font-heading text-[19px] font-bold leading-tight text-gray-800 dark:text-neutral-100">
            {title}
          </h3>
          <p className="font-body text-sm text-gray-600 dark:text-neutral-400">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

// Внутрішня біло-жовтувата підпанель блоку 3 ("Бали та підказки") —
// Пояснення до лампочки-підказки (HintLegendField) всередині неї.
export function ConstructorInnerPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-[#ecdcab] bg-[#fffaf0] py-[18px] px-5 dark:border-[rgba(243,217,139,0.28)] dark:bg-[var(--dark-surface-fill)] ${className}`}
    >
      {children}
    </div>
  );
}

// Картка окремого елемента вправи (слово, питання...) всередині блоку 4
// ("Варіанти вправи") — та сама біла картка з блакитнуватою рамкою для
// всіх типів, замінює дотепер різні (border-gray-100/neutral-700) рамки
// item-рядків.
export const CONSTRUCTOR_ITEM_CARD =
  "rounded-2xl border border-[#c7d6e6] bg-white dark:border-[rgba(255,255,255,0.14)] dark:bg-[rgba(255,255,255,0.04)]";
