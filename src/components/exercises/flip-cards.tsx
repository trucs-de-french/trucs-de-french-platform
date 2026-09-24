"use client";

import { useState, useRef, useEffect } from "react";
import type { FlipCard as FlipCardType, FlipCardsConfig } from "@/lib/exercises/types";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { InstructionsText } from "./instructions-text";
import { ANSWER_CARD_BASE, ANSWER_CARD_DEFAULT } from "./answer-card-style";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";

// variant "normal" — звичайний manual-режим (клікабельна, front/back).
// "highlighted" — рулетка зараз "пробігає" через цю картку (лише бордюр,
// не клікабельна — картка ще не обрана). "selected" — приземлились саме
// тут: збільшена, яскрава рамка, клікабельна, показує initialSide/
// протилежну. "dimmed" — решта сітки після приземлення: та сама сітка, не
// прихована повністю, лише притлумлена й неклікабельна.
function FlipCardTile({
  card,
  variant = "normal",
  initialSide = "front",
}: {
  card: FlipCardType;
  variant?: "normal" | "highlighted" | "selected" | "dimmed";
  initialSide?: "front" | "back";
}) {
  const [flipped, setFlipped] = useState(false);
  const clickable = variant === "normal" || variant === "selected";
  const shown = flipped ? oppositeSide(card, initialSide) : sideText(card, initialSide);

  const variantClass = {
    normal: ANSWER_CARD_DEFAULT,
    highlighted: SELECTED_OPTION_CLASS,
    selected: `${SELECTED_OPTION_CLASS} z-10 scale-105 shadow-lg`,
    dimmed: `${ANSWER_CARD_DEFAULT} opacity-30`,
  }[variant];

  return (
    <button
      type="button"
      onClick={clickable ? () => setFlipped((f) => !f) : undefined}
      disabled={!clickable}
      className={`flex flex-col items-center gap-2 text-base transition-all disabled:cursor-default ${ANSWER_CARD_BASE} ${variantClass}`}
    >
      <ImageOrPlaceholder
        src={card.image_url}
        alt=""
        className="h-24 w-full rounded object-cover"
      />
      {card.audio_url && (
        <audio
          controls
          src={card.audio_url}
          className="w-full"
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <span>{shown}</span>
      {clickable && (
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          {flipped ? "клік — назад" : "клік — перевернути"}
        </span>
      )}
    </button>
  );
}

const TICK_MS = 90;
const TOTAL_TICKS = 18;

// Wordwall Flip Tiles-стиль: "рулетка" крутиться по картках, зупиняється на
// заздалегідь обраній НЕВИКАЗАНІЙ картці, показує лише config.revealSide,
// клік відкриває іншу сторону. shownIndices — на всю сесію проходження
// (не персистить на сервер, це самоперевірка без балів) — коли пул
// вичерпано, найпростіший варіант: тихо починаємо новий цикл з усіх карток
// заново, без дизейблу/пояснень (дрил має лишатись безкінечним).
function RandomRevealFlipCards({
  cards,
  revealSide,
}: {
  cards: FlipCardType[];
  revealSide: "front" | "back";
}) {
  const [spinning, setSpinning] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null);
  const [shownIndices, setShownIndices] = useState<Set<number>>(new Set());
  // Зростає щоразу на новому спіні — частина key кожної плитки нижче, щоб
  // React перемонтовував їх на кожен раунд: без цього internal flipped-стан
  // конкретної плитки міг би "протекти" в наступний раунд, якщо рулетка
  // випадково знову зупиниться на тій самій картці після повного циклу.
  const [roundId, setRoundId] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function spin() {
    if (spinning) return;

    let pool = cards.map((_, i) => i).filter((i) => !shownIndices.has(i));
    let nextShown = shownIndices;
    if (pool.length === 0) {
      pool = cards.map((_, i) => i);
      nextShown = new Set();
    }
    const target = pool[Math.floor(Math.random() * pool.length)];

    setSpinning(true);
    setRevealedIndex(null);
    setRoundId((r) => r + 1);

    let tick = 0;
    let current = highlightIndex ?? 0;
    intervalRef.current = setInterval(() => {
      tick++;
      if (tick >= TOTAL_TICKS) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setHighlightIndex(target);
        setRevealedIndex(target);
        setShownIndices(new Set(nextShown).add(target));
        setSpinning(false);
        return;
      }
      current = (current + 1) % cards.length;
      setHighlightIndex(current);
    }, TICK_MS);
  }

  function variantFor(i: number): "normal" | "highlighted" | "selected" | "dimmed" {
    if (revealedIndex === null) return spinning && highlightIndex === i ? "highlighted" : "normal";
    return revealedIndex === i ? "selected" : "dimmed";
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={spin}
        disabled={spinning}
        className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
      >
        {spinning ? "Крутимо..." : "Випадковий вибір"}
      </button>

      {/* Уся сітка завжди в DOM — обрана картка виділяється (scale+рамка),
          решта притлумлюється (opacity-30), а не зникає з розмітки. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cards.map((card, i) => (
          <FlipCardTile
            key={`${roundId}-${i}`}
            card={card}
            variant={variantFor(i)}
            initialSide={revealSide}
          />
        ))}
      </div>
    </div>
  );
}

function sideText(card: FlipCardType, side: "front" | "back"): string {
  return side === "front" ? card.front : card.back;
}

function oppositeSide(card: FlipCardType, side: "front" | "back"): string {
  return side === "front" ? card.back : card.front;
}

export function FlipCardsExercise({ config }: { config: FlipCardsConfig }) {
  if (config.cards.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        У цій вправі ще немає карток.
      </p>
    );
  }

  return (
    <div>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.flip_cards}
        subText={config.subInstructions}
        className="mb-2"
      />
      {config.mode === "random_reveal" ? (
        <RandomRevealFlipCards cards={config.cards} revealSide={config.revealSide ?? "front"} />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {config.cards.map((card, i) => (
            <FlipCardTile key={i} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}
