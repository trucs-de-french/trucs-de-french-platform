"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { hintExplanationText } from "./hint-explanation";
import { TaskPanelHeader } from "./task-panel-header";
import { HintBulb, HintUsedBadge } from "./hint-bulb";
import type { LetterGapsPublic, LetterGapsDetail, GradeResult, LetterGapsAnswer } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS, DEFAULT_TRANSLATION_EN, taskTranslationLine } from "@/lib/exercises/default-instructions";
import { frenchNbsp } from "@/lib/text/french-typography";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { BUTTON_CHECK } from "@/lib/button-styles";
import { DiacriticsPopup, useDiacriticsPopup } from "./diacritics-popup";
import { CompactAudioButton } from "./compact-audio-button";
import { ImageLightbox } from "./image-lightbox";
import { EXERCISE_STACK, RESULT_ROW_GAP_CLASS } from "@/lib/spacing";
import { WORD_CARD, splitPhraseUnits } from "@/lib/exercises/word-list-layout";
import { TaskResult, TaskResultGapRows } from "./task-result";
import { headerPointsState } from "@/lib/exercises/header-points";
import { useCheckConfirm, CheckConfirmBar } from "./check-confirm";
import { useT } from "@/lib/i18n/context";
import { EXERCISE_BLOCK_SIZE, chunkWithoutSingleton, chunkWithMinTail } from "@/lib/exercises/exercise-blocks";
import { BlockNavigation, BlockTabs } from "./block-navigation";
import { usePracticeCheck } from "./use-practice-check";
import { practiceAttemptFooterState, pruneStaleResults } from "@/lib/exercises/error-review";
import { PracticeAttemptFooter } from "./practice-attempt-footer";
import { useWorkingTileLayout, TWO_COLUMN_GRID_CLASS } from "./use-working-tile-layout";
import { splitIntoSyllableChunks, reconstructUnitWord, sliceUnitByChunks } from "@/lib/exercises/syllable-split";
import { groupChars } from "@/lib/exercises/letter-cell-groups";
import {
  estimateLetterGapsCardRows,
  letterGapsPracticeLayout,
  orderByEstimatedRows,
  REFERENCE_ROW_WIDTH_PX,
  type LetterGapsForcedBreak,
} from "@/lib/exercises/estimate-card-rows";
import { pairPracticeItems } from "@/lib/exercises/flat-practice-layout";
import { buildGapRowsFromReveal } from "@/lib/exercises/format-reveal-answer";

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
  // number — ПОЗИЦІЯ в wordIndices (display-порядок, той самий, що номер
  // картки на екрані), НЕ оригінальний wi: wordIndices сам уже є
  // displayOrder/blockDisplayOrder (картки перемішані за estimateCardRows),
  // тож "wi+1" давав би номер, що не збігається з карткою на екрані.
  return wordIndices.map((wi, pos) => {
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
    return { number: pos + 1, parts };
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
  // Сцена-вигляд (openMode="scene", мистейки-сторінка, крок 4) — лише
  // error-review-block.tsx передає: onlyItemIds вище стає ЗАМОРОЖЕНИМ
  // знімком помилок на момент відкриття задачі (стабільне членство блоку
  // на всю сесію, не live remainingItemIds), а плашка+заголовок+блоки
  // (нижче) замінюють плаский одноколонковий список. correctedItemIds —
  // підмножина onlyItemIds, вже виправлена ПІСЛЯ знімку (цього сеансу) —
  // показується "вирішеною" в своєму блоці замість зникнення. Інлайн-
  // картка сцени (error_correction, без цього поля) лишається пласким
  // списком без плашки, НЕЗМІННО.
  scene?: { correctedItemIds: string[] };
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

type LetterGapsResult = Extract<GradeResult, { detail: LetterGapsDetail }>;

export function LetterGapsExercise({
  taskId,
  config,
  plaqueText,
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
  const { t, lang } = useT();
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
    () => chunkWithoutSingleton(config.words.map((_, wi) => wi), EXERCISE_BLOCK_SIZE),
    [config.words]
  );
  const blockCount = wordBlocks.length;
  const useBlocks = blockCount > 1;

  // gridRef вішається на грід-обгортку карток нижче (ОДНА й та сама
  // властивість, обидві гілки — non-block і renderBlock() — монтують лише
  // одну з них одночасно). Розмір клітинки сам тепер ФІКСОВАНИЙ
  // (globals.css) — хук лише вирішує, скільки клітинок влазить у рядок
  // картки (perLineFor, для переносу всередині слова нижче) — картка завжди
  // half-width у 2-колонковому режимі, full-width в 1-колонковому, без
  // винятків. Без резерву лампочки: рядки клітинок ідуть НИЖЧЕ заголовка
  // картки, де лампочка (абсолютна, верхній правий кут) уже не заважає —
  // резерв лишається лише на самому заголовку (pr-[52px] нижче).
  //
  // Задача "simplification of the card layout for letter practice" (п.5) —
  // ready/twoColumn/halfCardInnerPx потрібні ЛИШЕ для практики (нижче,
  // practiceRowWidthPx): РЕАЛЬНА виміряна half-колонкова ширина замінює
  // фіксовану оцінку (REFERENCE_ROW_WIDTH_PX), коли вона вже готова
  // (ready && twoColumn — поза 2-колонковим режимом ця величина не має
  // сенсу). displayOrder/renderBlock() (реальна вправа) і далі
  // НЕЗМІННО використовують estimateLetterGapsCardRows БЕЗ третього
  // аргументу (дефолт REFERENCE_ROW_WIDTH_PX) — ця задача їх не чіпає.
  const { gridRef, ready, twoColumn, halfCardInnerPx } = useWorkingTileLayout();
  const practiceRowWidthPx = ready && twoColumn ? halfCardInnerPx : REFERENCE_ROW_WIDTH_PX;

  // Показовий порядок карток — за ОЦІНЕНОЮ кількістю рядків клітинок
  // (estimateLetterGapsCardRows, ЧИСТА функція від даних слова, без
  // DOM-вимірювання/useEffect/ResizeObserver, що були тут раніше): картки з
  // однаковою оціненою кількістю рядків стають сусідами в рядку
  // 2-колонкового grid (orderByEstimatedRows — сортування за зростанням,
  // стійке в межах того самого значення). Порядок слів студенту НЕ
  // принциповий (контрольна умова задачі) — номер картки нижче (cardNumber)
  // це позиція у ЦЬОМУ порядку, 1..N, а не оригінальний wi; відповіді/
  // помилки/error review лишаються прив'язані до оригінального wi
  // (String(wordIndex)) всюди нижче — displayOrder лише визначає, ЯКУ
  // картку показати на якій позиції екрана. useMemo — не useState: чистий
  // детермінований вивід з config.words, однаковий до/після перевірки, при
  // перемиканні блоку й після перезавантаження з тими самими даними.
  const displayOrder = useMemo(
    () => orderByEstimatedRows(config.words.map((w) => estimateLetterGapsCardRows(w.chars, w.hiddenLetters))),
    [config.words]
  );

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
  // вище: завжди плаский однoколонковий список (вихідний порядок слів, без
  // estimateCardRows-мішання) і без BlockNavigation.
  const isPractice = !!practice;
  const practiceWordIndices = isPractice
    ? config.words.map((_, wi) => wi).filter((wi) => practice!.onlyItemIds.includes(String(wi)))
    : [];
  const practiceCheck = usePracticeCheck(taskId);
  // Сцена-вигляд (крок 4) — попередньо "вирішені" елементи (виправлені
  // ПІСЛЯ знімку onlyItemIds, practice.scene.correctedItemIds,
  // error-review-block.tsx) засіюються як correct:true одразу при
  // монтуванні — той самий вигляд ("Правильно" під карткою), що й щойно
  // перевірений елемент, без повторного запиту.
  const [practiceResults, setPracticeResults] = useState<Record<string, boolean>>(() => {
    const seed: Record<string, boolean> = {};
    for (const id of practice?.scene?.correctedItemIds ?? []) seed[id] = true;
    return seed;
  });
  const [practiceFailedAttempts, setPracticeFailedAttempts] = useState<Record<string, number>>(
    practice?.failedAttempts ?? {}
  );
  const onlyItemIdsKey = practice?.onlyItemIds.join(",") ?? "";
  const [prevOnlyItemIdsKey, setPrevOnlyItemIdsKey] = useState(onlyItemIdsKey);
  if (isPractice && onlyItemIdsKey !== prevOnlyItemIdsKey) {
    setPrevOnlyItemIdsKey(onlyItemIdsKey);
    setPracticeResults((prev) => pruneStaleResults(prev, practice!.onlyItemIds));
  }

  // Сцена-вигляд (крок 4) — блоки по EXERCISE_BLOCK_SIZE слів, той самий
  // поріг, що звичайна вправа (wordBlocks вище, chunkWithoutSingleton,
  // minTail=2), лише на practiceWordIndices (знімок помилок, не всю
  // вправу) — АЛЕ з minTail=3, не 2 (задача "block rule: do not create a
  // trailing block of 1 or 2 cards" — ЛИШЕ практика цих двох типів):
  // залишок 1 чи 2 елементи зливається в ПОПЕРЕДНІЙ блок (11/12 -> один
  // блок; 13 -> 10,3; 21 -> 10,11; 22 -> 10,12; 23 -> 10,10,3). Картки
  // зберігають той самий розмір/вигляд незалежно від розміру блоку (11 чи
  // 12 карток — звичайна 2-колонкова сітка, без жодної спеціальної
  // розмітки). blockCount<=1 — БЕЗ вкладок/футера нижче (той самий
  // built-in захист, що BlockTabs/BlockNavigation уже мають для звичайної
  // вправи), плашка+заголовок лишаються завжди.
  const isSceneMode = !!practice?.scene;
  const practiceBlocks = isSceneMode ? chunkWithMinTail(practiceWordIndices, EXERCISE_BLOCK_SIZE, 3) : [];
  const practiceBlockCount = practiceBlocks.length;
  const practiceUseBlocks = practiceBlockCount > 1;
  const [practiceActiveBlock, setPracticeActiveBlock] = useState(0);
  const [practiceBlockAttempted, setPracticeBlockAttempted] = useState<Record<number, boolean>>({});

  // indices — всі слова практики (плаский режим) чи лише активного блоку
  // (сцена-вигляд); blockIndex — лише сцена-вигляд, позначає цей блок
  // "спробуваним" (чекмарк на вкладці, той самий принцип, що
  // isBlockChecked={(i) => i in blockResults} звичайної вправи).
  async function submitPractice(indices: number[], blockIndex?: number) {
    const practiceSet = new Set(indices);
    const letters: (string[] | null)[] = config.words.map((_, wi) => (practiceSet.has(wi) ? answers[wi] : null));
    const answer: Omit<LetterGapsAnswer, "letters"> & { letters: (string[] | null)[] } = {
      letters,
      hintedWordIndices: [...hintedWordIndices],
    };
    const result = await practiceCheck.check(indices.map(String), answer);
    if (!result) return;
    setPracticeResults((prev) => {
      const next = { ...prev };
      for (const r of result.results) next[r.itemId] = r.correct;
      return next;
    });
    setPracticeFailedAttempts(result.failedAttempts);
    if (blockIndex !== undefined) setPracticeBlockAttempted((prev) => ({ ...prev, [blockIndex]: true }));
    // Задача "unify attempt/reveal behaviour" — без автоматичного
    // розкриття в жодному потоці (shouldAutoReveal, error-review.ts,
    // завжди false): сцена-вигляд і далі показує відповідь лише через
    // панель "Правильні відповіді" (reveal(id, true) на відкриття панелі,
    // revealBlockAnswers нижче), флет — своєю пілюлею "Відповідь" поруч.
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

  // Той самий принцип, що displayOrder вище — ОКРЕМЕ обчислення,
  // СКОУПЛЕНЕ на слова АКТИВНОГО блоку (не на всю вправу): оцінка рядків і
  // сортування рахуються лише серед activeBlockWordIndices, локальна
  // позиція мапиться назад на глобальний wi самим масивом
  // (activeBlockWordIndices[localIndex]) — чисте обчислення щоразу з
  // поточних даних, без застарілого локального індексу між блоками різного
  // розміру (на відміну від попереднього DOM-вимірювання, де React-стан
  // хука міг на кадр лишитись від іншого wordCount).
  const activeBlockWordIndices = useMemo(
    () => (useBlocks ? (wordBlocks[activeBlock] ?? []) : []),
    [useBlocks, wordBlocks, activeBlock]
  );
  const blockDisplayOrder = useMemo(() => {
    const rows = activeBlockWordIndices.map((wi) =>
      estimateLetterGapsCardRows(config.words[wi].chars, config.words[wi].hiddenLetters)
    );
    return orderByEstimatedRows(rows).map((li) => activeBlockWordIndices[li]);
  }, [activeBlockWordIndices, config.words]);

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
        throw new Error(body.error ?? t("error.checkFailed"));
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
        [blockIndex]: e instanceof Error ? e.message : t("error.checkFailed"),
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
      // Порядковий номер картки у ВІЗУАЛЬНОМУ порядку (displayOrder/
      // blockDisplayOrder/practiceWordIndices, 1-based) — рахується з
      // нуля в кожному блоці/сторінці окремо, не глобальний wi.
      cardNumber: number;
      // Практика (пілот, частина 3) — лампочка "наступна літера" вимкнена:
      // той самий принцип, що fill_blank/multiple_choice в режимі практики
      // (інший, непов'язаний механізм підказки, недоречний у ремедіальному
      // повторі помилок).
      hintDisabled?: boolean;
      // Сцена-вигляд практики (крок 3c) — футер "спроби" (крапки, без
      // пілюлі "Відповідь": letter_gaps уже має панель "Правильні
      // відповіді", renderPracticeItem нижче), рендериться усередині
      // картки, під полями. undefined (флет-практика/реальна вправа) —
      // нічого не рендериться.
      practiceFooter?: ReactNode;
      // Задача "pack word groups greedily on a line" — ЛИШЕ практика
      // (pairPracticeItems/letterGapsPracticeLayout): ПОВНИЙ набір —
      // куди саме (після якої одиниці/фрагмента) вставити форсовані
      // розриви рядка всередині .word-units-row нижче — [] (реальна
      // вправа, чи практика без потреби в розриві) — нічого не
      // вставляється, природний CSS-перенос лишається НЕЗМІННИМ.
      forcedBreaks?: LetterGapsForcedBreak[];
    }
  ) {
    const word = config.words[wi];
    // Захист від застарілого displayOrder (прохід рендеру, що буде
    // відкинутий — див. коментар над blockDisplayOrder вище): пропускаємо
    // замість кидати, а не покладаємось лише на фільтр на вході.
    if (!word) return null;
    let gapIndex = -1;
    const units = splitPhraseUnits(word.chars);
    // Фрагменти для кожної одиниці (артикль/"se"/слово) — рахуються один
    // раз тут, не в JSX нижче, бо потребують бігучого offset пропусків
    // (gapOffset) окремого від gapIndex, яким нумеруються самі <input>.
    let gapOffset = 0;
    const unitChunkGroups = units.map((unit) => {
      const unitWord = reconstructUnitWord(unit, word.hiddenLetters, gapOffset);
      gapOffset += unit.filter((c) => c === null).length;
      return sliceUnitByChunks(unit, splitIntoSyllableChunks(unitWord));
    });
    const hintUsed = opts.detail?.words[wi]?.hintUsed;
    // Лампочка (28px, абсолютна right-1.5/top-1.5 відносно картки з
    // px-4) виступає ще на ~30px углиб першого рядка — без резерву текст
    // підказки міг ховатись під нею. pr-[52px] (ширина кнопки-лампочки
    // 40px + 12px) лише на заголовку нижче — рядок пропусків/літер ідe
    // НИЖЧЕ заголовка, лампочка туди не сягає, резерв там не потрібен.
    const hasLamp = !opts.locked && !isDelf && !opts.hintDisabled;
    return (
      // Задача "simplification of the card layout for letter practice" —
      // КОЖНА картка (реальна вправа Й практика) завжди half-width у
      // 2-колонковому режимі, full-width в 1-колонковому — без жодного
      // винятку (попередні full-width/content-width класи практики
      // прибрані цілком).
      <div key={wi} className={`relative ${WORD_CARD}`}>
        {hasLamp && (
          <HintBulb
            state={hintUsed ? "used" : "available"}
            label={t("lettergaps.hintOpenNextLetter")}
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
                  aria-label={t("button.showFullImageAria")}
                  className="shrink-0 cursor-zoom-in"
                >
                  <ImageOrPlaceholder src={word.imageUrl} alt="" className="h-11 w-11 rounded-lg object-cover" useFocus />
                </button>
              )}
              {word.audioUrl && <CompactAudioButton src={word.audioUrl} />}
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2"
          >
            <p
              className={`word-card-number-row break-words text-sm text-[var(--uk-clue-text-light)] dark:text-[var(--card-ink-2)] [overflow-wrap:anywhere] ${hasLamp ? "pr-[52px]" : ""}`}
            >
              <span className="item-number-badge" aria-label={t("aria.word", { n: opts.cardNumber })}>
                {opts.cardNumber}
              </span>
              {word.hintText.trim() && <span>{frenchNbsp(word.hintText)}</span>}
            </p>
            {/* Пакування одиниць переносу (артикль/"se"/слово) у рядки за
                реальною шириною — одиниці ("faire", "un", "bisou"...) течуть
                як текст (display:inline-block, .word-unit-group), браузер
                переносить МІЖ одиницями, коли вони не влазять на поточний
                рядок разом (не JS-розрахунок за кількістю клітинок, як
                раніше). Усередині одиниці перенос можливий лише МІЖ
                складовими фрагментами (splitIntoSyllableChunks вище,
                .syllable-chunk, nowrap) — рядок, подовжений за середину
                голосної групи чи нерозривного кластера (ch/gr/...),
                неможливий; якщо одиниця ціла влазить у рядок, вона лишається
                одним суцільним словом (inline-block + max-width:100% — не
                форсований розрив, лише дозволений, коли реально не влазить).
                margin-bottom на .word-units-row скасовує нижній відступ
                ОСТАННЬОГО рядка (той самий трюк, що раніше в
                .letter-group-row), щоб не подвоювався з gap-2 зовнішнього
                flex-col контейнера. */}
            <div className="word-units-row">
              {units.flatMap((unit, ui) => {
                const unitEl = (
                  <span key={ui} className="word-unit-group">
                    {unitChunkGroups[ui].flatMap((chunkChars, ci) => {
                      const chunkEl = (
                        <span key={ci} className="syllable-chunk">
                          {groupChars(chunkChars).map((group, gi) => {
                            if (group.type === "letters")
                              return (
                                <span
                                  key={gi}
                                  className="letter-tile-font letter-group-item whitespace-nowrap"
                                >
                                  {group.text}
                                </span>
                              );
                            gapIndex += 1;
                            const gIdx = gapIndex;
                            const status = gapLiveStatus(wi, gIdx);
                            return (
                              <input
                                key={gi}
                                ref={diacritics.fieldRef(`${wi},${gIdx}`)}
                                maxLength={1}
                                value={answers[wi][gIdx]}
                                onChange={(e) => updateLetter(wi, gIdx, e.target.value, opts.gapOrder)}
                                onKeyDown={(e) => {
                                  if (e.key === "Backspace") handleBackspace(wi, gIdx, opts.gapOrder);
                                }}
                                onFocus={() => diacritics.onFocus(`${wi},${gIdx}`)}
                                onBlur={diacritics.onBlur}
                                disabled={opts.locked}
                                className={`letter-tile-cell letter-tile-font letter-group-item border text-center shadow-[0_2px_8px_rgba(184,144,47,0.15)] dark:shadow-sm transition-colors ${
                                  hintedGaps.has(`${wi},${gIdx}`)
                                    ? "border-sky-400 bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400"
                                    : status === "correct"
                                      ? "border-green-500 bg-green-50 dark:border-[var(--field-correct-border)] dark:bg-[var(--field-correct-bg)] dark:text-[var(--field-correct-ink)]"
                                      : status === "incorrect"
                                        ? "border-red-500 bg-red-50 dark:border-[var(--field-wrong-border)] dark:bg-[var(--field-wrong-bg)] dark:text-[var(--field-wrong-ink)]"
                                        : "exercise-field glass-gap-shadow border-[rgba(217,183,101,0.55)] bg-white hover:bg-neutral-50"
                                }`}
                              />
                            );
                          })}
                        </span>
                      );
                      // Задача "a lone visible letter attached to nothing
                      // must not be alone on a line" — форсований розрив
                      // УСЕРЕДИНІ ОДНІЄЇ (завеликої) одиниці, між її
                      // власними силабічними фрагментами (будь-який
                      // елемент opts.forcedBreaks з kind==="afterChunk",
                      // letterGapsPracticeLayout, estimate-card-rows.ts —
                      // ПОВНИЙ набір, не один, задача "pack word groups
                      // greedily on a line").
                      if (
                        (opts.forcedBreaks ?? []).some(
                          (b) => b.kind === "afterChunk" && b.unitIndex === ui && b.chunkIndex === ci
                        )
                      ) {
                        return [chunkEl, <span key={`cbreak-${ci}`} aria-hidden="true" className="practice-forced-line-break" />];
                      }
                      return [chunkEl];
                    })}
                  </span>
                );
                // Задача "pack word groups greedily on a line" — форсований
                // розрив МІЖ двома ЦІЛИМИ одиницями переносу (будь-який
                // елемент opts.forcedBreaks з kind==="afterUnit") — на
                // КОЖНІЙ межі рядка жадібного пакування слово-груп, не
                // лише там, де природний перенос МІГ БИ розійтися з
                // оцінкою (GIVEN_LETTER_WIDTH_PX — наближення, не точний
                // CSS-розмір).
                if ((opts.forcedBreaks ?? []).some((b) => b.kind === "afterUnit" && b.unitIndex === ui)) {
                  return [unitEl, <span key={`ubreak-${ui}`} aria-hidden="true" className="practice-forced-line-break" />];
                }
                return [unitEl];
              })}
            </div>
          </div>
        </div>
        {opts.practiceFooter}
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
        <div ref={gridRef} className={`grid gap-3 ${TWO_COLUMN_GRID_CLASS}`}>
          {blockDisplayOrder.map((wi, pos) =>
            renderWordCard(wi, {
              detail: blockDetail,
              locked: !!blockResult,
              gapOrder: blockGapOrder,
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
              toggleTitle={t("panel.correctAnswers")}
              toggleCount={blockDetail ? blockDisplayOrder.length : undefined}
              hintSummary={{
                hintCount: blockDetail?.words.filter((w) => w.hintUsed).length ?? 0,
                reducesPoints: config.hintsReducePoints,
              }}
            >
              {blockDetail && (
                <TaskResultGapRows rows={buildLetterGapsRows(blockDisplayOrder, config.words, blockDetail)} twoColumn />
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

  // Одна картка практики + рядок статусу під нею — спільне для плаского
  // режиму (інлайн-картка сцени: крок 5 — 2-колонкова сітка з
  // pairPracticeItems, flatGapOrder) і сцена-вигляду блоків (крок 4:
  // gapOrderFor активного блоку, нижче). hideReveal — лише
  // сцена-вигляд (крок 3b): інлайн-кнопка "Показати відповідь"+розкритий
  // текст замінюються на спільну панель "Правильні відповіді" під блоком
  // (showToggle-картка TaskResult, той самий компонент, що звичайна
  // вправа), щоб не дублювати відповідь у двох місцях; лічильник спроб
  // лишається — у звичайної вправи нема свого еквівалента цього рядка.
  // Задача "no holes in the middle of the grid" — layout тепер завжди
  // приходить від pairPracticeItems (flat-practice-layout.ts), в ОБОХ
  // режимах (сцена-вигляд блоків і флет): displayNumber — наскрізна
  // нумерація в новому порядку (короткі пари → мішана пара, якщо S і L
  // обидва непарні → довгі пари → одинока картка, якщо лишилась —
  // ЖОДНОЇ дірки в середині блоку, filler більше не потрібен). forcedBreaks
  // — куди вставити форсовані розриви усередині .word-units-row
  // (renderWordCard), рахується ОКРЕМО (не частина layout — той самий
  // letterGapsPracticeLayout виклик, що дав cardClass/lines для пари,
  // лише інше поле результату).
  function renderPracticeItem(
    wi: number,
    layout: { displayNumber: number },
    forcedBreaks: LetterGapsForcedBreak[],
    gapOrder: GapKey[],
    hideReveal = false
  ) {
    const key = String(wi);
    const isCorrect = practiceResults[key];
    const attempts = practiceFailedAttempts[key] ?? 0;
    const itemRevealed = practiceCheck.revealed[key];

    if (hideReveal) {
      // Сцена-вигляд (крок 3c, "варіант 3 — крапки спроб") — футер
      // усередині картки, без пілюлі "Відповідь" (панель "Правильні
      // відповіді", renderBlock() нижче, уже дає відповіді); коректний
      // елемент — без футера й без тексту "Правильно" (зелені поля й так
      // це показують).
      const footer =
        isCorrect === false ? (
          <PracticeAttemptFooter state="failed" failedAttempts={attempts} />
        ) : undefined;
      return renderWordCard(wi, {
        detail: undefined,
        locked: false,
        gapOrder,
        hintDisabled: true,
        cardNumber: layout.displayNumber,
        practiceFooter: footer,
        forcedBreaks,
      });
    }

    // Задача "unify attempt/reveal behaviour" — флет-режим (на відміну від
    // сцена-вигляду вище) не має блочної панелі "Правильні відповіді", тож
    // лишається ЄДИНИМ способом розкрити відповідь: той самий футер
    // (крапки спроб), що сцена-вигляд, + пілюля "Відповідь" (не кнопка
    // BUTTON_REVEAL_ANSWER) — той самий .practice-reveal-pill, що
    // letter-rearrangement.tsx. Розкрита відповідь — рядок "Правильне
    // слово" у ТОМУ Ж слоті footer (correct-answer-label/correct-answer-
    // word, той самий вигляд, що Task A), замінює крапки після розкриття.
    const footer = (
      <PracticeAttemptFooter
        state={practiceAttemptFooterState(isCorrect, itemRevealed)}
        failedAttempts={attempts}
        onReveal={() => practiceCheck.reveal(key, true)}
        revealDisabled={!!practiceCheck.revealPending[key]}
      >
        {itemRevealed && (
          <p className="text-sm dark:text-[var(--text-muted-caption)]">
            <span className="correct-answer-label">{t("answer.correctWordLabel")} </span>
            <span className="correct-answer-word text-[#3b36c4]">{itemRevealed.join(", ")}</span>
          </p>
        )}
      </PracticeAttemptFooter>
    );
    return (
      <div key={wi} className="flex flex-col gap-1.5">
        {renderWordCard(wi, {
          detail: undefined,
          locked: false,
          gapOrder,
          hintDisabled: true,
          cardNumber: layout.displayNumber,
          practiceFooter: footer,
          forcedBreaks,
        })}
        {isCorrect === true && (
          <p className="pl-1 text-xs font-medium text-green-600 dark:text-green-400">{t("status.correct")}</p>
        )}
      </div>
    );
  }

  if (isPractice && isSceneMode) {
    const activeIndices = practiceUseBlocks ? (practiceBlocks[practiceActiveBlock] ?? []) : practiceWordIndices;
    const activeBlockIndex = practiceUseBlocks ? practiceActiveBlock : 0;
    // Задача "no holes in the middle of the grid" — той самий
    // pairPracticeItems, що флет-режим нижче, рахований на активний блок;
    // activeGapOrder далі будується з ЦЬОГО відображуваного порядку (не
    // сирого activeIndices), інакше Tab/Enter-навігація між пропусками
    // стрибала б за позиційним порядком, не за тим, що студент бачить на
    // екрані (той самий принцип, що flatGapOrder нижче вже застосовує).
    // letterGapsPracticeLayout рахується ОДИН раз на слово —
    // forcedBreaksByWi зберігає ПОВНИЙ набір розривів (forcedBreaks) для
    // рендеру нижче, lines — для мішаного парuвання ("найкоротша довга"),
    // practiceRowWidthPx — РЕАЛЬНА виміряна half-колонкова ширина (чи
    // фолбек, доки не готова), той самий принцип, що estimateLetterGapsCardRows
    // вище.
    const activeLayouts = activeIndices.map((wi) =>
      letterGapsPracticeLayout(config.words[wi].chars, config.words[wi].hiddenLetters, practiceRowWidthPx)
    );
    const forcedBreaksByWi = new Map(activeIndices.map((wi, i) => [wi, activeLayouts[i].forcedBreaks]));
    const pairedActiveIndices = pairPracticeItems(
      activeIndices.map((wi, i) => ({ id: wi, cardClass: activeLayouts[i].cardClass, lines: activeLayouts[i].lines }))
    );
    const activeGapOrder = gapOrderFor(pairedActiveIndices.map((item) => item.id));
    // Та сама умова, що checkButtonEl звичайної вправи (useBlocks-гілка,
    // нижче) — disabled лише поки запит у польоті (activeBlockPending
    // там), БЕЗ вимоги "усі слова заповнені": заповненість лише показує
    // CheckConfirmBar (попередження, не блокер) там, де вона є взагалі —
    // практика її не має (immediate check, той самий принцип, що плаский
    // режим практики). !activeIndices.every(isWordFilled) тут раніше
    // хибно блокував кнопку в ЩОЙНО відкритому блоці без жодної введеної
    // літери (задача "owner report": Перевірити блок недоступна, доки
    // блок не заповнений цілком).
    const sceneCheckButtonEl = (
      <button
        type="button"
        onClick={() => submitPractice(activeIndices, activeBlockIndex)}
        disabled={practiceCheck.pending}
        className={practiceUseBlocks ? "exercise-block-check-btn btn-check" : `self-start ${BUTTON_CHECK}`}
      >
        {practiceCheck.pending ? t("button.checking") : practiceUseBlocks ? t("button.checkBlock") : t("button.check")}
      </button>
    );
    // Панель "Правильні відповіді" (крок 3b) — та сама TaskResult/
    // TaskResultGapRows, що звичайна вправа (renderBlock() вище), лише
    // дані беруть /api/exercises/practice/reveal по елементу (лениво,
    // лише коли студент розгортає панель — onOpenChange, не на монтуванні
    // блоку), не detail (практика його не має). Кеш — practiceCheck.revealed
    // (той самий, що індивідуальна кнопка "Показати відповідь"), тож
    // згортання/розгортання і router.refresh() нічого не перезапитують
    // (ЗНОВУ дзвонить лише для СПРАВДІ ще не розкритих id).
    function revealBlockAnswers(ids: string[]) {
      for (const id of ids) {
        if (!practiceCheck.revealed[id]) practiceCheck.reveal(id, true);
      }
    }
    const activeKeys = activeIndices.map(String);
    const answersLoading = activeKeys.some((key) => practiceCheck.revealPending[key]);
    const allCorrectInBlock = activeKeys.length > 0 && activeKeys.every((key) => practiceResults[key] === true);
    const answersPanel = practiceBlockAttempted[activeBlockIndex] ? (
      <TaskResult
        key={activeBlockIndex}
        correct={allCorrectInBlock}
        toggleTitle={t("panel.correctAnswers")}
        toggleCount={activeIndices.length}
        onOpenChange={(open) => {
          if (open) revealBlockAnswers(activeKeys);
        }}
      >
        {answersLoading ? (
          <p className="text-sm text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
            {t("panel.loadingAnswers")}
          </p>
        ) : (
          <TaskResultGapRows
            rows={buildGapRowsFromReveal(
              activeIndices,
              config.words.map((w) => w.chars),
              Object.fromEntries(activeIndices.map((wi) => [wi, practiceCheck.revealed[String(wi)]?.[0]]))
            )}
            twoColumn
          />
        )}
      </TaskResult>
    ) : null;
    return (
      <div className={EXERCISE_STACK}>
        <BlockTabs
          plaqueText={plaqueText}
          blockCount={practiceBlockCount}
          activeBlock={practiceActiveBlock}
          onChangeBlock={setPracticeActiveBlock}
          isBlockChecked={(i) => !!practiceBlockAttempted[i]}
        />
        <TaskPanelHeader
          blockCount={practiceBlockCount}
          activeBlock={practiceActiveBlock}
          onChangeBlock={setPracticeActiveBlock}
          isBlockChecked={(i) => !!practiceBlockAttempted[i]}
          instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.letter_gaps.instruction}
          subInstructionText={taskTranslationLine({ uk: config.subInstructions, en: config.subInstructionsEn }, lang, {
            uk: DEFAULT_INSTRUCTIONS.letter_gaps.subInstruction,
            en: DEFAULT_TRANSLATION_EN.letter_gaps,
          })}
        />
        {practiceUseBlocks ? (
          <BlockNavigation
            blockCount={practiceBlockCount}
            activeBlock={practiceActiveBlock}
            onChangeBlock={setPracticeActiveBlock}
            checkButton={sceneCheckButtonEl}
          >
            {/* Задача "verdict pill almost touching the cards above it" —
                грід+answersPanel тепер ОДНА спільна обгортка
                (RESULT_ROW_GAP_CLASS, spacing.ts), не два окремих дитини
                BlockNavigation: contentRef там — звичайний div БЕЗ gap
                (щоб не зіпсувати margin-top рядка check/←/→ під ним), тож
                без цієї обгортки грід і answersPanel торкались одне
                одного. */}
            <div className={RESULT_ROW_GAP_CLASS}>
              <div ref={gridRef} className={`grid gap-3 ${TWO_COLUMN_GRID_CLASS}`}>
                {pairedActiveIndices.map((item) =>
                  renderPracticeItem(item.id, item, forcedBreaksByWi.get(item.id) ?? [], activeGapOrder, true)
                )}
              </div>
              {answersPanel}
            </div>
          </BlockNavigation>
        ) : (
          <>
            <div className={RESULT_ROW_GAP_CLASS}>
              <div ref={gridRef} className={`grid gap-3 ${TWO_COLUMN_GRID_CLASS}`}>
                {pairedActiveIndices.map((item) =>
                  renderPracticeItem(item.id, item, forcedBreaksByWi.get(item.id) ?? [], activeGapOrder, true)
                )}
              </div>
              {answersPanel}
            </div>
            <div className="flex flex-col gap-2">{sceneCheckButtonEl}</div>
          </>
        )}

        {diacritics.rect && diacritics.activeKey && (
          <DiacriticsPopup
            rect={diacritics.rect}
            onPick={(ch) => {
              const [wi, gi] = diacritics.activeKey!.split(",").map(Number);
              updateLetter(wi, gi, ch, activeGapOrder);
            }}
          />
        )}

        {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      </div>
    );
  }

  if (isPractice) {
    // Крок 5 — флет-режим (інлайн-картка сцени, error-review-block.tsx
    // БЕЗ openMode): довгий список однорядкових full-width карток
    // замінюється на 2-колонкову сітку (та сама TWO_COLUMN_GRID_CLASS, що
    // сцена-вигляд блоків). pairPracticeItems (flat-practice-layout.ts)
    // явно парує короткі з короткими/довгі з довгими рядками (замість
    // старого "короткі-спочатку/довгі-в-кінці ОДНИМ списком", що лишало
    // непарну коротку в одному рядку з ПЕРШИМ довгим). lines —
    // estimateLetterGapsCardRows, той самий точний естіматор, що
    // активний блок сцена-вигляду вище (НЕ chars.length — задача "pairing
    // still mispairs cards 5/6, 7/8": довжина символів systematично
    // недооцінює/переоцінює реальну кількість рядків для слів з кількома
    // одиницями переносу чи видимими літерами). wi (id) лишається
    // джерелом для submitPractice/перевірки нижче.
    const flatLayouts = practiceWordIndices.map((wi) =>
      letterGapsPracticeLayout(config.words[wi].chars, config.words[wi].hiddenLetters, practiceRowWidthPx)
    );
    const flatForcedBreaksByWi = new Map(practiceWordIndices.map((wi, i) => [wi, flatLayouts[i].forcedBreaks]));
    const flatPracticeLayout = pairPracticeItems(
      practiceWordIndices.map((wi, i) => ({ id: wi, cardClass: flatLayouts[i].cardClass, lines: flatLayouts[i].lines }))
    );
    // gapOrder — ТОЙ САМИЙ принцип, що activeGapOrder (сцена-вигляд блоків,
    // вище): перераховується на ВІДОБРАЖУВАНИЙ порядок слів (flatPracticeLayout
    // замінив practiceWordIndices), інакше Enter/Tab-навігація між
    // пропусками (updateLetter/handleBackspace: "наступний gap у gapOrder")
    // стрибала б за СТАРИМ позиційним порядком, не за тим, що студент бачить
    // на екрані.
    const flatGapOrder = gapOrderFor(flatPracticeLayout.map((item) => item.id));
    return (
      <div className={EXERCISE_STACK}>
        <div ref={gridRef} className={`grid gap-3 ${TWO_COLUMN_GRID_CLASS}`}>
          {flatPracticeLayout.map((item) =>
            renderPracticeItem(item.id, item, flatForcedBreaksByWi.get(item.id) ?? [], flatGapOrder, false)
          )}
        </div>

        {diacritics.rect && diacritics.activeKey && (
          <DiacriticsPopup
            rect={diacritics.rect}
            onPick={(ch) => {
              const [wi, gi] = diacritics.activeKey!.split(",").map(Number);
              updateLetter(wi, gi, ch, flatGapOrder);
            }}
          />
        )}

        {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => submitPractice(practiceWordIndices)}
            // Задача "check button pale/disabled" — та сама умова, що вже
            // виправлена для sceneCheckButtonEl (вище): disabled лише поки
            // запит у польоті, БЕЗ вимоги "усі слова заповнені". Незаповнені
            // слова лишаються "ще неправильними" (gradeLetterGaps трактує
            // порожній answers[wi] як неправильну відповідь, не крашиться) —
            // той самий принцип, що вже підтверджений сцена-виглядом.
            disabled={practiceCheck.pending}
            className={`self-start ${BUTTON_CHECK}`}
          >
            {practiceCheck.pending ? t("button.checking") : t("button.check")}
          </button>
          {practiceCheck.error && <p className="text-sm text-red-600 dark:text-red-400">{practiceCheck.error}</p>}
        </div>
      </div>
    );
  }

  // Єдина пілюля балів (задача "єдина пілюля балів усюди"): до перевірки —
  // завжди загальний бал вправи (per-блоковий поділ для Group A типів —
  // letter_gaps/letter_rearrangement/word_search/crossword — відомий лише
  // серверу, не клієнту); після перевірки АКТИВНОГО блоку/вправи — earned
  // sur possible ЦЬОГО блоку (ті самі дані, що вже показує TaskResult під
  // блоком) + статус-чіп.
  const activeBlockOrSingleResult = useBlocks ? blockResults[activeBlock] : single.result;
  const headerPoints = hidePoints
    ? undefined
    : headerPointsState(
        activeBlockOrSingleResult?.pointsPossible ?? config.points,
        activeBlockOrSingleResult?.pointsEarned,
        lang
      );
  // Задача "Hint legend: keep the hint bubble always visible above the
  // task" — гасіння після перевірки (allBlocksChecked/single.result)
  // прибрано, той самий принцип, що letter-rearrangement.tsx/
  // table-fill.tsx: воно давало порожню invisible-дірку в
  // TaskPanelHeader на мобільному. isDelf лишається — сталий на весь
  // mount.
  // Задача "Constructor: editable hint-legend field for the remaining
  // hint exercises" — вчителька може перевизначити цей текст на мову
  // (config.hintLegend); порожнє/відсутнє значення — дефолт.
  const hintText = isDelf ? null : config.hintLegend?.[lang]?.trim() || hintExplanationText("letter_gaps", lang);

  // ЕТАП M — кнопка "Перевірити блок" для спільного рядка check+←/→
  // (BlockNavFooter) — ті самі значення, що читає renderBlock() вище
  // (blockResults[activeBlock]/blockPending[activeBlock]/submitBlock),
  // обчислені тут, бо BlockNavigation.checkButton рендериться поза
  // деревом, яке повертає renderBlock().
  const activeBlockResult = blockResults[activeBlock];
  const activeBlockPending = !!blockPending[activeBlock];
  const activeBlockWordIndicesForCheck = wordBlocks[activeBlock] ?? [];
  const activeBlockUnanswered = activeBlockWordIndicesForCheck.filter((wi) => wordIsUnfilled(wi)).length;
  const checkButtonEl = useBlocks && !activeBlockResult ? (
    <button
      type="button"
      onClick={() => blockCheckConfirm.attemptCheck(activeBlockUnanswered, () => submitBlock(activeBlock))}
      disabled={activeBlockPending}
      className="exercise-block-check-btn btn-check"
    >
      {activeBlockPending ? t("button.checking") : t("button.checkBlock")}
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
        pointsText={headerPoints?.pointsText}
      />
      <TaskPanelHeader
        blockCount={blockCount}
        activeBlock={activeBlock}
        onChangeBlock={setActiveBlock}
        isBlockChecked={(i) => i in blockResults}
        {...(headerPoints ?? {})}
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.letter_gaps.instruction}
        subInstructionText={taskTranslationLine({ uk: config.subInstructions, en: config.subInstructionsEn }, lang, {
          uk: DEFAULT_INSTRUCTIONS.letter_gaps.subInstruction,
          en: DEFAULT_TRANSLATION_EN.letter_gaps,
        })}
        hintText={hintText}
      />

      {!useBlocks ? (
        <>
          <div ref={gridRef} className={`grid gap-3 ${TWO_COLUMN_GRID_CLASS}`}>
            {displayOrder.map((wi, pos) =>
              renderWordCard(wi, {
                detail: singleDetail,
                locked: !!single.result,
                gapOrder: singleGapOrder,
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
                  disabled={single.pending}
                  className={`self-start ${BUTTON_CHECK}`}
                >
                  {single.pending ? t("button.checking") : t("button.check")}
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
                toggleTitle={t("panel.correctAnswers")}
                toggleCount={singleDetail ? displayOrder.length : undefined}
                hintSummary={{
                  hintCount: singleDetail?.words.filter((w) => w.hintUsed).length ?? 0,
                  reducesPoints: config.hintsReducePoints,
                }}
              >
                {singleDetail && (
                  <TaskResultGapRows rows={buildLetterGapsRows(displayOrder, config.words, singleDetail)} twoColumn />
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
