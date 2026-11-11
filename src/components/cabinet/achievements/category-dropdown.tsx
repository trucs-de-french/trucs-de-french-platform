"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { AchievementCategory } from "@/lib/cabinet/achievements";
import { CATEGORY_ICON, CATEGORY_LABEL_KEY } from "@/lib/cabinet/achievement-ui";

export type CategoryDropdownOption = {
  category: AchievementCategory | null;
  earned: number;
  total: number;
};

// Кастомний dropdown замість рядка чипів-фільтрів (full-achievements.tsx,
// /cabinet/achievements) — лише подання: вибір і далі йде через той самий
// onSelect/selectCategory (URL ?cat=), жодної власної фільтруючої логіки
// тут. aria-activedescendant (не переміщення DOM-фокуса між <li>) —
// фокус лишається на самому списку, стрілки лише рухають "активний"
// індекс, підсвічений класом і оголошений через aria-activedescendant.
//
// Іконка/назва — прямий lookup у CATEGORY_ICON (як achievement-badge.tsx),
// не через хелпер-функцію: react-hooks/static-components хибно позначає
// capitalized-змінну, що приходить із ВИКЛИКУ функції, як "компонент,
// створений під час рендеру" — пряме індексування об'єкта цю евристику
// не зачіпає.
function categoryLabel(lang: UiLang, category: AchievementCategory | null): string {
  return category ? t(lang, CATEGORY_LABEL_KEY[category]) : t(lang, "achievements.filter.all");
}

const MENU_MAX_HEIGHT = 380;

export function CategoryDropdown({
  lang,
  options,
  selected,
  onSelect,
}: {
  lang: UiLang;
  options: CategoryDropdownOption[];
  selected: AchievementCategory | null;
  onSelect: (category: AchievementCategory | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [openUpward, setOpenUpward] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();

  const selectedIndex = Math.max(0, options.findIndex((o) => o.category === selected));
  const current = options[selectedIndex] ?? options[0];
  const currentCategory = current?.category ?? null;
  const CurrentIcon = currentCategory ? CATEGORY_ICON[currentCategory] : LayoutGrid;
  const currentLabel = categoryLabel(lang, currentCategory);

  useEffect(() => {
    if (!open) return;
    // Синхронізація "активного" (підсвіченого клавіатурою) індексу з
    // поточним вибором КОЖНОГО разу, коли меню відкривається (не лише
    // при mount) — навмисний ре-синк на подію "відкрито", не циклічний
    // рендер (ефект виходить одразу, щойно active вже = selectedIndex).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(selectedIndex);
    const trigger = triggerRef.current;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      // На мобільному (<640px, той самий брейкпоінт, що в globals.css)
      // фіксована нижня навігація (.cabinet-bottom-bar) перекриває частину
      // в'юпорта — віднімаємо її висоту з доступного простору знизу, інакше
      // меню могло б відкритись "вниз" під неї замість вгору.
      const isMobile = window.innerWidth < 640;
      const barHeight = isMobile
        ? parseFloat(getComputedStyle(trigger).getPropertyValue("--cabinet-bottom-bar-height")) || 0
        : 0;
      const effectiveMaxHeight = Math.min(MENU_MAX_HEIGHT, window.innerHeight * 0.6);
      const spaceBelow = window.innerHeight - rect.bottom - barHeight;
      setOpenUpward(spaceBelow < effectiveMaxHeight && rect.top > spaceBelow);
    }
    listRef.current?.focus();
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function closeMenu(focusTrigger: boolean) {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }

  function choose(index: number) {
    const opt = options[index];
    if (!opt) return;
    onSelect(opt.category);
    closeMenu(true);
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function handleListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(activeIndex);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
    } else if (e.key === "Tab") {
      closeMenu(false);
    }
  }

  return (
    <div className="achievements-category-dropdown" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="achievements-category-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="achievements-category-trigger-icon">
          <CurrentIcon size={18} strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="achievements-category-trigger-text">
          <span className="achievements-category-trigger-label">{t(lang, "achievements.category.label")}</span>
          <span className="achievements-category-trigger-name">{currentLabel}</span>
        </span>
        {current && (
          <span className="achievements-category-trigger-count">
            {current.earned}/{current.total}
          </span>
        )}
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`achievements-category-trigger-chevron ${open ? "achievements-category-trigger-chevron--open" : ""}`}
        />
      </button>
      {open && (
        <div
          className={`achievements-category-menu ${openUpward ? "achievements-category-menu--up" : ""}`}
        >
          <ul
            ref={listRef}
            role="listbox"
            tabIndex={0}
            aria-activedescendant={`${baseId}-${activeIndex}`}
            className="achievements-category-menu-scroll themed-scroll"
            onKeyDown={handleListKeyDown}
          >
            {options.map((opt, index) => {
            const Icon = opt.category ? CATEGORY_ICON[opt.category] : LayoutGrid;
            const label = categoryLabel(lang, opt.category);
            const isSelected = opt.category === selected;
            const isActive = index === activeIndex;
            const pct = opt.total > 0 ? Math.min(100, (opt.earned / opt.total) * 100) : 0;
            return (
              <li
                key={opt.category ?? "all"}
                id={`${baseId}-${index}`}
                role="option"
                aria-selected={isSelected}
                className={[
                  "achievements-category-option",
                  isSelected ? "achievements-category-option--selected" : "",
                  isActive ? "achievements-category-option--focused" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(index)}
              >
                <span className="achievements-category-option-icon">
                  <Icon size={18} strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="achievements-category-option-text">
                  <span className="achievements-category-option-name">{label}</span>
                  <span className="achievements-category-option-track">
                    <span className="achievements-category-option-fill" style={{ width: `${pct}%` }} />
                  </span>
                </span>
                <span className="achievements-category-option-count">
                  {opt.earned}/{opt.total}
                </span>
              </li>
            );
          })}
          </ul>
        </div>
      )}
    </div>
  );
}
