import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { AchievementState } from "@/lib/cabinet/achievements";
import { AchievementBadge } from "@/components/cabinet/home/achievement-badge";
import { CardTitle } from "@/components/cabinet/card-title";
import { CabinetPillLink } from "@/components/cabinet/pill-link";

export function AchievementsHomeCard({ lang, items }: { lang: UiLang; items: AchievementState[] }) {
  return (
    <div className="cabinet-card flex h-full flex-col justify-center gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>{t(lang, "home.achievements.title")}</CardTitle>
        <CabinetPillLink href="/cabinet/achievements" label={t(lang, "home.achievements.all")} />
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
