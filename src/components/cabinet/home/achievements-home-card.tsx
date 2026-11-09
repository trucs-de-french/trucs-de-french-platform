import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { AchievementState } from "@/lib/cabinet/achievements";
import { AchievementBadge } from "@/components/cabinet/achievement-badge";
import { CardTitle } from "@/components/cabinet/card-title";

export function AchievementsHomeCard({ lang, items }: { lang: UiLang; items: AchievementState[] }) {
  const nextGoal = items.find((a) => !a.earned && a.current > 0);
  const nextPercent = nextGoal ? Math.min(100, Math.round((100 * nextGoal.current) / nextGoal.threshold)) : 0;

  return (
    <div className="cabinet-card flex h-full flex-col justify-center gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{t(lang, "home.achievements.title")}</CardTitle>
        <Link
          href="/cabinet/progress#achievements"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--cabinet-link)] dark:hover:underline dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)]"
        >
          {t(lang, "home.achievements.all")}
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--cabinet-muted)]">{t(lang, "home.achievements.empty")}</p>
      ) : (
        <>
          <div className="achievement-badge-row">
            {items.map((achievement) => (
              <div key={achievement.id} className="achievement-badge-slot">
                <AchievementBadge lang={lang} achievement={achievement} size={72} />
              </div>
            ))}
          </div>
          {nextGoal && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-[var(--cabinet-muted)]">
                {t(lang, "home.achievements.next", {
                  name: t(lang, nextGoal.nameKey),
                  current: nextGoal.current,
                  target: nextGoal.threshold,
                })}
              </p>
              <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--cabinet-track)]">
                <div className="h-full rounded-full" style={{ width: `${nextPercent}%`, background: "#e0aa3e" }} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
