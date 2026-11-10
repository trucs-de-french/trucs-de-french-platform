"use client";

import { useEffect, useRef, useState } from "react";
import { t, type MessageKey } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { collectionPresetStats, type BadgeStats } from "@/lib/cabinet/achievements";

type FormState = {
  scenesCompleted: string;
  filmsCompleted: string;
  streakDays: string;
  totalPoints: string;
  exercisesDone: string;
  mistakesFixed: string;
  weeksGoalDone: string;
  delfExercisesDone: string;
  examDateAdded: boolean;
};

function toForm(stats: BadgeStats): FormState {
  return {
    scenesCompleted: String(stats.scenesCompleted),
    filmsCompleted: String(stats.filmsCompleted),
    streakDays: String(stats.streakDays),
    totalPoints: String(stats.totalPoints),
    exercisesDone: String(stats.exercisesDone),
    mistakesFixed: String(stats.mistakesFixed),
    weeksGoalDone: String(stats.weeksGoalDone),
    delfExercisesDone: String(stats.delfExercisesDone),
    examDateAdded: stats.examDateAdded,
  };
}

function toStats(form: FormState): BadgeStats {
  const num = (v: string) => Math.max(0, Number(v) || 0);
  const streak = num(form.streakDays);
  return {
    scenesCompleted: num(form.scenesCompleted),
    filmsCompleted: num(form.filmsCompleted),
    streakDays: streak,
    currentStreakDays: streak,
    totalPoints: num(form.totalPoints),
    exercisesDone: num(form.exercisesDone),
    mistakesFixed: num(form.mistakesFixed),
    weeksGoalDone: num(form.weeksGoalDone),
    delfExercisesDone: num(form.delfExercisesDone),
    examDateAdded: form.examDateAdded,
  };
}

// Адмін-симулятор (лише isAdmin) — перевірка бейджів/банера колекцій без
// БД: усе живе в локальному state цього компонента й батьківського
// FullAchievements (simStats), нічого не читається й не пишеться в
// Supabase чи localStorage (крім дисмісс-ключів банера — через
// onResetBanners, той самий механізм, що звичайний дисмісс).
export function AdminSimulator({
  lang,
  realStats,
  onApply,
  onReset,
  onResetBanners,
}: {
  lang: UiLang;
  realStats: BadgeStats;
  onApply: (stats: BadgeStats) => void;
  onReset: () => void;
  onResetBanners: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(realStats));

  // Підтвердження "✓ ..." після кожної кнопки — один спільний слот
  // (останній клік виграє), автоприховування через 2с; таймер у ref, щоб
  // повторний клік перезапускав відлік, а не плодив паралельні таймери.
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmVisible, setConfirmVisible] = useState(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    };
  }, []);

  function confirm(key: MessageKey) {
    setConfirmMessage(t(lang, key));
    setConfirmVisible(true);
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    confirmTimeoutRef.current = setTimeout(() => setConfirmVisible(false), 2000);
  }

  function field(key: keyof Omit<FormState, "examDateAdded">, labelKey: Parameters<typeof t>[1]) {
    return (
      <label className="achievements-admin-field">
        <span>{t(lang, labelKey)}</span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          className="achievements-admin-input"
          value={form[key]}
          onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
        />
      </label>
    );
  }

  function applyPreset(collection: number, key: MessageKey) {
    const stats = collectionPresetStats(collection);
    setForm(toForm(stats));
    onApply(stats);
    confirm(key);
  }

  return (
    <details className="achievements-admin-panel">
      <summary className="achievements-admin-panel-title">{t(lang, "achievements.admin.panel.title")}</summary>
      <p className="achievements-admin-notice">{t(lang, "achievements.admin.panel.notice")}</p>

      <div className="achievements-admin-grid">
        {field("scenesCompleted", "achievements.admin.field.scenes")}
        {field("filmsCompleted", "achievements.admin.field.films")}
        {field("streakDays", "achievements.admin.field.streak")}
        {field("totalPoints", "achievements.admin.field.points")}
        {field("exercisesDone", "achievements.admin.field.exercises")}
        {field("mistakesFixed", "achievements.admin.field.mistakes")}
        {field("weeksGoalDone", "achievements.admin.field.weeksGoal")}
        {field("delfExercisesDone", "achievements.admin.field.delf")}
      </div>

      <label className="achievements-admin-checkbox-row">
        <input
          type="checkbox"
          checked={form.examDateAdded}
          onChange={(e) => setForm((prev) => ({ ...prev, examDateAdded: e.target.checked }))}
        />
        {t(lang, "achievements.admin.field.examDateAdded")}
      </label>

      <div className="achievements-admin-actions">
        <button
          type="button"
          className="cabinet-pill-link"
          onClick={() => {
            onApply(toStats(form));
            confirm("achievements.admin.confirm.apply");
          }}
        >
          {t(lang, "achievements.admin.button.apply")}
        </button>
        <button
          type="button"
          className="achievements-admin-pill-outline"
          onClick={() => {
            setForm(toForm(realStats));
            onReset();
            confirm("achievements.admin.confirm.resetReal");
          }}
        >
          {t(lang, "achievements.admin.button.resetReal")}
        </button>
        <button
          type="button"
          className="cabinet-pill-link"
          onClick={() => applyPreset(1, "achievements.admin.confirm.collectI")}
        >
          {t(lang, "achievements.admin.button.collectI")}
        </button>
        <button
          type="button"
          className="cabinet-pill-link"
          onClick={() => applyPreset(2, "achievements.admin.confirm.collectII")}
        >
          {t(lang, "achievements.admin.button.collectII")}
        </button>
        <button
          type="button"
          className="achievements-admin-pill-outline"
          onClick={() => {
            onResetBanners();
            confirm("achievements.admin.confirm.showBannerAgain");
          }}
        >
          {t(lang, "achievements.admin.button.showBannerAgain")}
        </button>
        <span
          role="status"
          aria-live="polite"
          className={`achievements-admin-confirm ${confirmVisible ? "achievements-admin-confirm--visible" : ""}`}
        >
          {confirmMessage}
        </span>
      </div>
    </details>
  );
}
