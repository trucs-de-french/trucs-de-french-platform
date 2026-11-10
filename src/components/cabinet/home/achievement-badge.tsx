import { useId } from "react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { AchievementState } from "@/lib/cabinet/achievements";

const LOCALE_BY_LANG: Record<UiLang, string> = { uk: "uk-UA", fr: "fr-FR", en: "en-US" };

function formatEarnedAt(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "Europe/Kyiv" }).format(
    new Date(iso)
  );
}

function renderGlyph(glyph: string, color: string) {
  if (glyph === "check") {
    return <path d="M-13 1 L-4 10 L13 -9" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (glyph === "cap") {
    return (
      <>
        <polygon points="0,-13 20,-4 0,5 -20,-4" fill={color} />
        <path d="M-11 3 V10 Q0 17 11 10 V3" fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" />
      </>
    );
  }
  const isWide = glyph.length > 1;
  return (
    <text
      x={0}
      y={isWide ? 8 : 10}
      textAnchor="middle"
      fontFamily="Nunito"
      fontWeight={900}
      fontSize={isWide ? 25 : 30}
      fill={color}
    >
      {glyph}
    </text>
  );
}

// "G1 classic coin with indigo ribbons" — монета-медаль із двома
// стрічками-хвостиками позаду; earned ідентична в обох темах (gold/indigo
// градієнти), locked — суто theme-aware CSS-змінні (--ach-lk/-lkl/-lkt),
// без градієнтів, щоб не виглядала як "майже здобута".
export function AchievementBadgeCoin({ earned, glyph }: { earned: boolean; glyph: string }) {
  const goldId = useId();
  const indigoId = useId();

  return (
    <svg viewBox="0 0 104 108" className="achievement-badge-coin" aria-hidden="true">
      <defs>
        <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f8e6a8" />
          <stop offset="0.55" stopColor="#d9b765" />
          <stop offset="1" stopColor="#b8923f" />
        </linearGradient>
        <linearGradient id={indigoId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4b46da" />
          <stop offset="1" stopColor="#2f2c6b" />
        </linearGradient>
      </defs>
      {earned ? (
        <>
          <path d="M38 68 L30 100 L42 93 L48 103 L54 72Z" fill={`url(#${indigoId})`} />
          <path d="M66 68 L74 100 L62 93 L56 103 L50 72Z" fill="#3a35a0" />
          <circle cx="52" cy="46" r="39" fill={`url(#${goldId})`} stroke="#b8923f" strokeWidth={1.5} />
          <circle cx="52" cy="46" r="32" fill={`url(#${indigoId})`} stroke="#f8e6a8" strokeWidth={2} />
          <circle cx="52" cy="46" r="27" fill="none" stroke="#f3d98b" strokeOpacity={0.4} />
          <g transform="translate(52 46)">{renderGlyph(glyph, "#f3d98b")}</g>
        </>
      ) : (
        <>
          <path d="M38 68 L30 100 L42 93 L48 103 L54 72Z" fill="var(--ach-lk)" stroke="var(--ach-lkl)" />
          <path d="M66 68 L74 100 L62 93 L56 103 L50 72Z" fill="var(--ach-lk)" stroke="var(--ach-lkl)" />
          <circle
            cx="52"
            cy="46"
            r="39"
            fill="var(--ach-lk)"
            stroke="var(--ach-lkl)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <circle
            cx="52"
            cy="46"
            r="32"
            fill="var(--cabinet-card-bg)"
            stroke="var(--ach-lkl)"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          <circle cx="52" cy="46" r="27" fill="none" stroke="var(--ach-lkl)" strokeOpacity={0.4} />
          <g transform="translate(52 46)">{renderGlyph(glyph, "var(--ach-lkt)")}</g>
        </>
      )}
    </svg>
  );
}

// Спільний бейдж досягнення — Home (achievements-home-card.tsx) і Progress
// (progress/achievements-card.tsx) рендерять ОДИН і той самий компонент,
// щоб вигляд не розходився між сторінками. "Додано дату іспиту" — єдине
// earned-досягнення без лічильника-порогу, тож у нього свій глиф (cap);
// решта earned — check, решта locked — число порогу (мета "5 сцен" і т.д.).
export function AchievementBadge({ lang, achievement }: { lang: UiLang; achievement: AchievementState }) {
  const label = t(lang, achievement.nameKey);
  const locale = LOCALE_BY_LANG[lang];
  const glyph = achievement.earned ? (achievement.id === "examDateAdded" ? "cap" : "check") : String(achievement.threshold);
  const caption = achievement.earned
    ? achievement.earnedAt
      ? formatEarnedAt(achievement.earnedAt, locale)
      : null
    : t(lang, "home.achievements.progress", { current: achievement.current, target: achievement.threshold });

  return (
    <div className="achievement-badge">
      <AchievementBadgeCoin earned={achievement.earned} glyph={glyph} />
      <span className={`achievement-badge-title ${achievement.earned ? "" : "achievement-badge-title--locked"}`}>
        {label}
      </span>
      {caption && <span className="achievement-badge-caption">{caption}</span>}
    </div>
  );
}
