import sanitizeHtml from "sanitize-html";

// Спільна функція для instructions/subInstructions у ВСІХ типах вправ —
// використовується і при збереженні (actions.ts, сервер), і при рендері
// студенту (InstructionsText, сервер) — той самий double-sanitize принцип,
// що вже є для callout (sanitize-callout-html.ts).
//
// Набагато вужчий allowlist, ніж callout: лише inline-форматування
// (жирний/курсив/підсвітка кольором) — жоден heading/list/blockquote/code.
// "p" — не для структури статті (як у callout), а тому, що TipTap
// (InstructionsRichTextField) ЗАВЖДИ огортає вміст у <p> (вимога моделі
// документа ProseMirror, навіть для одного рядка) — без цього тега
// підінструкції з кількома абзацами (Enter -> новий <p>) злилися б в один
// рядок без пробілу при санітизації.
export function sanitizeInstructionsHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "strong", "em", "mark", "br"],
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
