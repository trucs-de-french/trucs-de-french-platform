"use client";

import { useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import type { VocabItem, PartOfSpeech } from "@/lib/vocab";
import { firstVocabVariant, groupVocabByPartOfSpeech } from "@/lib/vocab";
import {
  PART_OF_SPEECH_ORDER,
  PART_OF_SPEECH_LABELS_FR,
  PART_OF_SPEECH_COLORS,
} from "@/lib/vocab-categories";
import { STUDENT_TOGGLE_HEADER_BUTTON, BUTTON_SECONDARY } from "@/lib/button-styles";
import { STUDENT_SECTION_HEADING } from "@/lib/typography-styles";
import { H2_TO_CONTENT } from "@/lib/spacing";

// Компактна легенда колір→категорія — над списком груп, щоб орієнтуватись,
// не гортаючи до заголовка потрібної групи. Розмір/шрифт/колір назви — на
// ВНУТРІШНЬОМУ span із текстом, а не на цьому контейнері. БЕЗ overflow-x-auto/
// overflow-hidden узагалі — не влазить у рядок на вузькому екрані -> просто
// переноситься на наступний (flex-wrap), жодної прокрутки.
function Legend() {
  return (
    <div className="flex flex-wrap justify-start gap-x-2.5 gap-y-1">
      {PART_OF_SPEECH_ORDER.map((pos) => (
        <span key={pos} className="inline-flex items-center gap-1 whitespace-nowrap">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PART_OF_SPEECH_COLORS[pos].dot}`} aria-hidden />
          <span className="font-body text-xs text-neutral-500 dark:text-neutral-400">
            {PART_OF_SPEECH_LABELS_FR[pos]}
          </span>
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
        {dotClass && <span className={`h-3 w-3 shrink-0 rounded-full ${dotClass}`} aria-hidden />}
        <h3 className="font-heading text-lg font-bold text-neutral-700 dark:text-neutral-300">{label}</h3>
      </div>
      {/* table-fixed + colgroup — та сама ширина першої колонки в УСІХ
          категоріях (не автоширина на кожну таблицю окремо), щоб колонка
          перекладу починалась на однаковій позиції, незалежно від довжини
          найдовшого слова саме в цій категорії. w-full (не max-w-md) —
          спільну ширину тепер задає обгортка списку нижче (max-w-3xl
          mx-auto), однакова для всіх таблиць. Довгі вирази (Phrases,
          Idiomes) переносяться всередині своєї колонки — стандартна
          поведінка table-fixed клітинки, не потрібен додатковий клас. */}
      <table className="mt-1 w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-2/5" />
          <col />
        </colgroup>
        <tbody>
          {items.map((v) => (
            <tr key={v.id ?? v.word} className="border-b border-gray-200 last:border-0 dark:border-neutral-700">
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
    <div>
      {/* Кнопка-тогл і посилання PDF — окремі елементи в одному ряду, НЕ
          вкладені одне в одне (button/a всередині іншого button — невалідний
          HTML і зламана доступність): тогл сам розміром під контент (без
          flex-1) — PDF стоїть одразу після заголовка, не притиснутий до
          правого краю. items-center — PDF (менша, py-1.5) вирівнюється по
          центру висоти тогла (py-2), не розтягується на всю висоту. Клік по
          PDF не спливає до тогла просто тому, що це сиблінги, а не вкладені
          елементи — жодного stopPropagation не треба. */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={STUDENT_TOGGLE_HEADER_BUTTON}
        >
          <ChevronDown
            size={18}
            className={`shrink-0 transition-transform ${collapsed ? "" : "rotate-180"}`}
          />
          <h2 className={STUDENT_SECTION_HEADING}>Вокабуляр</h2>
        </button>

        {/* Видима незалежно від collapsed — і тому, що завантаження PDF не
            вимагає розгорнутого списку, і тому, що инакше кнопка зникала б
            одразу після першого кліку на тогл. Текст ховається на вузьких
            екранах (sm:inline), лишається лише іконка + aria-label, щоб не
            розпирати рядок поруч із "ВОКАБУЛЯР". */}
        <a
          href={pdfHref}
          aria-label="Завантажити PDF"
          className={`inline-flex shrink-0 items-center gap-1.5 ${BUTTON_SECONDARY}`}
        >
          <Download size={16} className="shrink-0" aria-hidden />
          <span className="hidden sm:inline">Завантажити PDF</span>
        </a>
      </div>

      {!collapsed && (
        <>
          {/* Легенда — на всю ширину секції (не max-w-3xl mx-auto, як
              список слів нижче), по лівому краю на одній вертикалі із
              заголовком-тоглом "ВОКАБУЛЯР" вище. H2_TO_CONTENT — той самий
              відступ від заголовка, що й у Відео/Практика/Завдання. */}
          <div className={`${H2_TO_CONTENT} w-full`}>
            <Legend />
          </div>

          {/* Список категорій — ОДНА центрована колонка (max-w-3xl mx-auto,
              приблизно колишня ширина таблиці), не текст по центру (весь
              вміст усередині лишається вирівняним по лівому краю) — на
              мобільній ширині колонка природно займає всю ширину. */}
          <div className="mx-auto mt-4 flex w-full max-w-3xl flex-col gap-4">
            {groups.map((g) => (
              <VocabGroupTable key={g.partOfSpeech ?? "other"} partOfSpeech={g.partOfSpeech} items={g.items} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
