"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { TrueFalsePublic, TrueFalseDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS, DEFAULT_TRANSLATION_EN, taskTranslationLine } from "@/lib/exercises/default-instructions";
import { TaskPanelHeader } from "./task-panel-header";
import { frenchNbsp } from "@/lib/text/french-typography";
import { BUTTON_CHECK } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { TaskResult, RowPointsTab } from "./task-result";
import { unevenPointsFlags } from "@/lib/exercises/uneven-points";
import { headerPointsState } from "@/lib/exercises/header-points";
import { EXERCISE_BODY_ITEMS_GAP } from "@/lib/spacing";
import { CARD_BLOCK_MAX, splitEvenly } from "@/lib/exercises/exercise-blocks";
import { BlockNavigation, BlockTabs } from "./block-navigation";
import { usePracticeCheck } from "./use-practice-check";
import { practiceAttemptFooterState, pruneStaleResults } from "@/lib/exercises/error-review";
import { PracticeAttemptFooter } from "./practice-attempt-footer";
import { useCheckConfirm, CheckConfirmBar } from "./check-confirm";
import { useT } from "@/lib/i18n/context";

type TrueFalseResult = Extract<GradeResult, { detail: TrueFalseDetail }>;
type PublicStatement = TrueFalsePublic["statements"][number];

// Задача "highlight instead of text line" — той самий клас кнопки, що
// звичайна вправа (renderStatement нижче), винесений як чистий helper,
// щоб практика могла викликати ЙОГО напряму (без повного TrueFalseDetail,
// якого в практиці нема) і щоб його можна було протестувати окремо.
// correctAnswer undefined — відповідь ще НЕ розкрита (жодна з двох
// кнопок не стає зеленою, лише власний невдалий вибір студента —
// червоний): "не вдалося" видно, "яка правильна" — ні, той самий
// принцип, що "не показувати відповідь до розкриття" в усіх 15 типів.
export function trueFalseOptionClass(
  val: boolean,
  isSelected: boolean,
  correctAnswer: boolean | undefined,
  studentAnswer: boolean | null | undefined
): string {
  if (correctAnswer !== undefined) {
    if (val === correctAnswer) return "border-green-500 bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-100";
    if (studentAnswer != null && val === studentAnswer)
      return "border-red-500 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-100";
    return "glass-answer-btn glass-answer-btn--neutral";
  }
  if (studentAnswer != null && val === studentAnswer) {
    return "border-red-500 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-100";
  }
  return isSelected ? "glass-answer-btn--selected" : "glass-answer-btn";
}

// Режим практики "Робота над помилками" (пілот, частина 3) — лише
// помилкові ще не виправлені твердження (onlyItemIds — statement.id).
export type TrueFalsePracticeProps = {
  onlyItemIds: string[];
  failedAttempts: Record<string, number>;
};

export function TrueFalseExercise({
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
  config: TrueFalsePublic;
  plaqueText?: string;
  pointsVisible: boolean;
  // Опційний — для блоків (task_group_id), щоб TaskGroupBlock рахував
  // живий підсумок балів усіх задач блоку (режим "сума"). Не впливає на
  // жодну поведінку самої вправи поза блоками.
  onResult?: (result: GradeResult) => void;
  // Опційний — для блоків у режимі "фіксовано", щоб ховати індивідуальний
  // бал задачі безумовно (і до, і після перевірки).
  hidePoints?: boolean;
  // Пілюля балів твердження (RowPointsTab) — лише в DELF (showItemPoints);
  // поза DELF лишається видимою лише на твердженнях, чиї бали відрізняються
  // від типових у цій вправі (unevenPointsFlags нижче) — задача "показувати
  // лише загальний бал поза DELF".
  isDelf?: boolean;
  practice?: TrueFalsePracticeProps;
}) {
  const { t, lang } = useT();
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  // Картки (твердження) — поріг блоку CARD_BLOCK_MAX=5, той самий принцип,
  // що word-choice.tsx/multiple-choice.tsx (exercise-blocks.ts, перша хвиля
  // card-блоків). ≤5 твердженнь — statementBlocks матиме РІВНО один чанк,
  // useBlocks===false, нижче рендериться ТОЧНО той самий код, що й до
  // розбиття на блоки.
  const statementBlocks = useMemo(() => splitEvenly(config.statements, CARD_BLOCK_MAX), [config.statements]);
  const blockCount = statementBlocks.length;
  const useBlocks = blockCount > 1;

  // Поза DELF пілюля балів ховається, КРІМ твердженнь із нетиповими балами
  // (п.4 задачі) — рахується по всій вправі (не лише видимому блоку), щоб
  // "типовий" бал не залежав від того, який блок активний.
  const unevenFlags = useMemo(
    () => unevenPointsFlags(config.statements.map((s) => s.points)),
    [config.statements]
  );
  const unevenById = useMemo(() => {
    const m = new Map<string, boolean>();
    config.statements.forEach((s, i) => m.set(s.id, unevenFlags[i]));
    return m;
  }, [config.statements, unevenFlags]);
  const anyItemPointsShown = isDelf || unevenFlags.some(Boolean);
  const itemsGapClass = anyItemPointsShown ? "gap-[22px]" : EXERCISE_BODY_ITEMS_GAP;

  // ==== Гілка ≤5 твердженнь (незмінна поведінка) ====
  const router = useRouter();
  const single = useExerciseCheck(taskId);
  const detail = single.result?.detail as TrueFalseDetail | undefined;
  const singleCheckConfirm = useCheckConfirm();
  const singleAnsweredCount = config.statements.filter((s) => answers[s.id] !== undefined).length;
  function submitSingle() {
    single.submit(config.statements.map((s) => ({ id: s.id, value: answers[s.id] })));
  }

  useEffect(() => {
    if (!useBlocks && single.result) onResult?.(single.result);
  }, [useBlocks, single.result, onResult]);

  // ==== Гілка практики (onlyItemIds) — незалежна від useBlocks/single
  // вище: завжди плаский список, без BlockNavigation.
  const isPractice = !!practice;
  const practiceStatements = isPractice
    ? config.statements.filter((s) => practice!.onlyItemIds.includes(s.id))
    : [];
  const originalIndexOf = new Map(config.statements.map((s, i) => [s.id, i]));
  const practiceCheck = usePracticeCheck(taskId);
  const [practiceResults, setPracticeResults] = useState<Record<string, boolean>>({});
  const [practiceFailedAttempts, setPracticeFailedAttempts] = useState<Record<string, number>>(
    practice?.failedAttempts ?? {}
  );
  const onlyItemIdsKey = practice?.onlyItemIds.join(",") ?? "";
  // Коригування стану під час рендеру (React-рекомендований патерн — не
  // useEffect, щоб уникнути react-hooks/set-state-in-effect): коли
  // remainingItemIds змінюється (елемент виправлено й зник після
  // router.refresh()), скидаємо локальні результати попередньої спроби.
  const [prevOnlyItemIdsKey, setPrevOnlyItemIdsKey] = useState(onlyItemIdsKey);
  if (isPractice && onlyItemIdsKey !== prevOnlyItemIdsKey) {
    setPrevOnlyItemIdsKey(onlyItemIdsKey);
    setPracticeResults((prev) => pruneStaleResults(prev, practice!.onlyItemIds));
  }

  async function submitPractice() {
    const answer = practiceStatements.map((s) => ({ id: s.id, value: answers[s.id] }));
    const result = await practiceCheck.check(
      practiceStatements.map((s) => s.id),
      answer
    );
    if (!result) return;
    setPracticeResults((prev) => {
      const next = { ...prev };
      for (const r of result.results) next[r.itemId] = r.correct;
      return next;
    });
    setPracticeFailedAttempts(result.failedAttempts);
    // Задача "unify attempt/reveal behaviour" — без автоматичного
    // розкриття (shouldAutoReveal, error-review.ts, завжди false), лише
    // кнопкою "Відповідь" (BUTTON_REVEAL_ANSWER, reveal(id, true)).
  }

  // globalIndex — нумерація (.item-number-badge) наскрізна по всій вправі.
  // practiceCorrectAnswer — лише практика (d завжди undefined там, нема
  // TrueFalseDetail): correctAnswer, щойно відомий без витоку — або явне
  // розкриття (practiceCheck.reveal), або сам факт isCorrect:true (студент
  // і так уже знає свій, правильний, вибір).
  function renderStatement(
    s: PublicStatement,
    globalIndex: number,
    d: TrueFalseDetail["statements"][number] | undefined,
    locked: boolean,
    practiceCorrectAnswer?: boolean
  ) {
    const showTab = !hidePoints && (isDelf || unevenById.get(s.id)) && (pointsVisible || !!d);
    return (
      <div key={s.id} className="row-points-tab-wrap">
        {showTab && <RowPointsTab earned={d ? (d.isCorrect ? d.points : 0) : undefined} possible={s.points} />}
        {/* pt умовний (showTab) — той самий принцип, що
            .row-points-tab-wrap--has-tab у globals.css (table-fill/
            drag-drop/chrono): рядок без вкладки балів не платить за її
            +6px запас зверху. */}
        <div
          className={`glass-item-card flex flex-col gap-2.5 px-4 ${showTab ? "pt-4 md:pt-[18px]" : "pt-2.5 md:pt-3"} pb-2.5 md:flex-row md:items-center md:justify-between md:gap-3 md:px-5 md:pb-3`}
        >
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {config.statements.length > 1 && (
            <span className="item-number-badge" aria-label={t("aria.statement", { n: globalIndex + 1 })}>
              {globalIndex + 1}
            </span>
          )}
          <span className="min-w-0 break-words [overflow-wrap:anywhere]" style={{ color: "var(--glass-text)" }}>
            {frenchNbsp(s.text)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:w-auto md:shrink-0">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              type="button"
              disabled={locked}
              onClick={() => setAnswers((prev) => ({ ...prev, [s.id]: val }))}
              className={`flex min-h-12 w-full items-center justify-center rounded-lg border px-4 py-1.5 text-center text-base transition-colors md:min-h-0 md:w-auto md:min-w-[4.5rem] ${trueFalseOptionClass(
                val,
                answers[s.id] === val,
                d ? d.correctAnswer : practiceCorrectAnswer,
                d ? d.studentAnswer : answers[s.id]
              )}`}
            >
              {val ? "Vrai" : "Faux"}
            </button>
          ))}
        </div>
        </div>
      </div>
    );
  }

  // ==== Гілка блоків (>5 твердженнь) ====
  const [activeBlock, setActiveBlock] = useState(0);
  const blockCheckConfirm = useCheckConfirm();
  useEffect(() => {
    blockCheckConfirm.cancelCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlock]);
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
        throw new Error(body.error ?? t("error.checkFailed"));
      }
      const result = (await res.json()) as TrueFalseResult;
      setBlockResults((prev) => ({ ...prev, [blockIndex]: result }));
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

  function renderBlock() {
    const blockStatements = statementBlocks[activeBlock];
    const startIndex = statementBlocks.slice(0, activeBlock).reduce((sum, b) => sum + b.length, 0);
    const blockResult = blockResults[activeBlock];
    const blockDetail = blockResult?.detail;
    const errMsg = blockError[activeBlock];

    return (
      <div className="flex flex-col gap-3">
        <div className={`flex flex-col ${itemsGapClass} pt-3`}>
          {blockStatements.map((s, i) =>
            renderStatement(s, startIndex + i, blockDetail?.statements.find((x) => x.id === s.id), !!blockResult)
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {blockResult && (
              <TaskResult
                correct={blockResult.correct}
                pointsEarned={blockResult.pointsEarned}
                pointsPossible={blockResult.pointsPossible}
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
      </div>
    );
  }

  if (isPractice) {
    return (
      <div className={EXERCISE_STACK}>
        <div className={`flex flex-col ${itemsGapClass} pt-3`}>
          {practiceStatements.map((s) => {
            const idx = originalIndexOf.get(s.id)!;
            const isCorrect = practiceResults[s.id];
            const attempts = practiceFailedAttempts[s.id] ?? 0;
            const itemRevealed = practiceCheck.revealed[s.id];
            // practiceCorrectAnswer — той самий принцип, що
            // renderStatement вище: ніколи до розкриття, ОКРІМ коли сам
            // студент уже вгадав правильно (його ж вибір і є відповіддю,
            // нічого зайвого не розкриває).
            const practiceCorrectAnswer = itemRevealed
              ? itemRevealed[0] === "Vrai"
              : isCorrect === true
                ? answers[s.id]
                : undefined;
            return (
              <div key={s.id} className="flex flex-col gap-1.5">
                {renderStatement(s, idx, undefined, false, practiceCorrectAnswer)}
                <PracticeAttemptFooter
                  state={practiceAttemptFooterState(isCorrect, itemRevealed)}
                  failedAttempts={attempts}
                  onReveal={() => practiceCheck.reveal(s.id, true)}
                  revealDisabled={!!practiceCheck.revealPending[s.id]}
                />
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={submitPractice}
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

  // ЕТАП M — кнопка "Перевірити блок" для спільного рядка check+←/→
  // (BlockNavFooter) — ті самі значення, що читає renderBlock() вище.
  const activeBlockStatements = statementBlocks[activeBlock];
  const activeBlockResult = blockResults[activeBlock];
  const activeBlockPending = !!blockPending[activeBlock];
  const activeBlockUnanswered =
    activeBlockStatements?.filter((s) => answers[s.id] === undefined).length ?? 0;
  // Єдина пілюля балів (задача "єдина пілюля балів усюди"): до перевірки —
  // бали ПОТОЧНОГО блоку/вправи (сума statements[].points); після
  // перевірки активного блоку/вправи — earned sur possible + статус-чіп.
  const currentBlockPoints = (useBlocks ? activeBlockStatements ?? [] : config.statements).reduce(
    (sum, s) => sum + s.points,
    0
  );
  const activeBlockOrSingleResult = useBlocks ? activeBlockResult : single.result;
  const headerPoints = hidePoints
    ? undefined
    : headerPointsState(
        activeBlockOrSingleResult?.pointsPossible ?? currentBlockPoints,
        activeBlockOrSingleResult?.pointsEarned,
        lang
      );
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
      />
      <TaskPanelHeader
        blockCount={blockCount}
        activeBlock={activeBlock}
        onChangeBlock={setActiveBlock}
        isBlockChecked={(i) => i in blockResults}
        {...(headerPoints ?? {})}
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.true_false.instruction}
        subInstructionText={taskTranslationLine({ uk: config.subInstructions, en: config.subInstructionsEn }, lang, {
          uk: DEFAULT_INSTRUCTIONS.true_false.subInstruction,
          en: DEFAULT_TRANSLATION_EN.true_false,
        })}
      />

      {!useBlocks ? (
        <>
          <div className={`flex flex-col ${itemsGapClass} pt-3`}>
            {config.statements.map((s, index) =>
              renderStatement(s, index, detail?.statements.find((x) => x.id === s.id), !!single.result)
            )}
          </div>

          <div className="flex flex-col gap-3">
            {!single.result ? (
              <div className="flex flex-col items-start gap-2">
                <button
                  type="button"
                  onClick={() =>
                    singleCheckConfirm.attemptCheck(
                      config.statements.length - singleAnsweredCount,
                      submitSingle
                    )
                  }
                  disabled={single.pending}
                  className={`self-start ${BUTTON_CHECK}`}
                >
                  {single.pending ? t("button.checking") : t("button.check")}
                </button>
                {singleCheckConfirm.confirming && (
                  <CheckConfirmBar
                    unansweredCount={config.statements.length - singleAnsweredCount}
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
        </BlockNavigation>
      )}
    </div>
  );
}
