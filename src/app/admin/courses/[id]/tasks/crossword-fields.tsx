"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2, RefreshCw } from "lucide-react";
import type { CrosswordConfig, CrosswordWord, CrosswordPlacement } from "@/lib/exercises/types";
import { generateCrosswordGrid, buildCrosswordSolution } from "@/lib/exercises/crossword-grid";
import { buildConfigFromVocab, STRIP_ARTICLES_DEFAULT } from "@/lib/exercises/task-config-builder";
import { CROSSWORD_MAX_WORDS } from "@/lib/exercises/grid-limits";
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

export const CrosswordFields = forwardRef<
  ImportableFieldsHandle & TypeSwitchHandle<CrosswordConfig>,
  { initialConfig?: Partial<CrosswordConfig> }
>(function CrosswordFields({ initialConfig }, ref) {
  const [words, setWords] = useState<EditableWord[]>(
    initialConfig?.words?.length
      ? initialConfig.words.map((w) => ({ ...w, id: crypto.randomUUID() }))
      : [emptyWord()]
  );
  // placements/gridWidth/gridHeight — результат ОСТАННЬОЇ генерації, не
  // перераховуються на кожен рендер (той самий принцип, що word_search):
  // редагування слів після генерації не оновлює кросворд автоматично, доки
  // вчителька сама не натисне "(Пере)генерувати".
  const [placements, setPlacements] = useState<CrosswordPlacement[]>(initialConfig?.placements ?? []);
  const [gridWidth, setGridWidth] = useState(initialConfig?.gridWidth ?? 0);
  const [gridHeight, setGridHeight] = useState(initialConfig?.gridHeight ?? 0);
  const [isolatedWords, setIsolatedWords] = useState<string[]>([]);
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
      placements,
      gridWidth,
      gridHeight,
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

  function regenerate() {
    // Підказка може бути текстом, картинкою чи аудіо — будь-якого ОДНОГО з
    // трьох достатньо (той самий принцип, що word_search: слово без
    // перекладу, але з картинкою, і так валідне). Порожній clue сам по
    // собі більше не виключає слово — старий фільтр вимагав ОБОВ'ЯЗКОВО
    // clue.trim(), лишок від часу, коли текст був єдиним видом підказки, ще
    // до появи imageUrl/audioUrl.
    const validWords = words.filter(
      (w) => w.word.trim() && (w.clue.trim() || w.imageUrl?.trim() || w.audioUrl?.trim())
    );
    const result = generateCrosswordGrid(validWords);
    setPlacements(result.placements);
    setGridWidth(result.gridWidth);
    setGridHeight(result.gridHeight);
    setIsolatedWords(result.isolatedWords);
  }

  const previewLetters = placements.length > 0 ? buildCrosswordSolution(placements, gridWidth, gridHeight) : [];
  const numberAt = new Map(placements.map((p) => [`${p.row},${p.col}`, p.number]));

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="crossword_words" value={JSON.stringify(words.map(stripId))} readOnly />
      <input type="hidden" name="crossword_placements" value={JSON.stringify(placements)} readOnly />
      <input type="hidden" name="crossword_grid_width" value={gridWidth} readOnly />
      <input type="hidden" name="crossword_grid_height" value={gridHeight} readOnly />

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
        {words.length > CROSSWORD_MAX_WORDS && (
          <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            ⚠ Рекомендовано не більше {CROSSWORD_MAX_WORDS} слів — розбийте на кілька вправ, інакше сітка стане
            занадто громіздкою.
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
        {placements.length > 0 ? "Перегенерувати кросворд" : "Згенерувати кросворд"}
      </button>

      {isolatedWords.length > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {isolatedWords.length} слів{isolatedWords.length === 1 ? "о" : ""} розміщено окремо, без
          перетинів: {isolatedWords.join(", ")} — це не помилка, кросворд і далі розв&apos;язний, просто
          менш &quot;переплетений&quot;.
        </p>
      )}

      {placements.length > 0 && (
        <div>
          <p className={HINT_TEXT}>
            Прев&apos;ю кросворду ({gridWidth}×{gridHeight}) — студент побачить ту саму форму, без літер
          </p>
          <div className="mt-1 overflow-x-auto">
            <table className="border-collapse font-heading font-semibold text-xs">
              <tbody>
                {previewLetters.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((letter, ci) => {
                      const number = numberAt.get(`${ri},${ci}`);
                      if (!letter) {
                        // Той самий стиль crosswordlabs.com, що студентський
                        // рендер — заблокована клітинка невидима, не чорний
                        // квадрат, але й далі займає місце в сітці.
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
    </div>
  );
});
