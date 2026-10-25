"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { OpenAnswerPublic, OpenAnswerDetail, GradeResult } from "@/lib/exercises/types";
import { HintBulb, HintUsedBadge } from "./hint-bulb";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { TaskPanelHeader } from "./task-panel-header";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { DiacriticsPopup, useDiacriticsPopup, insertAtCursor, focusAndSetCursor } from "./diacritics-popup";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { CompactAudioButton } from "./compact-audio-button";
import { ImageLightbox } from "./image-lightbox";
import { EXERCISE_STACK } from "@/lib/spacing";
import { frenchNbsp } from "@/lib/text/french-typography";
import { TaskResult, RowPointsTab, TaskResultGapRows } from "./task-result";
import { TABLE_FILL_ANSWERS_TOGGLE_LABEL } from "@/lib/exercises/default-task-labels";
import { CARD_BLOCK_MAX, splitEvenly } from "@/lib/exercises/exercise-blocks";

// Плитки toggle-картки "Правильні відповіді" — одна плитка на питання:
// текст питання + прийнятний(і) варіант(и) відповіді підсвічені (кілька
// прийнятних варіантів — той самий принцип, що fill-blank.tsx:
// correctAnswers.join(" / "), один chip, не окремі).
function buildOpenAnswerRows(
  questions: OpenAnswerPublic["questions"],
  detail: OpenAnswerDetail
): { number: number; parts: (string | { word: string })[] }[] {
  return questions.map((q, i) => {
    const qDetail = detail.questions.find((d) => d.id === q.id);
    return {
      number: i + 1,
      parts: [`${q.question} — `, { word: qDetail?.correctAnswers.join(" / ") ?? "" }],
    };
  });
}
import { BlockNavigation, BlockTabs } from "./block-navigation";
import { useCheckConfirm, CheckConfirmBar } from "./check-confirm";

type OpenAnswerResult = Extract<GradeResult, { detail: OpenAnswerDetail }>;
type PublicQuestion = OpenAnswerPublic["questions"][number];

// На відміну від EssayCheckExercise (essay_check, AI/Gemini-перевірка
// розгорнутого тексту), тут коротка відповідь звіряється з фіксованим
// списком прийнятних варіантів — той самий принцип, що для одного пропуску
// у fill_blank, через спільний /api/exercises/check. Кілька питань під
// однією вправою — та сама модель, що listening.tsx.
export function OpenAnswerCheckExercise({
  taskId,
  config,
  plaqueText,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: OpenAnswerPublic;
  plaqueText?: string;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hintShown, setHintShown] = useState<Set<string>>(new Set());
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const diacritics = useDiacriticsPopup<string>();

  function showHint(id: string) {
    setHintShown((prev) => new Set(prev).add(id));
  }

  // Картки (питання) — поріг блоку CARD_BLOCK_MAX=5, той самий принцип, що
  // word-choice.tsx/multiple-choice.tsx/true-false.tsx/reorder.tsx
  // (exercise-blocks.ts, перша хвиля card-блоків). ≤5 питань —
  // questionBlocks матиме РІВНО один чанк, useBlocks===false, нижче
  // рендериться ТОЧНО той самий код, що й до розбиття на блоки.
  const questionBlocks = useMemo(() => splitEvenly(config.questions, CARD_BLOCK_MAX), [config.questions]);
  const blockCount = questionBlocks.length;
  const useBlocks = blockCount > 1;

  // ==== Гілка ≤5 питань (незмінна поведінка) ====
  const router = useRouter();
  const single = useExerciseCheck(taskId);
  const detail = single.result?.detail as OpenAnswerDetail | undefined;
  const singleCheckConfirm = useCheckConfirm();
  const singleAnsweredCount = config.questions.filter((q) => answers[q.id]?.trim()).length;
  function submitSingle() {
    single.submit(
      config.questions.map((q) => ({
        questionId: q.id,
        value: answers[q.id] ?? "",
        hintUsed: hintShown.has(q.id),
      }))
    );
  }

  useEffect(() => {
    if (!useBlocks && single.result) onResult?.(single.result);
  }, [useBlocks, single.result, onResult]);

  function renderQuestion(q: PublicQuestion, qDetail: OpenAnswerDetail["questions"][number] | undefined, locked: boolean) {
    const hintVisible = hintShown.has(q.id);
    const showTab = !hidePoints && (pointsVisible || !!qDetail);
    // Єдине питання у вправі — номер не показуємо (нема що рахувати):
    // той самий принцип, що приховані номери в вправах з одним елементом.
    const number = config.questions.length > 1 ? config.questions.findIndex((cq) => cq.id === q.id) + 1 : null;
    return (
      <div key={q.id} className="row-points-tab-wrap">
        {showTab && (
          <RowPointsTab earned={qDetail ? (qDetail.isCorrect ? qDetail.points : 0) : undefined} possible={q.points} />
        )}
        <div className="glass-item-card flex flex-col gap-2 px-3 pt-4 pb-3">
          <div className="flex items-start gap-3">
            {number !== null && (
              <span className="item-number-badge" aria-label={`Питання ${number}`}>
                {number}
              </span>
            )}
            {(q.imageUrl || q.audioUrl) && (
              <div className="flex shrink-0 items-center gap-2">
                {q.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setLightboxSrc(q.imageUrl!)}
                    aria-label="Показати картинку повністю"
                    className="shrink-0 cursor-zoom-in"
                  >
                    <ImageOrPlaceholder
                      src={q.imageUrl}
                      alt=""
                      className="h-11 w-11 rounded-lg object-cover"
                      useFocus
                    />
                  </button>
                )}
                {q.audioUrl && <CompactAudioButton src={q.audioUrl} />}
              </div>
            )}
            <p className="min-w-0 flex-1 break-words font-medium [overflow-wrap:anywhere]">
              {frenchNbsp(q.question)}
            </p>
          </div>
          <div className="relative">
            <input
              ref={diacritics.fieldRef(q.id)}
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              onFocus={() => diacritics.onFocus(q.id)}
              onBlur={diacritics.onBlur}
              disabled={locked}
              className={`w-full rounded-md border px-4 py-2.5 text-base ${q.hint ? "pr-12" : ""} ${
                qDetail
                  ? qDetail.isCorrect
                    ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                    : "border-red-500 bg-red-50 dark:bg-red-950/30"
                  : "glass-gap-shadow border-[rgba(217,183,101,0.55)] bg-white dark:border-neutral-600 dark:bg-neutral-800"
              }`}
              placeholder="Ваша відповідь..."
            />
            {q.hint && !locked && (
              <HintBulb
                state={hintVisible ? "used" : "available"}
                onClick={() => showHint(q.id)}
                onMouseDown={(e) => e.preventDefault()}
                label={hintVisible ? q.hint : "Показати підказку"}
                className="absolute top-1/2 right-2 -translate-y-1/2"
              />
            )}
            {qDetail?.hintUsed && <HintUsedBadge />}
          </div>
          {q.hint && (
            <p className="min-h-5 text-sm break-words text-neutral-600 dark:text-neutral-300">
              {hintVisible ? q.hint : ""}
            </p>
          )}
          {qDetail && !qDetail.isCorrect && (
            <p className="text-sm text-red-600 dark:text-red-400">
              Правильно: {qDetail.correctAnswers.join(" / ")}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ==== Гілка блоків (>5 питань) ====
  const [activeBlock, setActiveBlock] = useState(0);
  const blockCheckConfirm = useCheckConfirm();
  useEffect(() => {
    blockCheckConfirm.cancelCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlock]);
  const [blockResults, setBlockResults] = useState<Record<number, OpenAnswerResult>>({});
  const [blockPending, setBlockPending] = useState<Record<number, boolean>>({});
  const [blockError, setBlockError] = useState<Record<number, string | null>>({});

  const allBlocksChecked = useBlocks && blockCount > 0 && Object.keys(blockResults).length === blockCount;

  const aggregateResult: OpenAnswerResult | null = useMemo(() => {
    if (!allBlocksChecked) return null;
    const results = Object.values(blockResults);
    const questions = results.flatMap((r) => r.detail.questions);
    const correctCount = questions.filter((q) => q.isCorrect).length;
    return {
      correct: questions.length > 0 && correctCount === questions.length,
      score: questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0,
      detail: { questions },
      pointsEarned: results.reduce((sum, r) => sum + (r.pointsEarned ?? 0), 0),
      pointsPossible: results.reduce((sum, r) => sum + (r.pointsPossible ?? 0), 0),
    };
  }, [allBlocksChecked, blockResults]);

  useEffect(() => {
    if (aggregateResult) onResult?.(aggregateResult);
  }, [aggregateResult, onResult]);

  async function submitBlock(blockIndex: number) {
    const blockQuestions = questionBlocks[blockIndex];
    const answer = blockQuestions.map((q) => ({
      questionId: q.id,
      value: answers[q.id] ?? "",
      hintUsed: hintShown.has(q.id),
    }));
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
      const result = (await res.json()) as OpenAnswerResult;
      setBlockResults((prev) => ({ ...prev, [blockIndex]: result }));
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
    const blockQuestions = questionBlocks[activeBlock];
    const blockResult = blockResults[activeBlock];
    const blockDetail = blockResult?.detail;
    const errMsg = blockError[activeBlock];

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-[22px]">
          {blockQuestions.map((q) =>
            renderQuestion(q, blockDetail?.questions.find((d) => d.id === q.id), !!blockResult)
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {blockResult && (
              <TaskResult
                correct={blockResult.correct}
                pointsEarned={blockResult.pointsEarned}
                pointsPossible={blockResult.pointsPossible}
                toggleTitle={TABLE_FILL_ANSWERS_TOGGLE_LABEL}
                toggleCount={blockDetail ? blockQuestions.length : undefined}
                hintSummary={{ hintCount: blockDetail?.questions.filter((q) => q.hintUsed).length ?? 0, reducesPoints: false }}
              >
                {blockDetail && <TaskResultGapRows rows={buildOpenAnswerRows(blockQuestions, blockDetail)} />}
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
      </div>
    );
  }

  // ЕТАП M — кнопка "Перевірити блок" для спільного рядка check+←/→
  // (BlockNavFooter) — ті самі значення, що читає renderBlock() вище.
  const activeBlockQuestions = questionBlocks[activeBlock];
  const activeBlockResult = blockResults[activeBlock];
  const activeBlockPending = !!blockPending[activeBlock];
  const activeBlockUnanswered =
    activeBlockQuestions?.filter((q) => !answers[q.id]?.trim()).length ?? 0;
  const checkButtonEl = useBlocks && !activeBlockResult ? (
    <button
      type="button"
      onClick={() => blockCheckConfirm.attemptCheck(activeBlockUnanswered, () => submitBlock(activeBlock))}
      disabled={activeBlockPending || activeBlockUnanswered === (activeBlockQuestions?.length ?? 0)}
      className="exercise-block-check-btn"
    >
      {activeBlockPending ? "Перевіряю..." : "Перевірити блок"}
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
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.open_answer.instruction}
        subInstructionText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.open_answer.subInstruction}
      />

      {!useBlocks ? (
        <>
          <div className="flex flex-col gap-[22px]">
            {config.questions.map((q) =>
              renderQuestion(q, detail?.questions.find((d) => d.id === q.id), !!single.result)
            )}
          </div>

          <div className="flex flex-col gap-3">
            {!single.result ? (
              <div className="flex flex-col items-start gap-2">
                <button
                  type="button"
                  onClick={() =>
                    singleCheckConfirm.attemptCheck(
                      config.questions.length - singleAnsweredCount,
                      submitSingle
                    )
                  }
                  disabled={single.pending || singleAnsweredCount === 0}
                  className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
                >
                  {single.pending ? "Перевіряю..." : "Перевірити"}
                </button>
                {singleCheckConfirm.confirming && (
                  <CheckConfirmBar
                    unansweredCount={config.questions.length - singleAnsweredCount}
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
                toggleCount={detail ? config.questions.length : undefined}
                hintSummary={{ hintCount: detail?.questions.filter((q) => q.hintUsed).length ?? 0, reducesPoints: false }}
              >
                {detail && <TaskResultGapRows rows={buildOpenAnswerRows(config.questions, detail)} />}
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
        </BlockNavigation>
      )}

      {diacritics.rect && diacritics.activeKey && (
        <DiacriticsPopup
          rect={diacritics.rect}
          onPick={(ch) => {
            const id = diacritics.activeKey!;
            const el = diacritics.getElement(id);
            const { value, cursor } = insertAtCursor(el, answers[id] ?? "", ch);
            setAnswers((prev) => ({ ...prev, [id]: value }));
            focusAndSetCursor(el, cursor);
          }}
        />
      )}

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
