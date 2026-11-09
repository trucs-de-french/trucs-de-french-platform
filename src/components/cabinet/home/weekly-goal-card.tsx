import Link from "next/link";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { CardTitle } from "@/components/cabinet/card-title";

const RING_SIZE = 96;
const STROKE = 9;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Відображення цілі тижня на Home — редагування переїхало в Settings
// (learning-card.tsx WeeklyGoalPills); тут лише кільце + "Змінити →"
// лінк, без своєї дії збереження.
export function WeeklyGoalCard({ lang, done, goal }: { lang: UiLang; done: number; goal: number }) {
  const percent = goal > 0 ? Math.min(100, Math.round((100 * done) / goal)) : 0;
  const offset = CIRCUMFERENCE * (1 - percent / 100);
  const reached = goal > 0 && done >= goal;

  return (
    <div className="cabinet-card flex flex-col items-center gap-3 p-5 text-center">
      <div className="flex w-full items-center justify-between">
        <CardTitle>{t(lang, "home.goal.title")}</CardTitle>
        <Link
          href="/cabinet/settings"
          className="shrink-0 text-xs font-semibold text-[var(--cabinet-link)] dark:hover:underline dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)]"
        >
          {t(lang, "home.goal.change")}
        </Link>
      </div>

      <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} role="img" aria-label={t(lang, "home.goal.of", { done, goal })}>
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--cabinet-track)"
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
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize={22} fontWeight={800} fill="var(--cabinet-ink)">
          {done}/{goal}
        </text>
      </svg>

      <p className="text-sm font-semibold text-[var(--cabinet-ink)]">{t(lang, "home.goal.of", { done, goal })}</p>
      <p className="text-xs text-[var(--cabinet-muted)]">{t(lang, reached ? "home.goal.complete" : "home.goal.remaining")}</p>
    </div>
  );
}
