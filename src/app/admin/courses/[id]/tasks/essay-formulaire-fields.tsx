"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { EssayFormulaireConfig, EssayFormulaireField } from "@/lib/exercises/types";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT } from "@/lib/typography-styles";

export function EssayFormulaireFields({
  initialConfig,
}: {
  initialConfig?: Partial<EssayFormulaireConfig>;
}) {
  const [fields, setFields] = useState<EssayFormulaireField[]>(
    initialConfig?.fields?.length ? initialConfig.fields : [{ id: crypto.randomUUID(), label: "" }]
  );

  function addField() {
    setFields((prev) => [...prev, { id: crypto.randomUUID(), label: "" }]);
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  function updateLabel(id: string, label: string) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, label } : f)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="essay_formulaire_fields" value={JSON.stringify(fields)} readOnly />

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>
          Інструкція для студента
        </label>
        <textarea
          name="essay_formulaire_instructions"
          rows={2}
          defaultValue={initialConfig?.instructions ?? ""}
          placeholder="напр. Заповніть формуляр реєстрації"
          className={`${INPUT_BORDER} px-2 py-1.5 text-sm`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>
          Пункти консигни (кожен = 1 бал)
        </label>
        {fields.map((f) => (
          <div key={f.id} className="flex items-center gap-2">
            <input
              value={f.label}
              onChange={(e) => updateLabel(f.id, e.target.value)}
              placeholder="напр. Prénom"
              className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium`}
            />
            <button
              type="button"
              onClick={() => removeField(f.id)}
              aria-label="Видалити пункт"
              title="Видалити"
              className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addField}
          className="mt-1 self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + пункт
        </button>
      </div>
    </div>
  );
}
