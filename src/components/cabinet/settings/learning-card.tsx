"use client";

// Тижнева ціль (круглі чипи 1–7 + додатковий, якщо збережено поза
// діапазоном) і блок іспиту (тип+дата) — застосовують
// зміну одразу через ті самі дії, що Home (saveWeeklyGoal/saveExam у
// cabinet/actions.ts), не через нижню панель "Є незбережені зміни": той
// самий підхід, що мова/тема в interface-card.tsx. Блок іспиту видно лише
// за тим самим showExamCard-критерієм, що на Home (getExamSettingsData).
import { useState, useTransition } from "react";
import { t } from "@/lib/i18n/t";
import { plural, type PluralForms } from "@/lib/i18n/plural";
import type { UiLang } from "@/lib/ui/product-lang";
import type { ExamInfo } from "@/lib/cabinet/home-data";
import { EXAM_TYPE_OPTIONS } from "@/lib/cabinet/exam-types";
import { saveWeeklyGoal, saveExam } from "@/app/cabinet/actions";
import { DatePicker } from "@/components/cabinet/date-picker";
import { CardTitle } from "@/components/cabinet/card-title";
import { CabinetSelect } from "@/components/cabinet/cabinet-select";

// 1–7 — найпоширеніший діапазон; БД дозволяє 1..14 (CHECK constraint), тож
// значення поза 1–7 (збережене раніше чи вручну) дописується як ДОДАТКОВИЙ
// вибраний чип в кінці ряду (options нижче), а не обрізається/перезаписується.
const GOAL_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const RECOMMENDED_GOAL = 3;

const SCENE_UNIT_FORMS: Record<UiLang, PluralForms> = {
  uk: { one: "сцена", few: "сцени", many: "сцен", other: "сцен" },
  fr: { one: "scène", other: "scènes" },
  en: { one: "scene", other: "scenes" },
};

function WeeklyGoalPills({ lang, goal }: { lang: UiLang; goal: number }) {
  const [pending, startTransition] = useTransition();
  const options = GOAL_OPTIONS.includes(goal) ? GOAL_OPTIONS : [...GOAL_OPTIONS, goal];

  function handleChange(value: number) {
    const formData = new FormData();
    formData.set("goal", String(value));
    startTransition(() => {
      void saveWeeklyGoal(formData);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="text-xs font-semibold text-[var(--cabinet-muted)]">{t(lang, "home.goal.title")}</span>
        <p className="mt-0.5 font-body text-sm text-[var(--cabinet-muted)]">{t(lang, "settings.goal.helper")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            disabled={pending}
            aria-pressed={n === goal}
            aria-label={String(n)}
            onClick={() => handleChange(n)}
            className={`settings-goal-chip ${n === goal ? "settings-goal-chip--active" : ""}`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="font-body text-sm text-[var(--cabinet-ink)]">
        {t(lang, "settings.goal.caption", { n: goal, unit: plural(lang, goal, SCENE_UNIT_FORMS[lang]) })}
        {goal === RECOMMENDED_GOAL && (
          <span className="settings-goal-recommended-tag">{t(lang, "settings.goal.recommended")}</span>
        )}
      </p>
    </div>
  );
}

function ExamSettingsForm({ lang, exam }: { lang: UiLang; exam: ExamInfo | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date());

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveExam(formData);
      if (!result.ok) setError(t(lang, "home.exam.error"));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-[var(--cabinet-muted)]">{t(lang, "home.exam.title")}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[.04em] text-[#2f2c6b] dark:text-[#d9b765]"
          style={{ background: "rgba(217, 183, 101, 0.25)" }}
        >
          {t(lang, "settings.exam.badge")}
        </span>
      </div>
      <form action={handleSubmit} className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--cabinet-muted)]">{t(lang, "home.exam.type")}</span>
            <CabinetSelect
              name="examType"
              defaultValue={exam?.type ?? EXAM_TYPE_OPTIONS[0]}
              options={EXAM_TYPE_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
              aria-label={t(lang, "home.exam.type")}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--cabinet-muted)]">{t(lang, "home.exam.date")}</span>
            <DatePicker name="examDate" min={todayStr} defaultValue={exam?.date ?? null} lang={lang} />
          </label>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            aria-label={t(lang, "settings.exam.saveAriaLabel")}
            className="min-h-11 rounded-full px-4 text-sm font-bold text-[var(--cabinet-on-gold)] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
          >
            {t(lang, "home.exam.save")}
          </button>
        </div>
      </form>
      {error && <p className="text-xs text-[#9b4a44] dark:text-[#e2a49c]">{error}</p>}
    </div>
  );
}

export function LearningCard({
  lang,
  goal,
  exam,
  showExamCard,
}: {
  lang: UiLang;
  goal: number;
  exam: ExamInfo | null;
  showExamCard: boolean;
}) {
  return (
    <div id="learning" className="cabinet-card flex flex-col gap-3 p-5">
      <CardTitle>{t(lang, "settings.section.learning")}</CardTitle>
      <WeeklyGoalPills lang={lang} goal={goal} />
      {showExamCard && <ExamSettingsForm lang={lang} exam={exam} />}
    </div>
  );
}
