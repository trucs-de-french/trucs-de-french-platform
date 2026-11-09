import Link from "next/link";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { SceneResultRow } from "@/lib/cabinet/progress-data";

const MAX_ROWS = 6;

export function SceneResults({ lang, items }: { lang: UiLang; items: SceneResultRow[] }) {
  const shown = items.slice(0, MAX_ROWS);

  return (
    <div className="cabinet-card flex h-full flex-col gap-3 p-5">
      <h3 className="font-body text-xl font-semibold text-[var(--cabinet-ink)]">
        {t(lang, "progress.scenes.title")}
      </h3>
      {shown.length === 0 ? (
        <p className="flex-1 text-sm text-[var(--cabinet-muted)]">{t(lang, "progress.scenes.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((row) => (
            <li key={row.sceneId} className="flex flex-col gap-1.5 border-b border-[var(--cabinet-line)] pb-3 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-body text-sm font-semibold text-[var(--cabinet-ink)]">
                  {row.title}
                </span>
                <span className="whitespace-nowrap rounded-full bg-[var(--cabinet-surface-2)] px-2.5 py-1 text-xs font-bold text-[var(--cabinet-ink)]">
                  {row.pointsEarned} / {row.pointsPossible}
                </span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-[var(--cabinet-track)]"
                role="progressbar"
                aria-valuenow={row.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={row.title}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, row.percent)}%`,
                    background: row.needsRedo
                      ? "linear-gradient(135deg, #f6dc8e, #e0aa3e)"
                      : "var(--cabinet-primary)",
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--cabinet-muted)]">{row.percent}%</span>
                <Link
                  href={row.href}
                  className="inline-flex min-h-9 shrink-0 items-center text-xs font-bold text-[var(--cabinet-link)] dark:hover:underline dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)]"
                >
                  {row.needsRedo ? t(lang, "progress.scenes.redo") : t(lang, "progress.scenes.view")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
