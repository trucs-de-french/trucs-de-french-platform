"use client";

// Тижнева ціль (пілюлі 2/3/5/7) і блок іспиту (тип+дата) — застосовують
// зміну одразу через ті самі дії, що Home (saveWeeklyGoal/saveExam у
// cabinet/actions.ts), не через нижню панель "Є незбережені зміни": той
// самий підхід, що мова/тема в interface-card.tsx. Блок іспиту видно лише
// за тим самим showExamCard-критерієм, що на Home (getExamSettingsData).
import { useState, useTransition } from "react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { ExamInfo } from "@/lib/cabinet/home-data";
import { EXAM_TYPE_OPTIONS } from "@/lib/cabinet/exam-types";
import { saveWeeklyGoal, saveExam } from "@/app/cabinet/actions";
import { DatePicker } from "@/components/cabinet/date-picker";
import { SettingsPill } from "./settings-pill";

const GOAL_OPTIONS = [2, 3, 5, 7];

// Лише 4 фіксовані значення — простіше тримати форму слова тут, ніж
// заводити загальне правило множини (укр. 2-4 "сцени", 5+ "сцен") для
// однієї-єдиної пілюлі.
const GOAL_UNIT: Record<UiLang, Record<number, string>> = {
  uk: { 2: "сцени", 3: "сцени", 5: "сцен", 7: "сцен" },
  fr: { 2: "scènes", 3: "scènes", 5: "scènes", 7: "scènes" },
  en: { 2: "scenes", 3: "scenes", 5: "scenes", 7: "scenes" },
};

function WeeklyGoalPills({ lang, goal }: { lang: UiLang; goal: number }) {
  const [pending, startTransition] = useTransition();

  function handleChange(value: number) {
    const formData = new FormData();
    formData.set("goal", String(value));
    startTransition(() => {
      void saveWeeklyGoal(formData);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-[var(--cabinet-muted)]">{t(lang, "home.goal.title")}</span>
      <div className="flex flex-wrap gap-1.5">
        {GOAL_OPTIONS.map((n) => (
          <SettingsPill key={n} active={n === goal} disabled={pending} onClick={() => handleChange(n)}>
            {n} {GOAL_UNIT[lang][n]}
          </SettingsPill>
        ))}
      </div>
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
            <select name="examType" defaultValue={exam?.type ?? EXAM_TYPE_OPTIONS[0]} className="cabinet-select">
              {EXAM_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
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
    <div className="cabinet-card flex flex-col gap-4 p-5">
      <h3 className="font-body text-lg font-semibold text-[var(--cabinet-ink)]">
        {t(lang, "settings.section.learning")}
      </h3>
      <WeeklyGoalPills lang={lang} goal={goal} />
      {showExamCard && <ExamSettingsForm lang={lang} exam={exam} />}
    </div>
  );
}
