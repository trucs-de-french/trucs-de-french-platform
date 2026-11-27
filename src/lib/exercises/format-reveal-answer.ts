// "Робота над помилками", сцена-вигляд (крок 3b) — чисті форматери
// /api/exercises/practice/reveal-відповідей у вигляд, який уже вміють
// малювати TaskResultGapRows/TaskResultAnswerRows/TaskResultPairRows
// (task-result.tsx, той самий компонент/розмітка, що звичайна вправа).
// Звичайна вправа будує ці рядки з gradeAnswer-detail (повна правильність
// кожної позиції, рахує сервер при /api/exercises/check) — практика
// принципово НЕ отримує такий detail із правильними відповідями
// (/api/exercises/practice/check лишає лише isCorrect, config студенту
// теж без відповідей): єдине джерело тут — відповідь reveal (по елементу,
// лениво, лише коли студент відкриває панель), тож форматери нижче беруть
// САМЕ її форму (повне слово / рядок [лівеЯкщоПрихована, правеЯкщоПрихована]
// / право однієї пари), а не детейл.

export type RevealedWordDetail = { letters: { text: string; isCorrect: boolean }[]; isCorrect: boolean };

// letter_rearrangement — єдиний тип без колапс-панелі відповідей (крок 3c):
// розкриття одного слова (practice/reveal, answer[0] — повне правильне
// слово) має виглядати в картці ТОЧНО як звичайна вправа (renderWordCard:
// підсвічування плиток за позицією + рядок "Правильне слово"), а не
// просто текстом збоку. currentOrder — поточний порядок плиток студента
// (orders[wi], живий стан, не зафіксована відповідь) — порівнюється
// позиційно з розкритим словом, той самий принцип, що gradeLetterRearrangement
// (grade.ts), лише джерело правильної літери інше (reveal, не config).
export function buildRevealedWordDetail(revealedWord: string, currentOrder: string[]): RevealedWordDetail {
  const letters = revealedWord.split("").map((text, i) => ({ text, isCorrect: currentOrder[i] === text }));
  return { letters, isCorrect: letters.every((l) => l.isCorrect) };
}

export type GapAnswerRow = { number: number; parts: (string | { word: string })[] };

// letter_gaps (позиційний, chars/hiddenLetters) — reveal повертає ПОВНЕ
// слово (word.word, несанітизований сервером config) в answer[0], а
// chars (null на місці пропуску) уже є в публічному config студента: i-та
// позиція full[i] відповідає i-й позиції chars (той самий рядок, лише
// частина прихована), тож лишається позиційно зіставити.
export function buildGapRowsFromReveal(
  wordIndices: number[],
  charsByIndex: (readonly (string | null)[])[],
  revealedWordByIndex: Record<number, string | undefined>
): GapAnswerRow[] {
  return wordIndices.map((wi, pos) => {
    const chars = charsByIndex[wi] ?? [];
    const full = revealedWordByIndex[wi] ?? "";
    const parts: (string | { word: string })[] = [];
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch === null) {
        const letter = full[i] ?? "";
        const last = parts[parts.length - 1];
        if (last && typeof last === "object") last.word += letter;
        else parts.push({ word: letter });
      } else {
        const last = parts[parts.length - 1];
        if (typeof last === "string") parts[parts.length - 1] = last + ch;
        else parts.push(ch);
      }
    }
    return { number: pos + 1, parts };
  });
}

export type TableFillAnswerRow = {
  number: number;
  left: string;
  leftIsAnswer: boolean;
  right: string;
  rightIsAnswer: boolean;
};

// table_fill (елемент — РЯДОК, 1-2 прихованих клітинки) — reveal повертає
// answer у порядку left-перед-right (лише для ПРИХОВАНИХ сторін,
// /api/exercises/practice/reveal: "if (row.leftHidden) answer.push(...);
// if (row.rightHidden) answer.push(...)"), тож лишається споживати по
// черзі, той самий порядок.
export function buildTableFillAnswerRowsFromReveal(
  rows: { id: string; left: string | null; right: string | null }[],
  numberOffset: number,
  revealedByRowId: Record<string, string[] | undefined>
): TableFillAnswerRow[] {
  return rows.map((row, i) => {
    const revealed = revealedByRowId[row.id] ?? [];
    let idx = 0;
    const leftIsAnswer = row.left === null;
    const rightIsAnswer = row.right === null;
    const left = row.left ?? revealed[idx++] ?? "";
    const right = row.right ?? revealed[idx] ?? "";
    return { number: numberOffset + i + 1, left, leftIsAnswer, right, rightIsAnswer };
  });
}

export type MatchingPairRow = { left: string; right: string };

// matching (елемент — ПАРА, right — секрет до reveal) — reveal повертає
// [pair.right] в answer[0]; left відомий напряму (пари практики, config.left
// уже видимий студенту), лише right береться з кешу reveal по pair.id
// (idByLeft.get(left)).
export function buildMatchingPairRowsFromReveal(
  leftItems: string[],
  idByLeft: Map<string, string>,
  revealedByPairId: Record<string, string[] | undefined>
): MatchingPairRow[] {
  return leftItems.map((left) => {
    const id = idByLeft.get(left);
    const right = (id ? revealedByPairId[id]?.[0] : undefined) ?? "";
    return { left, right };
  });
}

export type SortColumnsAnswerColumn = {
  columnId: string;
  label: string;
  items: { id: string; text: string }[];
};

// sort_columns (whole-режим, один WHOLE_TASK_ITEM_ID на всю вправу) —
// той самий груповий вигляд "колонка-заголовок + плитки слів", що
// звичайна вправа (singleDetail.items[].correctColumnId, sort-columns.tsx)
// і практика (reveal повертає ["itemId:columnId", ...] в answer, той
// самий формат, що сервер уже writes/рендерить сам, тут лише парситься).
// columnIdByItemId — спільний проміжний формат, щоб ОДНА функція
// групувала і для singleDetail (correctColumnId напряму), і для
// revealed-пар (розібраних на itemId→columnId викликачем до передачі
// тут) — не знає, звідки прийшла мапа.
export function buildSortColumnsAnswerColumns(
  columns: { id: string; label: string }[],
  items: { id: string; text: string }[],
  columnIdByItemId: Record<string, string | undefined>
): SortColumnsAnswerColumn[] {
  return columns.map((col) => ({
    columnId: col.id,
    label: col.label,
    items: items.filter((item) => columnIdByItemId[item.id] === col.id),
  }));
}

export type PracticeOptionDetail = { id: string; text: string; correct: boolean; selected: boolean };

// Задача "highlight instead of text line" — true_false/listening/
// multiple_choice/word_choice усі мають ТУ САМУ форму детейла для
// кольору варіантів (chipClass/tileClass/optionClass у кожному файлі:
// {id, text, correct, selected}) — звичайна вправа будує її з повного
// gradeAnswer-detail, практика НЕ має такого detail (лише isCorrect і,
// по кнопці, revealed = масив ТЕКСТУ правильних варіантів, не id).
// Цей чистий helper будує ТУ САМУ форму для практики за 4 станами, з
// тим самим пріоритетом, що practiceAttemptFooterState (error-review.ts):
// - revealed (явне розкриття) — єдиний момент, коли correct:true може
//   з'явитись на варіанті, якого студент НЕ обирав (порівняння за
//   ТЕКСТОМ варіанту — те, що повертає reveal API).
// - isCorrect===true (без розкриття) — ніякого витоку: правильний варіант
//   і так лише той, що студент сам обрав.
// - isCorrect===false (без розкриття) — ЖОДЕН варіант не correct:true
//   (не показуємо, яка правильна), лише студентський вибір отримує
//   selected:true (колір "неправильно обрано" на відповідальності
//   chipClass/tileClass/optionClass, не тут).
// - undefined (ще не перевірялось) — немає чого підсвічувати взагалі.
export function practiceOptionDetail(
  options: { id: string; text: string }[],
  selectedIds: string[],
  isCorrect: boolean | undefined,
  revealedTexts: string[] | undefined
): PracticeOptionDetail[] | undefined {
  if (revealedTexts) {
    const correctTexts = new Set(revealedTexts);
    return options.map((o) => ({ id: o.id, text: o.text, correct: correctTexts.has(o.text), selected: selectedIds.includes(o.id) }));
  }
  if (isCorrect === true) {
    return options.map((o) => ({ id: o.id, text: o.text, correct: selectedIds.includes(o.id), selected: selectedIds.includes(o.id) }));
  }
  if (isCorrect === false) {
    return options.map((o) => ({ id: o.id, text: o.text, correct: false, selected: selectedIds.includes(o.id) }));
  }
  return undefined;
}

// Задача "checkbox_grid: in-place marking instead of panel/pill" —
// checkbox-grid.tsx рендерить і сітку, і легенду з ОДНОГО спільного
// `detail` (той самий компонент/розмітка для сцени й практики), яка
// вже й сама розрізняє 4 стани клітинки: studentChecked+correctChecked
// → correct (зелена), studentChecked+!correctChecked → wrong (червона),
// !studentChecked+correctChecked → missed (пунктирна зелена — "правильна
// відповідь, яку Ви пропустили"), інакше — нейтральна. Саме ОСТАННІЙ
// стан (missed) є проблемою для практики: він показує, ЩО мало бути
// позначено, навіть на клітинці, яку студент ніколи не торкався — тобто
// розкриває відповідь одразу на будь-якій перевірці, без явного
// розкриття кнопкою. Ця чиста функція маскує саме його (і лише його) —
// поки відповідь не розкрита, missed-клітинка повертається як звичайна
// незамаркована (studentChecked:false, correctChecked:false), той самий
// вигляд, що порожня клітинка до першої перевірки; correct/wrong (власні
// позначки студента) ніколи не маскуються — вони нічого не розкривають
// про те, що мало бути ІНШЕ.
export function maskMissedCheckboxCells<T extends { studentChecked: boolean; correctChecked: boolean }>(
  cells: T[],
  revealed: boolean
): T[] {
  if (revealed) return cells;
  return cells.map((c) => (!c.studentChecked && c.correctChecked ? { ...c, correctChecked: false } : c));
}

// Задача "equal gap on both sides of the chip" (TaskResultGapRows —
// owner report: "du [lait] dans" мав помітно БІЛЬШИЙ відступ зліва, ніж
// справа) — корінь: CSS margin-left на чипі (попередня задача) додавався
// ПОВЕРХ уже наявного звичайного пробілу з тексту речення (sentence.split
// "{{}}" лишає пробіл по обидва боки "{{}}" там, де в реченні справді
// був пробіл), тож зліва виходило "пробіл + margin", справа — лише
// "пробіл". Рішення — БЕЗ CSS margin узагалі (прибрано в globals.css):
// текст перед чипом нормалізується РІВНО до одного пробілу тут, текст
// ПІСЛЯ чипа лишається незмінним — пунктуація без пробілу (crush "ciel.")
// і далі лишається приклеєною, звичайне слово з одним пробілом лишається
// симетричним само по собі, без допомоги margin.
//
// НЕ застосовувати до letter_gaps (buildLetterGapsRows/
// buildGapRowsFromReveal) — там чип завжди УСЕРЕДИНІ слова (буква),
// пробіл там НІКОЛИ не потрібен з жодної сторони.
export function normalizeGapBefore(text: string): string {
  const trimmed = text.replace(/\s+$/, "");
  return trimmed === "" ? "" : trimmed + " ";
}
