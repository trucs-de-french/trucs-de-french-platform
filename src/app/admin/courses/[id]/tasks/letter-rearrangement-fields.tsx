"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2 } from "lucide-react";
import type { LetterRearrangementConfig, LetterRearrangementWord } from "@/lib/exercises/types";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import type { ImportableFieldsHandle } from "./importable-fields";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { useFileOrLink } from "@/components/file-or-link-field";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT } from "@/lib/typography-styles";

type EditableWord = LetterRearrangementWord & { id: string };

function emptyWord(): EditableWord {
  return { id: crypto.randomUUID(), word: "", hintType: "definition", hintText: "", imageUrl: "", audioUrl: "" };
}

function stripId(w: EditableWord): LetterRearrangementWord {
  return {
    word: w.word,
    hintType: w.hintType,
    hintText: w.hintText,
    imageUrl: w.imageUrl,
    audioUrl: w.audioUrl,
  };
}

// Окремий компонент на рядок-слово (не інлайн у .map()) — useFileOrLink це
// хук, викликати його всередині callback .map() було б порушенням правил
// хуків. Простіший за LetterGapsWordRow: переставляється ВСЕ слово, тож
// клікабельних символів/hiddenIndices тут нема взагалі.
function LetterRearrangementWordRow({
  wordItem,
  onUpdateWord,
  onUpdateHintType,
  onUpdateHintText,
  onUpdateImageUrl,
  onUpdateAudioUrl,
  onRemove,
}: {
  wordItem: EditableWord;
  onUpdateWord: (value: string) => void;
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

export const LetterRearrangementFields = forwardRef<
  ImportableFieldsHandle & TypeSwitchHandle<LetterRearrangementConfig>,
  { initialConfig?: Partial<LetterRearrangementConfig> }
>(function LetterRearrangementFields({ initialConfig }, ref) {
  const [words, setWords] = useState<EditableWord[]>(
    initialConfig?.words?.length
      ? initialConfig.words.map((w) => ({ ...w, id: crypto.randomUUID() }))
      : [emptyWord()]
  );

  useImperativeHandle(ref, () => ({
    // На відміну від sort_columns/reorder (де в елемента взагалі немає поля
    // під переклад) — тут воно є (hintText), тож переклад із позначеної
    // укр-колонки йде прямо туди. hintType не чіпаємо (лишається дефолтне
    // "definition" — сам тип підказки вчителька й так може змінити вручну).
    importWords(imported) {
      setWords((prev) => {
        const withoutEmpty = prev.filter((w) => w.word.trim());
        return [
          ...withoutEmpty,
          ...imported.map((w) => ({
            id: crypto.randomUUID(),
            word: w.word,
            hintType: "definition" as const,
            hintText: w.translation,
          })),
        ];
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
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, word: value } : w)));
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
        name="letter_rearrangement_words"
        value={JSON.stringify(words.map(stripId))}
        readOnly
      />

      <InstructionsRichTextField
        name="letter_rearrangement_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="letter_rearrangement_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      {words.map((w) => (
        <LetterRearrangementWordRow
          key={w.id}
          wordItem={w}
          onUpdateWord={(value) => updateWord(w.id, value)}
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
          name="letter_rearrangement_points"
          defaultValue={initialConfig?.points ?? 1}
          className={`${INPUT_BORDER} w-24 px-2 py-2 text-sm`}
        />
      </div>
    </div>
  );
});
