"use client";

import { HINT_TEXT } from "@/lib/typography-styles";

// Спільний checkbox для 6 *-fields.tsx (усі, крім letter_gaps — там артикль
// завжди лишається видимим, перемикача нема, STRIP_ARTICLES_DEFAULT.ts не
// має для нього запису) — значення читає й передає в buildConfigFromVocab
// (task-config-builder.ts, options.stripArticles) сам виклик importWords.
export function StripArticlesToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`flex w-fit cursor-pointer items-center gap-2 ${HINT_TEXT}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      Прибирати артиклі при імпорті (un, le, la, les, des, du, de la, l&apos;)
    </label>
  );
}
