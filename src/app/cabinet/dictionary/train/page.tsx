import { t } from "@/lib/i18n/t";
import { getCabinetProfile } from "@/lib/supabase/profile";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { PageHeader } from "@/components/cabinet/page-header";
import { TrainSetupView } from "@/components/cabinet/dictionary/train-setup-view";
import { getTrainingOverview, loadTrainingWords } from "@/app/cabinet/dictionary/train/actions";
import {
  parseTrainingFilterParam,
  parseTrainingCategoryParam,
  parseTrainingLimitParam,
  parseTrainingExerciseTypesParam,
} from "@/lib/cabinet/word-training";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Серверна сторінка — лише auth/lang (getCabinetProfile, той самий
// паттерн, що placement-test/page.tsx) + початковий зчит (overview для
// статичних лічильників "Які слова", і список слів під ОБРАНИЙ (чи
// дефолтний "all") фільтр/категорія-all для початкового рендеру без
// миготіння) — решта (інтерактивні сегменти/дропдаун/перемикачі) — у
// клієнтському TrainSetupView. filter/category/limit/types у query
// string — щоб "Назад" із сесії (/train/play) відкривав setup УЖЕ З
// тим самим вибором, замість завжди скидати на дефолт.
export default async function TrainSetupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { lang } = await getCabinetProfile();

  const initialFilter = parseTrainingFilterParam(first(sp.filter));
  const initialCategory = parseTrainingCategoryParam(first(sp.category));
  const initialLimit = parseTrainingLimitParam(first(sp.limit));
  const initialTypes = parseTrainingExerciseTypesParam(first(sp.types));

  const [overviewResult, wordsResult] = await Promise.all([
    getTrainingOverview(),
    loadTrainingWords({ filter: initialFilter, category: "all", limit: "all" }),
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
        <TrainSetupView
          lang={lang}
          overview={overviewResult.overview}
          initialWords={wordsResult.words}
          initialFilter={initialFilter}
          initialCategory={initialCategory}
          initialLimit={initialLimit}
          initialTypes={initialTypes}
        />
      )}
    </div>
  );
}
