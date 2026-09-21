"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2, RefreshCw } from "lucide-react";
import type { WordSearchConfig, WordSearchPlacement } from "@/lib/exercises/types";
import { generateWordSearchGrid } from "@/lib/exercises/word-search-grid";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { BUTTON_SECONDARY_SM } from "@/lib/button-styles";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";

type EditableWord = { id: string; word: string };

function emptyWord(): EditableWord {
  return { id: crypto.randomUUID(), word: "" };
}

export const WordSearchFields = forwardRef<
  TypeSwitchHandle<WordSearchConfig>,
  { initialConfig?: Partial<WordSearchConfig> }
>(function WordSearchFields({ initialConfig }, ref) {
  const [words, setWords] = useState<EditableWord[]>(
    initialConfig?.words?.length
      ? initialConfig.words.map((w) => ({ id: crypto.randomUUID(), word: w.word }))
      : [emptyWord()]
  );
  // grid/placements — результат ОСТАННЬОЇ генерації, не перераховуються на
  // кожен рендер (той самий принцип, що в types.ts: генерація один раз, не
  // на льоту) — редагування слів після генерації НЕ оновлює сітку
  // автоматично, доки вчителька сама не натисне "(Пере)генерувати".
  const [grid, setGrid] = useState<string[][]>(initialConfig?.grid ?? []);
  const [placements, setPlacements] = useState<WordSearchPlacement[]>(
    initialConfig?.placements ?? []
  );
  const [failedWords, setFailedWords] = useState<string[]>([]);

  useImperativeHandle(ref, () => ({
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      words: words.map(({ word }) => ({ word })),
      grid,
      placements,
      points: initialConfig?.points,
    }),
  }));

  function addWord() {
    setWords((prev) => [...prev, emptyWord()]);
  }

  function removeWord(id: string) {
    setWords((prev) => prev.filter((w) => w.id !== id));
  }

  function updateWord(id: string, value: string) {
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, word: value } : w)));
  }

  function regenerate() {
    const validWords = words.map((w) => w.word.trim()).filter(Boolean);
    const result = generateWordSearchGrid(validWords);
    setGrid(result.grid);
    setPlacements(result.placements);
    setFailedWords(result.failedWords);
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input
        type="hidden"
        name="word_search_words"
        value={JSON.stringify(words.map(({ word }) => ({ word })))}
        readOnly
      />
      <input type="hidden" name="word_search_grid" value={JSON.stringify(grid)} readOnly />
      <input
        type="hidden"
        name="word_search_placements"
        value={JSON.stringify(placements)}
        readOnly
      />

      <InstructionsRichTextField
        name="word_search_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="word_search_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Слова для пошуку</label>
        {words.map((w) => (
          <div key={w.id} className="flex items-center gap-2">
            <input
              value={w.word}
              onChange={(e) => updateWord(w.id, e.target.value)}
              placeholder="Слово"
              className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
            />
            <button
              type="button"
              onClick={() => removeWord(w.id)}
              aria-label="Видалити слово"
              title="Видалити"
              className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addWord}
          className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + слово
        </button>
      </div>

      <button
        type="button"
        onClick={regenerate}
        className={`inline-flex w-fit items-center gap-1.5 ${BUTTON_SECONDARY_SM}`}
      >
        <RefreshCw size={14} />
        {grid.length > 0 ? "Перегенерувати сітку" : "Згенерувати сітку"}
      </button>

      {failedWords.length > 0 && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Не вдалося розмістити: {failedWords.join(", ")} — скоротіть список слів (сітка замала
          для решти) або спробуйте перегенерувати ще раз.
        </p>
      )}

      {grid.length > 0 && (
        <div>
          <p className={HINT_TEXT}>
            Прев&apos;ю сітки ({grid.length}×{grid.length}) — те саме побачить студент
          </p>
          <div className="mt-1 overflow-x-auto">
            <table className="border-collapse font-mono text-xs">
              <tbody>
                {grid.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="h-6 w-6 border border-neutral-200 text-center dark:border-neutral-700 dark:text-neutral-300"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Бали за завдання</label>
        <input
          type="number"
          min={0}
          step={0.5}
          name="word_search_points"
          defaultValue={initialConfig?.points ?? 1}
          className={`${INPUT_BORDER} w-24 px-2 py-2 text-sm`}
        />
      </div>
    </div>
  );
});
