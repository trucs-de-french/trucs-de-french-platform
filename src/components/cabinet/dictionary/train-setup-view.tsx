"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, Languages, Shuffle, AlignLeft } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { MessageKey } from "@/lib/i18n/messages/uk";
import { plural, type PluralForms } from "@/lib/i18n/plural";
import type { UiLang } from "@/lib/ui/product-lang";
import { PART_OF_SPEECH_ORDER, PART_OF_SPEECH_LABELS_FR, type PartOfSpeech } from "@/lib/vocab-categories";
import {
  TRAINING_LIMITS,
  hasSentenceGapFill,
  type TrainingFilter,
  type TrainingLimit,
  type TrainingExerciseType,
  type TrainingOverview,
} from "@/lib/cabinet/word-training";
import { loadTrainingWords, type TrainingWord } from "@/app/cabinet/dictionary/train/actions";
import { CabinetSelect, type CabinetSelectOption } from "@/components/cabinet/cabinet-select";
import { SwitchToggle } from "@/components/cabinet/switch-toggle";

const ALL_TYPE_IDS: TrainingExerciseType[] = ["flip_cards", "translation_choice", "unscramble", "sentence_gap"];

// Icon-мапінг — flip_cards/Shuffle(unscramble) той самий, що адмінський
// TASK_TYPE_ICONS (task-type-meta.ts), для візуальної узгодженості з
// рештою платформи; Languages/AlignLeft — нові, для типів вправ, яких у
// адмінці немає.
const EXERCISE_TYPES: {
  id: TrainingExerciseType;
  Icon: typeof Layers;
  nameKey: MessageKey;
  descKey: MessageKey;
}[] = [
  {
    id: "flip_cards",
    Icon: Layers,
    nameKey: "cabinet.dictionary.train.setup.exercise.flipCards.name",
    descKey: "cabinet.dictionary.train.setup.exercise.flipCards.desc",
  },
  {
    id: "translation_choice",
    Icon: Languages,
    nameKey: "cabinet.dictionary.train.setup.exercise.translationChoice.name",
    descKey: "cabinet.dictionary.train.setup.exercise.translationChoice.desc",
  },
  {
    id: "unscramble",
    Icon: Shuffle,
    nameKey: "cabinet.dictionary.train.setup.exercise.unscramble.name",
    descKey: "cabinet.dictionary.train.setup.exercise.unscramble.desc",
  },
  {
    id: "sentence_gap",
    Icon: AlignLeft,
    nameKey: "cabinet.dictionary.train.setup.exercise.sentenceGap.name",
    descKey: "cabinet.dictionary.train.setup.exercise.sentenceGap.desc",
  },
];

// "Почати · {count} {word}" — єдине місце в цьому екрані, де слово
// справді міняє форму залежно від числа (чіпи overview вище свідомо
// лишають фіксовану форму, як у самій задачі) — plural() (Intl.
// PluralRules) дає українські one/few/many автоматично, той самий
// принцип, що POINTS_WORD у format-points.ts.
const START_WORD_FORMS: Record<UiLang, PluralForms> = {
  uk: { one: "слово", few: "слова", many: "слів", other: "слів" },
  fr: { one: "mot", other: "mots" },
  en: { one: "word", other: "words" },
};

function SegmentedButton({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`train-segment min-h-11 ${selected ? "cabinet-chip--selected" : ""}`}
    >
      {children}
    </button>
  );
}

export function TrainSetupView({
  lang,
  overview,
  initialWords,
}: {
  lang: UiLang;
  overview: TrainingOverview;
  initialWords: TrainingWord[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<TrainingFilter>("all");
  const [category, setCategory] = useState<PartOfSpeech | "none" | "all">("all");
  const [limit, setLimit] = useState<TrainingLimit>(10);
  const [userTypes, setUserTypes] = useState<Record<TrainingExerciseType, boolean>>({
    flip_cards: true,
    translation_choice: true,
    unscramble: true,
    sentence_gap: true,
  });
  const [candidateWords, setCandidateWords] = useState<TrainingWord[]>(initialWords);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const didMountRef = useRef(false);
  const requestIdRef = useRef(0);

  // Перезчит кандидатів лише коли змінюється "Які слова" — "all" уже
  // прийшов з сервера (initialWords), тож пропускаємо фетч на монтуванні;
  // категорія/ліміт/типи вправ рахуються нижче з уже наявного списку
  // клієнтом, без нового запиту — категорія завжди підмножина того
  // самого filter-набору.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(false);
    loadTrainingWords({ filter, category: "all", limit: "all" }).then((result) => {
      if (requestIdRef.current !== requestId) return; // застарілий запит (filter змінився знову раніше)
      setLoading(false);
      if (!result.ok) {
        setLoadError(true);
        return;
      }
      setCandidateWords(result.words);
    });
  }, [filter]);

  // Якщо вибрана категорія зникла з нового filter-набору (0 слів) —
  // похідне значення для РЕНДЕРУ (не окремий стейт+ефект-корекція):
  // поки category невалідна для поточного candidateWords, усюди нижче
  // використовується "all", без жодного setState під час рендеру/efect.
  // Сам category-стейт не чіпаємо — якщо студент повернеться на
  // попередній filter/категорія знову стане валідною, вибір сам
  // "повернеться" без додаткової синхронізації.
  const effectiveCategory = useMemo(() => {
    if (category === "all") return "all" as const;
    const stillExists = candidateWords.some((w) =>
      category === "none" ? w.partOfSpeech === null : w.partOfSpeech === category
    );
    return stillExists ? category : ("all" as const);
  }, [category, candidateWords]);

  const categoryOptions = useMemo((): CabinetSelectOption[] => {
    const counts = new Map<string, number>();
    for (const w of candidateWords) {
      const key = w.partOfSpeech ?? "none";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const options: CabinetSelectOption[] = [
      {
        value: "all",
        label: `${t(lang, "cabinet.dictionary.train.setup.categoryAll")} · ${candidateWords.length}`,
      },
    ];
    for (const pos of PART_OF_SPEECH_ORDER) {
      const count = counts.get(pos);
      if (count) options.push({ value: pos, label: `${PART_OF_SPEECH_LABELS_FR[pos]} · ${count}` });
    }
    const noneCount = counts.get("none");
    if (noneCount) {
      options.push({ value: "none", label: `${t(lang, "cabinet.dictionary.category.none")} · ${noneCount}` });
    }
    return options;
  }, [candidateWords, lang]);

  const categoryFiltered = useMemo(() => {
    if (effectiveCategory === "all") return candidateWords;
    return candidateWords.filter((w) =>
      effectiveCategory === "none" ? w.partOfSpeech === null : w.partOfSpeech === effectiveCategory
    );
  }, [candidateWords, effectiveCategory]);

  const candidateCount = categoryFiltered.length;
  const gapFillEligibleCount = useMemo(
    () => categoryFiltered.filter((w) => hasSentenceGapFill(w)).length,
    [categoryFiltered]
  );
  const gapFillAvailable = gapFillEligibleCount >= 3;

  function isEffectivelyOn(id: TrainingExerciseType): boolean {
    if (id === "sentence_gap" && !gapFillAvailable) return false;
    return userTypes[id];
  }

  // "Хоча б один має лишитись увімкненим" — рахуємо серед ЕФЕКТИВНО
  // увімкнених (враховує й авто-вимкнений gap-fill), не лише userTypes,
  // інакше можна було б вимкнути останній РЕАЛЬНО активний тип, лишивши
  // тільки недоступний gap-fill.
  function handleToggleType(id: TrainingExerciseType, next: boolean) {
    if (!next) {
      const othersOn = ALL_TYPE_IDS.filter((other) => other !== id && isEffectivelyOn(other)).length;
      if (othersOn === 0) return;
    }
    setUserTypes((prev) => ({ ...prev, [id]: next }));
  }

  const selectedTypeIds = ALL_TYPE_IDS.filter(isEffectivelyOn);
  const startCount = limit === "all" ? candidateCount : Math.min(limit, candidateCount);
  const startWord = plural(lang, startCount, START_WORD_FORMS[lang]);
  const startLabel = t(lang, "cabinet.dictionary.train.setup.startButton", { count: startCount, word: startWord });

  function handleStart() {
    const params = new URLSearchParams();
    params.set("filter", filter);
    params.set("category", effectiveCategory);
    params.set("limit", String(limit));
    params.set("types", selectedTypeIds.join(","));
    router.push(`/cabinet/dictionary/train/play?${params.toString()}`);
  }

  return (
    <div className="train-setup">
      <section className="train-card train-section">
        <h2 className="train-section-label">{t(lang, "cabinet.dictionary.train.setup.whichWordsLabel")}</h2>
        <div
          className="train-segmented"
          role="radiogroup"
          aria-label={t(lang, "cabinet.dictionary.train.setup.whichWordsLabel")}
        >
          <SegmentedButton selected={filter === "all"} disabled={overview.total === 0} onClick={() => setFilter("all")}>
            {t(lang, "cabinet.dictionary.train.setup.filterAll")} · {overview.total}
          </SegmentedButton>
          <SegmentedButton
            selected={filter === "new"}
            disabled={overview.newCount === 0}
            onClick={() => setFilter("new")}
          >
            {t(lang, "cabinet.dictionary.train.setup.filterNew")} · {overview.newCount}
          </SegmentedButton>
          <SegmentedButton
            selected={filter === "weak"}
            disabled={overview.weakCount === 0}
            onClick={() => setFilter("weak")}
          >
            {t(lang, "cabinet.dictionary.train.setup.filterWeak")} · {overview.weakCount}
          </SegmentedButton>
        </div>
      </section>

      <section className="train-card train-section">
        <label className="train-section-label" htmlFor="train-category-select">
          {t(lang, "cabinet.dictionary.train.setup.categoryLabel")}
        </label>
        <CabinetSelect
          id="train-category-select"
          aria-label={t(lang, "cabinet.dictionary.train.setup.categoryLabel")}
          value={effectiveCategory}
          onChange={(v) => setCategory(v as PartOfSpeech | "none" | "all")}
          options={categoryOptions}
          disabled={loading}
        />
      </section>

      <section className="train-card train-section">
        <h2 className="train-section-label">{t(lang, "cabinet.dictionary.train.setup.howManyLabel")}</h2>
        <div
          className="train-segmented"
          role="radiogroup"
          aria-label={t(lang, "cabinet.dictionary.train.setup.howManyLabel")}
        >
          {TRAINING_LIMITS.map((l) => (
            <SegmentedButton key={String(l)} selected={limit === l} onClick={() => setLimit(l)}>
              {l === "all" ? t(lang, "cabinet.dictionary.train.setup.limitAll") : l}
            </SegmentedButton>
          ))}
        </div>
      </section>

      <section className="train-card train-section">
        <h2 className="train-section-label">{t(lang, "cabinet.dictionary.train.setup.exerciseTypesLabel")}</h2>
        <div className="train-exercise-list">
          {EXERCISE_TYPES.map(({ id, Icon, nameKey, descKey }) => {
            const disabled = id === "sentence_gap" && !gapFillAvailable;
            return (
              <div className="train-exercise-row" key={id}>
                <span className="train-exercise-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="train-exercise-text">
                  <span className="train-exercise-name">{t(lang, nameKey)}</span>
                  <span className="train-exercise-desc">{t(lang, descKey)}</span>
                </span>
                <SwitchToggle
                  checked={isEffectivelyOn(id)}
                  disabled={disabled}
                  onChange={(next) => handleToggleType(id, next)}
                  label={t(lang, nameKey)}
                />
              </div>
            );
          })}
        </div>
      </section>

      {loadError && <p className="train-status-text">{t(lang, "cabinet.dictionary.train.setup.error")}</p>}

      <div className="train-cta-bar">
        {startCount === 0 && <p className="train-cta-note">{t(lang, "cabinet.dictionary.train.setup.noCandidates")}</p>}
        <button
          type="button"
          className="cabinet-btn-primary train-cta-button"
          disabled={startCount === 0 || loading}
          onClick={handleStart}
        >
          {startLabel}
        </button>
      </div>
    </div>
  );
}
