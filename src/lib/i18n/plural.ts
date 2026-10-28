import type { UiLang } from "@/lib/ui/product-lang";

const LOCALE: Record<UiLang, string> = { uk: "uk", fr: "fr", en: "en" };

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

// Intl.PluralRules.select(n) повертає категорію ("one"/"few"/"many"/"other"
// для uk, лише "one"/"other" для fr/en) — forms може не мати всіх категорій
// (fr/en ніколи не дають few/many), тоді падаємо на forms.other.
export function plural(lang: UiLang, n: number, forms: PluralForms): string {
  const category = new Intl.PluralRules(LOCALE[lang]).select(n);
  return forms[category] ?? forms.other;
}
