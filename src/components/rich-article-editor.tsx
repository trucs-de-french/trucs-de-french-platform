"use client";

import { useRef, useState } from "react";
import { useEditor, EditorContent, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import { Image as ImageIcon, Trash2, X } from "lucide-react";
import {
  RichImage,
  IMAGE_ALIGN_VALUES,
  IMAGE_SIZE_VALUES,
  IMAGE_CROP_VALUES,
  IMAGE_FOCUS_VALUES,
  type ImageAlign,
  type ImageSize,
  type ImageCrop,
  type ImageFocus,
} from "@/lib/rich-image-extension";
import { sanitizeCalloutHtml } from "@/lib/sanitize-callout-html";
import { useFileOrLink } from "@/components/file-or-link-field";
import { INPUT_BORDER } from "@/lib/input-styles";
import { HINT_TEXT } from "@/lib/typography-styles";
import { Z_MODAL } from "@/lib/z-layers";

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

  const editor = useEditor({
    // Обов'язково false у Next.js — інакше редактор рендериться на сервері
    // й на клієнті по-різному, і React лається на hydration mismatch.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      TextStyle,
      FontFamily,
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
      align: (editor?.getAttributes("image").align as ImageAlign | undefined) ?? "center",
      size: (editor?.getAttributes("image").size as ImageSize | undefined) ?? "medium",
      crop: (editor?.getAttributes("image").crop as ImageCrop | undefined) ?? "original",
      focus: (editor?.getAttributes("image").focus as ImageFocus | undefined) ?? "center",
    }),
  });

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
                  Сам атрибут focus НЕ скидається при поверненні на
                  "Оригінал" (updateAttributes вище змінює лише crop) —
                  вибір фокусу чекає на наступне обрізання. */}
              {imageSelection.crop !== "original" && (
                <>
                  <span className={HINT_TEXT}>Фокус:</span>
                  {IMAGE_FOCUS_VALUES.map((focus) => (
                    <button
                      key={focus}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => editor.chain().focus().updateAttributes("image", { focus }).run()}
                      className={`rounded px-2 py-1 text-xs ${
                        imageSelection.focus === focus
                          ? "bg-neutral-200 dark:bg-neutral-700"
                          : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {FOCUS_LABELS[focus]}
                    </button>
                  ))}
                </>
              )}
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
    </div>
  );
}
