"use client";

import { useState } from "react";
import type { EssayFormulaireConfig, EssayFormulaireField } from "@/lib/exercises/types";

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
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Інструкція для студента
        </label>
        <textarea
          name="essay_formulaire_instructions"
          rows={2}
          defaultValue={initialConfig?.instructions ?? ""}
          placeholder="напр. Заповніть формуляр реєстрації"
          className="rounded-md border px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Пункти консигни (кожен = 1 бал)
        </label>
        {fields.map((f) => (
          <div key={f.id} className="flex items-center gap-2">
            <input
              value={f.label}
              onChange={(e) => updateLabel(f.id, e.target.value)}
              placeholder="напр. Prénom"
              className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
            />
            <button
              type="button"
              onClick={() => removeField(f.id)}
              className="text-xs text-red-600 hover:underline dark:text-red-400"
            >
              видалити
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
