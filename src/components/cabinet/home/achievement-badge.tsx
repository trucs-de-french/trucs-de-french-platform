import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { AchievementState } from "@/lib/cabinet/achievements";
import { CATEGORY_ICON, CATEGORY_LABEL_KEY } from "@/lib/cabinet/achievement-ui";

const LOCALE_BY_LANG: Record<UiLang, string> = { uk: "uk-UA", fr: "fr-FR", en: "en-US" };

// Поріг завжди показаний на монеті (і здобутій, і заблокованій) — лише
// "Додано дату іспиту" (examDateAdded) без лічильника, бо це разовий факт
// без порогу-кількості, а не метрика.
const NO_NUMBER_IDS = new Set(["examDateAdded"]);

function formatEarnedAt(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "Europe/Kyiv" }).format(
    new Date(iso)
  );
}

const NUMBER_FONT_SIZE_BY_DIGITS: Record<number, number> = { 1: 36, 2: 32, 3: 25, 4: 20 };

function numberFontSize(digitCount: number): number {
  return NUMBER_FONT_SIZE_BY_DIGITS[digitCount] ?? 18;
}

// "Gold coin, faded category icon behind a bold number" — одна й та сама
// монета в обох темах для earned (gold/indigo градієнти), locked — суто
// theme-aware CSS-змінні (--ach-lk/-lkl/-lkt/-lkn), без градієнтів, щоб не
// виглядала як "майже здобута". number === null лише для разових
// спеціальних бейджів (напр. "Додано дату іспиту") — тоді замість
// приглушеного водяного знаку в центрі показуємо великий суцільний глиф.
export function AchievementBadgeCoin({
  earned,
  number,
  Icon,
}: {
  earned: boolean;
  number: string | null;
  Icon: LucideIcon;
}) {
  const goldId = useId();
  const indigoId = useId();
  const iconColor = earned ? "#f3d98b" : "var(--ach-lkt)";

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
          <circle cx="52" cy="46" r="39" fill={`url(#${goldId})`} stroke="#b8923f" strokeWidth={2.5} />
          <circle cx="52" cy="46" r="32" fill={`url(#${indigoId})`} stroke="#f8e6a8" strokeWidth={3} />
        </>
      ) : (
        <>
          <path d="M38 68 L30 100 L42 93 L48 103 L54 72Z" fill="var(--ach-lk)" stroke="var(--ach-lkl)" strokeWidth={2} />
          <path d="M66 68 L74 100 L62 93 L56 103 L50 72Z" fill="var(--ach-lk)" stroke="var(--ach-lkl)" strokeWidth={2} />
          <circle
            cx="52"
            cy="46"
            r="39"
            fill="var(--ach-lk)"
            stroke="var(--ach-lkl)"
            strokeWidth={2.5}
            strokeDasharray="6 5"
          />
          <circle
            cx="52"
            cy="46"
            r="32"
            fill="var(--cabinet-card-bg)"
            stroke="var(--ach-lkl)"
            strokeWidth={3}
            strokeDasharray="5 4"
          />
        </>
      )}
      {number !== null ? (
        <g opacity={0.34}>
          <Icon x={28} y={22} width={48} height={48} color={iconColor} strokeWidth={1.5} />
        </g>
      ) : (
        <Icon x={34} y={28} width={36} height={36} color={iconColor} strokeWidth={1.9} />
      )}
      {number !== null && (
        <text
          x={52}
          y={46 + numberFontSize(number.length) * 0.35}
          textAnchor="middle"
          fontFamily="var(--font-heading)"
          fontWeight={900}
          fontSize={numberFontSize(number.length)}
          fill={earned ? "#f8e6a8" : "var(--ach-lkn)"}
          stroke={earned ? "#2f2c6b" : "var(--cabinet-card-bg)"}
          strokeWidth={3.2}
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          {number}
        </text>
      )}
    </svg>
  );
}

// Спільний бейдж досягнення — Home (achievements-home-card.tsx), Progress
// (progress/achievements-card.tsx, компактний ряд) і повна сторінка
// (achievements/full-achievements.tsx) рендерять ОДИН і той самий
// компонент, щоб вигляд не розходився. showCategoryTag — лише для повної
// сторінки в режимі "Усі" (бейджі різних категорій поряд без чипа-фільтра).
export function AchievementBadge({
  lang,
  achievement,
  showCategoryTag = false,
}: {
  lang: UiLang;
  achievement: AchievementState;
  showCategoryTag?: boolean;
}) {
  const label = t(lang, achievement.nameKey);
  const locale = LOCALE_BY_LANG[lang];
  const Icon = CATEGORY_ICON[achievement.category];
  const number = NO_NUMBER_IDS.has(achievement.id) ? null : String(achievement.threshold);
  const caption = achievement.earned
    ? achievement.earnedAt
      ? formatEarnedAt(achievement.earnedAt, locale)
      : null
    : t(lang, "home.achievements.progress", { current: achievement.current, target: achievement.threshold });

  return (
    <div className="achievement-badge">
      <AchievementBadgeCoin earned={achievement.earned} number={number} Icon={Icon} />
      <div className="achievement-badge-title-box">
        <span
          className={`achievement-badge-title ${achievement.earned ? "" : "achievement-badge-title--locked"}`}
          title={label}
        >
          {label}
        </span>
      </div>
      {caption && <span className="achievement-badge-caption">{caption}</span>}
      {showCategoryTag && (
        <span className="achievement-badge-category-tag">{t(lang, CATEGORY_LABEL_KEY[achievement.category])}</span>
      )}
    </div>
  );
}
