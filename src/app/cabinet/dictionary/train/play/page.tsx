import { t } from "@/lib/i18n/t";
import { getCabinetProfile } from "@/lib/supabase/profile";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { PageHeader } from "@/components/cabinet/page-header";
import { loadTrainingWords } from "@/app/cabinet/dictionary/train/actions";
import {
  parseTrainingFilterParam,
  parseTrainingCategoryParam,
  parseTrainingLimitParam,
  parseTrainingExerciseTypesParam,
} from "@/lib/cabinet/word-training";
import { TrainPlayView } from "@/components/cabinet/dictionary/train-play-view";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TrainPlayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { lang } = await getCabinetProfile();

  const filter = parseTrainingFilterParam(first(sp.filter));
  const category = parseTrainingCategoryParam(first(sp.category));
  const limit = parseTrainingLimitParam(first(sp.limit));
  // ОДИН словник (QuestionType, buildSession) — той самий масив
  // іде і в TrainPlayView.enabledTypes (buildSession), і в setupParams.types
  // ("Назад" на setup) — раніше тут були ДВА окремі розбори "types" у
  // двох різних словниках (звіт 379d493), тому перемикачі на setup майже
  // не впливали на сесію.
  const types = parseTrainingExerciseTypesParam(first(sp.types));

  const result = await loadTrainingWords({ filter, category, limit });

  // "unavailable"/0 слів (ex: усі слова з обраної категорії були видалені
  // між setup-екраном і цим переходом) — дружнє повідомлення+лінк назад,
  // ніколи падіння сторінки. "Немає ЕЛІГІБЕЛЬНИХ слів для обраних типів
  // вправ" (buildSession.skippedCount === words.length) перевіряється
  // ВСЕРЕДИНІ TrainPlayView (клієнт, rng), не тут — тут лише сирі слова.
  if (!result.ok || result.words.length === 0) {
    return (
      <div className="train-page flex flex-col gap-6">
        <CabinetMobileHeader />
        <PageHeader
          title={t(lang, "cabinet.dictionary.train.setup.title")}
          backHref="/cabinet/dictionary/train"
          backLabel={t(lang, "cabinet.dictionary.train.play.backLink")}
        />
        <p className="train-status-text">
          {t(
            lang,
            result.ok === false && result.error === "unavailable"
              ? "cabinet.dictionary.train.unavailable"
              : result.ok === false
                ? "cabinet.dictionary.train.setup.error"
                : "cabinet.dictionary.train.empty"
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="train-page flex flex-col gap-4">
      <CabinetMobileHeader />
      <TrainPlayView
        lang={lang}
        words={result.words}
        pool={result.pool}
        enabledTypes={types}
        setupParams={{ filter, category, limit, types }}
      />
    </div>
  );
}
