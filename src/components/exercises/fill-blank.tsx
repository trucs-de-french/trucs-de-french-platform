"use client";

import { useState, useEffect } from "react";
import type { FillBlankPublic, FillBlankDetail, FillBlankAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { DiacriticsPopup, useDiacriticsPopup, insertAtCursor, focusAndSetCursor } from "./diacritics-popup";
import { HintExplanation } from "./hint-explanation";
import { EXERCISE_INSTRUCTION, EXERCISE_SUBINSTRUCTION } from "@/lib/typography-styles";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP } from "@/lib/spacing";

export function FillBlankExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
  isDelf,
}: {
  taskId: string;
  config: FillBlankPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  // Опційний — для блоків у режимі "фіксовано" (TaskGroupBlock), щоб
  // ховати індивідуальний бал задачі БЕЗУМОВНО (і до, і після перевірки),
  // коли на рівні блоку показується лише один загальний підсумок. На
  // відміну від pointsVisible, не має винятку "після перевірки — завжди".
  hidePoints?: boolean;
  // Задача належить DELF-тесту (delf-test-tasks.tsx/exercise-block.tsx) —
  // підказки повністю вимкнені: кнопка-лампочка в попапі не рендериться
  // взагалі (не лише неактивна), сервер (/api/exercises/hint) однаково
  // відхилив би запит, якби хтось обійшов UI.
  isDelf?: boolean;
}) {
  const segments = config.template.split("{{}}");
  const blankCount = segments.length - 1;
  const [answers, setAnswers] = useState<string[]>(() => Array(blankCount).fill(""));
  // Пропуски, де брали підказку "перша літера" — один раз на пропуск,
  // повторний клік нічого не робить (кнопка неактивна, applyHint нижче).
  const [hintedBlanks, setHintedBlanks] = useState<Set<number>>(new Set());
  const [hintPending, setHintPending] = useState(false);
  // Довідкові бульбашки — суто локальний UI-стан на сесію проходження, не
  // зберігається на сервері й не впливає на перевірку. За ІНДЕКСОМ у
  // wordBank, не за текстом — щоб клік на одне слово не викреслював інше
  // однакове слово, якщо вчитель вписав його двічі.
  const [crossedOut, setCrossedOut] = useState<Set<number>>(new Set());
  const diacritics = useDiacriticsPopup<string>();
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as FillBlankDetail | undefined;
  const hasWordBank = !!config.wordBank && config.wordBank.length > 0;

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  function updateAnswer(i: number, value: string) {
    setAnswers((prev) => prev.map((v, idx) => (idx === i ? value : v)));
    setHintedBlanks((prev) => {
      if (!prev.has(i)) return prev;
      const next = new Set(prev);
      next.delete(i);
      return next;
    });
  }

  // Перша літера правильної відповіді — сервер сам вирішує, яка вона (з
  // кількох допустимих — з першої), FillBlankPublic її ніколи не містить.
  // Вписується на ПОЧАТОК поля: якщо поле порожнє чи починається не з неї —
  // повністю замінює вміст (лишається сама ця літера), інакше лишає як є
  // (перша літера й так уже там). Курсор — одразу після літери, фокус з
  // поля не йде (diacritics.getElement — той самий <input>, що вже в
  // фокусі).
  async function applyHint(i: number) {
    if (hintedBlanks.has(i) || hintPending) return;
    setHintPending(true);
    try {
      const res = await fetch("/api/exercises/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, kind: "fill_blank", blankIndex: i }),
      });
      if (!res.ok) return;
      const { letter } = (await res.json()) as { letter: string };
      const current = answers[i] ?? "";
      const value = current.startsWith(letter) ? current : letter;
      setAnswers((prev) => prev.map((v, idx) => (idx === i ? value : v)));
      setHintedBlanks((prev) => new Set(prev).add(i));
      focusAndSetCursor(diacritics.getElement(String(i)), letter.length);
    } finally {
      setHintPending(false);
    }
  }

  function toggleCrossedOut(i: number) {
    setCrossedOut((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className={EXERCISE_STACK}>
      {/* БЕЗ власного className (не окремі mb-2 на title/subText) — відступ
          після всього блоку тепер дає EXERCISE_STACK кореня, а не між
          заголовком і підзаголомком: той самий принцип, що InstructionsText. */}
      <div>
        {/* flex-ряд, не вкладений текст у <p> — санітизований instructions
            сам може містити <p> (TipTap), а <p> у <p> невалідний HTML (той
            самий принцип, що InstructionsText). */}
        <div className="flex flex-wrap items-baseline gap-2">
          <div
            className={`instruction-text ${EXERCISE_INSTRUCTION}`}
            dangerouslySetInnerHTML={{
              __html: sanitizeInstructionsHtml(config.instructions ?? DEFAULT_INSTRUCTIONS.fill_blank.instruction),
            }}
          />
          {/* Бали на ВСЮ вправу (не на пропуск) — до перевірки лише якщо
              pointsVisible, після — завжди. */}
          {!hidePoints && (pointsVisible || detail) && (
            <span className="text-xs font-normal italic text-neutral-500 dark:text-neutral-400">
              {detail
                ? `${result?.correct ? config.points : 0}/${config.points} ${pluralizePoints(config.points)}`
                : `${config.points} ${pluralizePoints(config.points)}`}
            </span>
          )}
        </div>
        {(config.subInstructions ?? DEFAULT_INSTRUCTIONS.fill_blank.subInstruction) && (
          <div
            className={`mt-1 ${EXERCISE_SUBINSTRUCTION}`}
            dangerouslySetInnerHTML={{
              __html: sanitizeInstructionsHtml(config.subInstructions ?? DEFAULT_INSTRUCTIONS.fill_blank.subInstruction),
            }}
          />
        )}
      </div>

      <HintExplanation
        type="fill_blank"
        hintsReducePoints={config.hintsReducePoints}
        hidden={!!isDelf || hasWordBank || !!result}
      />

      {/* Банк слів (опційний) і саме речення — разом ОДНЕ тіло вправи, тож
          проміжок між ними — EXERCISE_BODY_ITEMS_GAP, не власний margin
          банку: банк суто довідковий (клік лише візуально викреслює/
          повертає слово, не впливає на answers/submit), стоїть перед
          реченням, щоб студент бачив підказки одразу. */}
      <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP}`}>
        {config.wordBank && config.wordBank.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {config.wordBank.map((word, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleCrossedOut(i)}
                className={`rounded-full border border-gray-300 px-3 py-1 text-base dark:border-neutral-600 ${
                  crossedOut.has(i)
                    ? "text-neutral-400 line-through opacity-60 dark:text-neutral-500"
                    : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
                }`}
              >
                {word}
              </button>
            ))}
          </div>
        )}

        <p className="leading-8">
          {segments.map((seg, i) => (
            <span key={i}>
              {seg}
              {i < blankCount && (
                <input
                  ref={diacritics.fieldRef(String(i))}
                  value={answers[i]}
                  onChange={(e) => updateAnswer(i, e.target.value)}
                  onFocus={() => diacritics.onFocus(String(i))}
                  onBlur={diacritics.onBlur}
                  disabled={!!result}
                  className={`mx-1 w-28 rounded border px-2 py-0.5 text-base ${
                    detail
                      ? detail.blanks[i]?.isCorrect
                        ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                        : "border-red-500 bg-red-50 dark:bg-red-950/30"
                      : hintedBlanks.has(i)
                        ? "border-sky-400 bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400"
                        : "border-gray-300 dark:border-neutral-600"
                  }`}
                />
              )}
              {i < blankCount && detail?.blanks[i]?.hintUsed && (
                <span className="text-xs italic text-amber-600 dark:text-amber-400">
                  (з підказкою)
                </span>
              )}
            </span>
          ))}
        </p>
      </div>

      {diacritics.rect && !result && diacritics.activeKey && (
        <DiacriticsPopup
          rect={diacritics.rect}
          onPick={(ch) => {
            const i = Number(diacritics.activeKey);
            const el = diacritics.getElement(String(i));
            const { value, cursor } = insertAtCursor(el, answers[i], ch);
            updateAnswer(i, value);
            focusAndSetCursor(el, cursor);
          }}
          onHint={
            isDelf || hasWordBank ? undefined : () => applyHint(Number(diacritics.activeKey))
          }
          hintDisabled={hintPending || hintedBlanks.has(Number(diacritics.activeKey))}
        />
      )}

      {detail && (
        <ul className="flex flex-col gap-1 text-sm">
          {detail.blanks.map((b, i) =>
            b.isCorrect ? null : (
              <li key={i} className="text-red-600 dark:text-red-400">
                Пропуск {i + 1}: правильно — {b.correctAnswers.join(" / ")}
              </li>
            )
          )}
        </ul>
      )}

      <div className="flex flex-col gap-3">
        {!result ? (
          <button
            type="button"
            onClick={() => {
              const answer: FillBlankAnswer = { answers, hintedBlanks: [...hintedBlanks] };
              submit(answer);
            }}
            disabled={pending}
            className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
          >
            {pending ? "Перевіряю..." : "Перевірити"}
          </button>
        ) : (
          <p
            className={`text-sm font-medium ${
              result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {result.correct ? "Правильно! ✓" : `Результат: ${result.score}%`}
            {result.pointsPossible !== undefined && (
              <span className="ml-2 font-normal text-neutral-500 dark:text-neutral-400">
                ({result.pointsEarned} з {result.pointsPossible} {pluralizePoints(result.pointsPossible)})
              </span>
            )}
          </p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
