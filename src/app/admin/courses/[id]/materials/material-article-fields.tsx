"use client";

import { useState } from "react";
import { RichArticleEditor } from "@/components/rich-article-editor";
import type { CalloutStyle } from "@/lib/exercises/types";
import { LABEL_TEXT } from "@/lib/typography-styles";

const STYLE_OPTIONS: { value: CalloutStyle; label: string; icon: string; className: string }[] = [
  { value: "none", label: "Без виділення", icon: "▪️", className: "border-neutral-300 dark:border-neutral-700" },
  { value: "info", label: "Інфо", icon: "ℹ️", className: "border-blue-400 dark:border-blue-700" },
  { value: "tip", label: "Порада", icon: "💡", className: "border-yellow-400 dark:border-yellow-700" },
  { value: "warning", label: "Увага", icon: "⚠️", className: "border-red-400 dark:border-red-700" },
  { value: "success", label: "Успіх", icon: "✅", className: "border-green-400 dark:border-green-700" },
  { value: "special", label: "Особливий", icon: "✨", className: "border-purple-400 dark:border-purple-700" },
];

export function MaterialArticleFields({
  initialContent,
  initialStyle,
}: {
  initialContent?: string | null;
  initialStyle?: CalloutStyle | null;
}) {
  const [style, setStyle] = useState<CalloutStyle>(initialStyle ?? "none");

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="style" value={style} readOnly />

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Стиль блоку</label>
        <div className="flex flex-wrap gap-2">
          {STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStyle(opt.value)}
              className={`rounded-md border-2 px-2 py-1 text-xs ${opt.className} ${
                style === opt.value
                  ? "bg-neutral-100 font-medium dark:bg-neutral-800"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Текст статті (необов&apos;язково)</label>
        <RichArticleEditor name="content" initialContent={initialContent} minHeightClassName="min-h-48" />
      </div>
    </div>
  );
}
