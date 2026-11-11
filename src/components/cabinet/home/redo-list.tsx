import Link from "next/link";
import { RotateCcw, ArrowRight } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { RedoItem } from "@/lib/cabinet/home-data";
import { CardTitle } from "@/components/cabinet/card-title";

const MAX_VISIBLE = 3;

export function RedoList({ lang, items, totalCount }: { lang: UiLang; items: RedoItem[]; totalCount: number }) {
  const visible = items.slice(0, MAX_VISIBLE);
  return (
    <div className="cabinet-card flex h-full flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{t(lang, "home.redo.title")}</CardTitle>
        {totalCount > MAX_VISIBLE && (
          <Link
            href="/cabinet/mistakes"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--cabinet-link)] dark:hover:underline dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)]"
          >
            {t(lang, "home.redo.all")}
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        )}
      </div>
      {visible.length === 0 ? (
        <p className="flex-1 text-sm text-[var(--cabinet-muted)]">{t(lang, "home.redo.empty")}</p>
      ) : (
        <ul className="flex flex-col">
          {visible.map((item) => {
            const redoLabel = t(lang, "home.redo.action");
            return (
              <li key={item.taskId} className="cabinet-redo-row">
                <span
                  className="cabinet-redo-tile flex shrink-0 items-center justify-center rounded-xl text-[var(--cabinet-on-gold)]"
                  style={{ background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                </span>
                <div className="cabinet-redo-text">
                  <div className="cabinet-redo-title">{item.taskTypeName}</div>
                  <div className="cabinet-redo-subtitle">{item.sceneLabel}</div>
                </div>
                <span className="cabinet-redo-score">
                  {item.pointsEarned} / {item.pointsPossible}
                </span>
                <Link
                  href={item.href}
                  aria-label={redoLabel}
                  title={redoLabel}
                  className="cabinet-redo-arrow-btn"
                >
                  <ArrowRight strokeWidth={2.4} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
