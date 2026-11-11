"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { computeBadges, pickHomeAchievements, type BadgeStats, type EarnedAtById } from "@/lib/cabinet/achievements";
import { AchievementBadge } from "@/components/cabinet/home/achievement-badge";
import { CardTitle } from "@/components/cabinet/card-title";
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
    <div className="cabinet-card flex flex-col gap-[14px] p-[22px_26px_20px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>{t(lang, "home.achievements.title")}</CardTitle>
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
          <div className="achievement-badge-slot achievement-badge-all-slot">
            <Link
              href="/cabinet/achievements"
              aria-label={t(lang, "home.achievements.all")}
              title={t(lang, "home.achievements.all")}
              className="achievement-badge-all-link"
            >
              <span className="achievement-badge-all-circle">
                <ArrowRight size={22} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <span className="achievement-badge-all-label">{t(lang, "home.achievements.all")}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
