"use client";

// Грід круглих опцій маскота. Desktop — auto-fill колонками фіксованого
// 64px кола (12px gap), кількість рахує ResizeObserver на гріді (не
// медіа-запит — ширина картки/сайдбару змінна). Mobile (<=639px) —
// РІВНО 4 колонки завжди (inline media query на window), коло саме
// рахує свій розмір під всю ширину гріда (а не фіксовані 64px, інакше
// на вузькій картці влазило лише 3 з порожнім місцем праворуч).
// У згорнутому стані видно лише ПЕРШИЙ рядок (під поточну кількість
// колонок); решта — в окремій обгортці (.settings-mascot-extra), що
// анімовано розкривається через grid-template-rows 0fr→1fr ("accordion"
// трюк: висота рахується самим CSS, не JS-виміром scrollHeight) і
// отримує `inert`, поки згорнута — не лише overflow:hidden (той сам по
// собі не прибирає фокус/озвучення скрін-рідером). Кожна опція рендерить
// ту саму ProfileAvatar, що й сам аватар-прев'ю.
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { MASCOTS, type Mascot } from "@/lib/cabinet/mascots";
import { ProfileAvatar } from "@/components/cabinet/profile-avatar";

const OPTION_SIZE = 64;
const GRID_GAP = 12;
const EXTRA_ID = "settings-mascot-extra";

// На мобільному (<=639px, той самий sm-брейкпоінт) — завжди РІВНО 4
// колонки на весь доступний ширини картки (а не вимір за фіксованим
// 64px-колом, який при вузькій картці рахував лише 3 і лишав порожнє
// місце праворуч): розмір кола тоді рахуємо сам, щоб 4 колонки з гапом
// GRID_GAP між ними точно займали всю ширину гріда, з верхньою межею
// OPTION_MAX_SIZE_MOBILE, щоб кола не виросли завеликими на ширших
// картках усередині цього ж брейкпоінта.
const MOBILE_BREAKPOINT = 639;
const MOBILE_COLUMNS = 4;
const OPTION_MAX_SIZE_MOBILE = 76;

export function MascotPicker({
  lang,
  selected,
  onSelect,
}: {
  lang: UiLang;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  // Початкова здогадка (6 колонок — колишній desktop-дефолт) лише для
  // першого пейнту до першого виміру ResizeObserver'ом (миттєво після
  // mount) — компонент і так клієнтський, SSR-значення не потрібне.
  const [desktopColumns, setDesktopColumns] = useState(6);
  const [mobileOptionSize, setMobileOptionSize] = useState(OPTION_MAX_SIZE_MOBILE);
  const [isMobile, setIsMobile] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const autoExpandedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth;
      const cols = Math.max(1, Math.floor((width + GRID_GAP) / (OPTION_SIZE + GRID_GAP)));
      setDesktopColumns(cols);
      const mobileSize = (width - (MOBILE_COLUMNS - 1) * GRID_GAP) / MOBILE_COLUMNS;
      setMobileOptionSize(Math.max(1, Math.min(OPTION_MAX_SIZE_MOBILE, Math.floor(mobileSize))));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const columns = isMobile ? MOBILE_COLUMNS : desktopColumns;
  const optionSize = isMobile ? mobileOptionSize : OPTION_SIZE;

  useEffect(() => {
    // Якщо обраний маскот НЕ в першому рядку — почати розгорнутим (один
    // раз, після першого реального виміру колонок), інакше обраний
    // елемент одразу ховався б за "Показати всіх".
    if (autoExpandedRef.current) return;
    const index = MASCOTS.findIndex((m) => m.id === selected);
    if (index >= columns) {
      autoExpandedRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- одноразова корекція стартового стану після виміру ResizeObserver, не цикл рендерів
      setExpanded(true);
    }
  }, [columns, selected]);

  const firstRow = MASCOTS.slice(0, columns);
  const rest = MASCOTS.slice(columns);
  const allFitOneRow = rest.length === 0;

  function renderOption(mascot: Mascot, lazy: boolean) {
    const isSelected = selected === mascot.id;
    return (
      <button
        key={mascot.id}
        type="button"
        onClick={() => onSelect(mascot.id)}
        aria-pressed={isSelected}
        aria-label={mascot.label}
        className={`settings-mascot-option ${isSelected ? "settings-mascot-option--selected" : ""}`}
        style={isMobile ? { width: optionSize, height: optionSize } : undefined}
      >
        <ProfileAvatar
          name=""
          size={optionSize}
          mascotId={mascot.id}
          alt={mascot.label}
          loading={lazy ? "lazy" : "eager"}
        />
      </button>
    );
  }

  // Desktop: фіксовані 64px-колонки + justify-start (не minmax(..,1fr) +
  // justify-items-center) — так і перший рядок, і розгорнуті рядки
  // рахують КІЛЬКІСТЬ колонок однаково (ResizeObserver стежить саме за
  // шириною цього гріда) і вирівняні по лівому краю, без розтягування
  // останньої неповної колонки.
  // Mobile (<=639px): рівно MOBILE_COLUMNS рівних колонок на всю ширину
  // (repeat(N, minmax(0,1fr))) — розмір кола тут рахує сам JS
  // (mobileOptionSize), тож колонки нічого не розтягують додатково.
  // gridAutoRows fixe рядки на розмір кола (не auto за вмістом) — без
  // цього align-items:stretch (дефолт grid) розтягнув би кнопку-опцію по
  // висоті клітинки, знову роблячи коло овалом.
  const gridStyle = isMobile
    ? { gridTemplateColumns: `repeat(${MOBILE_COLUMNS}, minmax(0, 1fr))`, gridAutoRows: `${optionSize}px` }
    : { gridTemplateColumns: `repeat(auto-fill, ${OPTION_SIZE}px)`, gridAutoRows: `${OPTION_SIZE}px` };

  return (
    <div className="flex w-full flex-col items-start gap-2">
      <div ref={gridRef} className="grid w-full items-start justify-start gap-3" style={gridStyle}>
        {firstRow.map((m) => renderOption(m, false))}
      </div>

      {!allFitOneRow && (
        <div
          id={EXTRA_ID}
          className={`settings-mascot-extra w-full ${expanded ? "settings-mascot-extra--expanded" : ""}`}
          inert={expanded ? undefined : true}
        >
          <div className="settings-mascot-extra-inner grid w-full items-start justify-start gap-3" style={gridStyle}>
            {rest.map((m) => renderOption(m, true))}
          </div>
        </div>
      )}

      {!allFitOneRow && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={EXTRA_ID}
          onClick={() => setExpanded((v) => !v)}
          className="settings-mascot-toggle"
        >
          {expanded ? (
            <>
              <ChevronUp size={16} aria-hidden="true" />
              {t(lang, "settings.mascot.collapse")}
            </>
          ) : (
            <>
              <ChevronDown size={16} aria-hidden="true" />
              {t(lang, "settings.mascot.showAll")}
            </>
          )}
        </button>
      )}
    </div>
  );
}
