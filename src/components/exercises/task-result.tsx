"use client";

import { useId, useState, type ReactNode } from "react";
import { formatPointsLocalized, formatPointsCountLocalized } from "@/lib/exercises/format-points";
import { HintBulb } from "./hint-bulb";
import { useT } from "@/lib/i18n/context";
import { plural } from "@/lib/i18n/plural";
import type { UiLang } from "@/lib/ui/product-lang";
import {
  STATUS_LABEL_NONE,
  STATUS_LABEL_PARTIAL,
  STATUS_LABEL_FULL,
  STATUS_LABEL_NONE_UK,
  STATUS_LABEL_PARTIAL_UK,
  STATUS_LABEL_FULL_UK,
} from "@/lib/exercises/default-task-labels";

// Спільний блок результату (мокап "пілюля балів + статус-чіп + toggle") —
// замінює колишній рядок "Результат: N%" / "Правильно! ✓" + окрему пілюлю
// балів, що раніше копіювались у 19 файлах вправ. Дані (score/pointsEarned/
// pointsPossible/correct) лишаються тими самими GradeResult-полями, що й
// раніше — цей компонент лише інакше їх показує.
export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`task-result-toggle-chevron ${open ? "task-result-toggle-chevron--open" : ""}`}
    >
      <path d="M5 7.5 10 12.5 15 7.5" />
    </svg>
  );
}

function statusTone(correct: boolean, pointsEarned?: number, pointsPossible?: number) {
  if (pointsEarned !== undefined && pointsPossible !== undefined && pointsPossible > 0) {
    if (pointsEarned <= 0) return { tone: "error" as const, label: STATUS_LABEL_NONE, title: STATUS_LABEL_NONE_UK };
    if (pointsEarned < pointsPossible)
      return { tone: "warn" as const, label: STATUS_LABEL_PARTIAL, title: STATUS_LABEL_PARTIAL_UK };
    return { tone: "success" as const, label: STATUS_LABEL_FULL, title: STATUS_LABEL_FULL_UK };
  }
  return correct
    ? { tone: "success" as const, label: STATUS_LABEL_FULL, title: STATUS_LABEL_FULL_UK }
    : { tone: "error" as const, label: STATUS_LABEL_NONE, title: STATUS_LABEL_NONE_UK };
}

// Плюралізація слова "відповідь" для panel.withHintCount (uk: three-way
// mod10/mod100 — та сама форма, що pluralizeMistakes/pluralizePoints; fr/en
// — one/other через Intl.PluralRules, plural() helper).
function pluralizeAnswers(lang: "uk" | "fr" | "en", n: number): string {
  if (lang === "uk") {
    const abs = Math.abs(n);
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod10 === 1 && mod100 !== 11) return "відповідь";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "відповіді";
    return "відповідей";
  }
  return plural(lang, n, lang === "fr" ? { one: "réponse", other: "réponses" } : { one: "answer", other: "answers" });
}

// Підсумковий рядок "З підказкою: N відповідей, половина балів" (мокап 3)
// — одне місце для тексту/плюралізації, щоб усі типи вправ (через
// TaskResult.hintSummary нижче) показували однаковий рядок. hintCount —
// кількість відповідей/слів/речень/елементів із hintUsed:true у поточному
// scope (блок чи вся вправа — той самий scope, що pointsEarned/Possible на
// цьому ж викликові TaskResult); "task" — підказка одна на все завдання
// (chronological_order), без рахунку.
export function HintUsageSummary({
  hintCount,
  reducesPoints,
}: {
  hintCount: number | "task";
  reducesPoints: boolean;
}) {
  const { t, lang } = useT();
  if (hintCount !== "task" && hintCount <= 0) return null;
  const suffix = reducesPoints ? t("panel.halfPointsSuffix") : "";
  const text =
    hintCount === "task"
      ? `${t("panel.withHint")}${suffix}`
      : `${t("panel.withHintCount", { n: hintCount, word: pluralizeAnswers(lang, hintCount) })}${suffix}`;
  return (
    <span className="task-result-hint-summary">
      <HintBulb state="available" as="span" />
      <span className="min-w-0">{text}</span>
    </span>
  );
}

export function TaskResult({
  correct,
  pointsEarned,
  pointsPossible,
  children,
  toggleTitle,
  toggleCount,
  className,
  hintSummary,
}: {
  correct: boolean;
  pointsEarned?: number;
  pointsPossible?: number;
  children?: ReactNode;
  toggleTitle?: string;
  toggleCount?: number;
  className?: string;
  // {hintCount, reducesPoints} — передається викликачем (кожен тип рахує
  // hintUsed своєї детейл-структури сам, тут лише рендер однакового
  // рядка-пілюлі, HintUsageSummary вище); undefined/0 — пілюля не рендериться.
  hintSummary?: { hintCount: number | "task"; reducesPoints: boolean };
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { t, lang } = useT();
  const { tone, label, title } = statusTone(correct, pointsEarned, pointsPossible);
  const showToggle = !!children && !correct;

  return (
    <div className={`flex w-full flex-col gap-3 ${className ?? ""}`.trim()}>
      <div className="task-result-row">
        {pointsPossible !== undefined && (
          <span className="points-pill-gradient">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="#f6dc8e"
              aria-hidden="true"
              className="points-pill-star"
            >
              <path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z" />
            </svg>
            {formatPointsLocalized(pointsEarned ?? 0, pointsPossible, lang)}
          </span>
        )}
        <span
          className={`task-result-chip task-result-chip--${tone}`}
          role="status"
          title={title}
          aria-label={title}
        >
          {label}
        </span>
      </div>

      {hintSummary && <HintUsageSummary hintCount={hintSummary.hintCount} reducesPoints={hintSummary.reducesPoints} />}

      {showToggle && (
        <div className="task-result-card">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
            className="task-result-toggle-header"
          >
            <span className="task-result-toggle-title">
              <span className="task-result-toggle-title-main">{toggleTitle}</span>
              {toggleCount !== undefined && (
                <span className="task-result-toggle-title-sub">{t("panel.correctAnswersSub", { n: toggleCount })}</span>
              )}
            </span>
            <span className="task-result-toggle-action">
              {open ? t("button.hide") : t("button.show")}
              <ChevronIcon open={open} />
            </span>
          </button>
          {open && (
            <div id={panelId} className="task-result-toggle-panel">
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Рядок пар "Правильні пари" (matching.tsx) — єдиний тип, що сьогодні має
// змістовний block-result reveal (correctPairs), тож єдиний, що отримує
// плитки замість звичайного списку (решта типів — лише per-item practice-
// reveal, окрема фіча, не чіпається цією задачею).
function PairArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="task-result-pair-arrow"
    >
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

export function TaskResultPairRows({ pairs }: { pairs: { left: string; right: string }[] }) {
  return (
    <div className="task-result-pair-rows">
      {pairs.map((p, i) => (
        <div key={i} className="task-result-pair-row">
          <span className="task-result-pair-chip task-result-pair-chip--fr">{p.left}</span>
          <PairArrowIcon />
          <span className="task-result-pair-chip task-result-pair-chip--uk">{p.right}</span>
        </div>
      ))}
    </div>
  );
}

// Плитки "Правильні відповіді" (table-fill.tsx) — той самий принцип
// плитки, що TaskResultPairRows вище (однакові fr/uk чипи й стрілка), але з
// номером рядка зліва (та сама нумерація, що в самій таблиці) і без
// правильно/неправильно студента (таблиця вже це показує) — лише те, яка з
// двох клітинок була прихованою (answer), підсвічене зеленою рамкою/фоном.
function AnswerChip({
  side,
  value,
  isAnswer,
}: {
  side: "left" | "right";
  value: string;
  isAnswer: boolean;
}) {
  return (
    <span
      className={`task-result-pair-chip ${side === "left" ? "task-result-pair-chip--fr" : "task-result-pair-chip--uk"} ${
        isAnswer ? "task-result-answer-chip--emphasis" : ""
      }`}
    >
      {value}
    </span>
  );
}

export function TaskResultAnswerRows({
  rows,
}: {
  rows: { number: number; left: string; leftIsAnswer: boolean; right: string; rightIsAnswer: boolean }[];
}) {
  return (
    <div className="task-result-answer-grid">
      {rows.map((r) => (
        <div key={r.number} className="task-result-answer-row">
          <span className="task-result-answer-num" aria-hidden="true">
            {r.number}
          </span>
          <AnswerChip side="left" value={r.left} isAnswer={r.leftIsAnswer} />
          <PairArrowIcon />
          <AnswerChip side="right" value={r.right} isAnswer={r.rightIsAnswer} />
        </div>
      ))}
    </div>
  );
}

// Плитки "Правильні відповіді" для gap-типів (fill_blank/letter_gaps/
// drag_drop) — та сама родина плиток, що TaskResultAnswerRows вище, але
// ОДНА текстова колонка (речення/слово із вставленим словом-відповіддю)
// замість пари fr/uk-чипів: ці типи не показують переклад тут, лише де
// саме була правильна відповідь. parts — впорядкований список: рядок —
// звичайний текст, { word } — підсвічена вставлена відповідь (один тип
// може мати кілька { word } у плитці — усі підсвічуються).
export function TaskResultGapRows({
  rows,
  twoColumn,
}: {
  rows: { number: number; parts: (string | { word: string })[] }[];
  // letter_gaps лише: короткі слова/фрази — 2 рівні колонки від 768px (той
  // самий брейкпоінт, що картки letter_gaps/letter_rearrangement), щоб
  // позиція запису відповідала позиції картки на екрані. Інші типи
  // (fill_blank/drag_drop/open_answer/word_choice) мають довгі речення —
  // лишаються на звичайній flex-wrap розкладці (prop не передають).
  twoColumn?: boolean;
}) {
  return (
    <div className={`task-result-gap-grid${twoColumn ? " task-result-gap-grid--two-col" : ""}`}>
      {rows.map((r) => (
        <div key={r.number} className="task-result-gap-row">
          <span className="task-result-answer-num" aria-hidden="true">
            {r.number}
          </span>
          <span className="task-result-gap-text">
            {r.parts.map((p, i) =>
              typeof p === "string" ? (
                <span key={i}>{p}</span>
              ) : (
                <span key={i} className="task-result-gap-word">
                  {p.word}
                </span>
              )
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

// Плитки toggle-картки "Правильні відповіді" для image_match — мініатюра
// 56×40 + номер + правильне слово (той самий .task-result-gap-word
// емфазис, що решта gap-плиток). Звичайний <img>, не next/image — другорядний
// вміст закритого за замовчуванням toggle, без власного layout/ancestors із
// backdrop-filter/filter/transform (п. "жодних filter/transform на предках
// медіа" задачі).
export function TaskResultImageWordRows({
  rows,
}: {
  rows: { number: number; imageUrl: string; word: string }[];
}) {
  return (
    <div className="task-result-image-grid">
      {rows.map((r) => (
        <div key={r.number} className="task-result-image-row">
          <span className="task-result-answer-num" aria-hidden="true">
            {r.number}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.imageUrl} alt="" className="task-result-image-thumb" />
          <span className="task-result-gap-word task-result-image-word">{r.word}</span>
        </div>
      ))}
    </div>
  );
}

// Групи "Horizontalement"/"Verticalement" (crossword.tsx) — номер+слово
// чипами (той самий .task-result-gap-word, без стрілки order-chip —
// звичайний flex-wrap список, не послідовність).
export function TaskResultCrosswordRows({
  groups,
}: {
  groups: { label: string; items: { number: number; word: string }[] }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-1.5">
          <span className="task-result-gap-text font-bold">{g.label}</span>
          <div className="flex flex-wrap gap-2">
            {g.items.map((it) => (
              <span key={it.number} className="task-result-gap-word">
                {it.number}. {it.word}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Правило "пілюля балів рядка лише коли рядок коштує більше 1 бала" —
// одне місце (не дублюється по кожній вправі): рядки з max=1 вже сигналять
// правильно/неправильно власною зеленою/червоною рамкою, пілюля "1/1" там
// не додає інформації. possible приходить або числом, або вже
// відформатованим рядком (checkbox-grid.tsx: кома замість крапки для
// дробових часток) — парсимо кому назад у крапку лише для цього порівняння,
// формат відображення (що передав викликач) не чіпаємо.
function rowScoreMax(possible: string | number): number {
  return typeof possible === "number" ? possible : parseFloat(possible.replace(",", "."));
}

export function shouldShowRowScorePill(possible: string | number): boolean {
  return rowScoreMax(possible) > 1;
}

// Текст для aria-label "головного елемента відповіді" рядка, коли пілюля
// схована (shouldShowRowScorePill === false) — той самий принцип, що
// matching-board.tsx (ariaLabelForState): видимого тексту немає, але
// правильність рядка має лишатись доступною для читалки.
export function rowResultAriaLabel(full: boolean, lang: UiLang = "uk"): string {
  if (lang === "uk") return full ? "Правильно" : "Неправильно";
  return full ? "Correct" : "Incorrect";
}

// Пілюля-рядок "0/1" замість колишнього тексту "0/1 бал" (п.6 задачі) —
// лише код-пара, без слова "бал": рядкам сітки/таблиці потрібна вузька
// пілюля, що ніколи не переносить рядок. earned/possible — вже готові
// рядки (викликач сам форматує, напр. checkbox-grid.tsx коми замість крапки
// для дробових часток) — компонент лише розфарбовує, не форматує числа.
// Повертає null для рядків з max≤1 (правило вище) — викликачі самі
// вирішують, чи обгортка довкола неї теж мусить зникнути (порожнього
// прогалини не лишати).
export function RowScorePill({
  earned,
  possible,
  full,
}: {
  earned: string | number;
  possible: string | number;
  full: boolean;
}) {
  if (!shouldShowRowScorePill(possible)) return null;
  return (
    <span className={`task-result-row-pill ${full ? "task-result-row-pill--correct" : "task-result-row-pill--wrong"}`}>
      {earned}/{possible}
    </span>
  );
}

// Уніфікована "вкладка балів" на верхній рамці картки-рядка (мокап
// "лавандова вкладка") — замінює SCORE_LABEL_CLASS (плоский сірий текст)
// і RowScorePill (пілюля, схована для рядків ≤1 бал) УСЮДИ, де рядок
// рендериться як окрема картка. На відміну від RowScorePill, завжди
// видима (включно з рядками на 1 бал і до перевірки) — узгоджене рішення
// цього завдання, замінює правило 1bba320. earned === undefined — рядок
// ще не перевірено (лавандовий нейтральний стан, показує лише possible,
// рахункова форма "1 бал"/"2 бали"). earned задано — показує "earned з
// possible" (без слова "бал", напр. "1,5 з 3") і статусний колір: earned=0
// → wrong (червоний), earned>=possible → correct (зелений, включно з
// половинним заліком за використану підказку — earned уже прийшов
// зменшеним від викликача), інакше → partial (золотий, частковий залік).
// Рендериться як АБСОЛЮТНО позиційований сусід картки (не нащадок) —
// картки з overflow-hidden (ITEM_CARD_WRAP) інакше підрізали б вкладку,
// що виступає над верхньою рамкою; викликач оточує і вкладку, і картку
// спільною обгорткою .row-points-tab-wrap (position: relative).
export type RowPointsTabStatus = "correct" | "partial" | "wrong";

function toRowPointsNum(v: string | number): number {
  return typeof v === "number" ? v : parseFloat(v.replace(",", "."));
}

export function rowPointsTabStatus(earned: string | number, possible: string | number): RowPointsTabStatus {
  const e = toRowPointsNum(earned);
  const p = toRowPointsNum(possible);
  if (e <= 0) return "wrong";
  if (e >= p) return "correct";
  return "partial";
}

function RowPointsTabIcon({ status }: { status: RowPointsTabStatus }) {
  if (status === "correct") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  }
  if (status === "wrong") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    );
  }
  return null;
}

export function RowPointsTab({
  earned,
  possible,
}: {
  earned?: string | number;
  possible: string | number;
}) {
  const { t, lang } = useT();
  if (earned === undefined) {
    const n = toRowPointsNum(possible);
    return <span className="row-points-tab">{formatPointsCountLocalized(n, lang)}</span>;
  }
  const status = rowPointsTabStatus(earned, possible);
  return (
    <span className={`row-points-tab row-points-tab--${status}`}>
      <RowPointsTabIcon status={status} />
      {t("common.outOf", { a: earned, b: possible })}
    </span>
  );
}
