"use client";

import { useState, useEffect, useMemo } from "react";
import { HintExplanation } from "./hint-explanation";
import { HintBulb } from "./hint-bulb";
import type { LetterGapsPublic, LetterGapsDetail, GradeResult, LetterGapsAnswer } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { frenchNbsp, frenchNbspHtml } from "@/lib/text/french-typography";
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
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";
import { EXERCISE_BLOCK_SIZE, chunk } from "@/lib/exercises/exercise-blocks";
import { BlockNavigation } from "./block-navigation";

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

type LetterGapsResult = Extract<GradeResult, { detail: LetterGapsDetail }>;

export function LetterGapsExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
  isDelf,
}: {
  taskId: string;
  config: LetterGapsPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  // Задача належить DELF-тесту — лампочки-підказки не рендеряться взагалі.
  isDelf?: boolean;
}) {
  // Усі стани відповіді — СПІЛЬНІ на всю вправу (не по блоку), як і pairs у
  // matching.tsx: блок лише фільтрує, які слова видно й до яких прив'язана
  // поточна дія, answers/hintedGaps/hintedWordIndices — одна мапа на всі
  // блоки.
  const [answers, setAnswers] = useState<string[][]>(() =>
    config.words.map((w) => Array(w.chars.filter((c) => c === null).length).fill(""))
  );
  const diacritics = useDiacriticsPopup<string>();
  const [hintedGaps, setHintedGaps] = useState<Set<string>>(new Set());
  const [hintedWordIndices, setHintedWordIndices] = useState<Set<number>>(new Set());
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // ≤EXERCISE_BLOCK_SIZE слів (≤10) — wordBlocks матиме РІВНО один чанк,
  // useBlocks === false, і нижче рендериться ТОЧНО той самий код, що був до
  // розбиття на блоки (окрема гілка, не перевикористання спільного
  // рендера) — свідомо, щоб вигляд/поведінка наявних коротких вправ не
  // залежали від логіки блоків узагалі.
  const wordBlocks = useMemo(
    () => chunk(config.words.map((_, wi) => wi), EXERCISE_BLOCK_SIZE),
    [config.words]
  );
  const blockCount = wordBlocks.length;
  const useBlocks = blockCount > 1;

  // "full" (md:col-span-2) — той самий критерій, що й раніше, для кожного
  // слова окремо; масив, не функція (стабільна ідентичність для хука
  // нижче).
  const fullFlags = useMemo(
    () =>
      config.words.map((w) => {
        const { maxUnitLength, totalLength } = phraseSizeInfo(w.chars);
        return maxUnitLength > SINGLE_WORD_SPAN_THRESHOLD || totalLength > PHRASE_SPAN_THRESHOLD;
      }),
    [config.words]
  );
  const imageUrls = useMemo(() => config.words.map((w) => w.imageUrl), [config.words]);

  // Показовий порядок карток за РЕАЛЬНО заміряною висотою — для ≤10-гілки,
  // на всю вправу.
  const isTwoColumn = !useBlocks && config.words.length > TWO_COLUMN_WORD_THRESHOLD;
  const { displayOrder, ready, setContentRef, markInteracted } = useTwoColumnWordOrder({
    wordCount: config.words.length,
    fullFlags,
    imageUrls,
    enabled: isTwoColumn,
  });

  function isWordFilled(wi: number): boolean {
    return answers[wi].length > 0 && answers[wi].every((v) => v !== "");
  }

  function gapLiveStatus(wi: number, gi: number): "correct" | "incorrect" | null {
    if (!isWordFilled(wi)) return null;
    const correctLetter = config.words[wi].hiddenLetters[gi] ?? "";
    return normalize(answers[wi][gi]) === normalize(correctLetter) ? "correct" : "incorrect";
  }

  function nextHintGap(wi: number): number | null {
    const word = config.words[wi];
    for (let gi = 0; gi < answers[wi].length; gi++) {
      const correctLetter = word.hiddenLetters[gi] ?? "";
      if (normalize(answers[wi][gi]) !== normalize(correctLetter)) return gi;
    }
    return null;
  }

  function applyHint(wi: number) {
    const gi = nextHintGap(wi);
    if (gi === null) return;
    const letter = config.words[wi].hiddenLetters[gi] ?? "";
    setAnswers((prev) => prev.map((word, i) => (i === wi ? word.map((v, g) => (g === gi ? letter : v)) : word)));
    setHintedGaps((prev) => new Set(prev).add(`${wi},${gi}`));
    setHintedWordIndices((prev) => new Set(prev).add(wi));
  }

  function updateLetter(wordIndex: number, gapIndex: number, value: string, gapOrder: GapKey[]) {
    markInteracted();
    setAnswers((prev) =>
      prev.map((word, wi) => (wi === wordIndex ? word.map((v, gi) => (gi === gapIndex ? value : v)) : word))
    );
    setHintedGaps((prev) => {
      const key = `${wordIndex},${gapIndex}`;
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

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

  function focusGap(key: GapKey | undefined) {
    if (!key) return;
    diacritics.getElement(`${key.wi},${key.gi}`)?.focus();
  }

  function handleBackspace(wordIndex: number, gapIndex: number, gapOrder: GapKey[]) {
    if (answers[wordIndex][gapIndex] !== "") return;
    markInteracted();
    const index = gapOrder.findIndex((k) => k.wi === wordIndex && k.gi === gapIndex);
    if (index <= 0) return;
    const prev = gapOrder[index - 1];
    setAnswers((p) => p.map((word, wi) => (wi === prev.wi ? word.map((v, gi) => (gi === prev.gi ? "" : v)) : word)));
    focusGap(prev);
  }

  // ==== Гілка ≤10 слів (незмінна поведінка) ====
  const single = useExerciseCheck(taskId);
  const singleDetail = single.result?.detail as LetterGapsDetail | undefined;

  useEffect(() => {
    if (!useBlocks && single.result) onResult?.(single.result);
  }, [useBlocks, single.result, onResult]);

  // Плаский порядок пропусків для даного списку слів (у наданому порядку)
  // — звичайна функція, НЕ хук: викликається і з useMemo нижче (гілка
  // ≤10), і напряму з renderBlock()/колбеків (гілка блоків), де виклик
  // useMemo був би порушенням Rules of Hooks (renderBlock — не компонент,
  // викликається умовно з JSX).
  function gapOrderFor(wordIndices: number[]): GapKey[] {
    const order: GapKey[] = [];
    wordIndices.forEach((wi) => {
      const gapCount = config.words[wi].chars.filter((c) => c === null).length;
      for (let gi = 0; gi < gapCount; gi++) order.push({ wi, gi });
    });
    return order;
  }

  const singleGapOrder = useMemo(
    () => gapOrderFor(displayOrder),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayOrder, config.words]
  );

  // ==== Гілка блоків (>10 слів) ====
  const [activeBlock, setActiveBlock] = useState(0);
  const [blockResults, setBlockResults] = useState<Record<number, LetterGapsResult>>({});
  const [blockPending, setBlockPending] = useState<Record<number, boolean>>({});
  const [blockError, setBlockError] = useState<Record<number, string | null>>({});

  // Та сама 2-колонкова сітка/групування за виміряною висотою, що ≤10-
  // гілка вище — ОКРЕМИЙ виклик хука, СКОУПЛЕНИЙ на слова АКТИВНОГО блоку
  // (не на всю вправу): wordCount/fullFlags/imageUrls і похідні
  // displayOrder/setContentRef цього виклику стосуються лише
  // activeBlockWordIndices, мапляться назад на глобальний wi через сам
  // масив (activeBlockWordIndices[localIndex]). enabled: useBlocks —
  // завжди сітка в блоковому режимі, навіть для неповного останнього
  // блоку (зайва порожня клітинка grid на 1 непарне слово — не проблема).
  const activeBlockWordIndices = useMemo(
    () => (useBlocks ? (wordBlocks[activeBlock] ?? []) : []),
    [useBlocks, wordBlocks, activeBlock]
  );
  const activeBlockFullFlags = useMemo(
    () => activeBlockWordIndices.map((wi) => fullFlags[wi]),
    [activeBlockWordIndices, fullFlags]
  );
  const activeBlockImageUrls = useMemo(
    () => activeBlockWordIndices.map((wi) => imageUrls[wi]),
    [activeBlockWordIndices, imageUrls]
  );
  const blockTwoColumn = useTwoColumnWordOrder({
    wordCount: activeBlockWordIndices.length,
    fullFlags: activeBlockFullFlags,
    imageUrls: activeBlockImageUrls,
    enabled: useBlocks,
  });
  // Глобальні індекси слів активного блоку в ПОКАЗОВОМУ порядку
  // (blockTwoColumn.displayOrder — локальні індекси 0..розмір_блоку-1).
  const blockDisplayOrder = activeBlockWordIndices.length
    ? blockTwoColumn.displayOrder.map((li) => activeBlockWordIndices[li])
    : [];

  const allBlocksChecked = useBlocks && blockCount > 0 && Object.keys(blockResults).length === blockCount;

  // Сумарний результат — лише коли ВСІ блоки перевірені хоч раз (той самий
  // принцип, що matching.tsx). detail.words тут СПІЛЬНИЙ повної довжини
  // (config.words.length) у КОЖНОГО блочного результату (grade.ts:
  // gradeLetterGaps лишає detail.words повним завжди, звужує лише
  // score/бали) — тож просто беремо detail останнього перевіреного блоку
  // (він містить ті самі correctLetters для всіх слів незалежно від
  // блоку), а не конкатенуємо.
  const aggregateResult: LetterGapsResult | null = useMemo(() => {
    if (!allBlocksChecked) return null;
    const results = Object.values(blockResults);
    const totalWords = config.words.length;
    // За КОЖЕН глобальний індекс слова — isCorrect ЛИШЕ з результату ТОГО
    // блоку, що реально його перевіряв (blockResults[i], не будь-якого
    // іншого): слово поза скоупом певного подання завжди isCorrect=false
    // у ЙОГО detail.words (grade.ts трактує "немає масиву на цій позиції"
    // як порожню відповідь), тож брати чийсь один спільний detail для ВСІХ
    // слів дало б хибні "неправильно" для слів з ІНШИХ блоків.
    const totalCorrect = wordBlocks.reduce((sum, block, i) => {
      const r = blockResults[i];
      const blockCorrect = block.filter((wi) => r.detail.words[wi]?.isCorrect).length;
      return sum + blockCorrect;
    }, 0);
    return {
      correct: results.every((r) => r.correct),
      score: totalWords > 0 ? Math.round((totalCorrect / totalWords) * 100) : 0,
      detail: results[results.length - 1].detail,
      pointsEarned: results.reduce((sum, r) => sum + (r.pointsEarned ?? 0), 0),
      pointsPossible: results.reduce((sum, r) => sum + (r.pointsPossible ?? 0), 0),
    };
  }, [allBlocksChecked, blockResults, wordBlocks, config.words.length]);

  useEffect(() => {
    if (aggregateResult) onResult?.(aggregateResult);
  }, [aggregateResult, onResult]);

  // Пряме fetch, не useExerciseCheck — той тримає ОДИН result/pending/error
  // на весь виклик хука, тут потрібні N незалежних станів (по одному на
  // блок). letters — розрідженим масивом на ВСЮ вправу: реальні відповіді
  // лише на позиціях СЛІВ ЦЬОГО блоку, null на решті (JSON.stringify
  // перетворює "дірки"/undefined на null) — так gradeLetterGaps (grade.ts)
  // визначає скоуп, не чіпаючи сам тип LetterGapsAnswer.
  async function submitBlock(blockIndex: number) {
    const blockWordIndices = wordBlocks[blockIndex];
    const blockSet = new Set(blockWordIndices);
    const letters: (string[] | null)[] = config.words.map((_, wi) => (blockSet.has(wi) ? answers[wi] : null));
    const answer: Omit<LetterGapsAnswer, "letters"> & { letters: (string[] | null)[] } = {
      letters,
      hintedWordIndices: [...hintedWordIndices],
    };
    setBlockPending((prev) => ({ ...prev, [blockIndex]: true }));
    setBlockError((prev) => ({ ...prev, [blockIndex]: null }));
    try {
      const res = await fetch("/api/exercises/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, answer, blockIndex }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Помилка перевірки");
      }
      const result = (await res.json()) as LetterGapsResult;
      setBlockResults((prev) => ({ ...prev, [blockIndex]: result }));
    } catch (e) {
      setBlockError((prev) => ({
        ...prev,
        [blockIndex]: e instanceof Error ? e.message : "Помилка перевірки",
      }));
    } finally {
      setBlockPending((prev) => ({ ...prev, [blockIndex]: false }));
    }
  }

  // Рендер однієї картки-слова — СПІЛЬНИЙ для обох гілок (структура карток
  // ідентична, різниться лише джерело "result"/"detail"/locked і порядок
  // gapIndex-нумерації через gapOrder). Блоки завжди single-column
  // (isTwoColumn лише для ≤10-гілки) — жодного setContentRef/виміру
  // висоти тут не потрібно.
  function renderWordCard(
    wi: number,
    opts: {
      detail: LetterGapsDetail | undefined;
      locked: boolean;
      gapOrder: GapKey[];
      setContentRef: ((wi: number) => (el: HTMLElement | null) => void) | null;
    }
  ) {
    const word = config.words[wi];
    let gapIndex = -1;
    const units = splitPhraseUnits(word.chars);
    const { maxUnitLength } = phraseSizeInfo(word.chars);
    const isCompact = maxUnitLength > LONG_WORD_COMPACT_THRESHOLD;
    const needsFullSpan = !!opts.setContentRef && fullFlags[wi];
    const gapSizeClass = isCompact ? COMPACT_GAP_SIZE_CLASS : "h-9 w-8";
    const letterTextClass = isCompact ? COMPACT_LETTER_TEXT_CLASS : "text-lg";
    const hintUsed = opts.detail?.words[wi]?.hintUsed;
    return (
      <div key={wi} className={`relative ${WORD_CARD} ${needsFullSpan ? "md:col-span-2" : ""}`}>
        {!opts.locked && !isDelf && (
          <HintBulb
            size="md"
            state={hintUsed ? "used" : "available"}
            label="Підказка: відкрити наступну літеру"
            disabled={nextHintGap(wi) === null}
            onClick={() => applyHint(wi)}
            className="absolute right-1.5 top-1.5"
          />
        )}
        {hintUsed && (
          <span className="absolute right-1.5 top-1.5 text-[11px] italic text-amber-600 dark:text-amber-400">
            з підказкою
          </span>
        )}
        <div className="flex items-center gap-3">
          {(word.imageUrl || word.audioUrl) && (
            <div className="flex shrink-0 items-center gap-2">
              {word.imageUrl && (
                <button
                  type="button"
                  onClick={() => setLightboxSrc(word.imageUrl!)}
                  aria-label="Показати картинку повністю"
                  className="shrink-0 cursor-zoom-in"
                >
                  <ImageOrPlaceholder src={word.imageUrl} alt="" className="h-11 w-11 rounded-lg object-cover" useFocus />
                </button>
              )}
              {word.audioUrl && <CompactAudioButton src={word.audioUrl} />}
            </div>
          )}
          <div
            ref={opts.setContentRef ? opts.setContentRef(wi) : undefined}
            className="flex min-w-0 flex-1 flex-col gap-1"
          >
            {word.hintText.trim() && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{frenchNbsp(word.hintText)}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {units.map((unit, ui) => (
                <div key={ui} className="flex shrink-0 items-center gap-1">
                  {groupChars(unit).map((group, ci) => {
                    if (group.type === "letters")
                      return (
                        <span key={ci} className={`whitespace-nowrap font-heading font-medium ${letterTextClass}`}>
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
                        onChange={(e) => updateLetter(wi, gi, e.target.value, opts.gapOrder)}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace") handleBackspace(wi, gi, opts.gapOrder);
                        }}
                        onFocus={() => diacritics.onFocus(`${wi},${gi}`)}
                        onBlur={diacritics.onBlur}
                        disabled={opts.locked}
                        className={`${gapSizeClass} rounded-md border text-center font-heading ${letterTextClass} font-medium shadow-sm transition-colors ${
                          hintedGaps.has(`${wi},${gi}`)
                            ? "border-sky-400 bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400"
                            : status === "correct"
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
  }

  function renderBlock() {
    const blockResult = blockResults[activeBlock];
    const blockDetail = blockResult?.detail;
    const isPending = !!blockPending[activeBlock];
    const errMsg = blockError[activeBlock];
    // Порядок автопереходу — за ПОКАЗОВИМ порядком карток (blockDisplayOrder),
    // не за вихідним wordBlocks[activeBlock] — той самий принцип, що
    // singleGapOrder/displayOrder у ≤10-гілці ("Tab рухається так, як
    // вправа виглядає на екрані").
    const blockGapOrder = gapOrderFor(blockDisplayOrder);

    return (
      <div className="flex flex-col gap-3">
        <div
          className={`transition-opacity duration-150 ${
            blockTwoColumn.ready ? "opacity-100" : "opacity-0"
          } grid gap-3 md:grid-cols-2`}
        >
          {blockDisplayOrder.map((wi) =>
            renderWordCard(wi, {
              detail: blockDetail,
              locked: !!blockResult,
              gapOrder: blockGapOrder,
              setContentRef: blockTwoColumn.setContentRef,
            })
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => submitBlock(activeBlock)}
            disabled={isPending}
            className={STUDENT_BUTTON_PRIMARY}
          >
            {isPending ? "Перевіряю..." : blockResult ? "Перевірити ще раз" : "Перевірити блок"}
          </button>
          {blockResult && (
            <p
              className={`${RESULT_MESSAGE_CLASS} ${
                blockResult.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {blockResult.correct ? "Правильно! ✓" : `Результат: ${blockResult.score}%`}
              {blockResult.pointsPossible !== undefined && (
                <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
                  ({blockResult.pointsEarned} з {blockResult.pointsPossible} {pluralizePoints(blockResult.pointsPossible)})
                </span>
              )}
            </p>
          )}
        </div>
        {errMsg && <p className="text-sm text-red-600 dark:text-red-400">{errMsg}</p>}
      </div>
    );
  }

  return (
    <div className={EXERCISE_STACK}>
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <div
            className={`instruction-text ${EXERCISE_INSTRUCTION}`}
            dangerouslySetInnerHTML={{
              __html: frenchNbspHtml(sanitizeInstructionsHtml(config.instructions ?? DEFAULT_INSTRUCTIONS.letter_gaps.instruction)),
            }}
          />
          {!hidePoints && (pointsVisible || (useBlocks ? aggregateResult : singleDetail)) && (
            <span className={SCORE_LABEL_CLASS}>
              {useBlocks
                ? aggregateResult
                  ? `${aggregateResult.pointsEarned}/${config.points} ${pluralizePoints(config.points)}`
                  : `${config.points} ${pluralizePoints(config.points)}`
                : singleDetail
                  ? `${single.result?.correct ? config.points : 0}/${config.points} ${pluralizePoints(config.points)}`
                  : `${config.points} ${pluralizePoints(config.points)}`}
            </span>
          )}
        </div>
        {(config.subInstructions ?? DEFAULT_INSTRUCTIONS.letter_gaps.subInstruction) && (
          <div
            className={`mt-1 ${EXERCISE_SUBINSTRUCTION}`}
            dangerouslySetInnerHTML={{
              __html: frenchNbspHtml(sanitizeInstructionsHtml(config.subInstructions ?? DEFAULT_INSTRUCTIONS.letter_gaps.subInstruction)),
            }}
          />
        )}
      </div>

      <HintExplanation
        type="letter_gaps"
        hintsReducePoints={config.hintsReducePoints}
        hidden={!!isDelf || (useBlocks ? allBlocksChecked : !!single.result)}
      />

      {!useBlocks ? (
        <>
          <div
            className={`transition-opacity duration-150 ${ready ? "opacity-100" : "opacity-0"} ${
              isTwoColumn ? "grid gap-3 md:grid-cols-2" : "flex flex-col gap-3"
            }`}
          >
            {displayOrder.map((wi) =>
              renderWordCard(wi, {
                detail: singleDetail,
                locked: !!single.result,
                gapOrder: singleGapOrder,
                setContentRef,
              })
            )}
          </div>

          {diacritics.rect && !single.result && diacritics.activeKey && (
            <DiacriticsPopup
              rect={diacritics.rect}
              onPick={(ch) => {
                const [wi, gi] = diacritics.activeKey!.split(",").map(Number);
                updateLetter(wi, gi, ch, singleGapOrder);
              }}
            />
          )}

          {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

          <div className="flex flex-col gap-3">
            {!single.result ? (
              <button
                type="button"
                onClick={() => {
                  const answer: LetterGapsAnswer = { letters: answers, hintedWordIndices: [...hintedWordIndices] };
                  single.submit(answer);
                }}
                disabled={single.pending}
                className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
              >
                {single.pending ? "Перевіряю..." : "Перевірити"}
              </button>
            ) : (
              <p
                className={`${RESULT_MESSAGE_CLASS} ${
                  single.result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {single.result.correct ? "Правильно! ✓" : `Результат: ${single.result.score}%`}
                {single.result.pointsPossible !== undefined && (
                  <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
                    ({single.result.pointsEarned} з {single.result.pointsPossible}{" "}
                    {pluralizePoints(single.result.pointsPossible)})
                  </span>
                )}
              </p>
            )}
            {single.error && <p className="text-sm text-red-600 dark:text-red-400">{single.error}</p>}
          </div>
        </>
      ) : (
        <BlockNavigation
          blockCount={blockCount}
          activeBlock={activeBlock}
          onChangeBlock={setActiveBlock}
          isBlockChecked={(i) => i in blockResults}
          summary={aggregateResult}
        >
          {renderBlock()}
          {diacritics.rect && diacritics.activeKey && !blockResults[activeBlock] && (
            <DiacriticsPopup
              rect={diacritics.rect}
              onPick={(ch) => {
                const [wi, gi] = diacritics.activeKey!.split(",").map(Number);
                updateLetter(wi, gi, ch, gapOrderFor(blockDisplayOrder));
              }}
            />
          )}
          {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
        </BlockNavigation>
      )}
    </div>
  );
}
