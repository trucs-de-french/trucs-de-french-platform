import type { UiLang } from "@/lib/ui/product-lang";
import { uk, type MessageKey } from "./messages/uk";
import { fr } from "./messages/fr";
import { en } from "./messages/en";
import { frenchNbsp } from "@/lib/text/french-typography";

const DICTIONARIES: Record<UiLang, Record<MessageKey, string>> = { uk, fr, en };

// Рантайм-фолбек: якщо ключа раптом нема (напр. ручна правка словника) —
// падаємо на uk, ніколи не показуємо сирий ключ студенту.
//
// frenchNbsp застосовується ТУТ, в одній точці, лише для lang === "fr" —
// ДО підстановки {params}: сам шаблон зі словника fr.ts може містити
// " :"/" ?"/" !"/" ;"/«"/»" (звичайні пробіли, бо людині їх так і друкувати
// зручніше), а interpolated-значення (слова з БД, числа) не мають
// випадково зачепитись регуляркою — вони ще не вставлені на цьому кроці,
// підстановка {name} відбувається ПІСЛЯ. Той самий helper, що вже
// викликають напряму InstructionsText/TaskInstructionLine для HTML з БД
// (sanitizeInstructionsHtml+frenchNbspHtml) — тут лише для чистих рядків
// словника, без HTML.
export function t(
  lang: UiLang,
  key: MessageKey,
  params?: Record<string, string | number>
): string {
  const raw = DICTIONARIES[lang]?.[key] ?? uk[key] ?? key;
  const template = lang === "fr" ? frenchNbsp(raw) : raw;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match
  );
}

export type { MessageKey };
