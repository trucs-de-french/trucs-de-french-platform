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
