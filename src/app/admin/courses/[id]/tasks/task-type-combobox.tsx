"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORY_COLORS, TASK_TYPE_ICON, getTaskTypeCategory } from "@/lib/exercises/task-type-meta";

// Кастомний searchable-комбобокс замість нативного <select> — щоб додати
// пошук у довгому списку (20+ типів) і показати іконку/колір категорії на
// кожному пункті, чого нативний <select><option> зробити не може. Значення
// віддається назовні через onChange (як контрольований інпут), сам компонент
// нічого в форму не сабмітить — за це відповідає прихований <input> у
// task-config-fields.tsx, той самий підхід, що вже є для callout_style.
//
// TASK_TYPE_ICON[x] напряму (не через getTaskTypeIcon(x)) — react-hooks
// eslint-плагін (react-compiler-based static-components rule) хибно
// трактує "змінна = виклик функції, потім <Змінна/>" як створення нового
// компонента під час рендеру; пряме звернення до об'єкта цю евристику не
// зачіпає (перевірено у Stage 3 в вихідному коді самого плагіна).
export function TaskTypeCombobox({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value);
  const SelectedIcon = selected ? TASK_TYPE_ICON[selected.value] : undefined;

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? options.filter((o) => o.label.toLowerCase().includes(normalizedQuery))
    : options;

  function select(v: string) {
    onChange(v);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0) select(filtered[0].value);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm"
      >
        <span className="flex items-center gap-2">
          {SelectedIcon && <SelectedIcon className="h-4 w-4" aria-hidden />}
          {selected?.label ?? "Оберіть тип"}
        </span>
        <span className="text-neutral-400 dark:text-neutral-500" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-white shadow-lg dark:bg-neutral-950">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Пошук типу..."
            className="w-full border-b px-3 py-2 text-sm focus:outline-none"
          />
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
                Нічого не знайдено
              </li>
            )}
            {filtered.map((opt) => {
              const Icon = TASK_TYPE_ICON[opt.value];
              const category = getTaskTypeCategory(opt.value);
              return (
                <li key={opt.value} role="option" aria-selected={opt.value === value}>
                  <button
                    type="button"
                    onClick={() => select(opt.value)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                      opt.value === value ? "bg-neutral-100 dark:bg-neutral-800" : ""
                    }`}
                  >
                    {category && (
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_COLORS[category].dot}`}
                        aria-hidden
                      />
                    )}
                    {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
