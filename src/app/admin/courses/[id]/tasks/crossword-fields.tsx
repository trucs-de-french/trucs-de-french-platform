"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2, RefreshCw } from "lucide-react";
import type { CrosswordConfig, CrosswordWord, CrosswordBlock } from "@/lib/exercises/types";
import { generateCrosswordGrid, buildCrosswordSolution } from "@/lib/exercises/crossword-grid";
import { normalizeCrosswordConfig, selectWordsForBlock, BLOCK_MAX_COLS, BLOCK_MAX_ROWS } from "@/lib/exercises/grid-blocks";
import { splitWordsIntoBlocks, type BlockWarning } from "@/lib/exercises/split-into-blocks";
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

type EditableWord = CrosswordWord & { id: string };

function emptyWord(): EditableWord {
  return { id: crypto.randomUUID(), word: "", clue: "", clueStyle: "short", imageUrl: "", audioUrl: "" };
}

function stripId(w: EditableWord): CrosswordWord {
  return { word: w.word, clue: w.clue, clueStyle: w.clueStyle, imageUrl: w.imageUrl, audioUrl: w.audioUrl };
}

// Компактний сегментований перемикач (не radio+label — у рядку й так тісно
// поруч зі словом/підказкою/іконками файлів) — "Коротка" за замовчуванням
// (undefined трактується як "short" так само, як на студентському рендері).
function ClueStyleToggle({
  value,
  onChange,
}: {
  value: "short" | "long";
  onChange: (value: "short" | "long") => void;
}) {
  return (
    <div
      role="group"
      aria-label="Стиль підказки"
      className="flex shrink-0 overflow-hidden rounded-md border border-gray-300 text-xs dark:border-neutral-600"
    >
      {(["short", "long"] as const).map((style) => (
        <button
          key={style}
          type="button"
          onClick={() => onChange(style)}
          className={`px-2 py-1.5 whitespace-nowrap transition-colors ${
            style === "long" ? "border-l border-gray-300 dark:border-neutral-600" : ""
          } ${
            value === style
              ? "bg-blue-600 text-white"
              : "bg-white text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          }`}
        >
          {style === "short" ? "Коротка" : "Довга (речення)"}
        </button>
      ))}
    </div>
  );
}


// Картинка/аудіо — той самий FileOrLinkField, що word_search/letter_gaps,
// заповнюються ВРУЧНУ вчителькою (не частина імпорту, той самий принцип,
// що word_search: переклад/clue приходить з вокабуляру сцени безкоштовно,
// картинка/аудіо — ні, там уже потрібне окреме джерело файлу/посилання).
function CrosswordWordRow({
  wordItem,
  onUpdateWord,
  onUpdateClue,
  onUpdateClueStyle,
  onUpdateImageUrl,
  onUpdateAudioUrl,
  onRemove,
}: {
  wordItem: EditableWord;
  onUpdateWord: (value: string) => void;
  onUpdateClue: (value: string) => void;
  onUpdateClueStyle: (value: "short" | "long") => void;
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
          value={wordItem.clue}
          onChange={(e) => onUpdateClue(e.target.value)}
          placeholder="Підказка (означення)"
          className={`${INPUT_BORDER} flex-[2] px-2 py-2 text-sm`}
        />
        <ClueStyleToggle value={wordItem.clueStyle ?? "short"} onChange={onUpdateClueStyle} />
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

function CrosswordPreview({
  placements,
  gridWidth,
  gridHeight,
}: {
  placements: import("@/lib/exercises/types").CrosswordPlacement[];
  gridWidth: number;
  gridHeight: number;
}) {
  const previewLetters = placements.length > 0 ? buildCrosswordSolution(placements, gridWidth, gridHeight) : [];
  const numberAt = new Map(placements.map((p) => [`${p.row},${p.col}`, p.number]));
  return (
    <div className="mt-1 overflow-x-auto">
      <table className="border-collapse font-heading font-semibold text-xs">
        <tbody>
          {previewLetters.map((row, ri) => (
            <tr key={ri}>
              {row.map((letter, ci) => {
                const number = numberAt.get(`${ri},${ci}`);
                if (!letter) {
                  return <td key={ci} className="h-6 w-6 border-none bg-transparent" />;
                }
                return (
                  <td
                    key={ci}
                    className="relative h-6 w-6 border border-neutral-200 text-center align-middle dark:border-neutral-700 dark:text-neutral-300"
                  >
                    {number !== undefined && (
                      <span className="absolute left-0.5 top-0 text-[8px] leading-none text-neutral-500 dark:text-neutral-400">
                        {number}
                      </span>
                    )}
                    {letter}
                  </td>
                );
              })}
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
      return `сітка ${w.width}× — більша за рекомендований розмір (довге слово "${w.longestWord}")`;
    case "merged-small-block":
      return "об'єднано з попереднім блоком (інакше було б замало слів)";
    case "long-word":
      return `"${w.word}" — ${w.length} літер`;
  }
}

export const CrosswordFields = forwardRef<
  ImportableFieldsHandle & TypeSwitchHandle<CrosswordConfig>,
  { initialConfig?: Partial<CrosswordConfig> }
>(function CrosswordFields({ initialConfig }, ref) {
  const [words, setWords] = useState<EditableWord[]>(
    initialConfig?.words?.length
      ? initialConfig.words.map((w) => ({ ...w, id: crypto.randomUUID() }))
      : [emptyWord()]
  );
  // normalizeCrosswordConfig (grid-blocks.ts) — той самий принцип, що
  // word-search-fields.tsx: blocks напряму (новий формат) або синтезований
  // ОДИН блок зі старих top-level placements/gridWidth/gridHeight (вправи
  // до цієї зміни, без міграції БД).
  const initialBlocks = initialConfig
    ? normalizeCrosswordConfig(initialConfig as CrosswordConfig).blocks
    : [];
  const [blocks, setBlocks] = useState<CrosswordBlock[]>(initialBlocks);
  const [blockWords, setBlockWords] = useState<CrosswordWord[][]>(
    initialBlocks.map((b) => selectWordsForBlock(initialConfig?.words ?? [], b.wordKeys) as unknown as CrosswordWord[])
  );
  const [warnings, setWarnings] = useState<BlockWarning[]>([]);
  const [stripArticles, setStripArticles] = useState(STRIP_ARTICLES_DEFAULT.crossword ?? false);

  useImperativeHandle(ref, () => ({
    // Плаский тип (як letter_gaps/word_search) — word завжди обов'язковий.
    // clue заповнюється з перекладу — той самий принцип, що word_search.
    // buildConfigFromVocab (task-config-builder.ts) переносить imageUrl/
    // audioUrl, якщо вони є у вокабуляру; word лишається оригіналом
    // (легенда/підказка показує саме його) — прибирання пробілів/апострофів/
    // дефісів для розміщення в сітці відбувається пізніше, усередині
    // generateCrosswordGrid (crossword-grid.ts), не тут.
    importWords(imported) {
      const { words: newWords } = buildConfigFromVocab("crossword", imported, { stripArticles }) as {
        words: CrosswordWord[];
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

  function updateClue(id: string, value: string) {
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, clue: value } : w)));
  }

  function updateClueStyle(id: string, value: "short" | "long") {
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, clueStyle: value } : w)));
  }

  function updateImageUrl(id: string, value: string) {
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, imageUrl: value } : w)));
  }

  function updateAudioUrl(id: string, value: string) {
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, audioUrl: value } : w)));
  }

  // Підказка може бути текстом, картинкою чи аудіо — будь-якого ОДНОГО з
  // трьох достатньо (той самий принцип, що word_search: слово без
  // перекладу, але з картинкою, і так валідне).
  function validWordsList(): CrosswordWord[] {
    return words
      .filter((w) => w.word.trim() && (w.clue.trim() || w.imageUrl?.trim() || w.audioUrl?.trim()))
      .map(stripId);
  }

  function regenerate() {
    const validWords = validWordsList();
    const result = splitWordsIntoBlocks(validWords, "crossword", { generate: generateCrosswordGrid });
    setBlocks(result.blocks);
    setBlockWords(result.blocks.map((b) => selectWordsForBlock(validWords, b.wordKeys) as unknown as CrosswordWord[]));
    setWarnings(result.warnings);
  }

  function regenerateBlock(index: number) {
    const blockWordList = blockWords[index];
    if (!blockWordList) return;
    const keys = blockWordList.map((w) => sanitizeWordForGrid(w.word).toUpperCase());
    const longestWord = keys.slice().sort((a, c) => c.length - a.length)[0] ?? "";
    const limit = Math.max(BLOCK_MAX_COLS, longestWord.length);
    const result = generateCrosswordGrid(blockWordList);
    if (result.gridWidth > limit || result.gridHeight > BLOCK_MAX_ROWS) {
      setWarnings((prev) => [
        ...prev.filter((w) => !("blockIndex" in w && w.type === "wide-block" && w.blockIndex === index)),
        { type: "wide-block", blockIndex: index, width: Math.max(result.gridWidth, result.gridHeight), longestWord },
      ]);
      return;
    }
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === index
          ? {
              ...b,
              placements: result.placements,
              gridWidth: result.gridWidth,
              gridHeight: result.gridHeight,
              gridSourceWords: result.sourceWords,
            }
          : b
      )
    );
    setWarnings((prev) => [
      ...prev.filter((w) => !("blockIndex" in w && w.blockIndex === index)),
      ...result.isolatedWords.map((word) => ({ type: "isolated-word" as const, word, blockIndex: index })),
    ]);
  }

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
      <input type="hidden" name="crossword_words" value={JSON.stringify(words.map(stripId))} readOnly />
      <input type="hidden" name="crossword_blocks" value={JSON.stringify(blocks)} readOnly />

      <InstructionsRichTextField
        name="crossword_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="crossword_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      <div className="flex flex-col gap-2">
        <label className={LABEL_TEXT}>Слова та підказки</label>
        <StripArticlesToggle checked={stripArticles} onChange={setStripArticles} />
        {words.length > 40 && (
          <p className={HINT_TEXT}>
            Рекомендовано до ~40 слів загалом — вправа автоматично розіб&apos;ється на кілька менших
            кросвордів (блоків), по 3–8 слів кожен.
          </p>
        )}
        {words.map((w) => (
          <CrosswordWordRow
            key={w.id}
            wordItem={w}
            onUpdateWord={(value) => updateWord(w.id, value)}
            onUpdateClue={(value) => updateClue(w.id, value)}
            onUpdateClueStyle={(value) => updateClueStyle(w.id, value)}
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
        {blocks.length > 0 ? "Перегенерувати кросворди" : "Згенерувати кросворди"}
      </button>

      {isStale && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Склад слів змінився — перегенеруйте.
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
                    Блок {i + 1} · {b.wordKeys.length} слів · {b.gridWidth}×{b.gridHeight}
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
                <CrosswordPreview placements={b.placements} gridWidth={b.gridWidth} gridHeight={b.gridHeight} />
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
          name="crossword_points"
          defaultValue={initialConfig?.points ?? 1}
          className={`${INPUT_BORDER} w-24 px-2 py-2 text-sm`}
        />
      </div>

      <label className={`flex items-center gap-2 ${LABEL_TEXT}`}>
        <input
          type="checkbox"
          name="crossword_hints_reduce_points"
          value="true"
          defaultChecked={Boolean(initialConfig?.hintsReducePoints)}
        />
        Підказки зменшують бали (50% за елемент, де використана підказка)
      </label>
    </div>
  );
});
