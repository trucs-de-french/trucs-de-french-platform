"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { WordChoicePublic, WordChoiceDetail, WordChoiceAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { WORD_CHOICE_DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { ITEM_NUMBER_BADGE, ITEM_CARD_WRAP } from "./answer-card-style";
import { frenchNbsp } from "@/lib/text/french-typography";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { TaskResult } from "./task-result";
import { CARD_BLOCK_MAX, splitEvenly } from "@/lib/exercises/exercise-blocks";
import { BlockNavigation, BlockTabs } from "./block-navigation";
import { usePracticeCheck } from "./use-practice-check";
import { STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { HintBulb } from "./hint-bulb";
import { hintExplanationText } from "./hint-explanation";
import { TaskPanelHeader } from "./task-panel-header";

type SentenceDetail = WordChoiceDetail["sentences"][number];
type PublicSentence = WordChoicePublic["sentences"][number];
type WordChoiceResult = Extract<GradeResult, { detail: WordChoiceDetail }>;

// Режим практики "Робота над помилками" (пілот, частина 3) — лише
// помилкові ще не виправлені речення (onlyItemIds — sentence.id). Працює
// з обома режимами (select/cross_out) — sentenceAnswer() нижче вже зводить
// обидва до однієї форми, повторно використано без змін.
export type WordChoicePracticeProps = {
  onlyItemIds: string[];
  failedAttempts: Record<string, number>;
};

// Плитка-варіант усередині картки речення — колишній спільний
// ANSWER_CARD_INLINE (answer-card-style.ts) мав shadow-sm замість рамки:
// на тлі СТОРІНКИ це читалось, але тепер речення лежить на картці
// (ITEM_CARD_WRAP, той самий білий/neutral-800 фон, що в multiple_choice)
// — тінь на однаковому білому фоні картки губилась, а border-gray-100 з
// попереднього дефолтного стану теж був майже невидимий на білому. Тому
// локальні класи (не чіпають спільний ANSWER_CARD_INLINE/ANSWER_CARD_DEFAULT
// — вони й далі використовуються іншими вправами): явна рамка
// (border-gray-200/dark:border-neutral-600, та сама вимога, що в задачі
// для рамок картки) і фон, що відрізняється від фону картки в обох темах
// (neutral-50 / neutral-900, а не білий/neutral-800).
const TILE_INLINE_BASE = "rounded-md border-[1.5px] dark:border glass-gap-shadow px-1.5 py-0.5 transition-colors";
const TILE_DEFAULT =
  "glass-chip glass-chip-hover border-[#dcbd6e] bg-neutral-50 hover:bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-900/40 dark:hover:bg-neutral-900/60";

export function WordChoiceExercise({
  taskId,
  config,
  plaqueText,
  pointsVisible,
  onResult,
  hidePoints,
  practice,
}: {
  taskId: string;
  config: WordChoicePublic;
  plaqueText?: string;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  practice?: WordChoicePracticeProps;
}) {
  // mode === "select": обрані optionId на речення — множина (toggle),
  // не одне значення, бо речення може дозволяти кілька правильних.
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  // mode === "cross_out": Set закреслених (НЕправильних, на думку студента)
  // optionId на речення — "відповідь" виводиться з того, що лишилось.
  const [crossedOut, setCrossedOut] = useState<Record<string, Set<string>>>({});

  // Підказка вчительки (лампочка) — ДВА окремі стани, бо розкриття/
  // згортання має лишатись зворотним (UI), а факт "хоч раз показували"
  // для балів — НАЗАВЖДИ (той самий принцип, що translationHints/
  // hintedBlanks у fill-blank.tsx: лампочка "used" не повертається назад в
  // "available", навіть коли сам блок із текстом згорнуто).
  // hintShown — перманентний, іде в sentenceAnswer() нижче як hintUsed,
  // ніколи не видаляється. hintVisible — лише "розгорнуто зараз", клік
  // перемикає. Нічого не йде на сервер одразу (hint-текст уже в
  // публічному config) — лише в самому сабміті відповіді. Практика НЕ
  // використовує жоден із цих станів (showHintBulb=false у гілці
  // isPractice — лампочки вимкнені, нічого зберігати).
  const [hintShown, setHintShown] = useState<Set<string>>(new Set());
  const [hintVisible, setHintVisible] = useState<Set<string>>(new Set());
  function toggleHintVisible(sentenceId: string) {
    setHintShown((prev) => (prev.has(sentenceId) ? prev : new Set(prev).add(sentenceId)));
    setHintVisible((prev) => {
      const next = new Set(prev);
      if (next.has(sentenceId)) next.delete(sentenceId);
      else next.add(sentenceId);
      return next;
    });
  }

  // Картки (не слова/пари) — поріг блоку CARD_BLOCK_MAX=5, нижчий за
  // EXERCISE_BLOCK_SIZE=10 (exercise-blocks.ts, перша хвиля card-блоків,
  // той самий принцип розбиття, що там для matching: позиційне, РІВНОМІРНЕ,
  // ключ блоку String(blockIndex)). ≤5 речень — sentenceBlocks матиме РІВНО
  // один чанк, useBlocks===false, і нижче рендериться ТОЧНО той самий код,
  // що був до розбиття на блоки — свідомо окрема гілка, щоб вигляд/
  // поведінка наявних коротких вправ не залежали від логіки блоків узагалі.
  const sentenceBlocks = useMemo(() => splitEvenly(config.sentences, CARD_BLOCK_MAX), [config.sentences]);
  const blockCount = sentenceBlocks.length;
  const useBlocks = blockCount > 1;

  // ==== Гілка ≤5 речень (незмінна поведінка) ====
  const router = useRouter();
  const single = useExerciseCheck(taskId);
  const detail = single.result?.detail as WordChoiceDetail | undefined;
  const locked = !!single.result;

  useEffect(() => {
    if (!useBlocks && single.result) onResult?.(single.result);
  }, [useBlocks, single.result, onResult]);

  // ==== Гілка практики (onlyItemIds) — незалежна від useBlocks/single
  // вище: завжди плаский список, без BlockNavigation. locked лишається
  // false (single.result завжди null у практиці — single.submit тут не
  // викликається), тож toggleSelection/toggleCrossedOut і далі працюють.
  const isPractice = !!practice;
  const practiceSentences = isPractice
    ? config.sentences.filter((s) => practice!.onlyItemIds.includes(s.id))
    : [];
  const originalIndexOf = new Map(config.sentences.map((s, i) => [s.id, i]));
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
    const answer: WordChoiceAnswer = practiceSentences.map(sentenceAnswer);
    const result = await practiceCheck.check(
      practiceSentences.map((s) => s.id),
      answer
    );
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

  const practiceAllAnswered = practiceSentences.every((s) =>
    config.mode === "select"
      ? (selections[s.id] ?? []).length > 0
      : remainingOptions(
          s.id,
          s.options.map((o) => o.id)
        ).length > 0
  );

  function toggleSelection(sentenceId: string, optionId: string, multiple: boolean) {
    if (locked) return;
    setSelections((prev) => {
      const current = prev[sentenceId] ?? [];
      const next = multiple
        ? current.includes(optionId)
          ? current.filter((v) => v !== optionId)
          : [...current, optionId]
        : [optionId];
      return { ...prev, [sentenceId]: next };
    });
  }

  function toggleCrossedOut(sentenceId: string, optionId: string) {
    if (locked) return;
    setCrossedOut((prev) => {
      const current = new Set(prev[sentenceId] ?? []);
      if (current.has(optionId)) current.delete(optionId);
      else current.add(optionId);
      return { ...prev, [sentenceId]: current };
    });
  }

  // У cross_out — "обрані" варіанти виводяться з того, що лишилось
  // незакресленим. Готовність = лишився хоч ОДИН (не точна кількість —
  // студент не повинен наперед знати, скільки правильних).
  function remainingOptions(sentenceId: string, optionIds: string[]): string[] {
    const crossed = crossedOut[sentenceId] ?? new Set<string>();
    return optionIds.filter((id) => !crossed.has(id));
  }

  const allAnswered = config.sentences.every((s) =>
    config.mode === "select"
      ? (selections[s.id] ?? []).length > 0
      : remainingOptions(
          s.id,
          s.options.map((o) => o.id)
        ).length > 0
  );

  function sentenceAnswer(s: PublicSentence) {
    return {
      sentenceId: s.id,
      selected:
        config.mode === "select"
          ? (selections[s.id] ?? [])
          : remainingOptions(
              s.id,
              s.options.map((o) => o.id)
            ),
      hintUsed: hintShown.has(s.id),
    };
  }

  function handleSubmit() {
    const answer: WordChoiceAnswer = config.sentences.map(sentenceAnswer);
    single.submit(answer);
  }

  function optionClass(sentenceId: string, optionId: string, sentenceDetail?: SentenceDetail) {
    if (sentenceDetail) {
      const opt = sentenceDetail.options.find((o) => o.id === optionId);
      if (!opt) return "";
      // Той самий принцип, що multiple-choice.tsx: правильний варіант
      // завжди зелений, червоним — лише хибний вибір студента.
      if (opt.correct) return "border-green-500 bg-green-50 dark:bg-green-950/30";
      if (opt.selected) return "border-red-500 bg-red-50 dark:bg-red-950/30";
      return `${TILE_DEFAULT} opacity-60`;
    }
    if (config.mode === "cross_out") {
      const isCrossedOut = (crossedOut[sentenceId] ?? new Set()).has(optionId);
      return isCrossedOut ? `${TILE_DEFAULT} text-neutral-400 opacity-60 dark:text-neutral-500` : TILE_DEFAULT;
    }
    return (selections[sentenceId] ?? []).includes(optionId) ? SELECTED_OPTION_CLASS : TILE_DEFAULT;
  }

  // aggregateCorrect — лише для гілки блоків (нижче), коли ВСІ блоки
  // перевірені хоч раз: чи вправа повністю правильна загалом. undefined —
  // "ще не рахувати" (детальніше в aggregateResult нижче).
  function pointsText(detailPresent: boolean, aggregateCorrect?: boolean): string | undefined {
    if (hidePoints || !(pointsVisible || detailPresent)) return undefined;
    return detailPresent
      ? `${aggregateCorrect ? config.points : 0}/${config.points} ${pluralizePoints(config.points)}`
      : `${config.points} ${pluralizePoints(config.points)}`;
  }

  // Лише mode "select" — той самий принцип, що multiple-choice.tsx
  // ("2 варіанти" під реченням). У "cross_out" свідомо НЕ показується:
  // сама механіка (готовність = "хоч один лишився") вимагає, щоб студент
  // не знав наперед точну кількість правильних.
  function multiHint(s: PublicSentence) {
    if (config.mode !== "select" || !s.multiple) return null;
    return (
      <span className="ml-1 text-xs italic text-neutral-500 dark:text-neutral-400">
        (оберіть {s.correctCount} {s.correctCount >= 5 ? "варіантів" : "варіанти"})
      </span>
    );
  }

  // globalIndex — нумерація (ITEM_NUMBER_BADGE) наскрізна по всій вправі
  // (не локальна в межах блоку): картка №6 у другому блоці показує "6", не
  // "1" — викликач передає позицію в config.sentences, не в межах блоку.
  // showHintBulb — false лише в гілці практики (вимкнено нижче, п.6
  // задачі): лампочка не рендериться взагалі, hintShown лишається порожнім,
  // sentenceAnswer() там і так завжди дає hintUsed:false.
  function renderSentenceCard(
    s: PublicSentence,
    globalIndex: number,
    sentenceDetail: SentenceDetail | undefined,
    showHintBulb = true
  ) {
    const [before, after] = s.sentence.split("{{}}");
    // Розділовий знак одразу після плитки (". , ; : ! ? ) » …") не
    // повинен переноситись окремим рядком через [overflow-wrap:anywhere]
    // на <p> — виносимо його з "after" і клеїмо до ОСТАННЬОЇ плитки
    // в один whitespace-nowrap блок (нижче), без розділового mx-1.
    const trimmedAfter = (after ?? "").trimStart();
    const glueMatch = trimmedAfter.match(/^[.,;:!?)»…]+/);
    const glueText = glueMatch ? glueMatch[0] : "";
    const restAfter = glueText ? trimmedAfter.slice(glueText.length) : trimmedAfter;
    const hasHintBulb = showHintBulb && !!s.hint;
    return (
      <div key={s.id} className={`${ITEM_CARD_WRAP} p-3 md:p-4`}>
      <div className="flex items-start gap-2.5">
        {config.sentences.length > 1 && (
          <span className={`mt-1.5 ${ITEM_NUMBER_BADGE}`} aria-hidden="true">
            {globalIndex + 1}
          </span>
        )}
        {/* min-w-0 flex-1 тут (не на <p>) — колонка тексту+лампочки разом,
            щоб жовтий блок підказки нижче міг лягти на всю її ширину, а не
            лише на ширину <p> в сусідньому flex-ряду. */}
        <div className="min-w-0 flex-1">
        {/* items-start — лампочка притиснута до ВЕРХУ першого рядка, не
            по центру всієї (можливо багаторядкової) <p>. shrink-0 на
            лампочці — вона фіксованої ширини, <p> забирає решту й сама
            переноситься, лампочка ніколи не йде на новий рядок (на
            відміну від старої inline-версії всередині <p>, яка саме тому
            й переносилась). */}
        <div className="flex items-start gap-1.5">
        <p className="min-w-0 flex-1 break-words leading-[1.625rem] [overflow-wrap:anywhere]">
        {frenchNbsp(before.trimEnd())}
        {s.options.map((o, oi) => {
          const isLast = oi === s.options.length - 1;
          const glued = isLast && glueText.length > 0;
          return (
            <span key={o.id} className={glued ? "inline-block whitespace-nowrap" : undefined}>
              <button
                type="button"
                onClick={() =>
                  config.mode === "select"
                    ? toggleSelection(s.id, o.id, s.multiple)
                    : toggleCrossedOut(s.id, o.id)
                }
                disabled={locked}
                className={`relative ${glued ? "ml-1 mr-0" : "mx-1"} inline-flex items-center gap-1 align-middle leading-6 before:absolute before:inset-x-0 before:-inset-y-[5px] before:content-[''] disabled:cursor-not-allowed ${TILE_INLINE_BASE} ${optionClass(s.id, o.id, sentenceDetail)}`}
              >
                {!sentenceDetail &&
                  config.mode === "cross_out" &&
                  (crossedOut[s.id] ?? new Set()).has(o.id) && <X size={12} />}
                <span className="break-words [overflow-wrap:anywhere]">{o.text}</span>
              </button>
              {oi < s.options.length - 1 && (
                <span className="text-neutral-400 dark:text-neutral-500">/</span>
              )}
              {glued && frenchNbsp(glueText)}
            </span>
          );
        })}
        {frenchNbsp(restAfter)}
        {multiHint(s)}
        </p>
        {hasHintBulb && (
          <HintBulb
            size="sm"
            state={hintShown.has(s.id) ? "used" : "available"}
            onClick={() => toggleHintVisible(s.id)}
            label={hintVisible.has(s.id) ? "Згорнути підказку" : "Показати підказку"}
            className="mt-0.5 shrink-0"
          />
        )}
        </div>
        {/* У потоці картки (не absolute) — повторний клік на лампочці
            згортає цей блок назад, isCorrect/hintUsed для балів незалежні
            від hintVisible (hintShown окремий, перманентний стан вище). */}
        {hasHintBulb && hintVisible.has(s.id) && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm break-words text-neutral-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-neutral-200">
            {s.hint}
          </div>
        )}
        </div>
      </div>
      </div>
    );
  }

  // ==== Гілка блоків (>5 речень) ====
  const [activeBlock, setActiveBlock] = useState(0);
  const [blockResults, setBlockResults] = useState<Record<number, WordChoiceResult>>({});
  const [blockPending, setBlockPending] = useState<Record<number, boolean>>({});
  const [blockError, setBlockError] = useState<Record<number, string | null>>({});

  const allBlocksChecked = useBlocks && blockCount > 0 && Object.keys(blockResults).length === blockCount;

  // Сумарний результат — лише коли ВСІ блоки перевірені хоч раз (той самий
  // принцип, що matching.tsx aggregateResult): correctCount/score рахуються
  // наскрізно по всіх реченнях усіх блоків, pointsEarned/pointsPossible —
  // прямі суми (кожен блок уже дав свою коректно округлену частку, сума
  // блоків завжди точно дорівнює config.points — blockPointsPossibleByWeights
  // у grade.ts).
  const aggregateResult: WordChoiceResult | null = useMemo(() => {
    if (!allBlocksChecked) return null;
    const results = Object.values(blockResults);
    const sentences = results.flatMap((r) => r.detail.sentences);
    const correctCount = sentences.filter((s) => s.isCorrect).length;
    return {
      correct: sentences.length > 0 && correctCount === sentences.length,
      score: sentences.length > 0 ? Math.round((correctCount / sentences.length) * 100) : 0,
      detail: { sentences },
      pointsEarned: results.reduce((sum, r) => sum + (r.pointsEarned ?? 0), 0),
      pointsPossible: results.reduce((sum, r) => sum + (r.pointsPossible ?? 0), 0),
    };
  }, [allBlocksChecked, blockResults]);

  useEffect(() => {
    if (aggregateResult) onResult?.(aggregateResult);
  }, [aggregateResult, onResult]);

  async function submitBlock(blockIndex: number) {
    const blockSentences = sentenceBlocks[blockIndex];
    const answer: WordChoiceAnswer = blockSentences.map(sentenceAnswer);
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
      const result = (await res.json()) as WordChoiceResult;
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
    const blockSentences = sentenceBlocks[activeBlock];
    const startIndex = sentenceBlocks.slice(0, activeBlock).reduce((sum, b) => sum + b.length, 0);
    const blockResult = blockResults[activeBlock];
    const blockDetail = blockResult?.detail;
    const errMsg = blockError[activeBlock];

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:gap-4">
          {blockSentences.map((s, i) => {
            const sentenceDetail = blockDetail?.sentences.find((d) => d.id === s.id);
            return renderSentenceCard(s, startIndex + i, sentenceDetail);
          })}
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
          {errMsg && <p className="text-sm text-red-600 dark:text-red-400">{errMsg}</p>}
        </div>
      </div>
    );
  }

  if (isPractice) {
    return (
      <div className={EXERCISE_STACK}>
        <div className="flex flex-col gap-3 md:gap-4">
          {practiceSentences.map((s) => {
            const idx = originalIndexOf.get(s.id)!;
            const isCorrect = practiceResults[s.id];
            const attempts = practiceFailedAttempts[s.id] ?? 0;
            const itemRevealed = practiceCheck.revealed[s.id];
            return (
              <div key={s.id} className="flex flex-col gap-1.5">
                {renderSentenceCard(s, idx, undefined, false)}
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
                        onClick={() => practiceCheck.reveal(s.id, true)}
                        disabled={!!practiceCheck.revealPending[s.id]}
                        className={STUDENT_BUTTON_SECONDARY_TOUCH}
                      >
                        Показати відповідь
                      </button>
                    )}
                  </div>
                )}
                {itemRevealed && (
                  <p className="pl-1 text-xs italic text-amber-700 dark:text-amber-400">
                    Правильна відповідь: {itemRevealed.join(", ")}
                  </p>
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

  const pointsPillText = pointsText(
    useBlocks ? !!aggregateResult : !!detail,
    useBlocks ? aggregateResult?.correct : single.result?.correct
  );
  // ЕТАП M — кнопка "Перевірити блок" для спільного рядка check+←/→
  // (BlockNavFooter) — ті самі значення, що читає renderBlock() вище.
  const activeBlockSentences = sentenceBlocks[activeBlock];
  const activeBlockResult = blockResults[activeBlock];
  const activeBlockPending = !!blockPending[activeBlock];
  const activeBlockAllAnswered = activeBlockSentences?.every((s) =>
    config.mode === "select"
      ? (selections[s.id] ?? []).length > 0
      : remainingOptions(
          s.id,
          s.options.map((o) => o.id)
        ).length > 0
  );
  const checkButtonEl = useBlocks ? (
    <button
      type="button"
      onClick={() => submitBlock(activeBlock)}
      disabled={activeBlockPending || !activeBlockAllAnswered}
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
        pointsText={pointsPillText}
      />
      <TaskPanelHeader
        blockCount={blockCount}
        activeBlock={activeBlock}
        onChangeBlock={setActiveBlock}
        isBlockChecked={(i) => i in blockResults}
        pointsText={pointsPillText}
        instructionText={config.instructions ?? WORD_CHOICE_DEFAULT_INSTRUCTIONS[config.mode].instruction}
        subInstructionText={config.subInstructions ?? WORD_CHOICE_DEFAULT_INSTRUCTIONS[config.mode].subInstruction}
        hintText={config.sentences.some((s) => s.hint) ? hintExplanationText("word_choice", config.hintsReducePoints) : null}
      />

      {!useBlocks ? (
        <>
          {/* gap-3 md:gap-4 — не спільний EXERCISE_BODY_ITEMS_GAP (gap-4
              завжди): тут кожне речення тепер окрема картка (ITEM_CARD_WRAP),
              а не рядок без рамки, тож на мобільній трохи щільніший
              проміжок між картками — явна вимога задачі, не випадковий
              відхід від спільної константи. */}
          <div className="flex flex-col gap-3 md:gap-4">
            {config.sentences.map((s, si) =>
              renderSentenceCard(s, si, detail?.sentences.find((d) => d.id === s.id))
            )}
          </div>

          <div className="flex flex-col gap-3">
            {!single.result ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={single.pending || !allAnswered}
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
        </BlockNavigation>
      )}
    </div>
  );
}
