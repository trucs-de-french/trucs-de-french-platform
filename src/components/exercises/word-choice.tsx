"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { WordChoicePublic, WordChoiceDetail, WordChoiceAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { ANSWER_CARD_INLINE, ANSWER_CARD_DEFAULT } from "./answer-card-style";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";

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
      <span className="text-xs font-normal italic text-neutral-500 dark:text-neutral-400">
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
    <div>
      <div className="mb-2">
        <div className="flex flex-wrap items-baseline gap-2 font-medium">
          <div
            dangerouslySetInnerHTML={{
              __html: sanitizeInstructionsHtml(config.instructions ?? DEFAULT_INSTRUCTIONS.word_choice),
            }}
          />
          {pointsBadge()}
        </div>
        {config.subInstructions && (
          <div
            className="mt-0.5 text-sm font-normal text-neutral-500 dark:text-neutral-400"
            dangerouslySetInnerHTML={{ __html: sanitizeInstructionsHtml(config.subInstructions) }}
          />
        )}
      </div>

      <div className="flex flex-col gap-3">
        {config.sentences.map((s, si) => {
          const sentenceDetail = detail?.sentences.find((d) => d.id === s.id);
          const [before, after] = s.sentence.split("{{}}");
          return (
            <p key={s.id} className="leading-8">
              <span className="mr-1 text-neutral-400 dark:text-neutral-500">
                {String.fromCharCode(97 + si)}.
              </span>
              {before}
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
                    className={`mx-0.5 inline-flex items-center gap-1 align-middle disabled:cursor-not-allowed ${ANSWER_CARD_INLINE} ${optionClass(s.id, o.id, sentenceDetail)}`}
                  >
                    {!sentenceDetail &&
                      config.mode === "cross_out" &&
                      (crossedOut[s.id] ?? new Set()).has(o.id) && <X size={12} />}
                    {o.text}
                  </button>
                  {oi < s.options.length - 1 && (
                    <span className="text-neutral-400 dark:text-neutral-500"> / </span>
                  )}
                </span>
              ))}
              {after ?? ""}
              {multiHint(s)}
            </p>
          );
        })}
      </div>

      {!result ? (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || !allAnswered}
          className={`mt-3 ${STUDENT_BUTTON_PRIMARY}`}
        >
          {pending ? "Перевіряю..." : "Перевірити"}
        </button>
      ) : (
        <p
          className={`mt-3 text-sm font-medium ${
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

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
