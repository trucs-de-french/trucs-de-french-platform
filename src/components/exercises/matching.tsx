"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MatchingPublic, MatchingDetail, MatchingAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { usePracticeCheck } from "./use-practice-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { TaskPanelHeader } from "./task-panel-header";
import { MatchingBoard } from "./matching-board";
import { STUDENT_BUTTON_PRIMARY, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { EXERCISE_BLOCK_SIZE, chunk } from "@/lib/exercises/exercise-blocks";
import { SCORE_LABEL_CLASS } from "./score-style";
import { TaskResult, TaskResultPairRows } from "./task-result";
import { BlockNavigation, BlockTabs } from "./block-navigation";

type MatchingResult = Extract<GradeResult, { detail: MatchingDetail }>;

// Режим практики "Робота над помилками" (пілот, частина 5) — лише
// помилкові ще не виправлені пари (onlyItemIds — pair.id, sanitize.ts:
// getMatchingPairs). На відміну від word_choice/letter_gaps, config тут
// УЖЕ звужено сервером (page.tsx: sanitizeMatchingForPractice) до рівно
// цих пар — компонент нижче НЕ фільтрує config сам (right не прив'язаний
// до left публічно, звужувати могла лише сторона, що знає повний config).
export type MatchingPracticeProps = {
  onlyItemIds: string[];
  failedAttempts: Record<string, number>;
};

export function MatchingExercise({
  taskId,
  config,
  plaqueText,
  pointsVisible,
  onResult,
  hidePoints,
  practice,
}: {
  taskId: string;
  config: MatchingPublic;
  plaqueText?: string;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  practice?: MatchingPracticeProps;
}) {
  const router = useRouter();

  // pairs/selectedLeft — СПІЛЬНІ на всю вправу (не по блоку): блок лише
  // фільтрує, які left/right видно й до яких прив'язана поточна дія click,
  // сама мапа відповідей одна на всі блоки (як і раніше для ≤10 елементів,
  // де "блок" один і збігається з усією вправою).
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);

  // ПАРА — 2 елементи, звідси EXERCISE_BLOCK_SIZE/2 (exercise-blocks.ts:
  // спільний поріг "10 елементів", кожен тип сам вирішує, скільки його
  // "елементів" у чанку). ≤EXERCISE_BLOCK_SIZE/2 пар (≤10 елементів) —
  // leftBlocks матиме РІВНО один чанк, useBlocks === false, і нижче
  // рендериться ТОЧНО той самий код, що був до розбиття на блоки (окрема
  // гілка, не перевикористання спільного рендера з блоками) — свідомо, щоб
  // вигляд/поведінка наявних коротких вправ не залежали від логіки блоків
  // узагалі.
  const leftBlocks = useMemo(() => chunk(config.left, EXERCISE_BLOCK_SIZE / 2), [config.left]);
  const rightBlocks = useMemo(() => chunk(config.right, EXERCISE_BLOCK_SIZE / 2), [config.right]);
  const blockCount = leftBlocks.length;
  const useBlocks = blockCount > 1;

  // ==== Гілка ≤10 елементів (незмінна поведінка) ====
  const single = useExerciseCheck(taskId);
  const singleDetail = single.result?.detail as MatchingDetail | undefined;

  useEffect(() => {
    if (!useBlocks && single.result) onResult?.(single.result);
  }, [useBlocks, single.result, onResult]);

  // ==== Гілка практики (onlyItemIds) — незалежна від useBlocks/single
  // вище: завжди один "блок" (config тут уже звужений сервером до пар
  // review.remainingItemIds, page.tsx: sanitizeMatchingForPractice), без
  // BlockNavigation. idByLeft/leftById — локальна адресація між left-
  // текстом (яким керують клік-хендлери) і pair.id (яким адресуються
  // practice/check, practice/reveal і failedAttempts/revealed).
  const isPractice = !!practice;
  const idByLeft = useMemo(() => new Map(config.pairs.map((p) => [p.left, p.id])), [config.pairs]);
  const leftById = useMemo(() => new Map(config.pairs.map((p) => [p.id, p.left])), [config.pairs]);
  const [practicePairs, setPracticePairs] = useState<Record<string, string>>({});
  const [selectedLeftPractice, setSelectedLeftPractice] = useState<string | null>(null);
  const [practiceResultByLeft, setPracticeResultByLeft] = useState<Record<string, boolean>>({});
  const [practiceFailedAttempts, setPracticeFailedAttempts] = useState<Record<string, number>>(
    practice?.failedAttempts ?? {}
  );
  const practiceCheck = usePracticeCheck(taskId);
  const onlyItemIdsKey = practice?.onlyItemIds.join(",") ?? "";
  const [prevOnlyItemIdsKey, setPrevOnlyItemIdsKey] = useState(onlyItemIdsKey);
  if (isPractice && onlyItemIdsKey !== prevOnlyItemIdsKey) {
    setPrevOnlyItemIdsKey(onlyItemIdsKey);
    setPracticeResultByLeft({});
  }

  const usedRightsPractice = new Set(Object.values(practicePairs));
  const practiceAllAnswered = config.left.every((left) => !!practicePairs[left]);

  function practiceClickLeft(left: string) {
    if (practicePairs[left]) {
      setPracticePairs((prev) => {
        const next = { ...prev };
        delete next[left];
        return next;
      });
      setSelectedLeftPractice(null);
      return;
    }
    setSelectedLeftPractice((prev) => (prev === left ? null : left));
  }

  function practiceClickRight(right: string) {
    if (selectedLeftPractice) {
      setPracticePairs((prev) => {
        const next = { ...prev };
        const prevLeft = Object.entries(prev).find(([, r]) => r === right)?.[0];
        if (prevLeft) delete next[prevLeft];
        next[selectedLeftPractice] = right;
        return next;
      });
      setSelectedLeftPractice(null);
      return;
    }
    const left = Object.entries(practicePairs).find(([, r]) => r === right)?.[0];
    if (left) {
      setPracticePairs((prev) => {
        const next = { ...prev };
        delete next[left];
        return next;
      });
    }
  }

  async function submitPractice() {
    const itemIds = config.pairs.map((p) => p.id);
    const answer: MatchingAnswer = Object.entries(practicePairs).map(([left, right]) => ({ left, right }));
    const result = await practiceCheck.check(itemIds, answer);
    if (!result) return;
    setPracticeResultByLeft((prev) => {
      const next = { ...prev };
      for (const r of result.results) {
        const left = leftById.get(r.itemId);
        if (left) next[left] = r.correct;
      }
      return next;
    });
    setPracticeFailedAttempts(result.failedAttempts);
    for (const r of result.results) {
      if (!r.correct && (result.failedAttempts[r.itemId] ?? 0) >= 2 && !practiceCheck.revealed[r.itemId]) {
        practiceCheck.reveal(r.itemId, false);
      }
    }
  }

  const usedRights = new Set(Object.values(pairs));

  function pairedLeftOf(right: string) {
    return Object.entries(pairs).find(([, r]) => r === right)?.[0];
  }

  function clickLeft(left: string) {
    if (single.result) return;
    if (pairs[left]) {
      setPairs((prev) => {
        const next = { ...prev };
        delete next[left];
        return next;
      });
      setSelectedLeft(null);
      return;
    }
    setSelectedLeft((prev) => (prev === left ? null : left));
  }

  function clickRight(right: string) {
    if (single.result) return;
    if (selectedLeft) {
      setPairs((prev) => {
        const next = { ...prev };
        const prevLeft = pairedLeftOf(right);
        if (prevLeft) delete next[prevLeft];
        next[selectedLeft] = right;
        return next;
      });
      setSelectedLeft(null);
      return;
    }
    const left = pairedLeftOf(right);
    if (left) {
      setPairs((prev) => {
        const next = { ...prev };
        delete next[left];
        return next;
      });
    }
  }

  function detailFor(left: string, right: string) {
    return singleDetail?.studentPairs.find((p) => p.left === left && p.right === right);
  }

  // До перевірки — лише якщо pointsVisible; після — завжди. left тут НЕ
  // перемішаний (config.pairs у тому самому порядку), тож можна знайти
  // бали цієї пари напряму за текстом лівого елемента.
  function pointsLabel(left: string, detail: MatchingDetail | undefined) {
    if (hidePoints) return "";
    const pd = detail?.pairPoints.find((p) => p.left === left);
    const points = config.pairs.find((p) => p.left === left)?.points;
    if (points === undefined) return "";
    if (!pointsVisible && !pd) return "";
    if (pd) return "";
    return ` (${points} ${pluralizePoints(points)})`;
  }

  // ==== Гілка блоків (>10 елементів) ====
  const [activeBlock, setActiveBlock] = useState(0);
  const [blockResults, setBlockResults] = useState<Record<number, MatchingResult>>({});
  const [blockPending, setBlockPending] = useState<Record<number, boolean>>({});
  const [blockError, setBlockError] = useState<Record<number, string | null>>({});

  const allBlocksChecked = useBlocks && blockCount > 0 && Object.keys(blockResults).length === blockCount;

  // Сумарний результат — лише коли ВСІ блоки перевірені хоч раз (інакше
  // "з Y балів" у групі задач (TaskGroupBlock) показав би лише суму вже
  // перевірених блоків, не повний points вправи — той самий принцип, що
  // "allAnswered" на рівні самого блоку задач). Повторна перевірка вже
  // пройденого блоку (submitBlock нижче) просто оновлює його запис у
  // blockResults — useMemo перерахує суму заново з актуальними даними.
  const aggregateResult: MatchingResult | null = useMemo(() => {
    if (!allBlocksChecked) return null;
    const results = Object.values(blockResults);
    const correctPairs = results.flatMap((r) => r.detail.correctPairs);
    const studentPairs = results.flatMap((r) => r.detail.studentPairs);
    const pairPoints = results.flatMap((r) => r.detail.pairPoints);
    const totalCorrect = studentPairs.filter((p) => p.isCorrect).length;
    return {
      correct: results.every((r) => r.correct),
      score: studentPairs.length > 0 ? Math.round((totalCorrect / studentPairs.length) * 100) : 0,
      detail: { correctPairs, studentPairs, pairPoints },
      pointsEarned: results.reduce((sum, r) => sum + (r.pointsEarned ?? 0), 0),
      pointsPossible: results.reduce((sum, r) => sum + (r.pointsPossible ?? 0), 0),
    };
  }, [allBlocksChecked, blockResults]);

  useEffect(() => {
    if (aggregateResult) onResult?.(aggregateResult);
  }, [aggregateResult, onResult]);

  // Пряме fetch, не useExerciseCheck — той тримає ОДИН result/pending/error
  // на весь виклик хука, а тут потрібні N незалежних станів (по одному на
  // блок), і повторна перевірка блоку має оновити лише його запис, не
  // скинути стан сусідніх блоків.
  async function submitBlock(blockIndex: number) {
    const blockLeft = leftBlocks[blockIndex];
    const answer = blockLeft.filter((left) => pairs[left]).map((left) => ({ left, right: pairs[left] }));
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
      const result = (await res.json()) as MatchingResult;
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

  function renderBlock() {
    const blockLeft = leftBlocks[activeBlock];
    const blockRight = rightBlocks[activeBlock];
    const blockResult = blockResults[activeBlock];
    const blockDetail = blockResult?.detail;
    const errMsg = blockError[activeBlock];
    const usedRightsInBlock = new Set(blockLeft.map((left) => pairs[left]).filter(Boolean));

    function pairedLeftInBlock(right: string) {
      return blockLeft.find((left) => pairs[left] === right);
    }

    function clickLeftInBlock(left: string) {
      if (blockResult) return;
      if (pairs[left]) {
        setPairs((prev) => {
          const next = { ...prev };
          delete next[left];
          return next;
        });
        setSelectedLeft(null);
        return;
      }
      setSelectedLeft((prev) => (prev === left ? null : left));
    }

    function clickRightInBlock(right: string) {
      if (blockResult) return;
      if (selectedLeft) {
        setPairs((prev) => {
          const next = { ...prev };
          const prevLeft = pairedLeftInBlock(right);
          if (prevLeft) delete next[prevLeft];
          next[selectedLeft] = right;
          return next;
        });
        setSelectedLeft(null);
        return;
      }
      const left = pairedLeftInBlock(right);
      if (left) {
        setPairs((prev) => {
          const next = { ...prev };
          delete next[left];
          return next;
        });
      }
    }

    function detailForInBlock(left: string, right: string) {
      return blockDetail?.studentPairs.find((p) => p.left === left && p.right === right);
    }

    return (
      <div className="flex flex-col gap-[14px] md:gap-[16px]">
        <MatchingBoard
          leftItems={blockLeft}
          rightItems={blockRight}
          pairs={pairs}
          selectedLeft={selectedLeft}
          onClickLeft={clickLeftInBlock}
          onClickRight={clickRightInBlock}
          disabled={!!blockResult}
          statusForLeft={(left) => {
            const right = pairs[left];
            if (!right) return undefined;
            const d = detailForInBlock(left, right);
            return d ? (d.isCorrect ? "correct" : "incorrect") : undefined;
          }}
          usedRights={usedRightsInBlock}
          renderLeftExtra={(left) => <span className={SCORE_LABEL_CLASS}>{pointsLabel(left, blockDetail)}</span>}
        />

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {blockResult && (
              <TaskResult
                correct={blockResult.correct}
                pointsEarned={blockResult.pointsEarned}
                pointsPossible={blockResult.pointsPossible}
                toggleTitle="Правильні пари"
                toggleCount={blockDetail?.correctPairs.length}
              >
                {blockDetail && <TaskResultPairRows pairs={blockDetail.correctPairs} />}
              </TaskResult>
            )}
          </div>
          {errMsg && <p className="text-sm text-red-600 dark:text-red-400">{errMsg}</p>}
        </div>
      </div>
    );
  }

  if (isPractice) {
    return (
      <div className={EXERCISE_STACK}>
        <MatchingBoard
          leftItems={config.left}
          rightItems={config.right}
          pairs={practicePairs}
          selectedLeft={selectedLeftPractice}
          onClickLeft={practiceClickLeft}
          onClickRight={practiceClickRight}
          disabled={false}
          statusForLeft={(left) => {
            const isCorrect = practiceResultByLeft[left];
            return isCorrect === true ? "correct" : isCorrect === false ? "incorrect" : undefined;
          }}
          usedRights={usedRightsPractice}
        />

        <div className="flex flex-col gap-1.5">
          {config.left.map((left) => {
            const id = idByLeft.get(left);
            if (!id) return null;
            const isCorrect = practiceResultByLeft[left];
            const attempts = practiceFailedAttempts[id] ?? 0;
            const itemRevealed = practiceCheck.revealed[id];
            if (isCorrect === undefined && !itemRevealed) return null;
            return (
              <div key={left} className="flex flex-wrap items-center gap-2 pl-1 text-xs">
                {isCorrect === true && (
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {left}: правильно ✓
                  </span>
                )}
                {isCorrect === false && (
                  <>
                    <span className="text-red-600 dark:text-red-400">
                      {left}: неправильно, спробуйте ще раз (спроб: {attempts})
                    </span>
                    {!itemRevealed && (
                      <button
                        type="button"
                        onClick={() => practiceCheck.reveal(id, true)}
                        disabled={!!practiceCheck.revealPending[id]}
                        className={STUDENT_BUTTON_SECONDARY_TOUCH}
                      >
                        Показати відповідь
                      </button>
                    )}
                  </>
                )}
                {itemRevealed && (
                  <span className="italic text-amber-700 dark:text-amber-400">
                    Правильна пара: {left} → {itemRevealed.join(", ")}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={submitPractice}
            disabled={practiceCheck.pending || !practiceAllAnswered}
            className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
          >
            {practiceCheck.pending ? "Перевіряю..." : "Перевірити"}
          </button>
          {practiceCheck.error && <p className="text-sm text-red-600 dark:text-red-400">{practiceCheck.error}</p>}
        </div>
      </div>
    );
  }

  // ЕТАП M — кнопка "Перевірити блок" для рядка check+←/→
  // (BlockNavFooter, block-navigation.tsx): ті самі дані/обробник, що
  // читає сам renderBlock() нижче (blockResults[activeBlock]/
  // blockPending[activeBlock]/submitBlock), лише обчислені тут —
  // BlockNavigation.checkButton рендериться ПОЗА деревом, яке повертає
  // renderBlock().
  const activeBlockResult = blockResults[activeBlock];
  const activeBlockPending = !!blockPending[activeBlock];
  const activeBlockLeft = leftBlocks[activeBlock];
  const checkButtonEl = useBlocks ? (
    <button
      type="button"
      onClick={() => submitBlock(activeBlock)}
      disabled={activeBlockPending || activeBlockLeft.some((left) => !pairs[left])}
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
      />
      <TaskPanelHeader
        blockCount={blockCount}
        activeBlock={activeBlock}
        onChangeBlock={setActiveBlock}
        isBlockChecked={(i) => i in blockResults}
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.matching.instruction}
        subInstructionText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.matching.subInstruction}
      />

      {!useBlocks ? (
        <div className="flex flex-col gap-[14px] md:gap-[16px]">
          <MatchingBoard
            leftItems={config.left}
            rightItems={config.right}
            pairs={pairs}
            selectedLeft={selectedLeft}
            onClickLeft={clickLeft}
            onClickRight={clickRight}
            disabled={!!single.result}
            statusForLeft={(left) => {
              const right = pairs[left];
              if (!right) return undefined;
              const d = detailFor(left, right);
              return d ? (d.isCorrect ? "correct" : "incorrect") : undefined;
            }}
            usedRights={usedRights}
            renderLeftExtra={(left) => <span className={SCORE_LABEL_CLASS}>{pointsLabel(left, singleDetail)}</span>}
          />

          <div className="flex flex-col gap-3">
            {!single.result ? (
              <button
                type="button"
                onClick={() => single.submit(Object.entries(pairs).map(([left, right]) => ({ left, right })))}
                disabled={single.pending || Object.keys(pairs).length !== config.left.length}
                className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
              >
                {single.pending ? "Перевіряю..." : "Перевірити"}
              </button>
            ) : (
              <TaskResult
                correct={single.result.correct}
                pointsEarned={single.result.pointsEarned}
                pointsPossible={single.result.pointsPossible}
                toggleTitle="Правильні пари"
                toggleCount={singleDetail?.correctPairs.length}
              >
                {singleDetail && <TaskResultPairRows pairs={singleDetail.correctPairs} />}
              </TaskResult>
            )}
            {single.error && <p className="text-sm text-red-600 dark:text-red-400">{single.error}</p>}
          </div>
        </div>
      ) : (
        <BlockNavigation
          blockCount={blockCount}
          activeBlock={activeBlock}
          onChangeBlock={setActiveBlock}
          blockResults={blockResults}
          checkButton={checkButtonEl}
        >
          {renderBlock()}
        </BlockNavigation>
      )}
    </div>
  );
}
