// Мова/тема — ті самі LanguagePills/ThemePills, що сайдбар, застосовують
// зміну одразу своїми діями (setCabinetUiLang / useTheme), тож ця картка
// НЕ бере участі в нижній панелі "Є незбережені зміни" — лишається
// синхронною з сайдбаром без жодного окремого стейту тут.
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { LanguagePills } from "@/components/cabinet/language-pills";
import { ThemePills } from "@/components/cabinet/theme-switch";

export function InterfaceCard({ lang }: { lang: UiLang }) {
  return (
    <div className="cabinet-card flex flex-col gap-4 p-5">
      <h3 className="font-body text-lg font-semibold text-[var(--cabinet-ink)]">
        {t(lang, "settings.section.interface")}
      </h3>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-[var(--cabinet-muted)]">
          {t(lang, "cabinet.nav.language")}
        </span>
        <LanguagePills current={lang} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-[var(--cabinet-muted)]">
          {t(lang, "cabinet.theme.label")}
        </span>
        <ThemePills lang={lang} />
      </div>
    </div>
  );
}
