"use client";

import { t } from "@/lib/i18n/t";
import { plural, type PluralForms } from "@/lib/i18n/plural";
import type { UiLang } from "@/lib/ui/product-lang";
import { ProfileAvatar } from "@/components/cabinet/profile-avatar";
import { kyivDateString, addDays, startOfWeekKyiv } from "@/lib/cabinet/kyiv-date";
import { useAdminPreview } from "@/lib/cabinet/admin-preview";

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
  const { override } = useAdminPreview();
  const now = new Date();
  const todayStr = kyivDateString(now);
  const weekStart = startOfWeekKyiv(now);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Адмінський override (useAdminPreview) підмінює і текст стріку, і
  // week-dots: "останні N днів, що закінчуються сьогодні" (capped на 7),
  // а не реальний weekActiveDays — реальних дат активності для вигаданого
  // стріку просто нема.
  const effectiveStreakDays = override ? override.currentStreakDays ?? override.streakDays : streakDays;
  const activeSet = override
    ? new Set(Array.from({ length: Math.min(7, effectiveStreakDays) }, (_, i) => addDays(todayStr, -i)))
    : new Set(weekActiveDays);
  const unit = plural(lang, effectiveStreakDays, DAY_UNIT_FORMS[lang]);

  const weekDots = weekDays.map((d, i) => {
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
  });
  const levelChip = level && <span className="cabinet-hero-level-chip">{t(lang, "home.hero.level", { level })}</span>;
  const streakText = (
    <span className="cabinet-week-streak-text">{t(lang, "home.streakChip", { n: effectiveStreakDays, unit })}</span>
  );

  return (
    <>
      {/* <1024px (мобільний і планшет) — колишній розклад без змін:
          привітання+week-dots зліва, аватар+чіп рівня праворуч, стовпцем.
          >=1024px — окремий "тонкий" однорядковий варіант нижче
          (hidden/lg:hidden пара, не медіа-запит усередині одного дерева,
          бо аватар+чіп і week-dots+стрік переставлені в інший угруповання
          дітей, не лише інший CSS-розклад тих самих). */}
      <div className="cabinet-hero lg:hidden">
        <div className="min-w-0">
          <h1 className="cabinet-hero-greeting">{t(lang, "cabinet.home.greeting", { name: firstName })}</h1>
          <div className="cabinet-hero-week-row">
            <div className="cabinet-week-dots">{weekDots}</div>
            {streakText}
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
          {levelChip}
        </div>
      </div>

      <div className="cabinet-hero-slim hidden lg:flex">
        <ProfileAvatar
          name={fullName?.trim() || ""}
          size={56}
          imageUrl={avatarUrl}
          mascotId={avatarMascot}
          className="cabinet-hero-slim-avatar"
        />
        <h1 className="cabinet-hero-slim-greeting">{t(lang, "cabinet.home.greeting", { name: firstName })}</h1>
        {levelChip}
        <div className="cabinet-hero-slim-spacer" />
        <div className="cabinet-week-dots cabinet-hero-slim-dots">{weekDots}</div>
        {streakText}
      </div>
    </>
  );
}
