"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { VocabItem, PartOfSpeech } from "@/lib/vocab";
import {
  firstVocabVariant,
  groupVocabByPartOfSpeech,
  PART_OF_SPEECH_ORDER,
  PART_OF_SPEECH_LABELS_FR,
  PART_OF_SPEECH_COLORS,
} from "@/lib/vocab";

// Компактна легенда колір→категорія — над списком груп, щоб орієнтуватись,
// не гортаючи до заголовка потрібної групи.
function Legend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
      {PART_OF_SPEECH_ORDER.map((pos) => (
        <span key={pos} className="inline-flex items-center gap-1">
          <span className={`h-2 w-2 shrink-0 rounded-full ${PART_OF_SPEECH_COLORS[pos].dot}`} aria-hidden />
          {PART_OF_SPEECH_LABELS_FR[pos]}
        </span>
      ))}
    </div>
  );
}

function VocabGroupTable({
  partOfSpeech,
  items,
}: {
  partOfSpeech: PartOfSpeech | null;
  items: VocabItem[];
}) {
  const dotClass = partOfSpeech ? PART_OF_SPEECH_COLORS[partOfSpeech].dot : null;
  const label = partOfSpeech ? PART_OF_SPEECH_LABELS_FR[partOfSpeech] : "Інше";

  return (
    <div>
      <div className="flex items-center gap-2">
        {dotClass && <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />}
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{label}</h3>
      </div>
      <table className="mt-1 w-full max-w-md border-collapse text-sm">
        <tbody>
          {items.map((v) => (
            <tr key={v.id ?? v.word} className="border-b last:border-0">
              <td className="py-1 pr-2">
                {dotClass && <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden />}
                {firstVocabVariant(v.word)}
              </td>
              <td className="py-1">{v.translation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Той самий тогл-патерн, що ScriptSection (script-section.tsx) — заголовок
// клікабельний, згорнуто за замовчуванням.
export function VocabSection({ vocab, pdfHref }: { vocab: VocabItem[]; pdfHref: string }) {
  const [collapsed, setCollapsed] = useState(true);
  const groups = groupVocabByPartOfSpeech(vocab);

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
          <Legend />
          <div className="mt-1 flex flex-col gap-4">
            {groups.map((g) => (
              <VocabGroupTable key={g.partOfSpeech ?? "other"} partOfSpeech={g.partOfSpeech} items={g.items} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
