import Image from "@tiptap/extension-image";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import { TextSelection, type EditorState } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/core";

export type ImageAlign = "left" | "right" | "center" | "full";
export type ImageSize = "small" | "medium" | "large";
export type ImageCrop = "original" | "1-1" | "4-3" | "3-4" | "16-9";
export type ImageFocus = "center" | "top" | "bottom" | "left" | "right";

export const IMAGE_ALIGN_VALUES: ImageAlign[] = ["left", "right", "center", "full"];
export const IMAGE_SIZE_VALUES: ImageSize[] = ["small", "medium", "large"];
export const IMAGE_CROP_VALUES: ImageCrop[] = ["original", "1-1", "4-3", "3-4", "16-9"];
export const IMAGE_FOCUS_VALUES: ImageFocus[] = ["center", "top", "bottom", "left", "right"];

// Мапа старих 5 пресетів на числові focusX/focusY у відсотках — потрібна
// у двох місцях: (1) тут, у parseFocusCoordinate, як перехідна сумісність
// для контенту, збереженого до вільного вибору точки (щоб не скидався на
// 50/50 при першому відкритті в редакторі); (2) у RichArticleEditor —
// рядок швидких кнопок-пресетів у попапі "Фокус" (Центр/Верх/Низ/Ліво/
// Право) використовує ті самі числа, тому експортована, не продубльована.
export const FOCUS_PRESET_TO_XY: Record<ImageFocus, { x: number; y: number }> = {
  center: { x: 50, y: 50 },
  top: { x: 50, y: 0 },
  bottom: { x: 50, y: 100 },
  left: { x: 0, y: 50 },
  right: { x: 100, y: 50 },
};

// Clamp+нормалізація для РЕНДЕРУ (не для parseHTML вище — там уже є своя
// перевірка цілих 0-100 з фолбеком на legacy data-focus/50): довільне
// значення (undefined, NaN, поза діапазоном) завжди зводиться до цілого
// 0-100, дефолт 50 — та сама гарантія "ніякого довільного тексту в
// style", що й у sanitizeCalloutHtml, тут лише для живого DOM редактора.
function normalizeFocusCoordinate(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function parseFocusCoordinate(element: HTMLElement, attr: "data-focus-x" | "data-focus-y", axis: "x" | "y"): number {
  const raw = element.getAttribute(attr);
  if (raw !== null) {
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0 && n <= 100) return n;
  }
  // data-focus-x/y відсутні (чи зіпсовані) — контент, збережений до цієї
  // задачі, чи прямо правлений в БД в обхід адмінки: пробуємо старий
  // data-focus, інакше дефолт — центр.
  const legacy = element.getAttribute("data-focus");
  if (legacy && (IMAGE_FOCUS_VALUES as string[]).includes(legacy)) {
    return FOCUS_PRESET_TO_XY[legacy as ImageFocus][axis];
  }
  return 50;
}

// Абзац-"якір" — textblock, що містить ЛИШЕ image-вузли (жодного тексту,
// жодного hardBreak). З ЕТАПУ 3 (inline-картинка) таке трапляється
// постійно: вставка/перенесення картинки в порожній рядок лишає її
// єдиним вмістом абзаца. Без спеціальної обробки Backspace/Delete біля
// такого абзаца (чи навіть ВСЕРЕДИНІ нього — атом, не можна "зайти
// всередину") видаляє саму картинку разом із порожнім рядком — для
// вчительки це виглядає як "видаляю порожній рядок", а насправді зникає
// картинка.
function isImageOnlyParagraph(node: PMNode): boolean {
  if (!node.isTextblock || node.childCount === 0) return false;
  let onlyImages = true;
  node.forEach((child) => {
    if (child.type.name !== "image") onlyImages = false;
  });
  return onlyImages;
}

// Спільна логіка Backspace/Delete біля абзаца-якоря — картинки
// переносяться (НЕ видаляються) до сусіднього textblock-у В ТОМУ САМОМУ
// батьківському вузлі (не виходимо за межі li при картинці в пункті
// списку — grandParent нижче це й так гарантує, це вузол, що міг би
// містити ТІЛЬКИ сусідні абзаци того самого рівня). Правило переносу
// однакове для обох клавіш (пріоритет — наступний абзац, інакше
// попередній); різниться лише фінальна позиція курсора (key нижче).
// Усе одним tr — один виклик editor.view.dispatch, один крок Cmd+Z.
// Експортовано заради скриптової перевірки без браузера (прямі
// ProseMirror-транзакції на фейковому editor.state/editor.view.dispatch);
// у продукті викликається лише з addKeyboardShortcuts нижче.
export function relocateAnchorImages(editor: Editor, key: "backspace" | "delete"): boolean {
  const state: EditorState = editor.state;
  const { selection } = state;
  // NodeSelection (клік по картинці) ніколи не "empty" — цей шлях
  // свідомо пропускає такий випадок далі, до стандартної поведінки
  // (видалення виділеної картинки як і раніше).
  if (!selection.empty) return false;
  const $from = selection.$from;
  const depth = $from.depth;
  if (depth === 0) return false;
  const anchorNode = $from.parent;
  if (!isImageOnlyParagraph(anchorNode)) return false;

  const grandParent = $from.node(depth - 1);
  const indexInParent = $from.index(depth - 1);
  const nextSibling = grandParent.maybeChild(indexInParent + 1);
  const prevSibling = indexInParent > 0 ? grandParent.maybeChild(indexInParent - 1) : null;
  const useNext = !!(nextSibling && nextSibling.isTextblock);
  const usePrev = !useNext && !!(prevSibling && prevSibling.isTextblock);

  // Єдиний блок у документі чи в пункті списку (нема куди переносити) —
  // лише перехоплюємо клавішу, картинка нікуди не зникає.
  if (!useNext && !usePrev) return true;

  const anchorStart = $from.before(depth);
  const anchorEnd = $from.after(depth);
  const images: PMNode[] = [];
  anchorNode.forEach((child) => images.push(child));
  const imagesSize = images.reduce((sum, n) => sum + n.nodeSize, 0);
  // Кінець ПОПЕРЕДНЬОГО абзаца (для курсора Backspace) — рахуємо ДО змін
  // документа: сусідні вузли межують напряму, тож це рівно anchorStart-1.
  const prevEndBeforeChanges = prevSibling ? anchorStart - 1 : null;

  const tr = state.tr;
  tr.delete(anchorStart, anchorEnd);

  const insertAt = useNext
    ? tr.mapping.map(anchorEnd + 1, -1)
    : tr.mapping.map(anchorStart - 1, -1);
  tr.insert(insertAt, Fragment.from(images));

  const cursorPos =
    key === "delete"
      // Завжди одразу ПІСЛЯ картинок у їхньому новому місці.
      ? insertAt + imagesSize
      // Backspace: кінець попереднього абзаца, якщо він є; інакше —
      // початок абзаца з картинкою (useNext без prevSibling — тоді
      // insertAt і є "перед картинками", початок цього абзаца).
      : prevEndBeforeChanges !== null
        ? tr.mapping.map(prevEndBeforeChanges, -1)
        : insertAt;

  tr.setSelection(TextSelection.create(tr.doc, cursorPos));
  editor.view.dispatch(tr);
  return true;
}

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
  // Inline-вузол (ЕТАП 3) — group()/inline() базового @tiptap/extension-image
  // уже самі перемикаються на "inline"/true за this.options.inline
  // (перевірено в джерелі node_modules), тож схема бере group звідти
  // автоматично з RichImage.configure({ inline: true, ... }) у
  // rich-article-editor.tsx; тут лишається додати atom (базовий Image
  // його не задає) — картинка і так без вмісту (content за замовчуванням
  // порожній), atom:true лише явно фіксує "однією клавішею/кліком, не
  // заходимо всередину" для курсора/виділення, як у Word.
  atom: true,
  // Backspace/Delete біля абзаца-якоря (лише картинки, без тексту) —
  // переносять картинки до сусіднього абзаца замість видалення разом із
  // порожнім рядком (relocateAnchorImages вище). Повертає false для ВСІХ
  // інших випадків (NodeSelection, курсор у звичайному абзаці з текстом
  // поруч із картинкою, виділення діапазону) — падає далі до стандартної
  // поведінки Tiptap/ProseMirror, нічого з неї не змінено.
  addKeyboardShortcuts() {
    return {
      Backspace: () => relocateAnchorImages(this.editor, "backspace"),
      Delete: () => relocateAnchorImages(this.editor, "delete"),
    };
  },
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
        // title тут — підказка "можна перетягнути" для ЖИВОГО DOM
        // редактора (той самий принцип, що object-position у focusY нижче:
        // це не окремий data-атрибут, а просто ЩЕ одне поле в тому самому
        // renderHTML, mergeAttributes об'єднає його з полями інших
        // атрибутів без конфлікту). НЕ потрапляє у збережений HTML — title
        // не входить у allowedAttributes.img sanitize-callout-html.ts,
        // sanitizeCalloutHtml(editor.getHTML()) його просто відкидає.
        renderHTML: (attributes: { align?: string }) => ({
          "data-align": attributes.align ?? "center",
          title: "Перетягніть, щоб перемістити",
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
      // Застарілий 5-кнопковий фокус (center/top/bottom/left/right) —
      // ЛИШЕНО в схемі заради читання старого контенту (той самий вузол,
      // ті самі parseHTML/renderHTML, що й раніше), але більше не
      // РЕНДЕРИТЬСЯ (renderHTML нижче свідомо повертає {}) — вільний
      // вибір точки (focusX/focusY) повністю замінює цей атрибут для
      // нового збереження; data-focus у вихідному HTML лишається лише на
      // рядках, які ще не редагувались через оновлений редактор (і там
      // далі коректно виглядають завдяки старим CSS-правилам
      // .rich-text img[data-focus=...], globals.css — їх не прибирали).
      focus: {
        default: "center",
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute("data-focus");
          return (IMAGE_FOCUS_VALUES as string[]).includes(value ?? "") ? value : "center";
        },
        renderHTML: () => ({}),
      },
      // Точний фокус обрізання — відсотки відносно прямокутника самого
      // <img> (0=лівий/верхній край, 100=правий/нижній), застосовується
      // через object-position: X% Y%.
      //
      // Цей style — ЛИШЕ для живого DOM усередині самого TipTap-редактора
      // (contentEditable, renderHTML нижче формує саме той <img>, що
      // бачить вчителька під час редагування — RichImage НЕ має власного
      // addNodeView/resize, тож це й справді єдине місце, що будує цей
      // DOM-вузол). Збережений/студентський HTML — ОКРЕМИЙ шлях: його
      // style завжди ПЕРЕГЕНЕРОВУЄ sanitizeCalloutHtml із тих самих
      // data-focus-x/y (а не копіює цей), бо він ніколи не читає
      // editor.getHTML()-івський style напряму — тож цей inline-style не
      // є "діркою в обхід санітайзера": він впливає лише на те, що
      // бачить вчителька ПІД ЧАС редагування, не на те, що зберігається.
      // attributes тут — ПОВНИЙ набір атрибутів вузла (Tiptap передає
      // nodeOrMark.attrs у кожен renderHTML, не лише "свій" ключ), тож
      // focusY нижче бачить і focusX — обчислює style в одному місці,
      // не дублює в обох.
      focusX: {
        default: 50,
        parseHTML: (element: HTMLElement) => parseFocusCoordinate(element, "data-focus-x", "x"),
        renderHTML: (attributes: { focusX?: number }) => ({
          "data-focus-x": String(normalizeFocusCoordinate(attributes.focusX)),
        }),
      },
      focusY: {
        default: 50,
        parseHTML: (element: HTMLElement) => parseFocusCoordinate(element, "data-focus-y", "y"),
        renderHTML: (attributes: { focusX?: number; focusY?: number }) => {
          const x = normalizeFocusCoordinate(attributes.focusX);
          const y = normalizeFocusCoordinate(attributes.focusY);
          return {
            "data-focus-y": String(y),
            style: `object-position: ${x}% ${y}%`,
          };
        },
      },
    };
  },
});
