"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2 } from "lucide-react";
import type { WordSearchConfig, WordSearchWord } from "@/lib/exercises/types";
import { BLOCK_MAX_COLS } from "@/lib/exercises/grid-blocks";
import {
  hydrateEditorBlocks,
  serializeBlocks,
  type WordSearchEditorState,
  type WordSearchEditorGrid,
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

type EditableWord = WordSearchWord & { id: string };

function emptyWord(): WordSearchWord {
  return { word: "", translation: "", imageUrl: "", audioUrl: "" };
}

// Окремий компонент на рядок-слово (не інлайн у .map()) — useFileOrLink це
// хук, викликати його всередині callback .map() було б порушенням правил
// хуків. translation/imageUrl/audioUrl не впливають на генерацію сітки —
// лише на легенду, яку бачить студент (sanitizeWordSearch пропускає їх як
// є, не секрет).
function WordSearchWordRow({
  wordItem,
  blockOrder,
  blockTitles,
  blockId,
  onMoveToBlock,
  onCreateBlock,
  onUpdateWord,
  onUpdateTranslation,
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

export const WordSearchFields = forwardRef<
  ImportableFieldsHandle & TypeSwitchHandle<WordSearchConfig>,
  { initialConfig?: Partial<WordSearchConfig> }
>(function WordSearchFields({ initialConfig }, ref) {
  // Джерело правди — EditorState (block-editing.ts): editor.words несе
  // blockId (null = "Нерозподілені") поряд з текстом/перекладом/картинкою/
  // аудіо слова; editor.blocks — назва/режим підказок/сітка кожного блоку.
  // hydrateEditorBlocks виводить blockId з config.blocks[].wordKeys
  // (мультимножина за порядком появи, як раніше selectWordsForBlock).
  const [editor, setEditor] = useState<WordSearchEditorState>(() =>
    initialConfig?.words?.length
      ? hydrateEditorBlocks(initialConfig as WordSearchConfig, "word_search")
      : { words: [{ ...emptyWord(), editorId: crypto.randomUUID(), blockId: null }], blockOrder: [], blocks: {} }
  );
  const [stripArticles, setStripArticles] = useState(STRIP_ARTICLES_DEFAULT.word_search ?? false);

  const blockTitles = Object.fromEntries(editor.blockOrder.map((id) => [id, editor.blocks[id]?.title])) as Record<
    string,
    string | undefined
  >;

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
    // Нове слово (звідси й вручну, emptyWord) за замовчуванням потрапляє в
    // "Нерозподілені" (blockId: null).
    importWords(imported) {
      const { words: newWords } = buildConfigFromVocab("word_search", imported, { stripArticles }) as {
        words: WordSearchWord[];
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
      blocks: serializeBlocks(editor, "word_search"),
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

  function updateTranslation(editorId: string, value: string) {
    setEditor((prev) => ({
      ...prev,
      words: prev.words.map((w) => (w.editorId === editorId ? { ...w, translation: value } : w)),
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
        name="word_search_words"
        value={JSON.stringify(editor.words.map(({ editorId, blockId, ...w }) => {
          void editorId;
          void blockId;
          return w;
        }))}
        readOnly
      />
      <input type="hidden" name="word_search_blocks" value={JSON.stringify(serializeBlocks(editor, "word_search"))} readOnly />

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
        {editor.words.length > 40 && (
          <p className={HINT_TEXT}>
            Рекомендовано до ~40 слів загалом — вправа автоматично розіб&apos;ється на кілька менших сіток
            (блоків), по 3–10 слів кожна.
          </p>
        )}
        {editor.words.map((w) => (
          <WordSearchWordRow
            key={w.editorId}
            wordItem={{ id: w.editorId, word: w.word, translation: w.translation, imageUrl: w.imageUrl, audioUrl: w.audioUrl }}
            blockOrder={editor.blockOrder}
            blockTitles={blockTitles}
            blockId={w.blockId}
            onMoveToBlock={(target) => setEditor((prev) => moveWordToBlockChange(prev, "word_search", w.editorId, target))}
            onCreateBlock={() => setEditor((prev) => createBlockWithWordChange(prev, "word_search", w.editorId))}
            onUpdateWord={(value) => updateWord(w.editorId, value)}
            onUpdateTranslation={(value) => updateTranslation(w.editorId, value)}
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
        kind="word_search"
        state={editor}
        onChange={setEditor}
        renderPreview={(grid: WordSearchEditorGrid) => <GridPreview grid={grid.grid} />}
        gridLabel={(grid: WordSearchEditorGrid) => `${grid.grid.length}×${grid.grid.length}`}
      />

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
