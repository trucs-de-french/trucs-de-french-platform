"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { OpenAnswerConfig, OpenAnswerQuestion } from "@/lib/exercises/types";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import { useFileOrLink } from "@/components/file-or-link-field";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";

function emptyQuestion(): OpenAnswerQuestion {
  return { id: crypto.randomUUID(), question: "", answers: [""] };
}

// Окремий компонент на питання (не інлайн у .map()) — useFileOrLink це хук,
// викликати його всередині callback .map() було б порушенням правил хуків,
// за зразком PhoneticsItemRow/ReorderSequenceBlock.
function OpenAnswerQuestionRow({
  q,
  onUpdateField,
  onRemove,
  onAddAnswer,
  onRemoveAnswer,
  onUpdateAnswer,
  onUpdatePoints,
}: {
  q: OpenAnswerQuestion;
  onUpdateField: (field: "question" | "imageUrl" | "audioUrl" | "hint", value: string) => void;
  onRemove: () => void;
  onAddAnswer: () => void;
  onRemoveAnswer: (i: number) => void;
  onUpdateAnswer: (i: number, value: string) => void;
  onUpdatePoints: (points: number) => void;
}) {
  const image = useFileOrLink({
    kind: "image",
    mode: "controlled",
    value: q.imageUrl ?? "",
    onChange: (url) => onUpdateField("imageUrl", url),
    placeholder: "Картинка (URL, необов'язково)",
    allowFocus: true,
  });
  const audio = useFileOrLink({
    kind: "audio",
    mode: "controlled",
    value: q.audioUrl ?? "",
    onChange: (url) => onUpdateField("audioUrl", url),
    placeholder: "Аудіо (URL, необов'язково)",
  });

  return (
    <div className="rounded-md border border-gray-100 p-2 dark:border-neutral-700">
      <div className="flex items-center gap-2">
        <input
          value={q.question}
          onChange={(e) => onUpdateField("question", e.target.value)}
          placeholder="напр. Як буде французькою 'дякую'?"
          className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
        />
        <span className={HINT_TEXT}>Бали</span>
        <input
          type="number"
          min={0}
          step={0.5}
          value={q.points ?? 1}
          onChange={(e) => onUpdatePoints(Number(e.target.value))}
          title="Бали за це питання"
          className={`${INPUT_BORDER} w-16 px-2 py-2 text-sm`}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Видалити питання"
          title="Видалити питання"
          className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {image.icons}
        {audio.icons}
      </div>
      {(image.input || audio.input) && (
        <div className="mt-1 flex flex-wrap items-start gap-2">
          {image.input && <div className="flex-1">{image.input}</div>}
          {audio.input && <div className="flex-1">{audio.input}</div>}
        </div>
      )}

      <div className="mt-2 flex flex-col gap-1">
        <label className={LABEL_TEXT}>
          Підказка (опційно) — лампочка покаже цей текст студенту, зменшує бали, якщо увімкнено нижче
        </label>
        <input
          value={q.hint ?? ""}
          onChange={(e) => onUpdateField("hint", e.target.value)}
          placeholder="Текст підказки"
          className={`${INPUT_BORDER} px-2 py-2 text-sm`}
        />
      </div>

      <div className="mt-2 flex flex-col gap-1 pl-2">
        <label className={LABEL_TEXT}>
          Прийнятні відповіді (будь-яка з них зараховується правильною)
        </label>
        {q.answers.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={a}
              onChange={(e) => onUpdateAnswer(i, e.target.value)}
              placeholder="Варіант відповіді"
              className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
            />
            <button
              type="button"
              onClick={() => onRemoveAnswer(i)}
              aria-label="Видалити варіант"
              title="Видалити"
              className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddAnswer}
          className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + варіант
        </button>
      </div>
    </div>
  );
}

export function OpenAnswerFields({
  initialConfig,
}: {
  initialConfig?: Partial<OpenAnswerConfig>;
}) {
  const [questions, setQuestions] = useState<OpenAnswerQuestion[]>(
    initialConfig?.questions?.length ? initialConfig.questions : [emptyQuestion()]
  );
  const [hintsReducePoints, setHintsReducePoints] = useState(
    initialConfig?.hintsReducePoints ?? false
  );

  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function updateQuestionField(
    id: string,
    field: "question" | "imageUrl" | "audioUrl" | "hint",
    value: string
  ) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  }

  function addAnswer(qId: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, answers: [...q.answers, ""] } : q))
    );
  }

  function removeAnswer(qId: string, i: number) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId ? { ...q, answers: q.answers.filter((_, idx) => idx !== i) } : q
      )
    );
  }

  function updateAnswer(qId: string, i: number, value: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? { ...q, answers: q.answers.map((a, idx) => (idx === i ? value : a)) }
          : q
      )
    );
  }

  function updatePoints(qId: string, points: number) {
    setQuestions((prev) => prev.map((q) => (q.id === qId ? { ...q, points } : q)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input
        type="hidden"
        name="open_answer_questions"
        value={JSON.stringify(questions)}
        readOnly
      />
      <input
        type="hidden"
        name="open_answer_hints_reduce_points"
        value={hintsReducePoints ? "true" : ""}
        readOnly
      />

      <InstructionsRichTextField
        name="open_answer_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="open_answer_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hintsReducePoints}
          onChange={(e) => setHintsReducePoints(e.target.checked)}
        />
        Підказка зменшує бали (питання, де показали підказку, дає 50% балів)
      </label>

      <div className="flex flex-col gap-3">
        {questions.map((q) => (
          <OpenAnswerQuestionRow
            key={q.id}
            q={q}
            onUpdateField={(field, value) => updateQuestionField(q.id, field, value)}
            onRemove={() => removeQuestion(q.id)}
            onAddAnswer={() => addAnswer(q.id)}
            onRemoveAnswer={(i) => removeAnswer(q.id, i)}
            onUpdateAnswer={(i, value) => updateAnswer(q.id, i, value)}
            onUpdatePoints={(points) => updatePoints(q.id, points)}
          />
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
}
