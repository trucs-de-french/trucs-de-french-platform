"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { t, type MessageKey } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { FrenchLevel } from "@/lib/supabase/profile";
import { savePlacementLevel } from "@/app/cabinet/actions";
import { BANK } from "@/lib/cabinet/placement-test/bank";
import {
  answerQuestion,
  computeTotals,
  createInitialPlacementTestState,
  cryptoRandom,
  evaluateLevel,
  selectOption,
  type TestState,
  type TestTotals,
} from "@/lib/cabinet/placement-test/engine";
import { PlacementLevelCoin } from "./placement-level-coin";

const STORAGE_KEY = "tdf_placement_test_state_v1";
const LETTERS = ["A", "B", "C", "D"];

type Screen = "intro" | "question" | "result";
type Result = { level: FrenchLevel; scores: number[]; totals: TestTotals };

const LEVEL_META: Record<FrenchLevel, { label: string; titleKey: MessageKey; descKey: MessageKey }> = {
  A0: { label: "A0", titleKey: "placementTest.level.A0.title", descKey: "placementTest.level.A0.desc" },
  A1: { label: "A1", titleKey: "placementTest.level.A1.title", descKey: "placementTest.level.A1.desc" },
  A2: { label: "A2", titleKey: "placementTest.level.A2.title", descKey: "placementTest.level.A2.desc" },
  B1: { label: "B1", titleKey: "placementTest.level.B1.title", descKey: "placementTest.level.B1.desc" },
  B2: { label: "B2", titleKey: "placementTest.level.B2.title", descKey: "placementTest.level.B2.desc" },
  C1C2: { label: "C1–C2", titleKey: "placementTest.level.C1C2.title", descKey: "placementTest.level.C1C2.desc" },
};

function readStoredState(): TestState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TestState> | null;
    if (
      parsed &&
      typeof parsed.part === "number" &&
      typeof parsed.qi === "number" &&
      Array.isArray(parsed.qs) &&
      Array.isArray(parsed.scores) &&
      !parsed.finished
    ) {
      return parsed as TestState;
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredState(state: TestState | null): void {
  try {
    if (state === null) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage недоступний (приватний режим тощо) — тест просто не
    // переживе рефреш, решта функціоналу працює нормально.
  }
}

// Головний компонент /cabinet/placement-test — три екрани (вступ/
// питання/результат) як проста машина станів на useState, рушій тесту
// повністю в engine.ts (чисті функції, тестовані окремо від DOM).
export function PlacementTestClient({ lang }: { lang: UiLang }) {
  // Ліниві ініціалізатори (не mount-ефект із setState) — читання
  // sessionStorage відбувається раз, синхронно, до першого рендеру,
  // замість cascading setState в ефекті (react-hooks/set-state-in-effect).
  const [state, setState] = useState<TestState | null>(() => readStoredState());
  const [screen, setScreen] = useState<Screen>(() => (readStoredState() !== null ? "question" : "intro"));
  const [result, setResult] = useState<Result | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Персистимо в sessionStorage ПІСЛЯ кожної зміни стану (не всередині
  // setState-updater'а, щоб лишатись чистою функцією під Strict Mode).
  useEffect(() => {
    if (state) writeStoredState(state);
  }, [state]);

  const start = useCallback(() => {
    setState(createInitialPlacementTestState(cryptoRandom));
    setScreen("question");
  }, []);

  const finishWith = useCallback((finalState: TestState) => {
    const level = evaluateLevel(BANK, finalState.scores);
    const totals = computeTotals(finalState);
    writeStoredState(null);
    setState(null);
    setResult({ level, scores: finalState.scores, totals });
    setSaved(false);
    setSaveError(false);
    setScreen("result");
  }, []);

  const submit = useCallback(
    (choice: number) => {
      if (!state) return;
      const next = answerQuestion(state, BANK, choice, cryptoRandom);
      if (next.finished) finishWith(next);
      else setState(next);
    },
    [state, finishWith]
  );

  const selectCurrent = useCallback((index: number) => {
    setState((prev) => (prev ? selectOption(prev, index) : prev));
  }, []);

  // 1–4/A–D обирають варіант, Enter підтверджує поточний вибір.
  useEffect(() => {
    if (screen !== "question" || !state) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!state) return;
      const part = state.qs[state.part];
      const question = part[state.qi];
      const digitIndex = ["1", "2", "3", "4"].indexOf(e.key);
      const letterIndex = ["a", "b", "c", "d"].indexOf(e.key.toLowerCase());
      const index = digitIndex >= 0 ? digitIndex : letterIndex;
      if (index >= 0 && index < question.options.length) {
        selectCurrent(index);
        return;
      }
      if (e.key === "Enter" && state.sel !== null) {
        submit(state.sel);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [screen, state, selectCurrent, submit]);

  function handleRetry() {
    writeStoredState(null);
    setResult(null);
    setState(null);
    setScreen("intro");
  }

  function handleSave() {
    if (!result) return;
    setSaving(true);
    setSaveError(false);
    (async () => {
      const res = await savePlacementLevel(result.level);
      setSaving(false);
      if (!res.ok) {
        setSaveError(true);
        return;
      }
      setSaved(true);
    })();
  }

  if (screen === "question" && state) {
    return (
      <QuestionCard
        lang={lang}
        state={state}
        onSelect={selectCurrent}
        onDontKnow={() => submit(-1)}
        onNext={() => state.sel !== null && submit(state.sel)}
      />
    );
  }

  if (screen === "result" && result) {
    return (
      <ResultCard
        lang={lang}
        level={result.level}
        scores={result.scores}
        totals={result.totals}
        saving={saving}
        saved={saved}
        saveError={saveError}
        onSave={handleSave}
        onRetry={handleRetry}
      />
    );
  }

  return <IntroCard lang={lang} onStart={start} />;
}

function PlacementFact({ value, caption }: { value: string; caption: string }) {
  return (
    <div className="placement-fact">
      <b>{value}</b>
      <span>{caption}</span>
    </div>
  );
}

function IntroCard({ lang, onStart }: { lang: UiLang; onStart: () => void }) {
  return (
    <div className="cabinet-card flex flex-col gap-6 p-[22px_20px] min-[560px]:p-[30px_34px]">
      <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-3">
        <PlacementFact
          value={t(lang, "placementTest.intro.fact1.value")}
          caption={t(lang, "placementTest.intro.fact1.caption")}
        />
        <PlacementFact
          value={t(lang, "placementTest.intro.fact2.value")}
          caption={t(lang, "placementTest.intro.fact2.caption")}
        />
        <PlacementFact
          value={t(lang, "placementTest.intro.fact3.value")}
          caption={t(lang, "placementTest.intro.fact3.caption")}
        />
      </div>
      <ul className="placement-tips">
        <li>{t(lang, "placementTest.intro.tip1")}</li>
        <li>{t(lang, "placementTest.intro.tip2")}</li>
        <li>{t(lang, "placementTest.intro.tip3")}</li>
      </ul>
      <button type="button" onClick={onStart} className="placement-btn-primary cabinet-btn-primary self-start">
        {t(lang, "placementTest.intro.start")}
      </button>
    </div>
  );
}

function QuestionCard({
  lang,
  state,
  onSelect,
  onDontKnow,
  onNext,
}: {
  lang: UiLang;
  state: TestState;
  onSelect: (index: number) => void;
  onDontKnow: () => void;
  onNext: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const part = state.qs[state.part];
  const question = part[state.qi];

  useEffect(() => {
    headingRef.current?.focus();
  }, [state.part, state.qi]);

  return (
    <div className="cabinet-card flex flex-col p-[22px_20px] min-[560px]:p-[30px_34px]">
      <div className="placement-seg" aria-hidden="true">
        {BANK.levels.map((levelId, i) => {
          const width = i < state.part ? 100 : i === state.part ? (state.qi / part.length) * 100 : 0;
          return (
            <span key={levelId} className="placement-seg-track">
              <span className="placement-seg-fill" style={{ width: `${width}%` }} />
            </span>
          );
        })}
      </div>
      <div
        className="mt-[22px] flex justify-between font-heading text-sm font-extrabold text-[var(--cabinet-muted)]"
        aria-live="polite"
      >
        <span>{t(lang, "placementTest.question.part", { n: state.part + 1, total: BANK.levels.length })}</span>
        <span>{t(lang, "placementTest.question.number", { n: state.qi + 1, total: part.length })}</span>
      </div>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 font-heading text-[22px] font-extrabold leading-[1.3] text-[var(--cabinet-ink)] outline-none min-[560px]:text-[26px]"
      >
        {question.q}
      </h2>
      <p className="mt-2 font-body text-sm text-[var(--cabinet-muted)]">
        {t(
          lang,
          question.kind === "vocab" ? "placementTest.question.hint.vocab" : "placementTest.question.hint.grammar"
        )}
      </p>
      <div
        className="mt-[22px] flex flex-col gap-[10px]"
        role="radiogroup"
        aria-label={t(lang, "placementTest.question.optionsLabel")}
      >
        {question.options.map((option, i) => {
          const isSelected = state.sel === i;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(i)}
              className={`placement-option ${isSelected ? "placement-option--selected" : ""}`}
            >
              <span className="placement-option-badge">{LETTERS[i]}</span>
              {option}
            </button>
          );
        })}
      </div>
      <div className="mt-[22px] flex items-center justify-between gap-3">
        <button type="button" onClick={onDontKnow} className="placement-text-link">
          {t(lang, "placementTest.question.dontKnow")}
        </button>
        <button
          type="button"
          disabled={state.sel === null}
          onClick={onNext}
          className="placement-btn-primary cabinet-btn-primary"
        >
          {t(lang, "placementTest.question.next")}
        </button>
      </div>
    </div>
  );
}

function ResultCard({
  lang,
  level,
  scores,
  totals,
  saving,
  saved,
  saveError,
  onSave,
  onRetry,
}: {
  lang: UiLang;
  level: FrenchLevel;
  scores: number[];
  totals: TestTotals;
  saving: boolean;
  saved: boolean;
  saveError: boolean;
  onSave: () => void;
  onRetry: () => void;
}) {
  const meta = LEVEL_META[level];
  const isA0 = level === "A0";

  // Один з тайлів підсвічується (визначений рівень): A0 — окремий 6-й
  // тайл на початку ряду (жодну частину не пройдено, нема що підсвічувати
  // серед A1..C1C2); інакше — тайл частини, що дорівнює рівню (вона ЗАВЖДИ
  // серед пройдених scores, бо evaluateLevel бере останню пройдену).
  const tiles: {
    key: string;
    label: string;
    caption: string;
    selected: boolean;
    passed: boolean;
    reached: boolean;
  }[] = [];

  if (isA0) {
    tiles.push({
      key: "A0",
      label: LEVEL_META.A0.label,
      caption: t(lang, "placementTest.result.start"),
      selected: true,
      passed: false,
      reached: true,
    });
  }
  for (let i = 0; i < BANK.levels.length; i++) {
    const levelId = BANK.levels[i];
    const score = scores[i];
    const reached = score !== undefined;
    const passed = reached && score >= BANK.passMark;
    tiles.push({
      key: levelId,
      label: LEVEL_META[levelId].label,
      caption: reached
        ? t(lang, "placementTest.result.scoreFormat", { n: score, total: BANK.perPart })
        : t(lang, "placementTest.result.notReached"),
      selected: levelId === level,
      passed,
      reached,
    });
  }

  return (
    <div className="cabinet-card flex flex-col p-[22px_20px] min-[560px]:p-[30px_34px]">
      <div className="flex flex-wrap items-center gap-[22px]">
        <PlacementLevelCoin label={meta.label} />
        <div className="min-w-0">
          <h2 className="font-heading text-[28px] font-extrabold text-[var(--cabinet-ink)]">
            {t(lang, "placementTest.result.heading", { level: meta.label })}
          </h2>
          <p className="mt-1.5 font-body text-base text-[var(--cabinet-muted)]">
            {t(lang, meta.titleKey)}. {t(lang, meta.descKey)}
          </p>
        </div>
      </div>

      <div className={`placement-parts mt-5 ${isA0 ? "placement-parts--six" : ""}`}>
        {tiles.map((tile) => (
          <div
            key={tile.key}
            aria-current={tile.selected ? "true" : undefined}
            className={`placement-part-tile ${tile.selected ? "placement-part-tile--selected" : tile.passed ? "placement-part-tile--passed" : ""} ${
              !tile.reached ? "placement-part-tile--unreached" : ""
            }`}
          >
            <b>
              {tile.selected && <Check size={16} aria-hidden="true" className="placement-part-tile-check" />}
              {tile.label}
              {tile.selected && <span className="sr-only"> — {t(lang, "placementTest.result.yourLevelSr")}</span>}
            </b>
            <span>{tile.caption}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <PlacementFact
          value={t(lang, "placementTest.result.scoreFormat", { n: totals.grammarCorrect, total: totals.grammarAsked })}
          caption={t(lang, "placementTest.result.grammarLabel")}
        />
        <PlacementFact
          value={t(lang, "placementTest.result.scoreFormat", { n: totals.vocabCorrect, total: totals.vocabAsked })}
          caption={t(lang, "placementTest.result.vocabLabel")}
        />
      </div>

      <p className="mt-5 font-body text-[13px] text-[var(--cabinet-muted)]">{t(lang, "placementTest.result.note")}</p>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving || saved}
          onClick={onSave}
          className="placement-btn-primary cabinet-btn-primary disabled:opacity-60"
        >
          {t(lang, "placementTest.result.save")}
        </button>
        <button type="button" onClick={onRetry} className="placement-btn-ghost">
          {t(lang, "placementTest.result.retry")}
        </button>
      </div>

      <p role="status" aria-live="polite" className="placement-save-msg">
        {saved ? t(lang, "placementTest.result.saved", { level: meta.label }) : saveError ? t(lang, "settings.save.error") : " "}
      </p>

      <Link href="/cabinet/library" className="placement-text-link placement-text-link--accent self-start">
        {t(lang, "placementTest.result.toLibrary")}
      </Link>
    </div>
  );
}
