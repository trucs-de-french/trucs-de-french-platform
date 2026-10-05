"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Lightbulb } from "lucide-react";
import { HintExplanation } from "./hint-explanation";
import type {
  CrosswordPublic,
  CrosswordPublicBlock,
  CrosswordDetail,
  CrosswordAnswer,
  GradeResult,
} from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { useScrollOverflowHint } from "./use-scroll-overflow-hint";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { ImageZoomBadge } from "./image-zoom-badge";
import { ImageLightbox } from "./image-lightbox";
import { DiacriticsPopup, useDiacriticsPopup } from "./diacritics-popup";
import { LEGEND_TILE_BASE, LEGEND_TILE_GRID } from "./legend-tile-style";
import { resolveClueView } from "./resolve-clue-view";
import { EXERCISE_INSTRUCTION, EXERCISE_SUBINSTRUCTION, CLUE_TEXT, HINT_TEXT } from "@/lib/typography-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { gridCellSize } from "./grid-cell-size";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";
import { BlockNavigation } from "./block-navigation";

type Direction = "horizontal" | "vertical";
type ClueKey = `${Direction}-${number}`;
type CrosswordBlockResult = Extract<GradeResult, { detail: CrosswordDetail }>;

// CrosswordAnswer тепер — формат ЗАПИТУ на сервер ({grid, hintedWords}), не
// внутрішній стан компонента: сітка студента живе окремо (grid нижче, звичайний
// string[][]), hintedWords збирається окремим Set при сабміті.
function emptyGrid(width: number, height: number): string[][] {
  return Array.from({ length: height }, () => Array(width).fill(""));
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

// Позиції клітинок кожної підказки НЕ передаються студенту напряму
// (CrosswordPublicBlock несе лише форму+номери+довжину) — відновлюються
// тут: клітинка зі cellNumbers[r][c] === number — старт, далі "довжина"
// клітинок у напрямку підказки. Нумерація — у межах ЦЬОГО блоку (з 1,
// generateCrosswordGrid рахує її окремо для кожного блоку) — той самий
// принцип, що placementCells у crossword-grid.ts, лише в зворотну сторону
// (з номера, не з координат).
function buildClueCells(block: CrosswordPublicBlock): Map<ClueKey, { row: number; col: number }[]> {
  const map = new Map<ClueKey, { row: number; col: number }[]>();
  const clueLists: { direction: Direction; clues: CrosswordPublicBlock["across"] }[] = [
    { direction: "horizontal", clues: block.across },
    { direction: "vertical", clues: block.down },
  ];
  for (const { direction, clues } of clueLists) {
    for (const clue of clues) {
      let start: { row: number; col: number } | null = null;
      outer: for (let r = 0; r < block.gridHeight; r++) {
        for (let c = 0; c < block.gridWidth; c++) {
          if (block.cellNumbers[r][c] === clue.number) {
            start = { row: r, col: c };
            break outer;
          }
        }
      }
      if (!start) continue;
      const d = direction === "horizontal" ? { row: 0, col: 1 } : { row: 1, col: 0 };
      const cells = Array.from({ length: clue.length }, (_, i) => ({
        row: start!.row + d.row * i,
        col: start!.col + d.col * i,
      }));
      map.set(`${direction}-${clue.number}`, cells);
    }
  }
  return map;
}

// Один блок — власний кросворд, власна 2D-мапа клітинка→літера, власні
// підказки/активне слово/діакритичний попап — НІКОЛИ не розмонтовується
// при перемиканні вкладок (CrosswordExercise ховає неактивні через
// className "hidden"). blockIndex undefined — вправа з ОДНИМ блоком:
// позначка в CrosswordAnswer не надсилається (байтова відповідність
// поведінці до появи блоків), кнопка "Перевірити" без варіанту "ще раз".
// Перша клітинка НЕ фокусується автоматично при показі блоку (жодного
// autoFocus/scrollIntoView тут) — лише явний клік/тап студента задає
// activeClue.
function CrosswordBlockView({
  taskId,
  block,
  blockIndex,
  active,
  isDelf,
  onResult,
}: {
  taskId: string;
  block: CrosswordPublicBlock;
  blockIndex?: number;
  active: boolean;
  isDelf?: boolean;
  onResult: (result: CrosswordBlockResult) => void;
}) {
  const [grid, setGrid] = useState<string[][]>(() => emptyGrid(block.gridWidth, block.gridHeight));
  const [activeClue, setActiveClue] = useState<{ direction: Direction; number: number } | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollHint = useScrollOverflowHint(scrollRef, active);
  // hintedCells — клітинки, що ЗАРАЗ тримають значення, вписане підказкою
  // (синя підсвітка "відкрито підказкою", пріоритетна над зеленою/червоною);
  // прибирається з клітинки, якщо студент сам перетипував її (updateLetter).
  // hintedWords ("напрямок-номер") — чи хоч РАЗ використали підказку на
  // цьому слові за весь час, незалежно від подальших правок — саме це йде
  // на сервер (CrosswordAnswer.hintedWords) для розрахунку балів.
  const [hintedCells, setHintedCells] = useState<Set<string>>(new Set());
  const [hintedWords, setHintedWords] = useState<Set<string>>(new Set());
  // Спільний хук (diacritics-popup.tsx) — ключ "row,col" на кожну клітинку.
  // Той самий інстанс дає й реф для програмного .focus() (автоперехід
  // вперед/назад — не пов'язано з попапом самим по собі, але той самий
  // Map зручно перевикористати), і позицію для DiacriticsPopup.
  const diacritics = useDiacriticsPopup<string>();
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const allowRecheck = blockIndex !== undefined;

  useEffect(() => {
    if (result) onResult(result as CrosswordBlockResult);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const clueCells = useMemo(() => buildClueCells(block), [block]);

  // Слово(-а), що проходять через кожну клітинку — та сама мапа clueCells,
  // інвертована. Потрібна і для підсвітки активної підказки, і для живого
  // кольору клітинки (клітинка на перетині належить двом словам одразу —
  // обидва завжди узгоджені щодо ПРАВИЛЬНОЇ літери, бо генератор дозволяє
  // перетин лише з тим самим символом, але студент міг ввести туди хибну
  // літеру, тож cellLiveStatus нижче все одно звіряє по слову, не по
  // клітинці).
  const wordsAtCell = useMemo(() => {
    const map = new Map<string, { direction: Direction; number: number }[]>();
    for (const [key, cells] of clueCells) {
      const [direction, numberStr] = key.split("-") as [Direction, string];
      const number = Number(numberStr);
      for (const { row, col } of cells) {
        const ck = `${row},${col}`;
        const list = map.get(ck) ?? [];
        list.push({ direction, number });
        map.set(ck, list);
      }
    }
    return map;
  }, [clueCells]);

  function updateLetter(row: number, col: number, value: string) {
    const letter = (value.slice(-1) || "").toUpperCase();
    setGrid((prev) => prev.map((r, ri) => (ri === row ? r.map((v, ci) => (ci === col ? letter : v)) : r)));
    // Студент сам перетипував клітинку — вона більше не "щойно відкрита
    // підказкою" візуально (hintedWords, для балів, лишається незмінним —
    // підказку вже було використано на цьому слові, факт не скасовується).
    setHintedCells((prev) => {
      if (!prev.has(cellKey(row, col))) return prev;
      const next = new Set(prev);
      next.delete(cellKey(row, col));
      return next;
    });

    // Автоперехід — лише вперед, лише коли справді ввели символ (не
    // стирання) і є активне слово. Клітинка на перетині лишається "своєю"
    // для того слова, яке зараз активне (activeClue), незалежно від того,
    // що вона могла б належати й іншому — той самий принцип, що вже в
    // isActiveCell/onFocus нижче.
    if (letter && activeClue) {
      const cells = clueCells.get(`${activeClue.direction}-${activeClue.number}`) ?? [];
      const index = cells.findIndex((c) => c.row === row && c.col === col);
      if (index >= 0) {
        // Пропускаємо клітинки, які вже правильно заповнені через
        // перетин з іншим (уже завершеним) словом — студент продовжує
        // друкувати підряд, не наштовхуючись на них уручну. Клітинка з
        // ПОМИЛКОЮ (заповнена, але не збігається з розв'язком) НЕ
        // пропускається — саме на ній варто зупинитись і привернути увагу.
        let nextIndex = index + 1;
        while (nextIndex < cells.length) {
          const c = cells[nextIndex];
          const filledCorrectly = grid[c.row][c.col] !== "" && grid[c.row][c.col] === block.solution[c.row][c.col];
          if (!filledCorrectly) break;
          nextIndex++;
        }
        const next = cells[nextIndex];
        if (next) {
          diacritics.getElement(cellKey(next.row, next.col))?.focus();
        }
      }
    }
  }

  // Backspace на ВЖЕ порожній клітинці — переходимо на попередню клітинку
  // активного слова й очищуємо ЇЇ (стандартна поведінка кросвордів). Якщо
  // клітинка НЕ порожня — нічого тут не робимо: браузер сам згенерує
  // onChange із порожнім значенням, updateLetter його вже обробляє (без
  // автопереходу, бо letter буде порожній рядок), фокус лишається на місці.
  function handleBackspace(row: number, col: number) {
    if (grid[row][col] !== "") return;
    if (!activeClue) return;
    const cells = clueCells.get(`${activeClue.direction}-${activeClue.number}`) ?? [];
    const index = cells.findIndex((c) => c.row === row && c.col === col);
    const prev = index > 0 ? cells[index - 1] : undefined;
    if (!prev) return;
    // Очищуємо ПОПЕРЕДНЮ клітинку лише якщо вона й так порожня (стирати
    // нема чого — по суті no-op). Якщо там уже стоїть літера — навіть з
    // ІНШОГО слова через перетин — лишаємо як є: фокус переходить туди,
    // але сам символ видаляється лише наступним явним Backspace, коли
    // курсор буде САМЕ на цій клітинці, а не одразу під час переходу.
    if (grid[prev.row][prev.col] === "") {
      setGrid((p) => p.map((r, ri) => (ri === prev.row ? r.map((v, ci) => (ci === prev.col ? "" : v)) : r)));
    }
    diacritics.getElement(cellKey(prev.row, prev.col))?.focus();
  }

  function isActiveCell(row: number, col: number): boolean {
    if (!activeClue) return false;
    const cells = clueCells.get(`${activeClue.direction}-${activeClue.number}`) ?? [];
    return cells.some((c) => c.row === row && c.col === col);
  }

  // Слово ПОВНІСТЮ заповнене (кожна клітинка непорожня) — спільна передумова
  // і для liveWordStatus (підказка в списку), і для cellLiveStatus (сама
  // клітинка): без неї кожна ще не дописана літера вже підсвічувалась би,
  // не чекаючи завершення слова.
  function isWordFilled(direction: Direction, number: number): boolean {
    const cells = clueCells.get(`${direction}-${number}`) ?? [];
    return cells.length > 0 && cells.every((c) => grid[c.row][c.col] !== "");
  }

  // На рівні ЦІЛОГО слова — лише для закреслення підказки в списку
  // (renderClueColumn), не для кольору клітинок у сітці (те — cellLiveStatus
  // нижче, посимвольно). Рахується напряму з grid проти block.solution,
  // без запиту на сервер і незалежно від кнопки "Перевірити"/grade.ts. Той
  // самий предикат "усі клітинки слова правильні" вимикає кнопку підказки
  // (renderClueCard/renderClueFlat) — нема чого відкривати далі.
  function liveWordStatus(direction: Direction, number: number): "correct" | "incorrect" | null {
    if (!isWordFilled(direction, number)) return null;
    const cells = clueCells.get(`${direction}-${number}`) ?? [];
    const allCorrect = cells.every((c) => grid[c.row][c.col] === block.solution[c.row][c.col]);
    return allCorrect ? "correct" : "incorrect";
  }

  // Перша клітинка слова, де grid ще не збігається з розв'язком (незалежно
  // від того, порожня вона чи заповнена НЕправильно) — ціль наступного
  // натискання лампочки. null — усі клітинки слова вже правильні (кнопка
  // неактивна, "Якщо всі літери слова вже правильні").
  function nextHintCell(direction: Direction, number: number): { row: number; col: number } | null {
    const cells = clueCells.get(`${direction}-${number}`) ?? [];
    return cells.find((c) => grid[c.row][c.col] !== block.solution[c.row][c.col]) ?? null;
  }

  // Вписує правильну літеру в ПЕРШУ ще не відкриту/не заповнену правильно
  // клітинку слова — фокус НЕ переміщується (на відміну від updateLetter),
  // студент лишається там, де друкував.
  function applyHint(direction: Direction, number: number) {
    const target = nextHintCell(direction, number);
    if (!target) return;
    const letter = block.solution[target.row][target.col];
    setGrid((prev) =>
      prev.map((r, ri) => (ri === target.row ? r.map((v, ci) => (ci === target.col ? letter : v)) : r))
    );
    setHintedCells((prev) => new Set(prev).add(cellKey(target.row, target.col)));
    setHintedWords((prev) => new Set(prev).add(`${direction}-${number}`));
  }

  // Посимвольно — на відміну від liveWordStatus, тут перевіряється ЛИШЕ ЦЯ
  // клітинка (не все слово): якщо слово, що через неї проходить, ПОВНІСТЮ
  // заповнене, а сама клітинка не збігається з розв'язком — червона лише
  // вона, сусідні правильні клітинки того самого слова лишаються
  // нейтральними. Клітинка на перетині належить двом словам одразу —
  // "неправильно" має пріоритет над "правильно" (не приховувати помилку
  // одного напрямку лише тому, що інший напрямок через ту саму клітинку
  // вже зійшовся).
  function cellLiveStatus(row: number, col: number): "correct" | "incorrect" | null {
    const words = wordsAtCell.get(`${row},${col}`) ?? [];
    let anyCorrect = false;
    for (const w of words) {
      if (!isWordFilled(w.direction, w.number)) continue;
      if (grid[row][col] === block.solution[row][col]) {
        anyCorrect = true;
      } else {
        return "incorrect";
      }
    }
    return anyCorrect ? "correct" : null;
  }

  function handleSubmit() {
    const answer: CrosswordAnswer = {
      grid,
      hintedWords: [...hintedWords].map((key) => {
        const [direction, numberStr] = key.split("-") as [Direction, string];
        return { number: Number(numberStr), direction };
      }),
      ...(blockIndex !== undefined ? { blockIndex } : {}),
    };
    submit(answer);
  }

  // Max(ширина, висота) — та сама логіка "розмір за стороною", що
  // word_search, лише крос-ворд не завжди квадратний (органічна форма, не
  // попередньо задана сітка) — довша сторона визначає, наскільки тісно.
  // Рахується за розміром САМЕ ЦЬОГО блоку (split-into-blocks.ts), не
  // всієї вправи.
  const cellSize = gridCellSize(Math.max(block.gridWidth, block.gridHeight));

  // Текст підказки — той самий колір/закреслення для ОБОХ форм (картка й
  // плаский текст), лише навколишня розмітка різна.
  function clueTextClass(liveStatus: "correct" | "incorrect" | null): string {
    return liveStatus === "correct"
      ? "text-green-600 line-through dark:text-green-400"
      : liveStatus === "incorrect"
        ? "text-red-600 dark:text-red-400"
        : "";
  }

  // Картка — той самий LEGEND_TILE_BASE (тонка рамка, без тіні), що вже в
  // легенді Філворда (word_search): для підказок із clueStyle === "long"
  // АБО картинкою/аудіо (картинка/аудіо завжди в картці, незалежно від
  // clueStyle — той принцип не змінюється цим перемикачем).
  // hideText — ЕТАП A/3, clueMode "image": текст підказки прихований, лишається
  // лише номер (студент і так бачить, якому слову відповідає картка — той
  // самий номер є на самій сітці) + картинка/аудіо. За замовчуванням false —
  // рівно попередня розмітка (clue.number ТА clue.clue поруч), байтово.
  function renderClueCard(
    direction: Direction,
    clue: CrosswordPublicBlock["across"][number],
    hideText = false,
    // ЕТАП D, п.3 — clueMode "long": текст по лівому краю, картка не
    // колонкою по центру, а рядком (картинка зліва, текст/аудіо праворуч,
    // якщо картинка є). Усі інші режими (short/image/легасі) — байтово той
    // самий центрований вигляд, що був.
    sentenceMode = false
  ) {
    const liveStatus = liveWordStatus(direction, clue.number);
    const isActive = activeClue?.direction === direction && activeClue.number === clue.number;
    const hasImage = !!clue.imageUrl;
    // ЕТАП D, п.1 — картинка в картці підказки: 56×56 → 80×80 (72×72 на
    // телефоні), решта картки без змін. Статичний клас (arbitrary value
    // 72px — Tailwind не має стандартного кроку між 64 і 80).
    const image = (
      <span className="relative shrink-0">
        <ImageZoomBadge onOpen={() => setLightboxSrc(clue.imageUrl!)} />
        <ImageOrPlaceholder
          src={clue.imageUrl}
          alt=""
          className="h-[72px] w-[72px] rounded object-cover sm:h-20 sm:w-20"
          useFocus
        />
      </span>
    );
    return (
      <div
        key={clue.number}
        role="button"
        tabIndex={0}
        onClick={() => setActiveClue(isActive ? null : { direction, number: clue.number })}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setActiveClue(isActive ? null : { direction, number: clue.number });
          }
        }}
        className={`${LEGEND_TILE_BASE} flex cursor-pointer py-2 transition-colors ${
          sentenceMode
            ? `pl-3 pr-9 items-start gap-2 text-left ${hasImage ? "flex-row" : "flex-col"}`
            : "pl-3 pr-7 flex-col items-center gap-1 text-center"
        } ${
          liveStatus === "correct"
            ? "border-green-500 bg-green-50 dark:bg-green-950/30"
            : isActive
              ? "border-blue-400 bg-blue-50 dark:bg-blue-950/40"
              : "hover:bg-neutral-50 dark:hover:bg-neutral-800/70"
        }`}
      >
        {!result && !isDelf && (
          <button
            type="button"
            title="Підказка: відкрити наступну літеру"
            aria-label="Підказка: відкрити наступну літеру"
            disabled={liveStatus === "correct"}
            onClick={(e) => {
              e.stopPropagation();
              applyHint(direction, clue.number);
            }}
            className="absolute right-1 top-1 rounded p-0.5 text-amber-500 before:absolute before:-inset-3 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-amber-950/30"
          >
            <Lightbulb size={14} />
          </button>
        )}
        {sentenceMode && hasImage && image}
        <div className={sentenceMode && hasImage ? "flex-1" : "contents"}>
          <span className={`${CLUE_TEXT} ${clueTextClass(liveStatus)}`}>
            <span className="font-body font-semibold">{clue.number}.</span>{!hideText && <> {clue.clue}</>}
          </span>
          {clue.audioUrl && (
            <audio controls src={clue.audioUrl} className="mt-1 h-6 w-full" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
        {!(sentenceMode && hasImage) && hasImage && image}
      </div>
    );
  }

  // Плаский текст (без рамки/тіні) — для короткої підказки (clueStyle
  // "short" чи не вказано) БЕЗ картинки/аудіо. Рядкова розкладка (flex-wrap
  // на батьківському контейнері, не вертикальний список) — номер БЕЗ
  // фіксованої ширини/вирівнювання в колонку (це мало сенс лише у
  // вертикальному списку, тут кожна підказка самостійний "чіп" у потоці),
  // впритул до свого тексту (gap-1.5). Номер — whitespace-nowrap (сам по
  // собі й так короткий, "3." ніколи не переноситься); текст підказки БЕЗ
  // nowrap — якщо трапиться довгий, перенос відбудеться всередині самого
  // тексту, а не між номером і текстом (номер — окремий флекс-елемент на
  // початку рядка, лишається на місці, поки текст переноситься під ним).
  function renderClueFlat(direction: Direction, clue: CrosswordPublicBlock["across"][number]) {
    const liveStatus = liveWordStatus(direction, clue.number);
    const isActive = activeClue?.direction === direction && activeClue.number === clue.number;
    return (
      <div
        key={clue.number}
        role="button"
        tabIndex={0}
        onClick={() => setActiveClue(isActive ? null : { direction, number: clue.number })}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setActiveClue(isActive ? null : { direction, number: clue.number });
          }
        }}
        className={`flex cursor-pointer items-baseline gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
          isActive && !liveStatus ? "bg-blue-50 dark:bg-blue-950/40" : ""
        } ${clueTextClass(liveStatus)}`}
      >
        {/* Клас шрифту прямо на кожному <span> (font-body тут, CLUE_TEXT
            нижче), НЕ на кореневому елементі: глобальне button{font-family:var(--font-heading)} (globals.css)
            неlayered CSS — за правилами cascade layers таке правило
            переважає БУДЬ-яке правило з @layer (а Tailwind-утиліти, разом
            з .font-body з CLUE_TEXT, лежать саме в @layer utilities),
            незалежно від специфічності класу. Якби CLUE_TEXT стояв на
            самому кореневому елементі, він програвав би цьому тег-правилу саме на
            рівні шарів каскаду (не специфічності) — тому клас на
            дочірньому <span> (якого тег-правило взагалі не стосується
            напряму) — єдиний надійний спосіб перебити успадкований Nunito. */}
        <span className="whitespace-nowrap font-body text-sm font-semibold">{clue.number}.</span>
        <span className={CLUE_TEXT}>{clue.clue}</span>
        {!result && !isDelf && (
          <button
            type="button"
            title="Підказка: відкрити наступну літеру"
            aria-label="Підказка: відкрити наступну літеру"
            disabled={liveStatus === "correct"}
            onClick={(e) => {
              e.stopPropagation();
              applyHint(direction, clue.number);
            }}
            className="relative rounded p-0.5 text-amber-500 before:absolute before:-inset-3 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-amber-950/30"
          >
            <Lightbulb size={13} />
          </button>
        )}
      </div>
    );
  }

  // Картки (LEGEND_TILE_GRID — фіксована кількість рівних колонок, той
  // самий вигляд, що у Філворді; НЕ auto-fill/minmax — той розтягував
  // картки неповного рядка на всю ширину) і плаский текст — ДВІ окремі
  // однорідні ділянки в межах секції, не одна змішана сітка: короткий
  // текстовий рядок у тій самій клітинці зламав би вирівнювання —
  // натомість короткі підказки йдуть рядком (flex-wrap) під блоком карток:
  // gap-x-8 між підказками по горизонталі, gap-y-2 між рядками при переносі
  // (не gap-y-0.5 впритул, як був проміжний варіант).
  function renderClueSection(direction: Direction, clues: CrosswordPublicBlock["across"], title: string) {
    if (clues.length === 0) return null;

    // block.clueMode не заданий — ІСНУЮЧА (до ЕТАПУ A) гілка без змін:
    // clueStyle "long" чи картинка/аудіо самого слова вирішують картка/
    // плаский рядок, байтово той самий код.
    if (!block.clueMode) {
      const needsCard = (clue: CrosswordPublicBlock["across"][number]) =>
        clue.clueStyle === "long" || !!clue.imageUrl || !!clue.audioUrl;
      const cardClues = clues.filter(needsCard);
      const flatClues = clues.filter((clue) => !needsCard(clue));
      return (
        <div className="w-full">
          <p className="mb-2 font-heading text-sm font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{title}</p>
          {cardClues.length > 0 && (
            <div className={LEGEND_TILE_GRID}>
              {cardClues.map((clue) => renderClueCard(direction, clue))}
            </div>
          )}
          {flatClues.length > 0 && (
            <div className={`flex flex-wrap gap-x-8 gap-y-2 ${cardClues.length > 0 ? "mt-2" : ""}`}>
              {flatClues.map((clue) => renderClueFlat(direction, clue))}
            </div>
          )}
        </div>
      );
    }

    // block.clueMode заданий — переозначає вигляд УСІХ підказок напрямку
    // (resolveClueView, resolve-clue-view.ts): "long" — картки на всю
    // ширину рядка (не колонками, як LEGEND_TILE_GRID), "image"/"short" —
    // той самий LEGEND_TILE_GRID, що й раніше.
    const mode = block.clueMode;
    const views = clues.map((clue) => ({ clue, view: resolveClueView(mode, clue) }));
    const cardViews = views.filter((v) => v.view !== "text-compact");
    const flatClues = views.filter((v) => v.view === "text-compact").map((v) => v.clue);
    const cardGridClass = mode === "long" ? "flex flex-col gap-2" : LEGEND_TILE_GRID;
    return (
      <div className="w-full">
        <p className="mb-2 font-heading text-sm font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{title}</p>
        {cardViews.length > 0 && (
          <div className={cardGridClass}>
            {cardViews.map(({ clue, view }) =>
              renderClueCard(direction, clue, view === "image-card", mode === "long")
            )}
          </div>
        )}
        {flatClues.length > 0 && (
          <div className={`flex flex-wrap gap-x-8 gap-y-2 ${cardViews.length > 0 ? "mt-2" : ""}`}>
            {flatClues.map((clue) => renderClueFlat(direction, clue))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Внутрішній відступ вправи (не входить у систему відступів сторінки,
          src/lib/spacing.ts, — та зумисно лишається поза нею): зазор між
          сіткою й панеллю підказок під нею. */}
      <div className="flex flex-col items-center gap-3">
        <div ref={scrollRef} className="max-w-full overflow-x-auto" style={{ touchAction: "pan-x pan-y" }}>
          {/* drop-shadow (filter), НЕ box-shadow — на відміну від word-search
              (суцільно заповнена сітка, box-shadow там коректно повторює
              прямокутник), тут частина клітинок ЗАБЛОКОВАНА й невидима
              (bg-transparent, border-none, стиль crosswordlabs.com) — форма
              слів нерівна. box-shadow завжди йде по прямокутній рамці
              елемента незалежно від прозорих ділянок усередині; drop-shadow
              рахується з альфа-каналу відрендереного вмісту й слідує за
              РЕАЛЬНО видимою (непрозорою) формою — саме контуром слів, а не
              контуром контейнера. Той самий inline-block-шар, що й раніше
              (лише сітка, без сусідніх елементів, — needed для того самого
              обходу border-collapse, що вже в word-search.tsx). */}
          <div className="inline-block drop-shadow-md">
            {/* font-heading — сітка тепер на тому самому шрифті, що інтерфейс
                (Nunito), не на моноширинному Geist Mono. На <table> цього
                досить для номерів клітинок (звичайний <span>, успадковує),
                але НЕ для самого <input> нижче — глобальне правило
                "input { font-family: var(--font-heading) }" (globals.css)
                звертається до input НАПРЯМУ (не через успадкування), тож
                клас однаково треба продублювати прямо на className інпута
                (тут це вже той самий шрифт, тому дублювання суто заради
                стабільності на випадок майбутньої зміни правила). */}
            <table className="border-collapse font-heading">
              <tbody>
                {block.openCells.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((open, ci) => {
                      if (!open) {
                        // Стиль crosswordlabs.com — заблокована клітинка
                        // невидима (без рамки/фону), а не чорний квадрат;
                        // клітинка й далі займає своє місце в grid-розкладці
                        // (порожній <td>, не display:none) — сітка лишається
                        // прямокутною, лише "неправильна форма" видима.
                        return <td key={ci} className={`border-none bg-transparent ${cellSize.box}`} />;
                      }
                      const number = block.cellNumbers[ri][ci];
                      const status = cellLiveStatus(ri, ci);
                      return (
                        <td
                          key={ci}
                          className={`relative border border-neutral-300 p-0 dark:border-neutral-700 ${cellSize.box}`}
                        >
                          {number !== null && (
                            <span className="pointer-events-none absolute left-0.5 top-0 text-[8px] leading-none text-neutral-500 dark:text-neutral-400">
                              {number}
                            </span>
                          )}
                          <input
                            ref={diacritics.fieldRef(cellKey(ri, ci))}
                            maxLength={1}
                            value={grid[ri][ci]}
                            onChange={(e) => updateLetter(ri, ci, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Backspace") handleBackspace(ri, ci);
                            }}
                            onFocus={() => {
                              diacritics.onFocus(cellKey(ri, ci));
                              const words = wordsAtCell.get(`${ri},${ci}`) ?? [];
                              if (words.length > 0 && !isActiveCell(ri, ci)) setActiveClue(words[0]);
                            }}
                            onBlur={diacritics.onBlur}
                            disabled={!!result}
                            className={`h-full w-full bg-white text-center font-heading font-medium uppercase outline-none dark:bg-neutral-800 dark:text-neutral-100 ${cellSize.text} ${
                              hintedCells.has(cellKey(ri, ci))
                                ? "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400"
                                : status === "correct"
                                  ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                                  : status === "incorrect"
                                    ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                                    : isActiveCell(ri, ci)
                                      ? "bg-blue-50 dark:bg-blue-950/40"
                                      : ""
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {scrollHint && <p className={HINT_TEXT}>Сітка ширша за екран — прокрутіть убік</p>}

        {/* Контекстний попап біля активної клітинки — спільний компонент/хук
            (diacritics-popup.tsx), той самий onMouseDown-preventDefault
            прийом усередині DiacriticsPopup (клік по кнопці не забирає
            фокус, інакше onBlur одразу закрив би сам попап під час кліку по
            ньому). updateLetter той самий, що й для вводу з клавіатури —
            автоперехід і автопропуск працюють "з коробки". */}
        {diacritics.rect && !result && diacritics.activeKey && (
          <DiacriticsPopup
            rect={diacritics.rect}
            onPick={(ch) => {
              const [rowStr, colStr] = diacritics.activeKey!.split(",");
              updateLetter(Number(rowStr), Number(colStr), ch);
            }}
          />
        )}

        <div className="flex w-full flex-col gap-6">
          {renderClueSection("horizontal", block.across, "Horizontalement")}
          {renderClueSection("vertical", block.down, "Verticalement")}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {allowRecheck ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className={STUDENT_BUTTON_PRIMARY}
            >
              {pending ? "Перевіряю..." : result ? "Перевірити ще раз" : "Перевірити блок"}
            </button>
            {result && (
              <p
                className={`${RESULT_MESSAGE_CLASS} ${
                  result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {result.correct ? "Правильно! ✓" : `Результат: ${result.score}%`}
                {result.pointsPossible !== undefined && (
                  <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
                    ({result.pointsEarned} з {result.pointsPossible} {pluralizePoints(result.pointsPossible)})
                  </span>
                )}
              </p>
            )}
          </div>
        ) : !result ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
          >
            {pending ? "Перевіряю..." : "Перевірити"}
          </button>
        ) : (
          <p
            className={`${RESULT_MESSAGE_CLASS} ${
              result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {result.correct ? "Правильно! ✓" : `Результат: ${result.score}%`}
            {result.pointsPossible !== undefined && (
              <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
                ({result.pointsEarned} з {result.pointsPossible} {pluralizePoints(result.pointsPossible)})
              </span>
            )}
          </p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}

export function CrosswordExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
  isDelf,
}: {
  taskId: string;
  config: CrosswordPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  // Задача належить DELF-тесту — лампочки-підказки не рендеряться взагалі.
  isDelf?: boolean;
}) {
  // Фолбек на п.5 ЕТАПУ 3/4 — blocks відсутній/порожній (помилка даних):
  // показуємо вправу як один блок із LEGACY-полів верхнього рівня.
  const blocks: CrosswordPublicBlock[] =
    config.blocks.length > 0
      ? config.blocks
      : [
          {
            gridWidth: config.gridWidth,
            gridHeight: config.gridHeight,
            openCells: config.openCells,
            cellNumbers: config.cellNumbers,
            solution: config.solution,
            across: config.across,
            down: config.down,
          },
        ];
  const blockCount = blocks.length;
  const useBlocks = blockCount > 1;
  const [activeBlock, setActiveBlock] = useState(0);
  const [blockResults, setBlockResults] = useState<Record<number, CrosswordBlockResult>>({});

  // ==== Гілка з ОДНИМ блоком (стара поведінка, незмінна) ====
  const [singleResult, setSingleResult] = useState<CrosswordBlockResult | null>(null);
  useEffect(() => {
    if (!useBlocks && singleResult) onResult?.(singleResult);
  }, [useBlocks, singleResult, onResult]);

  // ==== Гілка з кількома блоками ====
  const allBlocksChecked = useBlocks && blockCount > 0 && Object.keys(blockResults).length === blockCount;

  const aggregateResult: CrosswordBlockResult | null = useMemo(() => {
    if (!allBlocksChecked) return null;
    const results = Object.values(blockResults);
    const words = results.flatMap((r) => r.detail.words);
    const correctCount = words.filter((w) => w.isCorrect).length;
    return {
      correct: results.every((r) => r.correct),
      score: words.length > 0 ? Math.round((correctCount / words.length) * 100) : 0,
      detail: { words },
      pointsEarned: results.reduce((sum, r) => sum + (r.pointsEarned ?? 0), 0),
      pointsPossible: results.reduce((sum, r) => sum + (r.pointsPossible ?? 0), 0),
    };
  }, [allBlocksChecked, blockResults]);

  useEffect(() => {
    if (aggregateResult) onResult?.(aggregateResult);
  }, [aggregateResult, onResult]);

  const hintExplanationHidden = !!isDelf || (useBlocks ? allBlocksChecked : !!singleResult);

  return (
    <div className={EXERCISE_STACK}>
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <div
            className={`instruction-text ${EXERCISE_INSTRUCTION}`}
            dangerouslySetInnerHTML={{
              __html: sanitizeInstructionsHtml(config.instructions ?? DEFAULT_INSTRUCTIONS.crossword.instruction),
            }}
          />
          {!hidePoints && (pointsVisible || (useBlocks ? aggregateResult : singleResult)) && (
            <span className={SCORE_LABEL_CLASS}>
              {useBlocks
                ? aggregateResult
                  ? `${aggregateResult.pointsEarned}/${config.points} ${pluralizePoints(config.points)}`
                  : `${config.points} ${pluralizePoints(config.points)}`
                : singleResult
                  ? `${singleResult.correct ? config.points : 0}/${config.points} ${pluralizePoints(config.points)}`
                  : `${config.points} ${pluralizePoints(config.points)}`}
            </span>
          )}
        </div>
        {(config.subInstructions ?? DEFAULT_INSTRUCTIONS.crossword.subInstruction) && (
          <div
            className={`mt-1 ${EXERCISE_SUBINSTRUCTION}`}
            dangerouslySetInnerHTML={{
              __html: sanitizeInstructionsHtml(config.subInstructions ?? DEFAULT_INSTRUCTIONS.crossword.subInstruction),
            }}
          />
        )}
      </div>

      <HintExplanation type="crossword" hintsReducePoints={config.hintsReducePoints} hidden={hintExplanationHidden} />

      {!useBlocks ? (
        <CrosswordBlockView taskId={taskId} block={blocks[0]} active isDelf={isDelf} onResult={setSingleResult} />
      ) : (
        <BlockNavigation
          blockCount={blockCount}
          activeBlock={activeBlock}
          onChangeBlock={setActiveBlock}
          isBlockChecked={(i) => i in blockResults}
          summary={aggregateResult}
          labels={blocks.map((b) => b.title)}
        >
          {/* Усі блоки змонтовані одразу, неактивні лише приховані класом
              "hidden" — той самий принцип, що WordSearchExercise: кожен
              CrosswordBlockView тримає власну сітку/фокус/підказки, їх не
              можна втратити при перемиканні вкладок. */}
          {blocks.map((b, i) => (
            <div key={i} className={i === activeBlock ? "" : "hidden"}>
              <CrosswordBlockView
                taskId={taskId}
                block={b}
                blockIndex={i}
                active={i === activeBlock}
                isDelf={isDelf}
                onResult={(r) => setBlockResults((prev) => ({ ...prev, [i]: r }))}
              />
            </div>
          ))}
        </BlockNavigation>
      )}
    </div>
  );
}
