// Офіційна структура іспиту DELF (режим Examen) — послідовність секцій і
// ліміти часу по рівнях. Як і evaluation-grids.ts, це незмінні регламентні
// дані (не контент, який редагує вчитель), тому — код-константа, не таблиця
// БД. Поки НЕ використовується жодним UI (готово для Етапу 3).

import type { DelfLevel } from "./evaluation-grids";

export type ExamSection = "CO" | "CE" | "PE" | "PO";

export const EXAM_SECTIONS: ExamSection[] = ["CO", "CE", "PE", "PO"];

export const EXAM_SECTION_LABELS: Record<ExamSection, string> = {
  CO: "Compréhension orale",
  CE: "Compréhension écrite",
  PE: "Production écrite",
  PO: "Production orale",
};

export type ExamTiming = {
  /** хвилини на кожну секцію */
  minutes: Record<ExamSection, number>;
  /** хвилини підготовки перед PO (окремо від часу самої секції PO) */
  poPrepMinutes: number;
};

export const EXAM_STRUCTURE: Record<DelfLevel, ExamTiming> = {
  A1: {
    minutes: { CO: 20, CE: 30, PE: 30, PO: 7 },
    poPrepMinutes: 10,
  },
  A2: {
    minutes: { CO: 25, CE: 30, PE: 45, PO: 8 },
    poPrepMinutes: 10,
  },
  B1: {
    minutes: { CO: 25, CE: 45, PE: 45, PO: 15 },
    poPrepMinutes: 10,
  },
  B2: {
    minutes: { CO: 30, CE: 60, PE: 60, PO: 20 },
    poPrepMinutes: 30,
  },
};
