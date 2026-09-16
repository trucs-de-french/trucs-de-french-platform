"use client";

import { ArrowRight, Trash2 } from "lucide-react";
import { useFileOrLink } from "@/components/file-or-link-field";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { INPUT_BORDER } from "@/lib/input-styles";
import { PART_OF_SPEECH_ORDER, PART_OF_SPEECH_LABELS_FR } from "@/lib/vocab";
import { useDialogueState } from "./dialogue-state";

// Спільні поля одного VocabItem — раніше буквально задубльовані в
// dialogue-editor.tsx (підредактор словника при репліці) і vocab-table.tsx
// (плоска таблиця "Вокабуляр"), обидва й так читають/пишуть той самий
// lines-стан через useDialogueState(). Без власного зовнішнього
// border/padding-обгортки — кожен викликач додає свою (у dialogue-editor.tsx
// це прозора рамка навколо одного vocab-запису репліки, у vocab-table.tsx —
// видима рамка + рядок контексту "спікер: текст" над полями).
//
// onTakeTranslationSelection — опційний: доступний лише там, де поруч є
// textarea перекладу репліки, з якої можна прочитати виділення
// (dialogue-editor.tsx). У плоскій таблиці такої textarea немає — кнопка
// просто не рендериться.
export function VocabItemRow({
  lineIndex,
  vocabIndex,
  onTakeTranslationSelection,
}: {
  lineIndex: number;
  vocabIndex: number;
  onTakeTranslationSelection?: () => void;
}) {
  const { lines, updateVocab, removeVocab } = useDialogueState();
  const line = lines[lineIndex];
  const v = line.vocab[vocabIndex];
  const { icons, input } = useFileOrLink({
    kind: "image",
    mode: "controlled",
    value: v.image_url ?? "",
    onChange: (url) => updateVocab(lineIndex, vocabIndex, "image_url", url),
    placeholder: "Посилання на картинку",
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          placeholder="Слово/фраза"
          value={v.word}
          onChange={(e) => updateVocab(lineIndex, vocabIndex, "word", e.target.value)}
          className={`${INPUT_BORDER} w-40 px-2 py-2 text-sm font-content`}
        />
        <ArrowRight size={16} className="shrink-0 text-neutral-400 dark:text-neutral-500" />
        <input
          placeholder="Переклад"
          value={v.translation}
          onChange={(e) => updateVocab(lineIndex, vocabIndex, "translation", e.target.value)}
          className={`${INPUT_BORDER} w-48 px-2 py-2 text-sm font-content`}
        />
        <select
          value={v.partOfSpeech ?? ""}
          onChange={(e) => updateVocab(lineIndex, vocabIndex, "partOfSpeech", e.target.value)}
          title="Частина мови"
          className={`${INPUT_BORDER} w-28 px-1 py-2 text-xs`}
        >
          <option value="">—</option>
          {PART_OF_SPEECH_ORDER.map((pos) => (
            <option key={pos} value={pos}>
              {PART_OF_SPEECH_LABELS_FR[pos]}
            </option>
          ))}
        </select>
        {line.translationUk && (
          <>
            <input
              placeholder="Форма в перекладі"
              value={v.translatedForm ?? ""}
              onChange={(e) => updateVocab(lineIndex, vocabIndex, "translatedForm", e.target.value)}
              className={`${INPUT_BORDER} w-32 px-2 py-2 text-xs text-neutral-600 dark:text-neutral-400`}
            />
            {onTakeTranslationSelection && (
              <button
                type="button"
                onClick={onTakeTranslationSelection}
                className="shrink-0 whitespace-nowrap text-xs text-blue-700 hover:underline dark:text-blue-400"
              >
                Взяти виділене
              </button>
            )}
          </>
        )}
        {icons}
        <button
          type="button"
          onClick={() => removeVocab(lineIndex, vocabIndex)}
          aria-label="Видалити слово"
          title="Видалити"
          className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="flex items-start gap-1">
        {input}
        <ImageOrPlaceholder
          src={v.image_url}
          alt="Прев'ю"
          className="h-12 w-12 shrink-0 rounded object-cover"
        />
      </div>
    </>
  );
}
