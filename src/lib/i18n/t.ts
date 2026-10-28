import type { UiLang } from "@/lib/ui/product-lang";
import { uk, type MessageKey } from "./messages/uk";
import { fr } from "./messages/fr";
import { en } from "./messages/en";

const DICTIONARIES: Record<UiLang, Record<MessageKey, string>> = { uk, fr, en };

// Рантайм-фолбек: якщо ключа раптом нема (напр. ручна правка словника) —
// падаємо на uk, ніколи не показуємо сирий ключ студенту.
export function t(
  lang: UiLang,
  key: MessageKey,
  params?: Record<string, string | number>
): string {
  const template = DICTIONARIES[lang]?.[key] ?? uk[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match
  );
}

export type { MessageKey };
