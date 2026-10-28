import { HINT_EXPLANATION_KEYS } from "@/lib/exercises/hints";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";

// Текст лампочки-підказки (TaskPanelHeader, task-panel-header.tsx) — лише
// для типів із записом у HINT_EXPLANATION_KEYS; решта повертає null
// (викликач тоді просто не передає hintText далі, і пілюля не рендериться).
// Фраза "підказка дає половину балів" більше не йде в текст пілюлі — вона
// одна спільна смужка під заголовком "Завдання" (hints.ts,
// taskHintReducesPoints).
export function hintExplanationText(type: string, lang: UiLang): string | null {
  const key = HINT_EXPLANATION_KEYS[type];
  return key ? t(lang, key) : null;
}
