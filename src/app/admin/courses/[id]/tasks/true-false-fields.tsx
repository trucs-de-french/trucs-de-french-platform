"use client";

import { ICON_BUTTON_DANGER } from "@/lib/button-styles";
import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import type { TrueFalseConfig, TrueFalseStatement } from "@/lib/exercises/types";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";
import { ConstructorBlock } from "./constructor-block";

export function TrueFalseFields({
  initialConfig,
  pointsVisibilityCheckbox,
}: {
  initialConfig?: Partial<TrueFalseConfig>;
  pointsVisibilityCheckbox?: ReactNode;
}) {
  const [statements, setStatements] = useState<TrueFalseStatement[]>(
    initialConfig?.statements?.length
      ? initialConfig.statements
      : [{ id: crypto.randomUUID(), text: "", answer: true }]
  );

  function addStatement() {
    setStatements((prev) => [...prev, { id: crypto.randomUUID(), text: "", answer: true }]);
  }

  function removeStatement(id: string) {
    setStatements((prev) => prev.filter((s) => s.id !== id));
  }

  function updateText(id: string, text: string) {
    setStatements((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  }

  function updateAnswer(id: string, answer: boolean) {
    setStatements((prev) => prev.map((s) => (s.id === id ? { ...s, answer } : s)));
  }

  function updatePoints(id: string, points: number) {
    setStatements((prev) => prev.map((s) => (s.id === id ? { ...s, points } : s)));
  }

  return (
    <>
      <input type="hidden" name="tf_statements" value={JSON.stringify(statements)} readOnly />

      <ConstructorBlock
        n={2}
        title="Інструкція для студента"
        description="Французькою, українською та англійською"
        tone="instruction"
      >
        <InstructionsRichTextField
          name="tf_instructions"
          label="Інструкція для студента"
          initialValue={initialConfig?.instructions ?? ""}
        />

        <InstructionsRichTextField
          name="tf_sub_instructions"
          label="Додаткові інструкції (опційно)"
          initialValue={initialConfig?.subInstructions ?? ""}
          compact
        />

        <InstructionsRichTextField
          name="tf_sub_instructions_en"
          label="Переклад завдання англійською (для англомовного інтерфейсу)"
          initialValue={initialConfig?.subInstructionsEn ?? ""}
          compact
        />
      </ConstructorBlock>

      {pointsVisibilityCheckbox && (
        <ConstructorBlock n={3} title="Бали та підказки" description="Оцінювання" tone="points">
          {pointsVisibilityCheckbox}
        </ConstructorBlock>
      )}

      <ConstructorBlock
        n={4}
        title="Варіанти вправи"
        description="Твердження Vrai / Faux"
        tone="content"
      >
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Твердження</label>
          {statements.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <input
                value={s.text}
                onChange={(e) => updateText(s.id, e.target.value)}
                placeholder="Текст твердження"
                className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
              />
              <select
                value={String(s.answer)}
                onChange={(e) => updateAnswer(s.id, e.target.value === "true")}
                className={`${INPUT_BORDER} px-2 py-2 text-sm`}
              >
                <option value="true">Vrai</option>
                <option value="false">Faux</option>
              </select>
              <span className={HINT_TEXT}>Бали</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={s.points ?? 1}
                onChange={(e) => updatePoints(s.id, Number(e.target.value))}
                title="Бали за це твердження"
                className={`${INPUT_BORDER} w-16 px-2 py-2 text-sm`}
              />
              <button
                type="button"
                onClick={() => removeStatement(s.id)}
                aria-label="Видалити твердження"
                title="Видалити"
                className={ICON_BUTTON_DANGER}
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addStatement}
            className="mt-1 self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
          >
            + твердження
          </button>
        </div>
      </ConstructorBlock>
    </>
  );
}
