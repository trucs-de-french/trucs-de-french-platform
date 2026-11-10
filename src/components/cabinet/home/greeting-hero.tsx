import { t } from "@/lib/i18n/t";
import { plural, type PluralForms } from "@/lib/i18n/plural";
import type { UiLang } from "@/lib/ui/product-lang";
import { ProfileAvatar } from "@/components/cabinet/profile-avatar";
import { kyivDateString, addDays, startOfWeekKyiv } from "@/lib/cabinet/kyiv-date";

// Фіксовані 2-літерні абревіатури днів тижня (Пн..Нд) — не через t(),
// як DAY_UNIT_FORMS/SCENE_UNIT_FORMS в exam-card.tsx/weekly-goal-card.tsx:
// це проста таблиця "мова → 7 ярликів", не шаблон-речення з параметрами.
const WEEKDAY_LABELS: Record<UiLang, string[]> = {
  uk: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"],
  fr: ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"],
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
};

const DAY_UNIT_FORMS: Record<UiLang, PluralForms> = {
  uk: { one: "день", few: "дні", many: "днів", other: "днів" },
  fr: { one: "jour", other: "jours" },
  en: { one: "day", other: "days" },
};

// Привітання "variant E" — замінює колишній h1+підзаголовок "Продовжимо
// з: ..." (видалений, картка "Продовжити" нижче вже показує той самий
// контекст) одним акцентним панелем: привітання+week-dots зліва, аватар+
// чіп рівня праворуч. Рівень береться з того самого continueTarget, що й
// картка "Продовжити" (lib/cabinet/home-data.ts) — не окремий запит.
// Week-dots (variant C) — 7 кружків Пн..Нд поточного календарного тижня
// (Europe/Kyiv) — рахуються тут локально тими самими kyiv-date.ts
// хелперами, що getCabinetHomeData; weekActiveDays — підмножина ТОГО Ж
// activityDates, з якого рахується streakDays (не окремий запит/логіка).
export function GreetingHero({
  lang,
  firstName,
  fullName,
  avatarUrl,
  avatarMascot,
  streakDays,
  weekActiveDays,
  level,
}: {
  lang: UiLang;
  firstName: string;
  fullName: string | null;
  avatarUrl: string | null;
  avatarMascot: string | null;
  streakDays: number;
  weekActiveDays: string[];
  level: string | null;
}) {
  const now = new Date();
  const todayStr = kyivDateString(now);
  const weekStart = startOfWeekKyiv(now);
  const activeSet = new Set(weekActiveDays);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const unit = plural(lang, streakDays, DAY_UNIT_FORMS[lang]);

  return (
    <div className="cabinet-hero">
      <div className="min-w-0">
        <h1 className="cabinet-hero-greeting">{t(lang, "cabinet.home.greeting", { name: firstName })}</h1>
        <div className="cabinet-hero-week-row">
          <div className="cabinet-week-dots">
            {weekDays.map((d, i) => {
              const isActive = activeSet.has(d);
              const isToday = d === todayStr;
              return (
                <span
                  key={d}
                  className={`cabinet-week-dot${isActive ? " cabinet-week-dot--active" : ""}${
                    isToday ? " cabinet-week-dot--today" : ""
                  }`}
                >
                  {WEEKDAY_LABELS[lang][i]}
                </span>
              );
            })}
          </div>
          <span className="cabinet-week-streak-text">{t(lang, "home.streakChip", { n: streakDays, unit })}</span>
        </div>
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
