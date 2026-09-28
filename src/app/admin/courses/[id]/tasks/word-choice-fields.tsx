"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import type { WordChoiceConfig, WordChoiceSentence, WordChoiceOption } from "@/lib/exercises/types";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { WORD_CHOICE_DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";

// Чекбокс, як MultipleChoiceOptionRow — кількість правильних на речення не
// фіксована окремим полем, а лише тим, скільки options позначено correct
// (0/1/кілька); "multiple" на клієнті визначається похідно в sanitize.ts.
function WordChoiceOptionRow({
  option,
  onToggleCorrect,
  onUpdateText,
  onRemove,
}: {
  option: WordChoiceOption;
  onToggleCorrect: () => void;
  onUpdateText: (value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md p-1 ${
        option.correct ? "bg-emerald-50 dark:bg-emerald-950/20" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={option.correct}
        onChange={onToggleCorrect}
        title="Правильний варіант"
      />
      <input
        value={option.text}
        onChange={(e) => onUpdateText(e.target.value)}
        placeholder="Текст варіанту"
        className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Видалити варіант"
        title="Видалити"
        className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function emptySentence(): WordChoiceSentence {
  return {
    id: crypto.randomUUID(),
    sentence: "",
    options: [
      { id: crypto.randomUUID(), text: "", correct: true },
      { id: crypto.randomUUID(), text: "", correct: false },
    ],
  };
}

export const WordChoiceFields = forwardRef<
  TypeSwitchHandle<WordChoiceConfig>,
  { initialConfig?: Partial<WordChoiceConfig> }
>(function WordChoiceFields({ initialConfig }, ref) {
  const [mode, setMode] = useState<"select" | "cross_out">(initialConfig?.mode ?? "select");
  const [sentences, setSentences] = useState<WordChoiceSentence[]>(
    initialConfig?.sentences?.length ? initialConfig.sentences : [emptySentence()]
  );
  const rootRef = useRef<HTMLDivElement>(null);
  // Автозаповнення інструкцій дефолтом при перемиканні РЕЖИМУ (select ↔
  // cross_out) — той самий принцип "не чіпати, якщо редагували", що у
  // task-config-fields.tsx для зміни ТИПУ, лише повністю всередині цього
  // компонента (mode — його ВЛАСНИЙ стан, батько про нього не знає).
  // seedKey форсує ПЕРЕМОНТУВАННЯ InstructionsRichTextField — TipTap бере
  // initialValue лише один раз при монтуванні, іншого API "переписати
  // вміст" зовні немає (той самий прийом, що повне перемонтування *Fields-
  // компонента при зміні типу в батьківському файлі).
  const [instructionsSeed, setInstructionsSeed] = useState<{ instruction: string; subInstruction: string } | null>(
    null
  );
  const [seedKey, setSeedKey] = useState(0);

  function handleModeChange(newMode: "select" | "cross_out") {
    const form = rootRef.current?.closest("form");
    const instrEl = form?.elements.namedItem("word_choice_instructions") as HTMLInputElement | null;
    const subEl = form?.elements.namedItem("word_choice_sub_instructions") as HTMLInputElement | null;
    const liveInstruction = instrEl?.value ?? "";
    const liveSub = subEl?.value ?? "";
    const oldDefault = WORD_CHOICE_DEFAULT_INSTRUCTIONS[mode];
    const newDefault = WORD_CHOICE_DEFAULT_INSTRUCTIONS[newMode];
    setInstructionsSeed({
      instruction: liveInstruction !== "" && liveInstruction !== oldDefault.instruction ? liveInstruction : newDefault.instruction,
      subInstruction:
        liveSub !== "" && liveSub !== oldDefault.subInstruction ? liveSub : newDefault.subInstruction,
    });
    setSeedKey((k) => k + 1);
    setMode(newMode);
  }

  useImperativeHandle(ref, () => ({
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      mode,
      sentences,
      points: initialConfig?.points,
    }),
  }));

  function addSentence() {
    setSentences((prev) => [...prev, emptySentence()]);
  }

  function removeSentence(id: string) {
    setSentences((prev) => prev.filter((s) => s.id !== id));
  }

  function updateSentenceText(id: string, sentence: string) {
    setSentences((prev) => prev.map((s) => (s.id === id ? { ...s, sentence } : s)));
  }

  function addOption(sentenceId: string) {
    setSentences((prev) =>
      prev.map((s) =>
        s.id === sentenceId
          ? { ...s, options: [...s.options, { id: crypto.randomUUID(), text: "", correct: false }] }
          : s
      )
    );
  }

  function removeOption(sentenceId: string, optId: string) {
    setSentences((prev) =>
      prev.map((s) =>
        s.id === sentenceId ? { ...s, options: s.options.filter((o) => o.id !== optId) } : s
      )
    );
  }

  function updateOptionText(sentenceId: string, optId: string, text: string) {
    setSentences((prev) =>
      prev.map((s) =>
        s.id === sentenceId
          ? { ...s, options: s.options.map((o) => (o.id === optId ? { ...o, text } : o)) }
          : s
      )
    );
  }

  function toggleCorrect(sentenceId: string, optId: string) {
    setSentences((prev) =>
      prev.map((s) =>
        s.id === sentenceId
          ? {
              ...s,
              options: s.options.map((o) => (o.id === optId ? { ...o, correct: !o.correct } : o)),
            }
          : s
      )
    );
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input
        type="hidden"
        name="word_choice_sentences"
        value={JSON.stringify(sentences)}
        readOnly
      />

      <InstructionsRichTextField
        key={`instructions-${seedKey}`}
        name="word_choice_instructions"
        label="Інструкція для студента"
        initialValue={instructionsSeed?.instruction ?? initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        key={`sub-instructions-${seedKey}`}
        name="word_choice_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={instructionsSeed?.subInstruction ?? initialConfig?.subInstructions ?? ""}
        compact
      />

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Спосіб взаємодії</label>
        <select
          name="word_choice_mode"
          value={mode}
          onChange={(e) => handleModeChange(e.target.value as "select" | "cross_out")}
          className={`${INPUT_BORDER} px-2 py-2 text-sm`}
        >
          <option value="select">Вибір правильного варіанта</option>
          <option value="cross_out">Викреслення зайвих варіантів</option>
        </select>
      </div>

      <div className="flex flex-col gap-3">
        {sentences.map((s, si) => (
          <div key={s.id} className="rounded-md border border-gray-100 p-2 dark:border-neutral-700">
            <div className="flex items-center justify-between">
              <span className={HINT_TEXT}>Речення {si + 1}</span>
              <button
                type="button"
                onClick={() => removeSentence(s.id)}
                aria-label="Видалити речення"
                title="Видалити речення"
                className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <textarea
              value={s.sentence}
              onChange={(e) => updateSentenceText(s.id, e.target.value)}
              rows={2}
              placeholder="напр. Il {{}} le bus? — {{}} позначає, де вставляється вибір"
              className={`${INPUT_BORDER} mt-2 w-full px-2 py-1 text-base font-medium font-content`}
            />
            <div className="mt-2 flex flex-col gap-1 pl-2">
              <label className={LABEL_TEXT}>
                {mode === "cross_out"
                  ? "Варіанти (позначте правильні — студент викреслюватиме решту)"
                  : "Варіанти (позначте правильні — можна кілька)"}
              </label>
              {s.options.map((o) => (
                <WordChoiceOptionRow
                  key={o.id}
                  option={o}
                  onToggleCorrect={() => toggleCorrect(s.id, o.id)}
                  onUpdateText={(text) => updateOptionText(s.id, o.id, text)}
                  onRemove={() => removeOption(s.id, o.id)}
                />
              ))}
              <button
                type="button"
                onClick={() => addOption(s.id)}
                className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
              >
                + варіант
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addSentence}
          className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + речення
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Бали за завдання</label>
        <input
          type="number"
          min={0}
          step={0.5}
          name="word_choice_points"
          defaultValue={initialConfig?.points ?? 1}
          className={`${INPUT_BORDER} w-24 px-2 py-2 text-sm`}
        />
      </div>
    </div>
  );
});
