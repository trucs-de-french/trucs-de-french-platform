"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2 } from "lucide-react";
import type { LetterGapsConfig, LetterGapsWord } from "@/lib/exercises/types";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import type { ImportableFieldsHandle } from "./importable-fields";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { useFileOrLink } from "@/components/file-or-link-field";
import { buildConfigFromVocab } from "@/lib/exercises/task-config-builder";
import { computeAutoHiddenIndices, type LetterHideMode } from "@/lib/exercises/letter-hide";
import { protectedPrefixLength } from "@/lib/exercises/article";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";

const AUTO_HIDE_OPTIONS: { mode: LetterHideMode; label: string }[] = [
  { mode: "default", label: "~40%" },
  { mode: "vowels", label: "Голосні" },
  { mode: "every_second", label: "Кожну другу" },
];

type EditableWord = LetterGapsWord & { id: string };

function emptyWord(): EditableWord {
  return {
    id: crypto.randomUUID(),
    word: "",
    hiddenIndices: [],
    hintType: "definition",
    hintText: "",
    imageUrl: "",
    audioUrl: "",
  };
}

function stripId(w: EditableWord): LetterGapsWord {
  return {
    word: w.word,
    hiddenIndices: w.hiddenIndices,
    hintType: w.hintType,
    hintText: w.hintText,
    imageUrl: w.imageUrl,
    audioUrl: w.audioUrl,
  };
}

// Окремий компонент на рядок-слово (не інлайн у .map()) — той самий
// принцип, що ChronologicalOrderItemRow: по-символьний рендер зі своїм
// набором обробників читабельніший окремим компонентом, ніж інлайн.
function LetterGapsWordRow({
  wordItem,
  onUpdateWord,
  onToggleIndex,
  onAutoHide,
  onUpdateHintType,
  onUpdateHintText,
  onUpdateImageUrl,
  onUpdateAudioUrl,
  onRemove,
}: {
  wordItem: EditableWord;
  onUpdateWord: (value: string) => void;
  onToggleIndex: (index: number) => void;
  onAutoHide: (mode: LetterHideMode) => void;
  onUpdateHintType: (value: "definition" | "sentence") => void;
  onUpdateHintText: (value: string) => void;
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
          {image.input && <div className="flex-1">{image.input}</div>}
          {audio.input && <div className="flex-1">{audio.input}</div>}
        </div>
      )}

      {wordItem.word && (
        <div className="flex flex-wrap gap-0.5">
          {wordItem.word.split("").map((char, i) => {
            const isHidden = wordItem.hiddenIndices.includes(i);
            const isProtected = i < protectedPrefixLength(wordItem.word);
            return (
              <button
                key={i}
                type="button"
                disabled={isProtected}
                onClick={() => onToggleIndex(i)}
                title={
                  isProtected
                    ? "Артикль — не приховується"
                    : isHidden
                      ? "Показати цей символ студенту"
                      : "Приховати цей символ"
                }
                className={`h-8 w-8 rounded text-sm font-medium font-content ${
                  isProtected
                    ? "cursor-not-allowed text-neutral-400 dark:text-neutral-600"
                    : isHidden
                      ? "bg-amber-100 text-amber-800 underline decoration-2 dark:bg-amber-900/40 dark:text-amber-300"
                      : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {char}
              </button>
            );
          })}
        </div>
      )}
      <p className={HINT_TEXT}>
        Клікніть на символи, щоб приховати їх від студента (можна ховати будь-що, включно з
        апострофом/дефісом). Артикль на початку слова (un/le/la/les/des/du/de la/l&apos;) ніколи не
        приховується.
      </p>

      {wordItem.word && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={HINT_TEXT}>Приховати автоматично:</span>
          {AUTO_HIDE_OPTIONS.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => onAutoHide(mode)}
              className="text-xs text-blue-700 hover:underline dark:text-blue-400"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Підказка</label>
          <select
            value={wordItem.hintType}
            onChange={(e) => onUpdateHintType(e.target.value as "definition" | "sentence")}
            className={`${INPUT_BORDER} h-10 px-2 text-sm`}
          >
            <option value="definition">Визначення</option>
            <option value="sentence">Речення</option>
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className={LABEL_TEXT}>Текст підказки</label>
          <textarea
            value={wordItem.hintText}
            onChange={(e) => onUpdateHintText(e.target.value)}
            rows={2}
            className={`${INPUT_BORDER} px-2 py-2 text-sm`}
          />
        </div>
      </div>
    </div>
  );
}

export const LetterGapsFields = forwardRef<
  ImportableFieldsHandle & TypeSwitchHandle<LetterGapsConfig>,
  { initialConfig?: Partial<LetterGapsConfig> }
>(function LetterGapsFields({ initialConfig }, ref) {
  const [words, setWords] = useState<EditableWord[]>(
    initialConfig?.words?.length
      ? initialConfig.words.map((w) => ({ ...w, id: crypto.randomUUID() }))
      : [emptyWord()]
  );

  useImperativeHandle(ref, () => ({
    // buildConfigFromVocab (task-config-builder.ts) — те саме мапування
    // word/translation->word/hintText, що раніше було inline тут, тепер
    // спільне з масовим створювачем "Створити вправи зі словника". hintType не чіпаємо
    // (лишається дефолтне "definition" — вчителька сама може змінити
    // вручну). hiddenIndices порожній навмисно: автоприховування — окрема
    // дія (кнопки "Приховати автоматично" нижче), не частина імпорту.
    importWords(imported) {
      const { words: newWords } = buildConfigFromVocab("letter_gaps", imported) as {
        words: LetterGapsWord[];
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
    setWords((prev) =>
      prev.map((w) =>
        w.id === id
          ? // Слово стало коротшим — прибираємо позиції поза межами нової
            // довжини, інакше лишились би "приховані" індекси на неіснуючі
            // символи.
            { ...w, word: value, hiddenIndices: w.hiddenIndices.filter((i) => i < value.length) }
          : w
      )
    );
  }

  function toggleIndex(id: string, index: number) {
    setWords((prev) =>
      prev.map((w) => {
        // Захист про всяк випадок (кнопка на артиклі й так disabled у
        // LetterGapsWordRow, onClick фізично не спрацює) — на випадок
        // програмного виклику з іншого місця в майбутньому.
        if (w.id !== id || index < protectedPrefixLength(w.word)) return w;
        // Відсортовано за зростанням — grade.ts зчитує правильні літери в
        // порядку hiddenIndices, а студент бачить/заповнює їх зліва направо,
        // тож порядок кліків учителя не повинен впливати на перевірку.
        const hiddenIndices = w.hiddenIndices.includes(index)
          ? w.hiddenIndices.filter((i) => i !== index)
          : [...w.hiddenIndices, index].sort((a, b) => a - b);
        return { ...w, hiddenIndices };
      })
    );
  }

  function applyAutoHide(id: string, mode: LetterHideMode) {
    setWords((prev) =>
      prev.map((w) => (w.id === id ? { ...w, hiddenIndices: computeAutoHiddenIndices(w.word, mode) } : w))
    );
  }

  function updateHintType(id: string, value: "definition" | "sentence") {
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, hintType: value } : w)));
  }

  function updateHintText(id: string, value: string) {
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, hintText: value } : w)));
  }

  function updateImageUrl(id: string, value: string) {
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, imageUrl: value } : w)));
  }

  function updateAudioUrl(id: string, value: string) {
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, audioUrl: value } : w)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input
        type="hidden"
        name="letter_gaps_words"
        value={JSON.stringify(words.map(stripId))}
        readOnly
      />

      <InstructionsRichTextField
        name="letter_gaps_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="letter_gaps_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      {words.map((w) => (
        <LetterGapsWordRow
          key={w.id}
          wordItem={w}
          onUpdateWord={(value) => updateWord(w.id, value)}
          onToggleIndex={(index) => toggleIndex(w.id, index)}
          onAutoHide={(mode) => applyAutoHide(w.id, mode)}
          onUpdateHintType={(value) => updateHintType(w.id, value)}
          onUpdateHintText={(value) => updateHintText(w.id, value)}
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

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Бали за завдання</label>
        <input
          type="number"
          min={0}
          step={0.5}
          name="letter_gaps_points"
          defaultValue={initialConfig?.points ?? 1}
          className={`${INPUT_BORDER} w-24 px-2 py-2 text-sm`}
        />
      </div>
    </div>
  );
});
