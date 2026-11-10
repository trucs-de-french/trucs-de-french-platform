"use client";

// Мова/тема — застосовують зміну одразу (setCabinetUiLang / useTheme),
// та сама дія/хук, що сайдбар, тож лишаються синхронними з ним без
// власного стейту тут. Візуально — НЕ LanguagePills/ThemePills (ті
// малюють .cabinet-lang-pill, розрахований на темний фон сайдбару):
// SettingsPill (settings-pill.tsx/globals.css) непрозорий в обох темах
// на кремовій/білій картці.
import { useTransition } from "react";
import { Sun, Moon } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { useTheme } from "@/lib/use-theme";
import { setCabinetUiLang } from "@/app/cabinet/actions";
import { SettingsPill } from "./settings-pill";
import { CardTitle } from "@/components/cabinet/card-title";

const LANGS: UiLang[] = ["uk", "fr", "en"];

export function InterfaceCard({
  lang,
  initialIsDark = null,
}: {
  lang: UiLang;
  initialIsDark?: boolean | null;
}) {
  const [isPending, startTransition] = useTransition();
  const { isDark, setTheme } = useTheme(initialIsDark);

  return (
    <div className="cabinet-card flex flex-col p-5">
      <CardTitle>{t(lang, "settings.section.interface")}</CardTitle>
      <div className="mt-7">
        <h3 className="settings-field-heading">{t(lang, "cabinet.nav.language")}</h3>
        <p className="settings-field-hint">{t(lang, "settings.interface.languageHint")}</p>
        <div className="mt-[14px] flex flex-wrap gap-3">
          {LANGS.map((l) => (
            <SettingsPill
              key={l}
              active={l === lang}
              disabled={isPending}
              onClick={() => startTransition(() => setCabinetUiLang(l))}
            >
              {l.toUpperCase()}
            </SettingsPill>
          ))}
        </div>
      </div>
      <div className="mt-8">
        <h3 className="settings-field-heading">{t(lang, "cabinet.theme.label")}</h3>
        <p className="settings-field-hint">{t(lang, "settings.interface.themeHint")}</p>
        <div className="mt-[14px] flex flex-wrap gap-3">
          <SettingsPill active={!isDark} onClick={() => setTheme(false)}>
            <Sun size={14} aria-hidden="true" />
            {t(lang, "cabinet.theme.light")}
          </SettingsPill>
          <SettingsPill active={isDark} onClick={() => setTheme(true)}>
            <Moon size={14} aria-hidden="true" />
            {t(lang, "cabinet.theme.dark")}
          </SettingsPill>
        </div>
      </div>
    </div>
  );
}
