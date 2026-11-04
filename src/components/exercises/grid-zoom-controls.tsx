"use client";

import { Minus, Plus } from "lucide-react";
import { DEFAULT_ZOOM, ZOOM_STEPS, MIN_ZOOM, MAX_ZOOM } from "./use-grid-zoom";
import { useT } from "@/lib/i18n/context";

// Допуск 0.5% — той самий, що задача задає для і "+"/"−", і disabled-стану:
// поточний zoom після pinch (use-pinch-zoom.ts) — довільне число (напр.
// 1.16), не точка ZOOM_STEPS, тож індекс (ZOOM_STEPS.indexOf) раніше
// завжди повертав -1 і псував і логіку кроку, і disabled. Кроки нижче
// шукаються ВІД поточного значення напряму (найближчий більший/менший
// ЕЛЕМЕНТ масиву), а не через індекс — працює для БУДЬ-якого zoom,
// включно зі значеннями pinch, без зміни десктопної поведінки (на
// дискретних кроках результат той самий, що й раніше).
const ZOOM_EPSILON = 0.005;

// Округлення результату до тієї самої точності, що лейбл (Math.round(zoom
// * 100) — цілий відсоток): ZOOM_STEPS і MIN_ZOOM/MAX_ZOOM уже рівно на
// цій точності, тож це здебільшого no-op, але задача явно просить
// округлювати результат, а не лише читати значення.
function roundToLabelPrecision(value: number): number {
  return Math.round(value * 100) / 100;
}

// Найменший крок СТРОГО більший за поточний zoom (+epsilon), АЛЕ не вище
// maxZoom (задача "прибрати режим 200% на десктопі" — на десктопі maxZoom
// = DESKTOP_MAX_ZOOM=1.5, тож крок 2 зі ZOOM_STEPS тут просто ніколи не
// повертається) — якщо нема кроку в межах, сам maxZoom. ZOOM_STEPS уже
// впорядкований зростаюче (use-grid-zoom.ts).
function nextZoomStepUp(current: number, maxZoom: number): number {
  for (const step of ZOOM_STEPS) {
    if (step > current + ZOOM_EPSILON && step <= maxZoom + ZOOM_EPSILON) return roundToLabelPrecision(step);
  }
  return roundToLabelPrecision(maxZoom);
}

// Найбільший крок СТРОГО менший за поточний zoom (-epsilon) — якщо нема,
// MIN_ZOOM. Перебір у зворотному порядку — перше знайдене вже найбільше.
function nextZoomStepDown(current: number): number {
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    const step = ZOOM_STEPS[i];
    if (step < current - ZOOM_EPSILON) return roundToLabelPrecision(step);
  }
  return roundToLabelPrecision(MIN_ZOOM);
}

// Панель масштабу сітки (−/відсоток/+), спільна для word_search і
// crossword. onMouseDown preventDefault на кожній кнопці — клік не забирає
// фокус з активної клітинки (кросворд), той самий прийом, що в
// DiacriticsPopup.
// Мокап "варіант 1" — тепер у правому слоті інфо-рядка TaskPanelHeader
// (task-panel-header.tsx, .task-panel-controls-right), НЕ окремим рядком
// над вправою: 32px-високі кнопки з золотою тонкою рамкою (той самий
// токен rgba(217,183,101,.55), що пілюля-підказка) замість попередніх
// 40×40 сірих — стиль живе тут, у спільному компоненті, а не в CSS-
// оверрайді лише для word_search (.ws-zoom button, видалений із
// globals.css), тож crossword отримує той самий вигляд безкоштовно.
export function GridZoomControls({
  zoom,
  onChange,
  maxZoom = MAX_ZOOM,
}: {
  zoom: number;
  onChange: (zoom: number) => void;
  // Задача "прибрати режим 200% на десктопі" — useGridZoom передає
  // DESKTOP_MAX_ZOOM (1.5) на >640px, повний MAX_ZOOM (2, 200%) на
  // мобільному; дефолт тут лишається MAX_ZOOM для будь-якого майбутнього
  // викликача, що не передасть пропс явно.
  maxZoom?: number;
}) {
  const { t } = useT();
  // disabled — за САМИМ значенням zoom відносно MIN_ZOOM/maxZoom
  // (+/-epsilon), ніколи за тим, чи zoom лежить рівно на кроці: під час
  // pinch (довільні проміжні значення, use-pinch-zoom.ts) це лишається
  // коректним і живим на кожен ре-рендер (zoom — пропс, не внутрішній
  // стан), бо тут немає жодного .indexOf/кешованого індексу.
  const atMin = zoom <= MIN_ZOOM + ZOOM_EPSILON;
  const atMax = zoom >= maxZoom - ZOOM_EPSILON;
  const buttonClass =
    "flex h-8 w-8 items-center justify-center rounded-md border border-[rgba(217,183,101,0.55)] bg-white text-[#1f1d3a] shadow-[0_1px_2px_rgba(184,144,47,0.12)] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[rgba(243,217,139,0.28)] dark:bg-[var(--dark-surface-fill)] dark:text-[#f6dc8e] dark:hover:bg-[#1e234e]";
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={t("button.zoomOutAria")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onChange(nextZoomStepDown(zoom))}
        disabled={atMin}
        className={buttonClass}
      >
        <Minus size={16} aria-hidden />
      </button>
      <button
        type="button"
        aria-label={t("button.zoomResetAria")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onChange(DEFAULT_ZOOM)}
        className={`${buttonClass} w-auto min-w-[3.25rem] px-2 font-heading text-sm font-medium`}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        aria-label={t("button.zoomInAria")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onChange(nextZoomStepUp(zoom, maxZoom))}
        disabled={atMax}
        className={buttonClass}
      >
        <Plus size={16} aria-hidden />
      </button>
    </div>
  );
}
