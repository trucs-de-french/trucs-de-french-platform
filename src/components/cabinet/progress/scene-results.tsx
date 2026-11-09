import Link from "next/link";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { SceneResultRow } from "@/lib/cabinet/progress-data";
import { CardTitle } from "@/components/cabinet/card-title";

const MAX_ROWS = 6;

const RING_SIZE = 52;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function SceneRing({ percent, needsRedo, label }: { percent: number; needsRedo: boolean; label: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = RING_CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <svg
      width={RING_SIZE}
      height={RING_SIZE}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      className="shrink-0"
      role="img"
      aria-label={`${label}: ${percent}%`}
    >
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke="var(--cabinet-track)"
        strokeWidth={RING_STROKE}
      />
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke={needsRedo ? "var(--cabinet-gold)" : "var(--cabinet-primary)"}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={12}
        fontWeight={700}
        fill="var(--cabinet-ink)"
      >
        {percent}%
      </text>
    </svg>
  );
}

export function SceneResults({ lang, items }: { lang: UiLang; items: SceneResultRow[] }) {
  const shown = items.slice(0, MAX_ROWS);

  return (
    <div className="cabinet-card flex h-full flex-col gap-3 p-5">
      <CardTitle>{t(lang, "progress.scenes.title")}</CardTitle>
      {shown.length === 0 ? (
        <p className="flex-1 text-sm text-[var(--cabinet-muted)]">{t(lang, "progress.scenes.empty")}</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((row) => (
            <li
              key={row.sceneId}
              className="flex flex-wrap items-center gap-3 border-t border-[var(--cabinet-line)] py-3 first:border-t-0 first:pt-0"
            >
              <SceneRing percent={row.percent} needsRedo={row.needsRedo} label={row.title} />
              <div className="min-w-0 flex-1 basis-40">
                <div className="truncate font-body text-sm font-semibold text-[var(--cabinet-ink)]">
                  {row.title}
                </div>
                <div className="text-xs text-[var(--cabinet-muted)]">
                  {row.pointsEarned} / {row.pointsPossible}
                </div>
              </div>
              <Link
                href={row.href}
                className="inline-flex min-h-9 shrink-0 items-center text-xs font-bold text-[var(--cabinet-link)] dark:hover:underline dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)]"
              >
                {row.needsRedo ? t(lang, "progress.scenes.redo") : t(lang, "progress.scenes.view")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
