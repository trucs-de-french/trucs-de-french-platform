"use client";

import { useState, type DragEvent } from "react";
import { GripVertical, Trash2, ArrowRight } from "lucide-react";
import type { VocabItem } from "@/lib/vocab";
import { FileUpload } from "@/components/file-upload";
import { BUTTON_SECONDARY } from "@/lib/button-styles";
import { INPUT_BORDER } from "@/lib/input-styles";

type Line = { speaker: string; text: string; vocab: VocabItem[] };

export function DialogueEditor({ initialDialogue }: { initialDialogue: Line[] }) {
  const [lines, setLines] = useState<Line[]>(initialDialogue);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function addLine() {
    setLines((prev) => [...prev, { speaker: "", text: "", vocab: [] }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: "speaker" | "text", value: string) {
    setLines((prev) => prev.map((line, idx) => (idx === i ? { ...line, [field]: value } : line)));
  }

  // Реплік не має власного id — це просто позиції в масиві, тож reorder за
  // індексом (swap), а не за ідентифікатором.
  function swapLines(i: number, j: number) {
    if (i === j) return;
    setLines((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function addVocab(i: number) {
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === i ? { ...line, vocab: [...line.vocab, { word: "", translation: "" }] } : line
      )
    );
  }

  function removeVocab(i: number, vi: number) {
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === i ? { ...line, vocab: line.vocab.filter((_, vidx) => vidx !== vi) } : line
      )
    );
  }

  function updateVocab(
    i: number,
    vi: number,
    field: "word" | "translation" | "image_url",
    value: string
  ) {
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === i
          ? {
              ...line,
              vocab: line.vocab.map((v, vidx) => (vidx === vi ? { ...v, [field]: value } : v)),
            }
          : line
      )
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="dialogue" value={JSON.stringify(lines)} readOnly />

      {lines.map((line, i) => (
        <div
          key={i}
          onDragOver={(e: DragEvent) => e.preventDefault()}
          onDragEnter={(e: DragEvent) => {
            e.preventDefault();
            setDragOverIndex(i);
          }}
          onDragLeave={() => setDragOverIndex((prev) => (prev === i ? null : prev))}
          onDrop={(e: DragEvent) => {
            e.preventDefault();
            setDragOverIndex(null);
            const from = Number(e.dataTransfer.getData("text/plain"));
            if (!Number.isNaN(from)) swapLines(from, i);
          }}
          className={`rounded-md border p-3 transition-colors ${
            dragOverIndex === i
              ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
              : "border-gray-100 dark:border-neutral-700"
          }`}
        >
          <div className="flex items-start gap-2">
            <span
              draggable
              onDragStart={(e: DragEvent) => e.dataTransfer.setData("text/plain", String(i))}
              className="mt-1.5 cursor-grab select-none text-neutral-400 active:cursor-grabbing dark:text-neutral-500"
              aria-hidden
            >
              <GripVertical size={16} />
            </span>
            <input
              placeholder="Спікер"
              value={line.speaker}
              onChange={(e) => updateLine(i, "speaker", e.target.value)}
              className={`${INPUT_BORDER} h-10 w-32 bg-slate-50 px-2 text-sm dark:bg-neutral-800/50`}
            />
            <textarea
              placeholder="Текст репліки"
              value={line.text}
              onChange={(e) => updateLine(i, "text", e.target.value)}
              rows={1}
              className={`${INPUT_BORDER} h-10 flex-1 px-2 text-sm font-content`}
            />
            <button
              type="button"
              onClick={() => removeLine(i)}
              aria-label="Видалити репліку"
              title="Видалити"
              className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="mt-2 flex flex-col gap-1 pl-2">
            {line.vocab.map((v, vi) => (
              <div key={vi} className="flex flex-col gap-1 rounded-md border border-transparent p-1">
                <div className="flex items-center gap-2">
                  <input
                    placeholder="Слово/фраза"
                    value={v.word}
                    onChange={(e) => updateVocab(i, vi, "word", e.target.value)}
                    className={`${INPUT_BORDER} w-40 px-2 py-2 text-sm font-content`}
                  />
                  <ArrowRight size={16} className="shrink-0 text-neutral-400 dark:text-neutral-500" />
                  <input
                    placeholder="Переклад"
                    value={v.translation}
                    onChange={(e) => updateVocab(i, vi, "translation", e.target.value)}
                    className={`${INPUT_BORDER} w-48 px-2 py-2 text-sm font-content`}
                  />
                  <button
                    type="button"
                    onClick={() => removeVocab(i, vi)}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    видалити
                  </button>
                </div>
                <input
                  placeholder="Посилання на картинку (необов'язково)"
                  value={v.image_url ?? ""}
                  onChange={(e) => updateVocab(i, vi, "image_url", e.target.value)}
                  className={`${INPUT_BORDER} ml-0 w-full max-w-md px-2 py-2 text-xs text-neutral-600 dark:text-neutral-400`}
                />
                <FileUpload
                  kind="image"
                  onUploaded={(url) => updateVocab(i, vi, "image_url", url)}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => addVocab(i)}
              className="mt-1 self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
            >
              + слово в лексику
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addLine}
        className={`self-start ${BUTTON_SECONDARY}`}
      >
        + Репліка
      </button>
    </div>
  );
}
