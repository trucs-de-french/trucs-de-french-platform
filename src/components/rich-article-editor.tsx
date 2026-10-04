"use client";

import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import { Image as ImageIcon, Trash2, X, AlignLeft, AlignCenter, AlignRight, AlignJustify } from "lucide-react";
import {
  RichImage,
  IMAGE_ALIGN_VALUES,
  IMAGE_SIZE_VALUES,
  IMAGE_CROP_VALUES,
  IMAGE_FOCUS_VALUES,
  FOCUS_PRESET_TO_XY,
  type ImageAlign,
  type ImageSize,
  type ImageCrop,
  type ImageFocus,
} from "@/lib/rich-image-extension";
import {
  ParagraphFormat,
  PARAGRAPH_LINE_HEIGHT_VALUES,
  type ParagraphTextAlign,
  type ParagraphLineHeight,
} from "@/lib/paragraph-format-extension";
import { sanitizeCalloutHtml } from "@/lib/sanitize-callout-html";
import { useFileOrLink } from "@/components/file-or-link-field";
import { INPUT_BORDER } from "@/lib/input-styles";
import { HINT_TEXT } from "@/lib/typography-styles";
import { Z_MODAL, Z_DROPDOWN } from "@/lib/z-layers";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const HIGHLIGHT_COLORS: { value: string; label: string }[] = [
  { value: "#fef08a", label: "Жовтий" },
  { value: "#bbf7d0", label: "Зелений" },
  { value: "#fbcfe8", label: "Рожевий" },
  { value: "#bfdbfe", label: "Синій" },
];

const FONT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "За замовчуванням" },
  { value: "Georgia, 'Times New Roman', serif", label: "Serif" },
  { value: "'Courier New', monospace", label: "Monospace" },
  { value: "Arial, Helvetica, sans-serif", label: "Sans-serif" },
  { value: "'Comic Sans MS', 'Brush Script MT', cursive", label: "Рукописний" },
];

const ALIGN_LABELS: Record<ImageAlign, string> = {
  left: "Ліворуч",
  right: "Праворуч",
  center: "По центру",
  full: "На всю ширину",
};

const SIZE_LABELS: Record<ImageSize, string> = {
  small: "Мала",
  medium: "Середня",
  large: "Велика",
};

const CROP_LABELS: Record<ImageCrop, string> = {
  original: "Оригінал",
  "1-1": "1:1",
  "4-3": "4:3",
  "3-4": "3:4",
  "16-9": "16:9",
};

const FOCUS_LABELS: Record<ImageFocus, string> = {
  center: "Центр",
  top: "Верх",
  bottom: "Низ",
  left: "Ліво",
  right: "Право",
};

const FONT_SIZE_PRESETS = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

const ALIGN_BUTTONS: { value: ParagraphTextAlign; Icon: typeof AlignLeft; label: string }[] = [
  { value: "left", Icon: AlignLeft, label: "Ліворуч" },
  { value: "center", Icon: AlignCenter, label: "По центру" },
  { value: "right", Icon: AlignRight, label: "Праворуч" },
  { value: "justify", Icon: AlignJustify, label: "По ширині" },
];

const LINE_HEIGHT_OPTIONS: { value: ParagraphLineHeight; label: string }[] = PARAGRAPH_LINE_HEIGHT_VALUES.map((v) => ({
  value: v,
  label: v,
}));

// "paragraph"/"heading" — ті самі два типи, на які ParagraphFormat
// (src/lib/paragraph-format-extension.ts) навішує textAlign/firstLine/
// indent/lineHeight через addGlobalAttributes; команди зміни атрибутів
// нижче завжди викликають updateAttributes для ОБОХ типів поспіль
// (TipTap updateAttributes сам ніяк не зашкодить викликом для типу, якого
// в поточному виділенні нема — просто нічого не змінює для нього).
const FORMATTABLE_NODE_TYPES = ["paragraph", "heading"] as const;

// Значення атрибута абзаца, уніфіковане по ВСІХ paragraph/heading-вузлах,
// що потрапляють у поточне виділення (nodesBetween — та сама техніка, що
// й core-команда updateAttributes нижче використовує для застосування
// зміни): null — усюди дефолт (атрибута нема), "mixed" — у виділенні є
// одночасно і дефолтні, і недефолтні (чи різні недефолтні) блоки, кнопки/
// контроли тоді не підсвічують жоден конкретний варіант. Поза виділенням
// (empty selection, звичайний курсор) у виділення потрапляє рівно один
// блок — "mixed" тут неможливий, це завжди значення блоку під курсором.
function getUniformBlockAttr(
  editor: Editor,
  key: "textAlign" | "firstLine" | "indent" | "lineHeight"
): string | number | null | "mixed" {
  const { from, to } = editor.state.selection;
  let value: string | number | null | undefined;
  let any = false;
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (!(FORMATTABLE_NODE_TYPES as readonly string[]).includes(node.type.name)) return;
    const v = (node.attrs[key] as string | number | null | undefined) ?? null;
    if (!any) {
      value = v;
      any = true;
    } else if (v !== value) {
      value = "mixed";
    }
  });
  if (!any) return null;
  return value ?? null;
}

// Розмір шрифту — mark (textStyle), не атрибут блокового вузла, тож
// уніфікація йде по текстових вузлах (node.marks), не по paragraph/heading.
// Порожнє виділення (звичайний курсор) — nodesBetween узагалі не бачить
// жодного текстового вузла під курсором (курсор між символами, не ВСЕРЕДИНІ
// них), тож тут окремо падаємо на editor.getAttributes("textStyle") —
// той самий спосіб, що й FontFamily-дропдаун використовує для toggleFont
// (і так само показує "збережений на позиції курсора" розмір, яким
// надрукується наступний символ).
function getUniformFontSize(editor: Editor): number | null | "mixed" {
  const { from, to, empty } = editor.state.selection;
  if (empty) {
    const raw = editor.getAttributes("textStyle").fontSize as string | undefined;
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }
  let value: string | null | undefined;
  let any = false;
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => m.type.name === "textStyle");
    const raw = (mark?.attrs.fontSize as string | undefined) ?? null;
    if (!any) {
      value = raw;
      any = true;
    } else if (raw !== value) {
      value = "mixed";
    }
  });
  if (!any) return null;
  if (value === "mixed") return "mixed";
  if (!value) return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

// Спільний TipTap-редактор для callout (CalloutFields) і статей Матеріалів
// (MaterialArticleFields) — до картинок (ЕТАП 1) обидва компоненти містили
// буквально однаковий код редактора/панелі/sanitize-виклику, свідомо
// скопійований (окремий файл, не ризикувати вже робочим кодом — див. історію
// в git). Картинки з обтіканням додають достатньо нової логіки (попап
// завантаження, контекстні кнопки положення/розміру виділеної картинки), що
// дублювати її ще раз у двох файлах вже недоцільно — звідси цей спільний
// компонент. InstructionsRichTextField (вузша панель для
// instructions/subInstructions у вправах/task-groups/content-blocks)
// лишається окремим файлом — картинок там не буде.
export function RichArticleEditor({
  name,
  initialContent,
  minHeightClassName,
}: {
  // Ім'я прихованого поля форми — "callout_content" у CalloutFields,
  // "content" у MaterialArticleFields (різні назви лишені як є).
  name: string;
  initialContent?: string | null;
  // callout — "min-h-32", стаття Матеріалу — "min-h-48" (наявна різниця
  // лишена параметром, щоб спільний компонент не змінив жодного наявного
  // вигляду).
  minHeightClassName: string;
}) {
  const [html, setHtml] = useState(initialContent ?? "");
  const [imagePopoverOpen, setImagePopoverOpen] = useState(false);
  const [imageUrlDraft, setImageUrlDraft] = useState("");
  const [focusPopoverOpen, setFocusPopoverOpen] = useState(false);
  // Позиція image-вузла в документі (editor.state.selection.from) у момент
  // відкриття попапу — попап далі працює ЧЕРЕЗ цю позицію
  // (setNodeSelection(pos) у setFocus нижче), а не через "поточне
  // виділення": клік усередині самого попапу (перетягування мітки, клік по
  // пресету) — це взаємодія з DOM ПОЗА contentEditable, яка неминуче
  // забирає фокус з редактора; якби попап/кнопки залежали від того, що
  // картинка й ЗАРАЗ виділена (imageSelection.isImageActive), будь-яка така
  // взаємодія могла б зняти виділення й розмонтувати панель/попап посеред
  // роботи. pos — не ref: використовується для похідного значення
  // focusNodeAttrs нижче, яке має перерахунтись при зміні.
  const [focusNodePos, setFocusNodePos] = useState<number | null>(null);
  // Прив'язка попапу до кнопки "Фокус…" у ВІКОННИХ координатах (той самий
  // простір, що й position:fixed) — обчислена ОДНОРАЗОВО в момент відкриття
  // (getBoundingClientRect кнопки), не "живий" стеж за кнопкою: попап
  // рендериться через портал у document.body (нижче), тож звичайний
  // position:absolute відносно батьківського DOM-вузла тут не спрацював би
  // — і, що важливіше, це й усуває будь-який ризик, що попап обрізає
  // overflow:hidden/auto чи ховає z-index якогось предка в адмін-панелі
  // (портал виносить його на верхній рівень DOM, поза всіма такими предками).
  const [focusAnchor, setFocusAnchor] = useState<{ top: number; right: number } | null>(null);
  // Попап "Абзац…" (ЕТАП 2) — на відміну від попапу "Фокус" вище, тут НЕ
  // потрібна окрема "зафіксована позиція" (focusNodePos-патерн): кнопки
  // всередині (−/+/скинути/інтервал) самі несуть onMouseDown
  // preventDefault (нижче) і застосовують зміну через updateAttributes до
  // ПОТОЧНОГО editor.state.selection у момент кліку — так само, як кнопки
  // align/size/crop картинки вище, що теж не потребують окремого
  // відстеження позиції. Anchor — лише координати для position:fixed
  // (та сама техніка порталу, що й попап "Фокус").
  const [formatPopoverOpen, setFormatPopoverOpen] = useState(false);
  const [formatAnchor, setFormatAnchor] = useState<{ top: number; right: number } | null>(null);
  // Контейнер навколо <img> у попапі "Фокус" — display:inline-block, тож
  // його rect ТОЧНО збігається з рендереним прямокутником самої картинки
  // (object-fit тут не потрібен узагалі: без зовнішньої фіксованої ширини
  // контейнер просто обгортає img по контуру, без "летербоксингу", що
  // зсунув би відсотки відносно справжніх країв зображення).
  const focusImageBoxRef = useRef<HTMLDivElement>(null);
  // Позиція курсора в момент кліку "Картинка" — попап і вибір файлу
  // (і текстове поле посилання, і системний діалог завантаження) неминуче
  // переносять DOM-фокус ПОВЗ contentEditable (на відміну від кнопок
  // панелі нижче, тут preventDefault на mousedown не допоможе — треба
  // реально фокусувати інше поле), тож на момент insertImage()
  // editor.state.selection вже може "зʼїхати" (типово — на кінець
  // документа, стандартна поведінка браузера, коли contentEditable
  // повертає DOM-фокус без збереженого native Range усередині). Ref, не
  // state — зміна не має викликати ре-рендер.
  const savedSelectionRef = useRef<number | null>(null);
  // Той самий ризик, що й savedSelectionRef вище (клік у звичайний
  // <input>/<select> неминуче переносить DOM-фокус ПОВЗ contentEditable,
  // після чого .focus() без явно відновленого Range може "зʼїхати" на
  // кінець документа — детальніше в коментарі при savedSelectionRef), але
  // тут потрібен ДІАПАЗОН (from/to), а не одна позиція: розмір шрифту —
  // mark, застосовується через setMark на ВИДІЛЕННІ, не на точці вставки.
  // Кнопки вирівнювання/"Абзац…" нижче в цьому не потребують — їхній
  // onMouseDown preventDefault взагалі не дає DOM-фокусу піти з редактора.
  const savedFormatSelectionRef = useRef<{ from: number; to: number } | null>(null);
  function saveFormatSelection() {
    if (editor) savedFormatSelectionRef.current = { from: editor.state.selection.from, to: editor.state.selection.to };
  }

  const editor = useEditor({
    // Обов'язково false у Next.js — інакше редактор рендериться на сервері
    // й на клієнті по-різному, і React лається на hydration mismatch.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      TextStyle,
      FontFamily,
      // Офіційний FontSize (готовий, @tiptap/extension-text-style v3.30.5
      // — перевірено в node_modules: FontSize.addGlobalAttributes додає
      // fontSize до того самого "textStyle", що FontFamily/Highlight-колір
      // вище, рендерить style="font-size: ..." на тому самому <span>).
      // Власного кастомного розширення не знадобилось. Clamp 12-48/ціле —
      // на боці UI (applyFontSize нижче), а не тут: сам FontSize жодних
      // обмежень не накладає (editor.commands.setFontSize приймає будь-
      // який рядок), друга лінія захисту — sanitizeCalloutHtml.
      FontSize.configure({ types: ["textStyle"] }),
      ParagraphFormat,
      Highlight.configure({ multicolor: true }),
      RichImage.configure({ inline: false, allowBase64: false }),
    ],
    content: initialContent ?? "",
    onUpdate({ editor }) {
      // Клієнтська санітизація — лише для швидкого відгуку; остаточна,
      // обов'язкова санітизація — на сервері при збереженні.
      setHtml(sanitizeCalloutHtml(editor.getHTML()));
    },
    editorProps: {
      attributes: {
        // rich-text-editable — лише тут (не на студентському рендері
        // callout.tsx/article page) — css/globals.css ставить
        // cursor:grab на img САМЕ за цим класом, щоб вчителька бачила, що
        // вставлену картинку можна перетягнути в інше місце тексту
        // (float left/right не завжди дає очевидну "ручку" для drag).
        //
        // max-w-xl (36rem=576px) — наближено до реальної ширини тексту
        // студентської сторінки: max-w-2xl (672px) мінус p-6 сторінки
        // (48px) мінус border-2+p-3 картки callout/статті (28px) мінус
        // іконка+gap-2 зліва (~26px) ≈ 570px. Без цього обтікання
        // картинки в редакторі (де текстова колонка тягнеться на всю
        // ширину адмін-панелі, max-w-6xl) переносилось би по рядках
        // зовсім інакше, ніж у студента — саме це й було видно на
        // скріншотах (у редакторі заголовок встигає стати поруч із
        // картинкою, у студента та сама картинка вже не лишає місця,
        // і наступний рядок іде під нею).
        //
        // text-sm прибрано — залишає абзаци/списки на тому самому
        // розмірі шрифту, що в студента (ambient 16px, body/.rich-text
        // не задають власний font-size для p/li, лише font-family),
        // інакше той самий % (data-size) давав би інший піксельний
        // розмір картинки відносно тексту в редакторі й у студента.
        class: `rich-text rich-text-editable max-w-xl ${minHeightClassName} rounded-md border px-3 py-2 font-content focus:outline-none`,
      },
    },
  });

  // Клік по вже вставленій картинці змінює лише ВИДІЛЕННЯ, не контент —
  // без useEditorState компонент не перерендерився б (onUpdate вище не
  // викликається на зміну selection), і контекстні кнопки
  // положення/розміру нижче не оновлювались би при перемиканні між
  // картинками.
  const imageSelection = useEditorState({
    editor,
    selector: ({ editor }: { editor: Editor | null }) => ({
      isImageActive: editor?.isActive("image") ?? false,
      // Позиція вузла — теж через useEditorState (не ad-hoc
      // editor.state.selection.from у клік-хендлері нижче): усі дані,
      // потрібні панелі для вибраної картинки, йдуть з ОДНОГО реактивного
      // джерела, що гарантовано перераховується на кожну транзакцію
      // (useSyncExternalStoreWithSelector підписаний на editor.on
      // ("transaction"/"update"), EditorStateManager.watch) — а не
      // залежить від того, чи щось ІНШЕ (onUpdate) випадково теж
      // перерендерило компонент у той самий момент.
      pos: editor?.isActive("image") ? editor.state.selection.from : null,
      src: (editor?.getAttributes("image").src as string | undefined) ?? "",
      align: (editor?.getAttributes("image").align as ImageAlign | undefined) ?? "center",
      size: (editor?.getAttributes("image").size as ImageSize | undefined) ?? "medium",
      crop: (editor?.getAttributes("image").crop as ImageCrop | undefined) ?? "original",
      focusX: (editor?.getAttributes("image").focusX as number | undefined) ?? 50,
      focusY: (editor?.getAttributes("image").focusY as number | undefined) ?? 50,
    }),
  });

  // Атрибути картинки, прив'язаної до попапу "Фокус" — читаються ПРЯМО з
  // документа за focusNodePos, а НЕ з imageSelection (яке відображає
  // ПОТОЧНЕ виділення): поки попап відкритий, виділення може зміститись
  // (клік усередині самого попапу, або й просто кудись у текст), а
  // картинка, яку редагує попап, лишається тією самою за збереженою
  // позицією. Перерахунтовується на кожен рендер — достатньо дешево,
  // і завжди відображає останній стан після setFocus() нижче (та
  // ВИКЛИКАЄ re-render через onUpdate, оскільки setFocus змінює документ).
  const focusNodeAttrs = (() => {
    if (!editor || focusNodePos === null) return null;
    const node = editor.state.doc.nodeAt(focusNodePos);
    if (!node || node.type.name !== "image") return null;
    return {
      src: (node.attrs.src as string | null) ?? "",
      focusX: (node.attrs.focusX as number | undefined) ?? 50,
      focusY: (node.attrs.focusY as number | undefined) ?? 50,
    };
  })();

  // Розмір шрифту й параметри абзаца (ЕТАП 2) — окремий useEditorState від
  // imageSelection вище: непов'язані концерни (текстове форматування vs.
  // вибрана картинка), той самий урок з попередніх задач — усе, що читає
  // панель для рендеру, йде з одного реактивного selector на концерн, не
  // ad-hoc під час рендеру.
  const paragraphSelection = useEditorState({
    editor,
    selector: ({ editor }: { editor: Editor | null }) => ({
      fontSize: editor ? getUniformFontSize(editor) : null,
      textAlign: editor ? (getUniformBlockAttr(editor, "textAlign") as ParagraphTextAlign | null | "mixed") : null,
      firstLine: editor ? (getUniformBlockAttr(editor, "firstLine") as number | null | "mixed") : null,
      indent: editor ? (getUniformBlockAttr(editor, "indent") as number | null | "mixed") : null,
      lineHeight: editor ? (getUniformBlockAttr(editor, "lineHeight") as ParagraphLineHeight | null | "mixed") : null,
    }),
  });

  function applyFontSize(raw: string) {
    if (!editor) return;
    const trimmed = raw.trim();
    // Порожнє/нечисле — ігноруємо (не скидаємо на "Авто", щоб випадкове
    // стирання поля чи ввід "abc" не губило вже застосований розмір).
    if (trimmed === "") return;
    const n = Number(trimmed);
    if (!Number.isInteger(n)) return;
    const chain = editor.chain().focus();
    const saved = savedFormatSelectionRef.current;
    if (saved) chain.setTextSelection(saved);
    chain.setFontSize(`${clamp(n, 12, 48)}px`).run();
  }

  function handleFontSizeSelect(value: string) {
    if (!editor || !value) return;
    if (value === "auto") {
      const chain = editor.chain().focus();
      const saved = savedFormatSelectionRef.current;
      if (saved) chain.setTextSelection(saved);
      chain.unsetFontSize().run();
    } else {
      applyFontSize(value);
    }
  }

  // Усі команди нижче застосовують зміну до ОБОХ FORMATTABLE_NODE_TYPES —
  // updateAttributes сам проходить nodesBetween виділення і підмінює
  // атрибути лише в тих вузлах, що фактично мають такий тип (та сама
  // команда, що офіційний TextAlign викликає для кожного зі своїх types),
  // тож виклик для типу, якого в поточному виділенні нема, нічого не ламає.
  function setTextAlign(value: ParagraphTextAlign) {
    if (!editor) return;
    const attr = value === "left" ? null : value;
    let chain = editor.chain().focus();
    for (const type of FORMATTABLE_NODE_TYPES) chain = chain.updateAttributes(type, { textAlign: attr });
    chain.run();
  }

  function adjustFirstLine(delta: number) {
    if (!editor) return;
    const current = typeof paragraphSelection?.firstLine === "number" ? paragraphSelection?.firstLine : 0;
    const next = clamp(current + delta, 0, 3);
    const attr = next === 0 ? null : next;
    let chain = editor.chain().focus();
    for (const type of FORMATTABLE_NODE_TYPES) chain = chain.updateAttributes(type, { firstLine: attr });
    chain.run();
  }

  function adjustIndent(delta: number) {
    if (!editor) return;
    const current = typeof paragraphSelection?.indent === "number" ? paragraphSelection?.indent : 0;
    const next = clamp(current + delta, 0, 6);
    const attr = next === 0 ? null : next;
    let chain = editor.chain().focus();
    for (const type of FORMATTABLE_NODE_TYPES) chain = chain.updateAttributes(type, { indent: attr });
    chain.run();
  }

  function setLineHeight(value: string) {
    if (!editor) return;
    const attr = value === "auto" ? null : value;
    let chain = editor.chain().focus();
    for (const type of FORMATTABLE_NODE_TYPES) chain = chain.updateAttributes(type, { lineHeight: attr });
    chain.run();
  }

  function resetParagraphFormat() {
    if (!editor) return;
    let chain = editor.chain().focus();
    for (const type of FORMATTABLE_NODE_TYPES) {
      chain = chain.updateAttributes(type, { textAlign: null, firstLine: null, indent: null, lineHeight: null });
    }
    chain.run();
  }

  function openFormatPopover(e: MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setFormatAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setFormatPopoverOpen(true);
  }

  function closeFormatPopover() {
    setFormatPopoverOpen(false);
    setFormatAnchor(null);
  }

  function toggleFont(value: string) {
    if (!editor) return;
    if (value) {
      editor.chain().focus().setFontFamily(value).run();
    } else {
      editor.chain().focus().unsetFontFamily().run();
    }
  }

  // onClick кнопки "Картинка" — виконується ПІСЛЯ mousedown
  // (preventDefault на ньому нижче не дає браузеру зняти виділення), тож
  // тут editor.state.selection ще саме те, що бачила вчителька.
  function openImagePopover() {
    if (editor) {
      savedSelectionRef.current = editor.state.selection.from;
    }
    setImagePopoverOpen(true);
  }

  function insertImage(url: string) {
    if (!editor || !url.trim()) return;
    const chain = editor.chain().focus();
    const savedPos = savedSelectionRef.current;
    // Відновлюємо позицію курсора, збережену при відкритті попапу —
    // .focus() сам по собі міг(!) уже посунути виділення (детальніше в
    // коментарі при savedSelectionRef), setTextSelection ПІСЛЯ focus() у
    // тому самому ланцюжку перекриває це, перш ніж insertContent встигне
    // прочитати tr.selection. Без збереженої позиції (напр. редактор ще не
    // встиг змонтуватись при кліку) — вставляємо в ту позицію, яка є
    // ЗАРАЗ, а не форсуємо кінець документа.
    if (savedPos !== null) {
      const clamped = Math.min(savedPos, editor.state.doc.content.size);
      chain.setTextSelection(clamped);
    }
    // Якщо курсор усередині абзацу — insertContent сам розбиває його на
    // дві частини навколо вставленого блокового image-вузла (стандартна
    // ProseMirror-поведінка для block-вузла, вставленого посеред
    // inline-контенту). align/size — ті самі дефолти, що й раніше
    // (RichImage.addAttributes), явно тут для читабельності.
    chain.insertContent({ type: "image", attrs: { src: url.trim(), align: "center", size: "medium" } }).run();
    savedSelectionRef.current = null;
    setImageUrlDraft("");
    setImagePopoverOpen(false);
  }

  // onClick кнопки "Фокус…" — imageSelection.pos іде з того самого
  // useEditorState, що й crop/align/size вище (не ad-hoc
  // editor.state.selection.from): mousedown з preventDefault на самій
  // кнопці лишає виділення картинки незмінним рівно до цього моменту, тож
  // pos тут ЩЕ точно позиція вузла картинки. Далі попап працює ЧЕРЕЗ цю
  // збережену позицію (setFocus нижче), а не через "що зараз виділено" —
  // саме це мало ламатись раніше: клік усередині попапу (перетягування
  // мітки) — взаємодія поза contentEditable, після якої покладатись на
  // "поточне виділення" вже не можна.
  function openFocusPopover(e: MouseEvent<HTMLButtonElement>) {
    if (!editor || imageSelection?.pos == null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setFocusAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setFocusNodePos(imageSelection.pos);
    setFocusPopoverOpen(true);
  }

  function closeFocusPopover() {
    setFocusPopoverOpen(false);
    setFocusNodePos(null);
    setFocusAnchor(null);
  }

  // Точка фокусу при обрізанні — викликається і з перетягування мишею
  // (pointermove), і з клавіатури, і з кнопок-пресетів у попапі. На
  // відміну від попередньої версії, НЕ покладається на editor.isActive —
  // явно повертає виділення на збережену позицію (setNodeSelection) ПЕРЕД
  // зміною атрибутів, тож працює незалежно від того, що зараз виділено
  // в редакторі (навіть якщо клік усередині попапу вже перенів фокус/
  // виділення кудись інде).
  function setFocus(x: number, y: number) {
    if (!editor || focusNodePos === null) return;
    const pos = Math.min(focusNodePos, Math.max(0, editor.state.doc.content.size - 1));
    editor.chain().focus().setNodeSelection(pos).updateAttributes("image", { focusX: x, focusY: y }).run();
  }

  function computeFocusFromPointer(e: { clientX: number; clientY: number }) {
    const el = focusImageBoxRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: clamp(Math.round(((e.clientX - rect.left) / rect.width) * 100), 0, 100),
      y: clamp(Math.round(((e.clientY - rect.top) / rect.height) * 100), 0, 100),
    };
  }

  function handleFocusPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = computeFocusFromPointer(e);
    if (pos) setFocus(pos.x, pos.y);
  }

  function handleFocusPointerMove(e: PointerEvent<HTMLDivElement>) {
    // buttons===1 — лише поки притиснута основна кнопка миші (між
    // pointerdown і pointerup); setPointerCapture вище гарантує, що ці
    // move-події й далі приходять у цей самий елемент, навіть якщо курсор
    // вийшов за межі картинки під час перетягування.
    if (e.buttons !== 1) return;
    const pos = computeFocusFromPointer(e);
    if (pos) setFocus(pos.x, pos.y);
  }

  function handleFocusMarkerKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 10 : 1;
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else return;
    e.preventDefault();
    setFocus(
      clamp((focusNodeAttrs?.focusX ?? 50) + dx, 0, 100),
      clamp((focusNodeAttrs?.focusY ?? 50) + dy, 0, 100)
    );
  }

  // useFileOrLink — той самий примітив, що вже скрізь на платформі
  // (FileOrLinkField): завантаження файлу в R2 (bucket картинок) ТА
  // вставка за посиланням, разом. onChange спільний для обох шляхів —
  // завантажений файл і текст, набраний вручну, однаково лише заповнюють
  // чернетку URL; вставка в редактор — окремою кнопкою "Вставити" нижче
  // (інакше картинка "блимала" б у редакторі на кожному набраному символі
  // посилання).
  const { icons: imagePickerIcons, input: imagePickerInput } = useFileOrLink({
    kind: "image",
    mode: "controlled",
    value: imageUrlDraft,
    onChange: setImageUrlDraft,
  });

  return (
    <div className="flex flex-col gap-1">
      <input type="hidden" name={name} value={html} readOnly />

      {editor && (
        <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 bg-white p-1 dark:bg-neutral-950">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`rounded px-2 py-1 text-xs font-bold ${
              editor.isActive("bold") ? "bg-neutral-200 dark:bg-neutral-700" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            B
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`rounded px-2 py-1 text-xs italic ${
              editor.isActive("italic") ? "bg-neutral-200 dark:bg-neutral-700" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            I
          </button>
          <span className="mx-1 h-5 w-px bg-neutral-300 dark:bg-neutral-700" aria-hidden />
          <span className={HINT_TEXT}>Підсвітка:</span>
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().setHighlight({ color: c.value }).run()}
              style={{ backgroundColor: c.value }}
              className={`h-5 w-5 rounded border-2 ${
                editor.isActive("highlight", { color: c.value })
                  ? "border-black dark:border-white"
                  : "border-transparent"
              }`}
            />
          ))}
          <button
            type="button"
            title="Прибрати підсвітку"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().unsetHighlight().run()}
            className="rounded px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
          <span className="mx-1 h-5 w-px bg-neutral-300 dark:bg-neutral-700" aria-hidden />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`rounded px-2 py-1 text-xs ${
              editor.isActive("heading", { level: 2 }) ? "bg-neutral-200 dark:bg-neutral-700" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            H2
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`rounded px-2 py-1 text-xs ${
              editor.isActive("heading", { level: 3 }) ? "bg-neutral-200 dark:bg-neutral-700" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            H3
          </button>
          <select
            onChange={(e) => toggleFont(e.target.value)}
            defaultValue=""
            className={`${INPUT_BORDER} px-1.5 py-2 text-xs`}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <span className="mx-1 h-5 w-px bg-neutral-300 dark:bg-neutral-700" aria-hidden />
          <span className={HINT_TEXT}>Розмір:</span>
          <input
            key={`fontsize-${paragraphSelection?.fontSize ?? "auto"}`}
            type="number"
            min={12}
            max={48}
            defaultValue={typeof paragraphSelection?.fontSize === "number" ? paragraphSelection?.fontSize : undefined}
            placeholder={paragraphSelection?.fontSize === "mixed" ? "—" : "Авто"}
            title="Розмір тексту, px (12-48)"
            onMouseDown={saveFormatSelection}
            onBlur={(e) => applyFontSize(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className={`${INPUT_BORDER} w-14 px-1.5 py-1.5 text-xs`}
          />
          <select
            onMouseDown={saveFormatSelection}
            onChange={(e) => {
              handleFontSizeSelect(e.target.value);
              e.target.value = "";
            }}
            defaultValue=""
            title="Типові розміри"
            className={`${INPUT_BORDER} px-1 py-1.5 text-xs`}
          >
            <option value="" disabled>
              …
            </option>
            {FONT_SIZE_PRESETS.map((n) => (
              <option key={n} value={n}>
                {n}px
              </option>
            ))}
            <option value="auto">Авто</option>
          </select>
          <span className="mx-1 h-5 w-px bg-neutral-300 dark:bg-neutral-700" aria-hidden />
          {ALIGN_BUTTONS.map(({ value, Icon, label }) => (
            <button
              key={value}
              type="button"
              title={label}
              aria-label={label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setTextAlign(value)}
              className={`rounded px-2 py-1 ${
                (paragraphSelection?.textAlign ?? "left") === value
                  ? "bg-neutral-200 dark:bg-neutral-700"
                  : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              <Icon size={14} />
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openFormatPopover}
            className="rounded px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Абзац…
          </button>
          <span className="mx-1 h-5 w-px bg-neutral-300 dark:bg-neutral-700" aria-hidden />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openImagePopover}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <ImageIcon size={14} /> Картинка
          </button>

          {imageSelection?.isImageActive && (
            <>
              <span className="mx-1 h-5 w-px bg-neutral-300 dark:bg-neutral-700" aria-hidden />
              <span className={HINT_TEXT}>Положення:</span>
              {IMAGE_ALIGN_VALUES.map((align) => (
                <button
                  key={align}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => editor.chain().focus().updateAttributes("image", { align }).run()}
                  className={`rounded px-2 py-1 text-xs ${
                    imageSelection.align === align
                      ? "bg-neutral-200 dark:bg-neutral-700"
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  {ALIGN_LABELS[align]}
                </button>
              ))}
              <span className={HINT_TEXT}>Розмір:</span>
              {IMAGE_SIZE_VALUES.map((size) => (
                <button
                  key={size}
                  type="button"
                  disabled={imageSelection.align === "full"}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => editor.chain().focus().updateAttributes("image", { size }).run()}
                  className={`rounded px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${
                    imageSelection.size === size && imageSelection.align !== "full"
                      ? "bg-neutral-200 dark:bg-neutral-700"
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  {SIZE_LABELS[size]}
                </button>
              ))}
              <span className={HINT_TEXT}>Обрізання:</span>
              {IMAGE_CROP_VALUES.map((crop) => (
                <button
                  key={crop}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => editor.chain().focus().updateAttributes("image", { crop }).run()}
                  className={`rounded px-2 py-1 text-xs ${
                    imageSelection.crop === crop
                      ? "bg-neutral-200 dark:bg-neutral-700"
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  {CROP_LABELS[crop]}
                </button>
              ))}
              {/* Фокус має сенс лише коли обрізання вже вирізає частину
                  кадру (crop !== "original") — для "Оригінал" показ усього
                  зображення, object-position там ні на що не впливає.
                  focusX/focusY НЕ скидаються при поверненні на "Оригінал"
                  (кнопки обрізання вище змінюють лише crop) — вибір
                  фокусу чекає на наступне обрізання. */}
              <button
                type="button"
                disabled={imageSelection.crop === "original"}
                title={imageSelection.crop === "original" ? "Спочатку виберіть обрізання" : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={openFocusPopover}
                className="rounded px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Фокус…
              </button>
              <button
                type="button"
                title="Видалити картинку"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().deleteSelection().run()}
                className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      )}

      <EditorContent editor={editor} className="rounded-b-md" />

      {imagePopoverOpen && (
        <div
          className={`fixed inset-0 ${Z_MODAL} flex items-center justify-center bg-black/50 p-4`}
          onClick={() => setImagePopoverOpen(false)}
        >
          <div
            className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Вставити картинку</p>
              <button
                type="button"
                onClick={() => setImagePopoverOpen(false)}
                aria-label="Закрити"
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                <X size={18} />
              </button>
            </div>
            {imagePickerIcons}
            {imagePickerInput}
            <button
              type="button"
              disabled={!imageUrlDraft.trim()}
              onClick={() => insertImage(imageUrlDraft)}
              className="w-fit rounded-md bg-neutral-100 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              Вставити
            </button>
          </div>
        </div>
      )}

      {focusPopoverOpen &&
        focusAnchor &&
        createPortal(
          // Портал у document.body — попап НЕ вкладений у жоден DOM-
          // контейнер адмінки (жодного ризику overflow:hidden/auto чи
          // чужого z-index, що обрізав/ховав би absolute-попап усередині
          // звичного дерева), position:fixed від в'юпорта з координатами,
          // знятими з кнопки "Фокус…" в момент відкриття (не "живе"
          // стеження — попап не зсувається, якщо сторінку проскролити, і
          // це нормально: закриття/переоткриття дешеве). Видимість НЕ
          // залежить від imageSelection.isImageActive — лишається
          // відкритим, навіть якщо клік усередині самого попапу (чи
          // будь-де) перенесе виділення редактора кудись інде; закривають
          // ЛИШЕ Esc/клік поза попапом/кнопка "Готово" нижче.
          <>
            {/* Прозорий click-away шар, НЕ bg-black/50 — на відміну від
                попапу вставки картинки вище, тут навмисно нема
                затемнення всього екрана: вчителька має бачити, як
                змінюється кадр у самому тексті редактора ПІД ЧАС
                перетягування мітки, а не лише в попапі. */}
            <div
              className={Z_DROPDOWN}
              style={{ position: "fixed", inset: 0 }}
              onClick={closeFocusPopover}
            />
            <div
              style={{ position: "fixed", top: focusAnchor.top, right: focusAnchor.right }}
              className={`w-72 ${Z_MODAL} flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-neutral-700 dark:bg-neutral-900`}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeFocusPopover();
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Фокус обрізання</p>
                <button
                  type="button"
                  onClick={closeFocusPopover}
                  aria-label="Готово"
                  title="Готово"
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Контейнер без object-fit: display:inline-block звужує
                  його рівно до рендереного розміру самого <img> (повна,
                  НЕобрізана картинка — тут завжди object-fit:contain не
                  потрібен, нема зовнішньої фіксованої ширини, що вимагала
                  б letterbox-компенсації), тож rect контейнера = rect
                  картинки, і відсотки кліку рахуються без зсуву.
                  onMouseDown preventDefault — як і решта кнопок панелі:
                  клік тут не має забирати фокус/виділення з редактора (не
                  критично для коректності — setFocus уже явно повертає
                  виділення на збережену позицію — але без цього фокус
                  "мигав" би між редактором і попапом на кожен клік). */}
              <div
                ref={focusImageBoxRef}
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={handleFocusPointerDown}
                onPointerMove={handleFocusPointerMove}
                className="relative inline-block max-w-full cursor-crosshair select-none self-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- попередній перегляд у попапі адмінки, той самий принцип, що ImageOrPlaceholder */}
                <img
                  src={focusNodeAttrs?.src || undefined}
                  alt=""
                  draggable={false}
                  className="block max-h-[260px] max-w-full rounded"
                />
                <div
                  role="slider"
                  tabIndex={0}
                  aria-label="Точка фокусу обрізання"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={focusNodeAttrs?.focusX ?? 50}
                  aria-valuetext={`${focusNodeAttrs?.focusX ?? 50}%, ${focusNodeAttrs?.focusY ?? 50}%`}
                  onKeyDown={handleFocusMarkerKeyDown}
                  style={{
                    left: `${focusNodeAttrs?.focusX ?? 50}%`,
                    top: `${focusNodeAttrs?.focusY ?? 50}%`,
                  }}
                  className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-brand shadow ring-1 ring-black/30 focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-brand"
                >
                  <span className="absolute h-2.5 w-px bg-white" aria-hidden />
                  <span className="absolute h-px w-2.5 bg-white" aria-hidden />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-1">
                {IMAGE_FOCUS_VALUES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setFocus(FOCUS_PRESET_TO_XY[preset].x, FOCUS_PRESET_TO_XY[preset].y)}
                    className="rounded px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {FOCUS_LABELS[preset]}
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body
        )}

      {formatPopoverOpen &&
        formatAnchor &&
        createPortal(
          <>
            <div className={Z_DROPDOWN} style={{ position: "fixed", inset: 0 }} onClick={closeFormatPopover} />
            <div
              style={{ position: "fixed", top: formatAnchor.top, right: formatAnchor.right }}
              className={`w-64 ${Z_MODAL} flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-neutral-700 dark:bg-neutral-900`}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeFormatPopover();
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Абзац</p>
                <button
                  type="button"
                  onClick={closeFormatPopover}
                  aria-label="Готово"
                  title="Готово"
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className={HINT_TEXT}>Відступ 1-го рядка</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => adjustFirstLine(-1)}
                    className="rounded px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    −
                  </button>
                  <span className="w-4 text-center text-xs">
                    {typeof paragraphSelection?.firstLine === "number" ? paragraphSelection?.firstLine : 0}
                  </span>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => adjustFirstLine(1)}
                    className="rounded px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className={HINT_TEXT}>Відступ зліва</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => adjustIndent(-1)}
                    className="rounded px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    −
                  </button>
                  <span className="w-4 text-center text-xs">
                    {typeof paragraphSelection?.indent === "number" ? paragraphSelection?.indent : 0}
                  </span>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => adjustIndent(1)}
                    className="rounded px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className={HINT_TEXT}>Інтервал</span>
                <select
                  onMouseDown={(e) => e.preventDefault()}
                  onChange={(e) => setLineHeight(e.target.value)}
                  value={
                    (PARAGRAPH_LINE_HEIGHT_VALUES as readonly string[]).includes(paragraphSelection?.lineHeight as string)
                      ? (paragraphSelection?.lineHeight as string)
                      : "auto"
                  }
                  className={`${INPUT_BORDER} px-1.5 py-1 text-xs`}
                >
                  <option value="auto">Авто</option>
                  {LINE_HEIGHT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={resetParagraphFormat}
                className="self-start rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                Скинути абзац
              </button>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
