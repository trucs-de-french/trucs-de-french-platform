"use client";

import { useState } from "react";
import { firstVocabVariant, type VocabItem } from "@/lib/vocab";
import { BUTTON_SECONDARY } from "@/lib/button-styles";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";

type ImportedWord = { word: string; translation: string; image_url?: string };

// onImport відсутній -> "довідковий" режим (напр. fill_blank): показує
// обрані терміни текстом для ручного копіювання в шаблон, без кнопки
// імпорту й без зміни конфігу.
//
// pairMode — для типів, де ціль імпорту очікує ПАРУ word+translation разом
// (matching/table_fill/flip_cards): дозволяє позначити лише одну колонку
// (напр. тільки французьке слово) — інша сторона піде порожнім рядком,
// вчителька дописує вручну. Для плоских типів (drag_drop/sort_columns/
// reorder/image_match/checkbox_grid/chronological_order, за замовчуванням
// pairMode=false) переклад узагалі не бере участі в імпорті — права колонка
// й надалі клікабельна, просто нічого не змінює (найпростіший варіант —
// без disabled/вимкнення).
export function ImportVocabPanel({
  sceneVocab,
  onImport,
  pairMode = false,
}: {
  sceneVocab: VocabItem[];
  onImport?: (words: ImportedWord[]) => void;
  pairMode?: boolean;
}) {
  const [checkedFr, setCheckedFr] = useState<Set<string>>(new Set());
  const [checkedUk, setCheckedUk] = useState<Set<string>>(new Set());
  const [customWord, setCustomWord] = useState("");
  const [customTranslation, setCustomTranslation] = useState("");
  const [custom, setCustom] = useState<{ word: string; translation: string }[]>([]);

  function toggleFr(word: string) {
    setCheckedFr((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  }

  function toggleUk(word: string) {
    setCheckedUk((prev) => {
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

  // Плоскі типи: лише позначені французькі слова (checkedUk не впливає).
  // Парні типи: об'єднання обох колонок за спільним word-індексом —
  // непозначена сторона піде порожнім рядком, а не парою з чужого рядка.
  const fromScene: ImportedWord[] = pairMode
    ? sceneVocab
        .filter((v) => checkedFr.has(v.word) || checkedUk.has(v.word))
        .map((v) => ({
          word: checkedFr.has(v.word) ? firstVocabVariant(v.word) : "",
          translation: checkedUk.has(v.word) ? v.translation : "",
          image_url: v.image_url,
        }))
    : sceneVocab
        .filter((v) => checkedFr.has(v.word))
        .map((v) => ({
          word: firstVocabVariant(v.word),
          translation: v.translation,
          image_url: v.image_url,
        }));

  const selected: ImportedWord[] = [...fromScene, ...custom];

  function handleImport() {
    if (selected.length === 0 || !onImport) return;
    onImport(selected);
    setCheckedFr(new Set());
    setCheckedUk(new Set());
    setCustom([]);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-gray-100 p-3 dark:border-neutral-700">
      <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
        Імпортувати лексику зі скрипту сцени
      </p>

      {sceneVocab.length > 0 ? (
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <span>Французька</span>
            <span>Переклад</span>
          </div>
          {sceneVocab.map((v) => (
            <div key={v.word} className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checkedFr.has(v.word)}
                  onChange={() => toggleFr(v.word)}
                />
                <span>{firstVocabVariant(v.word)}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checkedUk.has(v.word)}
                  onChange={() => toggleUk(v.word)}
                />
                <span>{v.translation}</span>
              </label>
            </div>
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
                {v.word} — {v.translation}
              </p>
            ))}
          </div>
        )
      )}
    </div>
  );
}
