export type UiLang = "uk" | "fr";

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export function normalizeUiLang(value: unknown): UiLang {
  return value === "fr" ? "fr" : "uk";
}
