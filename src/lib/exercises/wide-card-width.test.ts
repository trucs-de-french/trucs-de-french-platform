// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що estimate-card-rows.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/wide-card-width.test.ts
//
// Задача "wide standalone card should be content-width, not full row
// width" — перевіряє МАЛИЙ чистий helper (computeWideCardOuterWidthPx) і
// допоміжні оцінки окремо від pairPracticeItems' сортування (яке
// тестується в flat-practice-layout.test.ts, бере готовий wideWidthPx як
// вхід, не рахує його саме).
import {
  computeWideCardOuterWidthPx,
  estimateTranslationLineWidthPx,
  letterGapsWideCardWidthPx,
  letterRearrangementWideCardWidthPx,
  wideCardWidthStyle,
} from "./wide-card-width";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

// CARD_PADDING_PX=28 (use-working-tile-layout.ts), REFERENCE_ROW_WIDTH_PX=
// 300, FULL_ROW_WIDTH_PX=612 (estimate-card-rows.ts) -> minOuterWidth=328,
// maxOuterWidth=640 (обчислено вручну, ті самі константи, що helper сам
// використовує).
const MIN_OUTER_WIDTH_PX = 328;
const MAX_OUTER_WIDTH_PX = 640;

// --- narrow content gets the half-column minimum ----------------------------

{
  // contentWidthPx=50, translationWidthPx=40 -> inner=max=50, outer=78,
  // far below the half-column minimum (328) -> clamped up to it.
  assert(
    computeWideCardOuterWidthPx(50, 40) === MIN_OUTER_WIDTH_PX,
    "narrow content (well under the half-column minimum) is clamped UP to the half-column minimum width"
  );
}

// --- wide content gets its own width (within bounds) ------------------------

{
  // contentWidthPx=400, translationWidthPx=40 -> inner=400, outer=428, which
  // sits strictly between min (328) and max (640) -> returned as-is.
  assert(
    computeWideCardOuterWidthPx(400, 40) === 428,
    "content width comfortably between the half-column minimum and the full row gets its own exact width"
  );
}

// --- very wide content gets capped at the full row --------------------------

{
  // contentWidthPx=900 -> outer=928, far above the full-row maximum (640)
  // -> clamped down to it.
  assert(
    computeWideCardOuterWidthPx(900, 40) === MAX_OUTER_WIDTH_PX,
    "very wide content (well over the full-row maximum) is clamped DOWN to the full-row maximum width"
  );
}

// --- the header line (translation) can widen the card beyond content -------

{
  // contentWidthPx=50 (tiny), translationWidthPx=350 (long UK translation)
  // -> inner=max(50,350)=350, outer=378: the translation, not the tile
  // content, determines the final width here (still within bounds).
  assert(
    computeWideCardOuterWidthPx(50, 350) === 378,
    "a long translation line widens the card even when the tile content itself is narrow, so it isn't squeezed"
  );
}

// --- exact boundary values pass through unclamped ---------------------------

{
  assert(computeWideCardOuterWidthPx(300, 0) === MIN_OUTER_WIDTH_PX, "content landing exactly on the minimum stays at the minimum");
  assert(computeWideCardOuterWidthPx(612, 0) === MAX_OUTER_WIDTH_PX, "content landing exactly on the maximum stays at the maximum");
}

// --- estimateTranslationLineWidthPx: badge-only for empty translations -----

{
  assert(estimateTranslationLineWidthPx("") === 26, "an empty translation needs only the number badge's width");
  assert(estimateTranslationLineWidthPx("   ") === 26, "a whitespace-only translation is treated as empty");
  // "café" — 4 characters -> 26 (badge) + 8 (gap) + 4*7.5 (chars) = 64.
  assert(estimateTranslationLineWidthPx("café") === 64, "a non-empty translation adds badge + gap + per-character width");
}

// --- letterGapsWideCardWidthPx / letterRearrangementWideCardWidthPx --------
// (convenience wrappers combining content width + translation width)

function visibleUnit(n: number): string[] {
  return Array.from({ length: n }, () => "a");
}

{
  // A single 11-letter visible unit -> content width = 11*11 = 121px
  // (GIVEN_LETTER_WIDTH_PX, estimate-card-rows.ts), far below the
  // half-column minimum -> clamped up, same as the pure helper above.
  const width = letterGapsWideCardWidthPx(visibleUnit(11), "");
  assert(width === MIN_OUTER_WIDTH_PX, "letterGapsWideCardWidthPx: short word content is clamped to the half-column minimum");

  // A long translation on the same short word widens the card beyond the
  // half-column minimum but not past the full row.
  const widthWithLongTranslation = letterGapsWideCardWidthPx(visibleUnit(11), "a".repeat(60));
  assert(
    widthWithLongTranslation > MIN_OUTER_WIDTH_PX && widthWithLongTranslation <= MAX_OUTER_WIDTH_PX,
    "letterGapsWideCardWidthPx: a long translation widens the card past the minimum, still capped at the full row"
  );
}

{
  // 9 tiles -> content width = 9*32 + 8*3.4 = 288+27.2 = 315.2px; outer =
  // 315.2+28 = 343.2px, ALREADY above the half-column minimum (328) -> its
  // own width, not clamped (a 9-tile orphan card is comfortably wider than
  // a bare half-column card, so it keeps its exact content width).
  const width = letterRearrangementWideCardWidthPx(9, "");
  assert(
    Math.abs(width - 343.2) < 0.01,
    "letterRearrangementWideCardWidthPx: a 9-tile word's content width is used as-is, above the half-column minimum"
  );

  // A single tile (1) -> content width = 32px, outer = 60px, far under the
  // half-column minimum -> clamped up.
  const narrowWidth = letterRearrangementWideCardWidthPx(1, "");
  assert(
    narrowWidth === MIN_OUTER_WIDTH_PX,
    "letterRearrangementWideCardWidthPx: a single-tile word's content is clamped to the half-column minimum"
  );
}

// --- wideCardWidthStyle: undefined width -> no style object ----------------

{
  assert(wideCardWidthStyle(undefined) === undefined, "no width -> no style object (caller falls back to the CSS default)");
  const style = wideCardWidthStyle(400);
  assert(!!style && (style as Record<string, string>)["--wide-card-w"] === "400px", "a given width becomes the --wide-card-w CSS variable, in px");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All wide-card-width tests passed.");
