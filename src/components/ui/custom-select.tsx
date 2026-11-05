"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { Z_MODAL } from "@/lib/z-layers";

export interface CustomSelectOption {
  value: string;
  label: string;
}

export type CustomSelectState = "neutral" | "correct" | "incorrect";

export interface CustomSelectProps {
  id?: string;
  options: CustomSelectOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  // Порожній рядок у трігері, КОЛИ нічого не вибрано (мультивибір завжди
  // передає "" — для нього немає рядка "скинути" у списку: той самий
  // принцип, що в старому <select multiple> без <option value="">).
  // Рядок у самій панелі формується як "— {placeholder} —" (той самий
  // формат, що вже дає i18n-ключ status.chooseOptionDash для uk/en/fr).
  placeholder?: string;
  disabled?: boolean;
  // "correct"/"incorrect" — лише стан ПІСЛЯ перевірки (itemDetail), той
  // самий вигляд, що раніше. "neutral" — усе до перевірки: порожньо чи
  // вже обрано відрізняється лише кольором тексту (muted-курсив/звичайний),
  // не окремим значенням enum — так простіше дотримати мокап буквально.
  state?: CustomSelectState;
  multiple?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  name?: string;
  className?: string;
  // Текст трігера для мультивибору відрізняється від підписів у списку
  // (список завжди показує повне "A) ..."; трігер мультивибору прибирає
  // літерний префікс — stripOptionLetterPrefix у multiple-choice.tsx) —
  // без цього пропса довелося б дублювати форматування в двох місцях.
  // Відсутній пропс — дефолт: об'єднання labels обраних опцій через ", ".
  formatSelectedLabel?: (selected: CustomSelectOption[]) => string;
}

// 84px — той самий запас, що --karaoke-fs-bottom-safe у globals.css: зона
// плаваючого бейджа "Powered by Netlify" знизу вьюпорту на мобільній.
const BOTTOM_SAFE = 84;
const VIEWPORT_MARGIN = 8;
const GAP = 6;
const MAX_HEIGHT_RATIO = 0.6; // 60dvh
const MIN_USEFUL_BELOW = 160;

type PanelStyle = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  openUpward: boolean;
};

export function CustomSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  state = "neutral",
  multiple = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  name,
  className,
  formatSelectedLabel,
}: CustomSelectProps) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<Map<number, HTMLLIElement>>(new Map());
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [panelStyle, setPanelStyle] = useState<PanelStyle | null>(null);
  const typeaheadRef = useRef<{ buffer: string; timer: ReturnType<typeof setTimeout> | null }>({
    buffer: "",
    timer: null,
  });

  const selectedValues = multiple ? (Array.isArray(value) ? value : []) : [typeof value === "string" ? value : ""];
  const hasValue = selectedValues.some((v) => v !== "");
  const selectedOptions = options.filter((o) => selectedValues.includes(o.value));

  // items[0] — рядок-плейсхолдер "— {placeholder} —" ЛИШЕ для одиночного
  // вибору (той самий принцип, що старий <option value="">, якого немає
  // для item.multiple — там "скинути" завжди робилось зняттям галочки).
  const placeholderItem: CustomSelectOption | null =
    !multiple && placeholder !== undefined ? { value: "", label: `— ${placeholder} —` } : null;
  const items: CustomSelectOption[] = placeholderItem ? [placeholderItem, ...options] : options;

  const triggerLabel = !hasValue
    ? placeholder ?? ""
    : formatSelectedLabel
      ? formatSelectedLabel(selectedOptions)
      : selectedOptions.map((o) => o.label).join(", ");

  function closePanel(focusTrigger = true) {
    setOpen(false);
    setPanelStyle(null);
    if (focusTrigger) triggerRef.current?.focus({ preventScroll: true });
  }

  function openPanel() {
    if (disabled) return;
    const prefersReducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const initialIndex = Math.max(
      0,
      items.findIndex((it) => selectedValues.includes(it.value))
    );
    setHighlighted(initialIndex);
    setOpen(true);
    setEntered(prefersReducedMotion);
  }

  function selectIndex(index: number) {
    const item = items[index];
    if (!item) return;
    if (multiple) {
      const next = selectedValues.includes(item.value)
        ? selectedValues.filter((v) => v !== item.value)
        : [...selectedValues.filter((v) => v !== ""), item.value];
      onChange(next);
      // Мультивибір НЕ закриває панель на кожному виборі — студент може
      // позначити кілька варіантів поспіль (той самий принцип, що
      // ctrl/cmd-клік у старому <select multiple>, лише тапом).
      return;
    }
    onChange(item.value);
    closePanel();
  }

  function moveHighlight(delta: number) {
    setHighlighted((prev) => Math.min(items.length - 1, Math.max(0, prev + delta)));
  }

  function typeaheadJump(char: string) {
    const buf = typeaheadRef.current;
    if (buf.timer) clearTimeout(buf.timer);
    buf.buffer = (buf.buffer + char).toLowerCase();
    buf.timer = setTimeout(() => {
      buf.buffer = "";
    }, 600);
    const n = items.length;
    for (let step = 1; step <= n; step++) {
      const idx = (highlighted + step) % n;
      if (items[idx].label.trim().toLowerCase().startsWith(buf.buffer)) {
        setHighlighted(idx);
        return;
      }
    }
  }

  function onTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openPanel();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        openPanel();
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        closePanel();
        break;
      case "ArrowDown":
        e.preventDefault();
        moveHighlight(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveHighlight(-1);
        break;
      case "Home":
        e.preventDefault();
        setHighlighted(0);
        break;
      case "End":
        e.preventDefault();
        setHighlighted(items.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        selectIndex(highlighted);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typeaheadJump(e.key);
    }
  }

  // Позиція панелі залежить ЛИШЕ від rect трігера й вьюпорту, не від
  // кількості опцій — maxHeight лише ВЕРХНЯ межа (overflow-y:auto всередині
  // панелі), тож міряти природну висоту вмісту заздалегідь не потрібно.
  // Відкриття вгору — без обчислення висоти: translateY(-100%) зсуває
  // ВЖЕ відрендерену панель так, щоб її нижній край сів у точці top.
  useEffect(() => {
    if (!open) return;
    function reposition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const vv = window.visualViewport;
      const viewportHeight = vv?.height ?? window.innerHeight;
      const viewportWidth = vv?.width ?? window.innerWidth;
      const offsetTop = vv?.offsetTop ?? 0;
      const offsetLeft = vv?.offsetLeft ?? 0;
      const spaceBelow = offsetTop + viewportHeight - BOTTOM_SAFE - rect.bottom;
      const spaceAbove = rect.top - offsetTop;
      const openUpward = !(spaceBelow >= MIN_USEFUL_BELOW || spaceBelow >= spaceAbove);
      const available = openUpward ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(120, Math.min(available - GAP, viewportHeight * MAX_HEIGHT_RATIO));
      const left = Math.max(
        offsetLeft + VIEWPORT_MARGIN,
        Math.min(rect.left, offsetLeft + viewportWidth - rect.width - VIEWPORT_MARGIN)
      );
      setPanelStyle(
        openUpward
          ? { top: rect.top - GAP, left, width: rect.width, maxHeight, openUpward: true }
          : { top: rect.bottom + GAP, left, width: rect.width, maxHeight, openUpward: false }
      );
    }
    const raf = requestAnimationFrame(reposition);
    const enterRaf = requestAnimationFrame(() => setEntered(true));
    window.addEventListener("resize", reposition);
    window.addEventListener("orientationchange", reposition);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    // Скрол ПОЗА панеллю закриває її (простіший стабільний варіант за
    // repositioning під час скролу, як дозволяє задача); скрол УСЕРЕДИНІ
    // самої панелі (overflow-y:auto) має працювати нормально.
    function onScroll(e: Event) {
      const target = e.target as Node | null;
      if (panelRef.current && target && panelRef.current.contains(target)) return;
      closePanel(false);
    }
    window.addEventListener("scroll", onScroll, true);
    function onPointerDownOutside(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      closePanel(false);
    }
    document.addEventListener("pointerdown", onPointerDownOutside, true);
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closePanel();
    }
    document.addEventListener("keydown", onKeyDown);
    function onFocusOut(e: FocusEvent) {
      const next = e.relatedTarget as Node | null;
      if (next && (triggerRef.current?.contains(next) || panelRef.current?.contains(next))) return;
      closePanel(false);
    }
    document.addEventListener("focusout", onFocusOut, true);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(enterRaf);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("orientationchange", reposition);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("pointerdown", onPointerDownOutside, true);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusout", onFocusOut, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current.get(highlighted)?.scrollIntoView({ block: "nearest" });
  }, [open, highlighted]);

  const isEmpty = !hasValue;
  const borderWidth = open && state === "neutral" ? "border-2" : "border-[1.5px]";
  const borderColorLight =
    state === "correct" ? "border-green-500" : state === "incorrect" ? "border-red-500" : open ? "border-[#3b36c4]" : "border-[#d9b765]";
  const borderColorDark =
    state === "correct"
      ? "dark:border-green-600"
      : state === "incorrect"
        ? "dark:border-red-600"
        : open
          ? "dark:border-[#4b46da]"
          : "dark:border-[#8c7a3f]";
  const bgLight = state === "correct" ? "bg-green-50" : state === "incorrect" ? "bg-red-50" : "bg-[#fffdf6]";
  const bgDark = state === "correct" ? "dark:bg-green-950/30" : state === "incorrect" ? "dark:bg-red-950/30" : "dark:bg-[#201f5c]";
  const textLight =
    state === "correct" ? "text-green-700" : state === "incorrect" ? "text-red-700" : isEmpty ? "text-[#6a5d40]" : "text-[#1a1640]";
  const textDark =
    state === "correct"
      ? "dark:text-green-300"
      : state === "incorrect"
        ? "dark:text-red-300"
        : isEmpty
          ? "dark:text-[#a9a6d6]"
          : "dark:text-[#f4ecd2]";
  const italicClass = state === "neutral" && isEmpty ? "italic" : "";
  const ringClass = open && state === "neutral" ? "ring-4 ring-[#e8eafc] dark:ring-[rgba(46,44,143,0.55)]" : "";
  const chevronColor =
    state === "correct"
      ? "text-green-600 dark:text-green-400"
      : state === "incorrect"
        ? "text-red-600 dark:text-red-400"
        : isEmpty
          ? "text-[#6a5d40] dark:text-[#a9a6d6]"
          : "text-[#3b36c4] dark:text-[#a8a4ff]";

  const triggerClass = `flex min-h-12 w-full items-center justify-between gap-2 rounded-full px-4 font-sans text-[15px] leading-snug transition-colors touch-manipulation focus-visible:outline-none disabled:cursor-not-allowed ${borderWidth} ${borderColorLight} ${borderColorDark} ${bgLight} ${bgDark} ${textLight} ${textDark} ${italicClass} ${ringClass} ${className ?? ""}`;

  const transitionStyle: React.CSSProperties | undefined = panelStyle
    ? {
        position: "fixed",
        left: panelStyle.left,
        width: panelStyle.width,
        maxHeight: panelStyle.maxHeight,
        top: panelStyle.top,
        transform: panelStyle.openUpward
          ? `translateY(-100%) scale(${entered ? 1 : 0.95})`
          : `scale(${entered ? 1 : 0.95})`,
        transformOrigin: panelStyle.openUpward ? "bottom" : "top",
        opacity: entered ? 1 : 0,
        transition: "opacity 120ms ease-out, transform 120ms ease-out",
      }
    : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-activedescendant={open ? `${listId}-option-${highlighted}` : undefined}
        onClick={() => (open ? closePanel() : openPanel())}
        onKeyDown={onTriggerKeyDown}
        className={triggerClass}
      >
        <span className="truncate" title={triggerLabel || undefined}>
          {triggerLabel}
        </span>
        <ChevronDown
          size={18}
          aria-hidden
          className={`shrink-0 transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""} ${chevronColor}`}
        />
      </button>
      {name &&
        selectedValues
          .filter((v) => v !== "")
          .map((v) => <input key={v} type="hidden" name={name} value={v} />)}
      {open &&
        panelStyle &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            ref={panelRef}
            role="listbox"
            id={listId}
            aria-multiselectable={multiple || undefined}
            className={`${Z_MODAL} overflow-y-auto overscroll-contain rounded-2xl border-[1.5px] font-sans shadow-[0_14px_30px_rgba(60,45,10,0.22)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.55)] border-[#d9b765] dark:border-[#8c7a3f] bg-[#fffdf6] dark:bg-[#1d1c56] divide-y divide-[#efe3bd] dark:divide-[#33317a] motion-reduce:transition-none`}
            style={transitionStyle}
          >
            {items.map((item, idx) => {
              const selected = selectedValues.includes(item.value);
              const isPlaceholderRow = placeholderItem && idx === 0;
              const rowHighlighted = idx === highlighted;
              return (
                <li
                  key={item.value || "__placeholder__"}
                  ref={(el) => {
                    if (el) optionRefs.current.set(idx, el);
                    else optionRefs.current.delete(idx);
                  }}
                  id={`${listId}-option-${idx}`}
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.preventDefault()}
                  onClick={() => selectIndex(idx)}
                  onPointerEnter={() => setHighlighted(idx)}
                  className={`flex min-h-12 w-full cursor-pointer touch-manipulation select-none items-center justify-between gap-2 px-4 text-[17px] first:rounded-t-2xl last:rounded-b-2xl ${
                    rowHighlighted ? "ring-2 ring-inset ring-[#3b36c4] dark:ring-[#a8a4ff]" : ""
                  } ${
                    selected
                      ? "bg-[#e8eafc] font-semibold text-[#2f2c6b] dark:bg-[#2e2c8f] dark:text-[#f3d98b]"
                      : isPlaceholderRow
                        ? "italic text-[#6a5d40] dark:text-[#a9a6d6]"
                        : "text-[#1a1640] dark:text-[#f4ecd2]"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {selected && <Check size={18} aria-hidden className="shrink-0 text-[#3b36c4] dark:text-[#f3d98b]" />}
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </>
  );
}
