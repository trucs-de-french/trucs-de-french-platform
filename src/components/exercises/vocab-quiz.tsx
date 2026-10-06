"use client";

import { useState } from "react";
import type { VocabItem } from "@/lib/vocab";
import {
  buildQuizQuestions,
  firstFormOnly,
  MIN_VOCAB_FOR_QUIZ,
  type VocabQuizQuestion,
} from "@/lib/exercises/vocab-quiz-logic";
import { ANSWER_CARD_BASE, ANSWER_CARD_DEFAULT, ITEM_LETTER_BADGE } from "./answer-card-style";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";

const LETTERS = ["A", "B", "C", "D"];

// Бейдж літери узгоджений з кольором картки (зелена/червона), текст
// завжди білий — ніколи чорний на кольоровому фоні. Повні рядки (не
// доповнення до ITEM_LETTER_BADGE), щоб bg-brand і bg-green-600/bg-red-600
// не конкурували в одному класі — порядок класів у className НЕ визначає
// порядок у згенерованому Tailwind CSS.
const BADGE_SHAPE = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white";
const BADGE_CORRECT = `${BADGE_SHAPE} bg-green-600`;
const BADGE_INCORRECT = `${BADGE_SHAPE} bg-red-600`;

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
  const progressPercent = Math.max(2, ((index + 1) / questions.length) * 100);

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
        <div className="flex items-baseline justify-between">
          <p className="font-heading text-xs text-neutral-500 dark:text-neutral-400">
            Питання {index + 1} з {questions.length}
          </p>
        </div>
        <div className="mt-2 h-1 rounded-full bg-gray-100 dark:bg-neutral-700">
          <div
            className="h-1 rounded-full bg-brand transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="font-body mt-5 text-center text-2xl sm:text-3xl">
          {firstFormOnly(question.word)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 max-[359px]:grid-cols-1">
        {question.options.map((option, i) => {
          const isCorrect = option === question.correctTranslation;
          const isSelected = option === selected;
          const cls = !selected
            ? ANSWER_CARD_DEFAULT
            : isCorrect
              ? "border-green-500 bg-green-50 dark:bg-green-950/30"
              : isSelected
                ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                : `${ANSWER_CARD_DEFAULT} opacity-60`;
          const badgeCls = !selected
            ? ITEM_LETTER_BADGE
            : isCorrect
              ? BADGE_CORRECT
              : isSelected
                ? BADGE_INCORRECT
                : ITEM_LETTER_BADGE;
          return (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              disabled={!!selected}
              className={`${ANSWER_CARD_BASE} ${cls} flex h-full items-center gap-2.5`}
            >
              <span className={badgeCls}>{LETTERS[i]}</span>
              <span className="flex-1 text-left">{option}</span>
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
