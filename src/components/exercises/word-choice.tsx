"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { WordChoicePublic, WordChoiceDetail, WordChoiceAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { WORD_CHOICE_DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { ITEM_NUMBER_BADGE, ITEM_CARD_WRAP } from "./answer-card-style";
import { frenchNbsp, frenchNbspHtml } from "@/lib/text/french-typography";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_INSTRUCTION, EXERCISE_SUBINSTRUCTION } from "@/lib/typography-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";

type SentenceDetail = WordChoiceDetail["sentences"][number];
type PublicSentence = WordChoicePublic["sentences"][number];

// Плитка-варіант усередині картки речення — колишній спільний
// ANSWER_CARD_INLINE (answer-card-style.ts) мав shadow-sm замість рамки:
// на тлі СТОРІНКИ це читалось, але тепер речення лежить на картці
// (ITEM_CARD_WRAP, той самий білий/neutral-800 фон, що в multiple_choice)
// — тінь на однаковому білому фоні картки губилась, а border-gray-100 з
// попереднього дефолтного стану теж був майже невидимий на білому. Тому
// локальні класи (не чіпають спільний ANSWER_CARD_INLINE/ANSWER_CARD_DEFAULT
// — вони й далі використовуються іншими вправами): явна рамка
// (border-gray-200/dark:border-neutral-600, та сама вимога, що в задачі
// для рамок картки) і фон, що відрізняється від фону картки в обох темах
// (neutral-50 / neutral-900, а не білий/neutral-800).
const TILE_INLINE_BASE = "rounded-md border px-1.5 py-0.5 transition-colors";
const TILE_DEFAULT =
  "border-gray-200 bg-neutral-50 hover:bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-900/40 dark:hover:bg-neutral-900/60";

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
      return `${TILE_DEFAULT} opacity-60`;
    }
    if (config.mode === "cross_out") {
      const isCrossedOut = (crossedOut[sentenceId] ?? new Set()).has(optionId);
      return isCrossedOut ? `${TILE_DEFAULT} text-neutral-400 opacity-60 dark:text-neutral-500` : TILE_DEFAULT;
    }
    return (selections[sentenceId] ?? []).includes(optionId) ? SELECTED_OPTION_CLASS : TILE_DEFAULT;
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

      {/* gap-3 md:gap-4 — не спільний EXERCISE_BODY_ITEMS_GAP (gap-4 завжди):
          тут кожне речення тепер окрема картка (ITEM_CARD_WRAP), а не рядок
          без рамки, тож на мобільній трохи щільніший проміжок між картками
          — явна вимога задачі, не випадковий відхід від спільної константи. */}
      <div className="flex flex-col gap-3 md:gap-4">
        {config.sentences.map((s, si) => {
          const sentenceDetail = detail?.sentences.find((d) => d.id === s.id);
          const [before, after] = s.sentence.split("{{}}");
          // Розділовий знак одразу після плитки (". , ; : ! ? ) » …") не
          // повинен переноситись окремим рядком через [overflow-wrap:anywhere]
          // на <p> — виносимо його з "after" і клеїмо до ОСТАННЬОЇ плитки
          // в один whitespace-nowrap блок (нижче), без розділового mx-1.
          const trimmedAfter = (after ?? "").trimStart();
          const glueMatch = trimmedAfter.match(/^[.,;:!?)»…]+/);
          const glueText = glueMatch ? glueMatch[0] : "";
          const restAfter = glueText ? trimmedAfter.slice(glueText.length) : trimmedAfter;
          // leading-[2.25rem] (36px) — єдиний nominal line-height для КОЖНОГО
          // фізичного рядка речення (з чипом і без): браузер рахує висоту
          // кожного рядка окремо як максимум з nominal line-height і висоти
          // найвищого inline-вмісту. Чип (TILE_INLINE_BASE, leading-6 24px +
          // py-0.5 (4px) + border (2px) = ~30px) лишається МЕНШИМ за nominal
          // 36px, тож висота КОЖНОГО рядка абзацу (з чипом і без) — рівно
          // 36px. Було 2.75rem (44px): проміжок між плитками сусідніх рядків
          // = (nominal - висота чипа), тобто був 14px; тепер (36-30)=6px.
          return (
            <div key={s.id} className={`${ITEM_CARD_WRAP} p-3 md:p-4`}>
            <div className="flex items-start gap-2.5">
              {config.sentences.length > 1 && (
                // mt-1.5 (6px) — центрує бейдж (24px) на ПЕРШОМУ фізичному
                // рядку речення (leading-[2.25rem] = 36px): (36-24)/2 = 6px.
                // Перенесені рядки йдуть нижче, під текстом (p flex-1
                // min-w-0), бейдж лишається лише біля першого рядка.
                <span className={`mt-1.5 ${ITEM_NUMBER_BADGE}`} aria-hidden="true">
                  {si + 1}
                </span>
              )}
              <p className="min-w-0 flex-1 break-words leading-[2.25rem] [overflow-wrap:anywhere]">
              {frenchNbsp(before.trimEnd())}
              {s.options.map((o, oi) => {
                const isLast = oi === s.options.length - 1;
                const glued = isLast && glueText.length > 0;
                return (
                  <span key={o.id} className={glued ? "inline-block whitespace-nowrap" : undefined}>
                    <button
                      type="button"
                      onClick={() =>
                        config.mode === "select"
                          ? toggleSelection(s.id, o.id, s.multiple)
                          : toggleCrossedOut(s.id, o.id)
                      }
                      disabled={locked}
                      // relative + before: невидима зона дотику (~40px,
                      // перекриття з сусіднім рядком до ~4px) — компроміс:
                      // тісніший рядок (36px) не лишає місця під повний
                      // 44px тап-таргет без помітного перекриття; inset-y-
                      // [5px] додає ~10px до видимої висоти чипа (~30px).
                      // mx-1 — спільний відступ для "слово↔чип"/"чип↔риска
                      // ↔чип": gap задає лише цей margin, а не випадковий
                      // пробіл із тексту речення (прибраний через trim) —
                      // апостроф ("de l'" без пробілу) і звичне слово дають
                      // однаковий зазор. Для ОСТАННЬОЇ плитки, за якою
                      // одразу йде розділовий знак (glueText), правий
                      // відступ прибрано (ml-1 mr-0): знак клеїться
                      // впритул, а обгортка-span із whitespace-nowrap не
                      // дає [overflow-wrap:anywhere] на <p> розірвати
                      // плитку й знак на різні рядки.
                      className={`relative ${glued ? "ml-1 mr-0" : "mx-1"} inline-flex items-center gap-1 align-middle leading-6 before:absolute before:inset-x-0 before:-inset-y-[5px] before:content-[''] disabled:cursor-not-allowed ${TILE_INLINE_BASE} ${optionClass(s.id, o.id, sentenceDetail)}`}
                    >
                      {!sentenceDetail &&
                        config.mode === "cross_out" &&
                        (crossedOut[s.id] ?? new Set()).has(o.id) && <X size={12} />}
                      <span className="break-words [overflow-wrap:anywhere]">{o.text}</span>
                    </button>
                    {oi < s.options.length - 1 && (
                      <span className="text-neutral-400 dark:text-neutral-500">/</span>
                    )}
                    {glued && frenchNbsp(glueText)}
                  </span>
                );
              })}
              {frenchNbsp(restAfter)}
              {multiHint(s)}
              </p>
            </div>
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
