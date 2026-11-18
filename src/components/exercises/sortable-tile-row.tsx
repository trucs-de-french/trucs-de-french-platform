"use client";

import { useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { SELECTED_TILE_CLASS, LIVE_CORRECT_CLASS, LIVE_INCORRECT_CLASS } from "./selection-style";
import { arrayMove, computeInsertIndex, resolveDropSide } from "@/lib/sortable-list";

// Спільна DnD-механіка для reorder (плитки-слова) і letter_rearrangement
// (плитки-літери) — нативний HTML5 drag-and-drop + click-to-select-then-move
// як fallback для тач-пристроїв. Перейменовано з SwappableTileRow: плитка,
// відпущена над іншою, стає РІВНО на її місце (ліва/права половина під
// курсором визначає "до" чи "після"), решта зсувається — не обмін місцями
// парами, як було раніше. Нічого не знає про послідовності/слова/бали/
// підказки — лише "рядок тайлів, які можна переставляти".
//
// touchDrag (опційний, вимкнений за замовчуванням) — справжнє пальцем-
// перетягування для тач-пристроїв, додане для "Склади слово" тренування
// слів (train-play-view.tsx): draggable/onDragStart НІКОЛИ не спрацьовує
// від дотику (мобільні браузери не емітять HTML5 DnD-події для touch),
// тож без цього на телефоні лишався тільки tap-to-select-then-move.
// Наскрізно opt-in — коли проп не передано (reorder.tsx/letter-
// rearrangement.tsx), жодний новий хендлер/DOM/CSS-клас не додається,
// поведінка сценових вправ лишається байтово тією самою. Семантика
// РІЗНА від move() вище: тут відпуск над іншою плиткою МІНЯЄ їх місцями
// (swap), а не вставляє/зсуває решту — та сама різниця, що задача явно
// вимагає для цього режиму.
const TOUCH_DRAG_THRESHOLD_PX = 6;

export function SortableTileRow({
  items,
  onChange,
  locked,
  tileState,
  compact = false,
  letterTile = false,
  gapClassName = "gap-2",
  lockedCount = 0,
  extraContainerClassName = "",
  extraTileClassName = "",
  touchDrag = false,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  locked: boolean;
  // За ІНДЕКСОМ позиції (не значенням) — коректно для дублікатів (однакові
  // слова/літери можуть повторюватись).
  tileState?: (index: number) => "correct" | "incorrect" | undefined;
  // Менший padding для НЕ-letterTile плиток (суто презентаційний проп,
  // ніяк не зачіпає drag/click-move логіку вище) — letter_rearrangement
  // (letterTile) більше не передає compact: розмір однолітерної плитки
  // тепер ЗАВЖДИ однаковий на всю вправу (.letter-tile-cell, --cell —
  // use-working-tile-layout.ts), а не перемикається тут.
  compact?: boolean;
  // Однолітерні плитки (letter_rearrangement) — фіксована w/h + центрування
  // замість padding-based розміру (reorder.tsx — плитки-СЛОВА, variable-
  // width за задумом, letterTile не передає) через спільний клас
  // .letter-tile-cell (globals.css), що читає --cell, встановлений
  // викликачем на обгортці вправи.
  letterTile?: boolean;
  // Відступ між плитками (і між перенесеними рядками — flex gap задає
  // обидва) — за замовчуванням gap-2 (reorder.tsx, плитки-слова).
  // letter_rearrangement передає "letter-tile-row-gap" (globals.css,
  // calc(var(--cell)*0.125)) — той самий проміжок, що letter-gaps.tsx між
  // літерами в межах слова, щоб обидва типи виглядали як одна родина.
  gapClassName?: string;
  // Префікс позицій [0, lockedCount), закріплених кнопкою-підказкою
  // (letter_rearrangement): ці плитки не тягаються й не клікаються, і жодну
  // іншу плитку не можна перетягнути/клікнути НА ці позиції — лише "після"
  // них (move() нижче затискає ціль). Завжди суцільний префікс, бо підказка
  // закриває позиції зліва направо по порядку.
  lockedCount?: number;
  // Додаткові класи лише для викликача, що їх передав (порожній рядок за
  // замовчуванням — жодної різниці для letter_rearrangement, який цих
  // пропів не передає). Дає reorder.tsx мобільний min-h-11/gap/touch-action
  // без зміни спільного вигляду плиток тут для letter_rearrangement.
  extraContainerClassName?: string;
  extraTileClassName?: string;
  // Пальцем-перетягування (нижче) — лише коли true; миша/перо завжди
  // йдуть нативним draggable-шляхом вище, без змін.
  touchDrag?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  // Куди саме стане перетягнута плитка — індекс наведеного елемента +
  // сторона (ліва/права половина під курсором) — не просто "над яким
  // елементом", як раніше dragOverIndex.
  const [dropTarget, setDropTarget] = useState<{ index: number; side: "before" | "after" } | null>(null);

  // Тач-перетягування — окремий стан від dropTarget/draggingIndex вище
  // (той нативний механізм для миші/пера лишається недоторканим):
  // touchDragState — лише коли реально перетнуто TOUCH_DRAG_THRESHOLD_PX
  // (менший рух = звичайний тап, обробляється нижче як завжди).
  const touchStartRef = useRef<{ index: number; x: number; y: number; dragging: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [touchDragState, setTouchDragState] = useState<{ index: number; x: number; y: number; overIndex: number | null } | null>(
    null
  );

  function move(from: number, to: number) {
    if (locked || from < lockedCount) return;
    const clampedTo = Math.max(to, lockedCount);
    if (from === clampedTo) return;
    onChange(arrayMove(items, from, clampedTo));
  }

  // Обмін МІСЦЯМИ (не arrayMove-вставка, що move() вище робить для
  // native drag/click-fallback) — вимога задачі саме для тач-режиму.
  function swapTiles(a: number, b: number) {
    if (locked || a < lockedCount || b < lockedCount || a === b) return;
    const next = [...items];
    [next[a], next[b]] = [next[b], next[a]];
    onChange(next);
  }

  function clickTile(i: number) {
    if (locked || i < lockedCount) return;
    if (selected === null) {
      setSelected(i);
    } else if (selected === i) {
      setSelected(null);
    } else {
      // Клік (без лівої/правої половини) — друга плитка займає рівно ту
      // позицію, куди клікнули, той самий arrayMove(items, from, to), що й
      // drag; природний, однозначний результат без потреби в half-детекції
      // для дискретного click-fallback.
      move(selected, i);
      setSelected(null);
    }
  }

  function handleTileClick(i: number) {
    // Клік ПІСЛЯ завершеного тач-перетягування (якщо браузер усе ж
    // синтезує click після pointerup з переміщенням) — ігнорується рівно
    // один раз; звичайний тап (рух < порогу) сюди доходить незміненим.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    clickTile(i);
  }

  function handleTouchPointerDown(e: ReactPointerEvent<HTMLButtonElement>, i: number) {
    if (!touchDrag || e.pointerType !== "touch" || locked || i < lockedCount) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    touchStartRef.current = { index: i, x: e.clientX, y: e.clientY, dragging: false };
  }

  function handleTouchPointerMove(e: ReactPointerEvent<HTMLButtonElement>, i: number) {
    const st = touchStartRef.current;
    if (!touchDrag || !st || st.index !== i) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (!st.dragging) {
      if (Math.hypot(dx, dy) < TOUCH_DRAG_THRESHOLD_PX) return;
      st.dragging = true;
      setSelected(null); // перетягування і click-select — взаємовиключні режими
    }
    e.preventDefault();
    const overEl = document.elementFromPoint(e.clientX, e.clientY);
    const overTile = (overEl as HTMLElement | null)?.closest<HTMLElement>("[data-tile-index]");
    const overIndexRaw = overTile ? Number(overTile.dataset.tileIndex) : NaN;
    const overIndex = !Number.isNaN(overIndexRaw) && overIndexRaw >= lockedCount ? overIndexRaw : null;
    setTouchDragState({ index: i, x: e.clientX, y: e.clientY, overIndex });
  }

  function handleTouchPointerUp(e: ReactPointerEvent<HTMLButtonElement>, i: number) {
    const st = touchStartRef.current;
    if (!touchDrag || !st || st.index !== i) return;
    touchStartRef.current = null;
    if (st.dragging) {
      e.preventDefault();
      suppressClickRef.current = true;
      const dropIndex = touchDragState?.overIndex ?? null;
      setTouchDragState(null);
      if (dropIndex !== null) swapTiles(i, dropIndex);
    }
    // Звичайний тап (st.dragging лишився false) — нічого тут не робимо,
    // природний click, що йде слідом, сам викличе handleTileClick/
    // clickTile, той самий шлях, що без touchDrag взагалі.
  }

  function handleTouchPointerCancel(i: number) {
    if (touchStartRef.current?.index === i) touchStartRef.current = null;
    setTouchDragState(null);
  }

  // Задача "Tile rows (reorder, letters): neutral start, blue selected
  // tile, live green/red after manipulation" — пріоритет станів плитки,
  // найвищий спочатку: обрана (click-to-select) чи зараз тягнута (drag) —
  // SELECTED_TILE_CLASS (синя) ПОВЕРХ live correct/incorrect, доки триває
  // вибір/перетягування (п.3 задачі: "blue wins while selected/held"); щойно
  // обмін відбувся чи скасований (selected/draggingIndex знову null),
  // tileClass природно падає до correct/incorrect — жодної додаткової
  // логіки для "повернення" кольору не потрібно.
  function tileClass(i: number) {
    const state = tileState?.(i);
    const held = selected === i || draggingIndex === i || touchDragState?.index === i;
    const shadow = draggingIndex === i || touchDragState?.index === i ? "" : "shadow-sm";
    if (i < lockedCount)
      return `${shadow} border-sky-400 bg-sky-100 text-sky-700 dark:border-sky-600 dark:bg-sky-950/40 dark:text-sky-400`;
    if (held) return `${shadow} ${SELECTED_TILE_CLASS}`;
    if (touchDragState?.overIndex === i) return `${shadow} touch-drag-target`;
    if (state === "correct") return `${shadow} ${LIVE_CORRECT_CLASS}`;
    if (state === "incorrect") return `${shadow} ${LIVE_INCORRECT_CLASS}`;
    // letterTile (letter_rearrangement) — ті самі токени поля, що й пропуск
    // letter_gaps (--card-field-bg/--card-field-border/--field-ink,
    // .exercise-field у globals.css), а не --card-bg/--card-border картки:
    // плитка-літера тут має виглядати як те саме поле, просто заповнене.
    // Hover-фон #20247a — те саме літеральне значення, що
    // .dark .exercise-field:hover (globals.css), без card-скоупінгу, тож це
    // й реальний hover-колір полів-пропусків на картці; рамка на hover —
    // --card-hover-border (трохи яскравіша за --card-field-border).
    if (letterTile)
      return `${shadow} glass-chip glass-chip-hover glass-gap-shadow bg-white hover:bg-neutral-50 dark:border-[var(--card-field-border)] dark:bg-[var(--dark-surface-fill)] dark:text-[var(--field-ink)] dark:hover:bg-[#20247a] dark:hover:border-[var(--card-hover-border)]`;
    // reorder (Mise en ordre) — плитки-слова темної теми тепер на окремому
    // темно-наvy класі (.reorder-word-tile, globals.css), тихішому за
    // letter_rearrangement вище (--card-field-bg): власний фон/рамка/тінь,
    // а не --card-bg/--card-border картки. Світла тема — ті самі класи, що
    // раніше, без змін.
    // draggingIndex === i сюди вже не доходить (held вище перехоплює
    // раніше) — .reorder-word-tile--dragging (globals.css) лишається
    // недосяжним, не видаляю CSS-правило заради мінімального диффу.
    return `${shadow} glass-chip glass-chip-hover glass-gap-shadow bg-white hover:bg-neutral-50 reorder-word-tile`;
  }

  return (
    <div className={`relative flex flex-wrap items-stretch ${gapClassName} ${extraContainerClassName}`}>
      {items.map((text, i) => (
        <div key={i} className="relative flex items-stretch">
          {/* Індикатор вставки — тонка вертикальна лінія кольору brand між
              плитками, ліворуч чи праворуч від наведеної, замість
              підсвічування всієї сусідньої плитки (те раніше означало
              "поміняються місцями", тепер лінія точно показує, куди
              встане). */}
          {dropTarget?.index === i && dropTarget.side === "before" && (
            <span className="absolute -left-[5px] top-0 bottom-0 w-0.5 rounded-full bg-brand" aria-hidden />
          )}
          <button
            type="button"
            data-tile-index={i}
            draggable={!locked && i >= lockedCount}
            onDragStart={(e: DragEvent) => {
              e.dataTransfer.setData("text/plain", String(i));
              e.dataTransfer.effectAllowed = "move";
              setDraggingIndex(i);
            }}
            onDragOver={(e: DragEvent) => {
              e.preventDefault();
              if (draggingIndex === null) return;
              const side = resolveDropSide(
                e.clientX,
                e.clientY,
                e.currentTarget.getBoundingClientRect(),
                "horizontal"
              );
              setDropTarget({ index: i, side });
            }}
            onDragLeave={() =>
              setDropTarget((prev) => (prev?.index === i ? null : prev))
            }
            onDragEnd={() => {
              setDropTarget(null);
              setDraggingIndex(null);
            }}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData("text/plain"));
              if (!Number.isNaN(from) && dropTarget) {
                move(from, computeInsertIndex(from, dropTarget.index, dropTarget.side));
              }
              setDropTarget(null);
            }}
            onPointerDown={touchDrag ? (e) => handleTouchPointerDown(e, i) : undefined}
            onPointerMove={touchDrag ? (e) => handleTouchPointerMove(e, i) : undefined}
            onPointerUp={touchDrag ? (e) => handleTouchPointerUp(e, i) : undefined}
            onPointerCancel={touchDrag ? () => handleTouchPointerCancel(i) : undefined}
            onClick={() => handleTileClick(i)}
            disabled={locked}
            // aria-pressed — лише "обрано для обміну" (click-to-select,
            // п.9 задачі), не для drag (тягнута плитка не є "pressed"-
            // перемикачем у сенсі ARIA toggle-button).
            aria-pressed={selected === i}
            className={`select-none border-[1.5px] dark:border text-center transition-[box-shadow,transform,background-color,border-color] disabled:cursor-not-allowed disabled:opacity-70 ${
              i < lockedCount ? "cursor-default" : "cursor-grab active:cursor-grabbing"
            } ${touchDrag ? "touch-drag-tile" : ""} ${touchDragState?.index === i ? "touch-drag-source" : ""} ${
              // letterTile (letter_rearrangement) — фіксована w/h, однакова
              // для будь-якого символу, по центру, через спільний клас
              // .letter-tile-cell (globals.css, читає --cell) — той самий
              // розмір, що поле-пропуск letter_gaps. Звичайні тайли
              // (reorder — цілі слова/фрази) мають переноситись усередині
              // себе (max-w-full break-words), інакше довга фраза вилазить
              // за межі рядка (whitespace-nowrap без обмеження ширини) —
              // їм лишається звичайний rounded-md (letterTile бере радіус
              // з .letter-tile-cell).
              letterTile
                ? "flex shrink-0 items-center justify-center whitespace-nowrap text-center letter-tile-cell letter-tile-font"
                : compact
                  ? "whitespace-nowrap px-2 py-1 text-sm rounded-md"
                  : "max-w-full break-words px-3 py-1.5 text-base [overflow-wrap:anywhere] rounded-md"
            } ${tileClass(i)} ${extraTileClassName}`}
          >
            {text}
          </button>
          {dropTarget?.index === i && dropTarget.side === "after" && (
            <span className="absolute -right-[5px] top-0 bottom-0 w-0.5 rounded-full bg-brand" aria-hidden />
          )}
        </div>
      ))}
      {/* Ghost-клон, що слідує за пальцем — лише під час активного тач-
          перетягування (touchDragState.dragging по суті, виставляється
          лише ПІСЛЯ порогу в handleTouchPointerMove); position:fixed не
          потребує порталу (жодний із предків тут не має transform/contain,
          що створив би новий containing block). pointer-events:none —
          ghost ніколи не повинен перехоплювати elementFromPoint нижче
          СЕБЕ, інакше оригінальні плитки не визначались би як drop-ціль. */}
      {touchDragState && (
        <span
          aria-hidden="true"
          className="touch-drag-ghost"
          style={{
            position: "fixed",
            left: touchDragState.x,
            top: touchDragState.y,
            transform: "translate(-50%, -120%) scale(1.12)",
            pointerEvents: "none",
          }}
        >
          {items[touchDragState.index]}
        </span>
      )}
    </div>
  );
}
