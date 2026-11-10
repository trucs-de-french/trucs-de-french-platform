"use client";

// Грід круглих опцій маскота — auto-fill колонками (64px коло, 12px gap).
// У згорнутому стані видно лише ПЕРШИЙ рядок; решта — в окремій обгортці
// (.settings-mascot-extra), що анімовано розкривається через grid-
// template-rows 0fr→1fr ("accordion" трюк: висота рахується самим CSS,
// не JS-виміром scrollHeight) і отримує `inert`, поки згорнута — не лише
// overflow:hidden (той сам по собі не прибирає фокус/озвучення
// скрін-рідером). Кількість колонок рахує ResizeObserver на гріді (не
// медіа-запит — ширина картки/сайдбару змінна). Кожна опція рендерить ту
// саму ProfileAvatar, що й сам аватар-прев'ю.
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { MASCOTS, type Mascot } from "@/lib/cabinet/mascots";
import { ProfileAvatar } from "@/components/cabinet/profile-avatar";

const OPTION_SIZE = 64;
const GRID_GAP = 12;
const EXTRA_ID = "settings-mascot-extra";

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
  const [columns, setColumns] = useState(6);
  const [expanded, setExpanded] = useState(false);
  const autoExpandedRef = useRef(false);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth;
      const cols = Math.max(1, Math.floor((width + GRID_GAP) / (OPTION_SIZE + GRID_GAP)));
      setColumns(cols);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
      >
        <ProfileAvatar
          name=""
          size={OPTION_SIZE}
          mascotId={mascot.id}
          alt={mascot.label}
          loading={lazy ? "lazy" : "eager"}
        />
      </button>
    );
  }

  // Фіксовані 64px-колонки + justify-start (не minmax(..,1fr) +
  // justify-items-center): так і перший рядок, і розгорнуті рядки
  // рахують КІЛЬКІСТЬ колонок однаково (ResizeObserver стежить саме за
  // шириною цього гріда) і вирівняні по лівому краю, без розтягування
  // останньої неповної колонки.
  // gridAutoRows fixe рядки на 64px (не auto за вмістом) — без цього
  // align-items:stretch (дефолт grid) розтягнув би кнопку-опцію по
  // висоті клітинки, знову роблячи коло овалом.
  const gridStyle = { gridTemplateColumns: `repeat(auto-fill, ${OPTION_SIZE}px)`, gridAutoRows: `${OPTION_SIZE}px` };

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
