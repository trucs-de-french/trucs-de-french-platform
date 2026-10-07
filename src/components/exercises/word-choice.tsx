"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { WordChoicePublic, WordChoiceDetail, WordChoiceAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { WORD_CHOICE_DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { ANSWER_CARD_INLINE, ANSWER_CARD_DEFAULT, ITEM_NUMBER_BADGE } from "./answer-card-style";
import { frenchNbsp, frenchNbspHtml } from "@/lib/text/french-typography";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_INSTRUCTION, EXERCISE_SUBINSTRUCTION } from "@/lib/typography-styles";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";

type SentenceDetail = WordChoiceDetail["sentences"][number];
type PublicSentence = WordChoicePublic["sentences"][number];

export function WordChoiceExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: WordChoicePublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  // mode === "select": обрані optionId на речення — множина (toggle),
  // не одне значення, бо речення може дозволяти кілька правильних.
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  // mode === "cross_out": Set закреслених (НЕправильних, на думку студента)
  // optionId на речення — "відповідь" виводиться з того, що лишилось.
  const [crossedOut, setCrossedOut] = useState<Record<string, Set<string>>>({});
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as WordChoiceDetail | undefined;
  const locked = !!result;

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  function toggleSelection(sentenceId: string, optionId: string, multiple: boolean) {
    if (locked) return;
    setSelections((prev) => {
      const current = prev[sentenceId] ?? [];
      const next = multiple
        ? current.includes(optionId)
          ? current.filter((v) => v !== optionId)
          : [...current, optionId]
        : [optionId];
      return { ...prev, [sentenceId]: next };
    });
  }

  function toggleCrossedOut(sentenceId: string, optionId: string) {
    if (locked) return;
    setCrossedOut((prev) => {
      const current = new Set(prev[sentenceId] ?? []);
      if (current.has(optionId)) current.delete(optionId);
      else current.add(optionId);
      return { ...prev, [sentenceId]: current };
    });
  }

  // У cross_out — "обрані" варіанти виводяться з того, що лишилось
  // незакресленим. Готовність = лишився хоч ОДИН (не точна кількість —
  // студент не повинен наперед знати, скільки правильних).
  function remainingOptions(sentenceId: string, optionIds: string[]): string[] {
    const crossed = crossedOut[sentenceId] ?? new Set<string>();
    return optionIds.filter((id) => !crossed.has(id));
  }

  const allAnswered = config.sentences.every((s) =>
    config.mode === "select"
      ? (selections[s.id] ?? []).length > 0
      : remainingOptions(
          s.id,
          s.options.map((o) => o.id)
        ).length > 0
  );

  function handleSubmit() {
    const answer: WordChoiceAnswer = config.sentences.map((s) => ({
      sentenceId: s.id,
      selected:
        config.mode === "select"
          ? (selections[s.id] ?? [])
          : remainingOptions(
              s.id,
              s.options.map((o) => o.id)
            ),
    }));
    submit(answer);
  }

  function optionClass(sentenceId: string, optionId: string, sentenceDetail?: SentenceDetail) {
    if (sentenceDetail) {
      const opt = sentenceDetail.options.find((o) => o.id === optionId);
      if (!opt) return "";
      // Той самий принцип, що multiple-choice.tsx: правильний варіант
      // завжди зелений, червоним — лише хибний вибір студента.
      if (opt.correct) return "border-green-500 bg-green-50 dark:bg-green-950/30";
      if (opt.selected) return "border-red-500 bg-red-50 dark:bg-red-950/30";
      return `${ANSWER_CARD_DEFAULT} opacity-60`;
    }
    if (config.mode === "cross_out") {
      const isCrossedOut = (crossedOut[sentenceId] ?? new Set()).has(optionId);
      return isCrossedOut ? `${ANSWER_CARD_DEFAULT} text-neutral-400 opacity-60 dark:text-neutral-500` : ANSWER_CARD_DEFAULT;
    }
    return (selections[sentenceId] ?? []).includes(optionId) ? SELECTED_OPTION_CLASS : ANSWER_CARD_DEFAULT;
  }

  function pointsBadge() {
    if (hidePoints || !(pointsVisible || detail)) return null;
    return (
      <span className={SCORE_LABEL_CLASS}>
        {detail
          ? `${result?.correct ? config.points : 0}/${config.points} ${pluralizePoints(config.points)}`
          : `${config.points} ${pluralizePoints(config.points)}`}
      </span>
    );
  }

  // Лише mode "select" — той самий принцип, що multiple-choice.tsx
  // ("2 варіанти" під реченням). У "cross_out" свідомо НЕ показується:
  // сама механіка (готовність = "хоч один лишився") вимагає, щоб студент
  // не знав наперед точну кількість правильних.
  function multiHint(s: PublicSentence) {
    if (config.mode !== "select" || !s.multiple) return null;
    return (
      <span className="ml-1 text-xs italic text-neutral-500 dark:text-neutral-400">
        (оберіть {s.correctCount} {s.correctCount >= 5 ? "варіантів" : "варіанти"})
      </span>
    );
  }

  return (
    <div className={EXERCISE_STACK}>
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <div
            className={`instruction-text ${EXERCISE_INSTRUCTION}`}
            dangerouslySetInnerHTML={{
              __html: frenchNbspHtml(
                sanitizeInstructionsHtml(
                  config.instructions ?? WORD_CHOICE_DEFAULT_INSTRUCTIONS[config.mode].instruction
                )
              ),
            }}
          />
          {pointsBadge()}
        </div>
        {(config.subInstructions ?? WORD_CHOICE_DEFAULT_INSTRUCTIONS[config.mode].subInstruction) && (
          <div
            className={`mt-1 ${EXERCISE_SUBINSTRUCTION}`}
            dangerouslySetInnerHTML={{
              __html: frenchNbspHtml(
                sanitizeInstructionsHtml(
                  config.subInstructions ?? WORD_CHOICE_DEFAULT_INSTRUCTIONS[config.mode].subInstruction
                )
              ),
            }}
          />
        )}
      </div>

      <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP}`}>
        {config.sentences.map((s, si) => {
          const sentenceDetail = detail?.sentences.find((d) => d.id === s.id);
          const [before, after] = s.sentence.split("{{}}");
          return (
            // leading-[2.75rem] — єдиний nominal line-height для КОЖНОГО
            // фізичного рядка речення (з чипом і без), не лише середнє:
            // браузер рахує висоту кожного рядка окремо як максимум з
            // nominal line-height і висоти найвищого inline-вмісту. Чип
            // (ANSWER_CARD_INLINE: padding+border) із успадкованим
            // line-height давав БІЛЬШУ за nominal висоту саме для рядків
            // із чипом — звідси нерівність. Тому на чипі нижче leading-6
            // повертає йому звичний (не успадкований 44px) рядок, його
            // повна висота (~30px) лишається МЕНШОЮ за nominal 44px — і
            // тоді висота КОЖНОГО рядка абзацу (з чипом і без) дорівнює
            // рівно nominal 44px, без винятків.
            <div key={s.id} className="flex items-start gap-2.5">
              {config.sentences.length > 1 && (
                // mt-2.5 (10px) — центрує бейдж (24px) на ПЕРШОМУ фізичному
                // рядку речення (leading-[2.75rem] = 44px): (44-24)/2 = 10px.
                // Перенесені рядки йдуть нижче, під текстом (p flex-1
                // min-w-0), бейдж лишається лише біля першого рядка.
                <span className={`mt-2.5 ${ITEM_NUMBER_BADGE}`} aria-hidden="true">
                  {si + 1}
                </span>
              )}
              <p className="min-w-0 flex-1 break-words leading-[2.75rem] [overflow-wrap:anywhere]">
              {frenchNbsp(before.trimEnd())}
              {s.options.map((o, oi) => (
                <span key={o.id}>
                  <button
                    type="button"
                    onClick={() =>
                      config.mode === "select"
                        ? toggleSelection(s.id, o.id, s.multiple)
                        : toggleCrossedOut(s.id, o.id)
                    }
                    disabled={locked}
                    // relative + before: невидима зона дотику до межі
                    // рядка (44px), без зміни видимого розміру чипа —
                    // inset-y підібраний так, щоб psuedo-елемент рівно
                    // торкався межі свого рядка (leading-[2.75rem]), не
                    // перекриваючи сусідній (рядки самі по собі не
                    // перекриваються — border-box їхньої висоти
                    // nominal). mx-1 — ОДИН спільний відступ для
                    // "слово↔чип", "чип↔риска↔чип" і "чип↔крапка": gap
                    // тепер завжди задає лише цей margin, а не випадковий
                    // пробіл із тексту речення (прибраний через trim) —
                    // тож апостроф ("de l'" без пробілу) і звичне слово
                    // (із пробілом, обрізаним) дають однаковий зазор.
                    className={`relative mx-1 inline-flex items-center gap-1 align-middle leading-6 before:absolute before:inset-x-0 before:-inset-y-[7px] before:content-[''] disabled:cursor-not-allowed ${ANSWER_CARD_INLINE} ${optionClass(s.id, o.id, sentenceDetail)}`}
                  >
                    {!sentenceDetail &&
                      config.mode === "cross_out" &&
                      (crossedOut[s.id] ?? new Set()).has(o.id) && <X size={12} />}
                    <span className="break-words [overflow-wrap:anywhere]">{o.text}</span>
                  </button>
                  {oi < s.options.length - 1 && (
                    <span className="text-neutral-400 dark:text-neutral-500">/</span>
                  )}
                </span>
              ))}
              {frenchNbsp((after ?? "").trimStart())}
              {multiHint(s)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {!result ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !allAnswered}
            className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
          >
            {pending ? "Перевіряю..." : "Перевірити"}
          </button>
        ) : (
          <p
            className={`${RESULT_MESSAGE_CLASS} ${
              result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {result.correct ? "Правильно! ✓" : `Результат: ${result.score}%`}
            {result.pointsPossible !== undefined && (
              <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
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
