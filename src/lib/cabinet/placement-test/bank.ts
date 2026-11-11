import rawBank from "./bank.json";

// Банк питань тесту рівня — французькі формулювання НЕ перекладаються й
// не йдуть через i18n (лише UI-рядки навколо них). JSON лежить поруч як є
// (без редагування питань), цей файл — лише типізований доступ + санітарна
// перевірка форми при імпорті.
export type Level = "A1" | "A2" | "B1" | "B2" | "C1C2";
export type QuestionKind = "grammar" | "vocab";

export type Question = {
  id: string;
  kind: QuestionKind;
  q: string;
  options: string[];
  answer: number;
};

export type Bank = {
  levels: Level[];
  perPart: number;
  passMark: number;
  parts: Record<Level, Question[]>;
};

export const BANK = rawBank as unknown as Bank;

// Рантайм sanity-check — ловить пошкоджений/відредагований bank.json
// одразу при старті (dev), а не на випадковому питанні посеред тесту.
function assertSaneBank(bank: Bank): void {
  for (const level of bank.levels) {
    const questions = bank.parts[level];
    if (!Array.isArray(questions) || questions.length !== bank.perPart) {
      throw new Error(
        `placement-test bank: level ${level} has ${questions?.length ?? 0} questions, expected ${bank.perPart}`
      );
    }
    for (const question of questions) {
      if (question.answer < 0 || question.answer >= question.options.length) {
        throw new Error(`placement-test bank: question ${question.id} has an out-of-range answer index`);
      }
      if (new Set(question.options).size !== question.options.length) {
        throw new Error(`placement-test bank: question ${question.id} has duplicate options`);
      }
    }
  }
}

if (process.env.NODE_ENV !== "production") {
  assertSaneBank(BANK);
}
