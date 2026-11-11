"use client";

import { useState } from "react";
import Link from "next/link";
import { Film } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { SceneResultRow } from "@/lib/cabinet/progress-data";
import { CardTitle } from "@/components/cabinet/card-title";

const INITIAL_ROWS = 5;

const LOCALE_BY_LANG: Record<UiLang, string> = { uk: "uk-UA", fr: "fr-FR", en: "en-US" };

function formatLastActivity(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "Europe/Kyiv" }).format(
    new Date(iso)
  );
}

const RING_SIZE = 54;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function SceneRing({ percent, label }: { percent: number; label: string }) {
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
        stroke="#d9b765"
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
        fontFamily="var(--font-heading)"
        fontWeight={800}
        fontSize={13}
        fill="var(--cabinet-ink)"
      >
        {percent}%
      </text>
    </svg>
  );
}

export function SceneResults({ lang, items }: { lang: UiLang; items: SceneResultRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const locale = LOCALE_BY_LANG[lang];
  const shown = expanded ? items : items.slice(0, INITIAL_ROWS);

  return (
    <div className="cabinet-card flex h-full flex-col gap-3 p-5">
      <CardTitle>{t(lang, "progress.scenes.title")}</CardTitle>
      {shown.length === 0 ? (
        <p className="flex-1 text-sm text-[var(--cabinet-muted)]">{t(lang, "progress.scenes.empty")}</p>
      ) : (
        <>
          <ul className="flex flex-col">
            {shown.map((row, idx) => {
              const meta = row.lastActivity
                ? `${row.productTitle} · ${formatLastActivity(row.lastActivity, locale)}`
                : row.productTitle;
              return (
                <li
                  key={row.sceneId}
                  className={`cabinet-scene-row ${idx > 0 ? "cabinet-fade-divider" : ""}`}
                >
                  {row.productCoverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.productCoverUrl} alt="" className="cabinet-scene-thumb" />
                  ) : (
                    <div className="cabinet-scene-thumb cabinet-scene-thumb-fallback">
                      <Film size={20} strokeWidth={2} color="#f3d98b" aria-hidden="true" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="cabinet-scene-title truncate">{row.title}</div>
                    <div className="cabinet-scene-meta truncate">{meta}</div>
                  </div>
                  <div className="cabinet-scene-trailing">
                    <span className="cabinet-scene-score">
                      {row.pointsEarned} / {row.pointsPossible}
                    </span>
                    <SceneRing percent={row.percent} label={row.title} />
                    <Link href={row.href} className="cabinet-scene-link">
                      {row.needsRedo ? t(lang, "progress.scenes.redo") : t(lang, "progress.scenes.view")}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
          {!expanded && items.length > INITIAL_ROWS && (
            <button type="button" onClick={() => setExpanded(true)} className="cabinet-scene-more">
              {t(lang, "progress.scenes.showMore")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
