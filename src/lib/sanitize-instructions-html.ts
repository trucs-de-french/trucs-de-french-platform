import sanitizeHtml from "sanitize-html";

// Спільна функція для instructions/subInstructions у ВСІХ типах вправ —
// використовується і при збереженні (actions.ts, сервер), і при рендері
// студенту (InstructionsText, сервер) — той самий double-sanitize принцип,
// що вже є для callout (sanitize-callout-html.ts).
//
// Набагато вужчий allowlist, ніж callout: лише inline-форматування
// (жирний/курсив/підсвітка кольором) — жоден heading/list/blockquote/code,
// бо це не редактор статей, а панель B/I/колір над коротким полем
// інструкції, не повний TipTap.
export function sanitizeInstructionsHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["strong", "em", "mark", "br"],
    allowedAttributes: {
      mark: ["data-color", "style"],
    },
    allowedStyles: {
      mark: {
        "background-color": [/^#[0-9a-f]{3,8}$/i],
      },
    },
  });
}
