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
      <div className="grid grid-cols-1 gap-2">
        <Link href="/cabinet/mistakes" className="cabinet-quick-action-btn">
          <RotateCcw size={17} strokeWidth={2} aria-hidden="true" />
          <span className="cabinet-quick-action-label">{t(lang, "home.quickActions.mistakes")}</span>
        </Link>
        <Link href="/cabinet/dictionary" className="cabinet-quick-action-btn">
          <BookOpen size={17} strokeWidth={2} aria-hidden="true" />
          <span className="cabinet-quick-action-label">{t(lang, "home.quickActions.dictionary")}</span>
        </Link>
        <button type="button" disabled className="cabinet-quick-action-btn">
          <Timer size={17} strokeWidth={2} aria-hidden="true" />
          <span className="cabinet-quick-action-label">{t(lang, "home.quickActions.training")}</span>
          <span className="cabinet-soon-chip cabinet-soon-chip--inline">{t(lang, "cabinet.soon")}</span>
        </button>
      </div>
    </div>
  );
}
