"use client";

import { useState } from "react";
import type { VocabItem } from "@/lib/vocab";
import {
  buildQuizQuestions,
  firstFormOnly,
  MIN_VOCAB_FOR_QUIZ,
  type VocabQuizQuestion,
} from "@/lib/exercises/vocab-quiz-logic";
import { frenchNbsp } from "@/lib/text/french-typography";
import { ANSWER_CHIP_BASE, ANSWER_CHIP_DEFAULT } from "./answer-card-style";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { TaskPanelHeader } from "./task-panel-header";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";

const LETTERS = ["A", "B", "C", "D"];

// Нейтральний стан (ще не обрано/не ця відповідь) — спільний
// .item-number-badge (26px, градієнт, Nunito 13px/800), той самий вигляд,
// що порядкові номери/літери інших типів вправ. Після перевірки колір
// картки-відповіді (зелена/червона) навмисно повторюється й на самому
// гуртку (BADGE_CORRECT/BADGE_INCORRECT) — лишаємо цю семантику, лише
// форму/розмір/шрифт тепер беремо з .item-number-badge (26px), а не з
// колишнього окремого BADGE_SHAPE.
const BADGE_CORRECT = "item-number-badge item-number-badge--correct";
const BADGE_INCORRECT = "item-number-badge item-number-badge--incorrect";

// Якщо найдовша відповідь питання за символами перевищує цей порядок АБО
// містить слово довше WORD_LENGTH_THRESHOLD символів — на мобільній (нижче
// sm) картки відповідей переходять в 1 колонку на всю ширину замість 2×2,
// щоб довге слово мало більше місця для переносу й не вилазило за картку.
const ANSWER_LENGTH_THRESHOLD = 26;
const WORD_LENGTH_THRESHOLD = 13;

function needsSingleColumn(options: string[]): boolean {
  return options.some(
    (o) => o.length > ANSWER_LENGTH_THRESHOLD || o.split(/\s+/).some((w) => w.length > WORD_LENGTH_THRESHOLD)
  );
}

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
      <p className="text-sm text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
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
        <TaskPanelHeader
          instructionText={DEFAULT_INSTRUCTIONS.vocab_quiz.instruction}
          subInstructionText={DEFAULT_INSTRUCTIONS.vocab_quiz.subInstruction}
        />
        <div className="flex w-full flex-col gap-2">
          <span className="counter-pill" role="status">
            Правильних відповідей: {correctCount} з {questions.length}
          </span>
          <p className="font-body text-sm text-[#55546b] dark:text-[#c9c8e6]">
            Тренування: бали не нараховуються
          </p>
        </div>
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
      <TaskPanelHeader
        instructionText={DEFAULT_INSTRUCTIONS.vocab_quiz.instruction}
        subInstructionText={DEFAULT_INSTRUCTIONS.vocab_quiz.subInstruction}
        counter={questions.length > 1 ? { current: index + 1, total: questions.length } : null}
      />
      <div className="min-w-0">
        <p className="font-body min-w-0 break-words text-center text-2xl [overflow-wrap:anywhere] sm:text-3xl">
          {frenchNbsp(firstFormOnly(question.word))}
        </p>
      </div>

      <div
        className={`grid min-w-0 gap-2 sm:grid-cols-2 sm:gap-2.5 ${
          needsSingleColumn(question.options) ? "grid-cols-1" : "grid-cols-2"
        }`}
      >
        {question.options.map((option, i) => {
          const isCorrect = option === question.correctTranslation;
          const isSelected = option === selected;
          const cls = !selected
            ? `${ANSWER_CHIP_DEFAULT} vocab-quiz-answer-chip`
            : isCorrect
              ? "border-green-500 bg-green-50 dark:bg-green-950/30"
              : isSelected
                ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                : `${ANSWER_CHIP_DEFAULT} opacity-60`;
          const badgeCls = !selected
            ? "item-number-badge"
            : isCorrect
              ? BADGE_CORRECT
              : isSelected
                ? BADGE_INCORRECT
                : "item-number-badge";
          return (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              disabled={!!selected}
              className={`${ANSWER_CHIP_BASE} ${cls} flex h-full min-h-12 min-w-0 items-center gap-2 px-2.5 py-2 sm:gap-2.5 sm:px-3 sm:py-3`}
            >
              <span className={badgeCls} aria-label={`Варіант ${LETTERS[i]}`}>
                {LETTERS[i]}
              </span>
              <span className="min-w-0 flex-1 break-words text-left leading-snug [overflow-wrap:anywhere] hyphens-auto">
                {option}
              </span>
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
