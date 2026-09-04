"use client";

import { useRef } from "react";

const HIGHLIGHT_COLORS: { value: string; label: string }[] = [
  { value: "#fef08a", label: "Жовтий" },
  { value: "#bbf7d0", label: "Зелений" },
  { value: "#fbcfe8", label: "Рожевий" },
  { value: "#bfdbfe", label: "Синій" },
];

// Легка панель форматування (B/I/підсвітка) для instructions/
// subInstructions у ВСІХ типах вправ — на відміну від CalloutFields
// (TipTap, contentEditable), поле лишається звичайним <input>/<textarea>:
// кнопки просто обгортають виділений текст HTML-тегами прямо в рядку, без
// contentEditable/rich-text-стану. Санітизується (sanitizeInstructionsHtml)
// при збереженні (actions.ts) і повторно при рендері студенту
// (InstructionsText) — той самий double-sanitize принцип, що callout.
export function FormattedTextField({
  name,
  defaultValue,
  placeholder,
  multiline = false,
  label,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  multiline?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function wrap(before: string, after: string) {
    const el = multiline ? textareaRef.current : inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const selected = el.value.slice(start, end);
    el.value = el.value.slice(0, start) + before + selected + after + el.value.slice(end);
    el.focus();
    const cursor = start + before.length + selected.length + after.length;
    el.setSelectionRange(cursor, cursor);
  }

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-neutral-500 dark:text-neutral-400">{label}</label>}
      <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 bg-neutral-50 p-1 dark:bg-neutral-900">
        <button
          type="button"
          onClick={() => wrap("<strong>", "</strong>")}
          title="Жирний"
          className="rounded px-2 py-0.5 text-xs font-bold hover:bg-neutral-200 dark:hover:bg-neutral-700"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => wrap("<em>", "</em>")}
          title="Курсив"
          className="rounded px-2 py-0.5 text-xs italic hover:bg-neutral-200 dark:hover:bg-neutral-700"
        >
          I
        </button>
        <span className="mx-1 h-4 w-px bg-neutral-300 dark:bg-neutral-700" aria-hidden />
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            title={c.label}
            onClick={() =>
              wrap(`<mark data-color="${c.value}" style="background-color:${c.value}">`, "</mark>")
            }
            style={{ backgroundColor: c.value }}
            className="h-4 w-4 rounded border border-neutral-300 dark:border-neutral-600"
          />
        ))}
      </div>
      {multiline ? (
        <textarea
          ref={textareaRef}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          rows={3}
          className="rounded-b-md border px-2 py-1.5 text-sm"
        />
      ) : (
        <input
          ref={inputRef}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="rounded-b-md border px-2 py-1.5 text-sm"
        />
      )}
    </div>
  );
}
