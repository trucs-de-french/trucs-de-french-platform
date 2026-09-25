"use client";

import { useEffect, useRef, useState } from "react";
import { TASK_TYPE_COLORS, TASK_TYPE_GROUPS, TASK_TYPE_DESCRIPTIONS } from "@/lib/exercises/task-type-meta";
import { TaskTypeIconBadge } from "@/lib/exercises/task-type-icon-badge";
import { Z_DROPDOWN } from "@/lib/z-layers";

type Option = { value: string; label: string };
type Item = Option & { description: string };
type Group = { name: string; items: Item[] };

// Розкладає плаский options (task-config-fields.tsx, значення/підписи, що
// РЕАЛЬНО доступні для вибору — напр. 'game' лише коли редагується вже
// наявна стара задача) по групах TASK_TYPE_GROUPS (task-type-meta.ts,
// єдине джерело складу/порядку груп) — порядок групи й типів усередині неї
// береться звідти, не з порядку options. Тип, якого нема в жодній групі
// (не мало б статись, але про всяк випадок — якщо колись додадуть новий тип
// у TYPE_OPTIONS і забудуть тут) потрапляє в "Інше" в кінці, а не губиться.
function buildGroups(options: Option[]): Group[] {
  const byValue = new Map(options.map((o) => [o.value, o]));
  const used = new Set<string>();
  const groups: Group[] = [];

  for (const g of TASK_TYPE_GROUPS) {
    const items: Item[] = [];
    for (const type of g.types) {
      const opt = byValue.get(type);
      if (!opt) continue;
      items.push({ ...opt, description: TASK_TYPE_DESCRIPTIONS[type] ?? "" });
      used.add(type);
    }
    if (items.length > 0) groups.push({ name: g.name, items });
  }

  const leftovers = options.filter((o) => !used.has(o.value));
  if (leftovers.length > 0) {
    groups.push({
      name: "Інше",
      items: leftovers.map((o) => ({ ...o, description: TASK_TYPE_DESCRIPTIONS[o.value] ?? "" })),
    });
  }
  return groups;
}

// Кастомний searchable-комбобокс замість нативного <select> — щоб додати
// пошук у довгому згрупованому списку (20+ типів, 5 груп) і показати
// іконку/колір/опис кожного типу, чого нативний <select><option> зробити
// не може. Значення віддається назовні через onChange (як контрольований
// інпут), сам компонент нічого в форму не сабмітить — за це відповідає
// прихований <input> у task-config-fields.tsx, той самий підхід, що вже є
// для callout_style.
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
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // Індекс серед ВИБИРАЄМИХ пунктів (flatItems нижче), заголовки груп у цю
  // нумерацію не потрапляють — стрілки/Enter їх фізично не можуть зачепити.
  const [activeIndex, setActiveIndex] = useState(0);
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

  const groups = buildGroups(options);
  const normalizedQuery = query.trim().toLowerCase();
  // Група-заголовок лишається, лише якщо в ній є бодай один пункт, що
  // відповідає запиту — за назвою типу, ОПИСОМ чи назвою САМОЇ ГРУПИ (якщо
  // збігається назва групи, показуємо всі її пункти, не лише ті, що самі
  // містять запит).
  const filteredGroups = normalizedQuery
    ? groups
        .map((g) => ({
          ...g,
          items: g.items.filter(
            (it) =>
              it.label.toLowerCase().includes(normalizedQuery) ||
              it.description.toLowerCase().includes(normalizedQuery) ||
              g.name.toLowerCase().includes(normalizedQuery)
          ),
        }))
        .filter((g) => g.items.length > 0)
    : groups;

  // Наскрізна нумерація пунктів (без заголовків) для стрілок/Enter — та сама
  // послідовність, у якій пункти й рендеряться нижче.
  let flatIndex = 0;
  const rows = filteredGroups.map((g) => ({
    ...g,
    items: g.items.map((it) => ({ ...it, flatIndex: flatIndex++ })),
  }));
  const flatItems = rows.flatMap((g) => g.items);
  const clampedActive = Math.min(activeIndex, Math.max(flatItems.length - 1, 0));

  function select(v: string) {
    onChange(v);
    setQuery("");
    setActiveIndex(0);
    setOpen(false);
  }

  function handleQueryChange(v: string) {
    setQuery(v);
    setActiveIndex(0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[clampedActive];
      if (item) select(item.value);
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
          {selected && <TaskTypeIconBadge type={selected.value} size="sm" />}
          {selected?.label ?? "Оберіть тип"}
        </span>
        <span className="text-neutral-400 dark:text-neutral-500" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className={`absolute ${Z_DROPDOWN} mt-1 w-full rounded-md border border-gray-100 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-950`}>
          <input
            autoFocus
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Пошук типу..."
            className="w-full border-b px-3 py-2 text-sm focus:outline-none"
          />
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {flatItems.length === 0 && (
              <li className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
                Нічого не знайдено
              </li>
            )}
            {rows.map((g) => (
              <li key={g.name} role="presentation">
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                  {g.name}
                </p>
                <ul role="group" aria-label={g.name}>
                  {g.items.map((opt) => {
                    const dot = TASK_TYPE_COLORS[opt.value]?.dot;
                    const isActive = opt.flatIndex === clampedActive;
                    return (
                      <li key={opt.value} role="option" aria-selected={opt.value === value}>
                        <button
                          type="button"
                          onClick={() => select(opt.value)}
                          onMouseEnter={() => setActiveIndex(opt.flatIndex)}
                          className={`flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm ${
                            opt.value === value
                              ? "bg-neutral-100 dark:bg-neutral-800"
                              : isActive
                                ? "bg-neutral-50 dark:bg-neutral-800/70"
                                : ""
                          }`}
                        >
                          <TaskTypeIconBadge type={opt.value} size="xs" />
                          {dot && <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />}
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate">{opt.label}</span>
                            {opt.description && (
                              <span className="truncate text-xs text-neutral-400 dark:text-neutral-500">
                                {opt.description}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
