"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";

const HIGHLIGHT_COLORS: { value: string; label: string }[] = [
  { value: "#fef08a", label: "Жовтий" },
  { value: "#bbf7d0", label: "Зелений" },
  { value: "#fbcfe8", label: "Рожевий" },
  { value: "#bfdbfe", label: "Синій" },
];

// Той самий TipTap+Highlight+sanitize патерн, що вже є в CalloutFields/
// MaterialArticleFields — окремий компонент (не спільний з ними), той
// самий принцип навмисної дуплікації, що вже задокументовано в
// material-article-fields.tsx: незалежна еволюція важливіша за DRY тут.
//
// Панель НАВМИСНО вужча за callout (лише B/I/підсвітка, без H2/H3/шрифту)
// — коротке поле інструкції, не стаття. Розширення StarterKit, для яких
// немає кнопки (heading/списки/blockquote/code/hr/strike), явно вимкнені
// в конфізі редактора, а не просто приховані з панелі — інакше
// markdown-шорткати TipTap (напр. "- " -> список) дозволили б вчителю
// побачити список у полі, який санітайзер тихо вирізав би при збереженні
// (WYSIWYG, що бреше про те, що реально збережеться).
//
// Немає плейсхолдер-тексту — ні callout, ні MaterialArticleFields його не
// мають (@tiptap/extension-placeholder не встановлено), не додаю нову
// залежність заради вужчого поля.
export function InstructionsRichTextField({
  name,
  label,
  initialValue,
  compact = false,
}: {
  name: string;
  label?: string;
  initialValue?: string;
  // Менша висота/шрифт редактора — для subInstructions (додаткові, менш
  // важливі пояснення), на відміну від основного instructions.
  compact?: boolean;
}) {
  const [html, setHtml] = useState(initialValue ?? "");

  const editor = useEditor({
    // Обов'язково false у Next.js — інакше редактор рендериться на сервері
    // й на клієнті по-різному, і React лається на hydration mismatch.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        code: false,
      }),
      Highlight.configure({ multicolor: true }),
    ],
    content: initialValue ?? "",
    onUpdate({ editor }) {
      // Клієнтська санітизація — лише для швидкого відгуку; остаточна,
      // обов'язкова санітизація — на сервері в actions.ts при збереженні.
      setHtml(sanitizeInstructionsHtml(editor.getHTML()));
    },
    editorProps: {
      attributes: {
        class: `rich-text rounded-md border px-2 py-1.5 focus:outline-none ${
          compact ? "min-h-12 text-xs" : "min-h-16 text-sm"
        }`,
      },
    },
  });

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-neutral-500 dark:text-neutral-400">{label}</label>}
      <input type="hidden" name={name} value={html} readOnly />

      {editor && (
        <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 bg-neutral-50 p-1 dark:bg-neutral-900">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`rounded px-2 py-0.5 text-xs font-bold ${
              editor.isActive("bold")
                ? "bg-neutral-200 dark:bg-neutral-700"
                : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            B
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`rounded px-2 py-0.5 text-xs italic ${
              editor.isActive("italic")
                ? "bg-neutral-200 dark:bg-neutral-700"
                : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            I
          </button>
          <span className="mx-1 h-4 w-px bg-neutral-300 dark:bg-neutral-700" aria-hidden />
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => editor.chain().focus().setHighlight({ color: c.value }).run()}
              style={{ backgroundColor: c.value }}
              className={`h-4 w-4 rounded border-2 ${
                editor.isActive("highlight", { color: c.value })
                  ? "border-black dark:border-white"
                  : "border-transparent"
              }`}
            />
          ))}
          <button
            type="button"
            title="Прибрати підсвітку"
            onClick={() => editor.chain().focus().unsetHighlight().run()}
            className="rounded px-2 py-0.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>
      )}

      <EditorContent editor={editor} className="rounded-b-md" />
    </div>
  );
}
