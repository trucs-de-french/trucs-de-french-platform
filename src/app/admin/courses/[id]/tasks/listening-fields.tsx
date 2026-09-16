"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2 } from "lucide-react";
import type { ListeningConfig, ListeningQuestion, ListeningOption } from "@/lib/exercises/types";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { useFileOrLink } from "@/components/file-or-link-field";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";

// Окремий компонент (не інлайн у .map()) — useFileOrLink це хук, викликати
// його всередині callback .map() було б порушенням правил хуків.
function ListeningOptionRow({
  option,
  questionId,
  onSetCorrect,
  onUpdateText,
  onUpdateImageUrl,
  onRemove,
}: {
  option: ListeningOption;
  questionId: string;
  onSetCorrect: () => void;
  onUpdateText: (value: string) => void;
  onUpdateImageUrl: (url: string) => void;
  onRemove: () => void;
}) {
  const { icons, input } = useFileOrLink({
    kind: "image",
    mode: "controlled",
    value: option.imageUrl ?? "",
    onChange: onUpdateImageUrl,
    placeholder: "URL картинки (опційно)",
  });

  return (
    <div
      className={`flex flex-col gap-1 rounded-md p-1 ${
        option.correct ? "bg-emerald-50 dark:bg-emerald-950/20" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <input
          type="radio"
          name={`listening_correct_${questionId}`}
          checked={option.correct}
          onChange={onSetCorrect}
          title="Правильна відповідь"
        />
        <input
          value={option.text}
          onChange={(e) => onUpdateText(e.target.value)}
          placeholder="Варіант відповіді"
          className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
        />
        {icons}
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
      <div className="flex items-start gap-1 pl-6">
        {input}
        <ImageOrPlaceholder
          src={option.imageUrl}
          alt="Прев'ю"
          className="h-12 w-12 shrink-0 rounded object-cover"
        />
      </div>
    </div>
  );
}

function emptyQuestion(): ListeningQuestion {
  return {
    id: crypto.randomUUID(),
    question: "",
    options: [
      { id: crypto.randomUUID(), text: "", correct: true },
      { id: crypto.randomUUID(), text: "", correct: false },
    ],
  };
}

export const ListeningFields = forwardRef<
  TypeSwitchHandle<ListeningConfig>,
  { initialConfig?: Partial<ListeningConfig> }
>(function ListeningFields({ initialConfig }, ref) {
  const [questions, setQuestions] = useState<ListeningQuestion[]>(
    initialConfig?.questions?.length ? initialConfig.questions : [emptyQuestion()]
  );

  // audioUrl — неконтрольований input (defaultValue), живого стану нема,
  // тож не переноситься нікуди при зміні типу — той самий компроміс, що
  // instructions у MultipleChoiceFields.
  useImperativeHandle(ref, () => ({
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      questions,
    }),
  }));

  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function updateQuestionText(id: string, text: string) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, question: text } : q)));
  }

  function updateQuestionPoints(id: string, points: number) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, points } : q)));
  }

  function addOption(qId: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? { ...q, options: [...q.options, { id: crypto.randomUUID(), text: "", correct: false }] }
          : q
      )
    );
  }

  function removeOption(qId: string, oId: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId ? { ...q, options: q.options.filter((o) => o.id !== oId) } : q
      )
    );
  }

  function updateOptionText(qId: string, oId: string, text: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? { ...q, options: q.options.map((o) => (o.id === oId ? { ...o, text } : o)) }
          : q
      )
    );
  }

  function updateOptionImageUrl(qId: string, oId: string, imageUrl: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? { ...q, options: q.options.map((o) => (o.id === oId ? { ...o, imageUrl } : o)) }
          : q
      )
    );
  }

  function setCorrectOption(qId: string, oId: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? { ...q, options: q.options.map((o) => ({ ...o, correct: o.id === oId })) }
          : q
      )
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="listening_questions" value={JSON.stringify(questions)} readOnly />

      <InstructionsRichTextField
        name="listening_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="listening_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>URL аудіо/відео</label>
        <input
          name="listening_audio_url"
          defaultValue={initialConfig?.audioUrl ?? ""}
          placeholder="пряме посилання на mp3 або YouTube"
          className={`${INPUT_BORDER} px-2 py-2 text-sm`}
        />
      </div>

      <div className="flex flex-col gap-3">
        <label className={LABEL_TEXT}>
          Питання (одна правильна відповідь на питання)
        </label>
        {questions.map((q) => (
          <div key={q.id} className="rounded-md border border-gray-100 p-2 dark:border-neutral-700">
            <div className="flex items-center gap-2">
              <input
                value={q.question}
                onChange={(e) => updateQuestionText(q.id, e.target.value)}
                placeholder="Текст питання"
                className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
              />
              <span className={HINT_TEXT}>Бали</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={q.points ?? 1}
                onChange={(e) => updateQuestionPoints(q.id, Number(e.target.value))}
                title="Бали за це питання"
                className={`${INPUT_BORDER} w-16 px-2 py-2 text-sm`}
              />
              <button
                type="button"
                onClick={() => removeQuestion(q.id)}
                aria-label="Видалити питання"
                title="Видалити питання"
                className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-1 pl-2">
              {q.options.map((o) => (
                <ListeningOptionRow
                  key={o.id}
                  option={o}
                  questionId={q.id}
                  onSetCorrect={() => setCorrectOption(q.id, o.id)}
                  onUpdateText={(text) => updateOptionText(q.id, o.id, text)}
                  onUpdateImageUrl={(url) => updateOptionImageUrl(q.id, o.id, url)}
                  onRemove={() => removeOption(q.id, o.id)}
                />
              ))}
              <button
                type="button"
                onClick={() => addOption(q.id)}
                className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
              >
                + варіант
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addQuestion}
          className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + питання
        </button>
      </div>
    </div>
  );
});
