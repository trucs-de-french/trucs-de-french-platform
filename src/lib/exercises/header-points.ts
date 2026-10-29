import { formatPointsCountLocalized, formatPointsLocalized } from "./format-points";
import { statusTone } from "@/components/exercises/task-result";
import type { UiLang } from "@/lib/ui/product-lang";

// Єдина пілюля балів у заголовку панелі (TaskPanelHeader.pointsText +
// verdict) — одне місце для правила "до перевірки показуємо максимум,
// після — earned sur possible + статус-чіп", замінює розрізнені копії
// цієї умови в кожному типі вправи. earned===undefined — ще не
// перевірено (чи, для блокових вправ, активний блок іще не перевірено);
// pointsVisible тут навмисно НЕ приймається — загальна пілюля балів
// показується ЗАВЖДИ до перевірки (задача "єдина пілюля балів усюди"),
// на відміну від per-item бульбашок (RowPointsTab), де pointsVisible
// і далі має сенс.
export function headerPointsState(
  possible: number,
  earned: number | undefined,
  lang: UiLang
): {
  pointsText: string;
  verdict?: { label: string; title: string; tone: "success" | "warn" | "error" };
} {
  if (earned === undefined) {
    return { pointsText: formatPointsCountLocalized(possible, lang) };
  }
  const { tone, label, title } = statusTone(earned >= possible, earned, possible);
  return { pointsText: formatPointsLocalized(earned, possible, lang), verdict: { label, title, tone } };
}
