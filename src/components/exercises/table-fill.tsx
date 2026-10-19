"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { TableFillPublic, TableFillDetail, TableFillAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { TaskPanelHeader } from "./task-panel-header";
import { STUDENT_BUTTON_PRIMARY, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { DiacriticsPopup, useDiacriticsPopup, insertAtCursor, focusAndSetCursor } from "./diacritics-popup";
import { hintExplanationText } from "./hint-explanation";
import { HintBulb, HintUsedBadge } from "./hint-bulb";
import { EXERCISE_STACK } from "@/lib/spacing";
import { SCORE_LABEL_CLASS } from "./score-style";
import { TaskResult, TaskResultAnswerRows, RowScorePill, shouldShowRowScorePill, rowResultAriaLabel } from "./task-result";
import { useCheckConfirm, CheckConfirmBar } from "./check-confirm";
import { TABLE_FILL_ANSWERS_TOGGLE_LABEL } from "@/lib/exercises/default-task-labels";
import { EXERCISE_BLOCK_SIZE, chunk } from "@/lib/exercises/exercise-blocks";
import { frenchNbsp } from "@/lib/text/french-typography";
import { BlockNavigation, BlockTabs } from "./block-navigation";
import { usePracticeCheck } from "./use-practice-check";

function cellKey(rowId: string, side: "left" | "right") {
  return `${rowId}:${side}`;
}

// sanitizeTableFill (sanitize.ts) уже підставляє цей самий дефолт, якщо
// його нема в конфізі — тут другий шар захисту саме на випадок конфіга, що
// оминув sanitize (напр. застарілий кеш/бандл), щоб рендер рядка заголовка
// таблиці не падав на columnLabels[0] з undefined.
const DEFAULT_COLUMN_LABELS: [string, string] = ["Французька", "Переклад"];

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

// Одна колонка вправи — або половина рядків, або вся вправа одним
// стовпцем; завжди зі своїм рядком підписів колонок (прибирається (CSS,
// table-fill-col-header--secondary) на вузьких екранах, де половини
// складаються в один стовпець — показуємо підписи лише раз, над першою).
// numberOffset — глобальний порядковий номер (у config.rows, не у межах
// цієї половини/блоку) першого рядка цієї колонки, щоб нумерація йшла
// 1..N наскрізно по обох половинах і збігалась із "Рядок N" у списку
// помилок під вправою (той самий config.rows.findIndex нижче).
function TableFillColumn({
  rows,
  columnLabels,
  renderCell,
  rowPointsLabel,
  numberOffset,
  secondaryHeader,
}: {
  rows: Row[];
  columnLabels: [string, string];
  renderCell: (rowId: string, side: "left" | "right", value: string | null, points: number) => ReactNode;
  rowPointsLabel: (row: Row) => ReactNode;
  numberOffset: number;
  secondaryHeader?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className={`table-fill-col-header ${secondaryHeader ? "table-fill-col-header--secondary" : ""}`}>
        <span className="table-fill-col-header-cell">{columnLabels[0]}</span>
        <span className="table-fill-col-header-cell">{columnLabels[1]}</span>
      </div>
      {rows.map((row, i) => {
        const scorePill = rowPointsLabel(row);
        return (
          <div
            key={row.id}
            className={`table-fill-row glass-item-card ${scorePill ? "table-fill-row--scored" : ""}`}
          >
            <span className="item-number-badge table-fill-row-num" aria-label={`Рядок ${numberOffset + i + 1}`}>
              {numberOffset + i + 1}
            </span>
            <div className="table-fill-row-cell">{renderCell(row.id, "left", row.left, row.points)}</div>
            <div className="table-fill-row-cell">{renderCell(row.id, "right", row.right, row.points)}</div>
            {scorePill && <div className="table-fill-row-score">{scorePill}</div>}
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
  const router = useRouter();

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
  const columnLabels = config.columnLabels ?? DEFAULT_COLUMN_LABELS;

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
    const practiceSet = new Set(practiceRowIds);
    const cells: TableFillAnswer["cells"] = [];
    for (const row of practiceRows) {
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
    const result = await practiceCheck.check(practiceRowIds, answer);
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

  function renderPracticeRow(row: Row) {
    const isCorrect = practiceResults[row.id];
    const locked = isCorrect !== undefined;
    const attempts = practiceFailedAttempts[row.id] ?? 0;
    const revealedAnswer = practiceCheck.revealed[row.id];

    function practiceInputClass() {
      if (!locked) return "glass-gap-shadow border-[rgba(217,183,101,0.55)] bg-white dark:bg-transparent dark:border-neutral-600";
      return isCorrect
        ? "border-green-500 bg-green-50 dark:bg-green-950/30"
        : "border-red-500 bg-red-50 dark:bg-red-950/30";
    }

    function cellField(side: "left" | "right", value: string | null) {
      if (value !== null) return <span>{frenchNbsp(value)}</span>;
      return (
        <input
          value={answers[cellKey(row.id, side)] ?? ""}
          onChange={(e) => updateAnswer(row.id, side, e.target.value)}
          disabled={locked}
          className={`w-full rounded border px-2 py-1 text-base ${practiceInputClass()}`}
        />
      );
    }

    return (
      <div
        key={row.id}
        className="flex flex-col gap-1.5 rounded border-[1.5px] dark:border glass-chip glass-gap-shadow border-[#dcbd6e] bg-white dark:bg-transparent p-2 dark:border-neutral-700"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{columnLabels[0]}</p>
            {cellField("left", row.left)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{columnLabels[1]}</p>
            {cellField("right", row.right)}
          </div>
        </div>
        {isCorrect === true && (
          <p className="text-xs font-medium text-green-600 dark:text-green-400">Правильно ✓</p>
        )}
        {isCorrect === false && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-red-600 dark:text-red-400">
              Неправильно, спробуйте ще раз (спроб: {attempts})
            </span>
            {!revealedAnswer && (
              <button
                type="button"
                onClick={() => practiceCheck.reveal(row.id, true)}
                disabled={!!practiceCheck.revealPending[row.id]}
                className={STUDENT_BUTTON_SECONDARY_TOUCH}
              >
                Показати відповідь
              </button>
            )}
          </div>
        )}
        {revealedAnswer && (
          <p className="text-xs italic text-amber-700 dark:text-amber-400">
            Правильна відповідь: {revealedAnswer.join(" / ")}
          </p>
        )}
      </div>
    );
  }

  function inputClass(rowId: string, side: "left" | "right", detail: TableFillDetail | undefined) {
    const idle = "glass-gap-shadow border-[rgba(217,183,101,0.55)] bg-white dark:bg-transparent dark:border-neutral-600";
    if (!detail)
      return hintedCells.has(cellKey(rowId, side))
        ? "border-sky-400 bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400"
        : idle;
    const blank = detail.blanks.find((b) => b.rowId === rowId && b.side === side);
    if (!blank) return idle;
    return blank.isCorrect
      ? "border-green-500 bg-green-50 dark:bg-green-950/30"
      : "border-red-500 bg-red-50 dark:bg-red-950/30";
  }

  // Рядки без жодної прихованої клітинки нема чого оцінювати — бали для них
  // не показуємо взагалі. До перевірки — лише якщо pointsVisible; після —
  // завжди. Бали рядка зараховуються, лише якщо ВСІ його приховані
  // клітинки (1 або 2) правильні — не по клітинці, як score.
  function rowPointsLabel(row: Row, detail: TableFillDetail | undefined) {
    if (hidePoints) return null;
    const hasHidden = row.left === null || row.right === null;
    if (!hasHidden) return null;

    const rowBlanks = detail?.blanks.filter((b) => b.rowId === row.id);
    if (!pointsVisible && !rowBlanks?.length) return null;

    if (rowBlanks?.length) {
      if (!shouldShowRowScorePill(row.points)) return null;
      const isCorrect = rowBlanks.every((b) => b.isCorrect);
      return <RowScorePill earned={isCorrect ? row.points : 0} possible={row.points} full={isCorrect} />;
    }
    return <span className={SCORE_LABEL_CLASS}>{`${row.points} ${pluralizePoints(row.points)}`}</span>;
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
      return (
        <span className={`table-fill-chip ${side === "left" ? "table-fill-chip-fr" : "table-fill-chip-uk"}`}>
          {frenchNbsp(value)}
        </span>
      );
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
    const ariaResultLabel = blank && !shouldShowRowScorePill(points) ? rowResultAriaLabel(blank.isCorrect) : undefined;
    return (
      <div className="flex flex-col gap-1">
        <div className="relative table-fill-cell-wrap">
          <input
            ref={diacritics.fieldRef(key)}
            value={answers[key] ?? ""}
            onChange={(e) => updateAnswer(rowId, side, e.target.value)}
            onFocus={() => diacritics.onFocus(key)}
            onBlur={diacritics.onBlur}
            disabled={locked}
            aria-label={ariaResultLabel}
            className={`table-fill-cell-input h-10 w-full rounded-[10px] border text-center text-[15px] ${hasValue ? "px-[12px]" : "px-[40px]"} ${inputClass(rowId, side, detail)}`}
          />
          {/* Лампочка-підказка ВСЕРЕДИНІ поля (мокап "варіант 1") — той
              самий золотий гурток, що ClueCardHeader кросворду,
              абсолютно позиційований у .relative-
              обгортці вище; той самий принцип, що letter-gaps.tsx (завжди
              видима, не залежить від фокуса/попапу діакритики — колишня
              лампочка DiacriticsPopup (onHint) з'являлась лише коли попап
              відкритий, тут навмисно інакше). Зникає повністю, щойно в полі
              є текст (а не стискається) — не рендериться взагалі, тож не в
              DOM, не в tab-порядку, не в a11y-дереві. */}
          {!locked && !isDelf && !hasValue && (
            <HintBulb
              state={hintedCells.has(key) ? "used" : "available"}
              label="Підказка: відкрити першу літеру"
              disabled={hintedCells.has(key) || hintPending}
              onClick={() => applyHint(rowId, side)}
              className="table-fill-input-lamp"
            />
          )}
          {hintUsed && <HintUsedBadge />}
        </div>
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
        throw new Error(body.error ?? "Помилка перевірки");
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
        [blockIndex]: e instanceof Error ? e.message : "Помилка перевірки",
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
          {blockColumns.map((col, i) => (
            <TableFillColumn
              key={col.key}
              rows={col.rows}
              columnLabels={columnLabels}
              numberOffset={col.numberOffset}
              secondaryHeader={i > 0}
              renderCell={(rowId, side, value, points) => renderCell(rowId, side, value, points, blockDetail, !!blockResult)}
              rowPointsLabel={(row) => rowPointsLabel(row, blockDetail)}
            />
          ))}
        </TableFillColumnsGrid>

        <div className="flex flex-wrap items-center gap-3">
          {blockResult && (
            <TaskResult
              correct={blockResult.correct}
              pointsEarned={blockResult.pointsEarned}
              pointsPossible={blockResult.pointsPossible}
              toggleTitle={TABLE_FILL_ANSWERS_TOGGLE_LABEL}
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

  if (isPractice) {
    return (
      <div className={EXERCISE_STACK}>
        <div className="flex flex-col gap-2">{practiceRows.map((row) => renderPracticeRow(row))}</div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={submitPractice}
            disabled={practiceCheck.pending}
            className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
          >
            {practiceCheck.pending ? "Перевіряю..." : "Перевірити"}
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
  const checkButtonEl = useBlocks ? (
    <button
      type="button"
      onClick={() => blockCheckConfirm.attemptCheck(activeBlockUnanswered, () => submitBlock(activeBlock))}
      disabled={activeBlockPending || activeBlockUnanswered === hiddenCellsOf(activeBlockRows).length}
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
      />
      <TaskPanelHeader
        blockCount={blockCount}
        activeBlock={activeBlock}
        onChangeBlock={setActiveBlock}
        isBlockChecked={(i) => i in blockResults}
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.table_fill.instruction}
        subInstructionText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.table_fill.subInstruction}
        hintText={
          isDelf || (useBlocks ? allBlocksChecked : !!single.result)
            ? null
            : hintExplanationText("table_fill")
        }
      />

      {!useBlocks ? (
        <>
          <TableFillColumnsGrid multiColumn={columns.length > 1}>
            {columns.map((col, i) => (
              <TableFillColumn
                key={col.key}
                rows={col.rows}
                columnLabels={columnLabels}
                numberOffset={col.numberOffset}
                secondaryHeader={i > 0}
                renderCell={(rowId, side, value, points) => renderCell(rowId, side, value, points, singleDetail, !!single.result)}
                rowPointsLabel={(row) => rowPointsLabel(row, singleDetail)}
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
                    Рядок {config.rows.findIndex((r) => r.id === b.rowId) + 1},{" "}
                    {columnLabels[b.side === "left" ? 0 : 1]}: правильно — {b.correctAnswers.join(" / ")}
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
                  disabled={
                    single.pending ||
                    unfilledCellCount(config.rows) === hiddenCellsOf(config.rows).length
                  }
                  className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
                >
                  {single.pending ? "Перевіряю..." : "Перевірити"}
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
                toggleTitle={TABLE_FILL_ANSWERS_TOGGLE_LABEL}
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
