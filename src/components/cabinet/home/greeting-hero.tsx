import { Zap } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { ProfileAvatar } from "@/components/cabinet/profile-avatar";

// Привітання "variant E" — замінює колишній h1+підзаголовок "Продовжимо
// з: ..." (видалений, картка "Продовжити" нижче вже показує той самий
// контекст) одним акцентним панелем: привітання+стрік зліва, аватар+чіп
// рівня праворуч. Рівень береться з того самого continueTarget, що й
// картка "Продовжити" (lib/cabinet/home-data.ts) — не окремий запит.
export function GreetingHero({
  lang,
  firstName,
  fullName,
  avatarUrl,
  avatarMascot,
  streakDays,
  level,
}: {
  lang: UiLang;
  firstName: string;
  fullName: string | null;
  avatarUrl: string | null;
  avatarMascot: string | null;
  streakDays: number;
  level: string | null;
}) {
  return (
    <div className="cabinet-hero">
      <div className="min-w-0">
        <h1 className="cabinet-hero-greeting">{t(lang, "cabinet.home.greeting", { name: firstName })}</h1>
        {streakDays > 0 && (
          <div className="cabinet-hero-streak-row">
            <span className="cabinet-streak-chip">
              <Zap size={13} aria-hidden="true" />
              {t(lang, "home.streakChip", { n: streakDays })}
            </span>
          </div>
        )}
      </div>
      <div className="cabinet-hero-side">
        <ProfileAvatar
          name={fullName?.trim() || ""}
          size={88}
          imageUrl={avatarUrl}
          mascotId={avatarMascot}
          className="cabinet-hero-avatar"
        />
        {level && <span className="cabinet-hero-level-chip">{t(lang, "home.hero.level", { level })}</span>}
      </div>
    </div>
  );
}
