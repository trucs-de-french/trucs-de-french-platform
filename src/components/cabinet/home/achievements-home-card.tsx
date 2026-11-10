import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { AchievementState } from "@/lib/cabinet/achievements";
import { AchievementBadge } from "@/components/cabinet/home/achievement-badge";
import { CardTitle } from "@/components/cabinet/card-title";

export function AchievementsHomeCard({ lang, items }: { lang: UiLang; items: AchievementState[] }) {
  return (
    <div className="cabinet-card flex h-full flex-col justify-center gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{t(lang, "home.achievements.title")}</CardTitle>
        <Link
          href="/cabinet/achievements"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--cabinet-link)] dark:hover:underline dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)]"
        >
          {t(lang, "home.achievements.all")}
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--cabinet-muted)]">{t(lang, "home.achievements.empty")}</p>
      ) : (
        <div className="achievement-badge-row">
          {items.map((achievement) => (
            <div key={achievement.id} className="achievement-badge-slot">
              <AchievementBadge lang={lang} achievement={achievement} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
