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

const RING_SIZE = 104;
const STROKE = 8;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ExamRing({ daysLeft, label }: { daysLeft: number; label: string }) {
  const fraction = Math.min(Math.max(daysLeft, 0), 90) / 90;
  const offset = CIRCUMFERENCE * (1 - fraction);

  return (
    <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} role="img" aria-label={label}>
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="var(--cabinet-line)"
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
        strokeDashoffset={offset}
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={28}
        fontWeight={800}
        fill="var(--cabinet-ink)"
      >
        {daysLeft}
      </text>
    </svg>
  );
}

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
  const showForm = editing || !exam || exam.daysLeft < 0;

  return (
    <div className="cabinet-card flex flex-col items-center gap-3 p-5">
      <div className="flex w-full items-center justify-between">
        <CardTitle>{t(lang, "home.exam.title")}</CardTitle>
        {exam && exam.daysLeft >= 0 && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-11 text-xs font-semibold text-[var(--cabinet-link)] dark:hover:underline dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)]"
          >
            {t(lang, "home.exam.edit")}
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
            <ExamRing daysLeft={exam.daysLeft} label={`${exam.daysLeft} ${t(lang, "home.exam.daysLeft")}`} />
            <div className="text-center">
              <div className="text-xs font-semibold text-[var(--cabinet-muted)]">
                {t(lang, "home.exam.daysLeft")}
              </div>
              <div className="font-body text-sm font-semibold text-[var(--cabinet-ink)]">
                {exam.type} · {exam.date}
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
