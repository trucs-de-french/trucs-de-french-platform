import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { AchievementState } from "@/lib/cabinet/achievements";
import { pickCompactAchievements } from "@/lib/cabinet/achievements";
import { AchievementBadge } from "@/components/cabinet/home/achievement-badge";
import { CardTitle } from "@/components/cabinet/card-title";
import { CabinetPillLink } from "@/components/cabinet/pill-link";

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>{t(lang, "progress.achievements.title")}</CardTitle>
        <CabinetPillLink href="/cabinet/achievements" label={t(lang, "home.achievements.all")} />
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
