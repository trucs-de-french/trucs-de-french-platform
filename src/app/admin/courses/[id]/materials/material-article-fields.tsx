"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import { sanitizeCalloutHtml } from "@/lib/sanitize-callout-html";

// Той самий TipTap-набір розширень і той самий sanitizeCalloutHtml, що вже
// в callout-fields.tsx — окремий компонент, а не спільний з CalloutFields,
// бо тут немає style-піктограми (це специфічно для callout-блоку) і не
// хочеться ризикувати вже робочим, задеплоєним компонентом заради невеликого
// скорочення дублювання тулбару.
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

export function MaterialArticleFields({ initialContent }: { initialContent?: string | null }) {
  const [html, setHtml] = useState(initialContent ?? "");

  const editor = useEditor({
    // Обов'язково false у Next.js — інакше редактор рендериться на сервері
    // й на клієнті по-різному, і React лається на hydration mismatch.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      TextStyle,
      FontFamily,
      Highlight.configure({ multicolor: true }),
    ],
    content: initialContent ?? "",
    onUpdate({ editor }) {
      // Клієнтська санітизація — лише для швидкого відгуку; остаточна,
      // обов'язкова санітизація — на сервері в actions.ts при збереженні.
      setHtml(sanitizeCalloutHtml(editor.getHTML()));
    },
    editorProps: {
      attributes: {
        class: "rich-text min-h-48 rounded-md border px-3 py-2 text-sm focus:outline-none",
      },
    },
  });

  function toggleFont(value: string) {
    if (!editor) return;
    if (value) {
      editor.chain().focus().setFontFamily(value).run();
    } else {
      editor.chain().focus().unsetFontFamily().run();
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-neutral-500 dark:text-neutral-400">
        Текст статті (необов&apos;язково)
      </label>
      <input type="hidden" name="content" value={html} readOnly />

      {editor && (
        <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 bg-white p-1 dark:bg-neutral-950">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`rounded px-2 py-1 text-xs font-bold ${
              editor.isActive("bold") ? "bg-neutral-200 dark:bg-neutral-700" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            B
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`rounded px-2 py-1 text-xs italic ${
              editor.isActive("italic") ? "bg-neutral-200 dark:bg-neutral-700" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            I
          </button>
          <span className="mx-1 h-5 w-px bg-neutral-300 dark:bg-neutral-700" aria-hidden />
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Підсвітка:</span>
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
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
            onClick={() => editor.chain().focus().unsetHighlight().run()}
            className="rounded px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
          <span className="mx-1 h-5 w-px bg-neutral-300 dark:bg-neutral-700" aria-hidden />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`rounded px-2 py-1 text-xs ${
              editor.isActive("heading", { level: 2 }) ? "bg-neutral-200 dark:bg-neutral-700" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            H2
          </button>
          <button
            type="button"
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
            className="rounded border px-1.5 py-1 text-xs"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <EditorContent editor={editor} className="rounded-b-md" />
    </div>
  );
}
