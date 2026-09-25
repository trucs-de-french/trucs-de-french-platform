"use client";

import { useState, useEffect, useMemo } from "react";
import type { CrosswordPublic, CrosswordDetail, CrosswordAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { ImageZoomBadge } from "./image-zoom-badge";
import { ImageLightbox } from "./image-lightbox";
import { DiacriticsPopup, useDiacriticsPopup } from "./diacritics-popup";
import { ANSWER_CARD_BASE, ANSWER_CARD_DEFAULT } from "./answer-card-style";
import { EXERCISE_INSTRUCTION, EXERCISE_SUBINSTRUCTION, CLUE_TEXT } from "@/lib/typography-styles";
import { EXERCISE_STACK } from "@/lib/spacing";

type Direction = "horizontal" | "vertical";
type ClueKey = `${Direction}-${number}`;

function emptyAnswer(width: number, height: number): CrosswordAnswer {
  return Array.from({ length: height }, () => Array(width).fill(""));
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

// Позиції клітинок кожної підказки НЕ передаються студенту напряму
// (CrosswordPublic несе лише форму+номери+довжину) — відновлюються тут:
// клітинка зі cellNumbers[r][c] === number — старт, далі "довжина" клітинок
// у напрямку підказки. Той самий принцип, що placementCells у
// crossword-grid.ts, лише в зворотну сторону (з номера, не з координат).
function buildClueCells(config: CrosswordPublic): Map<ClueKey, { row: number; col: number }[]> {
  const map = new Map<ClueKey, { row: number; col: number }[]>();
  const clueLists: { direction: Direction; clues: CrosswordPublic["across"] }[] = [
    { direction: "horizontal", clues: config.across },
    { direction: "vertical", clues: config.down },
  ];
  for (const { direction, clues } of clueLists) {
    for (const clue of clues) {
      let start: { row: number; col: number } | null = null;
      outer: for (let r = 0; r < config.gridHeight; r++) {
        for (let c = 0; c < config.gridWidth; c++) {
          if (config.cellNumbers[r][c] === clue.number) {
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

export function CrosswordExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: CrosswordPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  const [answer, setAnswer] = useState<CrosswordAnswer>(() => emptyAnswer(config.gridWidth, config.gridHeight));
  const [activeClue, setActiveClue] = useState<{ direction: Direction; number: number } | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  // Спільний хук (diacritics-popup.tsx) — ключ "row,col" на кожну клітинку.
  // Той самий інстанс дає й реф для програмного .focus() (автоперехід
  // вперед/назад — не пов'язано з попапом самим по собі, але той самий
  // Map зручно перевикористати), і позицію для DiacriticsPopup.
  const diacritics = useDiacriticsPopup<string>();
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as CrosswordDetail | undefined;

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  const clueCells = useMemo(() => buildClueCells(config), [config]);

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
        const cellKey = `${row},${col}`;
        const list = map.get(cellKey) ?? [];
        list.push({ direction, number });
        map.set(cellKey, list);
      }
    }
    return map;
  }, [clueCells]);

  function updateLetter(row: number, col: number, value: string) {
    const letter = (value.slice(-1) || "").toUpperCase();
    setAnswer((prev) => prev.map((r, ri) => (ri === row ? r.map((v, ci) => (ci === col ? letter : v)) : r)));

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
          const filledCorrectly = answer[c.row][c.col] !== "" && answer[c.row][c.col] === config.solution[c.row][c.col];
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
    if (answer[row][col] !== "") return;
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
    if (answer[prev.row][prev.col] === "") {
      setAnswer((p) => p.map((r, ri) => (ri === prev.row ? r.map((v, ci) => (ci === prev.col ? "" : v)) : r)));
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
    return cells.length > 0 && cells.every((c) => answer[c.row][c.col] !== "");
  }

  // На рівні ЦІЛОГО слова — лише для закреслення підказки в списку
  // (renderClueColumn), не для кольору клітинок у сітці (те — cellLiveStatus
  // нижче, посимвольно). Рахується напряму з answer проти config.solution,
  // без запиту на сервер і незалежно від кнопки "Перевірити"/grade.ts.
  function liveWordStatus(direction: Direction, number: number): "correct" | "incorrect" | null {
    if (!isWordFilled(direction, number)) return null;
    const cells = clueCells.get(`${direction}-${number}`) ?? [];
    const allCorrect = cells.every((c) => answer[c.row][c.col] === config.solution[c.row][c.col]);
    return allCorrect ? "correct" : "incorrect";
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
      if (answer[row][col] === config.solution[row][col]) {
        anyCorrect = true;
      } else {
        return "incorrect";
      }
    }
    return anyCorrect ? "correct" : null;
  }

  function handleSubmit() {
    submit(answer);
  }

  // Текст підказки — той самий колір/закреслення для ОБОХ форм (картка й
  // плаский текст), лише навколишня розмітка різна.
  function clueTextClass(liveStatus: "correct" | "incorrect" | null): string {
    return liveStatus === "correct"
      ? "text-green-600 line-through dark:text-green-400"
      : liveStatus === "incorrect"
        ? "text-red-600 dark:text-red-400"
        : "";
  }

  // Картка — той самий ANSWER_CARD_BASE/DEFAULT, що вже в легенді Філворда
  // (word_search): для підказок із clueStyle === "long" АБО картинкою/аудіо
  // (картинка/аудіо завжди в картці, незалежно від clueStyle — той принцип
  // не змінюється цим перемикачем).
  function renderClueCard(direction: Direction, clue: CrosswordPublic["across"][number]) {
    const liveStatus = liveWordStatus(direction, clue.number);
    const isActive = activeClue?.direction === direction && activeClue.number === clue.number;
    return (
      <button
        key={clue.number}
        type="button"
        onClick={() => setActiveClue(isActive ? null : { direction, number: clue.number })}
        className={`${ANSWER_CARD_BASE} flex flex-col items-center gap-1 ${
          liveStatus === "correct"
            ? "border-green-500 bg-green-50 dark:bg-green-950/30"
            : isActive
              ? "border-blue-400 bg-blue-50 dark:bg-blue-950/40"
              : ANSWER_CARD_DEFAULT
        }`}
      >
        <span className={`${CLUE_TEXT} ${clueTextClass(liveStatus)}`}>
          <span className="font-body font-semibold">{clue.number}.</span> {clue.clue}
        </span>
        {clue.imageUrl && (
          <span className="relative">
            <ImageZoomBadge onOpen={() => setLightboxSrc(clue.imageUrl!)} />
            <ImageOrPlaceholder
              src={clue.imageUrl}
              alt=""
              className="h-14 w-14 rounded object-cover"
              useFocus
            />
          </span>
        )}
        {clue.audioUrl && (
          <audio controls src={clue.audioUrl} className="h-6 w-full" onClick={(e) => e.stopPropagation()} />
        )}
      </button>
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
  function renderClueFlat(direction: Direction, clue: CrosswordPublic["across"][number]) {
    const liveStatus = liveWordStatus(direction, clue.number);
    const isActive = activeClue?.direction === direction && activeClue.number === clue.number;
    return (
      <button
        key={clue.number}
        type="button"
        onClick={() => setActiveClue(isActive ? null : { direction, number: clue.number })}
        className={`flex items-baseline gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
          isActive && !liveStatus ? "bg-blue-50 dark:bg-blue-950/40" : ""
        } ${clueTextClass(liveStatus)}`}
      >
        {/* Клас шрифту прямо на кожному <span> (font-body тут, CLUE_TEXT
            нижче), НЕ на <button>: глобальне button{font-family:var(--font-heading)} (globals.css)
            неlayered CSS — за правилами cascade layers таке правило
            переважає БУДЬ-яке правило з @layer (а Tailwind-утиліти, разом
            з .font-body з CLUE_TEXT, лежать саме в @layer utilities),
            незалежно від специфічності класу. Якби CLUE_TEXT стояв на
            самій <button>, він програвав би цьому тег-правилу саме на
            рівні шарів каскаду (не специфічності) — тому клас на
            дочірньому <span> (якого тег-правило взагалі не стосується
            напряму) — єдиний надійний спосіб перебити успадкований Nunito. */}
        <span className="whitespace-nowrap font-body text-sm font-semibold">{clue.number}.</span>
        <span className={CLUE_TEXT}>{clue.clue}</span>
      </button>
    );
  }

  // Картки (auto-fill, той самий вигляд, що у Філворді) і плаский текст —
  // ДВІ окремі однорідні ділянки в межах секції, не одна змішана сітка:
  // картка розрахована на мінімальну ширину 9rem, короткий текстовий рядок
  // у тій самій клітинці або розтягнувся б, або зламав вирівнювання —
  // натомість короткі підказки йдуть рядком (flex-wrap) під блоком карток:
  // gap-x-8 між підказками по горизонталі, gap-y-2 між рядками при переносі
  // (не gap-y-0.5 впритул, як був проміжний варіант).
  function renderClueSection(direction: Direction, clues: CrosswordPublic["across"], title: string) {
    if (clues.length === 0) return null;
    const needsCard = (clue: CrosswordPublic["across"][number]) =>
      clue.clueStyle === "long" || !!clue.imageUrl || !!clue.audioUrl;
    const cardClues = clues.filter(needsCard);
    const flatClues = clues.filter((clue) => !needsCard(clue));
    return (
      <div className="w-full">
        <p className="mb-2 font-heading text-sm font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{title}</p>
        {cardClues.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
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

  return (
    <div className={EXERCISE_STACK}>
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <div
            className={`instruction-text ${EXERCISE_INSTRUCTION}`}
            dangerouslySetInnerHTML={{
              __html: sanitizeInstructionsHtml(config.instructions ?? DEFAULT_INSTRUCTIONS.crossword),
            }}
          />
          {!hidePoints && (pointsVisible || detail) && (
            <span className="text-xs font-normal italic text-neutral-500 dark:text-neutral-400">
              {detail
                ? `${result?.correct ? config.points : 0}/${config.points} ${pluralizePoints(config.points)}`
                : `${config.points} ${pluralizePoints(config.points)}`}
            </span>
          )}
        </div>
        {config.subInstructions && (
          <div
            className={`mt-1 ${EXERCISE_SUBINSTRUCTION}`}
            dangerouslySetInnerHTML={{ __html: sanitizeInstructionsHtml(config.subInstructions) }}
          />
        )}
      </div>

      {/* Внутрішній відступ вправи (не входить у систему відступів сторінки,
          src/lib/spacing.ts, — та зумисно лишається поза нею): зазор між
          сіткою й панеллю підказок під нею. */}
      <div className="flex flex-col items-center gap-3">
        <div className="max-w-full overflow-x-auto">
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
                {config.openCells.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((open, ci) => {
                      if (!open) {
                        // Стиль crosswordlabs.com — заблокована клітинка
                        // невидима (без рамки/фону), а не чорний квадрат;
                        // клітинка й далі займає своє місце в grid-розкладці
                        // (порожній <td>, не display:none) — сітка лишається
                        // прямокутною, лише "неправильна форма" видима.
                        return <td key={ci} className="h-7 w-7 border-none bg-transparent" />;
                      }
                      const number = config.cellNumbers[ri][ci];
                      const status = cellLiveStatus(ri, ci);
                      return (
                        <td key={ci} className="relative h-7 w-7 border border-neutral-300 p-0 dark:border-neutral-700">
                          {number !== null && (
                            <span className="pointer-events-none absolute left-0.5 top-0 text-[8px] leading-none text-neutral-500 dark:text-neutral-400">
                              {number}
                            </span>
                          )}
                          <input
                            ref={diacritics.fieldRef(cellKey(ri, ci))}
                            maxLength={1}
                            value={answer[ri][ci]}
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
                            className={`h-full w-full bg-white text-center font-heading text-base font-medium uppercase outline-none dark:bg-neutral-800 dark:text-neutral-100 ${
                              status === "correct"
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
          {renderClueSection("horizontal", config.across, "Horizontalement")}
          {renderClueSection("vertical", config.down, "Verticalement")}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {!result ? (
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
            className={`text-sm font-medium ${
              result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {result.correct ? "Правильно! ✓" : `Результат: ${result.score}%`}
            {result.pointsPossible !== undefined && (
              <span className="ml-2 font-normal text-neutral-500 dark:text-neutral-400">
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
