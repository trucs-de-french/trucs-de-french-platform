"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { WordChoicePublic, WordChoiceDetail, WordChoiceAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { WORD_CHOICE_DEFAULT_INSTRUCTIONS, WORD_CHOICE_TRANSLATION_EN, taskTranslationLine } from "@/lib/exercises/default-instructions";
import { ITEM_CARD_WRAP } from "./answer-card-style";
import { frenchNbsp } from "@/lib/text/french-typography";
import { BUTTON_CHECK } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { TaskResult, TaskResultGapRows } from "./task-result";
import { headerPointsState } from "@/lib/exercises/header-points";
import { useT } from "@/lib/i18n/context";
import { plural } from "@/lib/i18n/plural";
import { CARD_BLOCK_MAX, splitEvenly } from "@/lib/exercises/exercise-blocks";
import { BlockNavigation, BlockTabs } from "./block-navigation";
import { usePracticeCheck } from "./use-practice-check";
import { STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { HintBulb } from "./hint-bulb";
import { hintExplanationText } from "./hint-explanation";
import { TaskPanelHeader } from "./task-panel-header";
import { useCheckConfirm, CheckConfirmBar } from "./check-confirm";

type SentenceDetail = WordChoiceDetail["sentences"][number];
type PublicSentence = WordChoicePublic["sentences"][number];
type WordChoiceResult = Extract<GradeResult, { detail: WordChoiceDetail }>;

// Плитки toggle-картки "Правильні відповіді" — речення з ВБУДОВАНОЮ
// правильною відповіддю замість літерального "{{}}" (раніше: "...{{}} —
// roi" — студент бачив сирий маркер; тепер: "...le roi de la savane.", де
// "roi" — зелена .task-result-gap-word плитка в самому реченні, без
// окремого "— слово"). Кілька правильних варіантів — ОДНА плитка,
// склеєна " / " (той самий принцип, що correctAnswers.join(" / ") у
// open-answer-check.tsx/table-fill.tsx), а не кома, як було.
function buildWordChoiceRows(
  sentences: PublicSentence[],
  detail: WordChoiceDetail,
  startIndex: number
): { number: number; parts: (string | { word: string })[] }[] {
  return sentences.map((s, i) => {
    const sentenceDetail = detail.sentences.find((d) => d.id === s.id);
    const correctOptions = sentenceDetail?.options.filter((o) => o.correct) ?? [];
    const [before, after] = s.sentence.split("{{}}");
    const parts: (string | { word: string })[] = [
      before,
      { word: correctOptions.map((o) => o.text).join(" / ") },
      after ?? "",
    ].filter((p) => p !== "");
    return { number: startIndex + i + 1, parts };
  });
}

// Режим практики "Робота над помилками" (пілот, частина 3) — лише
// помилкові ще не виправлені речення (onlyItemIds — sentence.id). Працює
// з обома режимами (select/cross_out) — sentenceAnswer() нижче вже зводить
// обидва до однієї форми, повторно використано без змін.
export type WordChoicePracticeProps = {
  onlyItemIds: string[];
  failedAttempts: Record<string, number>;
};

// Плитка-варіант усередині картки речення — крем/лавандові пілюлі
// (.word-choice-pill* у globals.css), лише тут (не спільний
// ANSWER_CARD_INLINE/glass-chip — ті й далі використовуються іншими
// вправами без змін).

export function WordChoiceExercise({
  taskId,
  config,
  plaqueText,
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
  const { t, lang } = useT();
  function optionsCountWord(n: number): string {
    if (lang === "uk") return n >= 5 ? "варіантів" : "варіанти";
    return plural(lang, n, { one: "option", other: "options" });
  }
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
  const singleCheckConfirm = useCheckConfirm();

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

  // "Відповідь дана" — той самий предикат, що раніше рахував лише allAnswered
  // (.every): тепер ще й рахує, СКІЛЬКИ речень не відповіли (N у
  // CheckConfirmBar), той самий критерій в обидва боки.
  function sentenceIsAnswered(s: PublicSentence) {
    return config.mode === "select"
      ? (selections[s.id] ?? []).length > 0
      : remainingOptions(
          s.id,
          s.options.map((o) => o.id)
        ).length > 0;
  }
  const answeredCount = config.sentences.filter(sentenceIsAnswered).length;

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
      // Той самий принцип, що multiple-choice.tsx — правильний завжди
      // зелений, хибний вибір студента — червоний — але тут ЩЕ й
      // розрізняємо "студент сам обрав правильний" (--correct, насиченіший
      // зелений) від "показано правильний, якого студент не обирав"
      // (--revealed, тихіший зелений) — multiple_choice цього розрізнення
      // не мав, тож нова пара класів лише тут.
      if (opt.correct && opt.selected) return "word-choice-pill--correct";
      if (opt.correct) return "word-choice-pill--revealed";
      if (opt.selected) return "word-choice-pill--wrong";
      return "word-choice-pill--default opacity-60";
    }
    if (config.mode === "cross_out") {
      const isCrossedOut = (crossedOut[sentenceId] ?? new Set()).has(optionId);
      return isCrossedOut ? "word-choice-pill--default opacity-60" : "word-choice-pill--default";
    }
    return (selections[sentenceId] ?? []).includes(optionId)
      ? "word-choice-pill--selected"
      : "word-choice-pill--default";
  }

  // aggregateCorrect — лише для гілки блоків (нижче), коли ВСІ блоки
  // перевірені хоч раз: чи вправа повністю правильна загалом. undefined —
  // "ще не рахувати" (детальніше в aggregateResult нижче).
  // Єдина пілюля балів (задача "єдина пілюля балів усюди"): до перевірки —
  // загальний бал вправи; після перевірки активного блоку/вправи — earned
  // sur possible ЦЬОГО блоку + статус-чіп.
  function headerPoints(activeResult: { pointsEarned?: number; pointsPossible?: number } | null | undefined) {
    if (hidePoints) return undefined;
    return headerPointsState(activeResult?.pointsPossible ?? config.points, activeResult?.pointsEarned, lang);
  }

  // Лише mode "select" — той самий принцип, що multiple-choice.tsx
  // ("2 варіанти" під реченням). У "cross_out" свідомо НЕ показується:
  // сама механіка (готовність = "хоч один лишився") вимагає, щоб студент
  // не знав наперед точну кількість правильних.
  function multiHint(s: PublicSentence) {
    if (config.mode !== "select" || !s.multiple) return null;
    return (
      <span className="ml-1 text-xs italic text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
        {t("wc.chooseOptionsCount", { n: s.correctCount, word: optionsCountWord(s.correctCount) })}
      </span>
    );
  }

  // globalIndex — нумерація (.item-number-badge) наскрізна по всій вправі
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
    const hintOpen = hasHintBulb && hintVisible.has(s.id);
    // Картка просто росте на висоту чипа, коли підказка відкрита — ніяких
    // min-height трюків (на відміну від попередньої версії з абсолютною
    // бульбашкою, яка потребувала зарезервованого простору).
    return (
      <div key={s.id} className={`${ITEM_CARD_WRAP} p-3 md:p-4`}>
      <div className="flex items-start gap-2.5">
        {config.sentences.length > 1 && (
          <span className="item-number-badge mt-1.5" aria-label={t("aria.sentence", { n: globalIndex + 1 })}>
            {globalIndex + 1}
          </span>
        )}
        {/* min-w-0 flex-1 тут (не на <p>) — колонка тексту+лампочки+чипа
            разом, щоб чип нижче міг лягти на всю ширину колонки, а не лише
            на ширину <p> в сусідньому flex-ряду. */}
        <div className="min-w-0 flex-1">
        {/* items-start — лампочка притиснута до ВЕРХУ першого рядка, не
            по центру всієї (можливо багаторядкової) <p>. shrink-0 на
            лампочці — вона фіксованої ширини, <p> забирає решту й сама
            переноситься, лампочка ніколи не йде на новий рядок (на
            відміну від старої inline-версії всередині <p>, яка саме тому
            й переносилась). */}
        <div className="flex items-start gap-1.5">
        {/* leading-[33px]: висота плитки (.word-choice-pill, globals.css) =
            26px line-height + 1.5px*2 рамка = 29px; +4px проміжок = 33px —
            фіксоване px-значення, не ratio, щоб не залежати від
            невідомого реального font-size <p>. */}
        <p className="min-w-0 flex-1 break-words leading-[33px] [overflow-wrap:anywhere]">
        {frenchNbsp(before.trimEnd())}
        {s.options.map((o, oi) => {
          const isLast = oi === s.options.length - 1;
          const glued = isLast && glueText.length > 0;
          return (
            // whitespace-nowrap ЗАВЖДИ (не лише glued) — плитка+слеш (і
            // остання плитка+розділовий знак) мають лишатись одним
            // нерозривним блоком: перенос рядка може статись лише ПІСЛЯ
            // слеша, ніколи перед ним ("/ mer" на початку рядка — п.2 задачі).
            <span key={o.id} className="inline-block whitespace-nowrap">
              <button
                type="button"
                onClick={() =>
                  config.mode === "select"
                    ? toggleSelection(s.id, o.id, s.multiple)
                    : toggleCrossedOut(s.id, o.id)
                }
                disabled={locked}
                className={`relative ${glued ? "ml-1 mr-0" : "mx-1"} inline-flex items-center gap-1 align-middle before:absolute before:inset-x-0 before:-inset-y-[5px] before:content-[''] disabled:cursor-not-allowed transition-colors word-choice-pill ${optionClass(s.id, o.id, sentenceDetail)}`}
              >
                {!sentenceDetail &&
                  config.mode === "cross_out" &&
                  (crossedOut[s.id] ?? new Set()).has(o.id) && <X size={12} />}
                <span className="break-words [overflow-wrap:anywhere]">{o.text}</span>
              </button>
              {oi < s.options.length - 1 && <span className="word-choice-slash">/</span>}
              {glued && frenchNbsp(glueText)}
            </span>
          );
        })}
        {frenchNbsp(restAfter)}
        {multiHint(s)}
        </p>
        {hasHintBulb && (
          <HintBulb
            state={hintShown.has(s.id) ? "used" : "available"}
            onClick={() => toggleHintVisible(s.id)}
            label={hintVisible.has(s.id) ? t("button.collapseHint") : t("button.showHint")}
            ariaExpanded={hintVisible.has(s.id)}
            className="mt-0.5 shrink-0"
          />
        )}
        </div>
        {/* Один чип підказки, той самий вигляд на всіх ширинах — у
            звичайному потоці під реченням, ліворуч (не absolute, без
            стрілки, без десктоп/мобільної розбіжності — попередня версія з
            бульбашкою+чипом прибрана, картка просто стає вищою на висоту
            чипа). role="status"/aria-live — єдиний елемент підказки, що
            існує, тож дублювання озвучення неможливе. */}
        {hintOpen && (
          <div role="status" aria-live="polite" className="word-choice-hint-chip">
            <HintBulb state="available" as="span" className="word-choice-hint-chip-bulb" />
            <span className="word-choice-hint-chip-text">{s.hint}</span>
          </div>
        )}
        </div>
      </div>
      </div>
    );
  }

  // ==== Гілка блоків (>5 речень) ====
  const [activeBlock, setActiveBlock] = useState(0);
  const blockCheckConfirm = useCheckConfirm();
  useEffect(() => {
    blockCheckConfirm.cancelCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlock]);
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
        throw new Error(body.error ?? t("error.checkFailed"));
      }
      const result = (await res.json()) as WordChoiceResult;
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
                toggleTitle={t("panel.correctAnswers")}
                toggleCount={blockDetail ? blockSentences.length : undefined}
                hintSummary={{
                  hintCount: blockDetail?.sentences.filter((s) => s.hintUsed).length ?? 0,
                  reducesPoints: config.hintsReducePoints,
                }}
              >
                {blockDetail && (
                  <TaskResultGapRows rows={buildWordChoiceRows(blockSentences, blockDetail, startIndex)} />
                )}
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
                        onClick={() => practiceCheck.reveal(s.id, true)}
                        disabled={!!practiceCheck.revealPending[s.id]}
                        className={STUDENT_BUTTON_SECONDARY_TOUCH}
                      >
                        {t("button.showAnswer")}
                      </button>
                    )}
                  </div>
                )}
                {itemRevealed && (
                  <p className="pl-1 text-xs italic text-amber-700 dark:text-amber-400">
                    {t("answer.correctAnswerLabel")} {itemRevealed.join(", ")}
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
            className={`self-start ${BUTTON_CHECK}`}
          >
            {practiceCheck.pending ? t("button.checking") : t("button.check")}
          </button>
          {practiceCheck.error && <p className="text-sm text-red-600 dark:text-red-400">{practiceCheck.error}</p>}
        </div>
      </div>
    );
  }

  const headerPointsResult = headerPoints(useBlocks ? blockResults[activeBlock] : single.result);
  // ЕТАП M — кнопка "Перевірити блок" для спільного рядка check+←/→
  // (BlockNavFooter) — ті самі значення, що читає renderBlock() вище.
  const activeBlockSentences = sentenceBlocks[activeBlock];
  const activeBlockResult = blockResults[activeBlock];
  const activeBlockPending = !!blockPending[activeBlock];
  const activeBlockUnanswered =
    activeBlockSentences?.filter((s) => !sentenceIsAnswered(s)).length ?? 0;
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
        pointsText={headerPointsResult?.pointsText}
      />
      <TaskPanelHeader
        blockCount={blockCount}
        activeBlock={activeBlock}
        onChangeBlock={setActiveBlock}
        isBlockChecked={(i) => i in blockResults}
        {...(headerPointsResult ?? {})}
        instructionText={config.instructions ?? WORD_CHOICE_DEFAULT_INSTRUCTIONS[config.mode].instruction}
        subInstructionText={taskTranslationLine(config.subInstructions, lang, {
          uk: WORD_CHOICE_DEFAULT_INSTRUCTIONS[config.mode].subInstruction,
          en: WORD_CHOICE_TRANSLATION_EN[config.mode],
        })}
        hintText={
          config.sentences.some((s) => s.hint)
            ? hintExplanationText("word_choice", lang)
            : null
        }
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
              <div className="flex flex-col items-start gap-2">
                <button
                  type="button"
                  onClick={() =>
                    singleCheckConfirm.attemptCheck(config.sentences.length - answeredCount, handleSubmit)
                  }
                  disabled={single.pending}
                  className={`self-start ${BUTTON_CHECK}`}
                >
                  {single.pending ? t("button.checking") : t("button.check")}
                </button>
                {singleCheckConfirm.confirming && (
                  <CheckConfirmBar
                    unansweredCount={config.sentences.length - answeredCount}
                    onConfirm={() => singleCheckConfirm.confirmCheck(handleSubmit)}
                    onCancel={singleCheckConfirm.cancelCheck}
                  />
                )}
              </div>
            ) : (
              <TaskResult
                correct={single.result.correct}
                pointsEarned={single.result.pointsEarned}
                pointsPossible={single.result.pointsPossible}
                toggleTitle={t("panel.correctAnswers")}
                toggleCount={detail ? config.sentences.length : undefined}
                hintSummary={{
                  hintCount: detail?.sentences.filter((s) => s.hintUsed).length ?? 0,
                  reducesPoints: config.hintsReducePoints,
                }}
              >
                {detail && <TaskResultGapRows rows={buildWordChoiceRows(config.sentences, detail, 0)} />}
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
    </div>
  );
}
