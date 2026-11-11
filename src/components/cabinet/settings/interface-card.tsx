"use client";

// Мова/тема — застосовують зміну одразу (setCabinetUiLang / useTheme),
// та сама дія/хук, що сайдбар, тож лишаються синхронними з ним без
// власного стейту тут. Візуально — НЕ LanguagePills/ThemePills (ті
// малюють .cabinet-lang-pill, розрахований на темний фон сайдбару):
// SettingsPill (settings-pill.tsx/globals.css) непрозорий в обох темах
// на кремовій/білій картці.
// Тема — три пілюлі (система/світла/темна), не дві: "Системна" викликає
// setThemeMode("system"), яка прибирає explicit-збереження (useTheme),
// тож тема знову слідує за ОС і живо реагує на її зміну.
import { useTransition } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { t, type MessageKey } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { useTheme, type ThemeMode } from "@/lib/use-theme";
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
  const { mode, setThemeMode } = useTheme(initialIsDark);

  const THEME_OPTIONS: { value: ThemeMode; labelKey: MessageKey; icon: typeof Monitor }[] = [
    { value: "system", labelKey: "cabinet.theme.system", icon: Monitor },
    { value: "light", labelKey: "cabinet.theme.light", icon: Sun },
    { value: "dark", labelKey: "cabinet.theme.dark", icon: Moon },
  ];

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
          {THEME_OPTIONS.map(({ value, labelKey, icon: Icon }) => (
            <SettingsPill key={value} active={mode === value} onClick={() => setThemeMode(value)}>
              <Icon size={14} aria-hidden="true" />
              {t(lang, labelKey)}
            </SettingsPill>
          ))}
        </div>
      </div>
    </div>
  );
}
