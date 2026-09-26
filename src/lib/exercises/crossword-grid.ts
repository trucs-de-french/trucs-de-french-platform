import type { CrosswordWord, CrosswordPlacement } from "./types";
import { placementCells } from "./word-search-grid";
import { sanitizeWordForGrid } from "./grid-word";

type Direction = "horizontal" | "vertical";

// edgeDirections — підмножина directions, для яких ЦЯ клітинка є стартом
// або кінцем свого слова (не просто будь-якою клітинкою) — потрібна для
// симетричної частини правила меж: дотик до чужого старту/кінця
// забороняється незалежно від того, яке слово розміщене раніше/пізніше.
type OccupiedCell = { letter: string; directions: Set<Direction>; edgeDirections: Set<Direction> };

type WorkingWord = { word: string; clue: string; clueStyle?: "short" | "long"; imageUrl?: string; audioUrl?: string };

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function deltaFor(direction: Direction): { row: number; col: number } {
  return direction === "horizontal" ? { row: 0, col: 1 } : { row: 1, col: 0 };
}

function otherDirection(direction: Direction): Direction {
  return direction === "horizontal" ? "vertical" : "horizontal";
}

// Клітинки безпосередньо ПЕРЕД і ПІСЛЯ слова вздовж його напрямку — мають
// бути порожні, інакше нове слово "приклеїлось" би впритул до чужого й
// утворило непередбачену довшу послідовність літер (єдина ознака кросворду,
// якої немає в перевірці word_search — там немає поняття "сусіднього" слова
// того самого напрямку).
function boundaryCells(
  row: number,
  col: number,
  direction: Direction,
  length: number
): { row: number; col: number }[] {
  const d = deltaFor(direction);
  return [
    { row: row - d.row, col: col - d.col },
    { row: row + d.row * length, col: col + d.col * length },
  ];
}

// Чи вже утворює чужа бічна клітинка "sideRow,sideCol" сама по собі
// ланцюжок довжиною ≥2 з ІНШОГО боку (тобто чи має вона власного сусіда,
// що триває ДАЛІ в тому ж напрямку perp, за межами клітинки-кандидата)?
// Викликається лише для СЕРЕДИННИХ клітинок нового слова — якщо бічна
// клітинка досі поодинока (сусід далі — порожній), новий дотик дає лише
// нешкідливий "збіг у одній клітинці" (2 клітинки одна під одною/поруч,
// як одинична випадковість); якщо ж бічна клітинка вже сама стоїть впритул
// до ЩЕ ОДНІЄЇ зайнятої — новий дотик продовжив би вже наявний ланцюжок
// до ≥3 клітинок поспіль, а це вже читабельна небажана послідовність.
function extendsExistingChain(
  occupied: Map<string, OccupiedCell>,
  sideRow: number,
  sideCol: number,
  perp: { row: number; col: number }
): boolean {
  const furtherKey = cellKey(sideRow + perp.row, sideCol + perp.col);
  return occupied.has(furtherKey);
}

// Чи є ця клітинка стартом чи кінцем ХОЧ ОДНОГО вже розміщеного там слова
// (незалежно від напрямку) — не просто "будь-яка зайнята клітинка". Дотик
// до такої клітинки завжди виглядає як приклеювання до кінчика чужого
// слова, тому забороняється безумовно — симетрично до того, як уже
// заборонено власний старт/кінець нового кандидата: тут неважливо, яке
// слово "старіше" (вже на сітці) чи "новіше" (щойно перевіряється).
function isWordEdgeCell(occupied: Map<string, OccupiedCell>, row: number, col: number): boolean {
  const cell = occupied.get(cellKey(row, col));
  return cell !== undefined && cell.edgeDirections.size > 0;
}

// Клітинка придатна для перетину, якщо порожня АБО вже містить ТУ САМУ
// літеру (як generateWordSearchGrid) — плюс, на відміну від word_search, дві
// перевірки на випадкове дотикання впритул до чужого слова без справжнього
// перетину: (1) boundaryCells — клітини безпосередньо ДО/ПІСЛЯ нового слова
// вздовж його НАПРЯМКУ; (2) бічні (перпендикулярні до напрямку) клітинки —
// для СТАРТОВОЇ й КІНЦЕВОЇ клітинки нового слова перевіряються СУВОРО (будь-
// який дотик забороняється — це запобігає приклеюванню впритул до кінця
// іншого слова того самого рядка/стовпця, класична вада саме на кінчику
// слова); для СЕРЕДИННИХ клітинок перевірка м'якша — дотик дозволений, якщо
// це одинична випадковість (чужа клітинка й так поодинока), але
// забороняється, якщо він продовжив би вже наявний ланцюжок чужих клітинок
// до ≥3 поспіль (extendsExistingChain) — саме так кілька РІЗНИХ слів можуть
// непомітно "нанизати" свої одиничні серединні літери одна під одною в тому
// самому стовпці/рядку, утворюючи довгу нечитабельну послідовність без
// жодного справжнього вертикального/горизонтального слова позаду. Повний
// варіант (сувора перевірка на КОЖНІЙ клітинці) перевіряли — значно
// розріджує сітку; цей — компроміс, що ловить саме довгі ланцюжки, а не
// поодинокі дотики. На справжньому перетині (existing !== undefined і
// літера збігається) бічні клітинки НЕ перевіряються — саме там інше слово
// законно продовжується перпендикулярно. Окремо, СИМЕТРИЧНО до власної
// суворої перевірки старту/кінця нового кандидата: якщо бічний сусід —
// старт/кінець ЧУЖОГО (вже розміщеного) слова, це теж забороняється
// безумовно, навіть для СЕРЕДИННОЇ клітинки кандидата (isWordEdgeCell) —
// без цього кандидат, розміщений ПІЗНІШЕ, міг непомітно приклеїтись
// впритул до чийогось старту/кінця (дзеркальний, "зворотний" NARQUOIS —
// на відміну від оригінального випадку, де саме НОВЕ слово мало старт/
// кінець біля чужого). Спільна для fits() (де i-та клітинка вже
// відфільтрована від справжніх перетинів викликачем) і fitsIsolated() (де
// перетинів не буває взагалі, кожна клітинка проходить цю перевірку) — щоб
// ізольоване розміщення не мало слабшого захисту, ніж розміщення з
// перетином.
function violatesSideAdjacency(
  occupied: Map<string, OccupiedCell>,
  r: number,
  c: number,
  i: number,
  wordLength: number,
  perp: { row: number; col: number }
): boolean {
  const sideA = { row: r + perp.row, col: c + perp.col };
  const sideB = { row: r - perp.row, col: c - perp.col };
  const aOccupied = occupied.has(cellKey(sideA.row, sideA.col));
  const bOccupied = occupied.has(cellKey(sideB.row, sideB.col));

  if (i === 0 || i === wordLength - 1) {
    return aOccupied || bOccupied;
  }
  if (aOccupied && isWordEdgeCell(occupied, sideA.row, sideA.col)) return true;
  if (bOccupied && isWordEdgeCell(occupied, sideB.row, sideB.col)) return true;
  // Обидва боки одразу зайняті — кандидат сам стає "місточком" між двома
  // чужими клітинками, миттєво утворюючи ланцюжок з 3, навіть якщо кожна з
  // них окремо досі поодинока (жодна не "extends" іншу).
  if (aOccupied && bOccupied) return true;
  if (aOccupied && extendsExistingChain(occupied, sideA.row, sideA.col, perp)) return true;
  if (bOccupied && extendsExistingChain(occupied, sideB.row, sideB.col, { row: -perp.row, col: -perp.col })) return true;
  return false;
}

function fits(occupied: Map<string, OccupiedCell>, word: string, row: number, col: number, direction: Direction): boolean {
  const d = deltaFor(direction);
  const perp = direction === "horizontal" ? { row: 1, col: 0 } : { row: 0, col: 1 };
  for (let i = 0; i < word.length; i++) {
    const r = row + d.row * i;
    const c = col + d.col * i;
    const existing = occupied.get(cellKey(r, c));
    if (existing !== undefined) {
      if (existing.letter !== word[i]) return false;
      continue;
    }
    if (violatesSideAdjacency(occupied, r, c, i, word.length, perp)) return false;
  }
  for (const b of boundaryCells(row, col, direction, word.length)) {
    if (occupied.has(cellKey(b.row, b.col))) return false;
  }
  return true;
}

// Для ізольованого розміщення (без перетину) кожна клітинка мусить бути
// СТРОГО порожньою (не лише "порожня або та сама літера") — тут немає
// наміру перетнутись, тож будь-який контакт з уже зайнятою клітинкою є
// небажаним дотиканням, не справжнім перетином. Та сама violatesSideAdjacency,
// що й fits() — без неї ізольоване слово мало б СЛАБШИЙ захист від
// приклеювання, ніж слово, розміщене через перетин (саме так виникали
// залишкові NARQUOIS-подібні дотики: 4+2 випадки за 50 прогонів походили
// виключно з цього шляху, жодного — з fits()).
function fitsIsolated(occupied: Map<string, OccupiedCell>, word: string, row: number, col: number, direction: Direction): boolean {
  const d = deltaFor(direction);
  const perp = direction === "horizontal" ? { row: 1, col: 0 } : { row: 0, col: 1 };
  for (let i = 0; i < word.length; i++) {
    const r = row + d.row * i;
    const c = col + d.col * i;
    if (occupied.has(cellKey(r, c))) return false;
    if (violatesSideAdjacency(occupied, r, c, i, word.length, perp)) return false;
  }
  for (const b of boundaryCells(row, col, direction, word.length)) {
    if (occupied.has(cellKey(b.row, b.col))) return false;
  }
  return true;
}

function place(occupied: Map<string, OccupiedCell>, word: string, row: number, col: number, direction: Direction) {
  const d = deltaFor(direction);
  for (let i = 0; i < word.length; i++) {
    const key = cellKey(row + d.row * i, col + d.col * i);
    const isEdge = i === 0 || i === word.length - 1;
    const cell = occupied.get(key);
    if (cell) {
      cell.directions.add(direction);
      if (isEdge) cell.edgeDirections.add(direction);
    } else {
      occupied.set(key, {
        letter: word[i],
        directions: new Set([direction]),
        edgeDirections: new Set(isEdge ? [direction] : []),
      });
    }
  }
}

// Обернена дія до place() — прибирає лише НАПРЯМОК цього слова з кожної
// клітинки (не всю клітинку), бо на перетині клітинка може й далі бути
// потрібна іншому слову в іншому напрямку. Потрібна другому проходу
// (пошук кращого перетину для вже ізольованого слова) — щоб прибрати його
// СТАРЕ ізольоване розміщення з occupied перед повторним пошуком, інакше
// findIntersectionCandidates знаходив би "перетин" слова із самим собою.
function unplace(occupied: Map<string, OccupiedCell>, word: string, row: number, col: number, direction: Direction) {
  const d = deltaFor(direction);
  for (let i = 0; i < word.length; i++) {
    const key = cellKey(row + d.row * i, col + d.col * i);
    const cell = occupied.get(key);
    if (!cell) continue;
    cell.directions.delete(direction);
    cell.edgeDirections.delete(direction);
    if (cell.directions.size === 0) occupied.delete(key);
  }
}

type Candidate = {
  row: number;
  col: number;
  direction: Direction;
  distanceToCenter: number;
  crossings: number;
  growth: number;
};

type BoundingBox = { minRow: number; maxRow: number; minCol: number; maxCol: number };

// Прямокутник усіх зайнятих клітинок — рахується наново з occupied (не
// тримається як інкрементальний стан), бо після unplace() у другому проході
// межі кластера можуть ЗМЕНШИТИСЬ (слово прибрали), а не лише зростати —
// перерахунок із нуля надійніший за спробу відстежувати це вручну, і при
// таких малих обсягах (десятки клітинок) вартість перерахунку незначна.
function computeBoundingBox(occupied: Map<string, OccupiedCell>): BoundingBox {
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;
  for (const key of occupied.keys()) {
    const [r, c] = key.split(",").map(Number);
    minRow = Math.min(minRow, r);
    maxRow = Math.max(maxRow, r);
    minCol = Math.min(minCol, c);
    maxCol = Math.max(maxCol, c);
  }
  return { minRow, maxRow, minCol, maxCol };
}

// Наскільки розміщення слова в цій позиції ЗБІЛЬШИТЬ площу bounding box —
// головний критерій компактності (замість "найближче до центру мас", яке
// не бачить, чи кандидат взагалі вміщується в наявні межі). 0 — слово
// повністю вміщується в уже наявний прямокутник, найкращий можливий варіант.
function bboxGrowth(bbox: BoundingBox, word: string, row: number, col: number, direction: Direction): number {
  const d = deltaFor(direction);
  const endRow = row + d.row * (word.length - 1);
  const endCol = col + d.col * (word.length - 1);
  const newMinRow = Math.min(bbox.minRow, row, endRow);
  const newMaxRow = Math.max(bbox.maxRow, row, endRow);
  const newMinCol = Math.min(bbox.minCol, col, endCol);
  const newMaxCol = Math.max(bbox.maxCol, col, endCol);
  const oldArea = (bbox.maxRow - bbox.minRow + 1) * (bbox.maxCol - bbox.minCol + 1);
  const newArea = (newMaxRow - newMinRow + 1) * (newMaxCol - newMinCol + 1);
  return newArea - oldArea;
}

// Скільки клітинок розміщення ЗБІГАЮТЬСЯ з уже зайнятими — тай-брейк №1:
// кандидат, що перетинає одразу кілька наявних слів, зчіплює сітку значно
// щільніше за кандидата з рівно одним перетином (той самий приріст bbox
// може дати як "один перетин", так і "три одразу" — другий явно кращий).
function countCrossings(occupied: Map<string, OccupiedCell>, word: string, row: number, col: number, direction: Direction): number {
  const d = deltaFor(direction);
  let count = 0;
  for (let i = 0; i < word.length; i++) {
    if (occupied.has(cellKey(row + d.row * i, col + d.col * i))) count++;
  }
  return count;
}

// Спільна логіка пошуку кандидатів на перетин — використовується і в
// основному циклі (перша спроба на чергу кожного слова), і в другому
// проході (повторна спроба для тих, хто лишився ізольованим). Правило меж
// (boundaryCells, всередині fits()) НЕ послаблюється в жодному з двох
// викликів — другий прохід дає слову ще один шанс на ТУ САМУ перевірку, не
// м'якшу.
function findIntersectionCandidates(
  occupied: Map<string, OccupiedCell>,
  word: string,
  center: { row: number; col: number },
  bbox: BoundingBox
): Candidate[] {
  const candidates: Candidate[] = [];
  for (let i = 0; i < word.length; i++) {
    const letter = word[i];
    for (const [key, cell] of occupied) {
      if (cell.letter !== letter) continue;
      const [er, ec] = key.split(",").map(Number);

      for (const existingDirection of cell.directions) {
        const newDirection = otherDirection(existingDirection);
        const d = deltaFor(newDirection);
        const row = er - d.row * i;
        const col = ec - d.col * i;
        if (fits(occupied, word, row, col, newDirection)) {
          candidates.push({
            row,
            col,
            direction: newDirection,
            distanceToCenter: distance({ row, col }, center),
            crossings: countCrossings(occupied, word, row, col, newDirection),
            growth: bboxGrowth(bbox, word, row, col, newDirection),
          });
        }
      }
    }
  }
  return candidates;
}

// Критерій вибору: (1) мінімальний приріст bounding box — компактність
// понад усе; (2) кількість перетинів спадаюче — тай-брейк; (3) відстань до
// центру мас — фінальний тай-брейк. Серед кандидатів, що збіглись за ВСІМА
// трьома критеріями одразу, обирається ВИПАДКОВИЙ (не завжди перший) — щоб
// повторне натискання "Перегенерувати" на тому самому списку слів давало
// інший (але однаково хороший за цими критеріями) результат, а не завжди
// той самий детермінований.
function pickBestCandidate(candidates: Candidate[]): Candidate {
  candidates.sort(
    (a, b) => a.growth - b.growth || b.crossings - a.crossings || a.distanceToCenter - b.distanceToCenter
  );
  const best = candidates[0];
  const tied = candidates.filter(
    (c) => c.growth === best.growth && c.crossings === best.crossings && c.distanceToCenter === best.distanceToCenter
  );
  return tied[Math.floor(Math.random() * tied.length)];
}

// Fisher-Yates — той самий алгоритм, що вже в sanitize.ts (reorder/тасування
// варіантів), локальна копія тут: перемішується список СЛІВ перед
// сортуванням за довжиною, щоб слова однакової довжини не завжди йшли в
// порядку введення (стабільне сортування інакше лишало б їх у тому самому
// порядку щоразу) — друге, менше джерело варіативності між генераціями,
// зокрема впливає й на те, ЯКЕ слово серед кількох найдовших стає опорним.
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function centerOf(occupied: Map<string, OccupiedCell>): { row: number; col: number } {
  let sumRow = 0;
  let sumCol = 0;
  let n = 0;
  for (const key of occupied.keys()) {
    const [r, c] = key.split(",").map(Number);
    sumRow += r;
    sumCol += c;
    n++;
  }
  return n === 0 ? { row: 0, col: 0 } : { row: sumRow / n, col: sumCol / n };
}

function distance(a: { row: number; col: number }, b: { row: number; col: number }): number {
  return Math.hypot(a.row - b.row, a.col - b.col);
}

// Пошук вільного місця для слова, яке не вдалось перетнути ні з чим —
// той самий "спробуй випадкову позицію N разів" підхід, що
// generateWordSearchGrid, лише в необмеженому просторі координат:
// вікно пошуку — bounding box уже зайнятих клітинок, розширений на
// довжину слова з кожного боку (щоб слово могло лягти впритул поруч із
// кластером, не обов'язково всередині нього).
function placeIsolated(
  occupied: Map<string, OccupiedCell>,
  word: string
): { row: number; col: number; direction: Direction } | null {
  const keys = [...occupied.keys()].map((k) => k.split(",").map(Number));
  const rows = keys.map((k) => k[0]);
  const cols = keys.map((k) => k[1]);
  const minRow = Math.min(0, ...rows) - word.length;
  const maxRow = Math.max(0, ...rows) + word.length;
  const minCol = Math.min(0, ...cols) - word.length;
  const maxCol = Math.max(0, ...cols) + word.length;

  for (let attempt = 0; attempt < 200; attempt++) {
    const direction: Direction = Math.random() < 0.5 ? "horizontal" : "vertical";
    const row = minRow + Math.floor(Math.random() * (maxRow - minRow + 1));
    const col = minCol + Math.floor(Math.random() * (maxCol - minCol + 1));
    if (fitsIsolated(occupied, word, row, col, direction)) {
      return { row, col, direction };
    }
  }
  return null;
}

// Викликається ОДИН РАЗ в адмінці (crossword-fields.tsx), не на кожен
// рендер студентської сторінки — той самий принцип, що generateWordSearchGrid.
// Повертає ВЖЕ пронумеровані placements (нумерація — усередині, не окремий
// крок, який виклична сторона мала б пам'ятати зробити).
export function generateCrosswordGrid(rawWords: CrosswordWord[]): {
  placements: CrosswordPlacement[];
  gridWidth: number;
  gridHeight: number;
  isolatedWords: string[];
} {
  // sanitizeWordForGrid прибирає з .word усе, що не літера (пробіл/
  // апостроф/дефіс) — ЛИШЕ для розміщення в сітці; сам w.word (легенда/
  // підказка) лишається недоторканим у CrosswordConfig.words, тут читається
  // окремо.
  const words: WorkingWord[] = rawWords
    .map((w) => ({
      word: sanitizeWordForGrid(w.word).toUpperCase(),
      clue: w.clue.trim(),
      clueStyle: w.clueStyle,
      imageUrl: w.imageUrl,
      audioUrl: w.audioUrl,
    }))
    .filter((w) => w.word);

  if (words.length === 0) {
    return { placements: [], gridWidth: 0, gridHeight: 0, isolatedWords: [] };
  }

  const occupied = new Map<string, OccupiedCell>();
  // Індекси в placed (не самі слова-рядки) — щоб другий прохід міг
  // однозначно знайти й ОНОВИТИ саме той запис, навіть якщо в списку є
  // повторювані слова.
  const isolatedIndices: number[] = [];
  type Placed = WorkingWord & { row: number; col: number; direction: Direction };
  const placed: Placed[] = [];

  // shuffle() перед сортуванням — стабільне сортування лишає слова
  // однакової довжини в порядку shuffle(), не завжди в порядку введення.
  const sortedByLengthDesc = shuffle(words).sort((a, b) => b.word.length - a.word.length);

  // Перше (найдовше) слово — опорна точка, горизонтально, старт у (0,0) у
  // робочому (можливо, зрештою від'ємному) просторі координат.
  const first = sortedByLengthDesc[0];
  place(occupied, first.word, 0, 0, "horizontal");
  placed.push({ ...first, row: 0, col: 0, direction: "horizontal" });

  for (const current of sortedByLengthDesc.slice(1)) {
    const { word } = current;
    const center = centerOf(occupied);
    const bbox = computeBoundingBox(occupied);
    const candidates = findIntersectionCandidates(occupied, word, center, bbox);

    if (candidates.length > 0) {
      const best = pickBestCandidate(candidates);
      place(occupied, word, best.row, best.col, best.direction);
      placed.push({ ...current, row: best.row, col: best.col, direction: best.direction });
      continue;
    }

    const isolated = placeIsolated(occupied, word);
    if (isolated) {
      place(occupied, word, isolated.row, isolated.col, isolated.direction);
      placed.push({ ...current, row: isolated.row, col: isolated.col, direction: isolated.direction });
      isolatedIndices.push(placed.length - 1);
    }
    // Якщо навіть ізольоване розміщення не вдалось за 200 спроб (на
    // практиці малоймовірно — простір необмежений, вікно пошуку росте
    // разом зі словом) — слово просто пропускається, той самий крайній
    // випадок, що failedWords у word_search.
  }

  // Другий прохід — слова, що лишились ізольованими після основного циклу,
  // пробують ЩЕ РАЗ, тепер проти вже заповненої сітки: на момент своєї
  // першої черги слово могло не мати жодного валідного перетину просто
  // тому, що потрібні для нього літери ще не були розміщені (порядок за
  // довжиною, не за реальною придатністю до перетину) — на фінальній сітці
  // ці літери вже можуть бути на місці. Правило меж — той самий fits(), що
  // й у першому проході, жодних послаблень.
  const isolatedWords: string[] = [];
  for (const index of isolatedIndices) {
    const entry = placed[index];
    unplace(occupied, entry.word, entry.row, entry.col, entry.direction);

    const center = centerOf(occupied);
    const bbox = computeBoundingBox(occupied);
    const candidates = findIntersectionCandidates(occupied, entry.word, center, bbox);

    if (candidates.length > 0) {
      const best = pickBestCandidate(candidates);
      place(occupied, entry.word, best.row, best.col, best.direction);
      placed[index] = { ...entry, row: best.row, col: best.col, direction: best.direction };
    } else {
      // Кандидата й досі немає — повертаємо слово на його попереднє
      // ізольоване місце (лише прибрали, ще не переставили).
      place(occupied, entry.word, entry.row, entry.col, entry.direction);
      isolatedWords.push(entry.word);
    }
  }

  // Нормалізація — зсув усіх координат так, щоб мінімум був (0,0).
  const minRow = Math.min(...placed.map((p) => p.row));
  const minCol = Math.min(...placed.map((p) => p.col));
  const shifted = placed.map((p) => ({ ...p, row: p.row - minRow, col: p.col - minCol }));

  const maxRow = Math.max(...shifted.map((p) => (p.direction === "vertical" ? p.row + p.word.length - 1 : p.row)));
  const maxCol = Math.max(...shifted.map((p) => (p.direction === "horizontal" ? p.col + p.word.length - 1 : p.col)));

  // Автонумерація — групування за стартовою клітинкою (row,col), сортування
  // зліва направо/згори вниз, послідовна нумерація. Горизонтальне й
  // вертикальне слово, що починаються в тій самій клітинці, отримують ОДИН
  // і той самий номер (стандартна конвенція кросвордів).
  const startCells = [...new Set(shifted.map((p) => cellKey(p.row, p.col)))]
    .map((key) => {
      const [row, col] = key.split(",").map(Number);
      return { key, row, col };
    })
    .sort((a, b) => (a.row - b.row) || (a.col - b.col));
  const numberByStartCell = new Map(startCells.map((c, i) => [c.key, i + 1]));

  const placements: CrosswordPlacement[] = shifted.map((p) => ({
    word: p.word,
    clue: p.clue,
    clueStyle: p.clueStyle,
    imageUrl: p.imageUrl,
    audioUrl: p.audioUrl,
    row: p.row,
    col: p.col,
    direction: p.direction,
    number: numberByStartCell.get(cellKey(p.row, p.col))!,
  }));

  return {
    placements,
    gridWidth: maxCol + 1,
    gridHeight: maxRow + 1,
    isolatedWords,
  };
}

// Об'єднання клітинок УСІХ placements — яка клітинка відкрита (частина
// хоч одного слова), незалежно від того, яким саме. Спільна для
// sanitizeCrossword (форма для студента) і живого прев'ю в адмінці
// (crossword-fields.tsx) — та сама структура, що відрізняє "заблоковано"
// від "просто нема шуму", на відміну від word_search.
export function buildCrosswordOpenCells(
  placements: CrosswordPlacement[],
  width: number,
  height: number
): boolean[][] {
  const open: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));
  for (const p of placements) {
    for (const { row, col } of placementCells(p, p.word.length)) {
      if (row >= 0 && row < height && col >= 0 && col < width) open[row][col] = true;
    }
  }
  return open;
}

// Правильна літера на кожній відкритій клітинці ("" на заблокованих) —
// свідомо розкривається студенту в CrosswordPublic (компроміс заради
// живого підсвічування на клієнті без запиту на сервер), тому ця функція
// НЕ прихована, як openCells/cellNumbers, а прямий будівник для
// sanitizeCrossword. Та сама реконструкція, що раніше жила локально в
// crossword-fields.tsx (buildPreviewLetters) — тепер спільна, обидва
// місця рахують те саме з placements.
export function buildCrosswordSolution(
  placements: CrosswordPlacement[],
  width: number,
  height: number
): string[][] {
  const solution: string[][] = Array.from({ length: height }, () => Array(width).fill(""));
  for (const p of placements) {
    const cells = placementCells(p, p.word.length);
    cells.forEach(({ row, col }, i) => {
      if (row >= 0 && row < height && col >= 0 && col < width) solution[row][col] = p.word[i];
    });
  }
  return solution;
}

// Номер у клітинці, що починає слово(а) — вже пораховано в
// generateCrosswordGrid() (placements[].number), тут лише розкладається в
// 2D-форму для рендеру (адмінське прев'ю й sanitizeCrossword).
export function buildCrosswordCellNumbers(
  placements: CrosswordPlacement[],
  width: number,
  height: number
): (number | null)[][] {
  const numbers: (number | null)[][] = Array.from({ length: height }, () => Array(width).fill(null));
  for (const p of placements) {
    if (p.row >= 0 && p.row < height && p.col >= 0 && p.col < width) {
      numbers[p.row][p.col] = p.number;
    }
  }
  return numbers;
}
