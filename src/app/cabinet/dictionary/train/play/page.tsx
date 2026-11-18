import { t } from "@/lib/i18n/t";
import { getCabinetProfile } from "@/lib/supabase/profile";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { PageHeader } from "@/components/cabinet/page-header";
import { loadTrainingWords } from "@/app/cabinet/dictionary/train/actions";
import { TRAINING_LIMITS, type TrainingFilter, type TrainingLimit } from "@/lib/cabinet/word-training";
import { PART_OF_SPEECH_ORDER, type PartOfSpeech } from "@/lib/vocab-categories";
import type { QuestionType } from "@/lib/cabinet/word-training-session";
import { TrainPlayView } from "@/components/cabinet/dictionary/train-play-view";

const ALL_TYPES: QuestionType[] = ["cards", "choice", "unscramble", "gap"];

// Сервер не довіряє query-параметрам напряму (той самий принцип, що решта
// кабінету) — loadTrainingWords ВЖЕ сам перевіряє filter/category/limit
// (train/actions.ts), валідатори тут лише щоб задовольнити типи на межі
// викличу й мати один явний, передбачуваний дефолт для кожного параметра.
function parseFilter(raw: string | undefined): TrainingFilter {
  return raw === "new" || raw === "weak" ? raw : "all";
}

function parseCategory(raw: string | undefined): PartOfSpeech | "none" | "all" {
  if (!raw || raw === "all") return "all";
  if (raw === "none") return "none";
  return (PART_OF_SPEECH_ORDER as readonly string[]).includes(raw) ? (raw as PartOfSpeech) : "all";
}

function parseLimit(raw: string | undefined): TrainingLimit {
  if (raw === "all") return "all";
  const n = Number(raw);
  return (TRAINING_LIMITS as readonly (number | "all")[]).includes(n) ? (n as TrainingLimit) : "all";
}

// Невідомий/порожній types — усі 4 типи (найширший безпечний дефолт, та
// сама логіка, що інші query-валідатори тут).
function parseTypes(raw: string | undefined): QuestionType[] {
  if (!raw) return ALL_TYPES;
  const picked = raw.split(",").filter((v): v is QuestionType => (ALL_TYPES as readonly string[]).includes(v));
  return picked.length > 0 ? picked : ALL_TYPES;
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

  const filter = parseFilter(first(sp.filter));
  const category = parseCategory(first(sp.category));
  const limit = parseLimit(first(sp.limit));
  const types = parseTypes(first(sp.types));

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
      <TrainPlayView lang={lang} words={result.words} enabledTypes={types} />
    </div>
  );
}
