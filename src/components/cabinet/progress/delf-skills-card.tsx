import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { DelfSkills } from "@/lib/cabinet/progress-data";

const SECTION_NAME_KEY = {
  CO: "progress.delf.co",
  CE: "progress.delf.ce",
  PE: "progress.delf.pe",
  PO: "progress.delf.po",
} as const;

export function DelfSkillsCard({ lang, skills }: { lang: UiLang; skills: DelfSkills }) {
  if (!skills) return null;

  return (
    <div className="cabinet-card flex h-full flex-col gap-3 p-5">
      <h3 className="font-body text-xl font-semibold text-[var(--cabinet-ink)]">
        {skills.level ? t(lang, "progress.delf.title", { level: skills.level }) : skills.productTitle}
      </h3>
      <ul className="flex flex-col gap-3">
        {skills.rows.map((row) => (
          <li key={row.section} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-body text-sm font-semibold text-[var(--cabinet-ink)]">
                {row.section} — {t(lang, SECTION_NAME_KEY[row.section])}
              </span>
              <span className="whitespace-nowrap text-xs font-bold text-[var(--cabinet-muted)]">
                {row.percent}%
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-[var(--cabinet-track)]"
              role="progressbar"
              aria-valuenow={row.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${row.section} ${t(lang, SECTION_NAME_KEY[row.section])}`}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, row.percent)}%`, background: "var(--cabinet-primary)" }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
