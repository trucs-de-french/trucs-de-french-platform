"use client";

import { useState, useEffect, useMemo } from "react";
import type { OpenAnswerPublic, OpenAnswerDetail, GradeResult } from "@/lib/exercises/types";
import { HintBulb } from "./hint-bulb";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { DiacriticsPopup, useDiacriticsPopup, insertAtCursor, focusAndSetCursor } from "./diacritics-popup";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { CompactAudioButton } from "./compact-audio-button";
import { ImageLightbox } from "./image-lightbox";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP } from "@/lib/spacing";
import { frenchNbsp } from "@/lib/text/french-typography";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";
import { CARD_BLOCK_MAX, splitEvenly } from "@/lib/exercises/exercise-blocks";
import { BlockNavigation } from "./block-navigation";

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
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: OpenAnswerPublic;
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
  const single = useExerciseCheck(taskId);
  const detail = single.result?.detail as OpenAnswerDetail | undefined;

  useEffect(() => {
    if (!useBlocks && single.result) onResult?.(single.result);
  }, [useBlocks, single.result, onResult]);

  function renderQuestion(q: PublicQuestion, qDetail: OpenAnswerDetail["questions"][number] | undefined, locked: boolean) {
    const hintVisible = hintShown.has(q.id);
    return (
      <div key={q.id}>
        <div className="flex items-start gap-3">
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
            {!hidePoints && (pointsVisible || qDetail) && (
              <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
                {qDetail
                  ? `${qDetail.isCorrect ? qDetail.points : 0}/${qDetail.points} ${pluralizePoints(qDetail.points)}`
                  : `${q.points} ${pluralizePoints(q.points)}`}
              </span>
            )}
          </p>
        </div>
        <div className="relative mt-1">
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
                : "border-gray-300 bg-white dark:border-neutral-600 dark:bg-neutral-800"
            }`}
            placeholder="Ваша відповідь..."
          />
          {q.hint && !locked && (
            <HintBulb
              size="sm"
              state={hintVisible ? "used" : "available"}
              onClick={() => showHint(q.id)}
              onMouseDown={(e) => e.preventDefault()}
              label={hintVisible ? q.hint : "Показати підказку"}
              className="!h-7 !w-7 absolute top-1/2 right-2 -translate-y-1/2"
            />
          )}
        </div>
        {q.hint && (
          <p className="mt-1.5 min-h-5 text-sm break-words text-neutral-600 dark:text-neutral-300">
            {hintVisible ? q.hint : ""}
          </p>
        )}
        {qDetail && !qDetail.isCorrect && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            Правильно: {qDetail.correctAnswers.join(" / ")}
          </p>
        )}
      </div>
    );
  }

  // ==== Гілка блоків (>5 питань) ====
  const [activeBlock, setActiveBlock] = useState(0);
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
    const isPending = !!blockPending[activeBlock];
    const errMsg = blockError[activeBlock];
    const blockAllAnswered = blockQuestions.every((q) => answers[q.id]?.trim());

    return (
      <div className="flex flex-col gap-3">
        <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP}`}>
          {blockQuestions.map((q) =>
            renderQuestion(q, blockDetail?.questions.find((d) => d.id === q.id), !!blockResult)
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
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.open_answer.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.open_answer.subInstruction}
      />

      {!useBlocks ? (
        <>
          <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP}`}>
            {config.questions.map((q) =>
              renderQuestion(q, detail?.questions.find((d) => d.id === q.id), !!single.result)
            )}
          </div>

          <div className="flex flex-col gap-3">
            {!single.result ? (
              <button
                type="button"
                onClick={() =>
                  single.submit(
                    config.questions.map((q) => ({
                      questionId: q.id,
                      value: answers[q.id] ?? "",
                      hintUsed: hintShown.has(q.id),
                    }))
                  )
                }
                disabled={single.pending || !config.questions.every((q) => answers[q.id]?.trim())}
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
