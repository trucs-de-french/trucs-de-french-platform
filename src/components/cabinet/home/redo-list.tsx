import Link from "next/link";
import { RotateCcw, ArrowRight } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { RedoItem } from "@/lib/cabinet/home-data";

export function RedoList({ lang, items }: { lang: UiLang; items: RedoItem[] }) {
  return (
    <div className="cabinet-card flex h-full flex-col gap-3 p-5">
      <h3 className="font-body text-xl font-semibold text-[var(--cabinet-ink)]">
        {t(lang, "home.redo.title")}
      </h3>
      {items.length === 0 ? (
        <p className="flex-1 text-sm text-[var(--cabinet-muted)]">{t(lang, "home.redo.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.taskId} className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--cabinet-on-gold)]"
                style={{ background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
              >
                <RotateCcw size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-body text-sm font-semibold text-[var(--cabinet-ink)]">
                  {item.taskTypeName}
                </div>
                <div className="truncate text-xs text-[var(--cabinet-muted)]">{item.sceneLabel}</div>
              </div>
              <span className="whitespace-nowrap rounded-full bg-[var(--cabinet-panel-bg)] px-2.5 py-1 text-xs font-bold text-[var(--cabinet-ink)]">
                {item.pointsEarned} / {item.pointsPossible}
              </span>
              <Link
                href={item.href}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold text-[var(--cabinet-primary)]"
              >
                {t(lang, "home.redo.action")}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
