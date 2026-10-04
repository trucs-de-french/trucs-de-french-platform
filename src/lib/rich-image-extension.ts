import Image from "@tiptap/extension-image";

export type ImageAlign = "left" | "right" | "center" | "full";
export type ImageSize = "small" | "medium" | "large";

export const IMAGE_ALIGN_VALUES: ImageAlign[] = ["left", "right", "center", "full"];
export const IMAGE_SIZE_VALUES: ImageSize[] = ["small", "medium", "large"];

// Розширення @tiptap/extension-image двома кастомними атрибутами —
// положення (float ліво/право, по центру, на всю ширину) і розмір
// (мала/середня/велика) — серіалізуються як data-align/data-size на самому
// <img>, а НЕ inline style: сам вигляд (float/margin/width) живе цілком у
// CSS (.rich-text img[data-align=...], globals.css) — однаково і в
// адмін-редакторі (RichArticleEditor), і на студентській сторінці, а не в
// HTML, що зберігається в БД. Базовий title-атрибут Image навмисно не
// успадкований — ні callout, ні стаття його не потребують, і
// sanitize-callout-html.ts його все одно вирізав би.
export const RichImage = Image.extend({
  // Явно (хоч базовий @tiptap/extension-image вузол і так має
  // draggable: true за замовчуванням) — переміщення вставленої картинки
  // мишею в інше місце тексту: ProseMirror сам переносить вузол разом з
  // УСІМА його атрибутами (align/size не губляться при drag&drop,
  // перенесення — це видалення вузла зі старої позиції й вставка того
  // самого вузла в нову, не пересворення). Dropcursor/Gapcursor (видима
  // лінія вставки під час перетягування) — уже частина StarterKit v3 за
  // замовчуванням (@tiptap/extensions), окремий пакет не потрібен.
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      align: {
        default: "center",
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute("data-align");
          return (IMAGE_ALIGN_VALUES as string[]).includes(value ?? "") ? value : "center";
        },
        renderHTML: (attributes: { align?: string }) => ({
          "data-align": attributes.align ?? "center",
        }),
      },
      size: {
        default: "medium",
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute("data-size");
          return (IMAGE_SIZE_VALUES as string[]).includes(value ?? "") ? value : "medium";
        },
        renderHTML: (attributes: { size?: string }) => ({
          "data-size": attributes.size ?? "medium",
        }),
      },
    };
  },
});
