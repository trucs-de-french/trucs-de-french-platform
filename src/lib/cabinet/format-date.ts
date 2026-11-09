import type { UiLang } from "@/lib/ui/product-lang";

// Числовий формат дати dd.MM.yyyy (uk) / dd/MM/yyyy (fr, en) — чистий
// розбір рядка "YYYY-MM-DD" (без new Date()/toISOString()), бо Date у UTC
// зсунув би показану дату на день для значень дат-без-часу на межі доби.
export function formatDateNumeric(dateStr: string, lang: UiLang): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;
  const [, year, month, day] = match;
  const separator = lang === "uk" ? "." : "/";
  return `${day}${separator}${month}${separator}${year}`;
}
