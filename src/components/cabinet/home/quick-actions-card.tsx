"use client";

import Link from "next/link";
import { BookOpen, Clapperboard, GraduationCap, Timer, ArrowRight } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { CardTitle } from "@/components/cabinet/card-title";
import { useAdminPreview } from "@/lib/cabinet/admin-preview";

// "Швидкі дії" — 3 кнопки: словник (outline), контекстна головна дія
// (DELF-практика, якщо є дата іспиту/DELF-продукт — той самий критерій,
// що показує картку "Іспит" — інакше "Обрати нову сцену"), "Тренування
// 5 хв" (disabled, "Скоро"). showExamCard/delfProductId — реальні дані з
// сервера; адмінський override (useAdminPreview, examDateAdded) підміняє
// лише контекстну дію, щоб вчитель міг прев'юднути обидва варіанти.
export function QuickActionsCard({
  lang,
  showExamCard,
  delfProductId,
}: {
  lang: UiLang;
  showExamCard: boolean;
  delfProductId: string | null;
}) {
  const { override } = useAdminPreview();
  const showDelf = override ? !!override.examDateAdded : showExamCard;
  const delfHref = delfProductId ? `/courses/${delfProductId}` : "/cabinet/library";

  return (
    <div className="cabinet-card flex flex-col gap-3 p-5">
      <CardTitle>{t(lang, "home.quickActions.title")}</CardTitle>
      <div className="grid grid-cols-1 gap-[10px]">
        <Link href="/cabinet/dictionary" className="cabinet-quick-action-btn cabinet-quick-action-btn--outline">
          <BookOpen size={20} strokeWidth={1.8} aria-hidden="true" />
          <span className="cabinet-quick-action-label">{t(lang, "home.quickActions.dictionary")}</span>
          <ArrowRight size={20} className="cabinet-quick-action-arrow" aria-hidden="true" />
        </Link>

        {showDelf ? (
          <Link href={delfHref} className="cabinet-quick-action-btn cabinet-quick-action-btn--main">
            <GraduationCap size={20} strokeWidth={1.8} aria-hidden="true" />
            <span className="cabinet-quick-action-label">{t(lang, "home.quickActions.delf")}</span>
            <ArrowRight size={20} className="cabinet-quick-action-arrow" aria-hidden="true" />
          </Link>
        ) : (
          <Link href="/cabinet/library" className="cabinet-quick-action-btn cabinet-quick-action-btn--main">
            <Clapperboard size={20} strokeWidth={1.8} aria-hidden="true" />
            <span className="cabinet-quick-action-label">{t(lang, "home.quickActions.newScene")}</span>
            <ArrowRight size={20} className="cabinet-quick-action-arrow" aria-hidden="true" />
          </Link>
        )}

        <button
          type="button"
          disabled
          aria-disabled="true"
          className="cabinet-quick-action-btn cabinet-quick-action-btn--disabled"
        >
          <Timer size={20} strokeWidth={1.8} aria-hidden="true" />
          <span className="cabinet-quick-action-label">{t(lang, "home.quickActions.training")}</span>
          <span className="cabinet-soon-chip">{t(lang, "cabinet.soon")}</span>
        </button>
      </div>
    </div>
  );
}
