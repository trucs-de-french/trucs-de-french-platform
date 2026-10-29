// Чи бали за елементи вправи (statements/items/pairs/questions/rows/...)
// НЕ однакові — вчителька може задати кожному елементу власні бали в
// адмінці (кожен *-fields.tsx має свій updatePoints на елемент), це
// можливо і поза DELF. Коли один елемент "важить" інакше за решту,
// пілюля балів на НЬОМУ лишається видимою навіть поза DELF (інакше
// ховає реальну інформацію) — решта елементів (що мають типове,
// найчастіше значення балів) все одно не показують пілюлю.
export function unevenPointsFlags(points: number[]): boolean[] {
  if (points.length <= 1) return points.map(() => false);
  const counts = new Map<number, number>();
  for (const p of points) counts.set(p, (counts.get(p) ?? 0) + 1);
  let mode = points[0];
  let modeCount = 0;
  for (const [value, count] of counts) {
    if (count > modeCount) {
      mode = value;
      modeCount = count;
    }
  }
  if (modeCount === points.length) return points.map(() => false);
  return points.map((p) => p !== mode);
}
