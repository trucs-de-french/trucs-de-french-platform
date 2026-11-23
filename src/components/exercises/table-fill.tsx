"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import type { TableFillPublic, TableFillDetail, TableFillAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS, DEFAULT_TRANSLATION_EN, taskTranslationLine } from "@/lib/exercises/default-instructions";
import { TaskPanelHeader } from "./task-panel-header";
import { BUTTON_CHECK } from "@/lib/button-styles";
import { DiacriticsPopup, useDiacriticsPopup, insertAtCursor, focusAndSetCursor } from "./diacritics-popup";
import { hintExplanationText } from "./hint-explanation";
import { HintBulb, HintUsedBadge } from "./hint-bulb";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP, RESULT_ROW_GAP_CLASS } from "@/lib/spacing";
import { TaskResult, TaskResultAnswerRows, RowPointsTab, shouldShowRowScorePill, rowResultAriaLabel } from "./task-result";
import { unevenPointsFlags } from "@/lib/exercises/uneven-points";
import { headerPointsState } from "@/lib/exercises/header-points";
import { useCheckConfirm, CheckConfirmBar } from "./check-confirm";
import { useT } from "@/lib/i18n/context";
import { EXERCISE_BLOCK_SIZE, chunk } from "@/lib/exercises/exercise-blocks";
import { frenchNbsp } from "@/lib/text/french-typography";
import { BlockNavigation, BlockTabs } from "./block-navigation";
import { usePracticeCheck } from "./use-practice-check";
import { shouldShowAttemptFooter } from "@/lib/exercises/error-review";
import { buildTableFillAnswerRowsFromReveal } from "@/lib/exercises/format-reveal-answer";

function cellKey(rowId: string, side: "left" | "right") {
  return `${rowId}:${side}`;
}

// sanitizeTableFill (sanitize.ts) уже підставляє цей самий дефолт, якщо
// його нема в конфізі — тут другий шар захисту саме на випадок конфіга, що
// оминув sanitize (напр. застарілий кеш/бандл), щоб рендер рядка заголовка
// таблиці не падав на columnLabels[0] з undefined.
// Той самий сентінел, що resolveTableFillColumnLabels (sanitize.ts) заповнює
// на сервері, коли вчителька НЕ вказала columnLabels (обов'язкове поле типу,
// але старі/масово-імпортовані вправи могли зберегтись без нього) — сервер
// віддає завжди ЦЕ конкретне uk-значення як дефолт, незалежно від ui_lang
// продукту (сам sanitize.ts лишається без lang: lang — суто рендер-поняття,
// відоме лише тут, клієнту). Тому лише ТУТ, при точному збігу з цим
// сентінелом, підписи колонок стають lang-aware (pool.*-подібний принцип, що
// й word-pool labels) — реальні вчительські підписи (що завжди відрізняються
// від цього рядка хоч одним словом) завжди лишаються як є, без перекладу.
const DEFAULT_COLUMN_LABELS_UK: [string, string] = ["Французька", "Переклад"];

// Рядків довше 10 — розбиваємо навпіл на дві колонки, кожна зі своїм
// рядком підписів колонок (лише щоб довга таблиця не розтягувалась на всю
// висоту сторінки в один стовпець). Використовується ЛИШЕ ≤10-гілкою
// (умовно, за rows.length > SPLIT_THRESHOLD — той самий поріг, що й
// розбиття на блоки, обидва 10). Блокова гілка (renderBlock() нижче) має
// СВІЙ поділ навпіл на 2 таблиці — БЕЗУМОВНИЙ, не за цим порогом: блок за
// визначенням ≤EXERCISE_BLOCK_SIZE(10) рядків, тож SPLIT_THRESHOLD там
// ніколи не спрацював би сам по собі.
const SPLIT_THRESHOLD = 10;

type Row = TableFillPublic["rows"][number];
type TableFillResult = Extract<GradeResult, { detail: TableFillDetail }>;

// "Variant B" (рестайл) — текст ДАНОЇ (нередагованої) клітинки, спільний
// для РЕАЛЬНОЇ вправи (renderCell нижче) і практики (renderPracticeRow:
// cellField) — та сама типографіка в усіх трьох місцях (сцена, флет-картка
// сцени, сцена-вигляд /cabinet/mistakes/[sceneId]), без колишньої fr/uk
// розбіжності кольору/шрифту чипа (просто текст, не чип).
function tableFillGivenText(value: string, cellLang: string) {
  return (
    <span
      lang={cellLang}
      className="font-content text-[16px] text-[#1a1640] dark:text-[var(--card-ink-2)] [overflow-wrap:anywhere]"
    >
      {frenchNbsp(value)}
    </span>
  );
}

// "Variant B" (рестайл) — спільна картка-рядок для РЕАЛЬНОЇ вправи
// (TableFillColumn нижче) і практики (renderPracticeRow: флет-картка
// сцени ТА сцена-вигляд /cabinet/mistakes/[sceneId]) — усі три місця
// рендерять рівно ЦЕЙ компонент, тож лишаються пікселево однаковими.
// Чисто презентаційна обгортка: leftContent/rightContent — уже готовий
// ReactNode (сам текст/інпут/лампочка/aria — логіка кожного викликача,
// тут НЕ міняється), лише номер+грід+стрілка (desktop) чи "дано, потім
// інпут" (<=640px, globals.css) — порядок на мобільному визначає
// leftValue/rightValue (null = інпут, не-null = дано) через data-атрибут
// data-row-fill-slot, зіставлений із grid-area в CSS, а не припущення
// "ліва сторона завжди дано".
function TableFillRowCard({
  number,
  numberAriaLabel,
  leftValue,
  rightValue,
  leftContent,
  rightContent,
  footer,
}: {
  number: number;
  numberAriaLabel: string;
  leftValue: string | null;
  rightValue: string | null;
  leftContent: ReactNode;
  rightContent: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="table-fill-row-b">
      <div className="table-fill-row-b-grid">
        <span className="table-fill-row-b-num" aria-label={numberAriaLabel}>
          {number}
        </span>
        <div data-row-fill-slot={leftValue !== null ? "given" : "input"}>{leftContent}</div>
        <span className="table-fill-row-b-arrow" aria-hidden="true">
          →
        </span>
        <div data-row-fill-slot={rightValue !== null ? "given" : "input"}>{rightContent}</div>
      </div>
      {footer}
    </div>
  );
}

// Одна колонка вправи — половина рядків чи вся вправа одним стовпцем.
// numberOffset — глобальний порядковий номер (у config.rows, не у межах
// цієї половини/блоку) першого рядка цієї колонки, щоб нумерація йшла
// 1..N наскрізно по обох половинах і збігалась із "Рядок N" у списку
// помилок під вправою (той самий config.rows.findIndex нижче).
function TableFillColumn({
  rows,
  renderCell,
  rowPointsLabel,
  numberOffset,
  itemsGapClass,
}: {
  rows: Row[];
  renderCell: (rowId: string, side: "left" | "right", value: string | null, points: number) => ReactNode;
  rowPointsLabel: (row: Row) => ReactNode;
  numberOffset: number;
  // Чи ХОЧ ОДИН рядок цієї вправи взагалі може показати пілюлю балів
  // (isDelf чи нетиповий бал серед рядків — рахує батько, TableFillExercise):
  // звужує відступ gap-[22px]→EXERCISE_BODY_ITEMS_GAP, коли жодна пілюля
  // ніколи не з'явиться, щоб не лишати порожній простір під неї.
  itemsGapClass: string;
}) {
  const { t } = useT();
  return (
    <div className={`flex flex-col ${itemsGapClass}`}>
      {rows.map((row, i) => {
        const tab = rowPointsLabel(row);
        const number = numberOffset + i + 1;
        return (
          <div key={row.id} className={`row-points-tab-wrap ${tab ? "row-points-tab-wrap--has-tab" : ""}`}>
            {tab}
            <TableFillRowCard
              number={number}
              numberAriaLabel={t("aria.row", { n: number })}
              leftValue={row.left}
              rightValue={row.right}
              leftContent={renderCell(row.id, "left", row.left, row.points)}
              rightContent={renderCell(row.id, "right", row.right, row.points)}
            />
          </div>
        );
      })}
    </div>
  );
}

// Обгортка "дві половини" таблиці. Стек керується viewport-медіа-запитом
// (768px, у globals.css), тому тут просто grid з двома можливими
// розкладками класів, без container-query-залежностей.
function TableFillColumnsGrid({ multiColumn, children }: { multiColumn: boolean; children: ReactNode }) {
  if (!multiColumn) {
    return <div className="mx-auto w-full max-w-3xl">{children}</div>;
  }
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="table-fill-columns-grid items-start gap-x-8 gap-y-6">{children}</div>
    </div>
  );
}

// Режим практики "Робота над помилками" (частина 6, хвиля 1) — той самий
// принцип, що MatchingPracticeProps: елемент тут rowId (стабільний id, не
// позиційний індекс, на відміну від letter_rearrangement/letter_gaps).
export type TableFillPracticeProps = {
  onlyItemIds: string[];
  failedAttempts: Record<string, number>;
  // Сцена-вигляд (openMode="scene", мистейки-сторінка, крок 4) — лише
  // error-review-block.tsx передає: onlyItemIds вище стає ЗАМОРОЖЕНИМ
  // знімком помилок на момент відкриття задачі (стабільне членство блоку
  // на всю сесію, не live remainingItemIds), а плашка+заголовок+блоки
  // (нижче) замінюють плаский список рядків-карток. correctedItemIds —
  // підмножина onlyItemIds, вже виправлена ПІСЛЯ знімку (цього сеансу) —
  // показується "вирішеною" в своєму блоці замість зникнення. Інлайн-
  // картка сцени (error_correction, без цього поля) лишається пласким
  // списком без плашки, НЕЗМІННО.
  scene?: { correctedItemIds: string[] };
};

export function TableFillExercise({
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
  config: TableFillPublic;
  plaqueText?: string;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  // Задача належить DELF-тесту — підказки повністю вимкнені (той самий
  // принцип, що fill-blank.tsx).
  isDelf?: boolean;
  practice?: TableFillPracticeProps;
}) {
  const { t: tt, lang } = useT();
  const router = useRouter();
  // Поза DELF пілюля балів ховається, КРІМ рядків із нетиповими балами
  // (п.4 задачі) — рахується лише серед рядків із прихованою клітинкою
  // (інші й так ніколи не показують пілюлю, rowPointsLabel нижче).
  const hiddenRows = useMemo(() => config.rows.filter((r) => r.left === null || r.right === null), [config.rows]);
  const unevenFlags = useMemo(() => unevenPointsFlags(hiddenRows.map((r) => r.points)), [hiddenRows]);
  const unevenById = useMemo(() => {
    const m = new Map<string, boolean>();
    hiddenRows.forEach((r, i) => m.set(r.id, unevenFlags[i]));
    return m;
  }, [hiddenRows, unevenFlags]);
  const anyItemPointsShown = isDelf || unevenFlags.some(Boolean);
  const itemsGapClass = anyItemPointsShown ? "gap-[22px]" : EXERCISE_BODY_ITEMS_GAP;

  // answers/hintedCells — СПІЛЬНІ на всю вправу (не по блоку), як pairs у
  // matching.tsx.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hintedCells, setHintedCells] = useState<Set<string>>(new Set());
  const [hintPending, setHintPending] = useState(false);
  // Приховані (підлягають заповненню) клітинки заданих рядків — той самий
  // прохід, що handleSubmit/submitBlock нижче, лише для підрахунку
  // незаповнених (CheckConfirmBar), не для побудови payload.
  function hiddenCellsOf(rows: TableFillPublic["rows"]) {
    const cells: { rowId: string; side: "left" | "right" }[] = [];
    for (const row of rows) {
      (["left", "right"] as const).forEach((side) => {
        const hidden = side === "left" ? row.left === null : row.right === null;
        if (hidden) cells.push({ rowId: row.id, side });
      });
    }
    return cells;
  }
  function unfilledCellCount(rows: TableFillPublic["rows"]) {
    return hiddenCellsOf(rows).filter((c) => !answers[cellKey(c.rowId, c.side)]?.trim()).length;
  }
  const diacritics = useDiacriticsPopup<string>();
  const isDefaultColumnLabels =
    !config.columnLabels ||
    (config.columnLabels[0] === DEFAULT_COLUMN_LABELS_UK[0] && config.columnLabels[1] === DEFAULT_COLUMN_LABELS_UK[1]);
  const columnLabels: [string, string] = isDefaultColumnLabels
    ? [tt("tablefill.columnFrench"), tt("tablefill.columnTranslation")]
    : config.columnLabels;

  // ≤EXERCISE_BLOCK_SIZE рядків (≤10) — той самий принцип, що matching/
  // letter-gaps: одна гілка, окрема від блоків.
  const rowBlocks = useMemo(() => chunk(config.rows, EXERCISE_BLOCK_SIZE), [config.rows]);
  const blockCount = rowBlocks.length;
  const useBlocks = blockCount > 1;

  function updateAnswer(rowId: string, side: "left" | "right", value: string) {
    setAnswers((prev) => ({ ...prev, [cellKey(rowId, side)]: value }));
    setHintedCells((prev) => {
      const key = cellKey(rowId, side);
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  async function applyHint(rowId: string, side: "left" | "right") {
    const key = cellKey(rowId, side);
    if (hintedCells.has(key) || hintPending) return;
    setHintPending(true);
    try {
      const res = await fetch("/api/exercises/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, kind: "table_fill", rowId, side }),
      });
      if (!res.ok) return;
      const { letter } = (await res.json()) as { letter: string };
      const current = answers[key] ?? "";
      const value = current.startsWith(letter) ? current : letter;
      setAnswers((prev) => ({ ...prev, [key]: value }));
      setHintedCells((prev) => new Set(prev).add(key));
      focusAndSetCursor(diacritics.getElement(key), letter.length);
    } finally {
      setHintPending(false);
    }
  }

  // ==== Гілка ≤10 рядків (незмінна поведінка) ====
  const single = useExerciseCheck(taskId);
  const singleDetail = single.result?.detail as TableFillDetail | undefined;
  const singleCheckConfirm = useCheckConfirm();

  useEffect(() => {
    if (!useBlocks && single.result) onResult?.(single.result);
  }, [useBlocks, single.result, onResult]);

  // ==== Гілка практики (onlyItemIds) — незалежна від useBlocks/single вище
  // (той самий принцип, що letter-rearrangement.tsx): плаский список рядків-
  // карток (не таблиця/BlockNavigation), один спільний "Перевірити" на всі
  // показані рядки.
  const isPractice = !!practice;
  const practiceRowIds = isPractice
    ? config.rows.map((r) => r.id).filter((id) => practice!.onlyItemIds.includes(id))
    : [];
  const practiceRows = config.rows.filter((r) => practiceRowIds.includes(r.id));
  const practiceCheck = usePracticeCheck(taskId);
  // Сцена-вигляд (крок 4) — попередньо "вирішені" елементи (виправлені
  // ПІСЛЯ знімку onlyItemIds, practice.scene.correctedItemIds,
  // error-review-block.tsx) засіюються як correct:true одразу при
  // монтуванні — той самий вигляд ("Правильно" під карткою), що й щойно
  // перевірений елемент, без повторного запиту.
  const [practiceResults, setPracticeResults] = useState<Record<string, boolean>>(() => {
    const seed: Record<string, boolean> = {};
    for (const id of practice?.scene?.correctedItemIds ?? []) seed[id] = true;
    return seed;
  });
  const [practiceFailedAttempts, setPracticeFailedAttempts] = useState<Record<string, number>>(
    practice?.failedAttempts ?? {}
  );
  const onlyItemIdsKey = practice?.onlyItemIds.join(",") ?? "";
  const [prevOnlyItemIdsKey, setPrevOnlyItemIdsKey] = useState(onlyItemIdsKey);
  if (isPractice && onlyItemIdsKey !== prevOnlyItemIdsKey) {
    setPrevOnlyItemIdsKey(onlyItemIdsKey);
    setPracticeResults({});
  }

  // Сцена-вигляд (крок 4) — блоки по EXERCISE_BLOCK_SIZE рядків, той самий
  // chunk(), що звичайна вправа (rowBlocks вище), лише на practiceRowIds
  // (знімок помилок, не всю вправу). blockCount<=1 — БЕЗ вкладок/футера
  // нижче (той самий built-in захист, що BlockTabs/BlockNavigation уже
  // мають для звичайної вправи), плашка+заголовок лишаються завжди.
  const isSceneMode = !!practice?.scene;
  const practiceRowBlocks = isSceneMode ? chunk(practiceRows, EXERCISE_BLOCK_SIZE) : [];
  const practiceBlockCount = practiceRowBlocks.length;
  const practiceUseBlocks = practiceBlockCount > 1;
  const [practiceActiveBlock, setPracticeActiveBlock] = useState(0);
  const [practiceBlockAttempted, setPracticeBlockAttempted] = useState<Record<number, boolean>>({});

  // rows — усі рядки практики (плаский режим) чи лише активного блоку
  // (сцена-вигляд); blockIndex — лише сцена-вигляд, позначає цей блок
  // "спробуваним" (чекмарк на вкладці, той самий принцип, що
  // isBlockChecked={(i) => i in blockResults} звичайної вправи).
  async function submitPractice(rows: Row[], blockIndex?: number) {
    const rowIds = rows.map((r) => r.id);
    const practiceSet = new Set(rowIds);
    const cells: TableFillAnswer["cells"] = [];
    for (const row of rows) {
      (["left", "right"] as const).forEach((side) => {
        const hidden = side === "left" ? row.left === null : row.right === null;
        if (!hidden) return;
        cells.push({ rowId: row.id, side, value: answers[cellKey(row.id, side)] ?? "" });
      });
    }
    const hintedCellsList = [...hintedCells]
      .map((key) => {
        const [rowId, side] = key.split(":") as [string, "left" | "right"];
        return { rowId, side };
      })
      .filter((h) => practiceSet.has(h.rowId));
    const answer: TableFillAnswer = { cells, hintedCells: hintedCellsList };
    const result = await practiceCheck.check(rowIds, answer);
    if (!result) return;
    setPracticeResults((prev) => {
      const next = { ...prev };
      for (const r of result.results) next[r.itemId] = r.correct;
      return next;
    });
    setPracticeFailedAttempts(result.failedAttempts);
    if (blockIndex !== undefined) setPracticeBlockAttempted((prev) => ({ ...prev, [blockIndex]: true }));
    // Задача "unify attempt/reveal behaviour" — без автоматичного
    // розкриття в жодному потоці (shouldAutoReveal, error-review.ts,
    // завжди false): сцена-вигляд і далі показує відповідь лише через
    // панель "Правильні відповіді" (reveal(id, true) на відкриття панелі,
    // revealBlockAnswers нижче), флет — своєю пілюлею "Відповідь" поруч.
  }

  // hideReveal — лише сцена-вигляд (крок 3b): інлайн-кнопка "Показати
  // відповідь"+розкритий текст замінюються на спільну панель "Правильні
  // відповіді" під блоком (showToggle-картка TaskResult, той самий
  // компонент, що звичайна вправа); лічильник спроб лишається — у
  // звичайної вправи нема свого еквівалента цього рядка.
  function renderPracticeRow(row: Row, number: number, hideReveal = false) {
    const isCorrect = practiceResults[row.id];
    const locked = isCorrect !== undefined;
    const attempts = practiceFailedAttempts[row.id] ?? 0;
    const revealedAnswer = practiceCheck.revealed[row.id];

    function practiceInputClass() {
      if (!locked) return "exercise-field glass-gap-shadow border-[rgba(217,183,101,0.55)] bg-white";
      return isCorrect
        ? "exercise-field exercise-field--correct border-green-500 bg-green-50"
        : "exercise-field exercise-field--wrong border-red-500 bg-red-50";
    }

    function cellField(side: "left" | "right", value: string | null) {
      if (value !== null) return tableFillGivenText(value, side === "left" ? "fr" : lang);
      return (
        <input
          value={answers[cellKey(row.id, side)] ?? ""}
          onChange={(e) => updateAnswer(row.id, side, e.target.value)}
          disabled={locked}
          className={`h-[34px] w-full rounded-lg border text-center text-[15px] ${practiceInputClass()}`}
        />
      );
    }

    // hideReveal — лише сцена-вигляд (крок 3c, "варіант 3 — крапки спроб"):
    // футер усередині картки, без пілюлі "Відповідь" (панель "Правильні
    // відповіді", renderBlock() нижче, уже дає відповіді); коректний рядок —
    // без футера й без тексту "Правильно" (зелені поля й так це показують).
    const footer = hideReveal ? (
      isCorrect === false && (
        <div className="practice-attempt-footer">
          <span className="practice-attempt-dots" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`practice-attempt-dot ${i < Math.min(attempts, 3) ? "practice-attempt-dot--filled" : ""}`}
              />
            ))}
          </span>
          <span className="practice-attempt-label">{tt("status.failedAttemptShort", { n: attempts })}</span>
        </div>
      )
    ) : (
      // Задача "unify attempt/reveal behaviour" — флет-режим (на відміну
      // від сцена-вигляду вище) не має блочної панелі "Правильні
      // відповіді", тож лишається ЄДИНИМ способом розкрити відповідь: той
      // самий футер (крапки спроб), що сцена-вигляд, + пілюля "Відповідь"
      // (не кнопка BUTTON_REVEAL_ANSWER) — той самий .practice-reveal-pill,
      // що letter-rearrangement.tsx/letter-gaps.tsx. Розкрита відповідь —
      // рядок "Правильне слово" (correct-answer-label/correct-answer-word,
      // той самий вигляд, що Task A), замінює крапки після розкриття.
      <>
        {isCorrect === true && (
          <p className="text-xs font-medium text-green-600 dark:text-green-400">{tt("status.correct")}</p>
        )}
        {shouldShowAttemptFooter(isCorrect, revealedAnswer) && (
          <div className="practice-attempt-footer">
            <span className="practice-attempt-dots" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`practice-attempt-dot ${i < Math.min(attempts, 3) ? "practice-attempt-dot--filled" : ""}`}
                />
              ))}
            </span>
            <span className="practice-attempt-label">{tt("status.failedAttemptShort", { n: attempts })}</span>
            <button
              type="button"
              onClick={() => practiceCheck.reveal(row.id, true)}
              disabled={!!practiceCheck.revealPending[row.id]}
              aria-label={tt("button.showAnswer")}
              className="practice-reveal-pill"
            >
              <Eye size={14} aria-hidden="true" />
              {tt("button.answerShort")}
            </button>
          </div>
        )}
        {revealedAnswer && (
          <p className="text-sm dark:text-[var(--text-muted-caption)]">
            <span className="correct-answer-label">{tt("answer.correctAnswerLabel")} </span>
            <span className="correct-answer-word text-[#3b36c4]">{revealedAnswer.join(" / ")}</span>
          </p>
        )}
      </>
    );

    return (
      <TableFillRowCard
        key={row.id}
        number={number}
        numberAriaLabel={tt("aria.row", { n: number })}
        leftValue={row.left}
        rightValue={row.right}
        leftContent={cellField("left", row.left)}
        rightContent={cellField("right", row.right)}
        footer={footer}
      />
    );
  }

  function inputClass(rowId: string, side: "left" | "right", detail: TableFillDetail | undefined) {
    const idle = "exercise-field glass-gap-shadow border-[rgba(217,183,101,0.55)] bg-white";
    if (!detail)
      return hintedCells.has(cellKey(rowId, side))
        ? "border-sky-400 bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400"
        : idle;
    const blank = detail.blanks.find((b) => b.rowId === rowId && b.side === side);
    if (!blank) return idle;
    return blank.isCorrect
      ? "exercise-field exercise-field--correct border-green-500 bg-green-50"
      : "exercise-field exercise-field--wrong border-red-500 bg-red-50";
  }

  // Рядки без жодної прихованої клітинки нема чого оцінювати — бали для них
  // не показуємо взагалі. До перевірки — лише якщо pointsVisible; після —
  // завжди. Бали рядка зараховуються, лише якщо ВСІ його приховані
  // клітинки (1 або 2) правильні — не по клітинці, як score.
  function rowPointsLabel(row: Row, detail: TableFillDetail | undefined) {
    if (hidePoints) return null;
    const hasHidden = row.left === null || row.right === null;
    if (!hasHidden) return null;

    if (!isDelf && !unevenById.get(row.id)) return null;
    const rowBlanks = detail?.blanks.filter((b) => b.rowId === row.id);
    if (!pointsVisible && !rowBlanks?.length) return null;

    if (rowBlanks?.length) {
      const isCorrect = rowBlanks.every((b) => b.isCorrect);
      return <RowPointsTab earned={isCorrect ? row.points : 0} possible={row.points} />;
    }
    return <RowPointsTab possible={row.points} />;
  }

  // Рядки для toggle-картки "Правильні відповіді" (TaskResultAnswerRows) —
  // ТОЙ САМИЙ numberOffset-принцип, що TableFillColumn вище (наскрізна
  // нумерація 1..N по всій вправі/блоку, не по половині). Клітинка-відповідь
  // (leftIsAnswer/rightIsAnswer) — за присутністю rowId+сторони в
  // detail.blanks, незалежно від isCorrect (toggle не показує
  // правильно/неправильно студента — це вже показує сама таблиця).
  function buildAnswerRows(rows: Row[], numberOffset: number, detail: TableFillDetail) {
    return rows.map((row, i) => {
      const blankLeft = detail.blanks.find((b) => b.rowId === row.id && b.side === "left");
      const blankRight = detail.blanks.find((b) => b.rowId === row.id && b.side === "right");
      return {
        number: numberOffset + i + 1,
        left: row.left ?? blankLeft?.correctAnswers.join(" / ") ?? "",
        leftIsAnswer: !!blankLeft,
        right: row.right ?? blankRight?.correctAnswers.join(" / ") ?? "",
        rightIsAnswer: !!blankRight,
      };
    });
  }

  function renderCell(
    rowId: string,
    side: "left" | "right",
    value: string | null,
    points: number,
    detail: TableFillDetail | undefined,
    locked: boolean
  ) {
    if (value !== null) {
      return tableFillGivenText(value, side === "left" ? "fr" : lang);
    }
    const key = cellKey(rowId, side);
    const blank = detail?.blanks.find((b) => b.rowId === rowId && b.side === side);
    const hintUsed = blank?.hintUsed;
    const hasValue = (answers[key] ?? "") !== "";
    // Коли пілюля балів рядка схована (max≤1 — RowScorePill вище), поле —
    // єдиний елемент відповіді цієї клітинки, тож саме воно отримує
    // aria-label "Правильно"/"Неправильно" (той самий принцип, що
    // matching-board.tsx), щоб колір рамки не був єдиним сигналом для
    // читалки.
    const ariaResultLabel = blank && !shouldShowRowScorePill(points) ? rowResultAriaLabel(blank.isCorrect, lang) : undefined;
    return (
      <div className="relative table-fill-cell-wrap">
        <input
          ref={diacritics.fieldRef(key)}
          value={answers[key] ?? ""}
          onChange={(e) => updateAnswer(rowId, side, e.target.value)}
          onFocus={() => diacritics.onFocus(key)}
          onBlur={diacritics.onBlur}
          disabled={locked}
          aria-label={ariaResultLabel}
          className={`h-[34px] w-full rounded-lg border text-center text-[15px] ${hasValue ? "px-[12px]" : "px-[40px]"} ${inputClass(rowId, side, detail)}`}
        />
        {/* Лампочка-підказка ВСЕРЕДИНІ поля — той самий золотий гурток, що
            ClueCardHeader кросворду, абсолютно позиційований у .relative-
            обгортці вище; той самий принцип, що letter-gaps.tsx (завжди
            видима, не залежить від фокуса/попапу діакритики — колишня
            лампочка DiacriticsPopup (onHint) з'являлась лише коли попап
            відкритий, тут навмисно інакше). Зникає повністю, щойно в полі
            є текст (а не стискається) — не рендериться взагалі, тож не в
            DOM, не в tab-порядку, не в a11y-дереві. */}
        {!locked && !isDelf && !hasValue && (
          <HintBulb
            state={hintedCells.has(key) ? "used" : "available"}
            label={tt("tablefill.hintOpenFirstLetter")}
            disabled={hintedCells.has(key) || hintPending}
            onClick={() => applyHint(rowId, side)}
            className="table-fill-input-lamp"
          />
        )}
        {hintUsed && <HintUsedBadge />}
      </div>
    );
  }

  function handleSubmit() {
    // Повний прохід по ВСІХ рядках вправи (не Object.entries(answers)) —
    // той самий принцип, що submitBlock() нижче: незаймана клітинка
    // (студент жодного разу не клікнув у поле) отримує запис з value: ""
    // замість випадання з cells узагалі. gradeTableFill (grade.ts) визначає
    // скоуп рядка за ПРИСУТНІСТЮ rowId у cells — якщо рядок відсутній
    // повністю, він випадає зі знаменника score/балів, а не рахується
    // неправильним; сирий Object.entries(answers) (лише реально введені
    // клітинки) робив незайману клітинку невидимою для сервера, і студент
    // отримував ВИЩИЙ бал, ніж мав би (регресія, знайдена після
    // впровадження блоків — answeredRowIds у grade.ts до блоків не
    // існував, gradeTableFill проходила всі рядки конфігу безумовно).
    const cells: TableFillAnswer["cells"] = [];
    for (const row of config.rows) {
      (["left", "right"] as const).forEach((side) => {
        const hidden = side === "left" ? row.left === null : row.right === null;
        if (!hidden) return;
        cells.push({ rowId: row.id, side, value: answers[cellKey(row.id, side)] ?? "" });
      });
    }
    const hintedCellsList = [...hintedCells].map((key) => {
      const [rowId, side] = key.split(":") as [string, "left" | "right"];
      return { rowId, side };
    });
    const answer: TableFillAnswer = { cells, hintedCells: hintedCellsList };
    single.submit(answer);
  }

  // Поділ — ЛИШЕ візуальний: кожна колонка нижче несе підмножину ТИХ САМИХ
  // об'єктів row (той самий row.id), відповіді (cellKey/rowId) і список
  // помилок нижче (config.rows.findIndex за ПОВНИМ, неподіленим масивом)
  // узагалі не звертаються до цього поділу — індекси/бали не можуть розійтись.
  // numberOffset — позиція першого рядка колонки в ПОВНОМУ config.rows,
  // той самий принцип, що config.rows.findIndex у списку помилок нижче —
  // нумерація картки й "Рядок N" там завжди про той самий рядок.
  let columns: { key: string; rows: Row[]; numberOffset: number }[];
  if (!useBlocks && config.rows.length > SPLIT_THRESHOLD) {
    const mid = Math.ceil(config.rows.length / 2);
    columns = [
      { key: "col-a", rows: config.rows.slice(0, mid), numberOffset: 0 },
      { key: "col-b", rows: config.rows.slice(mid), numberOffset: mid },
    ];
  } else {
    columns = [{ key: "all", rows: config.rows, numberOffset: 0 }];
  }

  // ==== Гілка блоків (>10 рядків) ====
  const [activeBlock, setActiveBlock] = useState(0);
  const blockCheckConfirm = useCheckConfirm();
  useEffect(() => {
    blockCheckConfirm.cancelCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlock]);
  const [blockResults, setBlockResults] = useState<Record<number, TableFillResult>>({});
  const [blockPending, setBlockPending] = useState<Record<number, boolean>>({});
  const [blockError, setBlockError] = useState<Record<number, string | null>>({});

  const allBlocksChecked = useBlocks && blockCount > 0 && Object.keys(blockResults).length === blockCount;

  // Той самий принцип, що matching.tsx — detail тут ID-адресований
  // (rowId), не позиційний, тож просто конкатенуємо blanks усіх блоків.
  const aggregateResult: TableFillResult | null = useMemo(() => {
    if (!allBlocksChecked) return null;
    const results = Object.values(blockResults);
    const blanks = results.flatMap((r) => r.detail.blanks);
    const totalCorrect = blanks.filter((b) => b.isCorrect).length;
    return {
      correct: results.every((r) => r.correct),
      score: blanks.length > 0 ? Math.round((totalCorrect / blanks.length) * 100) : 0,
      detail: { blanks },
      pointsEarned: results.reduce((sum, r) => sum + (r.pointsEarned ?? 0), 0),
      pointsPossible: results.reduce((sum, r) => sum + (r.pointsPossible ?? 0), 0),
    };
  }, [allBlocksChecked, blockResults]);

  useEffect(() => {
    if (aggregateResult) onResult?.(aggregateResult);
  }, [aggregateResult, onResult]);

  // Пряме fetch, не useExerciseCheck — N незалежних станів (по блоку).
  // cells — лише для рядків ЦЬОГО блоку (по КОЖНІЙ прихованій клітинці,
  // навіть незайманій — порожнім рядком, щоб rowId лишався присутнім і
  // gradeTableFill (grade.ts) визначив скоуп саме за цим блоком). Тип
  // TableFillAnswer лишається незмінним — id-адресована структура вже
  // підтримує підмножину без жодних змін формату.
  async function submitBlock(blockIndex: number) {
    const blockRows = rowBlocks[blockIndex];
    const cells: TableFillAnswer["cells"] = [];
    for (const row of blockRows) {
      (["left", "right"] as const).forEach((side) => {
        const hidden = side === "left" ? row.left === null : row.right === null;
        if (!hidden) return;
        cells.push({ rowId: row.id, side, value: answers[cellKey(row.id, side)] ?? "" });
      });
    }
    const hintedCellsList = [...hintedCells]
      .map((key) => {
        const [rowId, side] = key.split(":") as [string, "left" | "right"];
        return { rowId, side };
      })
      .filter((h) => blockRows.some((r) => r.id === h.rowId));
    const answer: TableFillAnswer = { cells, hintedCells: hintedCellsList };

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
        throw new Error(body.error ?? tt("error.checkFailed"));
      }
      const result = (await res.json()) as TableFillResult;
      setBlockResults((prev) => ({ ...prev, [blockIndex]: result }));
      // Оновлює серверні дані сторінки (зокрема блок "Робота над
      // помилками") без перезавантаження — той самий принцип, що
      // useExerciseCheck/usePracticeCheck; тут бракувало цього виклику
      // (єдина відмінність блокової гілки від однокартної).
      router.refresh();
    } catch (e) {
      setBlockError((prev) => ({
        ...prev,
        [blockIndex]: e instanceof Error ? e.message : tt("error.checkFailed"),
      }));
    } finally {
      setBlockPending((prev) => ({ ...prev, [blockIndex]: false }));
    }
  }

  function renderBlock() {
    const blockRows = rowBlocks[activeBlock];
    const blockResult = blockResults[activeBlock];
    const blockDetail = blockResult?.detail;
    const errMsg = blockError[activeBlock];

    // Той самий поділ навпіл на 2 таблиці-половини, що й columns вище для
    // ≤10-гілки (SPLIT_THRESHOLD) — тут БЕЗУМОВНО (не за rows.length >
    // SPLIT_THRESHOLD): блок за визначенням ≤EXERCISE_BLOCK_SIZE(10) рядків,
    // тож числовий поріг ">10" ніколи не спрацював би сам по собі — та сама
    // причина, що змусила letter-gaps.tsx/letter-rearrangement.tsx (feb2f3c)
    // прибрати аналогічну умову для 2-колонкової сітки карток. Останній
    // непарний блок (напр. 3 рядки) дає нерівний поділ 2/1 — прийнятно,
    // той самий компроміс, що "зайва порожня клітинка" в сітці карток.
    const blockMid = Math.ceil(blockRows.length / 2);
    // Глобальна база нумерації цього блоку — сума довжин попередніх
    // блоків (rowBlocks), той самий принцип, що numberOffset колонок
    // columns вище, лише з "базою" попередніх блоків додатково.
    const blockBase = rowBlocks.slice(0, activeBlock).reduce((n, b) => n + b.length, 0);
    const blockColumns =
      blockRows.length > 1
        ? [
            { key: "block-col-a", rows: blockRows.slice(0, blockMid), numberOffset: blockBase },
            { key: "block-col-b", rows: blockRows.slice(blockMid), numberOffset: blockBase + blockMid },
          ]
        : [{ key: "block-col-all", rows: blockRows, numberOffset: blockBase }];

    return (
      <div className="flex flex-col gap-3">
        <TableFillColumnsGrid multiColumn={blockColumns.length > 1}>
          {blockColumns.map((col) => (
            <TableFillColumn
              key={col.key}
              rows={col.rows}
              numberOffset={col.numberOffset}
              renderCell={(rowId, side, value, points) => renderCell(rowId, side, value, points, blockDetail, !!blockResult)}
              rowPointsLabel={(row) => rowPointsLabel(row, blockDetail)}
              itemsGapClass={itemsGapClass}
            />
          ))}
        </TableFillColumnsGrid>

        <div className="flex flex-wrap items-center gap-3">
          {blockResult && (
            <TaskResult
              correct={blockResult.correct}
              pointsEarned={blockResult.pointsEarned}
              pointsPossible={blockResult.pointsPossible}
              toggleTitle={tt("panel.correctAnswers")}
              toggleCount={blockRows.length}
              hintSummary={{
                hintCount: blockDetail?.blanks.filter((b) => b.hintUsed).length ?? 0,
                reducesPoints: config.hintsReducePoints,
              }}
            >
              {blockDetail && <TaskResultAnswerRows rows={buildAnswerRows(blockRows, blockBase, blockDetail)} />}
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
    );
  }

  if (isPractice && isSceneMode) {
    const activeRows = practiceUseBlocks ? (practiceRowBlocks[practiceActiveBlock] ?? []) : practiceRows;
    const activeBlockIndex = practiceUseBlocks ? practiceActiveBlock : 0;
    const sceneCheckButtonEl = (
      <button
        type="button"
        onClick={() => submitPractice(activeRows, activeBlockIndex)}
        disabled={practiceCheck.pending}
        className={practiceUseBlocks ? "exercise-block-check-btn btn-check" : `self-start ${BUTTON_CHECK}`}
      >
        {practiceCheck.pending ? tt("button.checking") : practiceUseBlocks ? tt("button.checkBlock") : tt("button.check")}
      </button>
    );
    // Панель "Правильні відповіді" (крок 3b) — та сама TaskResult/
    // TaskResultAnswerRows, що звичайна вправа (renderBlock() вище), лише
    // дані беруть /api/exercises/practice/reveal по рядку (лениво, коли
    // студент розгортає панель), не detail. numberOffset — той самий
    // принцип, що blockBase звичайної вправи (сума довжин ПОПЕРЕДНІХ
    // блоків).
    function revealBlockAnswers(ids: string[]) {
      for (const id of ids) {
        if (!practiceCheck.revealed[id]) practiceCheck.reveal(id, true);
      }
    }
    const activeRowIds = activeRows.map((r) => r.id);
    const answersLoading = activeRowIds.some((id) => practiceCheck.revealPending[id]);
    const allCorrectInBlock = activeRowIds.length > 0 && activeRowIds.every((id) => practiceResults[id] === true);
    const practiceBlockBase = practiceUseBlocks
      ? practiceRowBlocks.slice(0, practiceActiveBlock).reduce((n, b) => n + b.length, 0)
      : 0;
    const answersPanel = practiceBlockAttempted[activeBlockIndex] ? (
      <TaskResult
        key={activeBlockIndex}
        correct={allCorrectInBlock}
        toggleTitle={tt("panel.correctAnswers")}
        toggleCount={activeRows.length}
        onOpenChange={(open) => {
          if (open) revealBlockAnswers(activeRowIds);
        }}
      >
        {answersLoading ? (
          <p className="text-sm text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
            {tt("panel.loadingAnswers")}
          </p>
        ) : (
          <TaskResultAnswerRows
            rows={buildTableFillAnswerRowsFromReveal(
              activeRows,
              practiceBlockBase,
              Object.fromEntries(activeRowIds.map((id) => [id, practiceCheck.revealed[id]]))
            )}
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
          instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.table_fill.instruction}
          subInstructionText={taskTranslationLine({ uk: config.subInstructions, en: config.subInstructionsEn }, lang, {
            uk: DEFAULT_INSTRUCTIONS.table_fill.subInstruction,
            en: DEFAULT_TRANSLATION_EN.table_fill,
          })}
        />
        {practiceUseBlocks ? (
          <BlockNavigation
            blockCount={practiceBlockCount}
            activeBlock={practiceActiveBlock}
            onChangeBlock={setPracticeActiveBlock}
            checkButton={sceneCheckButtonEl}
          >
            {/* Задача "verdict pill almost touching the cards above it" —
                рядки+answersPanel тепер ОДНА спільна обгортка
                (RESULT_ROW_GAP_CLASS, spacing.ts), не два окремих дитини
                BlockNavigation: contentRef там — звичайний div БЕЗ gap
                (щоб не зіпсувати margin-top рядка check/←/→ під ним),
                тож без цієї обгортки рядки й answersPanel торкались одне
                одного. */}
            <div className={RESULT_ROW_GAP_CLASS}>
              <div className="flex flex-col gap-2">
                {activeRows.map((row, i) => renderPracticeRow(row, practiceBlockBase + i + 1, true))}
              </div>
              {answersPanel}
            </div>
          </BlockNavigation>
        ) : (
          <>
            <div className={RESULT_ROW_GAP_CLASS}>
              <div className="flex flex-col gap-2">
                {activeRows.map((row, i) => renderPracticeRow(row, practiceBlockBase + i + 1, true))}
              </div>
              {answersPanel}
            </div>
            <div className="flex flex-col gap-2">{sceneCheckButtonEl}</div>
          </>
        )}
      </div>
    );
  }

  if (isPractice) {
    return (
      <div className={EXERCISE_STACK}>
        <div className="flex flex-col gap-2">{practiceRows.map((row, i) => renderPracticeRow(row, i + 1))}</div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => submitPractice(practiceRows)}
            disabled={practiceCheck.pending}
            className={`self-start ${BUTTON_CHECK}`}
          >
            {practiceCheck.pending ? tt("button.checking") : tt("button.check")}
          </button>
          {practiceCheck.error && <p className="text-sm text-red-600 dark:text-red-400">{practiceCheck.error}</p>}
        </div>
      </div>
    );
  }

  // ЕТАП M — кнопка "Перевірити блок" для спільного рядка check+←/→
  // (BlockNavFooter) — ті самі значення, що читає renderBlock() вище.
  const activeBlockResult = blockResults[activeBlock];
  const activeBlockPending = !!blockPending[activeBlock];
  const activeBlockRows = rowBlocks[activeBlock] ?? [];
  const activeBlockUnanswered = unfilledCellCount(activeBlockRows);
  // Єдина пілюля балів (задача "єдина пілюля балів усюди"): до перевірки —
  // бали ПОТОЧНОГО блоку/вправи (сума points рядків із прихованою
  // клітинкою — лише вони зараховуються, той самий фільтр, що
  // hiddenRows вище); після перевірки активного блоку/вправи — earned
  // sur possible + статус-чіп.
  const currentBlockPoints = (useBlocks ? activeBlockRows : config.rows)
    .filter((r) => r.left === null || r.right === null)
    .reduce((sum, r) => sum + r.points, 0);
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
      {activeBlockPending ? tt("button.checking") : tt("button.checkBlock")}
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
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.table_fill.instruction}
        subInstructionText={taskTranslationLine({ uk: config.subInstructions, en: config.subInstructionsEn }, lang, {
          uk: DEFAULT_INSTRUCTIONS.table_fill.subInstruction,
          en: DEFAULT_TRANSLATION_EN.table_fill,
        })}
        // Задача "Hint legend: keep the hint bubble always visible above
        // the task" — див. letter-rearrangement.tsx: лише isDelf лишається
        // причиною не показувати бульбашку взагалі, гасіння після
        // перевірки прибрано (воно давало порожню invisible-дірку в
        // TaskPanelHeader на мобільному).
        // Задача "Constructor: editable hint-legend field (uk/fr/en) with
        // defaults" — вчителька може перевизначити цей текст на мову
        // (config.hintLegend, task-config-builder.ts/hint-legend-field.tsx);
        // порожнє/відсутнє значення для цієї мови — дефолт із словників.
        hintText={isDelf ? null : config.hintLegend?.[lang]?.trim() || hintExplanationText("table_fill", lang)}
      />

      {!useBlocks ? (
        <>
          <TableFillColumnsGrid multiColumn={columns.length > 1}>
            {columns.map((col) => (
              <TableFillColumn
                key={col.key}
                rows={col.rows}
                numberOffset={col.numberOffset}
                renderCell={(rowId, side, value, points) => renderCell(rowId, side, value, points, singleDetail, !!single.result)}
                rowPointsLabel={(row) => rowPointsLabel(row, singleDetail)}
                itemsGapClass={itemsGapClass}
              />
            ))}
          </TableFillColumnsGrid>

          {diacritics.rect && !single.result && diacritics.activeKey && (
            <DiacriticsPopup
              rect={diacritics.rect}
              onPick={(ch) => {
                const key = diacritics.activeKey!;
                const rowId = key.slice(0, key.lastIndexOf(":"));
                const side = key.slice(key.lastIndexOf(":") + 1) as "left" | "right";
                const el = diacritics.getElement(key);
                const { value, cursor } = insertAtCursor(el, answers[key] ?? "", ch);
                updateAnswer(rowId, side, value);
                focusAndSetCursor(el, cursor);
              }}
            />
          )}

          {/* Той самий патерн, що fill-blank.tsx — список неправильних
              клітинок з правильною відповіддю під таблицею. rowIndex+сторона
              (назва колонки), бо на відміну від fill-blank тут кілька рядків і
              дві можливі приховані клітинки на рядок, самого "Пропуск N" було б
              недостатньо, щоб зрозуміти, про яку клітинку йдеться. */}
          {singleDetail && (
            <ul className="flex flex-col gap-1 text-sm">
              {singleDetail.blanks.map((b, i) =>
                b.isCorrect ? null : (
                  <li key={i} className="text-red-600 dark:text-red-400">
                    {tt("aria.row", { n: config.rows.findIndex((r) => r.id === b.rowId) + 1 })},{" "}
                    {columnLabels[b.side === "left" ? 0 : 1]}: {tt("tablefill.correctLine", { value: b.correctAnswers.join(" / ") })}
                  </li>
                )
              )}
            </ul>
          )}

          <div className="flex flex-col gap-3">
            {!single.result ? (
              <div className="flex flex-col items-start gap-2">
                <button
                  type="button"
                  onClick={() =>
                    singleCheckConfirm.attemptCheck(unfilledCellCount(config.rows), handleSubmit)
                  }
                  disabled={single.pending}
                  className={`self-start ${BUTTON_CHECK}`}
                >
                  {single.pending ? tt("button.checking") : tt("button.check")}
                </button>
                {singleCheckConfirm.confirming && (
                  <CheckConfirmBar
                    unansweredCount={unfilledCellCount(config.rows)}
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
                toggleTitle={tt("panel.correctAnswers")}
                toggleCount={config.rows.length}
                hintSummary={{
                  hintCount: singleDetail?.blanks.filter((b) => b.hintUsed).length ?? 0,
                  reducesPoints: config.hintsReducePoints,
                }}
              >
                {singleDetail && <TaskResultAnswerRows rows={buildAnswerRows(config.rows, 0, singleDetail)} />}
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
          {diacritics.rect && diacritics.activeKey && !blockResults[activeBlock] && (
            <DiacriticsPopup
              rect={diacritics.rect}
              onPick={(ch) => {
                const key = diacritics.activeKey!;
                const rowId = key.slice(0, key.lastIndexOf(":"));
                const side = key.slice(key.lastIndexOf(":") + 1) as "left" | "right";
                const el = diacritics.getElement(key);
                const { value, cursor } = insertAtCursor(el, answers[key] ?? "", ch);
                updateAnswer(rowId, side, value);
                focusAndSetCursor(el, cursor);
              }}
            />
          )}
        </BlockNavigation>
      )}
    </div>
  );
}
