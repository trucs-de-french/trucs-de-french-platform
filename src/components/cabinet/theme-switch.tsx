"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/use-theme";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { BevelIcon } from "@/components/cabinet/bevel-icon";

// Той самий useTheme() (lib/use-theme.ts), що ThemeToggle — лише інше
// подання (пілюлі в стилі LanguagePills тут, одна кнопка на collapsed
// рейці нижче), не окрема копія логіки теми.
export function ThemePills({
  lang,
  initialIsDark = null,
}: {
  lang: UiLang;
  initialIsDark?: boolean | null;
}) {
  const { isDark, setTheme } = useTheme(initialIsDark);

  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        aria-pressed={!isDark}
        onClick={() => setTheme(false)}
        className={`cabinet-lang-pill ${!isDark ? "cabinet-lang-pill--active" : ""}`}
      >
        <Sun size={14} aria-hidden="true" />
        {t(lang, "cabinet.theme.light")}
      </button>
      <button
        type="button"
        aria-pressed={isDark}
        onClick={() => setTheme(true)}
        className={`cabinet-lang-pill ${isDark ? "cabinet-lang-pill--active" : ""}`}
      >
        <Moon size={14} aria-hidden="true" />
        {t(lang, "cabinet.theme.dark")}
      </button>
    </div>
  );
}

// Collapsed rail: одна кнопка, іконка показує, яку тему УВІМКНЕ клік
// (Sun у темній темі → клік вмикає світлу, і навпаки) — той самий принцип,
// що й задача сформулювала явно, не "яка тема активна зараз".
export function ThemeRailButton({
  lang,
  initialIsDark = null,
}: {
  lang: UiLang;
  initialIsDark?: boolean | null;
}) {
  const { isDark, setTheme } = useTheme(initialIsDark);
  const label = t(lang, isDark ? "cabinet.theme.toLight" : "cabinet.theme.toDark");

  return (
    <button
      type="button"
      onClick={() => setTheme(!isDark)}
      aria-label={label}
      className="cabinet-nav-item w-full justify-center"
    >
      <span className="cabinet-rail-icon">
        <BevelIcon icon={isDark ? Sun : Moon} />
      </span>
      <span className="cabinet-tooltip" role="tooltip">
        {label}
      </span>
    </button>
  );
}
