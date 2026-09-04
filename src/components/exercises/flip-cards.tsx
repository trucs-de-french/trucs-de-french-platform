"use client";

import { useState } from "react";
import type { FlipCard as FlipCardType } from "@/lib/exercises/types";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { InstructionsText } from "./instructions-text";

function FlipCardTile({ card }: { card: FlipCardType }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      className={`flex flex-col items-start gap-2 rounded-md border p-3 text-left text-sm ${
        flipped ? SELECTED_OPTION_CLASS : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
      }`}
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
      <span>{flipped ? card.back : card.front}</span>
      <span className="text-xs text-neutral-400 dark:text-neutral-500">
        {flipped ? "клік — назад" : "клік — перевернути"}
      </span>
    </button>
  );
}

export function FlipCardsExercise({
  config,
}: {
  config: { instructions?: string; subInstructions?: string; cards: FlipCardType[] };
}) {
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
        className="mb-2 font-medium"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {config.cards.map((card, i) => (
          <FlipCardTile key={i} card={card} />
        ))}
      </div>
    </div>
  );
}
