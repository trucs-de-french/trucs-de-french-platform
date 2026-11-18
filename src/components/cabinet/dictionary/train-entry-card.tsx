import Link from "next/link";
import { Zap } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { TrainingOverview } from "@/lib/cabinet/word-training";

// Серверний (без "use client") — лише посилання+статичний текст, жодної
// інтерактивності тут немає. Рендериться (чи ні) викликачем
// (dictionary/page.tsx) залежно від getTrainingOverview(): якщо дія
// повернула "unavailable" (міграція ще не застосована) або total < 1
// (студент ще не зберіг жодного слова) — картка не рендериться взагалі,
// сторінка словника лишається точно такою, як до цієї фічі.
export function TrainEntryCard({ lang, overview }: { lang: UiLang; overview: TrainingOverview }) {
  return (
    <Link href="/cabinet/dictionary/train" className="train-card train-entry-card">
      <span className="train-entry-icon" aria-hidden="true">
        <Zap size={22} />
      </span>
      <span className="train-entry-body">
        <span className="train-entry-title">{t(lang, "cabinet.dictionary.train.entry.title")}</span>
        <span className="train-entry-text">{t(lang, "cabinet.dictionary.train.entry.text")}</span>
        <span className="train-entry-chips">
          <span className={`train-entry-chip${overview.total === 0 ? " train-entry-chip--zero" : ""}`}>
            {t(lang, "cabinet.dictionary.train.entry.chipAll", { count: overview.total })}
          </span>
          <span className={`train-entry-chip${overview.newCount === 0 ? " train-entry-chip--zero" : ""}`}>
            {t(lang, "cabinet.dictionary.train.entry.chipNew", { count: overview.newCount })}
          </span>
          <span className={`train-entry-chip${overview.weakCount === 0 ? " train-entry-chip--zero" : ""}`}>
            {t(lang, "cabinet.dictionary.train.entry.chipWeak", { count: overview.weakCount })}
          </span>
        </span>
      </span>
      <span className="train-entry-cta cabinet-btn-primary">{t(lang, "cabinet.dictionary.train.entry.cta")}</span>
    </Link>
  );
}
