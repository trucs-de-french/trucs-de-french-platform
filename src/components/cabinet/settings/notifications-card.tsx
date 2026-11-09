// Три перемикачі сповіщень — частина dirty-стану settings-form.tsx (idem
// пояснення: наразі лише зберігають preference у profiles.notification_
// prefs, листи ще не надсилаються — explicit per task, muted-рядок нижче).
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { CardTitle } from "@/components/cabinet/card-title";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`settings-toggle ${checked ? "settings-toggle--on" : ""}`}
    >
      <span className="settings-toggle-thumb" />
    </button>
  );
}

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
      <CardTitle>{t(lang, "settings.section.notifications")}</CardTitle>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--cabinet-ink)]">{t(lang, "settings.notifications.review")}</span>
          <Toggle checked={review} onChange={onReviewChange} label={t(lang, "settings.notifications.review")} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--cabinet-ink)]">{t(lang, "settings.notifications.weeklyGoal")}</span>
          <Toggle
            checked={weeklyGoal}
            onChange={onWeeklyGoalChange}
            label={t(lang, "settings.notifications.weeklyGoal")}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--cabinet-ink)]">{t(lang, "settings.notifications.news")}</span>
          <Toggle checked={news} onChange={onNewsChange} label={t(lang, "settings.notifications.news")} />
        </div>
      </div>
      <p className="text-xs text-[var(--cabinet-muted)]">{t(lang, "settings.notifications.comingSoon")}</p>
    </div>
  );
}
