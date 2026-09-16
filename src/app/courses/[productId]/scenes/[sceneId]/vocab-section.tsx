"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { VocabItem } from "@/lib/vocab";
import { firstVocabVariant } from "@/lib/vocab";

// Той самий тогл-патерн, що ScriptSection (script-section.tsx) — заголовок
// клікабельний, згорнуто за замовчуванням.
export function VocabSection({ vocab, pdfHref }: { vocab: VocabItem[]; pdfHref: string }) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-2 text-left"
      >
        <ChevronDown
          size={18}
          className={`shrink-0 text-neutral-500 transition-transform dark:text-neutral-400 ${
            collapsed ? "" : "rotate-180"
          }`}
        />
        <h2 className="text-lg font-medium">Вокабуляр</h2>
      </button>

      {!collapsed && (
        <>
          <a
            href={pdfHref}
            className="self-start rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Завантажити PDF
          </a>
          <table className="mt-2 w-full max-w-md border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-neutral-500 dark:text-neutral-400">
                <th className="py-1 pr-2 font-medium">Французька</th>
                <th className="py-1 font-medium">Переклад</th>
              </tr>
            </thead>
            <tbody>
              {vocab.map((v) => (
                <tr key={v.id ?? v.word} className="border-b last:border-0">
                  <td className="py-1 pr-2">{firstVocabVariant(v.word)}</td>
                  <td className="py-1">{v.translation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
