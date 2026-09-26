"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2, RefreshCw } from "lucide-react";
import type { WordSearchConfig, WordSearchWord, WordSearchPlacement } from "@/lib/exercises/types";
import { generateWordSearchGrid } from "@/lib/exercises/word-search-grid";
import { buildConfigFromVocab } from "@/lib/exercises/task-config-builder";
import { WORD_SEARCH_MAX_WORDS, WORD_SEARCH_MAX_GRID } from "@/lib/exercises/grid-limits";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import type { ImportableFieldsHandle } from "./importable-fields";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { useFileOrLink } from "@/components/file-or-link-field";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { BUTTON_SECONDARY_SM } from "@/lib/button-styles";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";

type EditableWord = WordSearchWord & { id: string };

function emptyWord(): EditableWord {
  return { id: crypto.randomUUID(), word: "", translation: "", imageUrl: "", audioUrl: "" };
}

function stripId(w: EditableWord): WordSearchWord {
  return { word: w.word, translation: w.translation, imageUrl: w.imageUrl, audioUrl: w.audioUrl };
}

// Окремий компонент на рядок-слово (не інлайн у .map()) — useFileOrLink це
// хук, викликати його всередині callback .map() було б порушенням правил
// хуків. translation/imageUrl/audioUrl не впливають на генерацію сітки —
// лише на легенду, яку бачить студент (sanitizeWordSearch пропускає їх як
// є, не секрет).
function WordSearchWordRow({
  wordItem,
  onUpdateWord,
  onUpdateTranslation,
  onUpdateImageUrl,
  onUpdateAudioUrl,
  onRemove,
}: {
  wordItem: EditableWord;
  onUpdateWord: (value: string) => void;
  onUpdateTranslation: (value: string) => void;
  onUpdateImageUrl: (url: string) => void;
  onUpdateAudioUrl: (url: string) => void;
  onRemove: () => void;
}) {
  const image = useFileOrLink({
    kind: "image",
    mode: "controlled",
    value: wordItem.imageUrl ?? "",
    onChange: onUpdateImageUrl,
    placeholder: "Картинка (URL, необов'язково)",
    allowFocus: true,
  });
  const audio = useFileOrLink({
    kind: "audio",
    mode: "controlled",
    value: wordItem.audioUrl ?? "",
    onChange: onUpdateAudioUrl,
    placeholder: "Аудіо (URL, необов'язково)",
  });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-100 p-2 dark:border-neutral-700">
      <div className="flex items-center gap-2">
        <input
          value={wordItem.word}
          onChange={(e) => onUpdateWord(e.target.value)}
          placeholder="Слово"
          className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
        />
        <input
          value={wordItem.translation ?? ""}
          onChange={(e) => onUpdateTranslation(e.target.value)}
          placeholder="Переклад (опційно)"
          className={`${INPUT_BORDER} flex-1 px-2 py-2 text-sm`}
        />
        {image.icons}
        {audio.icons}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Видалити слово"
          title="Видалити"
          className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {(image.input || audio.input) && (
        <div className="flex flex-wrap items-start gap-2">
          {image.input && (
            <div className="flex items-start gap-1">
              {image.input}
              <ImageOrPlaceholder
                src={wordItem.imageUrl}
                alt="Прев'ю"
                className="h-12 w-12 shrink-0 rounded object-cover"
                useFocus
              />
            </div>
          )}
          {audio.input && <div className="flex-1">{audio.input}</div>}
        </div>
      )}
    </div>
  );
}

export const WordSearchFields = forwardRef<
  ImportableFieldsHandle & TypeSwitchHandle<WordSearchConfig>,
  { initialConfig?: Partial<WordSearchConfig> }
>(function WordSearchFields({ initialConfig }, ref) {
  const [words, setWords] = useState<EditableWord[]>(
    initialConfig?.words?.length
      ? initialConfig.words.map((w) => ({ ...w, id: crypto.randomUUID() }))
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
    // Плаский тип, як letter_gaps/letter_rearrangement (word_search НЕ в
    // PAIR_TYPES — word завжди обов'язковий, ніколи порожній), але, на
    // відміну від них, ТЕЖ підтягує translation, якщо вчителька позначила
    // українську колонку для того самого рядка (ImportVocabPanel уже
    // повертає його — умова "checkedUk для цього v" саме там, у
    // import-vocab-panel.tsx). buildConfigFromVocab (task-config-builder.ts)
    // переносить imageUrl/audioUrl, якщо вони є у вокабуляру; word лишається
    // оригіналом (легенда показує саме його) — прибирання пробілів/
    // апострофів/дефісів для розміщення в сітці відбувається пізніше,
    // усередині generateWordSearchGrid (word-search-grid.ts), не тут.
    importWords(imported) {
      const { words: newWords } = buildConfigFromVocab("word_search", imported) as {
        words: WordSearchWord[];
      };
      setWords((prev) => {
        const withoutEmpty = prev.filter((w) => w.word.trim());
        return [...withoutEmpty, ...newWords.map((w) => ({ ...w, id: crypto.randomUUID() }))];
      });
    },
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      words: words.map(stripId),
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

  function updateTranslation(id: string, value: string) {
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, translation: value } : w)));
  }

  function updateImageUrl(id: string, value: string) {
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, imageUrl: value } : w)));
  }

  function updateAudioUrl(id: string, value: string) {
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, audioUrl: value } : w)));
  }

  function regenerate() {
    const validWords = words.filter((w) => w.word.trim());
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
        value={JSON.stringify(words.map(stripId))}
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

      <div className="flex flex-col gap-2">
        <label className={LABEL_TEXT}>Слова для пошуку</label>
        {words.length > WORD_SEARCH_MAX_WORDS && (
          <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            ⚠ Рекомендовано не більше {WORD_SEARCH_MAX_WORDS} слів — розбийте на кілька вправ. Сітка обмежена{" "}
            {WORD_SEARCH_MAX_GRID}×{WORD_SEARCH_MAX_GRID}, слова, що не вмістяться, покажуться попередженням нижче.
          </p>
        )}
        {words.map((w) => (
          <WordSearchWordRow
            key={w.id}
            wordItem={w}
            onUpdateWord={(value) => updateWord(w.id, value)}
            onUpdateTranslation={(value) => updateTranslation(w.id, value)}
            onUpdateImageUrl={(value) => updateImageUrl(w.id, value)}
            onUpdateAudioUrl={(value) => updateAudioUrl(w.id, value)}
            onRemove={() => removeWord(w.id)}
          />
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
            <table className="border-collapse font-heading font-semibold text-xs">
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
