"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { MessageKey } from "@/lib/i18n/messages/uk";
import type { UiLang } from "@/lib/ui/product-lang";
import type { PartOfSpeech } from "@/lib/vocab-categories";
import type { TrainingFilter, TrainingLimit, TrainingExerciseType } from "@/lib/cabinet/word-training";
import { SortableTileRow } from "@/components/exercises/sortable-tile-row";
import { buildSession, type Question, type QuestionType } from "@/lib/cabinet/word-training-session";
import type { TrainingWord } from "@/app/cabinet/dictionary/train/actions";

// Параметри, з якими відкрилась ЦЯ сесія (play/page.tsx) — у словнику
// setup-екрана (TrainingExerciseType, не QuestionType buildSession) так
// само, як handleStart у train-setup-view.tsx сам кладе їх у query
// string: "Назад" нижче просто повертає рівно ці самі значення назад,
// setup відкриється з тим самим вибором, не з дефолтом.
export type TrainSetupParams = {
  filter: TrainingFilter;
  category: PartOfSpeech | "none" | "all";
  limit: TrainingLimit;
  types: TrainingExerciseType[];
};

const TYPE_CHIP_KEY: Record<QuestionType, MessageKey> = {
  cards: "cabinet.dictionary.train.setup.exercise.flipCards.name",
  choice: "cabinet.dictionary.train.setup.exercise.translationChoice.name",
  unscramble: "cabinet.dictionary.train.setup.exercise.unscramble.name",
  gap: "cabinet.dictionary.train.setup.exercise.sentenceGap.name",
};

type Phase = "answering" | "checked";
type Result = { savedWordId: string; type: QuestionType; correct: boolean };

export function TrainPlayView({
  lang,
  words,
  enabledTypes,
  setupParams,
}: {
  lang: UiLang;
  words: TrainingWord[];
  enabledTypes: QuestionType[];
  setupParams: TrainSetupParams;
}) {
  const router = useRouter();
  // buildSession раз, лінивим ініціалізатором useState (не useMemo без
  // залежностей і не ефект) — rng викликається РІВНО один раз за життя
  // компонента, той самий принцип, що "не робити побічний ефект під час
  // рендеру", лише через ліниву ініціалізацію стейту, а не useEffect+
  // setState (чого react-hooks/set-state-in-effect тут не дозволив би).
  const [session] = useState(() => buildSession(words, enabledTypes));
  const { questions, skippedCount } = session;

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("answering");
  const [selected, setSelected] = useState<string | null>(null);
  const [tiles, setTiles] = useState<string[]>(() => (questions[0]?.type === "unscramble" ? questions[0].tiles : []));
  const [flipped, setFlipped] = useState(false);
  const [cardKnown, setCardKnown] = useState<boolean | null>(null);
  const [ukExpanded, setUkExpanded] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const optionRefs = useRef<HTMLButtonElement[]>([]);

  const question = questions[index];
  const total = questions.length;
  const isLast = index === total - 1;

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
  function handleBack() {
    if (results.length > 0 && !window.confirm(t(lang, "cabinet.dictionary.train.play.backConfirm"))) return;
    const params = new URLSearchParams();
    params.set("filter", setupParams.filter);
    params.set("category", setupParams.category);
    params.set("limit", String(setupParams.limit));
    params.set("types", setupParams.types.join(","));
    router.push(`/cabinet/dictionary/train?${params.toString()}`);
  }

  function resetForQuestion(q: Question | undefined) {
    setSelected(null);
    setTiles(q?.type === "unscramble" ? q.tiles : []);
    setFlipped(false);
    setCardKnown(null);
    setUkExpanded(false);
    setPhase("answering");
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

  function handleNext() {
    const nextIndex = index + 1;
    if (nextIndex >= total) {
      setIndex(nextIndex); // виходить за межі questions -> рендер підсумку нижче
      return;
    }
    setIndex(nextIndex);
    resetForQuestion(questions[nextIndex]);
  }

  function handleOptionsKeyDown(e: React.KeyboardEvent, options: string[]) {
    if (phase !== "answering") return;
    const currentIdx = selected ? options.indexOf(selected) : -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = (currentIdx + 1 + options.length) % options.length;
      setSelected(options[next]);
      optionRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = (currentIdx - 1 + options.length) % options.length;
      setSelected(options[prev]);
      optionRefs.current[prev]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleCheck();
    }
  }

  // Кінець сесії — index вийшов за межі questions (handleNext вище).
  if (!question) {
    const correctCount = results.filter((r) => r.correct).length;
    return (
      <div className="train-card train-play-summary">
        <p className="train-play-summary-score">
          {t(lang, "cabinet.dictionary.train.play.summaryScore", { correct: correctCount, total: results.length })}
        </p>
        {skippedCount > 0 && (
          <p className="train-status-text">
            {t(lang, "cabinet.dictionary.train.play.summarySkipped", { count: skippedCount })}
          </p>
        )}
        <button
          type="button"
          className="cabinet-btn-primary train-cta-button"
          onClick={() => router.push("/cabinet/dictionary")}
        >
          {t(lang, "cabinet.nav.dictionary")}
        </button>
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
                  onClick={() => handleCardAnswer(false)}
                  className={`train-know-btn train-know-btn--no ${cardKnown === false ? "train-know-btn--chosen" : ""}`}
                >
                  {t(lang, "cabinet.dictionary.train.play.stillLearning")}
                </button>
                <button
                  type="button"
                  disabled={phase === "checked"}
                  onClick={() => handleCardAnswer(true)}
                  className={`train-know-btn train-know-btn--yes ${cardKnown === true ? "train-know-btn--chosen" : ""}`}
                >
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
              <div className="dictionary-context-uk-wrap">
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
                  <p id="train-gap-context-uk" className="dictionary-context-uk">
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
