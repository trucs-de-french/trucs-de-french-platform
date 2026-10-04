import Image from "@tiptap/extension-image";

export type ImageAlign = "left" | "right" | "center" | "full";
export type ImageSize = "small" | "medium" | "large";
export type ImageCrop = "original" | "1-1" | "4-3" | "3-4" | "16-9";
export type ImageFocus = "center" | "top" | "bottom" | "left" | "right";

export const IMAGE_ALIGN_VALUES: ImageAlign[] = ["left", "right", "center", "full"];
export const IMAGE_SIZE_VALUES: ImageSize[] = ["small", "medium", "large"];
export const IMAGE_CROP_VALUES: ImageCrop[] = ["original", "1-1", "4-3", "3-4", "16-9"];
export const IMAGE_FOCUS_VALUES: ImageFocus[] = ["center", "top", "bottom", "left", "right"];

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
      // Невізуальне (non-destructive) обрізання — оригінальний файл не
      // змінюється й не перезавантажується, лише aspect-ratio+object-fit
      // у CSS (.rich-text img[data-crop=...], globals.css). "original" —
      // без обрізання, focus тоді теж не має сенсу (кнопки фокусу в
      // панелі ховаються саме для цього значення).
      crop: {
        default: "original",
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute("data-crop");
          return (IMAGE_CROP_VALUES as string[]).includes(value ?? "") ? value : "original";
        },
        renderHTML: (attributes: { crop?: string }) => ({
          "data-crop": attributes.crop ?? "original",
        }),
      },
      // Яку частину кадру лишати видимою при обрізанні (object-position) —
      // діє лише коли crop !== "original", але зберігається незалежно, щоб
      // не втрачати вибір фокусу при тимчасовому поверненні на "Оригінал".
      focus: {
        default: "center",
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute("data-focus");
          return (IMAGE_FOCUS_VALUES as string[]).includes(value ?? "") ? value : "center";
        },
        renderHTML: (attributes: { focus?: string }) => ({
          "data-focus": attributes.focus ?? "center",
        }),
      },
    };
  },
});
