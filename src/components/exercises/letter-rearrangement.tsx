"use client";

import { useState, useEffect, useMemo } from "react";
import type { LetterRearrangementPublic, LetterRearrangementDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { SortableTileRow } from "./sortable-tile-row";
import { CompactAudioButton } from "./compact-audio-button";
import { ImageLightbox } from "./image-lightbox";
import { useTwoColumnWordOrder } from "./use-two-column-word-order";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_INSTRUCTION, EXERCISE_SUBINSTRUCTION } from "@/lib/typography-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import {
  TWO_COLUMN_WORD_THRESHOLD,
  LONG_WORD_COMPACT_THRESHOLD,
  SINGLE_WORD_SPAN_THRESHOLD,
  PHRASE_SPAN_THRESHOLD,
  WORD_CARD,
} from "@/lib/exercises/word-list-layout";

export function LetterRearrangementExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: LetterRearrangementPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  const [orders, setOrders] = useState<string[][]>(() =>
    config.words.map((w) => w.shuffledLetters)
  );
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as LetterRearrangementDetail | undefined;
  const locked = !!result;
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  function updateOrder(wordIndex: number, next: string[]) {
    markInteracted();
    setOrders((prev) => prev.map((o, wi) => (wi === wordIndex ? next : o)));
  }

  // "full" (md:col-span-2) — той самий компроміс, що вже прийнятий для
  // isCompact у цьому файлі: сумарна довжина shuffledLetters замість
  // "найдовшої одиниці" (пробіл не в стабільній позиції в перемішаному
  // масиві).
  const fullFlags = useMemo(
    () =>
      config.words.map((w) => {
        const totalLength = w.shuffledLetters.length;
        return totalLength > SINGLE_WORD_SPAN_THRESHOLD || totalLength > PHRASE_SPAN_THRESHOLD;
      }),
    [config.words]
  );

  // Показовий порядок карток у режимі двох колонок — за РЕАЛЬНО заміряною
  // висотою вмісту, див. use-two-column-word-order.ts. orders/detail
  // лишаються індексованими вихідним індексом, переставляється лише
  // порядок рендеру карток.
  const isTwoColumn = config.words.length > TWO_COLUMN_WORD_THRESHOLD;
  const imageUrls = useMemo(() => config.words.map((w) => w.imageUrl), [config.words]);
  const { displayOrder, ready, setContentRef, markInteracted } = useTwoColumnWordOrder({
    wordCount: config.words.length,
    fullFlags,
    imageUrls,
    enabled: isTwoColumn,
  });

  return (
    <div className={EXERCISE_STACK}>
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <div
            className={`instruction-text ${EXERCISE_INSTRUCTION}`}
            dangerouslySetInnerHTML={{
              __html: sanitizeInstructionsHtml(
                config.instructions ?? DEFAULT_INSTRUCTIONS.letter_rearrangement
              ),
            }}
          />
          {!hidePoints && (pointsVisible || detail) && (
            <span className="text-xs font-normal italic text-neutral-500 dark:text-neutral-400">
              {detail
                ? `${result?.correct ? config.points : 0}/${config.points} ${pluralizePoints(config.points)}`
                : `${config.points} ${pluralizePoints(config.points)}`}
            </span>
          )}
        </div>
        {config.subInstructions && (
          <div
            className={`mt-1 ${EXERCISE_SUBINSTRUCTION}`}
            dangerouslySetInnerHTML={{ __html: sanitizeInstructionsHtml(config.subInstructions) }}
          />
        )}
      </div>

      <div
        className={`transition-opacity duration-150 ${ready ? "opacity-100" : "opacity-0"} ${
          isTwoColumn ? "grid gap-3 md:grid-cols-2" : "flex flex-col gap-3"
        }`}
      >
        {displayOrder.map((wi) => {
          const word = config.words[wi];
          const wordDetail = detail?.words[wi];
          // Підсвічування — лише ПІСЛЯ "Перевірити" (wordDetail), як у
          // reorder: жодного рішення клієнту заздалегідь, letter_rearrangement
          // повернуто до цього навмисно (жива підсвітка була в попередній
          // версії, прибрана — див. коментар при LetterRearrangementPublicWord
          // у types.ts).
          function tileState(i: number): "correct" | "incorrect" | undefined {
            if (!wordDetail) return undefined;
            return wordDetail.letters[i]?.isCorrect ? "correct" : "incorrect";
          }

          // На відміну від letter-gaps.tsx, тут НЕ розбиваємо фразу на
          // "одиниці переносу" за пробілом: пробіл у letter_rearrangement —
          // ЗВИЧАЙНА плитка серед перемішаних (sanitizeLetterRearrangement
          // шафлить w.word.split("") цілком, разом із пробілами), яку
          // студент так само може перетягнути будь-куди. Межа між "словами"
          // тому нестабільна ПРОТЯГОМ вправи — сама плитка-пробіл рухається
          // разом з рештою, і будь-яке групування за поточною позицією
          // пробілу перебудовувалось би на кожен drag, а стабільне
          // групування вимагало б робити пробіл нерухомим/недраговним —
          // тобто змінювати саму механіку перетягування, а не лише
          // розмітку.
          //
          // Розмір теж не може спиратись на "найдовшу одиницю" (correctOrder
          // прибрано з Public — п.2 цієї задачі): shuffledLetters уже
          // перемішаний, тож розбиття НА НЬОМУ за пробілом дало б випадкові,
          // безглузді довжини "шматків" (пробіл фізично в іншому місці, ніж
          // у справжньому слові). Тому для letter_rearrangement компактність/
          // span рахуються від СУМАРНОЇ довжини плиток (без розбиття на
          // слова) — точний збіг з "найдовше слово" лише для однослівних
          // завдань (переважна більшість цього типу — сам конфіг називається
          // "word", не "phrase"); для рідкісної фрази з пробілом це груба,
          // але безпечна апроксимація (могла б увімкнути компактність трохи
          // раніше/пізніше, ніж true "найдовше слово", ніколи не ламає
          // розмітку).
          const totalLength = word.shuffledLetters.length;
          const isCompact = totalLength > LONG_WORD_COMPACT_THRESHOLD;
          const needsFullSpan = fullFlags[wi];

          return (
            <div key={wi} className={`${WORD_CARD} ${needsFullSpan ? "md:col-span-2" : ""}`}>
              <div className="flex items-center gap-3">
                {/* Той самий 44px слот, що letter-gaps.tsx: картинка й/або
                    компактна аудіо-кнопка поруч, або жодної. */}
                {(word.imageUrl || word.audioUrl) && (
                  <div className="flex shrink-0 items-center gap-2">
                    {word.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setLightboxSrc(word.imageUrl!)}
                        aria-label="Показати картинку повністю"
                        className="shrink-0 cursor-zoom-in"
                      >
                        <ImageOrPlaceholder
                          src={word.imageUrl}
                          alt=""
                          className="h-11 w-11 rounded-lg object-cover"
                          useFocus
                        />
                      </button>
                    )}
                    {word.audioUrl && <CompactAudioButton src={word.audioUrl} />}
                  </div>
                )}
                {/* ref — на текстовій/плитковій колонці, НЕ на всьому рядку
                    разом із картинкою (той самий принцип, що letter-gaps.tsx —
                    use-two-column-word-order.ts). */}
                <div ref={setContentRef(wi)} className="flex min-w-0 flex-1 flex-col gap-1">
                  {word.hintText.trim() && (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">{word.hintText}</p>
                  )}
                  <SortableTileRow
                    items={orders[wi]}
                    onChange={(next) => updateOrder(wi, next)}
                    locked={locked}
                    tileState={tileState}
                    compact={isCompact}
                  />
                </div>
              </div>
              {wordDetail && !wordDetail.isCorrect && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Правильне слово: {wordDetail.letters.map((l) => l.text).join("")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      <div className="flex flex-col gap-3">
        {!result ? (
          <button
            type="button"
            onClick={() => submit(orders)}
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
