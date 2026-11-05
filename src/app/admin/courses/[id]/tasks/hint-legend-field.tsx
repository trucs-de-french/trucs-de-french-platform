"use client";

import { useState } from "react";
import { hintExplanationText } from "@/components/exercises/hint-explanation";
import { useT } from "@/lib/i18n/context";
import { LABEL_TEXT } from "@/lib/typography-styles";
import { INPUT_BORDER } from "@/lib/input-styles";

const LEGEND_MAX_LENGTH = 200;

type HintLegendValue = { uk?: string; fr?: string; en?: string };

// Задача "Constructor: editable hint-legend field (uk/fr/en) with
// defaults" — одне поле для всіх типів із лампочкою-підказкою (той самий
// принцип уніфікації, що на студентській стороні: TaskPanelHeader/
// hint-explanation.tsx — одне місце для рендеру, тут — одне місце для
// редагування). taskType — ключ HINT_EXPLANATION_KEYS (hints.ts), той
// самий, що передається в hintExplanationText() на студентській сторінці
// — звідси й беруться дефолтні тексти для попереднього заповнення.
// fieldNamePrefix — базове ім'я input'ів цього типу вправи (напр.
// "table_fill"), той самий принцип, що table_fill_instructions/
// table_fill_rows: приховане поле "<prefix>_hint_legend" несе JSON
// {uk,fr,en}, який buildTaskConfig (task-config-builder.ts) розпаковує в
// config.hintLegend. Завжди серіалізуємо всі 3 мови (навіть якщо значення
// збігається з дефолтом) — простіше й безпечніше за діф-перевірку, і
// студентський рендер однаково трактує порожній/відсутній рядок як "узяти
// дефолт" (п.3 задачі).
export function HintLegendField({
  taskType,
  fieldNamePrefix,
  initialValue,
}: {
  taskType: string;
  fieldNamePrefix: string;
  initialValue?: HintLegendValue;
}) {
  const { t } = useT();
  const defaults = {
    uk: hintExplanationText(taskType, "uk") ?? "",
    fr: hintExplanationText(taskType, "fr") ?? "",
    en: hintExplanationText(taskType, "en") ?? "",
  };
  const [value, setValue] = useState<Required<HintLegendValue>>({
    uk: initialValue?.uk || defaults.uk,
    fr: initialValue?.fr || defaults.fr,
    en: initialValue?.en || defaults.en,
  });

  function update(lang: "uk" | "fr" | "en", text: string) {
    setValue((prev) => ({ ...prev, [lang]: text }));
  }

  function reset(lang: "uk" | "fr" | "en") {
    setValue((prev) => ({ ...prev, [lang]: defaults[lang] }));
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-100 p-3 dark:border-neutral-700">
      <input
        type="hidden"
        name={`${fieldNamePrefix}_hint_legend`}
        value={JSON.stringify({
          uk: value.uk.trim(),
          fr: value.fr.trim(),
          en: value.en.trim(),
        })}
        readOnly
      />
      <label className={LABEL_TEXT}>{t("hintLegendField.label")}</label>
      {(["uk", "fr", "en"] as const).map((lang) => (
        <div key={lang} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className={`${LABEL_TEXT} uppercase`}>{lang}</span>
            <button
              type="button"
              onClick={() => reset(lang)}
              className="text-xs text-blue-700 hover:underline dark:text-blue-400"
            >
              {t("hintLegendField.reset")}
            </button>
          </div>
          <input
            value={value[lang]}
            onChange={(e) => update(lang, e.target.value.slice(0, LEGEND_MAX_LENGTH))}
            maxLength={LEGEND_MAX_LENGTH}
            className={`${INPUT_BORDER} px-2 py-1.5 text-sm`}
          />
        </div>
      ))}
    </div>
  );
}
