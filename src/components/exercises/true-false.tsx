"use client";

import { useState, useEffect, useMemo } from "react";
import type { TrueFalsePublic, TrueFalseDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { ANSWER_CARD_DEFAULT, ITEM_NUMBER_BADGE } from "./answer-card-style";
import { frenchNbsp } from "@/lib/text/french-typography";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";
import { CARD_BLOCK_MAX, splitEvenly } from "@/lib/exercises/exercise-blocks";
import { BlockNavigation } from "./block-navigation";

type TrueFalseResult = Extract<GradeResult, { detail: TrueFalseDetail }>;
type PublicStatement = TrueFalsePublic["statements"][number];

export function TrueFalseExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: TrueFalsePublic;
  pointsVisible: boolean;
  // Опційний — для блоків (task_group_id), щоб TaskGroupBlock рахував
  // живий підсумок балів усіх задач блоку (режим "сума"). Не впливає на
  // жодну поведінку самої вправи поза блоками.
  onResult?: (result: GradeResult) => void;
  // Опційний — для блоків у режимі "фіксовано", щоб ховати індивідуальний
  // бал задачі безумовно (і до, і після перевірки).
  hidePoints?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  // Картки (твердження) — поріг блоку CARD_BLOCK_MAX=5, той самий принцип,
  // що word-choice.tsx/multiple-choice.tsx (exercise-blocks.ts, перша хвиля
  // card-блоків). ≤5 твердженнь — statementBlocks матиме РІВНО один чанк,
  // useBlocks===false, нижче рендериться ТОЧНО той самий код, що й до
  // розбиття на блоки.
  const statementBlocks = useMemo(() => splitEvenly(config.statements, CARD_BLOCK_MAX), [config.statements]);
  const blockCount = statementBlocks.length;
  const useBlocks = blockCount > 1;

  // ==== Гілка ≤5 твердженнь (незмінна поведінка) ====
  const single = useExerciseCheck(taskId);
  const detail = single.result?.detail as TrueFalseDetail | undefined;

  useEffect(() => {
    if (!useBlocks && single.result) onResult?.(single.result);
  }, [useBlocks, single.result, onResult]);

  // globalIndex — нумерація (ITEM_NUMBER_BADGE) наскрізна по всій вправі.
  function renderStatement(s: PublicStatement, globalIndex: number, d: TrueFalseDetail["statements"][number] | undefined, locked: boolean) {
    return (
      <div
        key={s.id}
        className="flex flex-col gap-2.5 rounded-md border border-gray-100 bg-white px-4 py-2.5 shadow-sm md:flex-row md:items-center md:justify-between md:gap-3 md:px-5 md:py-3 dark:border-neutral-700 dark:bg-neutral-800"
      >
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {config.statements.length > 1 && (
            <span className={ITEM_NUMBER_BADGE} aria-hidden="true">
              {globalIndex + 1}
            </span>
          )}
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">
            {frenchNbsp(s.text)}
            {/* До перевірки — лише якщо pointsVisible; після — завжди,
                ваше підтверджене рішення. */}
            {!hidePoints && (pointsVisible || d) && (
              <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
                {d
                  ? `${d.isCorrect ? d.points : 0}/${d.points} ${pluralizePoints(d.points)}`
                  : `${s.points} ${pluralizePoints(s.points)}`}
              </span>
            )}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:w-auto md:shrink-0">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              type="button"
              disabled={locked}
              onClick={() => setAnswers((prev) => ({ ...prev, [s.id]: val }))}
              className={`flex min-h-12 w-full items-center justify-center rounded-lg border px-4 py-1.5 text-center text-base shadow-sm transition-colors md:min-h-0 md:w-auto md:min-w-[4.5rem] ${
                d
                  ? val === d.correctAnswer
                    ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                    : val === d.studentAnswer
                      ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                      : ANSWER_CARD_DEFAULT
                  : answers[s.id] === val
                    ? SELECTED_OPTION_CLASS
                    : ANSWER_CARD_DEFAULT
              }`}
            >
              {val ? "Vrai" : "Faux"}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ==== Гілка блоків (>5 твердженнь) ====
  const [activeBlock, setActiveBlock] = useState(0);
  const [blockResults, setBlockResults] = useState<Record<number, TrueFalseResult>>({});
  const [blockPending, setBlockPending] = useState<Record<number, boolean>>({});
  const [blockError, setBlockError] = useState<Record<number, string | null>>({});

  const allBlocksChecked = useBlocks && blockCount > 0 && Object.keys(blockResults).length === blockCount;

  const aggregateResult: TrueFalseResult | null = useMemo(() => {
    if (!allBlocksChecked) return null;
    const results = Object.values(blockResults);
    const statements = results.flatMap((r) => r.detail.statements);
    const correctCount = statements.filter((s) => s.isCorrect).length;
    return {
      correct: statements.length > 0 && correctCount === statements.length,
      score: statements.length > 0 ? Math.round((correctCount / statements.length) * 100) : 0,
      detail: { statements },
      pointsEarned: results.reduce((sum, r) => sum + (r.pointsEarned ?? 0), 0),
      pointsPossible: results.reduce((sum, r) => sum + (r.pointsPossible ?? 0), 0),
    };
  }, [allBlocksChecked, blockResults]);

  useEffect(() => {
    if (aggregateResult) onResult?.(aggregateResult);
  }, [aggregateResult, onResult]);

  async function submitBlock(blockIndex: number) {
    const blockStatements = statementBlocks[blockIndex];
    const answer = blockStatements.map((s) => ({ id: s.id, value: answers[s.id] }));
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
      const result = (await res.json()) as TrueFalseResult;
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
    const blockStatements = statementBlocks[activeBlock];
    const startIndex = statementBlocks.slice(0, activeBlock).reduce((sum, b) => sum + b.length, 0);
    const blockResult = blockResults[activeBlock];
    const blockDetail = blockResult?.detail;
    const isPending = !!blockPending[activeBlock];
    const errMsg = blockError[activeBlock];
    const blockAllAnswered = blockStatements.every((s) => answers[s.id] !== undefined);

    return (
      <div className="flex flex-col gap-3">
        <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP}`}>
          {blockStatements.map((s, i) =>
            renderStatement(s, startIndex + i, blockDetail?.statements.find((x) => x.id === s.id), !!blockResult)
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => submitBlock(activeBlock)}
              disabled={isPending || !blockAllAnswered}
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
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.true_false.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.true_false.subInstruction}
      />

      {!useBlocks ? (
        <>
          <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP}`}>
            {config.statements.map((s, index) =>
              renderStatement(s, index, detail?.statements.find((x) => x.id === s.id), !!single.result)
            )}
          </div>

          <div className="flex flex-col gap-3">
            {!single.result ? (
              <button
                type="button"
                onClick={() =>
                  single.submit(config.statements.map((s) => ({ id: s.id, value: answers[s.id] })))
                }
                disabled={single.pending || !config.statements.every((s) => answers[s.id] !== undefined)}
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
