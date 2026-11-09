"use client";

import { useTransition } from "react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { saveWeeklyGoal } from "@/app/cabinet/actions";
import { CardTitle } from "@/components/cabinet/card-title";

const GOAL_OPTIONS = Array.from({ length: 14 }, (_, i) => i + 1);

export function WeeklyGoalCard({
  lang,
  done,
  goal,
}: {
  lang: UiLang;
  done: number;
  goal: number;
}) {
  const [pending, startTransition] = useTransition();
  const percent = goal > 0 ? Math.min(100, Math.round((100 * done) / goal)) : 0;

  function handleChange(value: string) {
    const formData = new FormData();
    formData.set("goal", value);
    startTransition(() => {
      void saveWeeklyGoal(formData);
    });
  }

  return (
    <div className="cabinet-card flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <CardTitle>{t(lang, "home.goal.title")}</CardTitle>
        <select
          defaultValue={goal}
          disabled={pending}
          onChange={(e) => handleChange(e.target.value)}
          className="cabinet-select disabled:opacity-60"
          aria-label={t(lang, "home.goal.title")}
        >
          {GOAL_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <p className="text-sm text-[var(--cabinet-muted)]">{t(lang, "home.goal.of", { done, goal })}</p>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--cabinet-track)]"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${percent}%`, background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
        />
      </div>
    </div>
  );
}
