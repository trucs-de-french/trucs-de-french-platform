"use client";

// Спільний кастомний dropdown кабінету — замінює ВСІ native <select> у
// /cabinet (тип іспиту в Home/Settings, тижнева ціль): нативний popup
// браузера ніколи не рендериться в cabinet, лише ця панель-портал.
// Позиціонування/клавіатура/outside-click — та сама логіка, що вже є в
// src/components/ui/custom-select.tsx (сцени/вправи), спрощена до
// одиничного вибору (без multiple/exercise-стану correct/incorrect) і
// переозначена через власні .cabinet-select-* класи (не Tailwind-набір
// custom-select.tsx) — колірна мова кабінету (gold-trigger, indigo/gold
// вибір) інша за колірну мову вправ.
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

export interface CabinetSelectOption {
  value: string;
  label: string;
}

export interface CabinetSelectProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: CabinetSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

const BOTTOM_SAFE = 84;
const VIEWPORT_MARGIN = 8;
const GAP = 6;
const MAX_HEIGHT = 280;

type PanelStyle = { top: number; left: number; width: number; maxHeight: number; openUpward: boolean };

export function CabinetSelect({
  id,
  name,
  value,
  defaultValue,
  onChange,
  options,
  placeholder,
  disabled,
  "aria-label": ariaLabel,
}: CabinetSelectProps) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<Map<number, HTMLLIElement>>(new Map());

  // Контрольований (value+onChange, батько тримає стейт — weekly-goal-
  // card.tsx) і неконтрольований (лише defaultValue, читається з
  // FormData на сабміт — exam-форми) режими без жодної синхронізації
  // "пропс -> копія стейту" (ефектом чи під час рендеру): коли value
  // передано, читаємо ЙОГО напряму — власний internal-стейт заводимо
  // лише для НЕконтрольованого випадку, і він просто ніколи не
  // використовується в контрольованому.
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? "");
  const current = isControlled ? value : uncontrolledValue;

  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [panelStyle, setPanelStyle] = useState<PanelStyle | null>(null);
  const typeaheadRef = useRef<{ buffer: string; timer: ReturnType<typeof setTimeout> | null }>({
    buffer: "",
    timer: null,
  });

  const selectedOption = options.find((o) => o.value === current) ?? null;
  const triggerLabel = selectedOption?.label ?? placeholder ?? "";

  function closePanel(focusTrigger = true) {
    setOpen(false);
    setPanelStyle(null);
    if (focusTrigger) triggerRef.current?.focus({ preventScroll: true });
  }

  function openPanel() {
    if (disabled) return;
    const initialIndex = Math.max(0, options.findIndex((o) => o.value === current));
    setHighlighted(initialIndex);
    setOpen(true);
  }

  function selectIndex(index: number) {
    const option = options[index];
    if (!option) return;
    if (!isControlled) setUncontrolledValue(option.value);
    onChange?.(option.value);
    closePanel();
  }

  function moveHighlight(delta: number) {
    setHighlighted((prev) => Math.min(options.length - 1, Math.max(0, prev + delta)));
  }

  function typeaheadJump(char: string) {
    const buf = typeaheadRef.current;
    if (buf.timer) clearTimeout(buf.timer);
    buf.buffer = (buf.buffer + char).toLowerCase();
    buf.timer = setTimeout(() => {
      buf.buffer = "";
    }, 600);
    const n = options.length;
    for (let step = 1; step <= n; step++) {
      const idx = (highlighted + step) % n;
      if (options[idx].label.trim().toLowerCase().startsWith(buf.buffer)) {
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
        setHighlighted(options.length - 1);
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

  // Та сама позиційна логіка, що custom-select.tsx: rect трігера визначає
  // top/left/width; maxHeight — верхня межа (280px), не точний вміст.
  useEffect(() => {
    if (!open) return;
    function reposition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - BOTTOM_SAFE - rect.bottom;
      const spaceAbove = rect.top;
      const openUpward = spaceBelow < 160 && spaceAbove > spaceBelow;
      const available = openUpward ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(120, Math.min(available - GAP, MAX_HEIGHT));
      const left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(rect.left, viewportWidth - rect.width - VIEWPORT_MARGIN)
      );
      setPanelStyle(
        openUpward
          ? { top: rect.top - GAP, left, width: rect.width, maxHeight, openUpward: true }
          : { top: rect.bottom + GAP, left, width: rect.width, maxHeight, openUpward: false }
      );
    }
    const raf = requestAnimationFrame(reposition);
    window.addEventListener("resize", reposition);
    // Скрол ПОЗА панеллю закриває її — скрол усередині (overflow-y:auto)
    // працює штатно.
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
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("pointerdown", onPointerDownOutside, true);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusout", onFocusOut, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current.get(highlighted)?.scrollIntoView({ block: "nearest" });
  }, [open, highlighted]);

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-option-${highlighted}` : undefined}
        onClick={() => (open ? closePanel() : openPanel())}
        onKeyDown={onTriggerKeyDown}
        className="cabinet-select-trigger"
      >
        <span className={selectedOption ? "truncate" : "truncate cabinet-select-trigger-label--placeholder"}>
          {triggerLabel}
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`cabinet-select-chevron ${open ? "cabinet-select-chevron--open" : ""}`}
        />
      </button>
      {name && <input type="hidden" name={name} value={current} />}
      {open &&
        panelStyle &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            ref={panelRef}
            role="listbox"
            id={listId}
            className="cabinet-select-panel"
            style={{
              position: "fixed",
              top: panelStyle.top,
              left: panelStyle.left,
              width: panelStyle.width,
              maxHeight: panelStyle.maxHeight,
              transform: panelStyle.openUpward ? "translateY(-100%)" : undefined,
            }}
          >
            {options.map((option, idx) => {
              const selected = option.value === current;
              const active = idx === highlighted;
              return (
                <li
                  key={option.value}
                  ref={(el) => {
                    if (el) optionRefs.current.set(idx, el);
                    else optionRefs.current.delete(idx);
                  }}
                  id={`${listId}-option-${idx}`}
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectIndex(idx)}
                  onPointerEnter={() => setHighlighted(idx)}
                  className={[
                    "cabinet-select-option",
                    selected ? "cabinet-select-option--selected" : "",
                    active && !selected ? "cabinet-select-option--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="truncate">{option.label}</span>
                  {selected && <Check size={16} aria-hidden="true" className="shrink-0" />}
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </>
  );
}
