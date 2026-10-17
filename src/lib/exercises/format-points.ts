import { pluralizePoints } from "@/lib/pluralize-points";

// Родовий відмінок після "з" ("N з M балів") — відрізняється від
// pluralizePoints (називний/рахунковий: "1 бал", "2 бали", "5 балів"):
// родовий однини завжди "бала" (не "бал"), родовий множини завжди "балів"
// (ніколи "бали" — те слово лише в рахунковій формі). Дробові possible
// (крок 0.5 у системі балів) — родовий однини "бала", той самий принцип,
// що pluralizePoints.
function genitivePointsWord(possible: number): "бала" | "балів" {
  const abs = Math.abs(possible);
  if (!Number.isInteger(abs)) return "бала";
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "бала";
  return "балів";
}

export function formatPoints(earned: number, possible: number): string {
  return `${earned} з ${possible} ${genitivePointsWord(possible)}`;
}

// Рахункова форма без "з" (standalone count) — та сама форма, що вже й досі
// складають виклик-сайти вручну через pluralizePoints (`${n} ${pluralizePoints(n)}`);
// тут лише для єдиної точки виклику в новому TaskResult/RowScorePill.
export function formatPointsCount(n: number): string {
  return `${n} ${pluralizePoints(n)}`;
}
