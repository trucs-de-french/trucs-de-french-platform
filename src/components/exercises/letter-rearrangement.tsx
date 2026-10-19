"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { hintExplanationText } from "./hint-explanation";
import { TaskPanelHeader } from "./task-panel-header";
import { HintBulb } from "./hint-bulb";
import type {
  LetterRearrangementPublic,
  LetterRearrangementDetail,
  LetterRearrangementAnswer,
  GradeResult,
} from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { frenchNbsp } from "@/lib/text/french-typography";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { SortableTileRow } from "./sortable-tile-row";
import { CompactAudioButton } from "./compact-audio-button";
import { ImageLightbox } from "./image-lightbox";
import { useTwoColumnWordOrder } from "./use-two-column-word-order";
import { STUDENT_BUTTON_PRIMARY, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import {
  TWO_COLUMN_WORD_THRESHOLD,
  LONG_WORD_COMPACT_THRESHOLD,
  SINGLE_WORD_SPAN_THRESHOLD,
  PHRASE_SPAN_THRESHOLD,
  WORD_CARD,
} from "@/lib/exercises/word-list-layout";
import { TaskResult } from "./task-result";
import { EXERCISE_BLOCK_SIZE, chunk } from "@/lib/exercises/exercise-blocks";
import { BlockNavigation, BlockTabs } from "./block-navigation";
import { usePracticeCheck } from "./use-practice-check";

type LetterRearrangementResult = Extract<GradeResult, { detail: LetterRearrangementDetail }>;

// Режим практики "Робота над помилками" (пілот, частина 4) — той самий
// принцип, що LetterGapsPracticeProps (letter-gaps.tsx): лише помилкові ще
// не виправлені слова, onlyItemIds — String(wordIndex) (letter_rearrangement
// теж позиційний, слова не мають id).
export type LetterRearrangementPracticeProps = {
  onlyItemIds: string[];
  failedAttempts: Record<string, number>;
};

export function LetterRearrangementExercise({
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
  const [orders, setOrders] = useState<string[][]>(() => config.words.map((w) => w.shuffledLetters));
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
    markInteracted();
    setOrders((prev) => prev.map((o, wi) => (wi === wordIndex ? next : o)));
  }

  async function applyHint(wi: number) {
    const position = lockedCounts[wi];
    if (position >= orders[wi].length || hintLoading.has(wi)) return;
    markInteracted();
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

  const fullFlags = useMemo(
    () =>
      config.words.map((w) => {
        const totalLength = w.shuffledLetters.length;
        return totalLength > SINGLE_WORD_SPAN_THRESHOLD || totalLength > PHRASE_SPAN_THRESHOLD;
      }),
    [config.words]
  );
  const imageUrls = useMemo(() => config.words.map((w) => w.imageUrl), [config.words]);

  // 2-колонковий порядок — для ≤10-гілки, на всю вправу.
  const isTwoColumn = !useBlocks && config.words.length > TWO_COLUMN_WORD_THRESHOLD;
  const { displayOrder, ready, setContentRef, markInteracted } = useTwoColumnWordOrder({
    wordCount: config.words.length,
    fullFlags,
    imageUrls,
    enabled: isTwoColumn,
  });

  const router = useRouter();

  // ==== Гілка ≤10 слів (незмінна поведінка) ====
  const single = useExerciseCheck(taskId);
  const singleDetail = single.result?.detail as LetterRearrangementDetail | undefined;

  useEffect(() => {
    if (!useBlocks && single.result) onResult?.(single.result);
  }, [useBlocks, single.result, onResult]);

  // ==== Гілка практики (onlyItemIds) — незалежна від useBlocks/single
  // вище: завжди плаский однoколонковий список, без 2-колонкового
  // вимірювання висоти (useTwoColumnWordOrder) і без BlockNavigation — той
  // самий принцип, що letter-gaps.tsx. practiceWordIndices будується НАПРЯМУ
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
    const words: (string[] | null)[] = config.words.map((_, wi) => (practiceSet.has(wi) ? orders[wi] : null));
    const answer: Omit<LetterRearrangementAnswer, "words"> & { words: (string[] | null)[] } = {
      words,
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
  const [blockResults, setBlockResults] = useState<Record<number, LetterRearrangementResult>>({});
  const [blockPending, setBlockPending] = useState<Record<number, boolean>>({});
  const [blockError, setBlockError] = useState<Record<number, string | null>>({});

  // Та сама 2-колонкова сітка/групування за виміряною висотою, що ≤10-
  // гілка вище — ОКРЕМИЙ виклик хука, СКОУПЛЕНИЙ на слова АКТИВНОГО блоку
  // (не на всю вправу), той самий принцип, що letter-gaps.tsx.
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
  // displayOrder скидається в хуку ПІД ЧАС РЕНДЕРУ при зміні wordCount, але
  // споживач тут читає blockTwoColumn.displayOrder У ТОМУ Ж ПРОХОДІ — у
  // вікні між зміною activeBlock (блок меншого розміру) і стабілізацією
  // displayOrder локальні індекси можуть лишатись аж до старого (більшого)
  // activeBlockWordIndices.length. Фільтруємо такі li ПЕРЕД мапінгом —
  // прохід, що однаково буде відкинутий React'ом, не повинен кидати
  // виняток (той самий принцип, що letter-gaps.tsx).
  const blockDisplayOrder = activeBlockWordIndices.length
    ? blockTwoColumn.displayOrder
        .filter((li) => li < activeBlockWordIndices.length)
        .map((li) => activeBlockWordIndices[li])
    : [];

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
        throw new Error(body.error ?? "Помилка перевірки");
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
        [blockIndex]: e instanceof Error ? e.message : "Помилка перевірки",
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
      setContentRef: ((wi: number) => (el: HTMLElement | null) => void) | null;
      // Практика (пілот, частина 4) — лампочка "поставити наступну літеру"
      // вимкнена, той самий принцип, що letter-gaps.tsx hintDisabled.
      hintDisabled?: boolean;
    }
  ) {
    const word = config.words[wi];
    // Захист від застарілого displayOrder (прохід рендеру, що буде
    // відкинутий — див. коментар над blockDisplayOrder вище): пропускаємо
    // замість кидати, а не покладаємось лише на фільтр на вході.
    if (!word) return null;
    const wordDetail = opts.detail?.words[wi];

    function tileState(i: number): "correct" | "incorrect" | undefined {
      if (!wordDetail) return undefined;
      return wordDetail.letters[i]?.isCorrect ? "correct" : "incorrect";
    }

    const totalLength = word.shuffledLetters.length;
    const isCompact = totalLength > LONG_WORD_COMPACT_THRESHOLD;
    const needsFullSpan = !!opts.setContentRef && fullFlags[wi];
    const hintUsed = opts.detail?.words[wi]?.hintUsed;
    // Лампочка (28px, абсолютна right-1.5/top-1.5 відносно картки з
    // px-4) виступає ще на ~30px углиб контентної колонки — без резерву
    // текст підказки/перші плитки могли ховатись під нею. pr-[52px]
    // (ширина кнопки-лампочки 40px + 12px) на контентній колонці нижче.
    const hasLamp = !opts.locked && !isDelf && !opts.hintDisabled;

    return (
      <div key={wi} className={`relative ${WORD_CARD} ${needsFullSpan ? "md:col-span-2" : ""}`}>
        {hasLamp && (
          <HintBulb
            state={hintUsed ? "used" : "available"}
            label="Підказка: поставити наступну літеру на місце"
            disabled={lockedCounts[wi] >= orders[wi].length || hintLoading.has(wi)}
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
            className={`flex min-w-0 flex-1 flex-col gap-2 ${hasLamp ? "pr-[52px]" : ""}`}
          >
            {word.hintText.trim() && (
              <p className="break-words text-sm text-neutral-500 dark:text-neutral-400 [overflow-wrap:anywhere]">{frenchNbsp(word.hintText)}</p>
            )}
            <SortableTileRow
              items={orders[wi]}
              onChange={(next) => updateOrder(wi, next)}
              locked={opts.locked}
              tileState={tileState}
              compact={isCompact}
              letterTile
              gapClassName="gap-1"
              lockedCount={opts.locked ? 0 : lockedCounts[wi]}
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
  }

  function renderBlock() {
    const blockResult = blockResults[activeBlock];
    const blockDetail = blockResult?.detail;
    const errMsg = blockError[activeBlock];

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
              setContentRef: blockTwoColumn.setContentRef,
            })
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {blockResult && (
            <TaskResult
              correct={blockResult.correct}
              pointsEarned={blockResult.pointsEarned}
              pointsPossible={blockResult.pointsPossible}
            />
          )}
        </div>
        {errMsg && <p className="text-sm text-red-600 dark:text-red-400">{errMsg}</p>}
      </div>
    );
  }

  if (isPractice) {
    return (
      <div className={EXERCISE_STACK}>
        <div className="flex flex-col gap-3">
          {practiceWordIndices.map((wi) => {
            const key = String(wi);
            const isCorrect = practiceResults[key];
            const attempts = practiceFailedAttempts[key] ?? 0;
            const itemRevealed = practiceCheck.revealed[key];
            return (
              <div key={wi} className="flex flex-col gap-1.5">
                {renderWordCard(wi, {
                  detail: undefined,
                  locked: false,
                  setContentRef: null,
                  hintDisabled: true,
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

        {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={submitPractice}
            disabled={practiceCheck.pending}
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
  // ЕТАП M — кнопка "Перевірити блок" для спільного рядка check+←/→
  // (BlockNavFooter) — ті самі значення, що читає renderBlock() вище.
  const activeBlockResult = blockResults[activeBlock];
  const activeBlockPending = !!blockPending[activeBlock];
  const checkButtonEl = useBlocks ? (
    <button
      type="button"
      onClick={() => submitBlock(activeBlock)}
      disabled={activeBlockPending}
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
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.letter_rearrangement.instruction}
        subInstructionText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.letter_rearrangement.subInstruction}
        hintText={
          isDelf || (useBlocks ? allBlocksChecked : !!single.result)
            ? null
            : hintExplanationText("letter_rearrangement")
        }
      />

      {!useBlocks ? (
        <>
          <div
            className={`transition-opacity duration-150 ${ready ? "opacity-100" : "opacity-0"} ${
              isTwoColumn ? "grid gap-3 md:grid-cols-2" : "flex flex-col gap-3"
            }`}
          >
            {displayOrder.map((wi) =>
              renderWordCard(wi, { detail: singleDetail, locked: !!single.result, setContentRef })
            )}
          </div>

          {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

          <div className="flex flex-col gap-3">
            {!single.result ? (
              <button
                type="button"
                onClick={() => {
                  const answer: LetterRearrangementAnswer = {
                    words: orders,
                    hintedWordIndices: [...hintedWordIndices],
                  };
                  single.submit(answer);
                }}
                disabled={single.pending}
                className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
              >
                {single.pending ? "Перевіряю..." : "Перевірити"}
              </button>
            ) : (
              <TaskResult
                correct={single.result.correct}
                pointsEarned={single.result.pointsEarned}
                pointsPossible={single.result.pointsPossible}
              />
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
          {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
        </BlockNavigation>
      )}
    </div>
  );
}
