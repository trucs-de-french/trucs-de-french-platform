"use client";

import { useState } from "react";

// PDF не показується студенту для category='general_tip' (там натомість
// вправи) — дизейблений <input> браузер сам не додає в FormData при
// сабміті, тож при збереженні з обраним general_tip file_url природно піде
// як null, без окремої серверної нормалізації для цього конкретного випадку.
export function MaterialCategoryFileFields({
  initialCategory,
  initialFileUrl,
}: {
  initialCategory?: string | null;
  initialFileUrl?: string | null;
}) {
  const [category, setCategory] = useState(initialCategory ?? "");
  const fileDisabled = category === "general_tip";

  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">Категорія</label>
        <select
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border px-2 py-1.5 text-sm"
        >
          <option value="">— Без категорії —</option>
          <option value="delf_guide">Рекомендації DELF (як здати іспит)</option>
          <option value="general_tip">Загальні рекомендації (типові помилки)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Посилання на PDF (URL, необов&apos;язково)
        </label>
        <input
          name="file_url"
          type="url"
          defaultValue={initialFileUrl ?? ""}
          disabled={fileDisabled}
          className={`rounded-md border px-2 py-1.5 text-sm ${
            fileDisabled ? "cursor-not-allowed opacity-50" : ""
          }`}
        />
        {fileDisabled && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            PDF не показується для категорії &quot;Загальні рекомендації&quot; — там натомість
            вправи.
          </p>
        )}
      </div>
    </>
  );
}
