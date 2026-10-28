export type UiLang = "uk" | "fr" | "en";

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

const UI_LANGS: readonly UiLang[] = ["uk", "fr", "en"];

export function normalizeUiLang(value: unknown): UiLang {
  return (UI_LANGS as readonly unknown[]).includes(value) ? (value as UiLang) : "uk";
}
