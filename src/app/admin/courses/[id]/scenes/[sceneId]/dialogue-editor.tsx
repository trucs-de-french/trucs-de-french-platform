"use client";

import { useState, type DragEvent } from "react";
import type { VocabItem } from "@/lib/vocab";

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
            dragOverIndex === i ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30" : ""
          }`}
        >
          <div className="flex items-start gap-2">
            <span
              draggable
              onDragStart={(e: DragEvent) => e.dataTransfer.setData("text/plain", String(i))}
              className="mt-1.5 cursor-grab select-none text-neutral-400 active:cursor-grabbing dark:text-neutral-500"
              aria-hidden
            >
              ⠿
            </span>
            <input
              placeholder="Спікер"
              value={line.speaker}
              onChange={(e) => updateLine(i, "speaker", e.target.value)}
              className="w-32 rounded-md border px-2 py-1 text-sm"
            />
            <textarea
              placeholder="Текст репліки"
              value={line.text}
              onChange={(e) => updateLine(i, "text", e.target.value)}
              rows={2}
              className="flex-1 rounded-md border px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => removeLine(i)}
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
            >
              Видалити
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
                    className="w-40 rounded-md border px-2 py-1 text-sm"
                  />
                  <span className="text-neutral-400 dark:text-neutral-500">→</span>
                  <input
                    placeholder="Переклад"
                    value={v.translation}
                    onChange={(e) => updateVocab(i, vi, "translation", e.target.value)}
                    className="w-48 rounded-md border px-2 py-1 text-sm"
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
                  className="ml-0 w-full max-w-md rounded-md border px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400"
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
        className="self-start rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
      >
        + Репліка
      </button>
    </div>
  );
}
