"use client";

import { useState } from "react";
import { firstVocabVariant, type VocabItem } from "@/lib/vocab";
import { BUTTON_SECONDARY } from "@/lib/button-styles";
import { HINT_TEXT } from "@/lib/typography-styles";

type ImportedWord = { word: string; translation: string; image_url?: string };

// onImport відсутній -> "довідковий" режим (напр. fill_blank): показує
// обрані терміни текстом для ручного копіювання в шаблон, без кнопки
// імпорту й без зміни конфігу.
//
// pairMode — для типів, де ціль імпорту очікує ПАРУ word+translation разом
// (matching/table_fill/flip_cards): дозволяє позначити лише одну колонку
// (напр. тільки французьке слово) — інша сторона піде порожнім рядком,
// вчителька дописує вручну.
//
// showTranslationColumn=false — для типів, де в конфігурації елемента
// узагалі немає поля під переклад/підказку (drag_drop/sort_columns/reorder/
// image_match/checkbox_grid/chronological_order): колонка "Переклад" не
// рендериться зовсім, щоб позначена галочка не створювала враження, ніби
// переклад кудись збережеться, хоча насправді importWords цього типу його
// просто не читає. Типи з реальним полем підказки на рівні елемента
// (letter_gaps/letter_rearrangement — hintText; word_search/crossword —
// translation/clue; PAIR_TYPES вище) лишаються з видимою колонкою.
export function ImportVocabPanel({
  sceneVocab,
  onImport,
  pairMode = false,
  showTranslationColumn = true,
}: {
  sceneVocab: VocabItem[];
  onImport?: (words: ImportedWord[]) => void;
  pairMode?: boolean;
  // false — для типів, де переклад узагалі нікуди не потрапляє (немає ані
  // pairMode-поля, ані підказки на рівні елемента: drag_drop/sort_columns/
  // reorder/checkbox_grid/chronological_order/image_match) — колонка
  // "Переклад" тоді просто НЕ рендериться, щоб галочка не створювала
  // хибного очікування, що переклад кудись збережеться.
  showTranslationColumn?: boolean;
}) {
  const [checkedFr, setCheckedFr] = useState<Set<string>>(new Set());
  const [checkedUk, setCheckedUk] = useState<Set<string>>(new Set());

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

  // Плоскі типи: лише позначені французькі слова визначають, які рядки
  // взагалі потраплять в імпорт (checkedUk не впливає на ФІЛЬТР — word
  // завжди обов'язковий, жодних порожніх word, на відміну від pairMode).
  // checkedUk усе одно впливає на translation того самого рядка (спільний
  // індекс v) — переважна більшість плоских типів це поле просто
  // відкидають у своєму importWords (тож для них ця умова непомітна), але
  // типи, яким усе-таки потрібен опційний переклад разом зі словом (напр.
  // word_search), отримують його безкоштовно, без нового прапорця.
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
          translation: checkedUk.has(v.word) ? v.translation : "",
          image_url: v.image_url,
        }));

  const selected: ImportedWord[] = fromScene;

  function handleImport() {
    if (selected.length === 0 || !onImport) return;
    onImport(selected);
    setCheckedFr(new Set());
    setCheckedUk(new Set());
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-gray-100 p-3 dark:border-neutral-700">
      <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
        Імпортувати лексику зі скрипту сцени
      </p>

      {sceneVocab.length > 0 ? (
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          <div
            className={`gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 ${
              showTranslationColumn ? "grid grid-cols-2" : ""
            }`}
          >
            <span>Французька</span>
            {showTranslationColumn && <span>Переклад</span>}
          </div>
          {sceneVocab.map((v) => (
            <div
              key={v.word}
              className={`gap-2 text-sm ${showTranslationColumn ? "grid grid-cols-2" : ""}`}
            >
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checkedFr.has(v.word)}
                  onChange={() => toggleFr(v.word)}
                />
                <span>{firstVocabVariant(v.word)}</span>
              </label>
              {showTranslationColumn && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checkedUk.has(v.word)}
                    onChange={() => toggleUk(v.word)}
                  />
                  <span>{v.translation}</span>
                </label>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className={HINT_TEXT}>
          У скрипті цієї сцени ще немає позначеної лексики.
        </p>
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
