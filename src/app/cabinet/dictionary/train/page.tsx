import { t } from "@/lib/i18n/t";
import { getCabinetProfile } from "@/lib/supabase/profile";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { PageHeader } from "@/components/cabinet/page-header";
import { TrainSetupView } from "@/components/cabinet/dictionary/train-setup-view";
import { getTrainingOverview, loadTrainingWords } from "@/app/cabinet/dictionary/train/actions";

// Серверна сторінка — лише auth/lang (getCabinetProfile, той самий
// паттерн, що placement-test/page.tsx) + початковий зчит (overview для
// статичних лічильників "Які слова", і повний список слів під дефолтний
// фільтр "all"/категорія "all" для початкового рендеру без миготіння) —
// решта (інтерактивні сегменти/дропдаун/перемикачі) — у клієнтському
// TrainSetupView.
export default async function TrainSetupPage() {
  const { lang } = await getCabinetProfile();

  const [overviewResult, wordsResult] = await Promise.all([
    getTrainingOverview(),
    loadTrainingWords({ filter: "all", category: "all", limit: "all" }),
  ]);

  return (
    <div className="train-page flex flex-col gap-6">
      <CabinetMobileHeader />
      <PageHeader
        title={t(lang, "cabinet.dictionary.train.setup.title")}
        backHref="/cabinet/dictionary"
        backLabel={t(lang, "cabinet.nav.dictionary")}
      />

      {!overviewResult.ok || !wordsResult.ok ? (
        <p className="train-status-text">
          {t(
            lang,
            overviewResult.ok === false && overviewResult.error === "unavailable"
              ? "cabinet.dictionary.train.unavailable"
              : "cabinet.dictionary.train.setup.error"
          )}
        </p>
      ) : overviewResult.overview.total === 0 ? (
        <p className="train-status-text">{t(lang, "cabinet.dictionary.train.empty")}</p>
      ) : (
        <TrainSetupView lang={lang} overview={overviewResult.overview} initialWords={wordsResult.words} />
      )}
    </div>
  );
}
