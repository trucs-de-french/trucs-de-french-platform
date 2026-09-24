"use client";

import { useState } from "react";
import type { VocabItem } from "@/lib/vocab";
import {
  buildQuizQuestions,
  MIN_VOCAB_FOR_QUIZ,
  type VocabQuizQuestion,
} from "@/lib/exercises/vocab-quiz-logic";
import { ANSWER_CARD_BASE, ANSWER_CARD_DEFAULT } from "./answer-card-style";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";

export function VocabQuizExercise({
  vocab,
  initialQuestions,
}: {
  vocab: VocabItem[];
  initialQuestions: VocabQuizQuestion[];
}) {
  // initialQuestions прораховано один раз на сервері (page.tsx) і передано
  // як пропс — buildQuizQuestions() всередині useState-ініціалізатора
  // викликала Math.random() окремо на сервері й окремо при гідратації на
  // клієнті, через що порядок питань/варіантів розходився і React падав з
  // hydration mismatch. Тут questions — просто значення з пропсів, однакове
  // на сервері й клієнті. Повторний виклик buildQuizQuestions() лишається
  // тільки в restart() — це відбувається вже після монтування, в обробнику
  // кліку, і на гідратацію не впливає.
  const [questions, setQuestions] = useState(initialQuestions);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  if (vocab.length < MIN_VOCAB_FOR_QUIZ) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Замало лексики в обраних сценах для вікторини (мінімум {MIN_VOCAB_FOR_QUIZ} слова).
      </p>
    );
  }

  function restart() {
    setQuestions(buildQuizQuestions(vocab));
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
  }

  if (index >= questions.length) {
    return (
      <div className={EXERCISE_STACK}>
        <p className="font-medium">
          Результат: {correctCount} з {questions.length}
        </p>
        <button
          type="button"
          onClick={restart}
          className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
        >
          Пройти ще раз
        </button>
      </div>
    );
  }

  const question = questions[index];

  function choose(option: string) {
    if (selected) return;
    setSelected(option);
    if (option === question.correctTranslation) {
      setCorrectCount((c) => c + 1);
    }
  }

  function next() {
    setSelected(null);
    setIndex((i) => i + 1);
  }

  return (
    <div className={EXERCISE_STACK}>
      <div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Питання {index + 1} з {questions.length}
        </p>
        <p className="mt-1 text-lg font-medium">{question.word}</p>
      </div>

      <div className="flex flex-col gap-2">
        {question.options.map((option) => {
          const isCorrect = option === question.correctTranslation;
          const isSelected = option === selected;
          const cls = !selected
            ? ANSWER_CARD_DEFAULT
            : isCorrect
              ? "border-green-500 bg-green-50 dark:bg-green-950/30"
              : isSelected
                ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                : `${ANSWER_CARD_DEFAULT} opacity-60`;
          return (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              disabled={!!selected}
              className={`${ANSWER_CARD_BASE} ${cls}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {selected && (
        <button
          type="button"
          onClick={next}
          className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
        >
          Далі
        </button>
      )}
    </div>
  );
}
