// Три перемикачі сповіщень — частина dirty-стану settings-form.tsx (idem
// пояснення: наразі лише зберігають preference у profiles.notification_
// prefs, листи ще не надсилаються — explicit per task, muted-рядок нижче).
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { CardTitle } from "@/components/cabinet/card-title";
import { SwitchToggle } from "@/components/cabinet/switch-toggle";

export function NotificationsCard({
  lang,
  review,
  weeklyGoal,
  news,
  onReviewChange,
  onWeeklyGoalChange,
  onNewsChange,
}: {
  lang: UiLang;
  review: boolean;
  weeklyGoal: boolean;
  news: boolean;
  onReviewChange: (value: boolean) => void;
  onWeeklyGoalChange: (value: boolean) => void;
  onNewsChange: (value: boolean) => void;
}) {
  return (
    <div className="cabinet-card flex flex-col gap-3 p-5">
      <div>
        <CardTitle>{t(lang, "settings.section.notifications")}</CardTitle>
        <p className="mt-1 font-body text-sm text-[var(--cabinet-muted)]">
          {t(lang, "settings.notifications.comingSoon")}
        </p>
      </div>
      <div className="flex flex-col">
        <div className="settings-switch-row">
          <span className="settings-switch-label">{t(lang, "settings.notifications.review")}</span>
          <SwitchToggle
            checked={review}
            onChange={onReviewChange}
            label={t(lang, "settings.notifications.review")}
          />
        </div>
        <div className="settings-switch-row cabinet-fade-divider">
          <span className="settings-switch-label">{t(lang, "settings.notifications.weeklyGoal")}</span>
          <SwitchToggle
            checked={weeklyGoal}
            onChange={onWeeklyGoalChange}
            label={t(lang, "settings.notifications.weeklyGoal")}
          />
        </div>
        <div className="settings-switch-row cabinet-fade-divider">
          <span className="settings-switch-label">{t(lang, "settings.notifications.news")}</span>
          <SwitchToggle checked={news} onChange={onNewsChange} label={t(lang, "settings.notifications.news")} />
        </div>
      </div>
    </div>
  );
}
