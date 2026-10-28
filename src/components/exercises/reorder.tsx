"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ReorderPublic, ReorderDetail, ReorderAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { usePracticeCheck } from "./use-practice-check";
import { WHOLE_TASK_ITEM_ID } from "@/lib/exercises/error-review";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { SortableTileRow } from "./sortable-tile-row";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { CompactAudioButton } from "./compact-audio-button";
import { ImageLightbox } from "./image-lightbox";
import { TaskPanelHeader } from "./task-panel-header";
import { BUTTON_CHECK, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS } from "./score-style";
import { TaskResult, RowPointsTab } from "./task-result";
import { CARD_BLOCK_MAX, splitEvenly } from "@/lib/exercises/exercise-blocks";
import { BlockNavigation, BlockTabs } from "./block-navigation";
import { HintBulb } from "./hint-bulb";
import { hintExplanationText } from "./hint-explanation";

type SequenceDetail = ReorderDetail["sequences"][number];
type ReorderResult = Extract<GradeResult, { detail: ReorderDetail }>;
type PublicSequence = ReorderPublic["sequences"][number];

// Режим практики "Робота над помилками" (пілот, частина 7, хвиля 3) —
// переробка ЦІЛОГО завдання (whole), на відміну від items-режиму
// (MatchingPracticeProps тощо, onlyItemIds): "елемент" тут один —
// WHOLE_TASK_ITEM_ID (error-review.ts), без розбиття на блоки (CARD_BLOCK_MAX
// нижче застосовується лише у звичайному проходженні, не в практиці —
// завдання повністю, навіть якщо послідовностей > CARD_BLOCK_MAX).
export type ReorderPracticeProps = { whole: true; failedAttempts: Record<string, number> };

// Один ряд плиток у перемішаному порядку — жодного окремого банку чи
// порожніх слотів (на відміну від drag_drop, де банк доречний через текст
// із пропусками). Сам DnD/click-move — у спільному SortableTileRow
// (той самий код, що й letter_rearrangement). Контрольований компонент —
// батько (ReorderExercise) тримає поточний порядок кожної послідовності.
function ReorderSequenceTiles({
  number,
  order,
  onChange,
  detail,
  correctOrder,
  activated,
  locked,
  points,
  pointsVisible,
  hidePoints,
  imageUrl,
  audioUrl,
  onOpenImage,
  hint,
  hintShown,
  hintVisible,
  onToggleHint,
}: {
  // Наскрізний номер речення (з повного config.sequences, не з активного
  // блоку) — той самий принцип, що cardNumber letter_gaps/numberOffset
  // table-fill: нумерація не перестрибує на 1 на кожному новому блоці.
  number: number;
  order: string[];
  onChange: (next: string[]) => void;
  detail?: SequenceDetail;
  // Присутній лише коли вчитель увімкнув liveFeedback (ReorderConfig,
  // sanitizeReorder) — правильний текст на кожну позицію, дає живе
  // підсвічування без запиту на сервер (той самий компроміс секретності,
  // що LetterGapsPublicWord.hiddenLetters).
  correctOrder?: string[];
  // Живе підсвічування активується лише ПІСЛЯ першої перестановки в цьому
  // реченні (onChange у батьківському ReorderExercise) — до того всі
  // плитки нейтральні, навіть якщо випадково стоять на правильних місцях
  // (ключується по sequenceId, не скидається подальшими перестановками).
  activated?: boolean;
  locked: boolean;
  points: number;
  pointsVisible: boolean;
  hidePoints?: boolean;
  imageUrl?: string;
  audioUrl?: string;
  onOpenImage: (src: string) => void;
  // Переклад речення українською (ReorderSequence.hint) — опційний, та сама
  // лампочка/стан, що multiple-choice.tsx (hintShown/hintVisible підняті в
  // батьківський ReorderExercise, щоб submit() міг прочитати hintShown при
  // сабміті). Відсутній узагалі в режимі практики (той самий принцип, що
  // showHintBulb=false multiple-choice.tsx) — батько просто не передає ці
  // пропси там.
  hint?: string;
  hintShown?: boolean;
  hintVisible?: boolean;
  onToggleHint?: () => void;
}) {
  // Пріоритет: після "Перевірити" — detail (авторитетний серверний
  // результат, той самий, що показує бали); до перевірки — якщо
  // liveFeedback увімкнено, порівнюємо ПОЗИЦІЙНО з correctOrder (той самий
  // принцип, що gradeReorder: studentOrder[i] === correctOrder[i]), наживо,
  // на кожен рендер (order — пропс, змінюється з кожним drag/click-move).
  function tileState(i: number): "correct" | "incorrect" | undefined {
    if (detail) return detail.items[i]?.isCorrect ? "correct" : "incorrect";
    if (correctOrder && activated) return order[i] === correctOrder[i] ? "correct" : "incorrect";
    return undefined;
  }

  // До перевірки — лише якщо pointsVisible; після — завжди. Бали
  // послідовності зараховуються, лише якщо ВСЯ вона правильна (не по
  // окремій плитці, як score) — 0/points, а не часткове.
  const sequenceCorrect = detail?.items.every((i) => i.isCorrect) ?? false;
  const showTab = !hidePoints && (pointsVisible || !!detail);

  const hasHintBulb = !!hint && !!onToggleHint;

  // Картка-рядок — та сама .glass-item-card (gold-gradient border, radius
  // 14px, тінь), що chrono-phrase-row (chronological_order) і Choix
  // multiple; бейдж+картинка в окремій групі зліва, лампочка підказки
  // (опційно) праворуч — обидві по центру всієї картки (items-center на
  // зовнішньому флексі), середня колонка (бали/плитки/підказка/правильний
  // порядок) займає решту ширини (flex-1 min-w-0), лампочка не забирає
  // місце в розкладці взагалі, коли підказки немає (умовний рендер, не
  // прихований елемент). Вкладка балів (RowPointsTab) — сусід картки в
  // .row-points-tab-wrap, не нащадок (деталі — task-result.tsx).
  return (
    <div className="row-points-tab-wrap">
      {showTab && (
        <RowPointsTab earned={detail ? (sequenceCorrect ? points : 0) : undefined} possible={points} />
      )}
      <div className="glass-item-card flex items-center gap-3.5 px-3.5 pt-4 pb-2.5 max-md:items-start max-md:gap-2.5 max-md:px-3 max-md:pt-[18px] max-md:pb-3">
        <div className="flex min-w-0 flex-1 items-center gap-3.5 max-md:flex-col max-md:items-stretch max-md:gap-2.5">
          <div className="flex shrink-0 items-center gap-2">
            <span className="item-number-badge shrink-0" aria-label={`Речення ${number}`}>
              {number}
            </span>
            {(imageUrl || audioUrl) && (
              <div className="flex shrink-0 items-center gap-2">
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => onOpenImage(imageUrl)}
                    aria-label="Показати картинку повністю"
                    className="shrink-0 cursor-zoom-in"
                  >
                    <ImageOrPlaceholder
                      src={imageUrl}
                      alt=""
                      className="h-14 w-14 rounded-xl border-[1.5px] border-[#d9b765] object-cover dark:border-[rgba(243,217,139,0.4)] md:h-11 md:w-11"
                      useFocus
                    />
                  </button>
                )}
                {audioUrl && <CompactAudioButton src={audioUrl} />}
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 max-md:w-full">
            <div className="min-h-11">
              <SortableTileRow
                items={order}
                onChange={onChange}
                locked={locked}
                tileState={tileState}
                extraContainerClassName="max-md:gap-x-2 max-md:gap-y-1.5"
                extraTileClassName="max-md:min-h-11 touch-manipulation"
              />
            </div>

            {hasHintBulb && hintVisible && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm break-words text-neutral-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-neutral-200">
                {hint}
              </div>
            )}

            {detail && (
              <p className="break-words text-sm text-neutral-600 dark:text-[var(--text-muted-caption)] [overflow-wrap:anywhere]">
                Правильний порядок:{" "}
                {[...detail.items]
                  .sort((a, b) => a.correctIndex - b.correctIndex)
                  .map((i) => i.text)
                  .join(" → ")}
              </p>
            )}
          </div>
        </div>
        {hasHintBulb && (
          <HintBulb
            state={hintShown ? "used" : "available"}
            onClick={onToggleHint}
            label={hintVisible ? "Згорнути підказку" : "Показати підказку"}
            className="shrink-0 max-md:min-h-11 max-md:min-w-11"
          />
        )}
      </div>
    </div>
  );
}

export function ReorderExercise({
  taskId,
  config,
  plaqueText,
  pointsVisible,
  onResult,
  hidePoints,
  practice,
}: {
  taskId: string;
  config: ReorderPublic;
  plaqueText?: string;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  practice?: ReorderPracticeProps;
}) {
  const [orders, setOrders] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(config.sequences.map((s) => [s.id, s.items]))
  );
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Живе підсвічування (liveFeedback, correctOrder) активується ПОЗА блоками
  // та по кожному реченню окремо — лише після першої перестановки в НЬОМУ
  // (не глобально для всього завдання). Стан піднятий сюди, вище
  // BlockNavigation/activeBlock, тому переживає перемикання блоків
  // (CARD_BLOCK_MAX) у межах одного рендеру компонента; скидається лише
  // разом з усім компонентом — новий mount (нова спроба практики
  // "Спробувати ще раз" в error-review-block.tsx — expanded false→true,
  // або перезавантаження сторінки) дає чистий useState знову.
  const [activated, setActivated] = useState<Record<string, boolean>>({});
  function activateSequence(id: string) {
    setActivated((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }

  // Підказка (лампочка переклад речення) — той самий принцип, що
  // multiple-choice.tsx: hintShown (перманентний, іде в answer як
  // hintUsed) і hintVisible (лише розкрито/згорнуто зараз), окремі стани.
  // Режим практики не рендерить лампочку взагалі (renderSequence нижче в
  // ньому не передається), тож ці стани там лишаються порожніми.
  const [hintShown, setHintShown] = useState<Set<string>>(new Set());
  const [hintVisible, setHintVisible] = useState<Set<string>>(new Set());
  function toggleHintVisible(seqId: string) {
    setHintShown((prev) => (prev.has(seqId) ? prev : new Set(prev).add(seqId)));
    setHintVisible((prev) => {
      const next = new Set(prev);
      if (next.has(seqId)) next.delete(seqId);
      else next.add(seqId);
      return next;
    });
  }

  // ==== Гілка практики (whole) — незалежна від блоків/single нижче:
  // завжди ВСІ послідовності одразу (config тут уже перемішаний сервером,
  // page.tsx: sanitizeConfigForStudent), без BlockNavigation.
  const isPractice = !!practice;
  const practiceCheck = usePracticeCheck(taskId);
  const [practiceOrders, setPracticeOrders] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(config.sequences.map((s) => [s.id, s.items]))
  );
  const [practiceDetail, setPracticeDetail] = useState<ReorderDetail | undefined>(undefined);
  const [practiceCorrect, setPracticeCorrect] = useState(false);
  const [practiceFailedAttempts, setPracticeFailedAttempts] = useState<Record<string, number>>(
    practice?.failedAttempts ?? {}
  );

  async function submitPractice() {
    const answer: ReorderAnswer = config.sequences.map((s) => ({
      sequenceId: s.id,
      order: practiceOrders[s.id] ?? [],
    }));
    const result = await practiceCheck.check([WHOLE_TASK_ITEM_ID], answer);
    if (!result) return;
    const correct = result.results[0]?.correct ?? false;
    setPracticeCorrect(correct);
    setPracticeDetail(result.detail as ReorderDetail | undefined);
    setPracticeFailedAttempts(result.failedAttempts);
    const attempts = result.failedAttempts[WHOLE_TASK_ITEM_ID] ?? 0;
    if (!correct && attempts >= 2 && !practiceCheck.revealed[WHOLE_TASK_ITEM_ID]) {
      practiceCheck.reveal(WHOLE_TASK_ITEM_ID, false);
    }
  }

  // Картки (послідовності) — поріг блоку CARD_BLOCK_MAX=5, той самий
  // принцип, що word-choice.tsx/multiple-choice.tsx/true-false.tsx
  // (exercise-blocks.ts, перша хвиля card-блоків). ≤5 послідовностей —
  // sequenceBlocks матиме РІВНО один чанк, useBlocks===false, нижче
  // рендериться ТОЧНО той самий код, що й до розбиття на блоки (на
  // наявних даних — до 4 послідовностей — нічого не змінюється).
  const sequenceBlocks = useMemo(() => splitEvenly(config.sequences, CARD_BLOCK_MAX), [config.sequences]);
  const blockCount = sequenceBlocks.length;
  const useBlocks = blockCount > 1;

  // ==== Гілка ≤5 послідовностей (незмінна поведінка) ====
  const router = useRouter();
  const single = useExerciseCheck(taskId);
  const detail = single.result?.detail as ReorderDetail | undefined;
  const singleLocked = !!single.result;

  useEffect(() => {
    if (!useBlocks && single.result) onResult?.(single.result);
  }, [useBlocks, single.result, onResult]);

  function renderSequence(seq: PublicSequence, seqDetail: SequenceDetail | undefined, locked: boolean) {
    // Наскрізний номер з ПОВНОГО config.sequences, не з активного блоку —
    // той самий принцип, що numberOffset table-fill/cardNumber letter_gaps.
    const number = config.sequences.findIndex((s) => s.id === seq.id) + 1;
    return (
      <ReorderSequenceTiles
        key={seq.id}
        number={number}
        order={orders[seq.id] ?? seq.items}
        onChange={(next) => {
          setOrders((prev) => ({ ...prev, [seq.id]: next }));
          activateSequence(seq.id);
        }}
        detail={seqDetail}
        correctOrder={seq.correctOrder}
        activated={!!activated[seq.id]}
        locked={locked}
        points={seq.points}
        pointsVisible={pointsVisible}
        hidePoints={hidePoints}
        imageUrl={seq.imageUrl}
        audioUrl={seq.audioUrl}
        onOpenImage={setLightboxSrc}
        hint={seq.hint}
        hintShown={hintShown.has(seq.id)}
        hintVisible={hintVisible.has(seq.id)}
        onToggleHint={() => toggleHintVisible(seq.id)}
      />
    );
  }

  // ==== Гілка блоків (>5 послідовностей) ====
  const [activeBlock, setActiveBlock] = useState(0);
  const [blockResults, setBlockResults] = useState<Record<number, ReorderResult>>({});
  const [blockPending, setBlockPending] = useState<Record<number, boolean>>({});
  const [blockError, setBlockError] = useState<Record<number, string | null>>({});

  const allBlocksChecked = useBlocks && blockCount > 0 && Object.keys(blockResults).length === blockCount;

  const aggregateResult: ReorderResult | null = useMemo(() => {
    if (!allBlocksChecked) return null;
    const results = Object.values(blockResults);
    const sequences = results.flatMap((r) => r.detail.sequences);
    const allItems = sequences.flatMap((s) => s.items);
    const correctCount = allItems.filter((i) => i.isCorrect).length;
    return {
      correct: allItems.length > 0 && correctCount === allItems.length,
      score: allItems.length > 0 ? Math.round((correctCount / allItems.length) * 100) : 0,
      detail: { sequences },
      pointsEarned: results.reduce((sum, r) => sum + (r.pointsEarned ?? 0), 0),
      pointsPossible: results.reduce((sum, r) => sum + (r.pointsPossible ?? 0), 0),
    };
  }, [allBlocksChecked, blockResults]);

  useEffect(() => {
    if (aggregateResult) onResult?.(aggregateResult);
  }, [aggregateResult, onResult]);

  async function submitBlock(blockIndex: number) {
    const blockSequences = sequenceBlocks[blockIndex];
    const answer = blockSequences.map((s) => ({
      sequenceId: s.id,
      order: orders[s.id] ?? [],
      hintUsed: hintShown.has(s.id),
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
      const result = (await res.json()) as ReorderResult;
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
    const blockSequences = sequenceBlocks[activeBlock];
    const blockResult = blockResults[activeBlock];
    const blockDetail = blockResult?.detail;
    const errMsg = blockError[activeBlock];

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-[22px] pt-3">
          {blockSequences.map((seq) =>
            renderSequence(seq, blockDetail?.sequences.find((d) => d.id === seq.id), !!blockResult)
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {blockResult && (
              <TaskResult
                correct={blockResult.correct}
                pointsEarned={blockResult.pointsEarned}
                pointsPossible={blockResult.pointsPossible}
                hintSummary={{
                  hintCount: blockDetail?.sequences.filter((s) => s.hintUsed).length ?? 0,
                  reducesPoints: config.hintsReducePoints,
                }}
              />
            )}
          </div>
          {errMsg && <p className="text-sm text-red-600 dark:text-red-400">{errMsg}</p>}
        </div>
      </div>
    );
  }

  if (isPractice) {
    const revealedAnswer = practiceCheck.revealed[WHOLE_TASK_ITEM_ID];
    const attempts = practiceFailedAttempts[WHOLE_TASK_ITEM_ID] ?? 0;
    return (
      <div className={EXERCISE_STACK}>
        {!practiceCorrect && (
          <p className="tap-swap-hint text-sm text-neutral-500 dark:text-[var(--text-muted-caption)]">
            Торкніться двох слів, щоб поміняти їх місцями
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          {config.sequences.map((seq, i) => (
            <ReorderSequenceTiles
              key={seq.id}
              number={i + 1}
              order={practiceOrders[seq.id] ?? seq.items}
              onChange={(next) => {
                setPracticeOrders((prev) => ({ ...prev, [seq.id]: next }));
                // Скидаємо підсвічування з попередньої перевірки — інакше
                // студент бачить застарілі зелені/червоні кольори після
                // того, як переставив слова знову, до наступного "Перевірити".
                setPracticeDetail(undefined);
                activateSequence(seq.id);
              }}
              detail={practiceDetail?.sequences.find((d) => d.id === seq.id)}
              correctOrder={seq.correctOrder}
              activated={!!activated[seq.id]}
              locked={practiceCorrect}
              points={seq.points}
              pointsVisible={false}
              hidePoints
              imageUrl={seq.imageUrl}
              audioUrl={seq.audioUrl}
              onOpenImage={setLightboxSrc}
            />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {!practiceCorrect && (
            <button
              type="button"
              onClick={submitPractice}
              disabled={practiceCheck.pending}
              className={`self-start ${BUTTON_CHECK}`}
            >
              {practiceCheck.pending ? "Перевіряю..." : "Перевірити"}
            </button>
          )}
          {practiceCorrect && (
            <p className={`${RESULT_MESSAGE_CLASS} text-green-600 dark:text-green-400`}>Правильно! ✓</p>
          )}
          {practiceDetail && !practiceCorrect && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-red-600 dark:text-red-400">
                Неправильно, спробуйте ще раз (спроб: {attempts})
              </span>
              {!revealedAnswer && (
                <button
                  type="button"
                  onClick={() => practiceCheck.reveal(WHOLE_TASK_ITEM_ID, true)}
                  disabled={!!practiceCheck.revealPending[WHOLE_TASK_ITEM_ID]}
                  className={STUDENT_BUTTON_SECONDARY_TOUCH}
                >
                  Показати відповідь
                </button>
              )}
            </div>
          )}
          {revealedAnswer && (
            <p className="text-sm italic text-amber-700 dark:text-amber-400">
              Правильний порядок: {revealedAnswer.join("; ")}
            </p>
          )}
          {practiceCheck.error && <p className="text-sm text-red-600 dark:text-red-400">{practiceCheck.error}</p>}
        </div>

        {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      </div>
    );
  }

  // ЕТАП M — кнопка "Перевірити блок" для спільного рядка check+←/→
  // (BlockNavFooter) — ті самі значення, що читає renderBlock() вище.
  const activeBlockResult = blockResults[activeBlock];
  const activeBlockPending = !!blockPending[activeBlock];
  const checkButtonEl = useBlocks && !activeBlockResult ? (
    <button
      type="button"
      onClick={() => submitBlock(activeBlock)}
      disabled={activeBlockPending}
      className="exercise-block-check-btn btn-check"
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
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.reorder.instruction}
        subInstructionText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.reorder.subInstruction}
        hintText={config.sequences.some((s) => s.hint) ? hintExplanationText("reorder") : null}
      />

      {!useBlocks ? (
        <>
          {!singleLocked && (
            <p className="tap-swap-hint text-sm text-neutral-500 dark:text-[var(--text-muted-caption)]">
              Торкніться двох слів, щоб поміняти їх місцями
            </p>
          )}

          <div className="flex flex-col gap-[22px] pt-3">
            {config.sequences.map((seq) =>
              renderSequence(seq, detail?.sequences.find((d) => d.id === seq.id), singleLocked)
            )}
          </div>

          <div className="flex flex-col gap-3">
            {!single.result ? (
              <button
                type="button"
                onClick={() =>
                  single.submit(
                    config.sequences.map((s) => ({
                      sequenceId: s.id,
                      order: orders[s.id] ?? [],
                      hintUsed: hintShown.has(s.id),
                    }))
                  )
                }
                disabled={single.pending}
                className={`self-start ${BUTTON_CHECK}`}
              >
                {single.pending ? "Перевіряю..." : "Перевірити"}
              </button>
            ) : (
              <TaskResult
                correct={single.result.correct}
                pointsEarned={single.result.pointsEarned}
                pointsPossible={single.result.pointsPossible}
                hintSummary={{
                  hintCount: detail?.sequences.filter((s) => s.hintUsed).length ?? 0,
                  reducesPoints: config.hintsReducePoints,
                }}
              />
            )}
            {single.error && <p className="text-sm text-red-600 dark:text-red-400">{single.error}</p>}
          </div>
        </>
      ) : (
        <>
          {!blockResults[activeBlock] && (
            <p className="tap-swap-hint text-sm text-neutral-500 dark:text-[var(--text-muted-caption)]">
              Торкніться двох слів, щоб поміняти їх місцями
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
          </BlockNavigation>
        </>
      )}

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
