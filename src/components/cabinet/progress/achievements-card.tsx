import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { AchievementState } from "@/lib/cabinet/achievements";
import { pickCompactAchievements } from "@/lib/cabinet/achievements";
import { AchievementBadge } from "@/components/cabinet/home/achievement-badge";
import { CardTitle } from "@/components/cabinet/card-title";

// Компактна картка на /cabinet/progress — лише один рядок бейджів
// (найбільше 8): здобуті найновіші першими, далі по одному найближчому
// нездобутому з кожної категорії. Повний список з чипами-фільтрами й
// зонами "Зароблено"/"Попереду" — на окремій сторінці /cabinet/achievements.
export function AchievementsCard({
  lang,
  items,
  showExamCard,
}: {
  lang: UiLang;
  items: AchievementState[];
  showExamCard: boolean;
}) {
  const badges: AchievementState[] = pickCompactAchievements(items, showExamCard, 8);

  return (
    <div className="cabinet-card flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{t(lang, "progress.achievements.title")}</CardTitle>
        <Link
          href="/cabinet/achievements"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--cabinet-link)] dark:hover:underline dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)]"
        >
          {t(lang, "home.achievements.all")}
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>
      {badges.length === 0 ? (
        <p className="text-sm text-[var(--cabinet-muted)]">{t(lang, "home.achievements.empty")}</p>
      ) : (
        <div className="achievements-compact-row">
          {badges.map((achievement) => (
            <AchievementBadge key={achievement.id} lang={lang} achievement={achievement} />
          ))}
        </div>
      )}
    </div>
  );
}
