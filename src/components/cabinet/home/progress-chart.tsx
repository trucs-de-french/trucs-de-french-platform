import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { PointsByDay } from "@/lib/cabinet/home-data";
import { CardTitle } from "@/components/cabinet/card-title";

const LOCALE_BY_LANG: Record<UiLang, string> = { uk: "uk-UA", fr: "fr-FR", en: "en-US" };

const WIDTH = 280;
const HEIGHT = 120;
const PAD_X = 10;
const PAD_TOP = 24;
const PAD_BOTTOM = 20;

export function ProgressChart({ lang, data }: { lang: UiLang; data: PointsByDay[] }) {
  const max = Math.max(...data.map((d) => d.points), 0);

  if (data.length === 0 || max <= 0) {
    return (
      <div className="cabinet-card flex h-full flex-col gap-3 p-5">
        <CardTitle>{t(lang, "home.chart.title")}</CardTitle>
        <p className="flex-1 text-sm text-[var(--cabinet-muted)]">{t(lang, "home.chart.empty")}</p>
      </div>
    );
  }

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
  const locale = LOCALE_BY_LANG[lang];

  return (
    <div className="cabinet-card flex h-full flex-col gap-3 p-5">
      <h3 className="font-body text-xl font-semibold text-[var(--cabinet-ink)]">
        {t(lang, "home.chart.title")}
      </h3>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={t(lang, "home.chart.title")}
      >
        <defs>
          <linearGradient id="cabinet-chart-fill" x1="0" y1="0" x2="0" y2="1">
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
        <path d={areaPath} fill="url(#cabinet-chart-fill)" stroke="none" />
        <path d={linePath} fill="none" stroke="#5a55e6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={maxPoint.x} cy={maxPoint.y} r={4} fill="#e0aa3e" stroke="#f6dc8e" strokeWidth={1.5} />
        <text
          x={Math.min(Math.max(maxPoint.x, PAD_X + 14), WIDTH - PAD_X - 14)}
          y={Math.max(maxPoint.y - 10, 10)}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fill="var(--cabinet-ink)"
        >
          {maxPoint.points}
        </text>
        {points.map((p) => (
          <text
            key={p.date}
            x={p.x}
            y={HEIGHT - 4}
            textAnchor="middle"
            fontSize={9}
            fill="var(--cabinet-muted)"
          >
            {new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "Europe/Kyiv" }).format(
              new Date(`${p.date}T12:00:00Z`)
            )}
          </text>
        ))}
      </svg>
    </div>
  );
}
