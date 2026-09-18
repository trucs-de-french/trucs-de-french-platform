"use client";

import { useState } from "react";
import { firstVocabVariant, type VocabItem } from "@/lib/vocab";
import { BUTTON_SECONDARY } from "@/lib/button-styles";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";

// onImport відсутній -> "довідковий" режим (напр. fill_blank): показує
// обрані терміни текстом для ручного копіювання в шаблон, без кнопки
// імпорту й без зміни конфігу.
export function ImportVocabPanel({
  sceneVocab,
  onImport,
}: {
  sceneVocab: VocabItem[];
  onImport?: (words: { word: string; translation: string; image_url?: string }[]) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [customWord, setCustomWord] = useState("");
  const [customTranslation, setCustomTranslation] = useState("");
  const [custom, setCustom] = useState<{ word: string; translation: string }[]>([]);

  function toggle(word: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  }

  function addCustom() {
    if (!customWord.trim() || !customTranslation.trim()) return;
    setCustom((prev) => [
      ...prev,
      { word: customWord.trim(), translation: customTranslation.trim() },
    ]);
    setCustomWord("");
    setCustomTranslation("");
  }

  function removeCustom(i: number) {
    setCustom((prev) => prev.filter((_, idx) => idx !== i));
  }

  const selected = [
    ...sceneVocab.filter((v) => checked.has(v.word)),
    ...custom,
  ];

  function handleImport() {
    if (selected.length === 0 || !onImport) return;
    // custom-терміни (вписані вручну тут же) не мають image_url — це поле
    // передається лише для елементів з sceneVocab, де воно вже могло бути
    // заповнене в редакторі скрипту сцени (dialogue-editor.tsx).
    onImport(
      selected.map((v) => ({
        word: firstVocabVariant(v.word),
        translation: v.translation,
        image_url: (v as VocabItem).image_url,
      }))
    );
    setChecked(new Set());
    setCustom([]);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-gray-100 p-3 dark:border-neutral-700">
      <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
        Імпортувати лексику зі скрипту сцени
      </p>

      {sceneVocab.length > 0 ? (
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          {sceneVocab.map((v) => (
            <label key={v.word} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={checked.has(v.word)} onChange={() => toggle(v.word)} />
              <span>
                {firstVocabVariant(v.word)} — {v.translation}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className={HINT_TEXT}>
          У скрипті цієї сцени ще немає позначеної лексики.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Свій термін — слово</label>
          <input
            value={customWord}
            onChange={(e) => setCustomWord(e.target.value)}
            className={`${INPUT_BORDER} px-2 py-2 text-sm`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Переклад</label>
          <input
            value={customTranslation}
            onChange={(e) => setCustomTranslation(e.target.value)}
            className={`${INPUT_BORDER} px-2 py-2 text-sm`}
          />
        </div>
        <button
          type="button"
          onClick={addCustom}
          className="text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + додати термін
        </button>
      </div>

      {custom.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {custom.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              <span>
                {c.word} — {c.translation}
              </span>
              <button
                type="button"
                onClick={() => removeCustom(i)}
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                видалити
              </button>
            </li>
          ))}
        </ul>
      )}

      {onImport ? (
        <button
          type="button"
          onClick={handleImport}
          disabled={selected.length === 0}
          className={`self-start ${BUTTON_SECONDARY}`}
        >
          Імпортувати {selected.length > 0 ? `(${selected.length})` : ""}
        </button>
      ) : (
        selected.length > 0 && (
          <div className="rounded-md bg-neutral-100 p-2 text-xs dark:bg-neutral-800">
            <p className="mb-1 font-medium text-neutral-600 dark:text-neutral-400">
              Довідка — впишіть потрібне в шаблон вручну:
            </p>
            {selected.map((v, i) => (
              <p key={i}>
                {firstVocabVariant(v.word)} — {v.translation}
              </p>
            ))}
          </div>
        )
      )}
    </div>
  );
}
