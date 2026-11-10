import { t, type MessageKey } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { DelfSkills } from "@/lib/cabinet/progress-data";
import { CardTitle } from "@/components/cabinet/card-title";

const SECTION_NAME_KEY: Record<string, MessageKey> = {
  CO: "progress.delf.co.name",
  CE: "progress.delf.ce.name",
  PE: "progress.delf.pe.name",
  PO: "progress.delf.po.name",
};

const SECTION_FRENCH_KEY: Record<string, MessageKey> = {
  CO: "progress.delf.co",
  CE: "progress.delf.ce",
  PE: "progress.delf.pe",
  PO: "progress.delf.po",
};

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
      <CardTitle>
        {skills.level ? t(lang, "progress.delf.title", { level: skills.level }) : skills.productTitle}
      </CardTitle>
      <ul className="flex flex-col">
        {skills.rows.map((row, idx) => {
          const name = t(lang, SECTION_NAME_KEY[row.section]);
          const frenchName = t(lang, SECTION_FRENCH_KEY[row.section]);
          const sectionLabel = `${row.section}, ${name}`;
          return (
            <li
              key={row.section}
              className={`cabinet-delf-row ${idx > 0 ? "cabinet-fade-divider" : ""}`}
            >
              <span className="cabinet-delf-chip" aria-hidden="true">
                {row.section}
              </span>
              <div className="cabinet-delf-name">
                <div className="cabinet-delf-name-main">{name}</div>
                <div className="cabinet-delf-name-fr truncate">{frenchName}</div>
              </div>
              <DelfSegments percent={row.percent} label={sectionLabel} />
              <span className="cabinet-delf-percent">{row.percent}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
