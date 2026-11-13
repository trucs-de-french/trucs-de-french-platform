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

// Компактний текстовий дизайн — єдиний варіант цієї картки на ВСІХ
// ширинах (<640px теж, не лише планшет/десктоп): колишній окремий
// ring-дизайн (variant="default") прибрано — мобільний Home тепер бере
// той самий компонент/стан/копірайт/i18n, що й десктоп, через
// examOrLevelCard у cabinet/page.tsx.
export function ExamCard({ lang, exam }: { lang: UiLang; exam: ExamInfo | null }) {
  const [editing, setEditing] = useState(false);
  const showForm = editing || !exam;
  const isPast = !!exam && exam.daysLeft < 0;
  const editLabelKey = isPast ? "home.exam.newDate" : "home.exam.editDate";

  return (
    <div className="cabinet-card cabinet-exam-card">
      <div className="cabinet-level-card-head">
        <CardTitle>{t(lang, isPast ? "home.exam.past" : "home.exam.title")}</CardTitle>
        {exam && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="cabinet-card-link">
            {t(lang, editLabelKey)}
          </button>
        )}
      </div>
      {showForm ? (
        <div className="w-full">
          {!exam && <p className="mb-2 text-sm text-[var(--cabinet-muted)]">{t(lang, "home.exam.setup")}</p>}
          <ExamForm lang={lang} exam={exam} onDone={() => setEditing(false)} />
        </div>
      ) : (
        exam && (
          <div className="cabinet-exam-card-body">
            {exam.daysLeft > 0 ? (
              <>
                <div className="cabinet-exam-card-left">
                  <p className="cabinet-exam-card-small-label">
                    {t(lang, exam.daysLeft === 1 ? "home.exam.daysLeftLabelOne" : "home.exam.daysLeftLabel")}
                  </p>
                  <div className="cabinet-exam-card-countdown">
                    <span className="cabinet-exam-card-number">{exam.daysLeft}</span>
                    <span className="cabinet-exam-card-unit">{plural(lang, exam.daysLeft, DAY_UNIT_FORMS[lang])}</span>
                  </div>
                </div>
                <div className="cabinet-exam-card-right">
                  <p className="cabinet-exam-card-name">{exam.type}</p>
                  <p className="cabinet-exam-card-date">{formatDateNumeric(exam.date, lang)}</p>
                </div>
              </>
            ) : exam.daysLeft === 0 ? (
              <div className="cabinet-exam-card-left">
                <p className="cabinet-exam-card-small-label">{t(lang, "home.exam.title")}</p>
                <p className="cabinet-exam-card-today">{t(lang, "home.exam.todayBig")}</p>
                <p className="cabinet-exam-card-hint">{t(lang, "home.exam.todayHint")}</p>
              </div>
            ) : (
              <>
                <div className="cabinet-exam-card-left">
                  <p className="cabinet-exam-card-small-label">{t(lang, "home.exam.past")}</p>
                  <p className="cabinet-exam-card-past-question">{t(lang, "home.exam.pastQuestion")}</p>
                  <p className="cabinet-exam-card-hint">{t(lang, "home.exam.pastHint")}</p>
                </div>
                <div className="cabinet-exam-card-right">
                  <p className="cabinet-exam-card-name">{exam.type}</p>
                  <p className="cabinet-exam-card-date">{formatDateNumeric(exam.date, lang)}</p>
                </div>
              </>
            )}
          </div>
        )
      )}
    </div>
  );
}
