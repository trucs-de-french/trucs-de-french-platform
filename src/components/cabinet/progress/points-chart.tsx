"use client";

import { useState } from "react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { PointsByDay } from "@/lib/cabinet/progress-data";
import { CardTitle } from "@/components/cabinet/card-title";

const LOCALE_BY_LANG: Record<UiLang, string> = { uk: "uk-UA", fr: "fr-FR", en: "en-US" };

const WIDTH = 560;
const HEIGHT = 180;
const PAD_X = 12;
const PAD_TOP = 28;
const PAD_BOTTOM = 22;

type Range = "week" | "month";

// Фіксований набір пілюль-перемикачів Тиждень/Місяць — ОБИДВА набори
// даних вже прилетіли з сервера (progress-data.ts рахує week+month одним
// проходом по activity_log), тож перемикання лише локальний useState,
// без жодного рефетчу/флікера.
export function PointsChart({
  lang,
  week,
  month,
}: {
  lang: UiLang;
  week: PointsByDay[];
  month: PointsByDay[];
}) {
  const [range, setRange] = useState<Range>("week");
  const data = range === "week" ? week : month;
  const max = Math.max(...data.map((d) => d.points), 0);
  const total = Math.round(data.reduce((sum, d) => sum + d.points, 0) * 10) / 10;
  const locale = LOCALE_BY_LANG[lang];

  const isEmpty = data.length === 0 || max <= 0;

  return (
    <div className="cabinet-card flex h-full flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{t(lang, "progress.chart.title")}</CardTitle>
        <div className="flex gap-1.5" role="group" aria-label={t(lang, "progress.chart.rangeLabel")}>
          {(["week", "month"] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={`min-h-9 rounded-full border px-3 text-xs font-bold ${
                range === r
                  ? "border-[1.5px] border-[var(--cabinet-pill-selected-border)] bg-[var(--cabinet-pill-selected-bg)] text-[var(--cabinet-pill-selected-fg)]"
                  : "border-[var(--cabinet-line)] text-[var(--cabinet-ink)] dark:bg-[var(--cabinet-surface-2)]"
              }`}
            >
              {t(lang, r === "week" ? "progress.chart.week" : "progress.chart.month")}
            </button>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <p className="flex-1 text-sm text-[var(--cabinet-muted)]">{t(lang, "progress.chart.empty")}</p>
      ) : (
        <PointsChartSvg
          data={data}
          locale={locale}
          range={range}
          ariaLabel={t(lang, "progress.chart.ariaLabel", { total })}
        />
      )}
    </div>
  );
}

function PointsChartSvg({
  data,
  locale,
  range,
  ariaLabel,
}: {
  data: PointsByDay[];
  locale: string;
  range: Range;
  ariaLabel: string;
}) {
  const max = Math.max(...data.map((d) => d.points), 0);
  const plotWidth = WIDTH - PAD_X * 2;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = PAD_X + stepX * i;
    const y = PAD_TOP + plotHeight * (1 - d.points / max);
    return { x, y, ...d };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${(PAD_TOP + plotHeight).toFixed(1)} L${points[0].x.toFixed(1)},${(PAD_TOP + plotHeight).toFixed(1)} Z`;

  const maxPoint = points.reduce((best, p) => (p.points > best.points ? p : best), points[0]);

  // Місяць (30 точок) — підпис лише що 5-й день + останній, інакше вісь
  // перетворюється на суцільну пляму тексту; тиждень (7 точок) — підпис
  // під кожною.
  function showLabel(i: number): boolean {
    if (range === "week") return true;
    return i === 0 || i === points.length - 1 || i % 5 === 0;
  }

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={ariaLabel}>
      <defs>
        <linearGradient id="cabinet-progress-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5a55e6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#5a55e6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1={PAD_X}
          x2={WIDTH - PAD_X}
          y1={PAD_TOP + (plotHeight / 3) * i}
          y2={PAD_TOP + (plotHeight / 3) * i}
          stroke="var(--cabinet-line)"
          strokeDasharray="3 4"
          strokeWidth={1}
        />
      ))}
      <path d={areaPath} fill="url(#cabinet-progress-chart-fill)" stroke="none" />
      <path d={linePath} fill="none" stroke="#5a55e6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={maxPoint.x} cy={maxPoint.y} r={4} fill="#e0aa3e" stroke="#f6dc8e" strokeWidth={1.5} />
      <text
        x={Math.min(Math.max(maxPoint.x, PAD_X + 16), WIDTH - PAD_X - 16)}
        y={Math.max(maxPoint.y - 10, 10)}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill="var(--cabinet-ink)"
      >
        {maxPoint.points}
      </text>
      {points.map((p, i) => (
        <text
          key={p.date}
          x={p.x}
          y={HEIGHT - 4}
          textAnchor="middle"
          fontSize={9}
          fill="var(--cabinet-muted)"
        >
          {showLabel(i)
            ? range === "week"
              ? new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "Europe/Kyiv" }).format(
                  new Date(`${p.date}T12:00:00Z`)
                )
              : new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "Europe/Kyiv" }).format(
                  new Date(`${p.date}T12:00:00Z`)
                )
            : ""}
        </text>
      ))}
    </svg>
  );
}
