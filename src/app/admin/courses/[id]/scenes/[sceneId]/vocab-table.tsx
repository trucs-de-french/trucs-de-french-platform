"use client";

import { ArrowRight, Trash2 } from "lucide-react";
import { FileUpload } from "@/components/file-upload";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { INPUT_BORDER } from "@/lib/input-styles";
import { HINT_TEXT } from "@/lib/typography-styles";
import { useDialogueState } from "./dialogue-state";

// Плоский, редагований список усіх vocab-записів зі "Скрипту" цієї сцени —
// той самий lines-стан, що DialogueEditor (через useDialogueState),
// редагування тут мутує ОДИН і той самий масив, що й підредактор словника в
// "Скрипті". Додавання НОВИХ слів лишається виключно там (кнопка "+ слово в
// лексику" при конкретній репліці) — у плоскій таблиці немає природного
// способу вибрати, до якої репліки прив'язати новий запис.
export function VocabTable() {
  const { lines, updateVocab, removeVocab } = useDialogueState();

  const rows = lines.flatMap((line, lineIndex) =>
    line.vocab.map((v, vocabIndex) => ({ line, lineIndex, vocabIndex, v }))
  );

  if (rows.length === 0) {
    return (
      <p className={HINT_TEXT}>
        Немає лексики — додайте через &quot;+ слово в лексику&quot; в блоці &quot;Скрипт&quot;.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map(({ line, lineIndex, vocabIndex, v }) => (
        <div
          key={v.id ?? `${lineIndex}-${vocabIndex}`}
          className="flex flex-col gap-1 rounded-md border border-gray-100 p-2 dark:border-neutral-700"
        >
          <p className={`${HINT_TEXT} truncate`}>
            {line.speaker || "—"}: {line.text}
          </p>
          <div className="flex items-center gap-2">
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
          {line.translationUk && (
            <input
              placeholder="Форма в перекладі (як виглядає у перекладі цієї репліки)"
              value={v.translatedForm ?? ""}
              onChange={(e) => updateVocab(lineIndex, vocabIndex, "translatedForm", e.target.value)}
              className={`${INPUT_BORDER} w-full max-w-md px-2 py-2 text-xs text-neutral-600 dark:text-neutral-400`}
            />
          )}
          <div className="flex items-start gap-1">
            <div className="flex w-full max-w-md items-center gap-1">
              <input
                placeholder="Посилання на картинку (необов'язково)"
                value={v.image_url ?? ""}
                onChange={(e) => updateVocab(lineIndex, vocabIndex, "image_url", e.target.value)}
                className={`${INPUT_BORDER} ml-0 w-full px-2 py-2 text-xs text-neutral-600 dark:text-neutral-400`}
              />
              <FileUpload
                kind="image"
                variant="icon"
                onUploaded={(url) => updateVocab(lineIndex, vocabIndex, "image_url", url)}
              />
            </div>
            <ImageOrPlaceholder
              src={v.image_url}
              alt="Прев'ю"
              className="h-12 w-12 shrink-0 rounded object-cover"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
