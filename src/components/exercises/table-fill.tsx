"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import type { TableFillPublic, TableFillDetail, TableFillAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { DiacriticsPopup, useDiacriticsPopup, insertAtCursor, focusAndSetCursor } from "./diacritics-popup";
import { HintExplanation } from "./hint-explanation";
import { EXERCISE_STACK } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";
import { EXERCISE_BLOCK_SIZE, chunk } from "@/lib/exercises/exercise-blocks";
import { BlockNavigation } from "./block-navigation";

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
// стовпцем; завжди зі своїм рядком підписів колонок.
function TableFillColumn({
  rows,
  columnLabels,
  renderCell,
  rowPointsLabel,
}: {
  rows: Row[];
  columnLabels: [string, string];
  renderCell: (rowId: string, side: "left" | "right", value: string | null) => ReactNode;
  rowPointsLabel: (row: Row) => string | null;
}) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-base">
          <thead>
            <tr className="border-b border-gray-200 text-left text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              <th className="py-1 pr-2 font-medium">{columnLabels[0]}</th>
              <th className="py-1 pr-2 font-medium">{columnLabels[1]}</th>
              <th className="py-1 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-200 last:border-0 dark:border-neutral-700">
                <td className="py-1 pr-2">{renderCell(row.id, "left", row.left)}</td>
                <td className="py-1 pr-2">{renderCell(row.id, "right", row.right)}</td>
                <td className={`py-1 ${SCORE_LABEL_CLASS}`}>{rowPointsLabel(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TableFillExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
  isDelf,
}: {
  taskId: string;
  config: TableFillPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  // Задача належить DELF-тесту — підказки повністю вимкнені (той самий
  // принцип, що fill-blank.tsx).
  isDelf?: boolean;
}) {
  // answers/hintedCells — СПІЛЬНІ на всю вправу (не по блоку), як pairs у
  // matching.tsx.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hintedCells, setHintedCells] = useState<Set<string>>(new Set());
  const [hintPending, setHintPending] = useState(false);
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

  useEffect(() => {
    if (!useBlocks && single.result) onResult?.(single.result);
  }, [useBlocks, single.result, onResult]);

  function inputClass(rowId: string, side: "left" | "right", detail: TableFillDetail | undefined) {
    const idle = "border-gray-300 dark:border-neutral-600";
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
      const isCorrect = rowBlanks.every((b) => b.isCorrect);
      return `${isCorrect ? row.points : 0}/${row.points} ${pluralizePoints(row.points)}`;
    }
    return `${row.points} ${pluralizePoints(row.points)}`;
  }

  function renderCell(
    rowId: string,
    side: "left" | "right",
    value: string | null,
    detail: TableFillDetail | undefined,
    locked: boolean
  ) {
    if (value !== null) {
      return <span>{value}</span>;
    }
    const key = cellKey(rowId, side);
    const hintUsed = detail?.blanks.find((b) => b.rowId === rowId && b.side === side)?.hintUsed;
    return (
      <div className="flex items-center gap-1">
        <input
          ref={diacritics.fieldRef(key)}
          value={answers[key] ?? ""}
          onChange={(e) => updateAnswer(rowId, side, e.target.value)}
          onFocus={() => diacritics.onFocus(key)}
          onBlur={diacritics.onBlur}
          disabled={locked}
          className={`w-full rounded border px-2 py-1 text-base ${inputClass(rowId, side, detail)}`}
        />
        {/* Статична лампочка одразу біля поля — той самий принцип, що
            letter-gaps.tsx (окрема кнопка на кожній картці, завжди видима,
            не залежить від фокуса/попапу діакритики). Раніше лампочка була
            ЧАСТИНОЮ DiacriticsPopup (onHint), тож з'являлась лише коли
            попап відкритий (фокус на полі) — не позиційний глюк, а сама
            умова рендеру попапу (diacritics.rect && ... && activeKey) також
            гейтила лампочку. */}
        {!locked && !isDelf && (
          <button
            type="button"
            title="Підказка: відкрити першу літеру"
            aria-label="Підказка: відкрити першу літеру"
            disabled={hintedCells.has(key) || hintPending}
            onClick={() => applyHint(rowId, side)}
            className="shrink-0 rounded p-1 text-amber-500 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-amber-950/30"
          >
            <Lightbulb size={14} />
          </button>
        )}
        {hintUsed && <span className="shrink-0 text-xs italic text-amber-600 dark:text-amber-400">з підказкою</span>}
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
  let columns: { key: string; rows: Row[] }[];
  if (!useBlocks && config.rows.length > SPLIT_THRESHOLD) {
    const mid = Math.ceil(config.rows.length / 2);
    columns = [
      { key: "col-a", rows: config.rows.slice(0, mid) },
      { key: "col-b", rows: config.rows.slice(mid) },
    ];
  } else {
    columns = [{ key: "all", rows: config.rows }];
  }

  // ==== Гілка блоків (>10 рядків) ====
  const [activeBlock, setActiveBlock] = useState(0);
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
        body: JSON.stringify({ taskId, answer }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Помилка перевірки");
      }
      const result = (await res.json()) as TableFillResult;
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
    const blockRows = rowBlocks[activeBlock];
    const blockResult = blockResults[activeBlock];
    const blockDetail = blockResult?.detail;
    const isPending = !!blockPending[activeBlock];
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
    const blockColumns =
      blockRows.length > 1
        ? [
            { key: "block-col-a", rows: blockRows.slice(0, blockMid) },
            { key: "block-col-b", rows: blockRows.slice(blockMid) },
          ]
        : [{ key: "block-col-all", rows: blockRows }];

    return (
      <div className="flex flex-col gap-3">
        <div
          className={`mx-auto w-full ${
            blockColumns.length > 1
              ? "grid max-w-5xl grid-cols-1 items-start gap-x-8 gap-y-6 md:grid-cols-2"
              : "max-w-3xl"
          }`}
        >
          {blockColumns.map((col) => (
            <TableFillColumn
              key={col.key}
              rows={col.rows}
              columnLabels={columnLabels}
              renderCell={(rowId, side, value) => renderCell(rowId, side, value, blockDetail, !!blockResult)}
              rowPointsLabel={(row) => rowPointsLabel(row, blockDetail)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => submitBlock(activeBlock)}
            disabled={isPending}
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
                  ({blockResult.pointsEarned} з {blockResult.pointsPossible} {pluralizePoints(blockResult.pointsPossible)})
                </span>
              )}
            </p>
          )}
        </div>
        {errMsg && <p className="text-sm text-red-600 dark:text-red-400">{errMsg}</p>}
      </div>
    );
  }

  return (
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.table_fill.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.table_fill.subInstruction}
      />

      <HintExplanation
        type="table_fill"
        hintsReducePoints={config.hintsReducePoints}
        hidden={!!isDelf || (useBlocks ? allBlocksChecked : !!single.result)}
      />

      {!useBlocks ? (
        <>
          <div
            className={`mx-auto w-full ${
              columns.length > 1
                ? "grid max-w-5xl grid-cols-1 items-start gap-x-8 gap-y-6 md:grid-cols-2"
                : "max-w-3xl"
            }`}
          >
            {columns.map((col) => (
              <TableFillColumn
                key={col.key}
                rows={col.rows}
                columnLabels={columnLabels}
                renderCell={(rowId, side, value) => renderCell(rowId, side, value, singleDetail, !!single.result)}
                rowPointsLabel={(row) => rowPointsLabel(row, singleDetail)}
              />
            ))}
          </div>

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
              <button
                type="button"
                onClick={handleSubmit}
                disabled={single.pending}
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
