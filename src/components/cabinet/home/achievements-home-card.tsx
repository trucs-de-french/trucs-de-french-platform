import Link from "next/link";
import { CheckCircle2, Zap, Star, ArrowRight, type LucideIcon } from "lucide-react";
import { t, type MessageKey } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { pickHomeAchievements, type Achievement } from "@/lib/cabinet/home-data";
import { CardTitle } from "@/components/cabinet/card-title";

const LOCALE_BY_LANG: Record<UiLang, string> = { uk: "uk-UA", fr: "fr-FR", en: "en-US" };

// Та сама іконна мова, що progress/achievements-card.tsx — свідомо, не
// нові іконки.
const ICON_BY_KEY: Record<Achievement["key"], LucideIcon> = {
  firstScene: CheckCircle2,
  streak7: Zap,
  points100: Star,
};
const LABEL_KEY_BY_KEY: Record<Achievement["key"], MessageKey> = {
  firstScene: "progress.achievements.firstScene",
  streak7: "progress.achievements.streak7",
  points100: "progress.achievements.points100",
};

function formatEarnedAt(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "Europe/Kyiv" }).format(
    new Date(iso)
  );
}

function AchievementBadge({ lang, achievement }: { lang: UiLang; achievement: Achievement }) {
  const Icon = ICON_BY_KEY[achievement.key];
  const label = t(lang, LABEL_KEY_BY_KEY[achievement.key]);
  const locale = LOCALE_BY_LANG[lang];
  const inProgress = !achievement.earned && achievement.current > 0;
  const percent = Math.min(100, Math.round((100 * achievement.current) / achievement.target));

  return (
    <div className="flex w-[76px] flex-col items-center gap-1.5 text-center">
      <span
        className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full"
        style={
          achievement.earned || inProgress
            ? { border: "2px solid #e0aa3e", color: "#e0aa3e" }
            : {
                border: "2px dashed var(--cabinet-line)",
                color: "var(--cabinet-muted)",
                opacity: 0.6,
              }
        }
        aria-hidden="true"
      >
        <Icon size={24} />
      </span>
      <span className="line-clamp-2 text-xs font-semibold leading-[1.2] text-[var(--cabinet-ink)]">{label}</span>
      {achievement.earned && achievement.earnedAt ? (
        <span className="text-[11px] text-[var(--cabinet-muted)]">{formatEarnedAt(achievement.earnedAt, locale)}</span>
      ) : inProgress ? (
        <>
          <span className="text-[11px] text-[var(--cabinet-muted)]">
            {t(lang, "home.achievements.progress", { current: achievement.current, target: achievement.target })}
          </span>
          <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--cabinet-track)]">
            <div className="h-full rounded-full" style={{ width: `${percent}%`, background: "#e0aa3e" }} />
          </div>
        </>
      ) : null}
    </div>
  );
}

export function AchievementsHomeCard({ lang, achievements }: { lang: UiLang; achievements: Achievement[] }) {
  const items = pickHomeAchievements(achievements);

  return (
    <div className="cabinet-card flex h-full flex-col gap-3 p-5">
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
        <p className="flex-1 text-sm text-[var(--cabinet-muted)]">{t(lang, "home.achievements.empty")}</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {items.map((achievement) => (
            <AchievementBadge key={achievement.key} lang={lang} achievement={achievement} />
          ))}
        </div>
      )}
    </div>
  );
}
