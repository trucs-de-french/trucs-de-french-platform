import { formatPointsCountLocalized } from "./format-points";
import type { UiLang } from "@/lib/ui/product-lang";

// Пілюля балів у заголовку панелі (TaskPanelHeader.pointsText) — ЗАВЖДИ
// показує ЗАГАЛЬНИЙ бал вправи/блоку і НЕ змінюється після перевірки
// (ревізія f057578/fd04fac: earned+вердикт-чіп повернулись у підсумковий
// рядок TaskResult, task-result.tsx, замість заміни цієї пілюлі в
// заголовку). earned лишається параметром заради сумісності всіх 19
// викликів (кожен передає `result?.pointsEarned` другим аргументом) —
// навмисно ігнорується. pointsVisible тут і раніше НЕ приймався —
// загальна пілюля балів показується ЗАВЖДИ, на відміну від per-item
// бульбашок (RowPointsTab), де pointsVisible і далі має сенс.
export function headerPointsState(
  possible: number,
  _earned: number | undefined,
  lang: UiLang
): { pointsText: string } {
  return { pointsText: formatPointsCountLocalized(possible, lang) };
}
