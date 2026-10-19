"use client";

import type { ReactNode } from "react";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { ImageZoomBadge } from "./image-zoom-badge";
import { ITEM_CARD_WRAP, POOL_CLASS, TILE_BASE } from "./answer-card-style";

// Спільна картка "питання + пул плиток-варіантів" — виділена з
// multiple-choice.tsx (renderItem, гілка без картинок) так, щоб listening.tsx
// міг мати ТОЙ САМИЙ вигляд картки/плитки без копіювання стилів (CARD_WRAP/
// POOL_CLASS/TILE_BASE тепер в answer-card-style.ts, цей компонент лише
// збирає їх у розмітку). Шапка картки (номер+текст+бали+підказка) лишається
// на викликачі — надто різна між multiple_choice (hint bulb, "N варіантів")
// і listening (без них), тож readyBuilt header передається як ReactNode.
export type ChoiceTileOption = {
  id: string;
  label: ReactNode;
  imageUrl?: string;
  onZoomImage?: () => void;
  selected: boolean;
  disabled: boolean;
  role: "radio" | "checkbox";
  tileClassName: string;
  indicatorClassName: string;
  indicatorContent?: ReactNode;
  onClick: () => void;
};

export function ChoiceQuestionCard({
  header,
  role,
  ariaLabelledBy,
  options,
  poolClassName = POOL_CLASS,
  resultAriaLabel,
}: {
  header: ReactNode;
  role: "radiogroup" | "group";
  ariaLabelledBy: string;
  options: ChoiceTileOption[];
  poolClassName?: string;
  // Коли пілюля балів рядка (RowScorePill) схована (рядок ≤1 бал), картка
  // отримує цей aria-label (role="group") на додачу до своїх плиток-
  // варіантів — той самий принцип, що matching-board.tsx; sighted-вміст
  // (питання, плитки) лишається незмінним, group лише дає читалці назву.
  resultAriaLabel?: string;
}) {
  return (
    <div className={ITEM_CARD_WRAP} role={resultAriaLabel ? "group" : undefined} aria-label={resultAriaLabel}>
      {header}
      <div role={role} aria-labelledby={ariaLabelledBy} className={poolClassName}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={o.onClick}
            disabled={o.disabled}
            role={o.role}
            aria-checked={o.selected}
            className={`${TILE_BASE} ${o.tileClassName}`}
          >
            <span
              aria-hidden
              className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${
                o.role === "checkbox" ? "rounded-[4px]" : "rounded-full"
              } ${o.indicatorClassName}`}
            >
              {o.indicatorContent}
            </span>
            {o.imageUrl && (
              <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md">
                <ImageOrPlaceholder src={o.imageUrl} alt="" className="h-full w-full object-cover" />
                {o.onZoomImage && (
                  <ImageZoomBadge
                    onOpen={o.onZoomImage}
                    boxClass="h-4 w-4 p-0 before:absolute before:-inset-2 before:content-['']"
                    iconSize={9}
                  />
                )}
              </span>
            )}
            <span className="min-w-0 flex-1 break-words">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
