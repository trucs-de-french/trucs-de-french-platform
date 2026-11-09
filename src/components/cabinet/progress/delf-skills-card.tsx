import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { DelfSkills } from "@/lib/cabinet/progress-data";

const SECTION_NAME_KEY = {
  CO: "progress.delf.co",
  CE: "progress.delf.ce",
  PE: "progress.delf.pe",
  PO: "progress.delf.po",
} as const;

const SEGMENT_COUNT = 10;

function DelfSegments({ percent, label }: { percent: number; label: string }) {
  const filled = percent <= 0 ? 0 : Math.min(SEGMENT_COUNT, Math.ceil(percent / 10));

  return (
    <div
      className="grid min-w-0 max-w-[167px] flex-1 grid-cols-10 gap-[3px]"
      role="img"
      aria-label={`${label}: ${percent}%`}
    >
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
        <span
          key={i}
          className="h-[10px] w-full rounded-[3px]"
          style={{ background: i < filled ? "var(--cabinet-gold)" : "var(--cabinet-track)" }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export function DelfSkillsCard({ lang, skills }: { lang: UiLang; skills: DelfSkills }) {
  if (!skills) return null;

  return (
    <div className="cabinet-card flex h-full flex-col gap-3 p-5">
      <h3 className="font-body text-xl font-semibold text-[var(--cabinet-ink)]">
        {skills.level ? t(lang, "progress.delf.title", { level: skills.level }) : skills.productTitle}
      </h3>
      <ul className="flex flex-col gap-3">
        {skills.rows.map((row) => {
          const sectionLabel = `${row.section} ${t(lang, SECTION_NAME_KEY[row.section])}`;
          return (
            <li
              key={row.section}
              className="flex items-center gap-3 max-[420px]:flex-col max-[420px]:items-stretch max-[420px]:gap-1.5"
            >
              <div className="flex min-w-0 flex-1 items-baseline gap-2 max-[420px]:w-full">
                <span className="w-7 shrink-0 font-heading text-sm font-extrabold text-[var(--cabinet-ink)]">
                  {row.section}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-[var(--cabinet-muted)]">
                  {t(lang, SECTION_NAME_KEY[row.section])}
                </span>
              </div>
              <div className="flex items-center gap-2 max-[420px]:w-full">
                <DelfSegments percent={row.percent} label={sectionLabel} />
                <span className="w-10 shrink-0 text-right text-xs font-bold text-[var(--cabinet-ink)]">
                  {row.percent}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
