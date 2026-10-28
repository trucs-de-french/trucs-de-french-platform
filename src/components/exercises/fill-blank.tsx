"use client";

import { useState, useEffect } from "react";
import type { FillBlankPublic, FillBlankDetail, FillBlankAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS, FILL_BLANK_WORD_BANK_SUBINSTRUCTION } from "@/lib/exercises/default-instructions";
import { formatPointsCount } from "@/lib/exercises/format-points";
import { frenchNbsp } from "@/lib/text/french-typography";
import { BUTTON_CHECK, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { usePracticeCheck } from "./use-practice-check";
import { DiacriticsPopup, useDiacriticsPopup, insertAtCursor, focusAndSetCursor } from "./diacritics-popup";
import { hintExplanationText } from "./hint-explanation";
import { TaskPanelHeader } from "./task-panel-header";
import { BlockTabs } from "./block-navigation";
import { HintBulb, HintUsedBadge } from "./hint-bulb";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP } from "@/lib/spacing";
import { TaskResult, TaskResultGapRows } from "./task-result";
import { useCheckConfirm, CheckConfirmBar } from "./check-confirm";
import {
  FILL_BLANK_POOL_LABEL,
  fillBlankWordPoolUsedLabel,
  FILL_BLANK_FIELD_PLACEHOLDER,
  TABLE_FILL_ANSWERS_TOGGLE_LABEL,
} from "@/lib/exercises/default-task-labels";

// Плитки toggle-картки "Правильні відповіді" для fill_blank — одна плитка
// на РЕЧЕННЯ (не на пропуск): template тут один суцільний текст без
// власного поділу на речення (на відміну від drag_drop.sentences), тож
// межі речень визначаються на льоту — за розділовими знаками [.!?] у самих
// сегментах template.split("{{}}"), той самий текст, що й так уже
// рендериться студенту. Пропуски, що потрапили в межі одного речення,
// збираються в ОДНУ плитку (кілька { word } підряд) — п.2 задачі "кілька
// пропусків в одному реченні — підсвічуються всі".
function buildFillBlankGapRows(
  segments: string[],
  detail: FillBlankDetail
): { number: number; parts: (string | { word: string })[] }[] {
  type Piece = { text: string } | { blank: number };
  const blankCount = segments.length - 1;
  const pieces: Piece[] = [];
  segments.forEach((seg, i) => {
    if (seg) pieces.push({ text: seg });
    if (i < blankCount) pieces.push({ blank: i });
  });

  const sentencePieces: Piece[][] = [];
  let current: Piece[] = [];
  for (const piece of pieces) {
    if ("text" in piece) {
      const re = /[.!?]+(\s+|$)/g;
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(piece.text))) {
        const end = m.index + m[0].length;
        current.push({ text: piece.text.slice(last, end) });
        sentencePieces.push(current);
        current = [];
        last = end;
      }
      if (last < piece.text.length) current.push({ text: piece.text.slice(last) });
    } else {
      current.push(piece);
    }
  }
  if (current.length) sentencePieces.push(current);

  return sentencePieces.map((pcs, i) => {
    const parts: (string | { word: string })[] = pcs.map((p) =>
      "text" in p ? p.text : { word: detail.blanks[p.blank]?.correctAnswers[0] ?? "" }
    );
    if (typeof parts[0] === "string") parts[0] = parts[0].replace(/^\s+/, "");
    const lastIdx = parts.length - 1;
    if (typeof parts[lastIdx] === "string") parts[lastIdx] = parts[lastIdx].replace(/\s+$/, "");
    return { number: i + 1, parts: parts.filter((p) => p !== "") };
  });
}

// Режим практики "Робота над помилками" (пілот, частина 2) — лише
// помилкові ще не виправлені пропуски (onlyItemIds — String(blankIndex),
// error-review.ts). Решта пропусків template лишається видимою (інакше
// речення втрачає сенс), але нерактивна — підміняється нейтральною
// заглушкою замість поля вводу.
export type FillBlankPracticeProps = {
  onlyItemIds: string[];
  failedAttempts: Record<string, number>;
};

export function FillBlankExercise({
  taskId,
  config,
  plaqueText,
  pointsVisible,
  onResult,
  hidePoints,
  isDelf,
  practice,
}: {
  taskId: string;
  config: FillBlankPublic;
  plaqueText?: string;
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
  practice?: FillBlankPracticeProps;
}) {
  const segments = config.template.split("{{}}");
  const blankCount = segments.length - 1;
  const [answers, setAnswers] = useState<string[]>(() => Array(blankCount).fill(""));
  const isPractice = !!practice;
  const practiceSet = new Set(practice?.onlyItemIds ?? []);
  const practiceCheck = usePracticeCheck(taskId);
  const [practiceResults, setPracticeResults] = useState<Record<string, boolean>>({});
  const [practiceFailedAttempts, setPracticeFailedAttempts] = useState<Record<string, number>>(
    practice?.failedAttempts ?? {}
  );
  const onlyItemIdsKey = practice?.onlyItemIds.join(",") ?? "";
  // Коригування стану під час рендеру (React-рекомендований патерн — НЕ
  // useEffect, щоб уникнути react-hooks/set-state-in-effect): коли
  // remainingItemIds змінюється (елемент виправлено й зник після
  // router.refresh()), скидаємо локальні результати попередньої спроби, щоб
  // застарілий "✓"/"✕" не лишався на екрані для вже інших елементів.
  const [prevOnlyItemIdsKey, setPrevOnlyItemIdsKey] = useState(onlyItemIdsKey);
  if (isPractice && onlyItemIdsKey !== prevOnlyItemIdsKey) {
    setPrevOnlyItemIdsKey(onlyItemIdsKey);
    setPracticeResults({});
  }

  // Пропуски, де брали підказку "перша літера" — один раз на пропуск,
  // повторний клік нічого не робить (кнопка неактивна, applyHint нижче).
  const [hintedBlanks, setHintedBlanks] = useState<Set<number>>(new Set());
  const [hintPending, setHintPending] = useState(false);
  // Довідкові бульбашки — суто локальний UI-стан на сесію проходження, не
  // зберігається на сервері й не впливає на перевірку. За ІНДЕКСОМ у
  // wordBank, не за текстом — щоб клік на одне слово не викреслював інше
  // однакове слово, якщо вчитель вписав його двічі.
  const [crossedOut, setCrossedOut] = useState<Set<number>>(new Set());
  // Підказка-переклад (лампочка біля пропуску, незалежна від applyHint/
  // hintedBlanks вище — ОКРЕМИЙ стан, щоб не зачепити "перша літера": той
  // стан очищується в updateAnswer на кожній зміні поля, а "використано"
  // для перекладу має лишатись НАЗАВЖДИ з першого показу). translationHints
  // — монотонний (для балів, grade.ts), visibleTranslations — перемикається
  // кожним кліком (показати/сховати сірий текст), об'єднуються лише в
  // payload submit().
  const [translationHints, setTranslationHints] = useState<Set<number>>(new Set());
  const [visibleTranslations, setVisibleTranslations] = useState<Set<number>>(new Set());
  const hints = config.hints ?? [];
  const diacritics = useDiacriticsPopup<string>();
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const checkConfirm = useCheckConfirm();
  const filledCount = answers.filter((a) => a.trim() !== "").length;
  function submitFillBlank() {
    // Об'єднання двох незалежних "used"-наборів (перша літера + переклад)
    // лише ТУТ, у payload — grade.ts бачить один спільний hintedBlanks, не
    // знає про джерело підказки.
    const answer: FillBlankAnswer = {
      answers,
      hintedBlanks: [...new Set([...hintedBlanks, ...translationHints])],
    };
    submit(answer);
  }
  const detail = result?.detail as FillBlankDetail | undefined;
  const gapRows = detail ? buildFillBlankGapRows(segments, detail) : undefined;
  const hintUsedCount = detail?.blanks.filter((b) => b.hintUsed).length ?? 0;
  const hasWordBank = !!config.wordBank && config.wordBank.length > 0;
  const defaultSubInstruction = hasWordBank
    ? FILL_BLANK_WORD_BANK_SUBINSTRUCTION
    : DEFAULT_INSTRUCTIONS.fill_blank.subInstruction;

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  async function submitPractice() {
    // Позиційний масив на ВСІ пропуски (gradeFillBlank/FillBlankAnswer —
    // template-позиційний, не map за id) — пропуски ПОЗА практикою йдуть
    // порожніми, сервер однаково бере з detail.blanks лише запитані
    // itemIds (practice/check route.ts), решта відкидається.
    const fullAnswers = answers.map((v, i) => (practiceSet.has(String(i)) ? v : ""));
    const itemIds = [...practiceSet];
    const practiceResult = await practiceCheck.check(itemIds, {
      answers: fullAnswers,
      hintedBlanks: [...hintedBlanks, ...translationHints].filter((i) => practiceSet.has(String(i))),
    });
    if (!practiceResult) return;
    setPracticeResults((prev) => {
      const next = { ...prev };
      for (const r of practiceResult.results) next[r.itemId] = r.correct;
      return next;
    });
    setPracticeFailedAttempts(practiceResult.failedAttempts);
    for (const r of practiceResult.results) {
      if (!r.correct && (practiceResult.failedAttempts[r.itemId] ?? 0) >= 2 && !practiceCheck.revealed[r.itemId]) {
        practiceCheck.reveal(r.itemId, false);
      }
    }
  }

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

  function toggleTranslationHint(i: number) {
    setTranslationHints((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
    setVisibleTranslations((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
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
      <BlockTabs plaqueText={plaqueText} />
      <TaskPanelHeader
        pointsText={!hidePoints && !detail && pointsVisible ? formatPointsCount(config.points) : undefined}
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.fill_blank.instruction}
        subInstructionText={config.subInstructions ?? defaultSubInstruction}
        hintText={
          isDelf || hasWordBank || !!result || isPractice
            ? null
            : hintExplanationText("fill_blank")
        }
      />

      {/* Банк слів (опційний) і саме речення — разом ОДНЕ тіло вправи, тож
          проміжок між ними — EXERCISE_BODY_ITEMS_GAP, не власний margin
          банку: банк суто довідковий (клік лише візуально викреслює/
          повертає слово, не впливає на answers/submit), стоїть перед
          реченням, щоб студент бачив підказки одразу. */}
      <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP}`}>
        {config.wordBank && config.wordBank.length > 0 && (
          // Спільний липкий трей (.word-pool*, globals.css) — той самий, що
          // image_match (image-match.tsx) і drag_drop (drag-drop.tsx) нижче.
          // На відміну від них: чипи тут НЕ драговані (--static, грип не
          // рендериться), клік лише перемикає "викреслено" (toggleCrossedOut,
          // логіка незмінна) — слово лишається в банку, не зникає.
          <div className="word-pool">
            <div className="word-pool-label-row">
              <span className="word-pool-label">{FILL_BLANK_POOL_LABEL}</span>
              <span className="word-pool-count">
                {fillBlankWordPoolUsedLabel(crossedOut.size, config.wordBank.length)}
              </span>
            </div>
            <div className="word-pool-chips">
              {config.wordBank.map((word, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleCrossedOut(i)}
                  aria-pressed={crossedOut.has(i)}
                  className={`word-pool-chip word-pool-chip--static ${crossedOut.has(i) ? "word-pool-chip--used" : ""}`}
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="glass-reading-passage break-words leading-[38px] [overflow-wrap:anywhere]">
          {segments.map((seg, i) => (
            <span key={i}>
              {frenchNbsp(seg)}
              {i < blankCount && isPractice && !practiceSet.has(String(i)) && (
                // Пропуск ПОЗА поточною практикою (вже виправлений чи не
                // мав помилки) — нейтральна заглушка замість поля вводу:
                // речення лишається читабельним, але нередагованим, бо
                // правильне значення цього пропуску клієнту невідоме
                // (FillBlankPublic не містить відповідей).
                <span
                  aria-hidden
                  className="mx-1 inline-block w-16 rounded border border-dashed glass-gap-shadow border-[rgba(217,183,101,0.55)] bg-white px-2 py-0.5 text-center text-neutral-400 dark:bg-[var(--card-field-bg)] dark:border-[var(--card-field-border)] dark:text-[rgba(179,191,224,0.8)]"
                >
                  ···
                </span>
              )}
              {i < blankCount && (!isPractice || practiceSet.has(String(i))) && (
                // relative-обгортка inline-block — та сама схема, що
                // table-fill.tsx (.table-fill-cell-wrap): лампочка-переклад
                // (мокап "варіант 1") тепер ВСЕРЕДИНІ поля, абсолютно
                // позиціонована (.fill-blank-field-lamp), замість окремого
                // inline-елемента після input. hasFieldValue — той самий
                // принцип, що table_fill: лампочка не рендериться взагалі,
                // щойно в полі є текст (padding симетричний замість місця під
                // лампочку), а не просто ховається.
                <span className="relative mx-1 inline-block align-middle fill-blank-field-wrap">
                  <input
                    ref={diacritics.fieldRef(String(i))}
                    value={answers[i]}
                    onChange={(e) => updateAnswer(i, e.target.value)}
                    onFocus={() => diacritics.onFocus(String(i))}
                    onBlur={diacritics.onBlur}
                    disabled={isPractice ? practiceCheck.pending : !!result}
                    // placeholder — переклад (поки лампочку не натиснули й
                    // поле порожнє) переважає дефолтний "впишіть слово";
                    // title — повний переклад, навіть якщо truncate обрізав
                    // видиму частину (довгий переклад, вузьке поле).
                    placeholder={
                      result
                        ? undefined
                        : visibleTranslations.has(i) && !answers[i] && hints[i]
                          ? hints[i]
                          : !answers[i]
                            ? FILL_BLANK_FIELD_PLACEHOLDER
                            : undefined
                    }
                    title={hints[i] ?? undefined}
                    className={`fill-blank-field h-[28px] w-[170px] truncate rounded-lg border text-center text-base placeholder:text-[13px] placeholder:font-bold placeholder:text-[#b8a67a] placeholder:not-italic ${
                      !result && !isDelf && !isPractice && hints[i] && !answers[i] ? "pl-[12px] pr-[30px]" : "px-[12px]"
                    } ${hasWordBank ? "scroll-mt-16 sm:scroll-mt-[27vh]" : ""} ${
                      isPractice
                        ? practiceResults[String(i)] === true
                          ? "exercise-field exercise-field--correct border-green-500 bg-green-50"
                          : practiceResults[String(i)] === false
                            ? "exercise-field exercise-field--wrong border-red-500 bg-red-50"
                            : "exercise-field border-[rgba(217,183,101,0.7)] bg-white"
                        : detail
                          ? detail.blanks[i]?.isCorrect
                            ? "exercise-field exercise-field--correct border-green-500 bg-green-50"
                            : "exercise-field exercise-field--wrong border-red-500 bg-red-50"
                          : hintedBlanks.has(i)
                            ? "border-sky-400 bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400"
                            : "exercise-field border-[rgba(217,183,101,0.7)] bg-white"
                    }`}
                  />
                  {!result && !isDelf && !isPractice && hints[i] && !answers[i] && (
                    <HintBulb
                      state={translationHints.has(i) ? "used" : "available"}
                      label="Підказка: показати переклад слова"
                      onClick={() => toggleTranslationHint(i)}
                      className="fill-blank-field-lamp"
                    />
                  )}
                  {detail?.blanks[i]?.hintUsed && <HintUsedBadge />}
                </span>
              )}
              {i < blankCount && isPractice && practiceSet.has(String(i)) && practiceResults[String(i)] === false && (
                <span className="ml-1 text-xs text-red-600 dark:text-red-400">
                  (спроб: {practiceFailedAttempts[String(i)] ?? 0})
                </span>
              )}
              {i < blankCount && isPractice && practiceSet.has(String(i)) && practiceCheck.revealed[String(i)] && (
                <span className="ml-1 text-xs italic text-amber-700 dark:text-amber-400">
                  (правильно: {practiceCheck.revealed[String(i)].join(" / ")})
                </span>
              )}
              {i < blankCount && isPractice && practiceSet.has(String(i)) && !practiceCheck.revealed[String(i)] && (
                <button
                  type="button"
                  onClick={() => practiceCheck.reveal(String(i), true)}
                  disabled={!!practiceCheck.revealPending[String(i)]}
                  className={`ml-1 ${STUDENT_BUTTON_SECONDARY_TOUCH}`}
                >
                  Показати відповідь
                </button>
              )}
              {i < blankCount && !result && !isPractice && visibleTranslations.has(i) && hints[i] && answers[i] && (
                <span className="text-xs italic text-[var(--text-muted-hint)] dark:text-[var(--text-muted-caption)]" title={hints[i] ?? undefined}>
                  ({hints[i]})
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
            isDelf || hasWordBank || isPractice ? undefined : () => applyHint(Number(diacritics.activeKey))
          }
          hintDisabled={hintPending || hintedBlanks.has(Number(diacritics.activeKey))}
          hintUsed={hintedBlanks.has(Number(diacritics.activeKey))}
        />
      )}

      {isPractice ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={submitPractice}
            disabled={practiceCheck.pending || [...practiceSet].some((id) => !answers[Number(id)])}
            className={`self-start ${BUTTON_CHECK}`}
          >
            {practiceCheck.pending ? "Перевіряю..." : "Перевірити"}
          </button>
          {practiceCheck.error && <p className="text-sm text-red-600 dark:text-red-400">{practiceCheck.error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {!result ? (
            <div className="flex flex-col items-start gap-2">
              <button
                type="button"
                onClick={() => checkConfirm.attemptCheck(blankCount - filledCount, submitFillBlank)}
                disabled={pending}
                className={`self-start ${BUTTON_CHECK}`}
              >
                {pending ? "Перевіряю..." : "Перевірити"}
              </button>
              {checkConfirm.confirming && (
                <CheckConfirmBar
                  unansweredCount={blankCount - filledCount}
                  onConfirm={() => checkConfirm.confirmCheck(submitFillBlank)}
                  onCancel={checkConfirm.cancelCheck}
                />
              )}
            </div>
          ) : (
            <TaskResult
              correct={result.correct}
              pointsEarned={result.pointsEarned}
              pointsPossible={result.pointsPossible}
              toggleTitle={TABLE_FILL_ANSWERS_TOGGLE_LABEL}
              toggleCount={gapRows?.length}
              hintSummary={{ hintCount: hintUsedCount, reducesPoints: config.hintsReducePoints }}
            >
              {gapRows && <TaskResultGapRows rows={gapRows} />}
            </TaskResult>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
