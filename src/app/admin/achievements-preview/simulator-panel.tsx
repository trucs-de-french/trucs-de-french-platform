"use client";

import { useEffect, useRef, useState } from "react";
import { t, type MessageKey } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { collectionPresetStats, type BadgeStats } from "@/lib/cabinet/achievements";
import { useAdminPreview, type AdminPreviewStats } from "@/lib/cabinet/admin-preview";
import { clearAllCollectionBannerDismissals } from "@/lib/cabinet/collection-banners";
import { SwitchToggle } from "@/components/cabinet/switch-toggle";

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
  // "Тижнева ціль" на Home (WeeklyGoalCard) — ОКРЕМА метрика від
  // weeksGoalDone (кількість ТИЖНІВ із виконаною ціллю, для бейджів
  // 1/4/8/12): тут — сцени ЦЬОГО тижня / ціль цього тижня.
  weekScenesDone: string;
  weekGoal: string;
};

function toForm(stats: AdminPreviewStats, fallbackWeekScenes: number, fallbackWeekGoal: number): FormState {
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
    weekScenesDone: String(stats.weekScenes ?? fallbackWeekScenes),
    weekGoal: String(stats.weekGoal ?? fallbackWeekGoal),
  };
}

function toStats(form: FormState): AdminPreviewStats {
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
    weekScenes: num(form.weekScenesDone),
    weekGoal: Math.min(14, Math.max(1, num(form.weekGoal) || 1)),
  };
}

// Адмін-симулятор, тепер на /admin/achievements-preview (вчителі лише,
// guard — admin/layout.tsx) — читає/пише ГЛОБАЛЬНИЙ override через
// useAdminPreview() (localStorage, lib/cabinet/admin-preview.tsx), тож
// результат видно на /cabinet/achievements, /cabinet/progress і /cabinet
// (Home, включно з карткою "Тижнева ціль") — скрізь, де ці сторінки
// читають той самий override. Нічого не пишеться в Supabase — лише
// localStorage цього браузера.
export function AdminSimulatorPanel({
  lang,
  realStats,
  realWeekScenes,
  realWeekGoal,
}: {
  lang: UiLang;
  realStats: BadgeStats;
  realWeekScenes: number;
  realWeekGoal: number;
}) {
  const { override, setOverride, clear } = useAdminPreview();
  const [form, setForm] = useState<FormState>(() =>
    toForm(override ?? realStats, realWeekScenes, realWeekGoal)
  );
  // AdminPreviewProvider гідрує override з localStorage у СВОЄМУ effect
  // (не доступний ще на першому рендері, поки lazy useState вище вже
  // зафіксував form); якщо на той момент виявиться збережений override —
  // підхопити його в форму ОДИН раз, не перетираючи подальше редагування.
  const syncedStoredOverrideRef = useRef(false);
  useEffect(() => {
    if (!syncedStoredOverrideRef.current && override) {
      syncedStoredOverrideRef.current = true;
      setForm(toForm(override, realWeekScenes, realWeekGoal));
    }
  }, [override, realWeekScenes, realWeekGoal]);

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

  function field(key: keyof Omit<FormState, "examDateAdded">, labelKey: MessageKey, min = 0, max?: number) {
    return (
      <label className="achievements-admin-field">
        <span>{t(lang, labelKey)}</span>
        <input
          type="number"
          min={min}
          max={max}
          inputMode="numeric"
          className="achievements-admin-input"
          value={form[key]}
          onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
        />
      </label>
    );
  }

  function applyPreset(collection: number, key: MessageKey) {
    const preset = collectionPresetStats(collection);
    const weekGoal = Math.min(14, Math.max(1, Number(form.weekGoal) || realWeekGoal));
    const stats: AdminPreviewStats = { ...preset, weekGoal, weekScenes: weekGoal };
    setForm(toForm(stats, realWeekScenes, realWeekGoal));
    setOverride(stats);
    confirm(key);
  }

  return (
    <div className="achievements-admin-panel">
      <p className="achievements-admin-panel-title">{t(lang, "achievements.admin.panel.title")}</p>
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
        {field("weekScenesDone", "achievements.admin.field.weekScenesDone")}
        {field("weekGoal", "achievements.admin.field.weekGoal", 1, 14)}
      </div>

      <div className="achievements-admin-checkbox-row">
        <SwitchToggle
          checked={form.examDateAdded}
          onChange={(next) => setForm((prev) => ({ ...prev, examDateAdded: next }))}
          label={t(lang, "achievements.admin.field.examDateAdded")}
        />
        {t(lang, "achievements.admin.field.examDateAdded")}
      </div>

      <div className="achievements-admin-actions">
        <button
          type="button"
          className="cabinet-pill-link"
          onClick={() => {
            setOverride(toStats(form));
            confirm("achievements.admin.confirm.apply");
          }}
        >
          {t(lang, "achievements.admin.button.apply")}
        </button>
        <button
          type="button"
          className="achievements-admin-pill-outline"
          onClick={() => {
            setForm(toForm(realStats, realWeekScenes, realWeekGoal));
            clear();
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
            clearAllCollectionBannerDismissals();
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
    </div>
  );
}
