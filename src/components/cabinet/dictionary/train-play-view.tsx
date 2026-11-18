"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Check, ArrowLeft, ChevronDown, ChevronRight, Layers, Languages, Shuffle, AlignLeft } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { MessageKey } from "@/lib/i18n/messages/uk";
import type { UiLang } from "@/lib/ui/product-lang";
import type { PartOfSpeech } from "@/lib/vocab-categories";
import type { TrainingFilter, TrainingLimit } from "@/lib/cabinet/word-training";
import { SortableTileRow } from "@/components/exercises/sortable-tile-row";
import {
  accuracyBand,
  buildSession,
  buildTypeBreakdown,
  selectWordsByIds,
  wrongSavedWordIds,
  type AccuracyBand,
  type BuildSessionResult,
  type Question,
  type QuestionType,
  type SessionWord,
} from "@/lib/cabinet/word-training-session";
import { loadTrainingWords, recordTrainingResults, type TrainingWord } from "@/app/cabinet/dictionary/train/actions";
import type { TrainingPoolWord } from "@/lib/cabinet/word-training";

// Параметри, з якими відкрилась ЦЯ сесія (play/page.tsx) — той самий
// канонічний QuestionType-словник, що enabledTypes/buildSession (раніше
// тут був окремий TrainingExerciseType-словник setup-екрана — звідси й
// баг "перемикачі майже не впливають на сесію", виправлений об'єднанням
// словників в ОДИН): handleStart у train-setup-view.tsx сам кладе ці
// значення в query string, "Назад" нижче просто повертає їх назад.
export type TrainSetupParams = {
  filter: TrainingFilter;
  category: PartOfSpeech | "none" | "all";
  limit: TrainingLimit;
  types: QuestionType[];
};

const TYPE_CHIP_KEY: Record<QuestionType, MessageKey> = {
  cards: "cabinet.dictionary.train.setup.exercise.flipCards.name",
  choice: "cabinet.dictionary.train.setup.exercise.translationChoice.name",
  unscramble: "cabinet.dictionary.train.setup.exercise.unscramble.name",
  gap: "cabinet.dictionary.train.setup.exercise.sentenceGap.name",
};

// Та сама іконка-мапа, що EXERCISE_TYPES у train-setup-view.tsx (окрема
// копія навмисно — звідти не експортується, а переносити цілий масив
// сюди заради 4 іконок не варто) — для рядків "Слова для повторення" на
// екрані результатів.
const TYPE_ICON: Record<QuestionType, typeof Layers> = {
  cards: Layers,
  choice: Languages,
  unscramble: Shuffle,
  gap: AlignLeft,
};

// Короткі назви лише для пілюль розбивки на екрані результатів (рядок
// "Слова для повторення" і решта фічі лишаються на довгих TYPE_CHIP_KEY
// назвах) — пілюлі в один рядок без wrap, довге "Речення з пропуском"
// там не влізло б навіть на 4 типи.
const SHORT_TYPE_KEY: Record<QuestionType, MessageKey> = {
  cards: "cabinet.dictionary.train.results.shortCards",
  choice: "cabinet.dictionary.train.results.shortChoice",
  unscramble: "cabinet.dictionary.train.results.shortUnscramble",
  gap: "cabinet.dictionary.train.results.shortGap",
};

const ENCOURAGEMENT_KEY: Record<AccuracyBand, MessageKey> = {
  low: "cabinet.dictionary.train.results.encouragementLow",
  mid: "cabinet.dictionary.train.results.encouragementMid",
  high: "cabinet.dictionary.train.results.encouragementHigh",
};

type Phase = "answering" | "checked";
type Result = { savedWordId: string; type: QuestionType; correct: boolean };
type SaveState = "idle" | "saving" | "error" | "saved";
type RoundState = "playing" | "empty";

export function TrainPlayView({
  lang,
  words,
  pool,
  enabledTypes,
  setupParams,
}: {
  lang: UiLang;
  words: TrainingWord[];
  // Окремий (зазвичай більший) пул дистракторів для choice/gap — УСІ
  // слова студента з перекладом, незалежно від filter/category/limit
  // цієї сесії (train/actions.ts, buildDistractorPool). contextFr/
  // contextUk тут не потрібні (пул лише дає переклади/форми слів для
  // варіантів, не контекст) — додаються нижче як null, щоб відповідати
  // SessionWord.
  pool: TrainingPoolWord[];
  enabledTypes: QuestionType[];
  setupParams: TrainSetupParams;
}) {
  const router = useRouter();

  // Сесія будується ЛИШЕ на клієнті, у ефекті після монтування (НЕ в
  // лінивому ініціалізаторі useState, як було раніше) — buildSession
  // усередині кличе Math.random (shuffleWith/scrambleWord) для порядку
  // слів/типів/варіантів/перемішаних літер; useState-ініціалізатор
  // виконується і під час SSR, і ПОВТОРНО під час першого клієнтського
  // рендеру гідрації — два НЕЗАЛЕЖНІ викличи Math.random дають РІЗНИЙ
  // результат, тож сервер і клієнт малювали різні слова/варіанти (саме
  // це й було "Hydration failed: ... потрібно ... каструля"). builtRef
  // — buildSession викликається РІВНО один раз: React Strict Mode в dev
  // монтує/демонтує/монтує ефекти заново, і без ref-застереження другий
  // виклик переписав би сесію ІНШОЮ випадковою, що виглядало б як
  // спалах різних питань одразу після першого рендеру.
  const [session, setSession] = useState<BuildSessionResult | null>(null);
  const builtRef = useRef(false);

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("answering");
  const [selected, setSelected] = useState<string | null>(null);
  const [tiles, setTiles] = useState<string[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [cardKnown, setCardKnown] = useState<boolean | null>(null);
  const [ukExpanded, setUkExpanded] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const optionRefs = useRef<HTMLButtonElement[]>([]);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);

  // "Ще раунд"/"Повторити помилки" будують НОВУ сесію з ІНШОГО набору
  // слів (перезавантажених через loadTrainingWords, чи звужених до
  // неправильних) — activeWords/activePool тримають слова/пул ПОТОЧНОГО
  // раунду (спершу — пропси сторінки), на відміну від words/pool пропсів,
  // які лишаються тими самими, з якими сторінка вперше відкрилась.
  const [activeWords, setActiveWords] = useState<TrainingWord[]>(words);
  const [activePool, setActivePool] = useState<TrainingPoolWord[]>(pool);
  const [roundState, setRoundState] = useState<RoundState>("playing");
  const [isRoundLoading, setIsRoundLoading] = useState(false);

  // Статистика (recordTrainingResults) — рівно ОДИН збережений виклик на
  // завершений раунд: savedRef.current=true ставиться синхронно перед
  // await (не лише після відповіді сервера), тож React Strict Mode
  // double-effect чи швидкий повторний рендер того самого "кінець
  // раунду" стану не запускає другий upsert. Помилка знімає флаг назад —
  // кнопка "Спробувати ще раз" викликає saveResults() заново.
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const savedRef = useRef(false);

  function toSessionWords(poolInput: TrainingPoolWord[]): SessionWord[] {
    return poolInput.map((w) => ({ ...w, contextFr: null, contextUk: null }));
  }

  useEffect(() => {
    if (builtRef.current) return;
    builtRef.current = true;
    setSession(buildSession(activeWords, enabledTypes, undefined, toSessionWords(activePool)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- лише початкова збірка (builtRef), activeWords/activePool ще дорівнюють words/pool пропсам тут
  }, [enabledTypes]);

  const questions = session?.questions ?? [];
  const skippedCount = session?.skippedCount ?? 0;
  const question = questions[index];
  const total = questions.length;
  const isLast = index === total - 1;

  async function saveResults() {
    if (savedRef.current) return;
    savedRef.current = true;
    setSaveState("saving");
    const res = await recordTrainingResults(results.map((r) => ({ savedWordId: r.savedWordId, correct: r.correct })));
    if (!res.ok) {
      savedRef.current = false;
      setSaveState("error");
      return;
    }
    setSaveState("saved");
  }

  // Фокус на заголовок екрана результатів щойно він з'являється (і після
  // кожного "Ще раунд"/"Повторити помилки" — новий session-об'єкт теж
  // спричиняє перехід question->undefined->визначено-новий, тож цей
  // ефект спрацьовує знову природно).
  useEffect(() => {
    if (session && !question) {
      resultsHeadingRef.current?.focus();
    }
  }, [session, question]);

  // Загальний рестарт раунду — "Ще раунд"/"Повторити помилки": нова
  // сесія, index/results/фаза збереження скидаються, lastQuestion-блок
  // нижче сам підхопить нове перше питання й скине робочий стан картки
  // (selected/tiles/flipped/...), бо воно відрізняється за REFERENCE від
  // попереднього.
  function startRound(roundWords: TrainingWord[], roundPool: TrainingPoolWord[]) {
    const newSession = buildSession(roundWords, enabledTypes, undefined, toSessionWords(roundPool));
    if (newSession.questions.length === 0) {
      setRoundState("empty");
      return;
    }
    setActiveWords(roundWords);
    setActivePool(roundPool);
    setSession(newSession);
    setIndex(0);
    setResults([]);
    setRoundState("playing");
    savedRef.current = false;
    setSaveState("idle");
  }

  async function handleAnotherRound() {
    if (isRoundLoading) return;
    setIsRoundLoading(true);
    const result = await loadTrainingWords({
      filter: setupParams.filter,
      category: setupParams.category,
      limit: setupParams.limit,
    });
    setIsRoundLoading(false);
    if (!result.ok || result.words.length === 0) {
      setRoundState("empty");
      return;
    }
    startRound(result.words, result.pool);
  }

  function handleRetryMistakes() {
    const wrongIds = wrongSavedWordIds(results);
    startRound(selectWordsByIds(activeWords, wrongIds), activePool);
  }

  function handleToSetup() {
    router.push(`/cabinet/dictionary/train?${setupParamsQuery()}`);
  }

  // "Запам'ятати інформацію з попереднього рендеру" — офіційний React-
  // паттерн через useState, НЕ useRef (react-hooks/refs забороняє читати/
  // писати ref.current під час рендеру в цій версії лінтера) — той самий
  // принцип, що lastPage у flip-cards.tsx/lastHintText у task-panel-
  // header.tsx: щойно question (за REFERENCE, не лише index — так само
  // ловить "сесія щойно з'явилась") відрізняється від lastQuestion,
  // одноразово зкидаємо робочий стан картки під НЬОГО, НЕ в ефекті. Під
  // час SSR question завжди undefined (session завжди null — ефект вище
  // на сервері не виконується взагалі), тож ця гілка там ніколи не
  // виконується — спрацьовує лише після монтування на клієнті, коли
  // сесія вже реально готова.
  const [lastQuestion, setLastQuestion] = useState<Question | undefined>(undefined);
  if (question && lastQuestion !== question) {
    setLastQuestion(question);
    setSelected(null);
    setTiles(question.type === "unscramble" ? question.tiles : []);
    setFlipped(false);
    setCardKnown(null);
    setUkExpanded(false);
    setPhase("answering");
  }

  function handleClose() {
    if (window.confirm(t(lang, "cabinet.dictionary.train.play.exitConfirm"))) {
      router.push("/cabinet/dictionary");
    }
  }

  // "Назад" на setup — ТІ САМІ filter/category/limit/types, з якими
  // відкрилась ця сесія (setupParams, play/page.tsx), у query string, щоб
  // setup відкрився з тим самим вибором. Підтвердження лише якщо бодай
  // одне питання вже має відповідь (results.length>0) — порожня сесія
  // (нічого не відповідали) повертається без запитання, нічого й не
  // втрачається.
  function setupParamsQuery(): string {
    const params = new URLSearchParams();
    params.set("filter", setupParams.filter);
    params.set("category", setupParams.category);
    params.set("limit", String(setupParams.limit));
    params.set("types", setupParams.types.join(","));
    return params.toString();
  }

  function handleBack() {
    if (results.length > 0 && !window.confirm(t(lang, "cabinet.dictionary.train.play.backConfirm"))) return;
    router.push(`/cabinet/dictionary/train?${setupParamsQuery()}`);
  }

  function recordResult(correct: boolean) {
    setResults((prev) => [...prev, { savedWordId: question.savedWordId, type: question.type, correct }]);
  }

  function handleCheck() {
    if (!question || phase !== "answering") return;
    let correct = false;
    if (question.type === "choice" || question.type === "gap") {
      if (selected === null) return;
      correct = selected === question.correctAnswer;
    } else if (question.type === "unscramble") {
      correct = tiles.join("") === question.answer;
    }
    recordResult(correct);
    setPhase("checked");
  }

  function handleCardAnswer(known: boolean) {
    if (phase !== "answering" || !flipped) return;
    setCardKnown(known);
    recordResult(known);
    setPhase("checked");
  }

  // Робочий стан під нове питання (tiles/selected/phase тощо) скидає
  // render-time блок вище (lastQuestionRef) сам, щойно question (за
  // новим index) відрізняється від попереднього — тут лише просування
  // індексу, навіть за межі questions (рендер підсумку нижче тоді й
  // подбає). Збереження статистики — САМЕ ТУТ (клік "Завершити" на
  // останньому питанні), не в ефекті, що реагує на "question зник": лінт
  // (react-hooks/set-state-in-effect) справедливо забороняє синхронний
  // setState усередині ефекту — а тут це й логічно чистіше, бо це пряма
  // користувацька дія, не похідний стан, і results уже остаточний
  // (recordResult відбувся синхронно в handleCheck/handleCardAnswer, ДО
  // того, як кнопка "Завершити" взагалі стала клікабельною).
  function handleNext() {
    if (isLast) saveResults();
    setIndex((i) => i + 1);
  }

  // 2x2-сітка (≥480px, .train-options) — Ліво/Право рухають на 1 (сусід у
  // тому ж рядку), Вверх/Вниз на GRID_COLUMNS (сусід у тому ж стовпці);
  // на мобільному (1 колонка) сітка візуально лінійна, тож Ліво/Право й
  // далі рухають по порядку DOM, а Вверх/Вниз (крок 2 на 3-4 елементах)
  // лишається найближчим наближенням без запиту ширини в'юпорту.
  const GRID_COLUMNS = 2;
  function handleOptionsKeyDown(e: React.KeyboardEvent, options: string[]) {
    if (phase !== "answering") return;
    const currentIdx = selected ? options.indexOf(selected) : -1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (currentIdx + 1 + options.length) % options.length;
    else if (e.key === "ArrowLeft") next = (currentIdx - 1 + options.length) % options.length;
    else if (e.key === "ArrowDown") next = (currentIdx + GRID_COLUMNS + options.length) % options.length;
    else if (e.key === "ArrowUp") next = (currentIdx - GRID_COLUMNS + options.length) % options.length;
    else if (e.key === "Enter") {
      e.preventDefault();
      handleCheck();
      return;
    }
    if (next !== null) {
      e.preventDefault();
      setSelected(options[next]);
      optionRefs.current[next]?.focus();
    }
  }

  // "Ще раунд" (чи порожня категорія/фільтр узагалі) не лишило жодного
  // придатного слова — дружній екран замість результатів, кнопка веде на
  // setup (той самий query string, що й "Назад"/"Змінити налаштування").
  if (roundState === "empty") {
    return (
      <div className="train-card train-play-summary">
        <p className="train-status-text">{t(lang, "cabinet.dictionary.train.results.noWordsLeftTitle")}</p>
        <button type="button" className="train-cta-secondary train-cta-button" onClick={handleToSetup}>
          {t(lang, "cabinet.dictionary.train.results.toSetup")}
        </button>
      </div>
    );
  }

  // Сесія ще не побудована (ефект щойно відпрацював на клієнті) —
  // нейтральний плейсхолдер, що рендериться ОДНАКОВО на сервері й
  // клієнті (жодної залежності від Math.random/самих слів): reuse
  // існуючого ключа "Завантаження…" (додано в кроці 2, ніким досі не
  // використовувався).
  if (!session) {
    return (
      <div className="train-card train-play-summary">
        <p className="train-status-text">{t(lang, "cabinet.dictionary.train.setup.loading")}</p>
      </div>
    );
  }

  // Кінець сесії — index вийшов за межі questions (handleNext вище).
  if (!question) {
    const correctCount = results.filter((r) => r.correct).length;
    const band = accuracyBand(correctCount, results.length);
    const breakdown = buildTypeBreakdown(results);
    const wrongIds = wrongSavedWordIds(results);
    const wrongWords = wrongIds
      .map((id) => {
        const w = activeWords.find((aw) => aw.id === id);
        return w ? { ...w, type: results.find((r) => r.savedWordId === id)!.type } : null;
      })
      .filter((v): v is TrainingWord & { type: QuestionType } => v !== null);

    return (
      <div
        className="train-card train-play-summary train-results"
        aria-live="polite"
        aria-label={t(lang, "cabinet.dictionary.train.results.heading")}
      >
        <h2 ref={resultsHeadingRef} tabIndex={-1} className="train-play-summary-score">
          {t(lang, "cabinet.dictionary.train.play.summaryScore", { correct: correctCount, total: results.length })}
        </h2>
        <p className="train-results-encouragement">{t(lang, ENCOURAGEMENT_KEY[band])}</p>

        {breakdown.length > 0 && (
          <ul className="train-results-breakdown">
            {breakdown.map((entry) => {
              const Icon = TYPE_ICON[entry.type];
              const ariaLabel = t(lang, "cabinet.dictionary.train.results.breakdownAria", {
                type: t(lang, TYPE_CHIP_KEY[entry.type]),
                correct: entry.correct,
                total: entry.total,
              });
              return (
                <li key={entry.type} className="train-results-breakdown-item" aria-label={ariaLabel}>
                  <Icon size={15} aria-hidden="true" className="train-results-breakdown-icon" />
                  <span className="train-results-breakdown-name">{t(lang, SHORT_TYPE_KEY[entry.type])}</span>
                  <span>
                    {entry.correct}/{entry.total}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {wrongWords.length === 0 ? (
          <p className="train-results-congrats">{t(lang, "cabinet.dictionary.train.results.allCorrect")}</p>
        ) : (
          <div className="train-results-review">
            <h3 className="train-results-review-title">{t(lang, "cabinet.dictionary.train.results.reviewListTitle")}</h3>
            <ul className="train-results-review-list">
              {wrongWords.map((w) => {
                const Icon = TYPE_ICON[w.type];
                const fullText = w.translation ? `${w.word} — ${w.translation}` : w.word;
                return (
                  <li key={w.id} className="train-results-review-item" title={fullText}>
                    <Icon size={16} aria-hidden="true" className="train-results-review-icon" />
                    <span className="train-results-review-text">
                      <span className="train-results-review-word">{w.word}</span>
                      {w.translation && <span className="train-results-review-translation"> · {w.translation}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {skippedCount > 0 && (
          <p className="train-status-text">{t(lang, "cabinet.dictionary.train.results.skipped", { count: skippedCount })}</p>
        )}

        {saveState === "error" && (
          <div className="train-results-save-error">
            <p className="train-status-text">{t(lang, "cabinet.dictionary.train.results.saveError")}</p>
            <button type="button" className="dictionary-context-toggle" onClick={saveResults}>
              {t(lang, "cabinet.dictionary.train.results.retrySave")}
            </button>
          </div>
        )}

        <div className="train-cta-bar">
          {wrongWords.length > 0 && (
            <button
              type="button"
              className="cabinet-btn-primary train-cta-button"
              disabled={saveState === "saving"}
              onClick={handleRetryMistakes}
            >
              {t(lang, "cabinet.dictionary.train.results.retryMistakes")}
            </button>
          )}
          <div className="train-results-secondary-row">
            <button
              type="button"
              className="train-cta-secondary train-cta-button"
              disabled={saveState === "saving" || isRoundLoading}
              onClick={handleAnotherRound}
            >
              {t(lang, "cabinet.dictionary.train.results.anotherRound")}
            </button>
            <button
              type="button"
              className="train-cta-secondary train-cta-button"
              onClick={() => router.push("/cabinet/dictionary")}
            >
              {t(lang, "cabinet.nav.dictionary")}
            </button>
          </div>
          <button type="button" className="dictionary-context-toggle train-results-settings-link" onClick={handleToSetup}>
            {t(lang, "cabinet.dictionary.train.results.changeSettings")}
          </button>
        </div>
      </div>
    );
  }

  const progressPct = Math.round((index / total) * 100);

  return (
    <div className="train-play">
      <div className="train-play-header">
        <div className="train-play-header-row">
          <button type="button" onClick={handleBack} className="train-play-back">
            <ArrowLeft size={18} aria-hidden="true" />
            {t(lang, "cabinet.dictionary.train.play.back")}
          </button>
          <button
            type="button"
            aria-label={t(lang, "cabinet.dictionary.train.play.exitAria")}
            onClick={handleClose}
            className="train-play-close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="train-play-progress-wrap">
          <div className="train-play-progress-track">
            <div className="train-play-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="train-play-progress-count">
            {index + 1} / {total}
          </span>
        </div>
      </div>

      <span className="train-type-chip">{t(lang, TYPE_CHIP_KEY[question.type])}</span>

      <div
        className="train-card train-play-card"
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          if (phase === "checked") {
            handleNext();
          } else if (question.type === "unscramble") {
            // choice/gap уже самі обробляють Enter у своєму radiogroup
            // (handleOptionsKeyDown) і зупиняють сплив раніше, ніж
            // стан фази в ЦЬОМУ замиканні встигає побачити зміну — тож
            // ця гілка безпечно спрацьовує лише для unscramble
            // (плитки не мають власного Enter-обробника для
            // "Перевірити", на відміну від radiogroup-варіантів).
            handleCheck();
          }
        }}
      >
        {question.type === "cards" && (
          <div className="train-cards-face">
            <div
              role="button"
              tabIndex={0}
              onClick={() => !flipped && setFlipped(true)}
              onKeyDown={(e) => {
                if (!flipped && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  setFlipped(true);
                }
              }}
              className="train-cards-tap-area"
              aria-label={!flipped ? t(lang, "cabinet.dictionary.train.play.flipAria") : undefined}
            >
              <p className="train-cards-word">{question.word}</p>
              {flipped && (
                <>
                  <p className="train-cards-translation">{question.translation}</p>
                  {question.contextFr && <p className="dictionary-context">{question.contextFr}</p>}
                </>
              )}
              {!flipped && <p className="train-cards-hint">{t(lang, "cabinet.dictionary.train.play.flipHint")}</p>}
            </div>
            {flipped && (
              <div className="train-cards-actions">
                <button
                  type="button"
                  disabled={phase === "checked"}
                  aria-pressed={cardKnown === false}
                  onClick={() => handleCardAnswer(false)}
                  className={`train-know-btn train-know-btn--no ${cardKnown === false ? "train-know-btn--chosen" : ""} ${
                    phase === "checked" && cardKnown !== false ? "train-know-btn--unchosen" : ""
                  }`}
                >
                  <X size={18} aria-hidden="true" className="train-know-btn-icon train-know-btn-icon--no" />
                  {t(lang, "cabinet.dictionary.train.play.stillLearning")}
                </button>
                <button
                  type="button"
                  disabled={phase === "checked"}
                  aria-pressed={cardKnown === true}
                  onClick={() => handleCardAnswer(true)}
                  className={`train-know-btn train-know-btn--yes ${cardKnown === true ? "train-know-btn--chosen" : ""} ${
                    phase === "checked" && cardKnown !== true ? "train-know-btn--unchosen" : ""
                  }`}
                >
                  <Check size={18} aria-hidden="true" className="train-know-btn-icon train-know-btn-icon--yes" />
                  {t(lang, "cabinet.dictionary.train.play.know")}
                </button>
              </div>
            )}
          </div>
        )}

        {question.type === "choice" && (
          <div className="train-choice">
            <p className="train-choice-word">{question.word}</p>
            <div
              role="radiogroup"
              aria-label={t(lang, "cabinet.dictionary.train.setup.exercise.translationChoice.name")}
              className="train-options"
              onKeyDown={(e) => handleOptionsKeyDown(e, question.options)}
            >
              {question.options.map((opt, i) => (
                <button
                  key={opt}
                  ref={(el) => {
                    if (el) optionRefs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected === opt}
                  disabled={phase === "checked"}
                  onClick={() => phase === "answering" && setSelected(opt)}
                  className={optionClass(opt, selected, phase, question.correctAnswer)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {question.type === "unscramble" && (
          <div className="train-unscramble">
            {question.translation && <p className="train-unscramble-hint">{question.translation}</p>}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <SortableTileRow
                items={tiles}
                onChange={setTiles}
                locked={phase === "checked"}
                letterTile
                touchDrag
                gapClassName="letter-tile-row-gap"
                tileState={(i) => {
                  if (phase !== "checked") return undefined;
                  return tiles[i] === question.answer[i] ? "correct" : "incorrect";
                }}
              />
            </div>
          </div>
        )}

        {question.type === "gap" && (
          <div className="train-gap">
            <p className="train-gap-sentence">
              {question.sentenceBefore}
              <span className="train-gap-blank">
                {phase === "checked" ? (selected ?? "…") : "____"}
              </span>
              {question.sentenceAfter}
            </p>
            {question.contextUk && (
              <div className="dictionary-context-uk-wrap train-gap-toggle-wrap">
                <button
                  type="button"
                  aria-expanded={ukExpanded}
                  aria-controls="train-gap-context-uk"
                  onClick={() => setUkExpanded((v) => !v)}
                  className="dictionary-context-toggle"
                >
                  {ukExpanded ? (
                    <ChevronDown size={12} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={12} aria-hidden="true" />
                  )}
                  {t(lang, ukExpanded ? "cabinet.dictionary.context.hide" : "cabinet.dictionary.context.show")}
                </button>
                {ukExpanded && (
                  <p id="train-gap-context-uk" className="dictionary-context-uk train-gap-uk-text">
                    {question.contextUk}
                  </p>
                )}
              </div>
            )}
            <div
              role="radiogroup"
              aria-label={t(lang, "cabinet.dictionary.train.setup.exercise.sentenceGap.name")}
              className="train-options"
              onKeyDown={(e) => handleOptionsKeyDown(e, question.options)}
            >
              {question.options.map((opt, i) => (
                <button
                  key={opt}
                  ref={(el) => {
                    if (el) optionRefs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected === opt}
                  disabled={phase === "checked"}
                  onClick={() => phase === "answering" && setSelected(opt)}
                  className={optionClass(opt, selected, phase, question.correctAnswer)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === "checked" && question.type !== "cards" && (
          <p role="status" className={`train-feedback ${results[results.length - 1]?.correct ? "train-feedback--correct" : "train-feedback--wrong"}`}>
            {results[results.length - 1]?.correct
              ? t(lang, "cabinet.dictionary.train.play.correct")
              : t(lang, "cabinet.dictionary.train.play.correctAnswerWas", {
                  answer: question.type === "unscramble" ? question.answer : question.correctAnswer,
                })}
          </p>
        )}
      </div>

      <div className="train-cta-bar">
        {question.type !== "cards" && phase === "answering" && (
          <button
            type="button"
            className="cabinet-btn-primary train-cta-button"
            disabled={question.type === "unscramble" ? tiles.length === 0 : selected === null}
            onClick={handleCheck}
          >
            {t(lang, "cabinet.dictionary.train.play.check")}
          </button>
        )}
        {phase === "checked" && (
          <button type="button" className="cabinet-btn-primary train-cta-button" onClick={handleNext}>
            {t(lang, isLast ? "cabinet.dictionary.train.play.finish" : "cabinet.dictionary.train.play.next")}
          </button>
        )}
      </div>
    </div>
  );
}

function optionClass(option: string, selected: string | null, phase: Phase, correctAnswer: string): string {
  const isSelected = selected === option;
  if (phase === "checked") {
    if (option === correctAnswer) return "train-option train-option--correct";
    if (isSelected) return "train-option train-option--wrong";
    return "train-option train-option--disabled";
  }
  return `train-option ${isSelected ? "train-option--selected" : ""}`;
}
