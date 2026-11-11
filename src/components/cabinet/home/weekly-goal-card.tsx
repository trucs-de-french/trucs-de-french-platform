"use client";

import Link from "next/link";
import { t } from "@/lib/i18n/t";
import { plural, type PluralForms } from "@/lib/i18n/plural";
import type { UiLang } from "@/lib/ui/product-lang";
import { CardTitle } from "@/components/cabinet/card-title";
import { useAdminPreview } from "@/lib/cabinet/admin-preview";

const RING_SIZE = 96;
const STROKE = 9;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const SCENE_UNIT_FORMS: Record<UiLang, PluralForms> = {
  uk: { one: "сцена", few: "сцени", many: "сцен", other: "сцен" },
  fr: { one: "scène", other: "scènes" },
  en: { one: "scene", other: "scenes" },
};

// Відображення цілі тижня на Home — редагування переїхало в Settings
// (learning-card.tsx WeeklyGoalPills); тут лише кільце + "Змінити →"
// лінк, без своєї дії збереження. done/goal рахуються ТУТ (клієнтськи) з
// realDone/realGoal — адмінський override (useAdminPreview, /admin/
// achievements-preview, поля weekScenes/weekGoal) підміняє їх, коли
// активний; для студента override завжди null.
export function WeeklyGoalCard({
  lang,
  realDone,
  realGoal,
}: {
  lang: UiLang;
  realDone: number;
  realGoal: number;
}) {
  const { override } = useAdminPreview();
  const done = override?.weekScenes ?? realDone;
  const goal = override?.weekGoal ?? realGoal;

  const percent = goal > 0 ? Math.min(100, Math.round((100 * done) / goal)) : 0;
  const offset = CIRCUMFERENCE * (1 - percent / 100);
  const remaining = Math.max(0, goal - done);
  const reached = goal > 0 && done >= goal;

  return (
    <div className="cabinet-card flex flex-col gap-3 p-5">
      <div className="flex w-full items-center justify-between">
        <CardTitle>{t(lang, "home.goal.title")}</CardTitle>
        <Link
          href="/cabinet/settings#learning"
          className="shrink-0 text-xs font-semibold text-[var(--cabinet-link)] dark:hover:underline dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)]"
        >
          {t(lang, "home.goal.change")}
        </Link>
      </div>

      <div className="flex flex-1 items-center gap-4">
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          role="img"
          aria-label={t(lang, "home.goal.of", { done, goal })}
          className="shrink-0 cabinet-weekly-ring"
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
            strokeDashoffset={offset}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={22}
            fontWeight={800}
            letterSpacing={0}
            fill="var(--cabinet-ink)"
          >
            {done}/{goal}
          </text>
        </svg>

        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-heading text-base font-extrabold text-[var(--cabinet-ink)]">{t(lang, "home.goal.of", { done, goal })}</p>
          <p className="text-xs text-[var(--cabinet-muted)]">
            {reached
              ? t(lang, "home.goal.complete")
              : t(lang, "home.goal.remaining", { n: remaining, unit: plural(lang, remaining, SCENE_UNIT_FORMS[lang]) })}
          </p>
        </div>
      </div>
    </div>
  );
}
