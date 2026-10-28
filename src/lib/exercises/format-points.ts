import { pluralizePoints } from "@/lib/pluralize-points";

// Округлення для показу (не для обчислень) — найближчі 0.5.
function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

// Родовий відмінок після "з" ("N з M балів") — відрізняється від
// pluralizePoints (називний/рахунковий: "1 бал", "2 бали", "5 балів"):
// родовий однини завжди "бала" (не "бал"), родовий множини завжди "балів"
// (ніколи "бали" — те слово лише в рахунковій формі). Рішення — з
// округленого до 0.5 значення (те, що реально показано), не з сирого
// possible: половинне значення — завжди родовий однини "бала".
function genitivePointsWord(possible: number): "бала" | "балів" {
  const abs = Math.abs(roundToHalf(possible));
  if (!Number.isInteger(abs)) return "бала";
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "бала";
  return "балів";
}

// Форматування ЛИШЕ для показу (не впливає на обчислення/порівняння/БД):
// округлення до найближчих 0.5 (Math.round(v*2)/2), ціле — без десяткових,
// половинне — одна цифра після КОМИ (інтерфейс українською, крапка
// лишилась тільки в сирих значеннях/БД). Джерело довгих хвостів — сума
// дробових pointsEarned/pointsPossible по задачах блоку (float-арифметика),
// не округлена до цього моменту навмисно.
export function formatScore(value: number): string {
  const rounded = roundToHalf(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
}

export function formatPoints(earned: number, possible: number): string {
  return `${formatScore(earned)} з ${formatScore(possible)} ${genitivePointsWord(possible)}`;
}

// Рахункова форма без "з" (standalone count) — та сама форма, що вже й досі
// складають виклик-сайти вручну через pluralizePoints (`${n} ${pluralizePoints(n)}`);
// тут лише для єдиної точки виклику в новому TaskResult/RowScorePill.
export function formatPointsCount(n: number): string {
  return `${formatScore(n)} ${pluralizePoints(n)}`;
}
