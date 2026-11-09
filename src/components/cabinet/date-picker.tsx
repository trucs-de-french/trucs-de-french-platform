"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { t } from "@/lib/i18n/t";
import { Z_MODAL } from "@/lib/z-layers";
import type { UiLang } from "@/lib/ui/product-lang";

const LOCALE_BY_LANG: Record<UiLang, string> = { uk: "uk-UA", fr: "fr-FR", en: "en-US" };

const BOTTOM_SAFE = 84;
const VIEWPORT_MARGIN = 8;
const GAP = 6;
const POPOVER_WIDTH = 304;
const MOBILE_QUERY = "(max-width: 639px)";

type View = "days" | "months" | "years";
type PanelStyle = { top: number; left: number; openUpward: boolean } | null;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Будуємо yyyy-mm-dd з getFullYear/getMonth/getDate (локальна дата), не
// toISOString() — той переводить у UTC і зсуває дату на ±1 день залежно
// від часового поясу браузера.
function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}
function addDays(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);
}

export interface DatePickerProps {
  name: string;
  defaultValue?: string | null;
  min?: string;
  max?: string;
  lang: UiLang;
  placeholder?: string;
  id?: string;
  onChange?: (iso: string | null) => void;
}

export function DatePicker({ name, defaultValue, min, max, lang, placeholder, id, onChange }: DatePickerProps) {
  const locale = LOCALE_BY_LANG[lang];
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const yearsListRef = useRef<HTMLDivElement>(null);
  const dayRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const initial = useMemo(() => parseIso(defaultValue ?? null), [defaultValue]);
  const [selected, setSelected] = useState<Date | null>(initial);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("days");
  const [viewDate, setViewDate] = useState<Date>(() => initial ?? parseIso(min ?? null) ?? new Date());
  const [focusedDate, setFocusedDate] = useState<Date>(() => initial ?? parseIso(min ?? null) ?? new Date());
  const [panelStyle, setPanelStyle] = useState<PanelStyle>(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches
  );

  const iso = selected ? toIso(selected) : "";

  function isDisabled(date: Date): boolean {
    const dIso = toIso(date);
    if (min && dIso < min) return true;
    if (max && dIso > max) return true;
    return false;
  }

  function closePanel(focusTrigger = true) {
    setOpen(false);
    setPanelStyle(null);
    if (focusTrigger) triggerRef.current?.focus({ preventScroll: true });
  }

  function openPanel() {
    const base = selected ?? parseIso(min ?? null) ?? new Date();
    setViewDate(startOfMonth(base));
    setFocusedDate(base);
    setView("days");
    setOpen(true);
  }

  function selectDate(date: Date) {
    if (isDisabled(date)) return;
    setSelected(date);
    onChange?.(toIso(date));
    closePanel();
  }

  function clear() {
    setSelected(null);
    onChange?.(null);
    closePanel();
  }

  function goToday() {
    const today = new Date();
    if (!isDisabled(today)) selectDate(today);
  }

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(viewDate),
    [locale, viewDate]
  );

  const weekdayLabels = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        // Понеділок 2024-01-01 — безпечний якір для короткого weekday-лейбла.
        const d = new Date(2024, 0, 1 + i);
        return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
      }),
    [locale]
  );

  const monthCells = useMemo(() => {
    const first = startOfMonth(viewDate);
    const firstWeekday = (first.getDay() + 6) % 7; // Пн=0..Нд=6
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const cells: Date[] = [];
    for (let i = firstWeekday; i > 0; i--) cells.push(addDays(first, -i));
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(addDays(cells[cells.length - 1], 1));
    return cells;
  }, [viewDate]);

  const monthGridMonths = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(viewDate.getFullYear(), i, 1)),
    [viewDate]
  );

  const yearRange = useMemo(() => {
    const now = new Date().getFullYear();
    const minYear = min ? Number(min.slice(0, 4)) : now - 100;
    const maxYear = max ? Number(max.slice(0, 4)) : now + 50;
    const arr: number[] = [];
    for (let y = minYear; y <= maxYear; y++) arr.push(y);
    return arr;
  }, [min, max]);

  function monthShort(d: Date): string {
    return new Intl.DateTimeFormat(locale, { month: "short" }).format(d);
  }

  function onDayKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    let next: Date | null = null;
    switch (e.key) {
      case "ArrowLeft":
        next = addDays(focusedDate, -1);
        break;
      case "ArrowRight":
        next = addDays(focusedDate, 1);
        break;
      case "ArrowUp":
        next = addDays(focusedDate, -7);
        break;
      case "ArrowDown":
        next = addDays(focusedDate, 7);
        break;
      case "PageUp":
        next = addMonths(focusedDate, -1);
        break;
      case "PageDown":
        next = addMonths(focusedDate, 1);
        break;
      case "Home": {
        const dow = (focusedDate.getDay() + 6) % 7;
        next = addDays(focusedDate, -dow);
        break;
      }
      case "End": {
        const dow = (focusedDate.getDay() + 6) % 7;
        next = addDays(focusedDate, 6 - dow);
        break;
      }
      case "Enter":
      case " ":
        e.preventDefault();
        selectDate(focusedDate);
        return;
      default:
        return;
    }
    e.preventDefault();
    setFocusedDate(next);
    if (next.getMonth() !== viewDate.getMonth() || next.getFullYear() !== viewDate.getFullYear()) {
      setViewDate(startOfMonth(next));
    }
  }

  // Фокус на клавіатурно-активній клітинці — лише у виді днів, і лише
  // ПІСЛЯ того, як сітка вже перерендерилась під новий viewDate/focusedDate.
  useEffect(() => {
    if (!open || view !== "days") return;
    dayRefs.current.get(toIso(focusedDate))?.focus({ preventScroll: true });
  }, [open, view, focusedDate, viewDate]);

  // Автоскрол до поточного обраного року, коли відкривається список років.
  useEffect(() => {
    if (!open || view !== "years") return;
    const el = yearsListRef.current?.querySelector<HTMLButtonElement>(
      `[data-year="${viewDate.getFullYear()}"]`
    );
    el?.scrollIntoView({ block: "center" });
  }, [open, view, viewDate]);

  // Мобільний bottom sheet <640px.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    function onChangeMq(e: MediaQueryListEvent) {
      setIsMobile(e.matches);
    }
    mq.addEventListener("change", onChangeMq);
    return () => mq.removeEventListener("change", onChangeMq);
  }, []);

  // Позиціонування попапа від rect трігера (fixed), з переворотом вгору,
  // якщо знизу не влазить — той самий підхід, що custom-select.tsx.
  useEffect(() => {
    if (!open || isMobile) return;
    function reposition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - BOTTOM_SAFE - rect.bottom;
      const spaceAbove = rect.top;
      const openUpward = spaceBelow < 360 && spaceAbove > spaceBelow;
      const left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(rect.left, viewportWidth - POPOVER_WIDTH - VIEWPORT_MARGIN)
      );
      setPanelStyle(
        openUpward
          ? { top: rect.top - GAP, left, openUpward: true }
          : { top: rect.bottom + GAP, left, openUpward: false }
      );
    }
    const raf = requestAnimationFrame(reposition);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, isMobile]);

  // Outside click / Escape / focusout — закривають попап; той самий
  // принцип, що custom-select.tsx.
  useEffect(() => {
    if (!open) return;
    function onPointerDownOutside(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      closePanel(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closePanel();
    }
    function onFocusOut(e: FocusEvent) {
      const next = e.relatedTarget as Node | null;
      if (next && (triggerRef.current?.contains(next) || panelRef.current?.contains(next))) return;
      closePanel(false);
    }
    document.addEventListener("pointerdown", onPointerDownOutside, true);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusout", onFocusOut, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDownOutside, true);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusout", onFocusOut, true);
    };
  }, [open]);

  const displayText = selected
    ? `${pad2(selected.getDate())}.${pad2(selected.getMonth() + 1)}.${selected.getFullYear()}`
    : "";

  const popoverStyle: React.CSSProperties = isMobile
    ? {}
    : panelStyle
      ? { top: panelStyle.top, left: panelStyle.left, transform: panelStyle.openUpward ? "translateY(-100%)" : undefined }
      : { visibility: "hidden" };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-label={t(lang, "datepicker.openCalendar")}
        onClick={() => (open ? closePanel() : openPanel())}
        onKeyDown={(e) => {
          if (!open && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openPanel();
          }
        }}
        className="cabinet-datepicker-trigger"
      >
        <span className={displayText ? "cabinet-datepicker-trigger-text" : "cabinet-datepicker-trigger-text--placeholder"}>
          {displayText || placeholder || t(lang, "datepicker.placeholder")}
        </span>
        <CalendarIcon size={18} aria-hidden="true" className="cabinet-datepicker-icon" />
      </button>
      <input type="hidden" name={name} value={iso} />

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {isMobile && <div className="cabinet-datepicker-backdrop" onClick={() => closePanel(false)} />}
            <div
              ref={panelRef}
              role="dialog"
              aria-label={t(lang, "datepicker.dialogLabel")}
              id={dialogId}
              className={`cabinet-datepicker-popover ${Z_MODAL} ${isMobile ? "cabinet-datepicker-popover--sheet" : ""}`}
              style={popoverStyle}
            >
              {view === "days" && (
                <>
                  <div className="cabinet-datepicker-header">
                    <button
                      type="button"
                      aria-label={t(lang, "datepicker.prevMonth")}
                      onClick={() => setViewDate((d) => addMonths(d, -1))}
                      className="cabinet-datepicker-nav"
                    >
                      <ChevronLeft size={18} aria-hidden="true" />
                    </button>
                    <button type="button" className="cabinet-datepicker-label" onClick={() => setView("months")}>
                      {monthLabel}
                    </button>
                    <button
                      type="button"
                      aria-label={t(lang, "datepicker.nextMonth")}
                      onClick={() => setViewDate((d) => addMonths(d, 1))}
                      className="cabinet-datepicker-nav"
                    >
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="cabinet-datepicker-weekdays">
                    {weekdayLabels.map((w, i) => (
                      <span key={i}>{w}</span>
                    ))}
                  </div>
                  <div className="cabinet-datepicker-days" role="grid" onKeyDown={onDayKeyDown}>
                    {monthCells.map((date) => {
                      const key = toIso(date);
                      const outside = date.getMonth() !== viewDate.getMonth();
                      const disabled = isDisabled(date);
                      const isSelected = isSameDay(date, selected);
                      const isToday = isSameDay(date, new Date());
                      const isFocusable = isSameDay(date, focusedDate);
                      return (
                        <button
                          key={key}
                          type="button"
                          ref={(el) => {
                            if (el) dayRefs.current.set(key, el);
                            else dayRefs.current.delete(key);
                          }}
                          role="gridcell"
                          tabIndex={isFocusable ? 0 : -1}
                          aria-selected={isSelected}
                          aria-current={isToday ? "date" : undefined}
                          disabled={disabled}
                          onClick={() => selectDate(date)}
                          onFocus={() => setFocusedDate(date)}
                          className={[
                            "cabinet-datepicker-day",
                            outside ? "cabinet-datepicker-day--outside" : "",
                            isToday && !isSelected ? "cabinet-datepicker-day--today" : "",
                            isSelected ? "cabinet-datepicker-day--selected" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {view === "months" && (
                <>
                  <div className="cabinet-datepicker-header">
                    <button
                      type="button"
                      aria-label={t(lang, "datepicker.prevMonth")}
                      onClick={() => setViewDate((d) => new Date(d.getFullYear() - 1, d.getMonth(), 1))}
                      className="cabinet-datepicker-nav"
                    >
                      <ChevronLeft size={18} aria-hidden="true" />
                    </button>
                    <button type="button" className="cabinet-datepicker-label" onClick={() => setView("years")}>
                      {viewDate.getFullYear()}
                    </button>
                    <button
                      type="button"
                      aria-label={t(lang, "datepicker.nextMonth")}
                      onClick={() => setViewDate((d) => new Date(d.getFullYear() + 1, d.getMonth(), 1))}
                      className="cabinet-datepicker-nav"
                    >
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="cabinet-datepicker-months">
                    {monthGridMonths.map((m, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`cabinet-datepicker-month ${
                          i === viewDate.getMonth() ? "cabinet-datepicker-month--selected" : ""
                        }`}
                        onClick={() => {
                          setViewDate(new Date(viewDate.getFullYear(), i, 1));
                          setView("days");
                        }}
                      >
                        {monthShort(m)}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {view === "years" && (
                <div className="cabinet-datepicker-years" ref={yearsListRef}>
                  {yearRange.map((y) => (
                    <button
                      key={y}
                      type="button"
                      data-year={y}
                      className={`cabinet-datepicker-year ${
                        y === viewDate.getFullYear() ? "cabinet-datepicker-year--selected" : ""
                      }`}
                      onClick={() => {
                        setViewDate(new Date(y, viewDate.getMonth(), 1));
                        setView("months");
                      }}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}

              <div className="cabinet-datepicker-footer">
                <button type="button" className="cabinet-datepicker-link" onClick={clear}>
                  {t(lang, "datepicker.clear")}
                </button>
                <button
                  type="button"
                  className="cabinet-datepicker-link"
                  onClick={goToday}
                  disabled={isDisabled(new Date())}
                >
                  {t(lang, "datepicker.today")}
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
