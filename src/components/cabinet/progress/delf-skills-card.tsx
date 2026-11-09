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
    <div className="cabinet-delf-segments" role="img" aria-label={`${label}: ${percent}%`}>
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
        <span
          key={i}
          className={`cabinet-delf-segment ${i < filled ? "" : "cabinet-delf-segment--empty"}`}
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
          const fullName = t(lang, SECTION_NAME_KEY[row.section]);
          const sectionLabel = `${row.section}, ${fullName}`;
          return (
            <li key={row.section} className="flex items-center gap-3">
              <span
                title={fullName}
                className="w-9 shrink-0 font-heading text-sm font-extrabold text-[var(--cabinet-ink)]"
              >
                {row.section}
              </span>
              <DelfSegments percent={row.percent} label={sectionLabel} />
              <span className="w-11 shrink-0 text-right text-xs font-bold text-[var(--cabinet-ink)]">
                {row.percent}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
