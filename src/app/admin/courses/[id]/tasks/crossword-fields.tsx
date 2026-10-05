"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2 } from "lucide-react";
import type { CrosswordConfig, CrosswordWord } from "@/lib/exercises/types";
import { buildCrosswordSolution } from "@/lib/exercises/crossword-grid";
import { BLOCK_MAX_COLS } from "@/lib/exercises/grid-blocks";
import {
  hydrateEditorBlocks,
  serializeBlocks,
  type CrosswordEditorState,
  type CrosswordEditorGrid,
} from "@/lib/exercises/block-editing";
import { BlocksEditor, BlockSelect, moveWordToBlockChange, createBlockWithWordChange } from "./blocks-editor";
import { sanitizeWordForGrid } from "@/lib/exercises/grid-word";
import { buildConfigFromVocab, STRIP_ARTICLES_DEFAULT } from "@/lib/exercises/task-config-builder";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import { StripArticlesToggle } from "./strip-articles-toggle";
import type { ImportableFieldsHandle } from "./importable-fields";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { useFileOrLink } from "@/components/file-or-link-field";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";

type EditableWord = CrosswordWord & { id: string };

function emptyWord(): CrosswordWord {
  return { word: "", clue: "", clueStyle: "short", imageUrl: "", audioUrl: "" };
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
  blockOrder,
  blockTitles,
  blockId,
  onMoveToBlock,
  onCreateBlock,
  onUpdateWord,
  onUpdateClue,
  onUpdateClueStyle,
  onUpdateImageUrl,
  onUpdateAudioUrl,
  onRemove,
}: {
  wordItem: EditableWord;
  blockOrder: string[];
  blockTitles: Record<string, string | undefined>;
  blockId: string | null;
  onMoveToBlock: (blockId: string | null) => void;
  onCreateBlock: () => void;
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
        <BlockSelect blockOrder={blockOrder} blockTitles={blockTitles} value={blockId} onChange={onMoveToBlock} onCreateNew={onCreateBlock} />
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

export const CrosswordFields = forwardRef<
  ImportableFieldsHandle & TypeSwitchHandle<CrosswordConfig>,
  { initialConfig?: Partial<CrosswordConfig> }
>(function CrosswordFields({ initialConfig }, ref) {
  // Той самий принцип, що word-search-fields.tsx (ЕТАП B/3) — EditorState
  // (block-editing.ts) — джерело правди, blockId на кожному слові.
  const [editor, setEditor] = useState<CrosswordEditorState>(() =>
    initialConfig?.words?.length
      ? hydrateEditorBlocks(initialConfig as CrosswordConfig, "crossword")
      : { words: [{ ...emptyWord(), editorId: crypto.randomUUID(), blockId: null }], blockOrder: [], blocks: {} }
  );
  const [stripArticles, setStripArticles] = useState(STRIP_ARTICLES_DEFAULT.crossword ?? false);

  const blockTitles = Object.fromEntries(editor.blockOrder.map((id) => [id, editor.blocks[id]?.title])) as Record<
    string,
    string | undefined
  >;

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
      setEditor((prev) => {
        const withoutEmpty = prev.words.filter((w) => w.word.trim());
        return {
          ...prev,
          words: [
            ...withoutEmpty,
            ...newWords.map((w) => ({ ...w, editorId: crypto.randomUUID(), blockId: null })),
          ],
        };
      });
    },
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      words: editor.words.map(({ editorId, blockId, ...w }) => {
        void editorId;
        void blockId;
        return w;
      }),
      blocks: serializeBlocks(editor, "crossword"),
      points: initialConfig?.points,
      hintsReducePoints: initialConfig?.hintsReducePoints,
    }),
  }));

  function addWord() {
    setEditor((prev) => ({
      ...prev,
      words: [...prev.words, { ...emptyWord(), editorId: crypto.randomUUID(), blockId: null }],
    }));
  }

  function removeWord(editorId: string) {
    setEditor((prev) => ({ ...prev, words: prev.words.filter((w) => w.editorId !== editorId) }));
  }

  function updateWord(editorId: string, value: string) {
    setEditor((prev) => ({ ...prev, words: prev.words.map((w) => (w.editorId === editorId ? { ...w, word: value } : w)) }));
  }

  function updateClue(editorId: string, value: string) {
    setEditor((prev) => ({ ...prev, words: prev.words.map((w) => (w.editorId === editorId ? { ...w, clue: value } : w)) }));
  }

  function updateClueStyle(editorId: string, value: "short" | "long") {
    setEditor((prev) => ({
      ...prev,
      words: prev.words.map((w) => (w.editorId === editorId ? { ...w, clueStyle: value } : w)),
    }));
  }

  function updateImageUrl(editorId: string, value: string) {
    setEditor((prev) => ({ ...prev, words: prev.words.map((w) => (w.editorId === editorId ? { ...w, imageUrl: value } : w)) }));
  }

  function updateAudioUrl(editorId: string, value: string) {
    setEditor((prev) => ({ ...prev, words: prev.words.map((w) => (w.editorId === editorId ? { ...w, audioUrl: value } : w)) }));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input
        type="hidden"
        name="crossword_words"
        value={JSON.stringify(editor.words.map(({ editorId, blockId, ...w }) => {
          void editorId;
          void blockId;
          return w;
        }))}
        readOnly
      />
      <input type="hidden" name="crossword_blocks" value={JSON.stringify(serializeBlocks(editor, "crossword"))} readOnly />

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
        {editor.words.length > 40 && (
          <p className={HINT_TEXT}>
            Рекомендовано до ~40 слів загалом — вправа автоматично розіб&apos;ється на кілька менших
            кросвордів (блоків), по 3–10 слів кожен.
          </p>
        )}
        {editor.words.map((w) => (
          <CrosswordWordRow
            key={w.editorId}
            wordItem={{
              id: w.editorId,
              word: w.word,
              clue: w.clue,
              clueStyle: w.clueStyle,
              imageUrl: w.imageUrl,
              audioUrl: w.audioUrl,
            }}
            blockOrder={editor.blockOrder}
            blockTitles={blockTitles}
            blockId={w.blockId}
            onMoveToBlock={(target) => setEditor((prev) => moveWordToBlockChange(prev, "crossword", w.editorId, target))}
            onCreateBlock={() => setEditor((prev) => createBlockWithWordChange(prev, "crossword", w.editorId))}
            onUpdateWord={(value) => updateWord(w.editorId, value)}
            onUpdateClue={(value) => updateClue(w.editorId, value)}
            onUpdateClueStyle={(value) => updateClueStyle(w.editorId, value)}
            onUpdateImageUrl={(value) => updateImageUrl(w.editorId, value)}
            onUpdateAudioUrl={(value) => updateAudioUrl(w.editorId, value)}
            onRemove={() => removeWord(w.editorId)}
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

      <BlocksEditor
        kind="crossword"
        state={editor}
        onChange={setEditor}
        renderPreview={(grid: CrosswordEditorGrid) => (
          <CrosswordPreview placements={grid.placements} gridWidth={grid.gridWidth} gridHeight={grid.gridHeight} />
        )}
        gridLabel={(grid: CrosswordEditorGrid) => `${grid.gridWidth}×${grid.gridHeight}`}
      />

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
