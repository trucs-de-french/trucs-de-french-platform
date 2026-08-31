import sanitizeHtml from "sanitize-html";

// Спільна функція для callout-контенту (TipTap HTML) — використовується і
// при збереженні (actions.ts, сервер), і при рендері студенту (callout.tsx,
// сервер), і для швидкого клієнтського фідбеку в редакторі (callout-fields.tsx,
// браузер). sanitize-html — чистий JS (htmlparser2), без емуляції DOM, тому
// однаково працює і на сервері, і в браузері, на відміну від isomorphic-dompurify
// (тягнув jsdom, який ламав серверний білд на Netlify через ESM/CJS конфлікт
// углибині jsdom -> html-encoding-sniffer -> @exodus/bytes).
//
// Список тегів/атрибутів — точно те, що може згенерувати наш TipTap-редактор
// (StarterKit з heading levels [2,3], TextStyle/FontFamily, Highlight
// multicolor) — не універсальний allowlist "усього безпечного HTML".
export function sanitizeCalloutHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "strong",
      "em",
      "mark",
      "span",
      "br",
      "blockquote",
      "code",
      "pre",
      "hr",
    ],
    allowedAttributes: {
      mark: ["data-color", "style"],
      span: ["style"],
    },
    allowedStyles: {
      "*": {
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d.,\s%]+\)$/i],
        color: [/^#[0-9a-f]{3,8}$/i, /^inherit$/i, /^rgba?\([\d.,\s%]+\)$/i],
        "font-family": [/^[a-zA-Z0-9 ,'"-]+$/],
      },
    },
  });
}
