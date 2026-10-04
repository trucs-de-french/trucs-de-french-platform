import sanitizeHtml from "sanitize-html";
import { IMAGE_ALIGN_VALUES, IMAGE_SIZE_VALUES, IMAGE_CROP_VALUES, IMAGE_FOCUS_VALUES } from "@/lib/rich-image-extension";
import {
  PARAGRAPH_TEXT_ALIGN_VALUES,
  PARAGRAPH_LINE_HEIGHT_VALUES,
  PARAGRAPH_FIRST_LINE_VALUES,
  PARAGRAPH_INDENT_VALUES,
} from "@/lib/paragraph-format-extension";

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
      // span: font-size (ЕТАП 2, той самий механізм TextStyle, що
      // font-family/color/background-color — усі разом style на span)
      // додається нижче через allowedStyles.span, не тут — style лишається
      // єдиним дозволеним атрибутом span.
      span: ["style"],
      // img: НІ class, НІ width/height, і НІ довільний style — вигляд
      // (float/розмір/обрізання) задає CSS за data-align/data-size/
      // data-crop/data-focus (.rich-text img[...] у globals.css). Єдиний
      // виняток — style на object-position: той, що прийшов У ВХІДНОМУ
      // HTML, завжди відкидається (transformTags нижче ніколи не копіює
      // attribs.style у next); те, що лишається в "style" після цієї
      // функції — ВИКЛЮЧНО згенероване з уже перевірених data-focus-x/y
      // (нижче), ніколи напряму з HTML, що зберігається в БД.
      img: ["src", "alt", "data-align", "data-size", "data-crop", "data-focus", "data-focus-x", "data-focus-y", "style"],
      // Параметри абзацу (ЕТАП 2) — data-* на самому блоковому вузлі,
      // той самий патерн, що data-align/data-size картинок: жодного style
      // чи class на p/h2/h3 (вигляд цілком у CSS за цими data-*,
      // globals.css). transformTags нижче відкидає будь-яке невалідне
      // значення (атрибут зникає, тег лишається).
      p: ["data-text-align", "data-first-line", "data-indent", "data-line-height"],
      h2: ["data-text-align", "data-first-line", "data-indent", "data-line-height"],
      h3: ["data-text-align", "data-first-line", "data-indent", "data-line-height"],
    },
    allowedStyles: {
      "*": {
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d.,\s%]+\)$/i],
        color: [/^#[0-9a-f]{3,8}$/i, /^inherit$/i, /^rgba?\([\d.,\s%]+\)$/i],
        "font-family": [/^[a-zA-Z0-9 ,'"-]+$/],
      },
      // ЕТАП 2: розмір тексту — лише ціле px у діапазоні 12-48 (той самий
      // діапазон, що в редакторі/UI), той самий span, що font-family/color
      // вище (@tiptap/extension-text-style, один <span style="..."> на всі
      // ці властивості разом). Жодних em/rem/%/calc — лише ця одна форма.
      span: {
        "font-size": [/^(1[2-9]|[2-3][0-9]|4[0-8])px$/],
      },
      // Друга лінія захисту понад "ми самі генеруємо це значення" нижче —
      // навіть якби transformTags десь помилився, лише object-position
      // рівно у форматі "N% N%" пройде далі; жоден інший спосіб (position,
      // transform, width тощо) потрапити в style на img неможливий.
      img: {
        "object-position": [/^\d{1,3}% \d{1,3}%$/],
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
        // Застарілий 5-кнопковий фокус — лишається прохідним незмінно
        // (старий контент, що ще не редагувався через точний вибір точки,
        // далі виглядає як раніше завдяки CSS-правилам
        // .rich-text img[data-focus=...], globals.css).
        if ((IMAGE_FOCUS_VALUES as string[]).includes(attribs["data-focus"])) {
          next["data-focus"] = attribs["data-focus"];
        }
        // Точний фокус — лише цілі 0-100, інакше атрибут просто
        // відкидається (як і решта data-*, без падіння). style на
        // object-position генерує САМ sanitizer з уже перевірених чисел —
        // ніколи з attribs.style вхідного HTML (той тут навіть не
        // читається) — єдиний спосіб потрапити туди.
        const parseFocusCoord = (raw: string | undefined): number | null => {
          if (raw === undefined) return null;
          const n = Number(raw);
          return Number.isInteger(n) && n >= 0 && n <= 100 ? n : null;
        };
        const focusX = parseFocusCoord(attribs["data-focus-x"]);
        const focusY = parseFocusCoord(attribs["data-focus-y"]);
        if (focusX !== null) next["data-focus-x"] = String(focusX);
        if (focusY !== null) next["data-focus-y"] = String(focusY);
        // Якщо задана хоч одна координата — друга дефолтиться на 50 ЛИШЕ
        // для розрахунку style (не записується як окремий data-атрибут,
        // якщо її не було у вхідному HTML).
        if (focusX !== null || focusY !== null) {
          next.style = `object-position: ${focusX ?? 50}% ${focusY ?? 50}%`;
        }
        return { tagName: "img", attribs: next };
      },
      // Параметри абзацу (ЕТАП 2) — той самий принцип, що img вище:
      // будуємо next із нуля (ніколи не копіюємо вхідний style/class —
      // allowedAttributes для p/h2/h3 їх і так не пропустить, але так
      // next лишається єдиним джерелом правди), невалідне значення просто
      // відкидається (тег лишається, атрибут зникає), без падіння на
      // невідомому значенні. Один обробник на всі три теги — tagName
      // передає сам обробник, callback спільний.
      p: paragraphFormatTransform,
      h2: paragraphFormatTransform,
      h3: paragraphFormatTransform,
    },
  });
}

function paragraphFormatTransform(tagName: string, attribs: Record<string, string>) {
  const next: Record<string, string> = {};
  if ((PARAGRAPH_TEXT_ALIGN_VALUES as string[]).includes(attribs["data-text-align"])) {
    next["data-text-align"] = attribs["data-text-align"];
  }
  if ((PARAGRAPH_FIRST_LINE_VALUES as readonly number[]).includes(Number(attribs["data-first-line"]))) {
    next["data-first-line"] = attribs["data-first-line"];
  }
  if ((PARAGRAPH_INDENT_VALUES as readonly number[]).includes(Number(attribs["data-indent"]))) {
    next["data-indent"] = attribs["data-indent"];
  }
  if ((PARAGRAPH_LINE_HEIGHT_VALUES as string[]).includes(attribs["data-line-height"])) {
    next["data-line-height"] = attribs["data-line-height"];
  }
  return { tagName, attribs: next };
}
