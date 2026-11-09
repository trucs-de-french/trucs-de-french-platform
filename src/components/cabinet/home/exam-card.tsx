"use client";

import { useState, useTransition } from "react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { ExamInfo } from "@/lib/cabinet/home-data";
import { EXAM_TYPE_OPTIONS } from "@/lib/cabinet/exam-types";
import { saveExam } from "@/app/cabinet/actions";
import { DatePicker } from "@/components/cabinet/date-picker";
import { CardTitle } from "@/components/cabinet/card-title";
import { CabinetSelect } from "@/components/cabinet/cabinet-select";

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

const LOCALE_BY_LANG: Record<UiLang, string> = { uk: "uk-UA", fr: "fr-FR", en: "en-US" };

function formatExamDate(dateStr: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${dateStr}T00:00:00Z`)
  );
}

export function ExamCard({ lang, exam }: { lang: UiLang; exam: ExamInfo | null }) {
  const [editing, setEditing] = useState(false);
  const showForm = editing || !exam;

  return (
    <div className="cabinet-card flex h-full flex-col items-center gap-3 p-5">
      <div className="flex w-full items-center justify-between">
        <CardTitle>{t(lang, "home.exam.title")}</CardTitle>
        {exam && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-11 text-xs font-semibold text-[var(--cabinet-link)] dark:hover:underline dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)]"
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
          <>
            {exam.daysLeft > 0 ? (
              <>
                <div className="font-body text-4xl font-extrabold text-[var(--cabinet-ink)]">{exam.daysLeft}</div>
                <p className="text-sm font-semibold text-[var(--cabinet-muted)]">
                  {t(lang, "home.exam.countdown", { n: exam.daysLeft })}
                </p>
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
            <div className="font-body text-sm font-semibold text-[var(--cabinet-ink)]">
              {exam.type} · {formatExamDate(exam.date, LOCALE_BY_LANG[lang])}
            </div>
          </>
        )
      )}
    </div>
  );
}
