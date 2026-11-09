import Link from "next/link";
import { RotateCcw, BookOpen, Timer } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { CardTitle } from "@/components/cabinet/card-title";

// "Тренування 5 хв" без власного маршруту (навіть "Скоро"-заглушки) —
// disabled-кнопка з чипом; /cabinet/mistakes і /cabinet/dictionary вже
// існують як реальні сторінки (наразі самі показують "Скоро"), тож
// лінкуються як звичні переходи, не disabled.
export function QuickActionsCard({ lang }: { lang: UiLang }) {
  return (
    <div className="cabinet-card flex flex-col gap-3 p-5">
      <CardTitle>{t(lang, "home.quickActions.title")}</CardTitle>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Link href="/cabinet/mistakes" className="settings-account-btn justify-center">
          <RotateCcw size={17} strokeWidth={2} aria-hidden="true" />
          {t(lang, "home.quickActions.mistakes")}
        </Link>
        <Link href="/cabinet/dictionary" className="settings-account-btn justify-center">
          <BookOpen size={17} strokeWidth={2} aria-hidden="true" />
          {t(lang, "home.quickActions.dictionary")}
        </Link>
        <span className="relative inline-flex">
          <button type="button" disabled className="settings-account-btn w-full justify-center">
            <Timer size={17} strokeWidth={2} aria-hidden="true" />
            {t(lang, "home.quickActions.training")}
          </button>
          <span className="cabinet-soon-chip">{t(lang, "cabinet.soon")}</span>
        </span>
      </div>
    </div>
  );
}
