// Задача "wide standalone card should be content-width, not full row
// width" — orphan/overflowsColumn картки (pairPracticeItems,
// flat-practice-layout.ts) рендерились full:true -> md:col-span-2, займаючи
// РІВНО ширину всього рядка сітки (дві колонки) незалежно від того, скільки
// насправді потребує слово — картка з коротким словом (орфан) виглядала
// "роздутою". Цей файл — ЧИСТИЙ (без DOM) розрахунок ФАКТИЧНОЇ потрібної
// ширини такої картки: контент (однорядковий тайл-рядок слова, вже
// обрахований letterGapsSingleLineContentWidth/
// letterRearrangementSingleLineContentWidth, estimate-card-rows.ts) ПОРУЧ
// з рядком-заголовком (номер+переклад, щоб той не переносився даремно),
// обмежена [half-колонка .. full-рядок].
import type { CSSProperties } from "react";
import { CARD_PADDING_PX } from "@/components/exercises/use-working-tile-layout";
import {
  FULL_ROW_WIDTH_PX,
  REFERENCE_ROW_WIDTH_PX,
  letterGapsSingleLineContentWidth,
  letterRearrangementSingleLineContentWidth,
} from "./estimate-card-rows";

// .item-number-badge (globals.css) — кругла бейдж-плитка номера картки,
// перший елемент .word-card-number-row.
const NUMBER_BADGE_WIDTH_PX = 26;
// Проміжок між бейджем номера і текстом перекладу всередині
// .word-card-number-row — той самий масштаб наближення, що WORD_GAP_PX
// (estimate-card-rows.ts); рядок — звичайний inline-текстовий потік (<p>),
// не flex-gap, тож це не вимірювання CSS-властивості, лише орієнтир.
const BADGE_TEXT_GAP_PX = 8;
// Середня ширина символу українського тексту рядка перекладу (text-sm =
// 14px) — НАБЛИЖЕННЯ, не вимірювання шрифту (той самий принцип, що
// GIVEN_LETTER_WIDTH_PX, estimate-card-rows.ts): мета лише не стиснути
// переклад на вузькій картці, не піксель-perfect ширина тексту.
const AVG_UK_CHAR_WIDTH_PX = 7.5;

// Задача "header line must not be squeezed" — скільки місця потребує рядок
// "номер + переклад" (.word-card-number-row), щоб переклад НЕ переносився
// даремно на вузькій картці. Порожній переклад — лише бейдж.
export function estimateTranslationLineWidthPx(hintText: string): number {
  const text = hintText.trim();
  if (!text) return NUMBER_BADGE_WIDTH_PX;
  return NUMBER_BADGE_WIDTH_PX + BADGE_TEXT_GAP_PX + text.length * AVG_UK_CHAR_WIDTH_PX;
}

// МАЛИЙ чистий helper (юніт-тестований окремо, flat-practice-layout.test.ts
// чи власний файл тестів) — бере вже готові ВНУТРІШНІ ширини (контент
// однорядкової картки, рядок перекладу), ОБИРАЄ БІЛЬШУ (картка має вмістити
// ОБИДВА без переносу), додає CARD_PADDING_PX (внутрішній відступ картки з
// обох боків — зовнішня/outer ширина картки, не внутрішня) і обрізає
// результат до [half-колонка (REFERENCE_ROW_WIDTH_PX+padding) ..
// full-рядок (FULL_ROW_WIDTH_PX+padding)] — ширша картка НІКОЛИ не
// потрібна (full-рядок — максимум грід-рядка, і це значення ОДНОЧАСНО
// підкріплене буквальним CSS max-width:100% на викликачі, бо
// FULL_ROW_WIDTH_PX сам лише наближення реального екрана), вужча НІКОЛИ не
// менша за звичайну half-колонкову картку (узгодженість вигляду сітки).
export function computeWideCardOuterWidthPx(contentWidthPx: number, translationWidthPx: number): number {
  const innerWidth = Math.max(contentWidthPx, translationWidthPx);
  const outerWidth = innerWidth + CARD_PADDING_PX;
  const minOuterWidth = REFERENCE_ROW_WIDTH_PX + CARD_PADDING_PX;
  const maxOuterWidth = FULL_ROW_WIDTH_PX + CARD_PADDING_PX;
  return Math.min(maxOuterWidth, Math.max(minOuterWidth, outerWidth));
}

// Зручні обгортки для викликачів (letter-gaps.tsx/letter-rearrangement.tsx) —
// рахують ОБИДВІ внутрішні ширини (контент слова конкретного типу вправи +
// рядок перекладу) і одразу повертають готове ЗОВНІШНЄ значення ширини
// картки (px), яке йде напряму в CSS width/--wide-card-w.
export function letterGapsWideCardWidthPx(chars: (string | null)[], hintText: string): number {
  return computeWideCardOuterWidthPx(letterGapsSingleLineContentWidth(chars), estimateTranslationLineWidthPx(hintText));
}

export function letterRearrangementWideCardWidthPx(letterCount: number, hintText: string): number {
  return computeWideCardOuterWidthPx(
    letterRearrangementSingleLineContentWidth(letterCount),
    estimateTranslationLineWidthPx(hintText)
  );
}

// Задача "implement it as an explicit width value ... applied only to wide
// standalone cards on desktop; below the single-column breakpoint cards
// stay full width as today" — ОДНЕ спільне CSS-рішення для обох вправ
// (letter-gaps.tsx/letter-rearrangement.tsx), щоб не дублювати логіку в
// кожному з 3 місць рендеру (2 у letter-gaps.tsx, 1 у
// letter-rearrangement.tsx): md:col-span-2 резервує картці ПОВНУ ширину
// рядка-сітки (2 колонки) — без цього картка не могла б перевищити ширину
// ОДНІЄЇ колонки, навіть з явним width; md:justify-self-start — картка НЕ
// розтягується (стандартний stretch) на всю зарезервовану ширину, а йде
// зліва, шириною зі свого власного `width`; md:w-[var(--wide-card-w,100%)] —
// сам width, через CSS-змінну (вузько заданий ЛИШЕ на цьому елементі,
// style нижче) з фолбеком 100% (якщо з якоїсь причини ширину не
// підрахували — той самий вигляд, що й раніше, full-width, ніколи не
// "зникла" картка); md:max-w-full — підстраховка, якщо REFERENCE_ROW_WIDTH_PX/
// FULL_ROW_WIDTH_PX (наближення, не реальні піксели екрана) дають трохи
// забагато — картка ніколи не вилазить за межі свого грід-рядка. Ніяких
// класів НИЖЧЕ md: (мобільний, 1-колонковий режим) — там картка й так на
// всю ширину єдиної колонки, без додаткової логіки.
export const WIDE_CARD_WIDTH_CLASS = "md:col-span-2 md:justify-self-start md:w-[var(--wide-card-w,100%)] md:max-w-full";

export function wideCardWidthStyle(wideWidthPx: number | undefined): CSSProperties | undefined {
  return wideWidthPx !== undefined ? ({ "--wide-card-w": `${wideWidthPx}px` } as CSSProperties) : undefined;
}
