"use client";

import { useState, useTransition } from "react";
import { t } from "@/lib/i18n/t";
import { plural, type PluralForms } from "@/lib/i18n/plural";
import type { UiLang } from "@/lib/ui/product-lang";
import type { ExamInfo } from "@/lib/cabinet/home-data";
import { EXAM_TYPE_OPTIONS } from "@/lib/cabinet/exam-types";
import { saveExam } from "@/app/cabinet/actions";
import { DatePicker } from "@/components/cabinet/date-picker";
import { CardTitle } from "@/components/cabinet/card-title";
import { CabinetSelect } from "@/components/cabinet/cabinet-select";
import { formatDateNumeric } from "@/lib/cabinet/format-date";

const DAY_UNIT_FORMS: Record<UiLang, PluralForms> = {
  uk: { one: "день", few: "дні", many: "днів", other: "днів" },
  fr: { one: "jour", other: "jours" },
  en: { one: "day", other: "days" },
};

const RING_SIZE = 104;
const STROKE = 12;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const WINDOW_DAYS = 365;

function ExamForm({
  lang,
  exam,
  onDone,
}: {
  lang: UiLang;
  exam: ExamInfo | null;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date());

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveExam(formData);
      if (result.ok) {
        onDone();
      } else {
        setError(t(lang, "home.exam.error"));
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-[var(--cabinet-muted)]">{t(lang, "home.exam.type")}</span>
        <CabinetSelect
          name="examType"
          defaultValue={exam?.type ?? EXAM_TYPE_OPTIONS[0]}
          options={EXAM_TYPE_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
          aria-label={t(lang, "home.exam.type")}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-[var(--cabinet-muted)]">{t(lang, "home.exam.date")}</span>
        <DatePicker name="examDate" min={todayStr} defaultValue={exam?.date ?? null} lang={lang} />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 min-h-11 rounded-full px-4 text-sm font-bold text-[var(--cabinet-on-gold)] disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
      >
        {t(lang, "home.exam.save")}
      </button>
    </form>
  );
}

export function ExamCard({ lang, exam }: { lang: UiLang; exam: ExamInfo | null }) {
  const [editing, setEditing] = useState(false);
  const showForm = editing || !exam;

  return (
    <div className="cabinet-card flex flex-col items-center gap-[14px] p-[22px_26px_20px]">
      <div className="flex w-full items-center justify-between">
        <CardTitle>{t(lang, "home.exam.title")}</CardTitle>
        {exam && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-11 text-[13px] font-semibold text-[var(--cabinet-link)] dark:hover:underline dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)]"
          >
            {t(lang, "home.exam.editDate")}
          </button>
        )}
      </div>

      {showForm ? (
        <div className="w-full">
          {!exam && (
            <p className="mb-2 text-sm text-[var(--cabinet-muted)]">{t(lang, "home.exam.setup")}</p>
          )}
          <ExamForm lang={lang} exam={exam} onDone={() => setEditing(false)} />
        </div>
      ) : (
        exam && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            {exam.daysLeft > 0 ? (
              <>
                <svg
                  width={RING_SIZE}
                  height={RING_SIZE}
                  viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                  role="img"
                  aria-label={t(lang, "home.exam.countdown", {
                    n: exam.daysLeft,
                    unit: plural(lang, exam.daysLeft, DAY_UNIT_FORMS[lang]),
                  })}
                >
                  <circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke="var(--cabinet-track-strong)"
                    strokeWidth={STROKE}
                  />
                  <circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke="#e0aa3e"
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={CIRCUMFERENCE * (Math.min(exam.daysLeft, WINDOW_DAYS) / WINDOW_DAYS)}
                    transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                  />
                  <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontFamily="var(--font-heading)"
                    fontSize={38}
                    fontWeight={900}
                    fill="var(--cabinet-ink)"
                  >
                    {exam.daysLeft}
                  </text>
                </svg>
                <div className="flex flex-col items-center gap-[2px]">
                  <p className="font-heading text-[13px] font-extrabold text-[var(--cabinet-ink)]">
                    {plural(lang, exam.daysLeft, DAY_UNIT_FORMS[lang])}
                  </p>
                  <div className="font-body text-[15px] font-semibold text-[var(--cabinet-ink)]">
                    {exam.type} · {formatDateNumeric(exam.date, lang)}
                  </div>
                </div>
              </>
            ) : exam.daysLeft === 0 ? (
              <p className="font-body text-xl font-extrabold text-[var(--cabinet-ink)]">{t(lang, "home.exam.today")}</p>
            ) : (
              <>
                <p className="font-body text-xl font-extrabold text-[var(--cabinet-ink)]">{t(lang, "home.exam.past")}</p>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-xs font-semibold text-[var(--cabinet-link)] dark:hover:underline"
                >
                  {t(lang, "home.exam.editDate")}
                </button>
              </>
            )}
            {exam.daysLeft <= 0 && (
              <div className="font-body text-[15px] font-semibold text-[var(--cabinet-ink)]">
                {exam.type} · {formatDateNumeric(exam.date, lang)}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
