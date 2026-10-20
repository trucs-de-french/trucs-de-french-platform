"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { hintExplanationText } from "./hint-explanation";
import { TaskPanelHeader } from "./task-panel-header";
import { HintBulb, HintUsedBadge } from "./hint-bulb";
import type { LetterGapsPublic, LetterGapsDetail, GradeResult, LetterGapsAnswer } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { frenchNbsp } from "@/lib/text/french-typography";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { DiacriticsPopup, useDiacriticsPopup } from "./diacritics-popup";
import { CompactAudioButton } from "./compact-audio-button";
import { ImageLightbox } from "./image-lightbox";
import { LIVE_CORRECT_CLASS, LIVE_INCORRECT_CLASS } from "./selection-style";
import { useTwoColumnWordOrder } from "./use-two-column-word-order";
import { EXERCISE_STACK } from "@/lib/spacing";
import {
  SINGLE_WORD_SPAN_THRESHOLD,
  PHRASE_SPAN_THRESHOLD,
  WORD_CARD,
  splitPhraseUnits,
  phraseSizeInfo,
} from "@/lib/exercises/word-list-layout";
import { TaskResult, TaskResultGapRows } from "./task-result";
import { useCheckConfirm, CheckConfirmBar } from "./check-confirm";
import { TABLE_FILL_ANSWERS_TOGGLE_LABEL } from "@/lib/exercises/default-task-labels";
import { EXERCISE_BLOCK_SIZE, chunk } from "@/lib/exercises/exercise-blocks";
import { BlockNavigation, BlockTabs } from "./block-navigation";
import { usePracticeCheck } from "./use-practice-check";
import { STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { useWorkingTileLayout, TWO_COLUMN_GRID_CLASS } from "./use-working-tile-layout";

// Плитки toggle-картки "Правильні відповіді" — одна плитка на СЛОВО
// (природна одиниця letter_gaps, на відміну від fill_blank/drag_drop):
// chars (null на місці пропуску) + correctLetters (позиційні правильні
// літери лише прихованих позицій) зливаються в суцільне слово, підряд
// приховані літери об'єднуються в один підсвічений фрагмент.
function buildLetterGapsRows(
  wordIndices: number[],
  words: LetterGapsPublic["words"],
  detail: LetterGapsDetail
): { number: number; parts: (string | { word: string })[] }[] {
  return wordIndices.map((wi) => {
    const word = words[wi];
    const correct = detail.words[wi]?.correctLetters ?? [];
    let ci = 0;
    const parts: (string | { word: string })[] = [];
    for (const ch of word.chars) {
      if (ch === null) {
        const letter = correct[ci++] ?? "";
        const last = parts[parts.length - 1];
        if (last && typeof last === "object") last.word += letter;
        else parts.push({ word: letter });
      } else {
        const last = parts[parts.length - 1];
        if (typeof last === "string") parts[parts.length - 1] = last + ch;
        else parts.push(ch);
      }
    }
    return { number: wi + 1, parts };
  });
}

// Режим практики "Робота над помилками" (пілот, частина 3) — лише
// помилкові ще не виправлені слова (onlyItemIds — String(wordIndex), той
// самий принцип, що fill_blank/String(blankIndex): gradeLetterGaps
// позиційний, слова не мають id). Відоме обмеження (свідомо прийняте):
// LetterGapsPublicWord.hiddenLetters уже містить правильні літери в
// config, який і так іде студенту (для живої підсвітки кольором під час
// друку, gapLiveStatus нижче) — "не показувати відповідь до розкриття"
// тут означає лише, що СЕРВЕРНА failed_attempts/corrected_item_ids модель
// і кнопка "Показати відповідь" працюють так само, як і для інших 4
// типів; сама літера технічно вже присутня в DOM/мережі, як і в звичайній
// (не практичній) вправі сьогодні — той самий компроміс, що вже
// задокументований для CrosswordPublic.solution.
export type LetterGapsPracticeProps = {
  onlyItemIds: string[];
  failedAttempts: Record<string, number>;
};

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
  plaqueText,
  pointsVisible,
  onResult,
  hidePoints,
  isDelf,
  practice,
}: {
  taskId: string;
  config: LetterGapsPublic;
  plaqueText?: string;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  // Задача належить DELF-тесту — лампочки-підказки не рендеряться взагалі.
  isDelf?: boolean;
  practice?: LetterGapsPracticeProps;
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
  // Одиниця CheckConfirmBar — СЛОВО, не окремий пропуск: letter_gaps дає
  // студенту ціле слово з кількома пропущеними буквами, тож "відповідь" —
  // слово в цілому. Незаповнене = ЖОДНА літера не вписана; часткове
  // заповнення вважається "відповів" (gradeLetterGaps і так вимагає ВСІ
  // літери слова правильними, часткове все одно буде показане хибним —
  // лічильник тут лише про те, чи студент узагалі торкався слова).
  function wordIsUnfilled(wi: number) {
    const gaps = answers[wi] ?? [];
    return gaps.length > 0 && gaps.every((c) => c.trim() === "");
  }
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

  // gridRef вішається на грід-обгортку карток нижче (ОДНА й та сама
  // властивість, обидві гілки — non-block і renderBlock() — монтують лише
  // одну з них одночасно). Розмір клітинки сам тепер ФІКСОВАНИЙ
  // (globals.css) — хук лише вирішує, скільки клітинок влазить у рядок
  // картки (perLineFor, для переносу всередині слова нижче) — картка завжди
  // half-width у 2-колонковому режимі, full-width в 1-колонковому, без
  // винятків. Без резерву лампочки: рядки клітинок ідуть НИЖЧЕ заголовка
  // картки, де лампочка (абсолютна, верхній правий кут) уже не заважає —
  // резерв лишається лише на самому заголовку (pr-[52px] нижче).
  const { gridRef } = useWorkingTileLayout();

  // Показовий порядок карток за РЕАЛЬНО заміряною висотою — тепер завжди
  // (колонок у рендері відповідає ШИРИНА контейнера, не кількість слів —
  // TWO_COLUMN_BREAKPOINT_PX, use-working-tile-layout.ts — тож кластеризація
  // для парування в рядку потрібна завжди, а не лише коли слів > 10).
  const { displayOrder, ready, setContentRef, markInteracted } = useTwoColumnWordOrder({
    wordCount: config.words.length,
    fullFlags,
    imageUrls,
    enabled: true,
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

  const router = useRouter();

  // ==== Гілка ≤10 слів (незмінна поведінка) ====
  const single = useExerciseCheck(taskId);
  const singleDetail = single.result?.detail as LetterGapsDetail | undefined;
  const singleCheckConfirm = useCheckConfirm();
  const singleUnanswered = config.words.filter((_, wi) => wordIsUnfilled(wi)).length;
  function submitSingle() {
    single.submit({ letters: answers, hintedWordIndices: [...hintedWordIndices] });
  }

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
      // wi може вказувати на слово поза config.words (застарілий
      // displayOrder у проході рендеру, що буде відкинутий — див.
      // коментар над blockDisplayOrder нижче) — пропускаємо, а не кидаємо.
      const word = config.words[wi];
      if (!word) return;
      const gapCount = word.chars.filter((c) => c === null).length;
      for (let gi = 0; gi < gapCount; gi++) order.push({ wi, gi });
    });
    return order;
  }

  const singleGapOrder = useMemo(
    () => gapOrderFor(displayOrder),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayOrder, config.words]
  );

  // ==== Гілка практики (onlyItemIds) — незалежна від useBlocks/single
  // вище: завжди плаский однoколонковий список, без 2-колонкового
  // вимірювання висоти (useTwoColumnWordOrder) і без BlockNavigation.
  const isPractice = !!practice;
  const practiceWordIndices = isPractice
    ? config.words.map((_, wi) => wi).filter((wi) => practice!.onlyItemIds.includes(String(wi)))
    : [];
  const practiceGapOrder = gapOrderFor(practiceWordIndices);
  const practiceCheck = usePracticeCheck(taskId);
  const [practiceResults, setPracticeResults] = useState<Record<string, boolean>>({});
  const [practiceFailedAttempts, setPracticeFailedAttempts] = useState<Record<string, number>>(
    practice?.failedAttempts ?? {}
  );
  const onlyItemIdsKey = practice?.onlyItemIds.join(",") ?? "";
  const [prevOnlyItemIdsKey, setPrevOnlyItemIdsKey] = useState(onlyItemIdsKey);
  if (isPractice && onlyItemIdsKey !== prevOnlyItemIdsKey) {
    setPrevOnlyItemIdsKey(onlyItemIdsKey);
    setPracticeResults({});
  }

  async function submitPractice() {
    const practiceSet = new Set(practiceWordIndices);
    const letters: (string[] | null)[] = config.words.map((_, wi) => (practiceSet.has(wi) ? answers[wi] : null));
    const answer: Omit<LetterGapsAnswer, "letters"> & { letters: (string[] | null)[] } = {
      letters,
      hintedWordIndices: [...hintedWordIndices],
    };
    const result = await practiceCheck.check(practiceWordIndices.map(String), answer);
    if (!result) return;
    setPracticeResults((prev) => {
      const next = { ...prev };
      for (const r of result.results) next[r.itemId] = r.correct;
      return next;
    });
    setPracticeFailedAttempts(result.failedAttempts);
    for (const r of result.results) {
      if (!r.correct && (result.failedAttempts[r.itemId] ?? 0) >= 2 && !practiceCheck.revealed[r.itemId]) {
        practiceCheck.reveal(r.itemId, false);
      }
    }
  }

  // ==== Гілка блоків (>10 слів) ====
  const [activeBlock, setActiveBlock] = useState(0);
  const blockCheckConfirm = useCheckConfirm();
  useEffect(() => {
    blockCheckConfirm.cancelCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlock]);
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
  // displayOrder скидається в хуку ПІД ЧАС РЕНДЕРУ при зміні wordCount
  // (identity(wordCount) — офіційний React-патерн), але споживач тут
  // читає blockTwoColumn.displayOrder У ТОМУ Ж ПРОХОДІ, ДО того, як цей
  // прохід для хука завершиться: у вікні між зміною activeBlock (блок
  // меншого розміру) і стабілізацією displayOrder локальні індекси можуть
  // лишатись аж до старого (більшого) activeBlockWordIndices.length —
  // li >= activeBlockWordIndices.length дає undefined при мапінгу на
  // глобальний wi. Фільтруємо такі li ПЕРЕД мапінгом — прохід, що однаково
  // буде відкинутий React'ом, не повинен кидати виняток.
  const blockDisplayOrder = activeBlockWordIndices.length
    ? blockTwoColumn.displayOrder
        .filter((li) => li < activeBlockWordIndices.length)
        .map((li) => activeBlockWordIndices[li])
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
      // Оновлює серверні дані сторінки (зокрема блок "Робота над
      // помилками") без перезавантаження — той самий принцип, що
      // useExerciseCheck/usePracticeCheck; тут бракувало цього виклику
      // (єдина відмінність блокової гілки від однокартної).
      router.refresh();
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
  // gapIndex-нумерації через gapOrder). Колонки в обох гілках визначає
  // ширина грід-обгортки (TWO_COLUMN_BREAKPOINT_PX), не кількість слів.
  function renderWordCard(
    wi: number,
    opts: {
      detail: LetterGapsDetail | undefined;
      locked: boolean;
      gapOrder: GapKey[];
      setContentRef: ((wi: number) => (el: HTMLElement | null) => void) | null;
      // Порядковий номер картки у ВІЗУАЛЬНОМУ порядку (displayOrder/
      // blockDisplayOrder/practiceWordIndices, 1-based) — рахується з
      // нуля в кожному блоці/сторінці окремо, не глобальний wi.
      cardNumber: number;
      // Практика (пілот, частина 3) — лампочка "наступна літера" вимкнена:
      // той самий принцип, що fill_blank/multiple_choice в режимі практики
      // (інший, непов'язаний механізм підказки, недоречний у ремедіальному
      // повторі помилок).
      hintDisabled?: boolean;
    }
  ) {
    const word = config.words[wi];
    // Захист від застарілого displayOrder (прохід рендеру, що буде
    // відкинутий — див. коментар над blockDisplayOrder вище): пропускаємо
    // замість кидати, а не покладаємось лише на фільтр на вході.
    if (!word) return null;
    let gapIndex = -1;
    const units = splitPhraseUnits(word.chars);
    const hintUsed = opts.detail?.words[wi]?.hintUsed;
    // Лампочка (28px, абсолютна right-1.5/top-1.5 відносно картки з
    // px-4) виступає ще на ~30px углиб першого рядка — без резерву текст
    // підказки міг ховатись під нею. pr-[52px] (ширина кнопки-лампочки
    // 40px + 12px) лише на заголовку нижче — рядок пропусків/літер ідe
    // НИЖЧЕ заголовка, лампочка туди не сягає, резерв там не потрібен.
    const hasLamp = !opts.locked && !isDelf && !opts.hintDisabled;
    return (
      // Картка НІКОЛИ не займає повний рядок (жодного col-span) — завжди
      // half-width у 2-колонковому режимі, full-width в 1-колонковому.
      <div key={wi} className={`relative ${WORD_CARD}`}>
        {hasLamp && (
          <HintBulb
            state={hintUsed ? "used" : "available"}
            label="Підказка: відкрити наступну літеру"
            disabled={nextHintGap(wi) === null}
            onClick={() => applyHint(wi)}
            className="absolute right-1.5 top-1.5"
          />
        )}
        {hintUsed && <HintUsedBadge />}
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
            className="flex min-w-0 flex-1 flex-col gap-2"
          >
            <p
              className={`word-card-number-row break-words text-sm text-neutral-500 dark:text-neutral-400 [overflow-wrap:anywhere] ${hasLamp ? "pr-[52px]" : ""}`}
            >
              <span className="item-number-badge" aria-label={`Слово ${opts.cardNumber}`}>
                {opts.cardNumber}
              </span>
              {word.hintText.trim() && <span>{frenchNbsp(word.hintText)}</span>}
            </p>
            {/* Кожна одиниця перенесення (артикль/"se"/слово) — на СВОЄМУ
                рядку, одна під одною, зліва (flex-col items-start), а не
                side-by-side: раніше flex-wrap клав короткий артикль поряд з
                довгим словом і items-center вертикально центрував їх один
                відносно одного, через що артикль виглядав "посередині"
                висоти слова, що зайняло 2 рядки переносу. gap-2 — той
                самий відступ, що був МІЖ одиницями в старому flex-wrap. */}
            <div className="flex flex-col items-start gap-2">
              {units.map((unit, ui) => (
                // Перенос ВСЕРЕДИНІ слова — природний (CSS text-wrap:
                // balance на блоковому контейнері з inline-block дітьми, не
                // JS-розрахунок за кількістю клітинок): раніше rowSizes
                // рахувався від unit.length (кожен символ — повна 32px
                // клітинка), а groupChars() застосовувався ПІСЛЯ розбиття
                // на рядки — тож суцільний фрагмент видимих літер міг
                // опинитись розрізаним між двома рядками (половина в
                // одному, половина в іншому), а сам розрахунок ширини рядка
                // був завжди завеликим (видимі літери — вузький текст, не
                // 32px клітинка). Тепер groupChars(unit) викликається ОДИН
                // раз на все слово, кожен фрагмент — один inline-block
                // елемент (unbreakable, white-space:nowrap), і браузер сам
                // переносить рядок МІЖ елементами за їхньою реальною
                // шириною; text-wrap:balance (.letter-group-row,
                // globals.css) рівномірно розподіляє елементи між рядками,
                // щоб на останньому не лишалась самотня клітинка.
                <div key={ui} className="letter-group-row">
                  {groupChars(unit).map((group, ci) => {
                    if (group.type === "letters")
                      return (
                        <span
                          key={ci}
                          className="letter-tile-font letter-group-item whitespace-nowrap"
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
                        onChange={(e) => updateLetter(wi, gi, e.target.value, opts.gapOrder)}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace") handleBackspace(wi, gi, opts.gapOrder);
                        }}
                        onFocus={() => diacritics.onFocus(`${wi},${gi}`)}
                        onBlur={diacritics.onBlur}
                        disabled={opts.locked}
                        className={`letter-tile-cell letter-tile-font letter-group-item border text-center shadow-[0_2px_8px_rgba(184,144,47,0.15)] dark:shadow-sm transition-colors ${
                          hintedGaps.has(`${wi},${gi}`)
                            ? "border-sky-400 bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400"
                            : status === "correct"
                              ? LIVE_CORRECT_CLASS
                              : status === "incorrect"
                                ? LIVE_INCORRECT_CLASS
                                : "glass-gap-shadow border-[rgba(217,183,101,0.55)] bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-800/70"
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
    const errMsg = blockError[activeBlock];
    // Порядок автопереходу — за ПОКАЗОВИМ порядком карток (blockDisplayOrder),
    // не за вихідним wordBlocks[activeBlock] — той самий принцип, що
    // singleGapOrder/displayOrder у ≤10-гілці ("Tab рухається так, як
    // вправа виглядає на екрані").
    const blockGapOrder = gapOrderFor(blockDisplayOrder);

    return (
      <div className="flex flex-col gap-3">
        <div
          ref={gridRef}
          className={`transition-opacity duration-150 ${
            blockTwoColumn.ready ? "opacity-100" : "opacity-0"
          } grid gap-3 ${TWO_COLUMN_GRID_CLASS}`}
        >
          {blockDisplayOrder.map((wi, pos) =>
            renderWordCard(wi, {
              detail: blockDetail,
              locked: !!blockResult,
              gapOrder: blockGapOrder,
              setContentRef: blockTwoColumn.setContentRef,
              cardNumber: pos + 1,
            })
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {blockResult && (
            <TaskResult
              correct={blockResult.correct}
              pointsEarned={blockResult.pointsEarned}
              pointsPossible={blockResult.pointsPossible}
              toggleTitle={TABLE_FILL_ANSWERS_TOGGLE_LABEL}
              toggleCount={blockDetail ? blockDisplayOrder.length : undefined}
              hintSummary={{
                hintCount: blockDetail?.words.filter((w) => w.hintUsed).length ?? 0,
                reducesPoints: config.hintsReducePoints,
              }}
            >
              {blockDetail && (
                <TaskResultGapRows rows={buildLetterGapsRows(blockDisplayOrder, config.words, blockDetail)} />
              )}
            </TaskResult>
          )}
        </div>
        {blockCheckConfirm.confirming && (
          <CheckConfirmBar
            unansweredCount={activeBlockUnanswered}
            onConfirm={() => blockCheckConfirm.confirmCheck(() => submitBlock(activeBlock))}
            onCancel={blockCheckConfirm.cancelCheck}
          />
        )}
        {errMsg && <p className="text-sm text-red-600 dark:text-red-400">{errMsg}</p>}
      </div>
    );
  }

  if (isPractice) {
    return (
      <div className={EXERCISE_STACK}>
        <div className="flex flex-col gap-3">
          {practiceWordIndices.map((wi, pos) => {
            const key = String(wi);
            const isCorrect = practiceResults[key];
            const attempts = practiceFailedAttempts[key] ?? 0;
            const itemRevealed = practiceCheck.revealed[key];
            return (
              <div key={wi} className="flex flex-col gap-1.5">
                {renderWordCard(wi, {
                  detail: undefined,
                  locked: false,
                  gapOrder: practiceGapOrder,
                  setContentRef: null,
                  hintDisabled: true,
                  cardNumber: pos + 1,
                })}
                {isCorrect === true && (
                  <p className="pl-1 text-xs font-medium text-green-600 dark:text-green-400">Правильно ✓</p>
                )}
                {isCorrect === false && (
                  <div className="flex flex-wrap items-center gap-2 pl-1 text-xs">
                    <span className="text-red-600 dark:text-red-400">
                      Неправильно, спробуйте ще раз (спроб: {attempts})
                    </span>
                    {!itemRevealed && (
                      <button
                        type="button"
                        onClick={() => practiceCheck.reveal(key, true)}
                        disabled={!!practiceCheck.revealPending[key]}
                        className={STUDENT_BUTTON_SECONDARY_TOUCH}
                      >
                        Показати відповідь
                      </button>
                    )}
                  </div>
                )}
                {itemRevealed && (
                  <p className="pl-1 text-xs italic text-amber-700 dark:text-amber-400">
                    Правильне слово: {itemRevealed.join(", ")}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {diacritics.rect && diacritics.activeKey && (
          <DiacriticsPopup
            rect={diacritics.rect}
            onPick={(ch) => {
              const [wi, gi] = diacritics.activeKey!.split(",").map(Number);
              updateLetter(wi, gi, ch, practiceGapOrder);
            }}
          />
        )}

        {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={submitPractice}
            disabled={practiceCheck.pending || !practiceWordIndices.every(isWordFilled)}
            className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
          >
            {practiceCheck.pending ? "Перевіряю..." : "Перевірити"}
          </button>
          {practiceCheck.error && <p className="text-sm text-red-600 dark:text-red-400">{practiceCheck.error}</p>}
        </div>
      </div>
    );
  }

  const pointsText =
    !hidePoints && (pointsVisible || (useBlocks ? aggregateResult : singleDetail))
      ? useBlocks
        ? aggregateResult
          ? `${aggregateResult.pointsEarned}/${config.points} ${pluralizePoints(config.points)}`
          : `${config.points} ${pluralizePoints(config.points)}`
        : singleDetail
          ? `${single.result?.correct ? config.points : 0}/${config.points} ${pluralizePoints(config.points)}`
          : `${config.points} ${pluralizePoints(config.points)}`
      : undefined;
  const hintText = isDelf
    ? null
    : (useBlocks ? allBlocksChecked : !!single.result)
      ? null
      : hintExplanationText("letter_gaps");

  // ЕТАП M — кнопка "Перевірити блок" для спільного рядка check+←/→
  // (BlockNavFooter) — ті самі значення, що читає renderBlock() вище
  // (blockResults[activeBlock]/blockPending[activeBlock]/submitBlock),
  // обчислені тут, бо BlockNavigation.checkButton рендериться поза
  // деревом, яке повертає renderBlock().
  const activeBlockResult = blockResults[activeBlock];
  const activeBlockPending = !!blockPending[activeBlock];
  const activeBlockWordIndicesForCheck = wordBlocks[activeBlock] ?? [];
  const activeBlockUnanswered = activeBlockWordIndicesForCheck.filter((wi) => wordIsUnfilled(wi)).length;
  const checkButtonEl = useBlocks ? (
    <button
      type="button"
      onClick={() => blockCheckConfirm.attemptCheck(activeBlockUnanswered, () => submitBlock(activeBlock))}
      disabled={activeBlockPending || activeBlockUnanswered === activeBlockWordIndicesForCheck.length}
      className="exercise-block-check-btn"
    >
      {activeBlockPending ? "Перевіряю..." : activeBlockResult ? "Перевірити ще раз" : "Перевірити блок"}
    </button>
  ) : null;

  return (
    <div className={EXERCISE_STACK}>
      <BlockTabs
        plaqueText={plaqueText}
        blockCount={blockCount}
        activeBlock={activeBlock}
        onChangeBlock={setActiveBlock}
        isBlockChecked={(i) => i in blockResults}
        pointsText={pointsText}
      />
      <TaskPanelHeader
        blockCount={blockCount}
        activeBlock={activeBlock}
        onChangeBlock={setActiveBlock}
        isBlockChecked={(i) => i in blockResults}
        pointsText={pointsText}
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.letter_gaps.instruction}
        subInstructionText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.letter_gaps.subInstruction}
        hintText={hintText}
      />

      {!useBlocks ? (
        <>
          <div
            ref={gridRef}
            className={`transition-opacity duration-150 ${
              ready ? "opacity-100" : "opacity-0"
            } grid gap-3 ${TWO_COLUMN_GRID_CLASS}`}
          >
            {displayOrder.map((wi, pos) =>
              renderWordCard(wi, {
                detail: singleDetail,
                locked: !!single.result,
                gapOrder: singleGapOrder,
                setContentRef,
                cardNumber: pos + 1,
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
              <div className="flex flex-col items-start gap-2">
                <button
                  type="button"
                  onClick={() => singleCheckConfirm.attemptCheck(singleUnanswered, submitSingle)}
                  disabled={single.pending || singleUnanswered === config.words.length}
                  className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
                >
                  {single.pending ? "Перевіряю..." : "Перевірити"}
                </button>
                {singleCheckConfirm.confirming && (
                  <CheckConfirmBar
                    unansweredCount={singleUnanswered}
                    onConfirm={() => singleCheckConfirm.confirmCheck(submitSingle)}
                    onCancel={singleCheckConfirm.cancelCheck}
                  />
                )}
              </div>
            ) : (
              <TaskResult
                correct={single.result.correct}
                pointsEarned={single.result.pointsEarned}
                pointsPossible={single.result.pointsPossible}
                toggleTitle={TABLE_FILL_ANSWERS_TOGGLE_LABEL}
                toggleCount={singleDetail ? displayOrder.length : undefined}
                hintSummary={{
                  hintCount: singleDetail?.words.filter((w) => w.hintUsed).length ?? 0,
                  reducesPoints: config.hintsReducePoints,
                }}
              >
                {singleDetail && (
                  <TaskResultGapRows rows={buildLetterGapsRows(displayOrder, config.words, singleDetail)} />
                )}
              </TaskResult>
            )}
            {single.error && <p className="text-sm text-red-600 dark:text-red-400">{single.error}</p>}
          </div>
        </>
      ) : (
        <BlockNavigation
          blockCount={blockCount}
          activeBlock={activeBlock}
          onChangeBlock={setActiveBlock}
          blockResults={blockResults}
          checkButton={checkButtonEl}
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
