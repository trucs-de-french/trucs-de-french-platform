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
import type { QuestionType } from "@/lib/cabinet/word-training-session";
import { TrainPlayView } from "@/components/cabinet/dictionary/train-play-view";

// buildSession (word-training-session.ts) словник вправ — QuestionType
// ("cards"/"choice"/"unscramble"/"gap") — НЕ той самий словник, що setup-
// екран видає (TrainingExerciseType: "flip_cards"/"translation_choice"/
// "unscramble"/"sentence_gap", word-training.ts). "types" із query парситься
// ОБОМА валідаторами нижче окремо — для buildSession (questionTypes) і для
// URL "Назад" на setup (parseTrainingExerciseTypesParam, передається у
// TrainPlayView як є, той самий словник, що setup сам породжує).
const QUESTION_TYPES: QuestionType[] = ["cards", "choice", "unscramble", "gap"];

function parseQuestionTypesParam(raw: string | undefined): QuestionType[] {
  if (!raw) return QUESTION_TYPES;
  const picked = raw.split(",").filter((v): v is QuestionType => (QUESTION_TYPES as readonly string[]).includes(v));
  return picked.length > 0 ? picked : QUESTION_TYPES;
}

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
  const questionTypes = parseQuestionTypesParam(first(sp.types));
  // Той самий сирий "types", лише розібраний у словнику setup-екрана —
  // для кнопки "Назад" усередині TrainPlayView (та сама форма, що
  // handleStart у train-setup-view.tsx сам кладе в query string).
  const setupTypes = parseTrainingExerciseTypesParam(first(sp.types));

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
        enabledTypes={questionTypes}
        setupParams={{ filter, category, limit, types: setupTypes }}
      />
    </div>
  );
}
