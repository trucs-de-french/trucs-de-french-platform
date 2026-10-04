import { Extension } from "@tiptap/core";

export type ParagraphTextAlign = "left" | "center" | "right" | "justify";
export type ParagraphLineHeight = "1" | "1.15" | "1.5" | "2" | "2.5";

export const PARAGRAPH_TEXT_ALIGN_VALUES: ParagraphTextAlign[] = ["left", "center", "right", "justify"];
export const PARAGRAPH_LINE_HEIGHT_VALUES: ParagraphLineHeight[] = ["1", "1.15", "1.5", "2", "2.5"];
export const PARAGRAPH_FIRST_LINE_VALUES = [1, 2, 3] as const;
export const PARAGRAPH_INDENT_VALUES = [1, 2, 3, 4, 5, 6] as const;

// Експортовано — RichArticleEditor викликає editor.chain().updateAttributes(type, ...)
// для КОЖНОГО з цих типів по черзі (той самий патерн, що офіційний
// TextAlign.addCommands, лише без обгортання у власну TipTap-команду:
// уникає розширення глобального інтерфейсу Commands заради однієї функції,
// що й так викликається лише з одного місця).
export const PARAGRAPH_FORMATTABLE_TYPES = ["paragraph", "heading"] as const;
const FORMATTABLE_TYPES: string[] = [...PARAGRAPH_FORMATTABLE_TYPES];

function parseEnum<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function parseIntInRange(value: string | null, min: number, max: number): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

// Параметри абзацу (вирівнювання/відступ першого рядка/відступ зліва/
// міжрядковий інтервал) — data-* на самому блоковому вузлі (p/h2/h3), НЕ
// inline style: той самий патерн, що data-align/data-size картинок
// (src/lib/rich-image-extension.ts) — вигляд цілком у CSS (.rich-text
// [data-text-align=...] тощо, globals.css), однаково і в адмін-редакторі,
// і на студентській сторінці. addGlobalAttributes (не addAttributes
// власного вузла) — paragraph/heading уже визначені в StarterKit, цей
// підхід додає атрибути БЕЗ перевизначення самих вузлів (той самий
// механізм, що офіційний @tiptap/extension-text-align).
export const ParagraphFormat = Extension.create({
  name: "paragraphFormat",

  addGlobalAttributes() {
    return [
      {
        types: FORMATTABLE_TYPES,
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element: HTMLElement) => parseEnum(element.getAttribute("data-text-align"), PARAGRAPH_TEXT_ALIGN_VALUES),
            renderHTML: (attributes: { textAlign?: ParagraphTextAlign | null }) => {
              // left — дефолт, не записується (атрибут відсутній = left,
              // так само як crop="original" у картинок).
              if (!attributes.textAlign || attributes.textAlign === "left") return {};
              return { "data-text-align": attributes.textAlign };
            },
          },
          firstLine: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const n = parseIntInRange(element.getAttribute("data-first-line"), 1, 3);
              return n;
            },
            renderHTML: (attributes: { firstLine?: number | null }) => {
              if (!attributes.firstLine) return {};
              return { "data-first-line": String(attributes.firstLine) };
            },
          },
          indent: {
            default: null,
            parseHTML: (element: HTMLElement) => parseIntInRange(element.getAttribute("data-indent"), 1, 6),
            renderHTML: (attributes: { indent?: number | null }) => {
              if (!attributes.indent) return {};
              return { "data-indent": String(attributes.indent) };
            },
          },
          lineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) => parseEnum(element.getAttribute("data-line-height"), PARAGRAPH_LINE_HEIGHT_VALUES),
            renderHTML: (attributes: { lineHeight?: ParagraphLineHeight | null }) => {
              if (!attributes.lineHeight) return {};
              return { "data-line-height": attributes.lineHeight };
            },
          },
        },
      },
    ];
  },
});
