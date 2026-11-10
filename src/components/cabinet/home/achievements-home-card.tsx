"use client";

import { useMemo } from "react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { computeBadges, pickHomeAchievements, type BadgeStats, type EarnedAtById } from "@/lib/cabinet/achievements";
import { AchievementBadge } from "@/components/cabinet/home/achievement-badge";
import { CardTitle } from "@/components/cabinet/card-title";
import { CabinetPillLink } from "@/components/cabinet/pill-link";
import { useAdminPreview } from "@/lib/cabinet/admin-preview";

// Картка "Останні досягнення" на Home — items рахуються ТУТ (клієнтськи)
// з realStats через computeBadges(), щоб адмінський override
// (useAdminPreview, /admin/achievements-preview) міг підмінити вхідні
// дані без окремого шляху коду; для студента override завжди null.
export function AchievementsHomeCard({
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
  const picked = useMemo(() => pickHomeAchievements(items, showExamCard), [items, showExamCard]);

  return (
    <div className="cabinet-card flex h-full flex-col justify-center gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>{t(lang, "home.achievements.title")}</CardTitle>
        <CabinetPillLink href="/cabinet/achievements" label={t(lang, "home.achievements.all")} />
      </div>
      {picked.length === 0 ? (
        <p className="text-sm text-[var(--cabinet-muted)]">{t(lang, "home.achievements.empty")}</p>
      ) : (
        <div className="achievement-badge-row">
          {picked.map((achievement) => (
            <div key={achievement.id} className="achievement-badge-slot">
              <AchievementBadge lang={lang} achievement={achievement} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
