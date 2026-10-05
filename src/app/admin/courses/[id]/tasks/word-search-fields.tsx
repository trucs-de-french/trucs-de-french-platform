"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2, RefreshCw } from "lucide-react";
import type { WordSearchConfig, WordSearchWord, WordSearchBlock } from "@/lib/exercises/types";
import { generateWordSearchGrid } from "@/lib/exercises/word-search-grid";
import { normalizeWordSearchConfig, selectWordsForBlock, BLOCK_MAX_COLS, BLOCK_WORD_SEARCH_DENSITY } from "@/lib/exercises/grid-blocks";
import type { BlockWarning } from "@/lib/exercises/split-into-blocks";
import { buildWordSearchBlocksConfig } from "@/lib/exercises/build-blocks-config";
import { sanitizeWordForGrid } from "@/lib/exercises/grid-word";
import { buildConfigFromVocab, STRIP_ARTICLES_DEFAULT } from "@/lib/exercises/task-config-builder";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import { StripArticlesToggle } from "./strip-articles-toggle";
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

  // Довжина ПІСЛЯ sanitizeWordForGrid (пробіли/артиклі склеюються) — та
  // сама величина, що визначає ширину блоку в split-into-blocks.ts.
  const sanitizedLength = sanitizeWordForGrid(wordItem.word).length;
  const isLong = sanitizedLength > BLOCK_MAX_COLS;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-100 p-2 dark:border-neutral-700">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            value={wordItem.word}
            onChange={(e) => onUpdateWord(e.target.value)}
            placeholder="Слово"
            className={`${INPUT_BORDER} w-full px-2 py-2 text-base font-medium font-content`}
          />
          {isLong && (
            <span
              title="Блок із цим словом буде ширшим за екран телефона й прокручуватиметься вбік. Якщо слово містить артикль, спробуйте перемикач «Прибрати артиклі» вище."
              className="absolute -top-2 right-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800 dark:bg-amber-900 dark:text-amber-300"
            >
              {sanitizedLength} літер
            </span>
          )}
        </div>
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

function GridPreview({ grid }: { grid: string[][] }) {
  return (
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
  );
}

function blockWarningText(w: BlockWarning): string {
  switch (w.type) {
    case "isolated-word":
      return `"${w.word}" — без перетинів`;
    case "wide-block":
      return `сітка ${w.width}× — ширша за екран телефона (довге слово "${w.longestWord}")`;
    case "merged-small-block":
      return "об'єднано з попереднім блоком (інакше було б замало слів)";
    case "long-word":
      return `"${w.word}" — ${w.length} літер, не влазить у філворд`;
  }
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
  // normalizeWordSearchConfig (grid-blocks.ts) — читає blocks напряму
  // (новий формат) або синтезує рівно ОДИН блок зі старих top-level
  // grid/placements (вправи, збережені до цієї зміни, без міграції БД).
  // blockWords — РЕАЛЬНІ WordSearchWord (з translation/imageUrl/audioUrl,
  // не лише нормалізовані ключі) для кожного блоку — для чипів/прев'ю й
  // для "Перегенерувати блок" нижче; selectWordsForBlock розбирає
  // wordKeys як мультимножину за порядком появи в initialConfig.words.
  const initialBlocks = initialConfig
    ? normalizeWordSearchConfig(initialConfig as WordSearchConfig).blocks
    : [];
  const [blocks, setBlocks] = useState<WordSearchBlock[]>(initialBlocks);
  const [blockWords, setBlockWords] = useState<WordSearchWord[][]>(
    initialBlocks.map((b) => selectWordsForBlock(initialConfig?.words ?? [], b.wordKeys))
  );
  const [warnings, setWarnings] = useState<BlockWarning[]>([]);
  const [unplaced, setUnplaced] = useState<string[]>([]);
  const [stripArticles, setStripArticles] = useState(STRIP_ARTICLES_DEFAULT.word_search ?? false);

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
      const { words: newWords } = buildConfigFromVocab("word_search", imported, { stripArticles }) as {
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
      blocks,
      points: initialConfig?.points,
      hintsReducePoints: initialConfig?.hintsReducePoints,
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

  // (Пере)генерувати — перебудовує й сам поділ на блоки, і сітку кожного
  // (split-into-blocks.ts: слова беруться в ПОТОЧНОМУ порядку списку вище —
  // це єдиний важіль впливу вчительки на склад блоків).
  function regenerate() {
    const validWords = words.filter((w) => w.word.trim()).map(stripId);
    const result = buildWordSearchBlocksConfig(validWords);
    setBlocks(result.blocks);
    setBlockWords(result.blocks.map((b) => selectWordsForBlock(validWords, b.wordKeys)));
    setWarnings(result.warnings);
    setUnplaced(result.unplaced);
  }

  // Перегенерувати лише ОДИН блок — та сама генерація, що в самому
  // block, але для тих самих слів (склад блоку, wordKeys, не змінюється):
  // якщо нова спроба не вклалась у ліміт ширини блоку, стара сітка
  // лишається (не гіршати мовчки).
  function regenerateBlock(index: number) {
    const blockWordList = blockWords[index];
    if (!blockWordList) return;
    const result = generateWordSearchGrid(blockWordList, BLOCK_WORD_SEARCH_DENSITY);
    const keys = blockWordList.map((w) => sanitizeWordForGrid(w.word).toUpperCase());
    const longestWord = keys.slice().sort((a, c) => c.length - a.length)[0] ?? "";
    const limit = Math.max(BLOCK_MAX_COLS, longestWord.length);
    if (result.grid.length > limit || result.failedWords.length > 0) {
      setWarnings((prev) => [
        ...prev.filter((w) => !("blockIndex" in w && w.type === "wide-block" && w.blockIndex === index)),
        { type: "wide-block", blockIndex: index, width: result.grid.length, longestWord },
      ]);
      return;
    }
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === index
          ? { ...b, grid: result.grid, placements: result.placements, gridSourceWords: result.sourceWords }
          : b
      )
    );
  }

  // Застаріло, якщо мультимножина нормалізованих слів списку не збігається
  // з мультимножиною wordKeys усіх блоків — той самий сенс, що
  // task-validation.ts (серверна/живa перевірка), тут лише для миттєвого
  // попередження в формі без повторного виклику validateTaskConfig.
  const currentKeys = words
    .map((w) => sanitizeWordForGrid(w.word).toUpperCase())
    .filter(Boolean)
    .sort();
  const blockKeys = blocks
    .flatMap((b) => b.wordKeys)
    .slice()
    .sort();
  const isStale =
    blocks.length > 0 &&
    (currentKeys.length !== blockKeys.length || currentKeys.some((k, i) => k !== blockKeys[i]));

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input
        type="hidden"
        name="word_search_words"
        value={JSON.stringify(words.map(stripId))}
        readOnly
      />
      <input type="hidden" name="word_search_blocks" value={JSON.stringify(blocks)} readOnly />

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
        <StripArticlesToggle checked={stripArticles} onChange={setStripArticles} />
        {/* Блоки формуються автоматично (split-into-blocks.ts), порада лише
            про загальний орієнтовний обсяг — не жорсткий ліміт. */}
        {words.length > 40 && (
          <p className={HINT_TEXT}>
            Рекомендовано до ~40 слів загалом — вправа автоматично розіб&apos;ється на кілька менших сіток
            (блоків), по 3–10 слів кожна.
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
        {blocks.length > 0 ? "Перегенерувати сітки" : "Згенерувати сітки"}
      </button>

      {isStale && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Склад слів змінився — перегенеруйте.
        </p>
      )}

      {unplaced.length > 0 && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Не вдалося розмістити: {unplaced.join(", ")} — слово задовге для філворда (максимум 15 літер
          після вилучення пробілів) або список переповнений.
        </p>
      )}

      {blocks.length > 0 && (
        <div className="flex flex-col gap-3">
          {blocks.map((b, i) => {
            const blockWarningsForThis = warnings.filter((w) => "blockIndex" in w && w.blockIndex === i);
            return (
              <div key={i} className="rounded-md border border-gray-200 p-2 dark:border-neutral-700">
                <div className="flex items-center justify-between gap-2">
                  <p className={HINT_TEXT}>
                    Блок {i + 1} · {b.wordKeys.length} слів · {b.grid.length}×{b.grid.length}
                  </p>
                  <button
                    type="button"
                    onClick={() => regenerateBlock(i)}
                    className="text-xs text-blue-700 hover:underline dark:text-blue-400"
                  >
                    Перегенерувати блок
                  </button>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(blockWords[i] ?? []).map((w, wi) => (
                    <span
                      key={wi}
                      className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs dark:bg-neutral-700"
                    >
                      {w.word}
                    </span>
                  ))}
                </div>
                <GridPreview grid={b.grid} />
                {blockWarningsForThis.map((w, wi) => (
                  <p key={wi} className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    ⚠ {blockWarningText(w)}
                  </p>
                ))}
              </div>
            );
          })}
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

      <label className={`flex items-center gap-2 ${LABEL_TEXT}`}>
        <input
          type="checkbox"
          name="word_search_hints_reduce_points"
          value="true"
          defaultChecked={Boolean(initialConfig?.hintsReducePoints)}
        />
        Підказки зменшують бали (50% за елемент, де використана підказка)
      </label>
    </div>
  );
});
