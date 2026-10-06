"use client";

import { useEffect, useMemo, useState } from "react";
import type { MatchingPublic, MatchingDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { ANSWER_CARD_BASE, ANSWER_CARD_DEFAULT } from "./answer-card-style";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";
import { EXERCISE_BLOCK_SIZE, chunk } from "@/lib/exercises/exercise-blocks";
import { BlockNavigation } from "./block-navigation";

type MatchingResult = Extract<GradeResult, { detail: MatchingDetail }>;

export function MatchingExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: MatchingPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
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
    if (pd) return ` (${pd.isCorrect ? pd.points : 0}/${pd.points} ${pluralizePoints(pd.points)})`;
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
    const isPending = !!blockPending[activeBlock];
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
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            {blockLeft.map((left) => {
              const right = pairs[left];
              const d = right ? detailForInBlock(left, right) : undefined;
              return (
                <button
                  key={left}
                  type="button"
                  onClick={() => clickLeftInBlock(left)}
                  disabled={!!blockResult}
                  className={`${ANSWER_CARD_BASE} ${
                    d
                      ? d.isCorrect
                        ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                        : "border-red-500 bg-red-50 dark:bg-red-950/30"
                      : selectedLeft === left
                        ? SELECTED_OPTION_CLASS
                        : right
                          ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30"
                          : ANSWER_CARD_DEFAULT
                  }`}
                >
                  {left}
                  {right ? ` → ${right}` : ""}
                  <span className={SCORE_LABEL_CLASS}>{pointsLabel(left, blockDetail)}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            {blockRight.map((right) => (
              <button
                key={right}
                type="button"
                onClick={() => clickRightInBlock(right)}
                disabled={!!blockResult}
                className={`${ANSWER_CARD_BASE} ${ANSWER_CARD_DEFAULT} ${
                  usedRightsInBlock.has(right) ? "opacity-50" : ""
                }`}
              >
                {right}
              </button>
            ))}
          </div>
        </div>

        {blockDetail && (
          <div className="text-sm">
            <p className="font-medium">Правильні пари цього блоку:</p>
            <ul className="mt-1 flex flex-col gap-0.5 text-neutral-600 dark:text-neutral-400">
              {blockDetail.correctPairs.map((p, i) => (
                <li key={i}>
                  {p.left} → {p.right}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => submitBlock(activeBlock)}
              disabled={isPending || blockLeft.some((left) => !pairs[left])}
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
                    ({blockResult.pointsEarned} з {blockResult.pointsPossible}{" "}
                    {pluralizePoints(blockResult.pointsPossible)})
                  </span>
                )}
              </p>
            )}
          </div>
          {errMsg && <p className="text-sm text-red-600 dark:text-red-400">{errMsg}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.matching.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.matching.subInstruction}
      />

      {!useBlocks ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              {config.left.map((left) => {
                const right = pairs[left];
                const d = right ? detailFor(left, right) : undefined;
                return (
                  <button
                    key={left}
                    type="button"
                    onClick={() => clickLeft(left)}
                    disabled={!!single.result}
                    className={`${ANSWER_CARD_BASE} ${
                      d
                        ? d.isCorrect
                          ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                          : "border-red-500 bg-red-50 dark:bg-red-950/30"
                        : selectedLeft === left
                          ? SELECTED_OPTION_CLASS
                          : right
                            ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30"
                            : ANSWER_CARD_DEFAULT
                    }`}
                  >
                    {left}
                    {right ? ` → ${right}` : ""}
                    <span className={SCORE_LABEL_CLASS}>{pointsLabel(left, singleDetail)}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2">
              {config.right.map((right) => (
                <button
                  key={right}
                  type="button"
                  onClick={() => clickRight(right)}
                  disabled={!!single.result}
                  className={`${ANSWER_CARD_BASE} ${ANSWER_CARD_DEFAULT} ${
                    usedRights.has(right) ? "opacity-50" : ""
                  }`}
                >
                  {right}
                </button>
              ))}
            </div>
          </div>

          {singleDetail && (
            <div className="text-sm">
              <p className="font-medium">Правильні пари:</p>
              <ul className="mt-1 flex flex-col gap-0.5 text-neutral-600 dark:text-neutral-400">
                {singleDetail.correctPairs.map((p, i) => (
                  <li key={i}>
                    {p.left} → {p.right}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
        </BlockNavigation>
      )}
    </div>
  );
}
