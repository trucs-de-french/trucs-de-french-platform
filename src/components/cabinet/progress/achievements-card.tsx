import { CheckCircle2, Zap, Star, type LucideIcon } from "lucide-react";
import { t, type MessageKey } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { Achievement } from "@/lib/cabinet/progress-data";

// Та сама іконна мова, що StatTiles (CheckCircle2/Zap/Star) — свідомо, не
// нові іконки: ці ж три метрики (сцени/streak/бали) тут лише в ролі
// "досягнуто чи ні", а не живого числа.
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

function AchievementTile({ lang, achievement }: { lang: UiLang; achievement: Achievement }) {
  const Icon = ICON_BY_KEY[achievement.key];
  const label = t(lang, LABEL_KEY_BY_KEY[achievement.key]);

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
        style={
          achievement.earned
            ? { background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)", color: "var(--cabinet-on-gold)" }
            : {
                background: "transparent",
                border: "1.5px dashed var(--cabinet-line)",
                color: "var(--cabinet-muted)",
              }
        }
        aria-hidden="true"
      >
        <Icon size={22} />
      </span>
      <span
        className={`line-clamp-2 text-xs font-semibold leading-[1.2] ${
          achievement.earned ? "text-[var(--cabinet-ink)]" : "text-[var(--cabinet-muted)]"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export function AchievementsCard({ lang, items }: { lang: UiLang; items: Achievement[] }) {
  return (
    <div className="cabinet-card flex h-full flex-col gap-4 p-5">
      <h3 className="font-body text-xl font-semibold text-[var(--cabinet-ink)]">
        {t(lang, "progress.achievements.title")}
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {items.map((achievement) => (
          <AchievementTile key={achievement.key} lang={lang} achievement={achievement} />
        ))}
      </div>
    </div>
  );
}
