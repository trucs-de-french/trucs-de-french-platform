import type { FrenchLevel } from "@/lib/supabase/profile";
import { BANK, type Bank, type Level, type QuestionKind } from "./bank";

// Чисті функції (без DOM/sessionStorage) — тестовані напряму в Node.
// Логіка портована 1:1 з інтерактивного макета (5 частин по 10 питань,
// passMark=7, зупинка на першій непройденій частині).

export type ShuffledQuestion = {
  id: string;
  kind: QuestionKind;
  q: string;
  options: string[];
  answer: number;
};

export type PartAttempt = ShuffledQuestion[];

export type TestState = {
  part: number; // індекс поточної частини в BANK.levels
  qi: number; // індекс поточного питання в межах частини
  sel: number | null; // вибраний варіант поточного питання (null — не вибрано)
  scores: number[]; // результат (correct count) кожної ЗАВЕРШЕНОЇ частини
  cur: number; // correct count поточної (ще не завершеної) частини
  g: number; // сумарно правильних — граматика, по всьому тесту
  v: number; // сумарно правильних — лексика, по всьому тесту
  qs: PartAttempt[]; // згенеровані (перемішані) питання кожної стартованої частини
  finished: boolean;
};

export type RandomFn = () => number;

export function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

// Fisher–Yates, random — ін'єкція для детермінованих тестів.
export function shuffle<T>(arr: readonly T[], random: RandomFn): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

// Перемішує ВАРІАНТИ кожного питання частини (не порядок питань — той
// лишається фіксованим, авторським, від найлегшого до найважчого).
export function pickPart(bank: Bank, level: Level, random: RandomFn): PartAttempt {
  return bank.parts[level].map((question) => {
    const order = shuffle(
      question.options.map((_, i) => i),
      random
    );
    return {
      id: question.id,
      kind: question.kind,
      q: question.q,
      options: order.map((i) => question.options[i]),
      answer: order.indexOf(question.answer),
    };
  });
}

export function nextAfterPart(bank: Bank, partIndex: number, score: number): boolean {
  return score >= bank.passMark && partIndex < bank.levels.length - 1;
}

// Рівень = останній ПРОЙДЕНИЙ блок по порядку; якщо першу частину не
// пройдено — "A0". Зупиняється на першій непройденій (не продовжує
// шукати далі, навіть якщо випадково пізніший score теж >= passMark —
// такого й не станеться, бо тест фізично зупиняється на провалі).
export function evaluateLevel(bank: Bank, partScores: number[]): FrenchLevel {
  let passed = -1;
  for (let i = 0; i < partScores.length; i++) {
    if (partScores[i] >= bank.passMark) passed = i;
    else break;
  }
  return passed < 0 ? "A0" : bank.levels[passed];
}

export function createInitialState(bank: Bank, random: RandomFn): TestState {
  return {
    part: 0,
    qi: 0,
    sel: null,
    scores: [],
    cur: 0,
    g: 0,
    v: 0,
    qs: [pickPart(bank, bank.levels[0], random)],
    finished: false,
  };
}

export function selectOption(state: TestState, index: number): TestState {
  return { ...state, sel: index };
}

// choiceIndex === -1 means "Не знаю" (зараховується як неправильна).
export function answerQuestion(state: TestState, bank: Bank, choiceIndex: number, random: RandomFn): TestState {
  const part = state.qs[state.part];
  const question = part[state.qi];
  let { cur, g, v } = state;
  if (choiceIndex === question.answer) {
    cur++;
    if (question.kind === "vocab") v++;
    else g++;
  }

  let qi = state.qi + 1;
  let qs = state.qs;
  let scores = state.scores;
  let partIndex = state.part;
  let finished = false;

  if (qi >= part.length) {
    scores = [...state.scores, cur];
    if (nextAfterPart(bank, partIndex, cur)) {
      partIndex++;
      qi = 0;
      cur = 0;
      qs = [...state.qs, pickPart(bank, bank.levels[partIndex], random)];
    } else {
      finished = true;
    }
  }

  return { ...state, part: partIndex, qi, sel: null, cur, g, v, qs, scores, finished };
}

export function countAsked(state: TestState, kind: QuestionKind): number {
  let n = 0;
  for (const part of state.qs) {
    for (const q of part) if (q.kind === kind) n++;
  }
  return n;
}

export type TestTotals = {
  grammarCorrect: number;
  grammarAsked: number;
  vocabCorrect: number;
  vocabAsked: number;
};

export function computeTotals(state: TestState): TestTotals {
  return {
    grammarCorrect: state.g,
    grammarAsked: countAsked(state, "grammar"),
    vocabCorrect: state.v,
    vocabAsked: countAsked(state, "vocab"),
  };
}

export function createInitialPlacementTestState(random: RandomFn = cryptoRandom): TestState {
  return createInitialState(BANK, random);
}
