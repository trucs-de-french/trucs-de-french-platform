"use client";

import { useState, useEffect, useMemo } from "react";
import type { LetterGapsPublic, LetterGapsDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { DiacriticsPopup, useDiacriticsPopup } from "./diacritics-popup";
import { CompactAudioButton } from "./compact-audio-button";
import { ImageLightbox } from "./image-lightbox";
import { LIVE_CORRECT_CLASS, LIVE_INCORRECT_CLASS } from "./selection-style";
import { useTwoColumnWordOrder } from "./use-two-column-word-order";
import { EXERCISE_INSTRUCTION, EXERCISE_SUBINSTRUCTION } from "@/lib/typography-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import {
  TWO_COLUMN_WORD_THRESHOLD,
  LONG_WORD_COMPACT_THRESHOLD,
  SINGLE_WORD_SPAN_THRESHOLD,
  PHRASE_SPAN_THRESHOLD,
  COMPACT_GAP_SIZE_CLASS,
  COMPACT_LETTER_TEXT_CLASS,
  WORD_CARD,
  splitPhraseUnits,
  phraseSizeInfo,
} from "@/lib/exercises/word-list-layout";

// Той самий normalize (trim+lowercase, БЕЗ прибирання діакритики), що
// сервер (grade.ts) — з тими самими наслідками: регістр не має значення,
// É і E лишаються РІЗНИМИ літерами. Локальна копія, не імпорт із grade.ts —
// той модуль серверний (importScripts зайвих server-only залежностей у
// клієнтський бандл), а сама функція — один рядок.
function normalize(value: string): string {
  return value.trim().toLowerCase();
}

type GapKey = { wi: number; gi: number };

type CharGroup = { type: "letters"; text: string } | { type: "gap" };

// Сусідні видимі літери без пропуску між ними ("b"+"e" у "be") — в ОДИН
// <span>, а не по одному на символ, щоб вони стояли впритул, як звичайне
// слово, а не розсувались через gap-1 контейнера. Пропуски (null) свідомо
// НЕ об'єднуються між собою — кожен лишається окремим полем уводу, як і
// раніше (одна прихована літера = один <input>).
function groupChars(chars: (string | null)[]): CharGroup[] {
  const groups: CharGroup[] = [];
  for (const char of chars) {
    if (char === null) {
      groups.push({ type: "gap" });
      continue;
    }
    const last = groups[groups.length - 1];
    if (last?.type === "letters") {
      last.text += char;
    } else {
      groups.push({ type: "letters", text: char });
    }
  }
  return groups;
}

export function LetterGapsExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: LetterGapsPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  // По слову: рядок відповідей довжиною = кількість прихованих позицій
  // (null-клітин) у цьому слові, у порядку зліва направо.
  const [answers, setAnswers] = useState<string[][]>(() =>
    config.words.map((w) => Array(w.chars.filter((c) => c === null).length).fill(""))
  );
  const diacritics = useDiacriticsPopup<string>();
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as LetterGapsDetail | undefined;
  // Одна лайтбокс-картинка на всю вправу (не по слову) — одночасно відкрита
  // максимум одна, той самий принцип, що openId у ScriptSection.
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  // "full" (md:col-span-2) — той самий критерій, що вже раніше, для кожного
  // слова окремо; масив, не функція (стабільна ідентичність для хука нижче).
  const fullFlags = useMemo(
    () =>
      config.words.map((w) => {
        const { maxUnitLength, totalLength } = phraseSizeInfo(w.chars);
        return maxUnitLength > SINGLE_WORD_SPAN_THRESHOLD || totalLength > PHRASE_SPAN_THRESHOLD;
      }),
    [config.words]
  );

  // Показовий порядок карток у режимі двох колонок — за РЕАЛЬНО заміряною
  // висотою вмісту (не евристичною оцінкою), див. use-two-column-word-order.ts.
  // answers/hiddenLetters/detail лишаються індексованими вихідним індексом
  // скрізь нижче — переставляється лише порядок РЕНДЕРУ й порядок
  // АВТОПЕРЕХОДУ (gapOrder), не сама структура відповідей.
  const isTwoColumn = config.words.length > TWO_COLUMN_WORD_THRESHOLD;
  const imageUrls = useMemo(() => config.words.map((w) => w.imageUrl), [config.words]);
  const { displayOrder, ready, setContentRef, markInteracted } = useTwoColumnWordOrder({
    wordCount: config.words.length,
    fullFlags,
    imageUrls,
    enabled: isTwoColumn,
  });

  // Плаский порядок УСІХ пропусків через усю вправу — той самий принцип, що
  // clueCells у crossword.tsx, лише без напрямків (тут один-єдиний
  // "напрямок": далі по списку слів). Автоперехід іде по ЦЬОМУ порядку: у
  // межах слова, потім — перший пропуск наступного — АЛЕ саме слова
  // обходяться в ПОРЯДКУ ПОКАЗУ (displayOrder), не у вихідному, щоб Tab/
  // автоперехід рухався зверху вниз/зліва направо так, як вправа виглядає
  // на екрані, а не за прихованим вихідним порядком карток.
  const gapOrder = useMemo(() => {
    const order: GapKey[] = [];
    displayOrder.forEach((wi) => {
      const gapCount = config.words[wi].chars.filter((c) => c === null).length;
      for (let gi = 0; gi < gapCount; gi++) order.push({ wi, gi });
    });
    return order;
  }, [displayOrder, config.words]);

  function focusGap(key: GapKey | undefined) {
    if (!key) return;
    diacritics.getElement(`${key.wi},${key.gi}`)?.focus();
  }

  // Слово ПОВНІСТЮ заповнене (кожен пропуск непорожній) — той самий принцип,
  // що isWordFilled у crossword.tsx: без цього кожна ще не дописана літера
  // вже підсвічувалась би як помилка, не чекаючи завершення слова.
  function isWordFilled(wi: number): boolean {
    return answers[wi].length > 0 && answers[wi].every((v) => v !== "");
  }

  function gapLiveStatus(wi: number, gi: number): "correct" | "incorrect" | null {
    if (!isWordFilled(wi)) return null;
    const correctLetter = config.words[wi].hiddenLetters[gi] ?? "";
    return normalize(answers[wi][gi]) === normalize(correctLetter) ? "correct" : "incorrect";
  }

  function updateLetter(wordIndex: number, gapIndex: number, value: string) {
    markInteracted();
    setAnswers((prev) =>
      prev.map((word, wi) =>
        wi === wordIndex ? word.map((v, gi) => (gi === gapIndex ? value : v)) : word
      )
    );

    // Автоперехід — лише коли справді ввели символ (не стирання). Пропуски,
    // де вже стоїть ПРАВИЛЬНА літера, перескакуємо; на першому порожньому
    // чи неправильному — зупиняємось (той самий принцип, що updateLetter у
    // crossword.tsx).
    if (!value) return;
    const index = gapOrder.findIndex((k) => k.wi === wordIndex && k.gi === gapIndex);
    if (index < 0) return;
    let nextIndex = index + 1;
    while (nextIndex < gapOrder.length) {
      const { wi, gi } = gapOrder[nextIndex];
      const current = answers[wi][gi];
      const filledCorrectly =
        current !== "" && normalize(current) === normalize(config.words[wi].hiddenLetters[gi] ?? "");
      if (!filledCorrectly) break;
      nextIndex++;
    }
    focusGap(gapOrder[nextIndex]);
  }

  // Backspace на ВЖЕ порожньому пропуску — переходимо на попередній і
  // стираємо ЙОГО. На відміну від crossword.tsx (де та сама дія навмисно
  // НЕ стирає, лише переміщує фокус) — там клітинки можуть належати
  // ОДРАЗУ двом словам через перетин, і сліпе стирання зіпсувало б друге
  // слово; тут пропуски одного слова НІКОЛИ не перетинаються з пропусками
  // іншого, тож такого ризику немає — стираємо напряму.
  function handleBackspace(wordIndex: number, gapIndex: number) {
    if (answers[wordIndex][gapIndex] !== "") return;
    markInteracted();
    const index = gapOrder.findIndex((k) => k.wi === wordIndex && k.gi === gapIndex);
    if (index <= 0) return;
    const prev = gapOrder[index - 1];
    setAnswers((p) =>
      p.map((word, wi) => (wi === prev.wi ? word.map((v, gi) => (gi === prev.gi ? "" : v)) : word))
    );
    focusGap(prev);
  }

  return (
    <div className={EXERCISE_STACK}>
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <div
            className={`instruction-text ${EXERCISE_INSTRUCTION}`}
            dangerouslySetInnerHTML={{
              __html: sanitizeInstructionsHtml(config.instructions ?? DEFAULT_INSTRUCTIONS.letter_gaps),
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
          let gapIndex = -1;
          // Одиниці переносу — слова ФРАЗИ за пробілом (пробіл сам
          // відкидається, стає gap-2 розкладки нижче). gapIndex наскрізний
          // через УСІ одиниці цього слова (той самий, що gapOrder/answers) —
          // let у зовнішній замикаючій області, не скидається між
          // одиницями.
          const units = splitPhraseUnits(word.chars);
          const { maxUnitLength } = phraseSizeInfo(word.chars);
          const isCompact = maxUnitLength > LONG_WORD_COMPACT_THRESHOLD;
          const needsFullSpan = fullFlags[wi];
          const gapSizeClass = isCompact ? COMPACT_GAP_SIZE_CLASS : "h-9 w-8";
          const letterTextClass = isCompact ? COMPACT_LETTER_TEXT_CLASS : "text-lg";
          return (
            <div key={wi} className={`${WORD_CARD} ${needsFullSpan ? "md:col-span-2" : ""}`}>
              <div className="flex items-center gap-3">
                {/* Картинка й аудіо-кнопка — той самий 44px слот, обидві
                    можуть бути одночасно (картинка + кнопка поруч), лише
                    аудіо (кнопка "на місці картинки"), або жодної (тоді
                    цей рядок звужується до самої лише текстової колонки). */}
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
                {/* ref — саме на текстовій колонці (підказка+слово), НЕ на
                    всьому рядку разом із картинкою: h-11 картинка не має
                    штучно "утовщувати" однорядкову картку понад дворядкову
                    без картинки при групуванні за висотою
                    (use-two-column-word-order.ts). */}
                <div ref={setContentRef(wi)} className="flex min-w-0 flex-1 flex-col gap-1">
                  {word.hintText.trim() && (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">{word.hintText}</p>
                  )}
                  {/* Зовнішній рядок — flex-wrap, переносить лише МІЖ
                      одиницями (словами фрази), gap-2 між ними виконує роль
                      "пробілу". Кожна одиниця всередині — shrink-0,
                      без flex-wrap (за замовчуванням flex-wrap: nowrap) — не
                      розсипається сама по собі. */}
                  <div className="flex flex-wrap items-center gap-2">
                    {units.map((unit, ui) => (
                      <div key={ui} className="flex shrink-0 items-center gap-1">
                        {groupChars(unit).map((group, ci) => {
                          if (group.type === "letters")
                            return (
                              <span
                                key={ci}
                                className={`whitespace-nowrap font-heading font-medium ${letterTextClass}`}
                              >
                                {group.text}
                              </span>
                            );
                          gapIndex += 1;
                          const gi = gapIndex;
                          const status = gapLiveStatus(wi, gi);
                          return (
                            <input
                              key={ci}
                              ref={diacritics.fieldRef(`${wi},${gi}`)}
                              maxLength={1}
                              value={answers[wi][gi]}
                              onChange={(e) => updateLetter(wi, gi, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Backspace") handleBackspace(wi, gi);
                              }}
                              onFocus={() => diacritics.onFocus(`${wi},${gi}`)}
                              onBlur={diacritics.onBlur}
                              disabled={!!result}
                              // font-heading font-medium прямо на input — не
                              // лише для вирівнювання з видимими літерами, а
                              // й тому, що глобальне
                              // input{font-family:var(--font-heading)}
                              // (globals.css) саме по собі дає ЛИШЕ шрифт, не
                              // вагу/розмір — ті все одно треба задавати
                              // явно тут.
                              className={`${gapSizeClass} rounded-md border text-center font-heading ${letterTextClass} font-medium shadow-sm transition-colors ${
                                status === "correct"
                                  ? LIVE_CORRECT_CLASS
                                  : status === "incorrect"
                                    ? LIVE_INCORRECT_CLASS
                                    : "border-gray-200 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-800/70"
                              }`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {diacritics.rect && !result && diacritics.activeKey && (
        <DiacriticsPopup
          rect={diacritics.rect}
          onPick={(ch) => {
            const [wi, gi] = diacritics.activeKey!.split(",").map(Number);
            updateLetter(wi, gi, ch);
          }}
        />
      )}

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      <div className="flex flex-col gap-3">
        {!result ? (
          <button
            type="button"
            onClick={() => submit(answers)}
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
