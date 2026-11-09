import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { AchievementState } from "@/lib/cabinet/achievements";
import { ACHIEVEMENT_ICON_MAP } from "@/components/cabinet/achievement-icon";

const LOCALE_BY_LANG: Record<UiLang, string> = { uk: "uk-UA", fr: "fr-FR", en: "en-US" };

function formatEarnedAt(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "Europe/Kyiv" }).format(
    new Date(iso)
  );
}

// Спільний бейдж досягнення — Home (achievements-home-card.tsx, 72px) і
// Progress (progress/achievements-card.tsx, 56px) рендерять ОДИН і той
// самий компонент, лише з іншим size, щоб стани (earned/inProgress/
// locked) не розходились візуально між сторінками.
export function AchievementBadge({
  lang,
  achievement,
  size = 72,
}: {
  lang: UiLang;
  achievement: AchievementState;
  size?: number;
}) {
  const Icon = ACHIEVEMENT_ICON_MAP[achievement.icon];
  const label = t(lang, achievement.nameKey);
  const locale = LOCALE_BY_LANG[lang];
  const inProgress = !achievement.earned && achievement.current > 0;
  const percent = Math.min(100, Math.round((100 * achievement.current) / achievement.threshold));
  const state = achievement.earned ? "earned" : inProgress ? "inProgress" : "locked";

  return (
    <div className="flex flex-col items-center gap-1.5 text-center" style={{ width: size + 12 }}>
      <span
        className={`achievement-badge-circle achievement-badge-circle--${state}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <Icon size={Math.round(size * 0.39)} />
      </span>
      <span className="line-clamp-2 font-heading text-[13.5px] font-extrabold leading-[1.2] text-[var(--cabinet-ink)]">
        {label}
      </span>
      {achievement.earned && achievement.earnedAt ? (
        <span className="font-body text-xs text-[var(--cabinet-muted)]">{formatEarnedAt(achievement.earnedAt, locale)}</span>
      ) : inProgress ? (
        <>
          <span className="text-[11px] text-[var(--cabinet-muted)]">
            {t(lang, "home.achievements.progress", { current: achievement.current, target: achievement.threshold })}
          </span>
          <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--cabinet-track)]">
            <div className="h-full rounded-full" style={{ width: `${percent}%`, background: "#e0aa3e" }} />
          </div>
        </>
      ) : (
        <span className="font-body text-xs text-[var(--cabinet-muted)]">{t(lang, "achievements.locked")}</span>
      )}
    </div>
  );
}
