"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MatchingPublic, MatchingDetail, MatchingAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { usePracticeCheck } from "./use-practice-check";
import { DEFAULT_INSTRUCTIONS, DEFAULT_TRANSLATION_EN, taskTranslationLine } from "@/lib/exercises/default-instructions";
import { TaskPanelHeader } from "./task-panel-header";
import { MatchingBoard } from "./matching-board";
import { BUTTON_CHECK } from "@/lib/button-styles";
import { EXERCISE_STACK, RESULT_ROW_GAP_CLASS } from "@/lib/spacing";
import { chunkMatchingPairs } from "@/lib/exercises/exercise-blocks";
import { TaskResult, TaskResultPairRows } from "./task-result";
import { headerPointsState } from "@/lib/exercises/header-points";
import { BlockNavigation, BlockTabs } from "./block-navigation";
import { useCheckConfirm, CheckConfirmBar } from "./check-confirm";
import { useT } from "@/lib/i18n/context";
import { buildMatchingPairRowsFromReveal } from "@/lib/exercises/format-reveal-answer";
import { stillWrongIds, maxFailedAttempts, pruneStaleResults } from "@/lib/exercises/error-review";
import { PracticeAttemptFooter } from "./practice-attempt-footer";

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
  // Сцена-вигляд (openMode="scene", мистейки-сторінка, крок 4) — лише
  // error-review-block.tsx передає. Фікс "pre-corrected pairs напіввирішені"
  // (owner report) — config.left/right/pairs тепер скоуплені сервером
  // (scene-error-review.ts) на review.remainingItemIds (ЖИВИЙ, звужується
  // після кожної перевірки), НЕ review.wrongItemIds (був раніше, ПОВНИЙ,
  // ніколи не звужуваний): пари, виправлені ДО відкриття, взагалі не
  // потрапляють у config узагалі. Стабільність блоків У ЦІЙ сесії (щойно
  // виправлена пара не зникає з дошки одразу після router.refresh())
  // забезпечує сам matching.tsx — frozenSceneConfig нижче заморожує
  // ПЕРШИЙ отриманий config.left/right/pairs на монтуванні компонента
  // (той самий принцип "знімок на момент відкриття", що snapshot у
  // error-review-block.tsx для інших 3 типів, лише тут заморожується
  // увесь зріз конфіга, не просто список id — right не прив'язаний до
  // left публічно (секрет), клієнт не може сам дофільтрувати config.right
  // за id-списком, лише заморозити те, що сервер уже прислав). onlyItemIds
  // вище лишається лише для реакції на зміну набору (onlyItemIdsKey
  // нижче) — плашка+заголовок+блоки заміняють плаский список пар.
  // correctedItemIds — тепер завжди порожній для matching (config уже не
  // містить виправлених пар узагалі, нічого седити як "вирішене"), рахунок
  // лишається в error-review-block.tsx незмінним (безпечний no-op, не
  // видалено звідти заради найменшої зміни). Інлайн-картка сцени
  // (error_correction, без цього поля) лишається пласким списком без
  // плашки, НЕЗМІННО — її власний config.left/right скоуплений на
  // remainingItemIds теж, але БЕЗ заморожування (сторінка сцени, не
  // торкається цього фіксу).
  scene?: { correctedItemIds: string[] };
};

export function MatchingExercise({
  taskId,
  config,
  plaqueText,
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
  const { t, lang } = useT();
  const router = useRouter();

  // pairs/selectedLeft — СПІЛЬНІ на всю вправу (не по блоку): блок лише
  // фільтрує, які left/right видно й до яких прив'язана поточна дія click,
  // сама мапа відповідей одна на всі блоки (як і раніше для ≤10 елементів,
  // де "блок" один і збігається з усією вправою).
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);

  // ПАРА — 2 елементи, звідси chunkMatchingPairs (exercise-blocks.ts:
  // групи по 5 пар, з правилом "залишок рівно 1 -> зливається в попередню
  // групу", задача "unify matching group splitting, no singleton rule" —
  // ЄДИНИЙ спільний helper, той самий скрізь у цьому файлі). ≤5 пар —
  // leftBlocks матиме РІВНО один чанк, useBlocks === false, і нижче
  // рендериться ТОЧНО той самий код, що був до розбиття на блоки (окрема
  // гілка, не перевикористання спільного рендера з блоками) — свідомо, щоб
  // вигляд/поведінка наявних коротких вправ не залежали від логіки блоків
  // узагалі.
  const leftBlocks = useMemo(() => chunkMatchingPairs(config.left), [config.left]);
  const rightBlocks = useMemo(() => chunkMatchingPairs(config.right), [config.right]);
  const blockCount = leftBlocks.length;
  const useBlocks = blockCount > 1;

  // ==== Гілка ≤10 елементів (незмінна поведінка) ====
  const single = useExerciseCheck(taskId);
  const singleDetail = single.result?.detail as MatchingDetail | undefined;
  const singleCheckConfirm = useCheckConfirm();
  // Кожен left — завжди в answer (right:"" для непарного), той самий
  // принцип, що submitBlock нижче.
  function submitSingle() {
    single.submit(config.left.map((left) => ({ left, right: pairs[left] ?? "" })));
  }

  useEffect(() => {
    if (!useBlocks && single.result) onResult?.(single.result);
  }, [useBlocks, single.result, onResult]);

  // ==== Гілка практики (onlyItemIds) — незалежна від useBlocks/single
  // вище: завжди один "блок" (config тут уже звужений сервером до пар
  // review.remainingItemIds, page.tsx: sanitizeMatchingForPractice), без
  // BlockNavigation.
  const isPractice = !!practice;
  const isSceneMode = !!practice?.scene;
  // Фікс "pre-corrected pairs напіввирішені" (owner report, сцена-вигляд) —
  // заморожений на монтуванні зріз config.left/right/pairs, а не живий
  // config: scene-error-review.ts тепер масштабує matching-конфіг під
  // review.remainingItemIds (ЖИВИЙ, звужується після кожної перевірки в
  // цій сесії), а не під ПОВНИЙ, ніколи не звужуваний wrongItemIds
  // (MatchingPracticeProps вище). Заморожуючи тут (а не лишаючи сервер на
  // ПОВНОМУ пулі, як раніше) отримуємо ОБИДВА: пари, виправлені ДО
  // відкриття, взагалі не потрапляють у заморожений зріз (бо їх уже нема
  // в ПЕРШОМУ, живому remainingItemIds, з якого сервер будує конфіг саме
  // на монтуванні компонента); пари, виправлені ПІД ЧАС цієї сесії,
  // лишаються в замороженому зрізі (і далі показуються "вирішеними" —
  // practiceResultByLeft/practicePairs нижче, незалежні від конфіга) —
  // заморожений зріз просто не оновлюється пізнішими router.refresh() (та
  // сама ідея, що snapshot у error-review-block.tsx для інших 3 типів,
  // лише тут заморожується увесь зріз конфіга, не просто список id).
  // Реopen (закрити й знову відкрити цю саму задачу) ремонтує компонент
  // (expandedTaskId-перехід в ErrorReviewBlock) — заморозка береться
  // наново, свіжа. Флет-режим (isSceneMode===false) — null, завжди
  // читає живий config напряму, той самий принцип, що раніше.
  const [frozenSceneConfig] = useState<{ left: string[]; right: string[]; pairs: MatchingPublic["pairs"] } | null>(
    () => (isSceneMode ? { left: config.left, right: config.right, pairs: config.pairs } : null)
  );
  // idByLeft/leftById — локальна адресація між left-текстом (яким керують
  // клік-хендлери) і pair.id (яким адресуються practice/check,
  // practice/reveal і failedAttempts/revealed). Сцена-вигляд читає із
  // замороженого зрізу вище (не живого config.pairs), інакше ці мапи
  // звужувались би слідом за живим config на кожному router.refresh(), і
  // activeItemIds (нижче, submitPractice) загубив би id щойно виправленої
  // в ЦІЙ сесії пари, щойно вона випала б із НОВОГО (живого) config.pairs.
  const effectivePairs = frozenSceneConfig?.pairs ?? config.pairs;
  const idByLeft = useMemo(() => new Map(effectivePairs.map((p) => [p.left, p.id])), [effectivePairs]);
  const leftById = useMemo(() => new Map(effectivePairs.map((p) => [p.id, p.left])), [effectivePairs]);
  const [practicePairs, setPracticePairs] = useState<Record<string, string>>({});
  const [selectedLeftPractice, setSelectedLeftPractice] = useState<string | null>(null);
  // Сцена-вигляд (крок 4) — попередньо "вирішені" ліві елементи
  // (виправлені ПІСЛЯ знімку onlyItemIds, practice.scene.correctedItemIds
  // — pair.id, мапуються на left-текст через leftById вище) засіюються як
  // correct:true одразу при монтуванні — та сама зелена підсвітка на
  // MatchingBoard, що й щойно перевірена пара. Для matching тепер завжди
  // порожній набір (config уже не містить виправлених ДО відкриття пар
  // узагалі, error-review-block.tsx — нічого седити), лишено як
  // безпечний no-op, не найменша зміна.
  const [practiceResultByLeft, setPracticeResultByLeft] = useState<Record<string, boolean>>(() => {
    const seed: Record<string, boolean> = {};
    for (const id of practice?.scene?.correctedItemIds ?? []) {
      const left = leftById.get(id);
      if (left) seed[left] = true;
    }
    return seed;
  });
  const [practiceFailedAttempts, setPracticeFailedAttempts] = useState<Record<string, number>>(
    practice?.failedAttempts ?? {}
  );
  const practiceCheck = usePracticeCheck(taskId);
  const onlyItemIdsKey = practice?.onlyItemIds.join(",") ?? "";
  const [prevOnlyItemIdsKey, setPrevOnlyItemIdsKey] = useState(onlyItemIdsKey);
  if (isPractice && onlyItemIdsKey !== prevOnlyItemIdsKey) {
    setPrevOnlyItemIdsKey(onlyItemIdsKey);
    // practiceResultByLeft keys on LEFT TEXT, not pair id (onlyItemIds вище) —
    // чистимо за frozenSceneConfig.left (сцена-вигляд, заморожений) чи
    // config.left (флет, живий, уже скоуплений сервером) — той самий
    // набір лівих, що й leftItems, рендерені зараз, лише правильний ключ
    // для цього state.
    setPracticeResultByLeft((prev) => pruneStaleResults(prev, frozenSceneConfig?.left ?? config.left));
  }

  // Сцена-вигляд (крок 4) — блоки по чанках chunkMatchingPairs, той самий
  // helper, що звичайна вправа (leftBlocks/rightBlocks вище), лише тут —
  // на замороженому зрізі (frozenSceneConfig вище), не на живому config.
  // blockCount<=1 — БЕЗ вкладок/футера нижче (той самий built-in захист,
  // що BlockTabs/BlockNavigation уже мають), плашка+заголовок лишаються
  // завжди.
  const practiceLeftBlocks = frozenSceneConfig ? chunkMatchingPairs(frozenSceneConfig.left) : [];
  const practiceRightBlocks = frozenSceneConfig ? chunkMatchingPairs(frozenSceneConfig.right) : [];
  const practiceBlockCount = practiceLeftBlocks.length;
  const practiceUseBlocks = practiceBlockCount > 1;
  const [practiceActiveBlock, setPracticeActiveBlock] = useState(0);
  const [practiceBlockAttempted, setPracticeBlockAttempted] = useState<Record<number, boolean>>({});

  const usedRightsPractice = new Set(Object.values(practicePairs));

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

  // leftItems/itemIds — усі пари практики (плаский режим) чи лише
  // активного блоку (сцена-вигляд); answer бере лише ВЖЕ відповідені lefts
  // цього підмножини (той самий принцип, що плаский режим — ненадіслані
  // lefts просто не входять у answer, а не йдуть як right:""). blockIndex —
  // лише сцена-вигляд, позначає цей блок "спробуваним".
  async function submitPractice(leftItems: string[], itemIds: string[], blockIndex?: number) {
    const leftSet = new Set(leftItems);
    const answer: MatchingAnswer = Object.entries(practicePairs)
      .filter(([left]) => leftSet.has(left))
      .map(([left, right]) => ({ left, right }));
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
    if (blockIndex !== undefined) setPracticeBlockAttempted((prev) => ({ ...prev, [blockIndex]: true }));
    // Задача "unify attempt/reveal behaviour" — без автоматичного
    // розкриття в жодному потоці (shouldAutoReveal, error-review.ts,
    // завжди false): сцена-вигляд і далі показує відповідь лише через
    // панель "Правильні пари" (reveal(id, true) на відкриття панелі,
    // revealBlockAnswers нижче), флет — кнопкою "Відповідь" поруч.
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

  // ==== Гілка блоків (>10 елементів) ====
  const [activeBlock, setActiveBlock] = useState(0);
  const blockCheckConfirm = useCheckConfirm();
  // Перемикання блоку ховає підтвердження попереднього блоку — інакше
  // застарілий бар лишався б видимим під кнопкою вже іншого, щойно
  // показаного блоку.
  useEffect(() => {
    blockCheckConfirm.cancelCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlock]);
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
    // Кожен left цього блоку — завжди в answer, навіть без пари (right: "").
    // Раніше .filter((left) => pairs[left]) ВІДКИДАВ непарні left, тож
    // gradeMatching (completePairs = ...filter(p => answeredLefts.has(p.left)))
    // бачив лише ПАРИ, що прийшли — непарні left зникали зі знаменника
    // замість рахуватись неправильними (студент міг лишити половину пар
    // порожньою і все одно отримати 100% за решту). right:"" ніколи не
    // збігається з жодною реальною правою частиною, тож gradeMatching сам,
    // без змін, зарахує такий left як неправильний.
    const answer = blockLeft.map((left) => ({ left, right: pairs[left] ?? "" }));
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
        [blockIndex]: e instanceof Error ? e.message : t("error.checkFailed"),
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
      <div className={RESULT_ROW_GAP_CLASS}>
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
            // Непарний left після перевірки — та сама червона "incorrect"
            // стилізація, що й неправильна пара (відповідає порожній
            // відповіді, зарахованій неправильною в gradeMatching вище).
            if (!right) return blockDetail ? "incorrect" : undefined;
            const d = detailForInBlock(left, right);
            return d ? (d.isCorrect ? "correct" : "incorrect") : undefined;
          }}
          usedRights={usedRightsInBlock}
        />

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {blockResult && (
              <TaskResult
                correct={blockResult.correct}
                pointsEarned={blockResult.pointsEarned}
                pointsPossible={blockResult.pointsPossible}
                toggleTitle={t("panel.correctPairsTitle")}
                toggleCount={blockDetail?.correctPairs.length}
              >
                {blockDetail && <TaskResultPairRows pairs={blockDetail.correctPairs} />}
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

  // Задача "replace red per-pair lines with collapsible answers panel"
  // (флет-практика matching, owner report: червоні рядки "signer:
  // неправильно..." з окремою пілюлею "Відповідь" на кожну пару
  // замінюються на спокійний футер (крапки спроб + "Не вдалося · спроба
  // N", та сама розмітка/класи, що letter_gaps/letter_rearrangement/
  // table_fill) + ОДНА спільна панель TaskResult/TaskResultPairRows (той
  // самий компонент, що сцена-вигляд блоків вище, answersPanel) — лише
  // для пар, що й досі неправильні (stillWrongIds, error-review.ts).
  // N на крапках — НАЙГІРШИЙ (максимальний) attempts серед цих пар
  // (maxFailedAttempts), не на кожну пару окремо. Відкриття панелі —
  // той самий пакетний reveal(id, true) по кожному ще нерозкритому id
  // (fromButton=true, 403-правило не застосовується до явного запиту
  // кнопкою), що revealBlockAnswers вище (сцена-вигляд); закриття —
  // лише локальний стан TaskResult, без нового запиту.
  function renderPracticeFooter(leftItems: string[]) {
    const wrongLefts = stillWrongIds(leftItems, practiceResultByLeft);
    if (wrongLefts.length === 0) return null;
    const wrongIds = wrongLefts.map((left) => idByLeft.get(left)).filter((id): id is string => !!id);
    const attempts = maxFailedAttempts(wrongIds, practiceFailedAttempts);
    function revealWrongPairs() {
      for (const id of wrongIds) {
        if (!practiceCheck.revealed[id]) practiceCheck.reveal(id, true);
      }
    }
    const answersLoading = wrongIds.some((id) => practiceCheck.revealPending[id]);
    return (
      <>
        <PracticeAttemptFooter state="failed" failedAttempts={attempts} />
        <TaskResult
          correct={false}
          toggleTitle={t("panel.correctPairsTitle")}
          toggleCount={wrongLefts.length}
          onOpenChange={(open) => {
            if (open) revealWrongPairs();
          }}
        >
          {answersLoading ? (
            <p className="text-sm text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
              {t("panel.loadingAnswers")}
            </p>
          ) : (
            <TaskResultPairRows pairs={buildMatchingPairRowsFromReveal(wrongLefts, idByLeft, practiceCheck.revealed)} />
          )}
        </TaskResult>
      </>
    );
  }

  if (isPractice && isSceneMode) {
    const activeLeft = practiceUseBlocks ? (practiceLeftBlocks[practiceActiveBlock] ?? []) : frozenSceneConfig!.left;
    const activeRight = practiceUseBlocks ? (practiceRightBlocks[practiceActiveBlock] ?? []) : frozenSceneConfig!.right;
    const activeBlockIndex = practiceUseBlocks ? practiceActiveBlock : 0;
    const activeItemIds = activeLeft.map((left) => idByLeft.get(left)).filter((id): id is string => !!id);
    // Та сама умова, що checkButtonEl звичайної вправи (useBlocks-гілка,
    // нижче) — disabled лише поки запит у польоті (activeBlockPending
    // там), БЕЗ вимоги "усі left з'єднані": повнота там лише показує
    // CheckConfirmBar (попередження, не блокер) — практика її не має
    // (immediate check). !activeAllAnswered тут раніше хибно блокував
    // кнопку в блоках без жодної з'єднаної пари (задача "owner report":
    // Перевірити блок недоступна в блоках 1/2, доступна лише в 3-му, де
    // щось уже було з'єднано).
    const sceneCheckButtonEl = (
      <button
        type="button"
        onClick={() => submitPractice(activeLeft, activeItemIds, activeBlockIndex)}
        disabled={practiceCheck.pending}
        className={practiceUseBlocks ? "exercise-block-check-btn btn-check" : `self-start ${BUTTON_CHECK}`}
      >
        {practiceCheck.pending ? t("button.checking") : practiceUseBlocks ? t("button.checkBlock") : t("button.check")}
      </button>
    );
    const board = (
      <MatchingBoard
        leftItems={activeLeft}
        rightItems={activeRight}
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
    );
    // Панель "Правильні пари" (крок 3b) — та сама TaskResult/
    // TaskResultPairRows, що звичайна вправа (renderBlock() вище), лише
    // right бере /api/exercises/practice/reveal по pair.id (лениво, коли
    // студент розгортає панель), не blockDetail.correctPairs (практика
    // його не має).
    function revealBlockAnswers(ids: string[]) {
      for (const id of ids) {
        if (!practiceCheck.revealed[id]) practiceCheck.reveal(id, true);
      }
    }
    const answersLoading = activeItemIds.some((id) => practiceCheck.revealPending[id]);
    const allCorrectInBlock =
      activeLeft.length > 0 && activeLeft.every((left) => practiceResultByLeft[left] === true);
    const answersPanel = practiceBlockAttempted[activeBlockIndex] ? (
      <TaskResult
        key={activeBlockIndex}
        correct={allCorrectInBlock}
        toggleTitle={t("panel.correctPairsTitle")}
        toggleCount={activeLeft.length}
        onOpenChange={(open) => {
          if (open) revealBlockAnswers(activeItemIds);
        }}
      >
        {answersLoading ? (
          <p className="text-sm text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
            {t("panel.loadingAnswers")}
          </p>
        ) : (
          <TaskResultPairRows
            pairs={buildMatchingPairRowsFromReveal(activeLeft, idByLeft, practiceCheck.revealed)}
          />
        )}
      </TaskResult>
    ) : null;
    return (
      <div className={EXERCISE_STACK}>
        <BlockTabs
          plaqueText={plaqueText}
          blockCount={practiceBlockCount}
          activeBlock={practiceActiveBlock}
          onChangeBlock={setPracticeActiveBlock}
          isBlockChecked={(i) => !!practiceBlockAttempted[i]}
        />
        <TaskPanelHeader
          blockCount={practiceBlockCount}
          activeBlock={practiceActiveBlock}
          onChangeBlock={setPracticeActiveBlock}
          isBlockChecked={(i) => !!practiceBlockAttempted[i]}
          instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.matching.instruction}
          subInstructionText={taskTranslationLine({ uk: config.subInstructions, en: config.subInstructionsEn }, lang, {
            uk: DEFAULT_INSTRUCTIONS.matching.subInstruction,
            en: DEFAULT_TRANSLATION_EN.matching,
          })}
        />
        {practiceUseBlocks ? (
          <BlockNavigation
            blockCount={practiceBlockCount}
            activeBlock={practiceActiveBlock}
            onChangeBlock={setPracticeActiveBlock}
            checkButton={sceneCheckButtonEl}
          >
            <div className={RESULT_ROW_GAP_CLASS}>
              {board}
              {answersPanel}
            </div>
          </BlockNavigation>
        ) : (
          <div className={RESULT_ROW_GAP_CLASS}>
            {board}
            {answersPanel}
            <div className="flex flex-col gap-2">{sceneCheckButtonEl}</div>
          </div>
        )}
      </div>
    );
  }

  if (isPractice) {
    // Флет/інлайн-картка сцени (error-review-block.tsx БЕЗ openMode) —
    // довгий список пар розбивається на групи chunkMatchingPairs (той
    // самий helper, що й leftBlocks/rightBlocks звичайної вправи та
    // practiceLeftBlocks/practiceRightBlocks сцена-вигляду вище): кожна
    // група — своя пара leftGroup/rightGroup, тож обидві
    // колонки лишаються узгодженими МІЖ групами (праві варіанти групи i —
    // лише ті, що й самі пари групи i, perBlockShuffle уже гарантує це на
    // сервері, sanitizeMatchingForPractice). На відміну від сцена-вигляду
    // блоків (isSceneMode, вище) — БЕЗ BlockTabs/BlockNavigation: усі групи
    // рендеряться одна під одною одразу, і на десктопі, і на мобільному
    // (вимога задачі), розділені пунктирною лінією (.matching-flat-group-
    // divider, globals.css) лише МІЖ групами (i>0), не навколо першої/
    // останньої. MatchingBoard/дошка/крапки/вибір/з'єднання — той самий
    // компонент з тими самими пропсами, що раніше рендерився ОДИН раз на
    // весь config.left/right — лише leftItems/rightItems тепер звужені до
    // групи, решта (pairs/selectedLeft/onClick*/statusForLeft/usedRights)
    // незмінні.
    const leftGroups = chunkMatchingPairs(config.left);
    const rightGroups = chunkMatchingPairs(config.right);
    return (
      <div className={EXERCISE_STACK}>
        <div className="flex flex-col">
          {leftGroups.map((leftGroup, i) => (
            <Fragment key={i}>
              {i > 0 && <div className="matching-flat-group-divider" aria-hidden="true" />}
              <MatchingBoard
                leftItems={leftGroup}
                rightItems={rightGroups[i] ?? []}
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
            </Fragment>
          ))}
        </div>

        {renderPracticeFooter(config.left)}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => submitPractice(config.left, config.pairs.map((p) => p.id))}
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

  // ЕТАП M — кнопка "Перевірити блок" для рядка check+←/→
  // (BlockNavFooter, block-navigation.tsx): ті самі дані/обробник, що
  // читає сам renderBlock() нижче (blockResults[activeBlock]/
  // blockPending[activeBlock]/submitBlock), лише обчислені тут —
  // BlockNavigation.checkButton рендериться ПОЗА деревом, яке повертає
  // renderBlock().
  const activeBlockResult = blockResults[activeBlock];
  const activeBlockPending = !!blockPending[activeBlock];
  const activeBlockLeft = leftBlocks[activeBlock];
  const activeBlockUnanswered = activeBlockLeft.filter((left) => !pairs[left]).length;
  // Пілюля "N балів" у заголовку панелі — той самий принцип, що pooled-
  // score вправи (word-search.tsx тощо): до перевірки показує максимум
  // ПОТОЧНОГО блоку (сума points пар цього блоку, left тут не перемішаний
  // — той самий порядок, що в leftBlocks), ховається, коли всі блоки вже
  // перевірені (aggregateResult готовий) — саме тоді під блоком з'являється
  // підсумковий TaskResult "earned з max".
  const currentMaxPoints = (useBlocks ? activeBlockLeft : config.left).reduce(
    (sum, left) => sum + (config.pairs.find((p) => p.left === left)?.points ?? 0),
    0
  );
  // Єдина пілюля балів (задача "єдина пілюля балів усюди"): до перевірки —
  // бали ПОТОЧНОГО блоку (currentMaxPoints, вище); після перевірки
  // активного блоку/вправи — earned sur possible ЦЬОГО блоку + статус-чіп.
  const activeBlockOrSingleResult = useBlocks ? blockResults[activeBlock] : single.result;
  const headerPoints = hidePoints
    ? undefined
    : headerPointsState(
        activeBlockOrSingleResult?.pointsPossible ?? currentMaxPoints,
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
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.matching.instruction}
        subInstructionText={taskTranslationLine({ uk: config.subInstructions, en: config.subInstructionsEn }, lang, {
          uk: DEFAULT_INSTRUCTIONS.matching.subInstruction,
          en: DEFAULT_TRANSLATION_EN.matching,
        })}
      />

      {!useBlocks ? (
        <div className={RESULT_ROW_GAP_CLASS}>
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
              // Непарний left після перевірки — та сама червона "incorrect"
              // стилізація, що й неправильна пара.
              if (!right) return singleDetail ? "incorrect" : undefined;
              const d = detailFor(left, right);
              return d ? (d.isCorrect ? "correct" : "incorrect") : undefined;
            }}
            usedRights={usedRights}
          />

          <div className="flex flex-col gap-3">
            {!single.result ? (
              <div className="flex flex-col items-start gap-2">
                <button
                  type="button"
                  onClick={() =>
                    singleCheckConfirm.attemptCheck(config.left.length - Object.keys(pairs).length, submitSingle)
                  }
                  disabled={single.pending}
                  className={`self-start ${BUTTON_CHECK}`}
                >
                  {single.pending ? t("button.checking") : t("button.check")}
                </button>
                {singleCheckConfirm.confirming && (
                  <CheckConfirmBar
                    unansweredCount={config.left.length - Object.keys(pairs).length}
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
                toggleTitle={t("panel.correctPairsTitle")}
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
