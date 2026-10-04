import sanitizeHtml from "sanitize-html";
import { IMAGE_ALIGN_VALUES, IMAGE_SIZE_VALUES, IMAGE_CROP_VALUES, IMAGE_FOCUS_VALUES } from "@/lib/rich-image-extension";

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
// multicolor, RichImage) — не універсальний allowlist "усього безпечного HTML".
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
      "img",
    ],
    allowedAttributes: {
      mark: ["data-color", "style"],
      span: ["style"],
      // img: НІ style, НІ class, НІ width/height — вигляд (float/розмір/
      // обрізання) задає лише CSS за data-align/data-size/data-crop/
      // data-focus (.rich-text img[...] у globals.css), не inline-атрибути
      // з HTML, що зберігається в БД.
      img: ["src", "alt", "data-align", "data-size", "data-crop", "data-focus"],
    },
    allowedStyles: {
      "*": {
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d.,\s%]+\)$/i],
        color: [/^#[0-9a-f]{3,8}$/i, /^inherit$/i, /^rgba?\([\d.,\s%]+\)$/i],
        "font-family": [/^[a-zA-Z0-9 ,'"-]+$/],
      },
    },
    // Лише https — жодних javascript:/data:/http:/відносних шляхів (R2
    // publicUrl завжди https, вставка за посиланням теж має вимагати https).
    allowedSchemesByTag: {
      img: ["https"],
    },
    // data-align/data-size/data-crop/data-focus — лише значення з
    // whitelist RichImage-розширення (src/lib/rich-image-extension.ts);
    // будь-яке інше значення (напр. з прямого правки HTML в БД в обхід
    // адмінки) просто відкидається, без падіння на невідомому значенні —
    // тег лишається, атрибут зникає.
    transformTags: {
      img: (tagName, attribs) => {
        const next: Record<string, string> = {};
        if (attribs.src) next.src = attribs.src;
        if (attribs.alt) next.alt = attribs.alt;
        if ((IMAGE_ALIGN_VALUES as string[]).includes(attribs["data-align"])) {
          next["data-align"] = attribs["data-align"];
        }
        if ((IMAGE_SIZE_VALUES as string[]).includes(attribs["data-size"])) {
          next["data-size"] = attribs["data-size"];
        }
        if ((IMAGE_CROP_VALUES as string[]).includes(attribs["data-crop"])) {
          next["data-crop"] = attribs["data-crop"];
        }
        if ((IMAGE_FOCUS_VALUES as string[]).includes(attribs["data-focus"])) {
          next["data-focus"] = attribs["data-focus"];
        }
        return { tagName: "img", attribs: next };
      },
    },
  });
}
