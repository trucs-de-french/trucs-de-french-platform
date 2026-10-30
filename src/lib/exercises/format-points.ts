import { pluralizePoints } from "@/lib/pluralize-points";
import type { UiLang } from "@/lib/ui/product-lang";
import { plural } from "@/lib/i18n/plural";
import { t } from "@/lib/i18n/t";

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

// Lang-aware варіанти для студентського інтерфейсу (ui_lang продукту) — uk
// лишається точно тим самим кодом/виводом, що formatScore/formatPoints/
// formatPointsCount вище (нуль ризику візуальної зміни для uk-продуктів);
// адмінка (checkbox-grid*.tsx там не рендериться) й надалі використовує
// лише uk-версії функцій вище напряму, без lang.
const POINTS_WORD: Record<UiLang, { one: string; other: string }> = {
  uk: { one: "бал", other: "балів" },
  fr: { one: "point", other: "points" },
  en: { one: "point", other: "points" },
};

function pointsWord(lang: UiLang, n: number): string {
  if (lang === "uk") return pluralizePoints(n);
  return plural(lang, n, POINTS_WORD[lang]);
}

export function formatScoreLocalized(value: number, lang: UiLang): string {
  // formatScore сам по собі мовно-нейтральний (округлення до 0.5 + кома
  // замість крапки лише в десятковій частині) — не "український" текст,
  // тож придатний для fr напряму (задача "0 sur 9.5 points" — French-UI
  // мав кому, "9,5", а не крапку; en лишається на крапці нижче).
  if (lang === "uk" || lang === "fr") return formatScore(value);
  const rounded = roundToHalf(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatPointsLocalized(earned: number, possible: number, lang: UiLang): string {
  if (lang === "uk") return formatPoints(earned, possible);
  const a = formatScoreLocalized(earned, lang);
  const b = formatScoreLocalized(possible, lang);
  return `${t(lang, "common.outOf", { a, b })} ${pointsWord(lang, possible)}`;
}

export function formatPointsCountLocalized(n: number, lang: UiLang): string {
  if (lang === "uk") return formatPointsCount(n);
  return `${formatScoreLocalized(n, lang)} ${pointsWord(lang, n)}`;
}
