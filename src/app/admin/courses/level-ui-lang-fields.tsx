"use client";

import { useState } from "react";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";
import { BUTTON_PRIMARY_SM, BUTTON_SECONDARY_SM } from "@/lib/button-styles";
import { CEFR_LEVELS } from "@/lib/ui/product-lang";

type Props = {
  type: string;
  initialLevels: string[];
  initialUiLang: string;
  initialDelfLevel: string | null;
};

// Спільні поля "Рівні"/"Мова інтерфейсу" для форм створення й редагування
// курсу (course-type-fields.tsx, [id]/page.tsx) — для DELF-продуктів тут же
// лишається стара одинична "Рівень DELF" (name="level", той самий select,
// що й раніше читає api/delf/check), тепер керована цим же станом: чіпи
// levels односторонньо визначають її значення (найнижчий обраний рівень),
// ручне редагування самого select НЕ зворотньо впливає на чіпи — найпростіший
// безпечний варіант синхронізації без ризику розсинхрону двох джерел правди.
export function LevelUiLangFields({ type, initialLevels, initialUiLang, initialDelfLevel }: Props) {
  const [levels, setLevels] = useState<string[]>(initialLevels);
  const [uiLang, setUiLang] = useState(initialUiLang);
  const [delfLevel, setDelfLevel] = useState(initialDelfLevel ?? "");

  // "Adjusting state when a prop changes", під час рендеру, а не в ефекті
  // (react-hooks/set-state-in-effect) — "Тип курсу" щойно перемкнули на
  // DELF і жоден чіп ще не обраний: ставимо той самий дефолт "A1", що
  // раніше був у defaultValue старого select.
  const [prevType, setPrevType] = useState(type);
  if (type !== prevType) {
    setPrevType(type);
    if (type === "delf" && delfLevel === "" && levels.length === 0) {
      setDelfLevel("A1");
      setLevels(["A1"]);
    }
  }

  function toggleLevel(level: string) {
    setLevels((prev) => {
      const next = prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level];
      if (type === "delf") {
        const lowest = CEFR_LEVELS.find((l) => next.includes(l));
        setDelfLevel(lowest ?? "");
      }
      return next;
    });
  }


  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Рівні</label>
        <div className="flex flex-wrap gap-2">
          {CEFR_LEVELS.map((level) => {
            const active = levels.includes(level);
            return (
              <button
                key={level}
                type="button"
                onClick={() => toggleLevel(level)}
                aria-pressed={active}
                className={active ? BUTTON_PRIMARY_SM : BUTTON_SECONDARY_SM}
              >
                {level}
              </button>
            );
          })}
        </div>
        {levels.map((level) => (
          <input key={level} type="hidden" name="levels" value={level} />
        ))}
      </div>

      {type === "delf" && (
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Рівень DELF</label>
          <select
            name="level"
            required
            value={delfLevel}
            onChange={(e) => setDelfLevel(e.target.value)}
            className={`${INPUT_BORDER} px-3 py-2`}
          >
            <option value="" disabled>
              Оберіть рівень
            </option>
            {CEFR_LEVELS.filter((l) => l === "A1" || l === "A2" || l === "B1" || l === "B2").map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Мова інтерфейсу</label>
        <div className="flex gap-2">
          {(["uk", "fr", "en"] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setUiLang(lang)}
              aria-pressed={uiLang === lang}
              className={uiLang === lang ? BUTTON_PRIMARY_SM : BUTTON_SECONDARY_SM}
            >
              {lang === "uk" ? "Українська" : lang === "fr" ? "Français" : "English"}
            </button>
          ))}
        </div>
        <input type="hidden" name="ui_lang" value={uiLang} />
        <p className={HINT_TEXT}>
          Кнопки, підказки та написи в завданнях цього продукту. Українські ключі в самих завданнях не змінюються.
        </p>
      </div>
    </div>
  );
}
