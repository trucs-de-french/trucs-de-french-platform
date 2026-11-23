"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { hintExplanationText } from "./hint-explanation";
import { TaskPanelHeader } from "./task-panel-header";
import { HintBulb, HintUsedBadge } from "./hint-bulb";
import type {
  LetterRearrangementPublic,
  LetterRearrangementDetail,
  LetterRearrangementAnswer,
  GradeResult,
} from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS, DEFAULT_TRANSLATION_EN, taskTranslationLine } from "@/lib/exercises/default-instructions";
import { useT } from "@/lib/i18n/context";
import { frenchNbsp } from "@/lib/text/french-typography";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { SortableTileRow } from "./sortable-tile-row";
import { CompactAudioButton } from "./compact-audio-button";
import { ImageLightbox } from "./image-lightbox";
import { BUTTON_CHECK, BUTTON_REVEAL_ANSWER } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { WORD_CARD } from "@/lib/exercises/word-list-layout";
import { TaskResult } from "./task-result";
import { headerPointsState } from "@/lib/exercises/header-points";
import { EXERCISE_BLOCK_SIZE, chunk } from "@/lib/exercises/exercise-blocks";
import { BlockNavigation, BlockTabs } from "./block-navigation";
import { useCheckConfirm, CheckConfirmBar } from "./check-confirm";
import { usePracticeCheck } from "./use-practice-check";
import { useWorkingTileLayout, TWO_COLUMN_GRID_CLASS } from "./use-working-tile-layout";
import { estimateLetterRearrangementCardRows, orderByEstimatedRows } from "@/lib/exercises/estimate-card-rows";
import { buildRevealedWordDetail, type RevealedWordDetail } from "@/lib/exercises/format-reveal-answer";
import { layoutFlatPracticeItems } from "@/lib/exercises/flat-practice-layout";

type LetterRearrangementResult = Extract<GradeResult, { detail: LetterRearrangementDetail }>;

// Режим практики "Робота над помилками" (пілот, частина 4) — той самий
// принцип, що LetterGapsPracticeProps (letter-gaps.tsx): лише помилкові ще
// не виправлені слова, onlyItemIds — String(wordIndex) (letter_rearrangement
// теж позиційний, слова не мають id).
export type LetterRearrangementPracticeProps = {
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

export function LetterRearrangementExercise({
  taskId,
  config,
  plaqueText,
  onResult,
  hidePoints,
  isDelf,
  practice,
}: {
  taskId: string;
  config: LetterRearrangementPublic;
  plaqueText?: string;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  // Задача належить DELF-тесту — лампочки-підказки не рендеряться взагалі
  // (сервер /api/exercises/letter-rearrangement-hint однаково відхилив би
  // запит, якби хтось обійшов UI).
  isDelf?: boolean;
  practice?: LetterRearrangementPracticeProps;
}) {
  // Усі стани — СПІЛЬНІ на всю вправу (не по блоку), як pairs у
  // matching.tsx.
  const { t, lang } = useT();
  const [orders, setOrders] = useState<string[][]>(() => config.words.map((w) => w.shuffledLetters));
  // Задача "Lettres en désordre / Mise en ordre: fix the unanswered-items
  // confirmation not appearing" — КОРІНЬ ПРОБЛЕМИ: isWordUntouched нижче
  // раніше звіряв orders[wi] (застиглий у useState-ініціалізаторі, читається
  // РІВНО ОДИН раз при монтуванні) з config.words[wi].shuffledLetters,
  // прочитаним НАЖИВО з пропу config на кожен викlik. Пропс config не
  // гарантовано стабільний на весь час життя компонента: submitBlock нижче
  // викликає router.refresh() після кожної перевірки блоку — Next.js
  // перевиконує серверний компонент сторінки, sanitizeConfigForStudent
  // (sanitize.ts) генерує НОВИЙ shuffle() для ВСІХ слів вправи (не лише
  // перевіреного блоку), і ця сторінка може містити кілька задач — router.
  // refresh() БУДЬ-ЯКОЇ сусідньої задачі на тій самій сторінці теж змінює
  // config ЦІЄЇ вправи. orders (студентський стан) переживає такий
  // ре-рендер незмінним, а жива shuffledLetters — ні: усі СПРАВДІ недоторкані
  // слова починають порівнюватись проти НОВОГО випадкового shuffle і
  // помилково визначатись як "торкнуті" (щойно config.words[wi].
  // shuffledLetters більше не дорівнює orders[wi]) — unansweredCount падає
  // до 0, і бар підтвердження просто не з'являється. Фікс: заморожуємо
  // ПОЧАТКОВИЙ shuffle в тому самому lazy useState (той самий життєвий
  // цикл, що orders — ОДИН раз при монтуванні, ІГНОРУЄ подальші зміни
  // config), і звіряємо orders лише проти ЦЬОГО замороженого знімка.
  const [initialShuffle] = useState<string[][]>(() => config.words.map((w) => w.shuffledLetters));
  const [lockedCounts, setLockedCounts] = useState<number[]>(() => config.words.map(() => 0));
  const [hintedWordIndices, setHintedWordIndices] = useState<Set<number>>(new Set());
  const [hintLoading, setHintLoading] = useState<Set<number>>(new Set());
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // ≤EXERCISE_BLOCK_SIZE слів (≤10) — той самий принцип, що
  // letter-gaps.tsx: одна гілка, окрема від блоків, вигляд/поведінка
  // наявних коротких вправ не залежать від логіки блоків узагалі.
  const wordBlocks = useMemo(
    () => chunk(config.words.map((_, wi) => wi), EXERCISE_BLOCK_SIZE),
    [config.words]
  );
  const blockCount = wordBlocks.length;
  const useBlocks = blockCount > 1;

  function updateOrder(wordIndex: number, next: string[]) {
    setOrders((prev) => prev.map((o, wi) => (wi === wordIndex ? next : o)));
  }

  // "незаповнене" тут означає "студент ще не торкався порядку": orders[wi]
  // і досі буквально той самий, що ЗАМОРОЖЕНИЙ початковий shuffle
  // (initialShuffle вище, не живий config.words[wi].shuffledLetters — див.
  // коментар над initialShuffle). Один torkh, що випадково повернув той
  // самий порядок, теоретично лишився б "untouched" — прийнятний
  // компроміс, той самий принцип, що задача явно задає.
  function isWordUntouched(wi: number): boolean {
    // Слово, де ЖОДНА перестановка візуально відрізняється від початкової
    // (одна літера, чи всі літери однакові — "AAAA") — студент фізично не
    // може зробити його "торкнутим" жодним драгом/кліком, тож не рахуємо
    // його в unansweredCount взагалі (ані недоторканим, ані торкнутим):
    // інакше воно або вічно накручувало б лічильник, або студент не мав би
    // способу "закрити" попередження про нього.
    if (!isWordChangeable(wi)) return false;
    const baseline = initialShuffle[wi];
    const current = orders[wi];
    return current.length === baseline.length && current.every((v, i) => v === baseline[i]);
  }

  function isWordChangeable(wi: number): boolean {
    const letters = initialShuffle[wi];
    return letters.length > 1 && letters.some((l) => l !== letters[0]);
  }

  async function applyHint(wi: number) {
    const position = lockedCounts[wi];
    if (position >= orders[wi].length || hintLoading.has(wi)) return;
    setHintLoading((prev) => new Set(prev).add(wi));
    try {
      const res = await fetch("/api/exercises/letter-rearrangement-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, wordIndex: wi, position }),
      });
      if (!res.ok) return;
      const { letter } = (await res.json()) as { letter: string };
      const idx = orders[wi].findIndex((v, i) => i >= position && v === letter);
      if (idx === -1) return;
      setOrders((prev) =>
        prev.map((o, i) => {
          if (i !== wi) return o;
          const next = [...o];
          next.splice(idx, 1);
          next.splice(position, 0, letter);
          return next;
        })
      );
      setLockedCounts((prev) => prev.map((c, i) => (i === wi ? position + 1 : c)));
      setHintedWordIndices((prev) => new Set(prev).add(wi));
    } finally {
      setHintLoading((prev) => {
        const next = new Set(prev);
        next.delete(wi);
        return next;
      });
    }
  }

  // gridRef — той самий принцип, що letter-gaps.tsx; колонки визначає
  // ШИРИНА контейнера (TWO_COLUMN_BREAKPOINT_PX), не кількість слів. Картка
  // НІКОЛИ не займає повний рядок — жодного span тут letter_rearrangement і
  // не потребував (плитки самі переносяться flex-wrap'ом,
  // sortable-tile-row.tsx). Без резерву лампочки: плитки йдуть НИЖЧЕ
  // заголовка картки, лампочка (верхній правий кут) туди не сягає — резерв
  // лишається лише на самому заголовку (pr-[52px] нижче).
  const { gridRef } = useWorkingTileLayout();

  // Показовий порядок карток — за ОЦІНЕНОЮ кількістю рядків плиток
  // (estimateLetterRearrangementCardRows), той самий принцип, що
  // letter-gaps.tsx: чиста функція від довжини слова, без DOM-вимірювання —
  // картки з однаковою оціненою кількістю рядків стають сусідами в рядку
  // 2-колонкового grid. Порядок слів студенту не принциповий; номер картки
  // (cardNumber нижче) — позиція у ЦЬОМУ порядку, відповіді/помилки лишаються
  // прив'язані до оригінального wi всюди нижче.
  const displayOrder = useMemo(
    () => orderByEstimatedRows(config.words.map((w) => estimateLetterRearrangementCardRows(w.shuffledLetters.length))),
    [config.words]
  );

  const router = useRouter();

  // ==== Гілка ≤10 слів (незмінна поведінка) ====
  const single = useExerciseCheck(taskId);
  const singleDetail = single.result?.detail as LetterRearrangementDetail | undefined;
  const singleCheckConfirm = useCheckConfirm();
  const singleUnanswered = useMemo(
    () => config.words.filter((_, wi) => isWordUntouched(wi)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, config.words]
  );
  function submitSingle() {
    const answer: LetterRearrangementAnswer = {
      words: orders,
      hintedWordIndices: [...hintedWordIndices],
    };
    single.submit(answer);
  }

  useEffect(() => {
    if (!useBlocks && single.result) onResult?.(single.result);
  }, [useBlocks, single.result, onResult]);

  // ==== Гілка практики (onlyItemIds) — незалежна від useBlocks/single
  // вище: завжди плаский однoколонковий список (вихідний порядок слів, без
  // estimateCardRows-мішання) і без BlockNavigation — той самий принцип,
  // що letter-gaps.tsx. practiceWordIndices будується НАПРЯМУ
  // з config.words (не через displayOrder якогось хука), тож застарілий
  // локальний індекс тут структурно неможливий — фільтр "li < довжина" з
  // фіксу 0e3ad04 не застосовний (нема стану, що міг би лишитись
  // "застарілим" між рендерами); renderWordCard все одно лишає захисний
  // `if (!word) return null` на випадок відсутнього слова.
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
    setPracticeResults({});
  }

  // Сцена-вигляд (крок 4) — блоки по EXERCISE_BLOCK_SIZE слів, той самий
  // chunk(), що звичайна вправа (wordBlocks вище), лише на
  // practiceWordIndices (знімок помилок, не всю вправу). blockCount<=1 —
  // БЕЗ вкладок/футера нижче (той самий built-in захист, що BlockTabs/
  // BlockNavigation уже мають для звичайної вправи), плашка+заголовок
  // лишаються завжди.
  const isSceneMode = !!practice?.scene;
  const practiceBlocks = isSceneMode ? chunk(practiceWordIndices, EXERCISE_BLOCK_SIZE) : [];
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
    const words: (string[] | null)[] = config.words.map((_, wi) => (practiceSet.has(wi) ? orders[wi] : null));
    const answer: Omit<LetterRearrangementAnswer, "words"> & { words: (string[] | null)[] } = {
      words,
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
    // Автоматичне розкриття після 2 невдалих спроб — лише флет-режим
    // (інлайн-картка сцени, старий продуктовий принцип, use-practice-
    // check.ts fromButton=false коментар). Сцена-вигляд (крок 3c) має
    // власний контракт: відповідь показується ЛИШЕ по натисканню пілюлі
    // "Відповідь" — автовиклик тут раніше й розкривав картку сам, без
    // натискання, щойно result.failedAttempts (із сервера, через
    // router.refresh() чи напряму з відповіді) сягав 2.
    if (!isSceneMode) {
      for (const r of result.results) {
        if (!r.correct && (result.failedAttempts[r.itemId] ?? 0) >= 2 && !practiceCheck.revealed[r.itemId]) {
          practiceCheck.reveal(r.itemId, false);
        }
      }
    }
  }

  // ==== Гілка блоків (>10 слів) ====
  const [activeBlock, setActiveBlock] = useState(0);
  const [blockResults, setBlockResults] = useState<Record<number, LetterRearrangementResult>>({});
  const [blockPending, setBlockPending] = useState<Record<number, boolean>>({});
  const [blockError, setBlockError] = useState<Record<number, string | null>>({});

  // Той самий принцип, що displayOrder вище — ОКРЕМЕ обчислення, СКОУПЛЕНЕ
  // на слова АКТИВНОГО блоку (не на всю вправу), той самий принцип, що
  // letter-gaps.tsx.
  const activeBlockWordIndices = useMemo(
    () => (useBlocks ? (wordBlocks[activeBlock] ?? []) : []),
    [useBlocks, wordBlocks, activeBlock]
  );
  const blockCheckConfirm = useCheckConfirm();
  const activeBlockUnanswered = useMemo(
    () => activeBlockWordIndices.filter((wi) => isWordUntouched(wi)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeBlockWordIndices, orders]
  );
  const blockDisplayOrder = useMemo(() => {
    const rows = activeBlockWordIndices.map((wi) =>
      estimateLetterRearrangementCardRows(config.words[wi].shuffledLetters.length)
    );
    return orderByEstimatedRows(rows).map((li) => activeBlockWordIndices[li]);
  }, [activeBlockWordIndices, config.words]);

  const allBlocksChecked = useBlocks && blockCount > 0 && Object.keys(blockResults).length === blockCount;

  // Той самий принцип, що letter-gaps.tsx: totalCorrect — за КОЖЕН
  // глобальний індекс слова з ЙОГО ВЛАСНОГО блочного результату, не з
  // чужого detail (де це слово поза скоупом і тому завжди isCorrect=false).
  const aggregateResult: LetterRearrangementResult | null = useMemo(() => {
    if (!allBlocksChecked) return null;
    const results = Object.values(blockResults);
    const totalWords = config.words.length;
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

  // Пряме fetch, не useExerciseCheck — N незалежних станів (по блоку). words
  // — розрідженим масивом на всю вправу: реальний порядок лише на позиціях
  // слів ЦЬОГО блоку, null на решті (JSON перетворює "дірки" на null) —
  // так gradeLetterRearrangement (grade.ts) визначає скоуп, тип
  // LetterRearrangementAnswer лишається незмінним.
  async function submitBlock(blockIndex: number) {
    const blockWordIndices = wordBlocks[blockIndex];
    const blockSet = new Set(blockWordIndices);
    const words: (string[] | null)[] = config.words.map((_, wi) => (blockSet.has(wi) ? orders[wi] : null));
    const answer: Omit<LetterRearrangementAnswer, "words"> & { words: (string[] | null)[] } = {
      words,
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
      const result = (await res.json()) as LetterRearrangementResult;
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

  // Рендер однієї картки-слова — спільний для обох гілок (той самий
  // принцип, що letter-gaps.tsx).
  function renderWordCard(
    wi: number,
    opts: {
      detail: LetterRearrangementDetail | undefined;
      locked: boolean;
      // Порядковий номер картки у ВІЗУАЛЬНОМУ порядку (displayOrder/
      // blockDisplayOrder/practiceWordIndices, 1-based) — рахується з
      // нуля в кожному блоці/сторінці окремо, не глобальний wi.
      cardNumber: number;
      // Практика (пілот, частина 4) — лампочка "поставити наступну літеру"
      // вимкнена, той самий принцип, що letter-gaps.tsx hintDisabled.
      hintDisabled?: boolean;
      // Сцена-вигляд практики (крок 3c) — синтетичний per-word detail,
      // побудований з practice/reveal (buildRevealedWordDetail), не з
      // gradeAnswer: дає ТОЧНО той самий вигляд підсвічування
      // плиток+рядка "Правильне слово", що й детейл реальної вправи,
      // без дублювання розмітки нижче. undefined для всіх інших
      // викликачів (флет-практика, реальна вправа) — behavior НЕЗМІННА.
      revealedWordDetail?: RevealedWordDetail;
      // Сцена-вигляд практики (крок 3c) — футер "спроби" (крапки+пілюля
      // "Відповідь"), рендериться ОДИН раз тут, під плитками, усередині
      // картки. undefined (флет-практика/реальна вправа) — нічого не
      // рендериться.
      practiceFooter?: ReactNode;
    }
  ) {
    const word = config.words[wi];
    // Захист від застарілого displayOrder (прохід рендеру, що буде
    // відкинутий — див. коментар над blockDisplayOrder вище): пропускаємо
    // замість кидати, а не покладаємось лише на фільтр на вході.
    if (!word) return null;
    const wordDetail = opts.detail?.words[wi] ?? opts.revealedWordDetail;

    function tileState(i: number): "correct" | "incorrect" | undefined {
      if (!wordDetail) return undefined;
      return wordDetail.letters[i]?.isCorrect ? "correct" : "incorrect";
    }

    const hintUsed = opts.detail?.words[wi]?.hintUsed;
    // Лампочка (28px, абсолютна right-1.5/top-1.5 відносно картки з
    // px-4) виступає ще на ~30px углиб першого рядка — без резерву текст
    // підказки міг ховатись під нею. pr-[52px] (ширина кнопки-лампочки
    // 40px + 12px) лише на заголовку нижче — рядок плиток ідe НИЖЧЕ
    // заголовка, лампочка туди не сягає, резерв там не потрібен.
    const hasLamp = !opts.locked && !isDelf && !opts.hintDisabled;

    return (
      // Картка НІКОЛИ не займає повний рядок — завжди half-width у
      // 2-колонковому режимі, full-width в 1-колонковому.
      <div key={wi} className={`relative ${WORD_CARD}`}>
        {hasLamp && (
          <HintBulb
            state={hintUsed ? "used" : "available"}
            label={t("letterrearr.hintPlaceNextLetter")}
            disabled={lockedCounts[wi] >= orders[wi].length || hintLoading.has(wi)}
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
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p
              className={`word-card-number-row break-words text-sm text-[var(--uk-clue-text-light)] dark:text-[var(--card-ink-2)] [overflow-wrap:anywhere] ${hasLamp ? "pr-[52px]" : ""}`}
            >
              <span className="item-number-badge" aria-label={t("aria.word", { n: opts.cardNumber })}>
                {opts.cardNumber}
              </span>
              {word.hintText.trim() && <span>{frenchNbsp(word.hintText)}</span>}
            </p>
            <SortableTileRow
              items={orders[wi]}
              onChange={(next) => updateOrder(wi, next)}
              locked={opts.locked}
              tileState={tileState}
              letterTile
              gapClassName="letter-tile-row-gap"
              lockedCount={opts.locked ? 0 : lockedCounts[wi]}
            />
          </div>
        </div>
        {opts.practiceFooter}
        {wordDetail && !wordDetail.isCorrect && (
          <p className="text-sm dark:text-[var(--text-muted-caption)]">
            <span className="correct-answer-label">{t("answer.correctWordLabel")} </span>
            <span className="correct-answer-word text-[#3b36c4]">
              {wordDetail.letters.map((l) => l.text).join("")}
            </span>
          </p>
        )}
      </div>
    );
  }

  function renderBlock() {
    const blockResult = blockResults[activeBlock];
    const blockDetail = blockResult?.detail;
    const errMsg = blockError[activeBlock];

    return (
      <div className="flex flex-col gap-3">
        <div ref={gridRef} className={`grid gap-3 ${TWO_COLUMN_GRID_CLASS}`}>
          {blockDisplayOrder.map((wi, pos) =>
            renderWordCard(wi, {
              detail: blockDetail,
              locked: !!blockResult,
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
              hintSummary={{
                hintCount: blockDetail?.words.filter((w) => w.hintUsed).length ?? 0,
                reducesPoints: config.hintsReducePoints,
              }}
            />
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

  // Одна картка практики — спільне для плаского режиму (інлайн-картка
  // сцени: старий рядок статусу під карткою, крок 5 — тепер 2-колонкова
  // сітка з довгими словами в кінці списку, flatLayout нижче, БЕЗ
  // col-span: довге слово просто переносить свої плитки на другий рядок
  // усередині звичайної половинної картки, той самий принцип, що
  // сцена-вигляд блоків) і сцена-вигляду блоків (крок 3c: "варіант 3 —
  // крапки спроб", усередині картки). Два зовсім різні рендери під
  // sceneStyle.
  function renderPracticeItem(
    wi: number,
    pos: number,
    sceneStyle = false,
    // Крок 5 (флет-режим, "довгі слова в кінці списку") — displayNumber з
    // layoutFlatPracticeItems замінює pos+1; undefined для sceneStyle (там
    // нумерація лишається позиційною, не перепорядкованою).
    flatLayout?: { displayNumber: number }
  ) {
    const key = String(wi);
    const isCorrect = practiceResults[key];
    const attempts = practiceFailedAttempts[key] ?? 0;
    const itemRevealed = practiceCheck.revealed[key];

    if (sceneStyle) {
      // Розкрите слово — підсвічування плиток+рядок "Правильне слово"
      // через ТОЙ САМИЙ renderWordCard, що реальна вправа (opts.
      // revealedWordDetail), а не окремий текст. Поки не розкрите (і не
      // виправлене) — футер "спроби" (крапки+пілюля), лише коли вже є
      // бодай одна невдала спроба; коректний елемент — узагалі без
      // футера й без тексту (зелені/кольорові плитки й так це показують).
      const revealedWordDetail = itemRevealed ? buildRevealedWordDetail(itemRevealed[0], orders[wi]) : undefined;
      const showFooter = isCorrect === false && !itemRevealed;
      const footer = showFooter ? (
        <div className="practice-attempt-footer">
          <span className="practice-attempt-dots" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`practice-attempt-dot ${i < Math.min(attempts, 3) ? "practice-attempt-dot--filled" : ""}`}
              />
            ))}
          </span>
          <span className="practice-attempt-label">{t("status.failedAttemptShort", { n: attempts })}</span>
          <button
            type="button"
            onClick={() => practiceCheck.reveal(key, true)}
            disabled={!!practiceCheck.revealPending[key]}
            aria-label={t("button.showAnswer")}
            className="practice-reveal-pill"
          >
            <Eye size={14} aria-hidden="true" />
            {t("button.answerShort")}
          </button>
        </div>
      ) : undefined;
      return renderWordCard(wi, {
        detail: undefined,
        locked: false,
        hintDisabled: true,
        cardNumber: pos + 1,
        revealedWordDetail,
        practiceFooter: footer,
      });
    }

    return (
      <div key={wi} className="flex flex-col gap-1.5">
        {renderWordCard(wi, {
          detail: undefined,
          locked: false,
          hintDisabled: true,
          cardNumber: flatLayout ? flatLayout.displayNumber : pos + 1,
        })}
        {isCorrect === true && (
          <p className="pl-1 text-xs font-medium text-green-600 dark:text-green-400">{t("status.correct")}</p>
        )}
        {isCorrect === false && (
          <div className="flex flex-wrap items-center gap-2 pl-1 text-xs">
            <span className="text-red-600 dark:text-red-400">
              {t("status.incorrectRetryCount", { n: attempts })}
            </span>
            {!itemRevealed && (
              <button
                type="button"
                onClick={() => practiceCheck.reveal(key, true)}
                disabled={!!practiceCheck.revealPending[key]}
                aria-label={t("button.showAnswer")}
                title={t("button.showAnswer")}
                className={BUTTON_REVEAL_ANSWER}
              >
                <Eye size={14} aria-hidden="true" />
                {t("button.answerShort")}
              </button>
            )}
          </div>
        )}
        {itemRevealed && (
          <p className="pl-1 text-xs italic text-amber-700 dark:text-amber-400">
            <span className="exercise-answer-label">{t("answer.correctWordLabel")}</span> {itemRevealed.join(", ")}
          </p>
        )}
      </div>
    );
  }

  if (isPractice && isSceneMode) {
    const activeIndices = practiceUseBlocks ? (practiceBlocks[practiceActiveBlock] ?? []) : practiceWordIndices;
    const activeBlockIndex = practiceUseBlocks ? practiceActiveBlock : 0;
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
          instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.letter_rearrangement.instruction}
          subInstructionText={taskTranslationLine({ uk: config.subInstructions, en: config.subInstructionsEn }, lang, {
            uk: DEFAULT_INSTRUCTIONS.letter_rearrangement.subInstruction,
            en: DEFAULT_TRANSLATION_EN.letter_rearrangement,
          })}
        />
        <p className="tap-swap-hint text-sm text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
          {t("letterrearr.swapHint")}
        </p>
        <p className="tap-swap-hint-desktop text-sm text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
          {t("letterrearr.swapHintDesktop")}
        </p>
        {practiceUseBlocks ? (
          <BlockNavigation
            blockCount={practiceBlockCount}
            activeBlock={practiceActiveBlock}
            onChangeBlock={setPracticeActiveBlock}
            checkButton={sceneCheckButtonEl}
          >
            <div ref={gridRef} className={`grid gap-3 ${TWO_COLUMN_GRID_CLASS}`}>
              {activeIndices.map((wi, pos) => renderPracticeItem(wi, pos, true))}
            </div>
          </BlockNavigation>
        ) : (
          <>
            <div ref={gridRef} className={`grid gap-3 ${TWO_COLUMN_GRID_CLASS}`}>
              {activeIndices.map((wi, pos) => renderPracticeItem(wi, pos, true))}
            </div>
            <div className="flex flex-col gap-2">{sceneCheckButtonEl}</div>
          </>
        )}
        {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      </div>
    );
  }

  if (isPractice) {
    // Крок 5 — флет-режим (інлайн-картка сцени, error-review-block.tsx
    // БЕЗ openMode): довгий список однорядкових full-width карток
    // замінюється на 2-колонкову сітку (та сама TWO_COLUMN_GRID_CLASS, що
    // сцена-вигляд блоків), з довгими словами в кінці списку — БЕЗ
    // col-span, довге слово просто переносить плитки на другий рядок
    // усередині своєї звичайної половинної картки (той самий принцип, що
    // сцена-вигляд блоків), тож непарна кількість коротких одразу
    // продовжується першим довгим у тому самому рядку сітки, без порожньої
    // клітинки. layoutFlatPracticeItems (flat-practice-layout.ts) рахує
    // короткі-спочатку/довгі-в-кінці порядок і наскрізну нумерацію;
    // wi (id) лишається джерелом для submitPractice/перевірки нижче,
    // лише порядок рендеру й видимі номери міняються.
    const flatPracticeLayout = layoutFlatPracticeItems(
      practiceWordIndices.map((wi) => ({ id: wi, length: config.words[wi].shuffledLetters.length }))
    );
    return (
      <div className={EXERCISE_STACK}>
        {/* Задача "Lettres en désordre: add swap hint (uk/fr/en)" — той
            самий .tap-swap-hint/reorder.tapToSwap підказка, що reorder.tsx
            показує у своїй практиці (там — під !practiceCorrect, єдиним
            прапорцем на всю практику). letter_rearrangement.tsx практика
            не має такого єдиного "вся практика вирішена" прапорця (кожне
            слово перевіряється й показує свій результат окремо,
            practiceResults — за ключем), тож тут підказка лишається
            видимою завжди в практиці — той самий принцип "reorder показує
            підказку в практиці", адаптований до відсутності єдиного
            лок-стану. */}
        <p className="tap-swap-hint text-sm text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
          {t("letterrearr.swapHint")}
        </p>
        <p className="tap-swap-hint-desktop text-sm text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
          {t("letterrearr.swapHintDesktop")}
        </p>
        <div ref={gridRef} className={`grid gap-3 ${TWO_COLUMN_GRID_CLASS}`}>
          {flatPracticeLayout.map((item) => renderPracticeItem(item.id, item.displayNumber - 1, false, item))}
        </div>

        {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => submitPractice(practiceWordIndices)}
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
  // загальний бал вправи; після перевірки активного блоку/вправи — earned
  // sur possible ЦЬОГО блоку (ті самі дані, що показує TaskResult під
  // блоком) + статус-чіп.
  const activeBlockOrSingleResult = useBlocks ? blockResults[activeBlock] : single.result;
  const headerPoints = hidePoints
    ? undefined
    : headerPointsState(
        activeBlockOrSingleResult?.pointsPossible ?? config.points,
        activeBlockOrSingleResult?.pointsEarned,
        lang
      );
  // ЕТАП M — кнопка "Перевірити блок" для спільного рядка check+←/→
  // (BlockNavFooter) — ті самі значення, що читає renderBlock() вище.
  const activeBlockResult = blockResults[activeBlock];
  const activeBlockPending = !!blockPending[activeBlock];
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
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.letter_rearrangement.instruction}
        subInstructionText={taskTranslationLine({ uk: config.subInstructions, en: config.subInstructionsEn }, lang, {
          uk: DEFAULT_INSTRUCTIONS.letter_rearrangement.subInstruction,
          en: DEFAULT_TRANSLATION_EN.letter_rearrangement,
        })}
        // Задача "Hint legend: keep the hint bubble always visible above
        // the task" — лише isDelf лишається причиною не показувати
        // бульбашку взагалі; раніше тут ще гасило й після перевірки
        // (allBlocksChecked/single.result), що TaskPanelHeader
        // (task-panel-header.tsx) перетворював на зарезервоване invisible-
        // місце того самого розміру — на мобільному, де текст переносився
        // на 2 рядки, це давало порожню білу "дірку" саме тієї висоти.
        hintText={
          isDelf
            ? null
            : config.hintLegend?.[lang]?.trim() || hintExplanationText("letter_rearrangement", lang)
        }
      />

      {!useBlocks ? (
        <>
          {/* Той самий .tap-swap-hint/reorder.tapToSwap принцип, що
              reorder.tsx (!singleLocked там, !single.result тут — той
              самий сенс "ще не перевірено"), лише свій i18n-ключ/текст
              ("літери" замість "слова"). */}
          {!single.result && (
            <p className="tap-swap-hint text-sm text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
              {t("letterrearr.swapHint")}
            </p>
          )}
          {!single.result && (
            <p className="tap-swap-hint-desktop text-sm text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
              {t("letterrearr.swapHintDesktop")}
            </p>
          )}
          <div ref={gridRef} className={`grid gap-3 ${TWO_COLUMN_GRID_CLASS}`}>
            {displayOrder.map((wi, pos) =>
              renderWordCard(wi, {
                detail: singleDetail,
                locked: !!single.result,
                cardNumber: pos + 1,
              })
            )}
          </div>

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
                hintSummary={{
                  hintCount: singleDetail?.words.filter((w) => w.hintUsed).length ?? 0,
                  reducesPoints: config.hintsReducePoints,
                }}
              />
            )}
            {single.error && <p className="text-sm text-red-600 dark:text-red-400">{single.error}</p>}
          </div>
        </>
      ) : (
        <>
          {/* Той самий принцип, що reorder.tsx (!blockResults[activeBlock]
              там, activeBlockResult тут — той самий стан, уже рахується
              вище для checkButtonEl). */}
          {!activeBlockResult && (
            <p className="tap-swap-hint text-sm text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
              {t("letterrearr.swapHint")}
            </p>
          )}
          {!activeBlockResult && (
            <p className="tap-swap-hint-desktop text-sm text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
              {t("letterrearr.swapHintDesktop")}
            </p>
          )}
          <BlockNavigation
            blockCount={blockCount}
            activeBlock={activeBlock}
            onChangeBlock={setActiveBlock}
            blockResults={blockResults}
            checkButton={checkButtonEl}
          >
          {renderBlock()}
          {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
          </BlockNavigation>
        </>
      )}
    </div>
  );
}
