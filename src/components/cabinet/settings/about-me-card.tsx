"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Heart, Plane, Briefcase, House, GraduationCap, Baby, type LucideIcon } from "lucide-react";
import { t, type MessageKey } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { FrenchLevel, FrenchLevelSource, LearningGoal } from "@/lib/supabase/profile";
import { saveAboutMe } from "@/app/cabinet/actions";
import { CardTitle } from "@/components/cabinet/card-title";

const GOAL_OPTIONS: { value: LearningGoal; icon: LucideIcon; labelKey: MessageKey }[] = [
  { value: "self", icon: Heart, labelKey: "settings.aboutMe.goal.self" },
  { value: "travel", icon: Plane, labelKey: "settings.aboutMe.goal.travel" },
  { value: "work", icon: Briefcase, labelKey: "settings.aboutMe.goal.work" },
  { value: "move", icon: House, labelKey: "settings.aboutMe.goal.move" },
  { value: "exam", icon: GraduationCap, labelKey: "settings.aboutMe.goal.exam" },
  { value: "kids", icon: Baby, labelKey: "settings.aboutMe.goal.kids" },
];

const LEVEL_OPTIONS: { value: FrenchLevel; nameKey: MessageKey; descKey: MessageKey }[] = [
  { value: "A0", nameKey: "settings.aboutMe.level.A0.name", descKey: "settings.aboutMe.level.A0.desc" },
  { value: "A1", nameKey: "settings.aboutMe.level.A1.name", descKey: "settings.aboutMe.level.A1.desc" },
  { value: "A2", nameKey: "settings.aboutMe.level.A2.name", descKey: "settings.aboutMe.level.A2.desc" },
  { value: "B1", nameKey: "settings.aboutMe.level.B1.name", descKey: "settings.aboutMe.level.B1.desc" },
  { value: "B2", nameKey: "settings.aboutMe.level.B2.name", descKey: "settings.aboutMe.level.B2.desc" },
];

// "Про мене" (учбова мета + рівень французької, 0067_profile_goals_
// level.sql) — нічого з цих полів поки не використовується деінде в
// кабінеті (явна вимога задачі — лише зберігання). available=false, коли
// міграція ще не застосована на цій БД (settings/page.tsx це визначає
// одним select'ом у try/catch) — картка рендериться, але "Зберегти"
// дизейблена замість падіння на не-існуючих колонках.
export function AboutMeCard({
  lang,
  available,
  initialGoals,
  initialLevel,
  initialLevelSource,
}: {
  lang: UiLang;
  available: boolean;
  initialGoals: LearningGoal[];
  initialLevel: FrenchLevel | null;
  initialLevelSource: FrenchLevelSource | null;
}) {
  const [goals, setGoals] = useState<Set<LearningGoal>>(() => new Set(initialGoals));
  const [level, setLevel] = useState<FrenchLevel | null>(initialLevel);
  const [levelSource, setLevelSource] = useState<FrenchLevelSource | null>(initialLevelSource);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  function toggleGoal(value: LearningGoal) {
    setGoals((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function toggleLevel(value: FrenchLevel) {
    setLevel((prev) => (prev === value ? null : value));
  }

  function handleSave() {
    setError(null);
    const formData = new FormData();
    for (const g of goals) formData.append("goals", g);
    formData.set("level", level ?? "");
    startTransition(async () => {
      const result = await saveAboutMe(formData);
      if (!result.ok) {
        setError(t(lang, "settings.save.error"));
        return;
      }
      setLevelSource(level ? "self" : null);
      setSaved(true);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="cabinet-card flex flex-col p-[32px_36px] md:col-span-2">
      <CardTitle>{t(lang, "settings.section.aboutMe")}</CardTitle>

      <div className="mt-7">
        <h3 className="settings-field-heading">{t(lang, "settings.aboutMe.goalsTitle")}</h3>
        <p className="settings-field-hint">{t(lang, "settings.aboutMe.goalsHint")}</p>
        <div className="mt-[14px] flex flex-wrap gap-3">
          {GOAL_OPTIONS.map(({ value, icon: Icon, labelKey }) => {
            const active = goals.has(value);
            return (
              <button
                key={value}
                type="button"
                disabled={!available}
                aria-pressed={active}
                onClick={() => toggleGoal(value)}
                className={`about-me-chip ${active ? "about-me-chip--active" : ""}`}
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                {t(lang, labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-10">
        <h3 className="settings-field-heading">{t(lang, "settings.aboutMe.levelTitle")}</h3>
        <p className="settings-field-hint">{t(lang, "settings.aboutMe.levelHint")}</p>
        <div className="about-me-level-grid mt-[14px]">
          {LEVEL_OPTIONS.map(({ value, nameKey, descKey }) => {
            const active = level === value;
            return (
              <button
                key={value}
                type="button"
                disabled={!available}
                aria-pressed={active}
                onClick={() => toggleLevel(value)}
                className={`about-me-level-card ${active ? "about-me-level-card--active" : ""}`}
              >
                <span className="about-me-level-name">{t(lang, nameKey)}</span>
                <span className="about-me-level-desc">{t(lang, descKey)}</span>
              </button>
            );
          })}
        </div>
        {levelSource && (
          <p className="about-me-level-caption">
            {t(lang, levelSource === "test" ? "settings.aboutMe.levelSource.test" : "settings.aboutMe.levelSource.self")}
          </p>
        )}
      </div>

      <div className="about-me-test-box">
        <div className="min-w-0">
          <p className="font-heading text-sm font-extrabold text-[var(--cabinet-ink)]">
            {t(lang, "settings.aboutMe.test.title")}
          </p>
          <p className="mt-1 font-body text-sm text-[var(--cabinet-muted)]">{t(lang, "settings.aboutMe.test.hint")}</p>
        </div>
        <span className="cabinet-soon-chip">{t(lang, "cabinet.soon")}</span>
      </div>

      <div className="mt-8 flex items-center justify-end gap-3">
        <span role="status" aria-live="polite" className="about-me-saved">
          {saved ? t(lang, "settings.aboutMe.saved") : ""}
        </span>
        {error && <p className="text-xs text-[#9b4a44] dark:text-[#e2a49c]">{error}</p>}
        <button
          type="button"
          disabled={!available || pending}
          onClick={handleSave}
          className="min-h-11 rounded-full px-4 text-sm font-bold text-[var(--cabinet-on-gold)] disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
        >
          {t(lang, "settings.save.submit")}
        </button>
      </div>
    </div>
  );
}
