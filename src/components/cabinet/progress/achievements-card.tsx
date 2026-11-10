"use client";

import { useMemo } from "react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { computeBadges, pickCompactAchievements, type BadgeStats, type EarnedAtById } from "@/lib/cabinet/achievements";
import { AchievementBadge } from "@/components/cabinet/home/achievement-badge";
import { CardTitle } from "@/components/cabinet/card-title";
import { CabinetPillLink } from "@/components/cabinet/pill-link";
import { useAdminPreview } from "@/lib/cabinet/admin-preview";

// Компактна картка на /cabinet/progress — лише один рядок бейджів
// (найбільше 8): здобуті найновіші першими, далі по одному найближчому
// нездобутому з кожної категорії. Повний список з чипами-фільтрами й
// зонами "Зароблено"/"Попереду" — на окремій сторінці /cabinet/achievements.
// items рахуються ТУТ (клієнтськи) з realStats, щоб адмінський override
// (useAdminPreview) міг підмінити вхідні дані без окремого шляху коду.
export function AchievementsCard({
  lang,
  realStats,
  earnedAtById,
  showExamCard,
}: {
  lang: UiLang;
  realStats: BadgeStats;
  earnedAtById: EarnedAtById;
  showExamCard: boolean;
}) {
  const { override } = useAdminPreview();
  const items = useMemo(
    () => computeBadges(override ?? realStats, showExamCard, override ? {} : earnedAtById),
    [override, realStats, showExamCard, earnedAtById]
  );
  const badges = useMemo(() => pickCompactAchievements(items, showExamCard, 8), [items, showExamCard]);

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
